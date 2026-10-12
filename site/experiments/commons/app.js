(function () {
  'use strict';
  const CM = window.Commons, L = window.Lab;
  const { css, mix, pct, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const COL = ['#e5484d', '#2f6fed', '#0ea5a5'];
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 페이지 썸네일용: 저량이 바닥난 직후의 장면으로 바로 간다
  let sim = null, sweep = [];
  let seedGetter = () => 1;
  const params = () => ({
    seed: seedGetter(), n: Number($('n').value), monitor: Number($('monitor').value) / 100,
    fine: Number($('fine').value) / 100, cc: Number($('cc').value) / 100,
  });

  // ① 호수(저량 수위)와 이용자 점들
  function drawLake() {
    const c = L.chart($('c-lake'), THUMB ? 1 : 0.62, { l: 8, r: 8, t: 8, b: 8 }), { ctx, w, h } = c, K = sim.params.K;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const tw = THUMB ? w * 0.34 : Math.min(190, w * 0.3), tx = 18, ty = 22, th = h - 56;
    ctx.fillStyle = '#e8edf6'; roundRect(ctx, tx, ty, tw, th, 10); ctx.fill();
    const lvl = Math.min(1, sim.S / K), wh = th * lvl;
    ctx.save(); roundRect(ctx, tx, ty, tw, th, 10); ctx.clip();
    const g = ctx.createLinearGradient(0, ty + th - wh, 0, ty + th); g.addColorStop(0, lvl > 0.25 ? '#6aa8ff' : '#e5484d'); g.addColorStop(1, lvl > 0.25 ? '#2f6fed' : '#b4232a');
    ctx.fillStyle = g; ctx.fillRect(tx, ty + th - wh, tw, wh); ctx.restore();
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--text'); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(tx - 4, ty + th * 0.5); ctx.lineTo(tx + tw + 4, ty + th * 0.5); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('최대 지속 수확 수준', tx + 6, ty + th * 0.5 - 5);
    ctx.textAlign = 'center'; ctx.font = '700 22px -apple-system, "Apple SD Gothic Neo", sans-serif'; const inside = wh > 46; ctx.fillStyle = inside ? '#fff' : css('--text');
    ctx.fillText(pct(lvl), tx + tw / 2, inside ? ty + th - wh + 30 : ty + th - wh - 10);   // 수면 바로 아래(안) 또는 바로 위
    ctx.fillStyle = css('--muted'); ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText('저량 (수용력 대비)', tx + tw / 2, ty + th + 18);
    // 이용자 점
    const n = sim.n, gx = tx + tw + 28, gw = w - gx - 14, gh = h - 44, cols = Math.ceil(Math.sqrt(n * gw / gh)), rows = Math.ceil(n / cols), cw = gw / cols, ch = gh / rows, r = Math.min(cw, ch) * 0.34;
    for (let i = 0; i < n; i++) {
      const x = gx + (i % cols) * cw + cw / 2, y = 14 + Math.floor(i / cols) * ch + ch / 2;
      if (sim.round > 0 && sim.act[i]) { ctx.fillStyle = mix('#e5484d', 0.18); ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, 7); ctx.fill(); }
      ctx.fillStyle = COL[sim.strat[i]]; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      if (sim.caught[i]) { ctx.strokeStyle = '#1b1f2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    }
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = '11.5px -apple-system, "Apple SD Gothic Neo", sans-serif';
    if (!THUMB && w >= 560) ctx.fillText('붉은 후광: 이번 라운드에 많이 잡음 · 검은 테두리: 적발되어 벌금', gx, h - 8);
    $('when').textContent = `${sim.round}/${sim.params.rounds}라운드 · 저량 ${pct(lvl)}`;
  }

  // ② 저량과 수확
  function drawStock() {
    const c = L.chart($('c-stock'), 0.7), { ctx, m, pw, ph } = c, T = sim.params.rounds, K = sim.params.K, MSY = sim.params.r * K / 4;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '라운드' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(0.5)); ctx.lineTo(m.l + pw, Y(0.5)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText('최대 지속 수확 수준 50%', m.l + pw - 4, Y(0.5) - 6);
    L.line(ctx, sim.harvestHist.map((v, t) => [X(t + 1), Y(Math.min(1, v / MSY))]), '#e0a100', 2);
    L.line(ctx, sim.stockHist.map((v, t) => [X(t), Y(Math.min(1, v / K))]), css('--accent'), 2.6);
  }

  // ③ 전략 비율
  function drawShares() {
    const c = L.chart($('c-share'), 0.7), { ctx, m, pw, ph } = c, H = sim.shareHist, T = sim.params.rounds;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '라운드' });
    const acc = H.map(() => 0);
    [0, 2, 1].forEach((k) => {
      ctx.fillStyle = COL[k]; ctx.beginPath();
      H.forEach((s, t) => ctx.lineTo(X(t), Y(acc[t] + s[k])));
      for (let t = H.length - 1; t >= 0; t--) ctx.lineTo(X(t), Y(acc[t]));
      ctx.closePath(); ctx.fill(); H.forEach((s, t) => { acc[t] += s[k]; });
    });
  }

  // ④ 감시 확률 vs 최종 저량
  function drawSweep() {
    L.dots($('c-sweep'), {
      data: sweep.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 0, x1: 1, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], xFmt: pct, xLabel: '감시에 적발될 확률',
      refs: [{ y: 0.5, label: '최대 지속 수확 수준 50%', color: '#8a93a6' }], marker: { x: sim.params.monitor },
    });
  }

  function renderStats() {
    const K = sim.params.K, last = sim.harvestHist.length ? sim.harvestHist[sim.harvestHist.length - 1] : null, rs = sim.restrainHist.length ? sim.restrainHist[sim.restrainHist.length - 1] : null;
    const cards = [
      ['저량 (수용력 대비)', pct(sim.S / K), '50%일 때 해마다 가장 많이 지속적으로 잡을 수 있어요'],
      ['이번 라운드 수확', last == null ? '-' : last.toFixed(1), `지속 가능한 최대치는 ${(sim.params.r * K / 4).toFixed(0)}`],
      ['절제하는 사람', rs == null ? '-' : pct(rs), '이번 라운드에 절제 노력으로 잡은 사람'],
      ['적발된 횟수 (누적)', String(sim.fined), '감시에 걸려 벌금을 낸 횟수'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawLake(); drawStock(); drawShares(); }

  function after() {
    const P = params(); sweep = []; drawSweep();
    $('note-sweep').textContent = '계산 중…';
    const xs = []; for (let m = 0; m <= 10; m++) xs.push(m / 10);
    L.jobs(xs.map((mm) => () => {
      sweep.push({ x: mm, runs: CM.measure({ n: P.n, monitor: mm, fine: P.fine, cc: P.cc }, 4).map((s) => s.stock) });
    }), drawSweep, () => {
      $('note-sweep').textContent = '각 점은 마지막 구간의 평균 저량이고, 이용자 수·벌금·조건부 협력자 비율은 위 설정을 그대로 씁니다';
    });
  }

  const h = L.harness({
    controls: ['n', 'monitor', 'fine', 'cc'],
    format: { n: (v) => v + '명', monitor: (v) => v + '%', fine: (v) => (Number(v) / 100).toFixed(1) + '배', cc: (v) => v + '%' },
    defaults: { n: 40, monitor: 0, fine: 100, cc: 20 },
    build() { sim = CM.create(params()); if (THUMB) for (let k = 0; k < 14; k++) sim.advance(); },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '어장 번호',
  });
  seedGetter = h.seed;
})();
