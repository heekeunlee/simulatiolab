(function () {
  'use strict';
  const DT = window.Dating, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, sweep = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), eye: Number($('eye').value) / 100, drift: Number($('drift').value) / 100, rounds: Number($('rounds').value) });

  // 만난 시점: 일찍(파랑) → 늦게(주황)
  function tcolor(round, total) {
    const t = Math.min(1, (round - 1) / Math.max(1, total - 1));
    const a = [47, 111, 237], b = [245, 158, 66];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  }

  function drawMarket() {
    const c = L.chart($('c-market'), 0.85, { l: 10, r: 10, t: 34, b: 24 });
    const { ctx, w, h, m, ph } = c, n = sim.n, R = sim.params.rounds;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const xl = w * 0.22, xr = w * 0.78, Y = (a) => m.t + (1 - a) * ph;
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('A 집단', xl, 20); ctx.fillText('B 집단', xr, 20);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText('↑ 매력 높음 · 낮음 ↓ (세로 위치)', w / 2, h - 6);
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) if (sim.mA[i] >= 0) {
      ctx.strokeStyle = mix(tcolor(sim.wA[i], R), 0.35).replace('rgb', 'rgb'); ctx.beginPath(); ctx.moveTo(xl, Y(sim.a[i])); ctx.lineTo(xr, Y(sim.b[sim.mA[i]])); ctx.stroke();
    }
    const dot = (x, y, matched, col) => {
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7);
      if (matched) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1; }
    };
    for (let i = 0; i < n; i++) {
      dot(xl, Y(sim.a[i]), sim.mA[i] >= 0, sim.mA[i] >= 0 ? tcolor(sim.wA[i], R) : null);
      dot(xr, Y(sim.b[i]), sim.mB[i] >= 0, sim.mB[i] >= 0 ? tcolor(sim.wB[i], R) : null);
    }
    const s = sim.stats();
    $('when').textContent = `${sim.round}/${R} 라운드 · 짝 ${pct(s.matched)}`;
  }

  function drawCouples() {
    const c = L.chart($('c-couples'), 0.85, { l: 40, b: 40 });
    const { ctx, m, pw, ph } = c, n = sim.n, R = sim.params.rounds;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - v * ph, tk = [0, 0.25, 0.5, 0.75, 1];
    L.axes(c, { X, Y, yTicks: tk, yFmt: pct, xTicks: tk, xFmt: pct, xLabel: 'A의 매력 (가로) vs 짝이 된 B의 매력 (세로)' });
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < n; i++) {
      if (sim.mA[i] >= 0) { ctx.fillStyle = mix('#2f6fed', 0.0) && tcolor(sim.wA[i], R); ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(X(sim.a[i]), Y(sim.b[sim.mA[i]]), 3.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      else { ctx.strokeStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(X(sim.a[i]), Y(0) + 2); ctx.lineTo(X(sim.a[i]), Y(0) + 8); ctx.stroke(); }
      if (sim.mB[i] < 0) { ctx.strokeStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(m.l - 2, Y(sim.b[i])); ctx.lineTo(m.l - 8, Y(sim.b[i])); ctx.stroke(); }
    }
  }

  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.rounds;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '라운드' });
    L.line(ctx, H.map((v, t) => [X(t), Y(v)]), css('--accent'), 2.5);
    const last = H.length - 1; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(H[last]), 4.5, 0, 7); ctx.fill();
  }

  function drawSweep() {
    L.dots($('c-sweep'), {
      data: sweep.map((d) => ({ x: d.x, runs: d.matched, mean: L.mean(d.matched) })),
      series: [{ data: sweep.map((d) => ({ x: d.x, runs: d.wait, mean: L.mean(d.wait) })), color: css('--rich') }],
      x0: -0.3, x1: 0.4, xTicks: [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4], xFmt: (v) => (v > 0 ? '+' : '') + Math.round(v * 100), xLabel: '눈높이 (내 매력 대비 %p)',
      marker: { x: sim.params.eye },
    });
  }

  function renderStats() {
    const s = sim.stats();
    const cards = [
      ['짝을 찾은 사람', pct(s.matched), `${sim.n * 2}명 중 ${Math.round(s.matched * sim.n * 2)}명`],
      ['평균 걸린 시간', s.meanWait ? s.meanWait.toFixed(1) + '라운드' : '-', '짝을 찾은 사람 기준'],
      ['아직 혼자인 사람', s.lone + '명', `매력 상위 20% ${s.loneHi}명, 하위 20% ${s.loneLo}명`],
      ['커플의 매력 차이', s.meanDiff ? (s.meanDiff * 100).toFixed(0) + '%p' : '-', '작을수록 비슷한 사람끼리'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawMarket(); drawCouples(); drawTime(); }

  function after() {
    const P = params(); sweep = []; drawSweep(); $('note-sweep').textContent = '계산 중…';
    const xs = []; for (let e = -30; e <= 40; e += 5) xs.push(e / 100);
    L.jobs(xs.map((e) => () => {
      const r = DT.measure({ eye: e, drift: P.drift, rounds: P.rounds }, 5);
      sweep.push({ x: e, matched: r.map((s) => s.matched), wait: r.map((s) => s.meanWait / P.rounds) });
    }), drawSweep, () => {
      $('note-sweep').textContent = '파랑: 짝을 찾은 비율, 금색: 짝을 찾기까지 걸린 시간(전체 기간 대비)';
    });
  }

  const h = L.harness({
    controls: ['eye', 'drift', 'rounds'],
    format: { eye: (v) => (Number(v) > 0 ? '+' : '') + v + '%p', drift: (v) => v + '%p', rounds: (v) => v + '라운드' },
    defaults: { eye: 10, drift: 0.5, rounds: 50 },
    build() { sim = DT.create(params()); },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '시장 번호',
  });
  seedGetter = h.seed;
})();
