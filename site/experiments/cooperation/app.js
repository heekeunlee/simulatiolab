(function () {
  'use strict';
  const CO = window.Cooperation, L = window.Lab;
  const { css, mix, pct, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const COL = ['#3b82f6', '#e5484d', '#1fa463', '#f5a524', '#8b5cf6'];   // 너그러운 맞받아치기는 초록과 헷갈리지 않게 주황
  let sim = null, sweep = [];
  let seedGetter = () => 1;
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 썸네일용: 150세대를 끝까지 돌린 전략 비율 그림
  const params = () => ({
    seed: seedGetter(), defectors: Number($('defectors').value) / 100, noise: Number($('noise').value) / 100,
    rounds: Number($('rounds').value), T: Number($('T').value),
  });

  function drawPop() {
    const { ctx, w, h } = L.setup($('c-pop'), 0.62);
    ctx.fillStyle = '#f1f4fa'; ctx.fillRect(0, 0, w, h);
    const n = sim.n, cols = 24, rows = Math.ceil(n / cols), cw = (w - 20) / cols, chh = (h - 20) / rows, r = Math.min(cw, chh) * 0.38;
    const st = sim.strat;
    for (let i = 0; i < n; i++) {
      const x = 10 + (i % cols) * cw + cw / 2, y = 10 + Math.floor(i / cols) * chh + chh / 2;
      ctx.fillStyle = COL[st[i]]; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    const has = sim.coopHistory.length > 0;
    $('when').textContent = `${sim.gen}/${sim.params.generations}세대 · 협력률 ${has ? pct(sim.coopHistory[sim.coopHistory.length - 1]) : '-'}`;
  }

  function drawArea() {
    const c = L.chart($('c-area'), THUMB ? 1 : 0.7, THUMB ? { l: 0, r: 0, t: 0, b: 0 } : {}), { ctx, m, pw, ph } = c, H = THUMB ? sim.history.slice(0, 71) : sim.history, T = THUMB ? 70 : sim.params.generations;   // 썸네일은 배신자가 무너지는 앞부분 70세대
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    if (!THUMB) L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '세대' });
    const acc = H.map(() => 0);
    [1, 0, 2, 3, 4].forEach((k) => {
      ctx.fillStyle = COL[k]; ctx.beginPath();
      H.forEach((s, t) => ctx.lineTo(X(t), Y(acc[t] + s[k])));
      for (let t = H.length - 1; t >= 0; t--) ctx.lineTo(X(t), Y(acc[t]));
      ctx.closePath(); ctx.fill(); H.forEach((s, t) => { acc[t] += s[k]; });
    });
  }

  function drawCoop() {
    const c = L.chart($('c-coop'), 0.7), { ctx, m, pw, ph } = c, H = sim.coopHistory, T = sim.params.generations;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '세대' });
    L.line(ctx, H.map((v, t) => [X(t + 1), Y(v)]), css('--accent'), 2.5);
    if (H.length) { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(H.length), Y(H[H.length - 1]), 4.5, 0, 7); ctx.fill(); }
  }

  function drawSweep() {
    L.dots($('c-sweep'), {
      data: sweep.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 0, x1: 0.1, xTicks: [0, 0.02, 0.04, 0.06, 0.08, 0.1], xFmt: pct, xLabel: '실수할 확률 (낸 수가 반대로 바뀜)',
      marker: { x: sim.params.noise },
    });
  }

  function renderStats() {
    const sh = sim.history[sim.history.length - 1], has = sim.coopHistory.length > 0;
    let top = 0; sh.forEach((v, i) => { if (v > sh[top]) top = i; });
    const cards = [
      ['협력률', has ? pct(sim.coopHistory[sim.coopHistory.length - 1]) : '-', '낸 수 중 협력의 비율'],
      ['가장 많은 전략', CO.NAMES[top], `전체의 ${pct(sh[top])}`],
      ['항상 배신하는 사람', pct(sh[1]), `처음엔 ${pct(sim.params.defectors)}`],
      ['평균 점수 (한 판당)', has ? sim.payHistory[sim.payHistory.length - 1].toFixed(2) : '-', '서로 협력 3점, 서로 배신 1점'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawPop(); drawArea(); drawCoop(); }

  function after() {
    const P = params(); sweep = []; drawSweep();
    $('note-sweep').textContent = '계산 중…';
    const xs = []; for (let e = 0; e <= 10; e += 2) xs.push(e / 100);
    L.jobs(xs.map((e) => () => {
      sweep.push({ x: e, runs: CO.measure({ defectors: P.defectors, noise: e, rounds: P.rounds, T: P.T }, 4).map((s) => s.coop) });
    }), drawSweep, () => {
      $('note-sweep').textContent = '점이 위아래로 갈라진 곳에서는 같은 설정이어도 협력이 퍼질 수도, 무너질 수도 있습니다';
    });
  }

  const h = L.harness({
    controls: ['defectors', 'noise', 'rounds', 'T'],
    format: { defectors: (v) => v + '%', noise: (v) => v + '%', rounds: (v) => v + '판', T: (v) => Number(v).toFixed(1) },
    defaults: { defectors: 50, noise: 2, rounds: 10, T: 5 },
    build() { sim = CO.create(params()); if (THUMB) sim.run(); },
    advance() { return sim.advance(); },
    autoplay: !THUMB,
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '마을 번호',
  });
  seedGetter = h.seed;
})();
