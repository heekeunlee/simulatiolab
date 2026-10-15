(function () {
  'use strict';
  const AS = window.Asteroid, L = window.Lab, C = AS.C;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 지구 곁을 막 지나간 장면(지구 가까이 확대)에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_SEP = '#e8590c', C_SAFE = '#15803d', C_HIT = '#c92a2a';
  const C_DV = { 1: '#94a3b8', 10: '#2f6fed', 100: '#7c3aed' };
  const C_DIR = { along: '#e8590c', radial: '#2f6fed', normal: '#64748b' };
  const DIRNAME = { along: '진행 방향으로', radial: '옆으로(태양 쪽)', normal: '위로(궤도면 밖)' };
  let sim = null, sw = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0, swKey = '';
  const params = () => ({ seed: seedGetter(), lead: AS.LEADS[Number($('lead').value)], dv: AS.DVS[Number($('dv').value)], dir: $('dir').value });
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const speed = () => ($('speed') ? Number($('speed').value) : 200);
  // 숫자 모양: 아주 작은 값도 0으로 뭉개지지 않게
  const fmt = (v) => (v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3));
  const reText = (v) => (v < 0.0005 ? '지구 반지름의 0.001배 미만' : `지구 반지름의 ${fmt(v)}배`);
  const fmtDv = (v) => (v >= 100 ? String(Math.round(v)) : v >= 10 ? String(Math.round(v)) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
  const verdict = (m) => (m >= C.SAFE ? 'safe' : m >= 1 ? 'close' : 'hit');

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.AstState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB }; }

  // ---------- ② 두 길 사이가 벌어지는 모습 (재생 시점까지) ----------
  function drawSep() {
    const cv = $('c-sep'), items = [{ kind: 'line', color: C_SEP, label: '밀기 전 길과 민 길 사이 거리' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 46, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T0 = sim.tPush, T1 = C.T, span = T1 - T0, X = (t) => m.l + ((t - T0) / span) * pw;
    const top = niceTop(sim.maxSep * 1.08), Y = (v) => m.t + ph - (v / top) * ph;
    const xt = ticks(span);
    L.axes(c, { X: (v) => X(T0 + v), Y, yTicks: [0, top / 4, top / 2, (3 * top) / 4, top], yFmt: (v) => fmtTick(v), xTicks: xt, xFmt: (v) => fmtTick(v), xLabel: '밀고 나서 지난 시간 (년)', yLabel: '거리 (지구 반지름)' });
    const H = sim.hist.filter((h) => h[0] >= T0 && h[0] <= T1), stride = Math.max(1, Math.floor(H.length / 1500)), pts = [];
    for (let i = 0; i < H.length; i += stride) pts.push([X(H[i][0]), Y(H[i][1])]);
    if (H.length) pts.push([X(H[H.length - 1][0]), Y(H[H.length - 1][1])]);
    L.line(ctx, pts, C_SEP, 2.2);
    if (H.length) { const h = H[H.length - 1]; ctx.fillStyle = C_SEP; ctx.beginPath(); ctx.arc(X(h[0]), Y(h[1]), 4.5, 0, 7); ctx.fill(); }
    L.drawLegendBelow(c, items);
  }
  function niceTop(v) { const e = Math.pow(10, Math.floor(Math.log10(v || 1e-3))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10) * e; }
  function ticks(span) { const st = niceTop(span / 4.5); const out = []; for (let v = 0; v <= span + 1e-9; v += st) out.push(+v.toFixed(6)); return out; }
  function fmtTick(v) { return v === 0 ? '0' : v >= 1 ? String(+v.toFixed(1)) : String(+v.toPrecision(2)); }

  // ---------- ③④ 집계 (지금 궤도로 미리 계산, 재생과 상관없음) ----------
  function logAxes(c, X, Y, xv, yv, xLabel, yLabel, yFmt) {
    L.axes(c, { X, Y, yTicks: yv, yFmt, xTicks: xv, xFmt: (v) => String(v), xLabel, yLabel });
  }
  function leadHighlight(c, X) {
    const { ctx, m, ph } = c, x = X(sim.params.lead);
    ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x - 9, m.t, 18, ph);
  }
  function drawMiss() {
    const cv = $('c-miss'), dvs = [1, 10, 100];
    const items = dvs.map((d) => ({ kind: 'line', color: C_DV[d], label: `${d} cm/s로 밀면` })).concat([{ kind: 'dash', color: C_SAFE, label: '비껴감 기준 (지구 반지름 2개)' }, { kind: 'box', color: 'rgba(201,42,42,.18)', label: '부딪힘 (지구 반지름 1개 안)' }]);
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.62 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 46, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const lx0 = Math.log10(0.1), lx1 = Math.log10(20), ly0 = -3, ly1 = 3;
    const X = (v) => m.l + ((Math.log10(v) - lx0) / (lx1 - lx0)) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(1e-3, Math.min(1e3, v))) - ly0) / (ly1 - ly0)) * ph;
    ctx.fillStyle = 'rgba(201,42,42,.10)'; ctx.fillRect(m.l, Y(1), pw, Y(1e-3) - Y(1));
    leadHighlight(c, X);
    logAxes(c, X, Y, [0.1, 0.25, 0.5, 1, 2, 5, 10, 20], [0.001, 0.01, 0.1, 1, 10, 100, 1000], '리드 타임: 만나기 몇 년 전에 밀었나 (년)', '비껴간 거리 (지구 반지름)', (v) => (v >= 1 ? String(v) : String(v)));
    ctx.strokeStyle = C_SAFE; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(C.SAFE)); ctx.lineTo(m.l + pw, Y(C.SAFE)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    dvs.forEach((d) => {
      const ys = sw.miss[d]; L.line(ctx, AS.LEADS.map((Ld, i) => [X(Ld), Y(ys[i])]), C_DV[d], 2.4);
      ctx.fillStyle = C_DV[d]; AS.LEADS.forEach((Ld, i) => { ctx.beginPath(); ctx.arc(X(Ld), Y(ys[i]), 3.2, 0, 7); ctx.fill(); });
    });
    L.drawLegendBelow(c, items);
  }
  function drawNeed() {
    const cv = $('c-need'), dirs = ['along', 'radial', 'normal'], cur = sim.params.dir;
    const items = dirs.map((d) => ({ kind: 'line', color: C_DIR[d], label: DIRNAME[d] }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.62 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 50, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const lx0 = Math.log10(0.1), lx1 = Math.log10(20), ly0 = -1, ly1 = 4;
    const X = (v) => m.l + ((Math.log10(v) - lx0) / (lx1 - lx0)) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(0.1, Math.min(1e4, v))) - ly0) / (ly1 - ly0)) * ph;
    leadHighlight(c, X);
    logAxes(c, X, Y, [0.1, 0.25, 0.5, 1, 2, 5, 10, 20], [0.1, 1, 10, 100, 1000, 10000], '리드 타임: 만나기 몇 년 전에 밀었나 (년)', '필요한 밀기 세기 (cm/s)', (v) => (v >= 1000 ? (v / 1000) + 'k' : String(v)));
    dirs.forEach((d) => {
      const ys = sw.need[d], w = d === cur ? 3.2 : 1.8; L.line(ctx, AS.LEADS.map((Ld, i) => [X(Ld), Y(ys[i])]), C_DIR[d], w);
      ctx.fillStyle = C_DIR[d]; AS.LEADS.forEach((Ld, i) => { ctx.beginPath(); ctx.arc(X(Ld), Y(ys[i]), d === cur ? 3.8 : 2.6, 0, 7); ctx.fill(); });
    });
    L.drawLegendBelow(c, items);
  }
  function notes() {
    const iL = (y) => AS.LEADS.indexOf(y), n = sw.need.along, r = sw.need.radial;
    $('note-m').textContent = `1 cm/s로 10년 전에 밀면 지구 반지름의 ${fmt(sw.miss[1][iL(10)])}배 · 10 cm/s로 1년 전에 밀면 ${fmt(sw.miss[10][iL(1)])}배 · 100 cm/s로 0.1년 전에 밀면 ${fmt(sw.miss[100][iL(0.1)])}배`;
    $('note-n').textContent = `진행 방향으로 밀 때 필요한 세기: 10년 전 ${fmtDv(n[iL(10)])} cm/s · 1년 전 ${fmtDv(n[iL(1)])} cm/s · 0.1년 전 ${fmtDv(n[iL(0.1)])} cm/s (옆으로 밀면 10년 전 ${fmtDv(r[iL(10)])} cm/s)`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const p = sim.params, t = sim.t, ph = sim.phase(), passed = sim.passed();
    const since = t >= sim.tPush ? `${fmtTick(+(t - sim.tPush).toFixed(2))}년` : '';
    const sinceSub = t >= sim.tPush ? `만나기 ${p.lead}년 전에 ${p.dv} cm/s로 밀었어요` : '곧 밀어요';
    const sepNow = t >= sim.tPush ? sim.sep(Math.min(t, C.T)) : 0;
    const v = verdict(sim.miss);
    const missV = passed ? reText(sim.miss) : '';
    const missS = passed ? (v === 'safe' ? '비껴감: 지구 반지름 2개보다 멀리 지나갔어요' : v === 'close' ? '아슬아슬: 지구 반지름 2개 안으로 지나갔어요' : '부딪힘: 지구 반지름 1개보다 가까이 왔어요') : '지구 곁을 지날 때 재요';
    const need = sw ? sw.need[p.dir][AS.LEADS.indexOf(p.lead)] : null;
    const cards = [
      ['밀고 나서 지난 시간', since, sinceSub, false],
      ['지금 두 길 사이 거리', t >= sim.tPush ? reText(sepNow) : '', '밀기 전 길로 갔을 소행성과 민 소행성 사이', false],
      ['지구를 비껴간 거리', missV, missS, !passed],
      ['이 궤도에서 비껴가려면', passed && need ? `${fmtDv(need)} cm/s` : '', passed ? `${DIRNAME[p.dir]}, 만나기 ${p.lead}년 전에 밀 때 필요한 세기` : '지구 곁을 지난 뒤 보여 줘요', !passed],
    ];
    $('stats').innerHTML = cards.map(([k, val, s, dim]) => `<div class="stat"${dim ? ' style="opacity:.55"' : ''}><div class="k">${k}</div><div class="v">${val}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when');
    if (wh) {
      const left = C.T - t;
      wh.textContent = ph === 'before' ? '밀기 직전' : left > 0.05 ? `만나기까지 ${left.toFixed(1)}년` : left > 1 / 365 ? `만나기까지 ${Math.round(left * 365)}일` : left > 0 ? '지구 곁 · 느린 화면' : '지나감';
    }
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawSep(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { if (!sw) return; drawMiss(); drawNeed(); notes(); }
  function ensureSweep() { const k = String(sim.params.seed); if (k !== swKey || !sw) { sw = AS.sweep(sim.params.seed, [1, 10, 100]); swKey = k; } }

  const h = L.harness({
    controls: ['lead', 'dv', 'dir'],
    format: { lead: (v) => `${AS.LEADS[v]}년`, dv: (v) => `${AS.DVS[v]} cm/s`, dir: () => '' },
    defaults: { lead: 7, dv: 3, dir: 'along' },
    speedScale: 1,
    build() {
      sim = AS.create(params());
      ensureSweep();
      if (THUMB) { while (!sim.done && sim.t < sim.tMiss + sim.passTime * 0.35) sim.step(); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done) return false; sim.step(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '소행성',
  });
  seedGetter = h.seed;
  window.AstApp = { params, sim: () => sim, sweep: () => sw };
})();
