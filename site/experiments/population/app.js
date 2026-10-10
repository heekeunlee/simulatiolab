(function () {
  'use strict';
  const PO = window.Population, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  const GC = { young: '#1fa463', work: '#2f6fed', old: '#e0a100' };
  let sim = null, refLow = null, refHigh = null, sweepRows = [];
  let seedGetter = () => 1;
  const params = () => ({ tfr: Number($('tfr').value), migration: Number($('migration').value) * 1000, lifeGain: Number($('lifeGain').value) });
  const M = (v) => (v / 1e6).toFixed(1);

  // ---------- ① 인구 피라미드 ----------
  function drawPyramid() {
    const c = L.chart($('c-pyr'), 0.95, { l: 10, r: 10, t: 40, b: 30 });
    const { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const half = 560000, cx = m.l + pw / 2, rowH = ph / PO.AGES, scale = (pw / 2 - 18) / half;
    const y = (a) => m.t + ph - (a + 1) * rowH;
    // 눈금: 나이
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif';
    for (let a = 0; a <= 100; a += 10) { ctx.fillText(String(a), cx, y(a) + rowH * 0.9); }
    // 2024년 모양(회색 윤곽)
    ctx.strokeStyle = 'rgba(99,106,122,.55)'; ctx.lineWidth = 1.2;
    [-1, 1].forEach((side) => { ctx.beginPath(); for (let a = 0; a < PO.AGES; a++) { const x = cx + side * (12 + Math.min(sim.start[a] / 2, half) * scale); (a ? ctx.lineTo(x, y(a) + rowH / 2) : ctx.moveTo(x, y(a) + rowH / 2)); } ctx.stroke(); });
    for (let a = 0; a < PO.AGES; a++) {
      const wd = Math.min(sim.pop[a] / 2, half * 1.3) * scale, col = a <= 14 ? GC.young : a <= 64 ? GC.work : GC.old;
      ctx.fillStyle = mix(col, 0.85);
      ctx.fillRect(cx + 12, y(a), wd, Math.max(1, rowH - 0.6)); ctx.fillRect(cx - 12 - wd, y(a), wd, Math.max(1, rowH - 0.6));
    }
    ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.font = '700 22px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(String(sim.year), m.l + 4, 28);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
    ctx.fillText('남녀 50:50 가정', m.l + 76, 26); ctx.textAlign = 'right'; ctx.fillText('회색 선: 2024년', w - m.r - 4, 26);
    ctx.textAlign = 'center'; ctx.fillText('나이', cx, h - 8);
    const s = sim.summary();
    $('when').textContent = `${sim.year}년 · 총인구 ${M(s.total)}백만 명 · 65세 이상 ${pct(s.shareOld)}`;
  }

  // ---------- ② 총인구 ----------
  function drawTotal() {
    const c = L.chart($('c-total'), 0.7), { ctx, m, pw, ph } = c, p0 = sim.params.startYear, p1 = sim.params.endYear;
    const X = (yr) => m.l + ((yr - p0) / (p1 - p0)) * pw, lo = 0, hi = 70;
    const Y = (v) => m.t + ph - ((v / 1e6 - lo) / (hi - lo)) * ph;
    L.axes(c, { X, Y: (v) => Y(v * 1e6), yTicks: [0, 10, 20, 30, 40, 50, 60, 70], yFmt: (v) => String(v), xTicks: [2024, 2035, 2045, 2055, 2070], xFmt: (v) => String(v), xLabel: '연도' });
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('단위: 백만 명', m.l + 4, m.t + 12);
    const series = (h, color, width, dash) => { ctx.setLineDash(dash || []); L.line(ctx, h.map((d) => [X(d.year), Y(d.total)]), color, width); ctx.setLineDash([]); };
    series(refHigh, css('--lucky'), 2, [5, 3]); series(refLow, '#8a93a6', 2, [5, 3]);
    series(sim.history, css('--accent'), 3);
    const last = sim.history[sim.history.length - 1]; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last.year), Y(last.total), 4.5, 0, 7); ctx.fill();
  }

  // ---------- ③ 고령화 ----------
  function drawAging() {
    const c = L.chart($('c-aging'), 0.7), { ctx, m, pw, ph } = c, p0 = sim.params.startYear, p1 = sim.params.endYear;
    const X = (yr) => m.l + ((yr - p0) / (p1 - p0)) * pw, Y = (v) => m.t + ph - (v / 1.6) * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.4, 0.8, 1.2, 1.6], yFmt: pct, xTicks: [2024, 2035, 2045, 2055, 2070], xFmt: (v) => String(v), xLabel: '연도' });
    const H = sim.history;
    L.line(ctx, H.map((d) => [X(d.year), Y(d.oldDep)]), css('--unlucky'), 2.5);
    L.line(ctx, H.map((d) => [X(d.year), Y(d.shareOld)]), css('--rich'), 2.5);
    L.line(ctx, H.map((d) => [X(d.year), Y(d.shareWork)]), css('--accent'), 2.5);
  }

  // ---------- ④ 출산율 스윕 ----------
  function drawSweep() {
    const pop0 = PO.START_TOTAL;
    L.dots($('c-sweep'), {
      data: sweepRows.map((d) => ({ x: d.x, runs: [], mean: d.total / pop0 })),
      series: [{ data: sweepRows.map((d) => ({ x: d.x, runs: [], mean: d.shareOld })), color: css('--rich') }],
      x0: 0.5, x1: 2.1, y0: 0, y1: 1, xTicks: [0.5, 0.9, 1.3, 1.7, 2.1], xFmt: (v) => v.toFixed(1), xLabel: '합계출산율',
      marker: { x: sim.params.tfr },
    });
  }

  function renderStats() {
    const s = sim.summary(), s0 = sim.history[0];
    const cards = [
      ['총인구 (백만 명)', M(s.total), `${sim.params.startYear}년 ${M(s0.total)}`],
      ['65세 이상 비중', pct(s.shareOld), `${sim.params.startYear}년 ${pct(s0.shareOld)}`],
      ['생산연령(15~64세) 비중', pct(s.shareWork), `${sim.params.startYear}년 ${pct(s0.shareWork)}`],
      ['노년부양비', pct(s.oldDep), '65세 이상 ÷ 15~64세'],
      ['중위연령', s.median.toFixed(1), `${sim.params.startYear}년 ${s0.median.toFixed(1)}`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawPyramid(); drawTotal(); drawAging(); }

  function after() {
    const P = params(); sweepRows = []; drawSweep(); $('note-sweep').textContent = '계산 중…';
    const jobs = [];
    for (let t = 0.5; t <= 2.1001; t += 0.2) jobs.push(() => { const h = PO.project(Object.assign({}, P, { tfr: t })), e = h[h.length - 1]; sweepRows.push({ x: t, total: e.total, shareOld: e.shareOld }); });
    L.jobs(jobs, drawSweep, () => {
      const a = sweepRows[0], b = sweepRows[sweepRows.length - 1];
      $('note-sweep').textContent = `합계출산율 0.5이면 ${M(a.total)}백만 명, 2.1이면 ${M(b.total)}백만 명이 됩니다`;
    });
  }

  const h = L.harness({
    controls: ['tfr', 'migration', 'lifeGain'],
    format: { tfr: (v) => Number(v).toFixed(2), migration: (v) => (Number(v) > 0 ? '+' : '') + v + '천 명/년', lifeGain: (v) => '+' + Number(v).toFixed(1) + '년/10년' },
    defaults: { tfr: 0.72, migration: 0, lifeGain: 1 },
    build() {
      const P = params(); sim = PO.create(P);
      refLow = PO.project(Object.assign({}, P, { tfr: 0.7 })); refHigh = PO.project(Object.assign({}, P, { tfr: 1.5 }));
    },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '시나리오',
  });
  seedGetter = h.seed;
})();
