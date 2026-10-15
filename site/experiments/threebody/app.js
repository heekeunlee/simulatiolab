(function () {
  'use strict';
  const TB = window.ThreeBody, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 두 판이 갈라진 뒤(시간 30)에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const COL = ['#e8890c', '#1c8fd6', '#d63f86'], C3 = '#e8590c', C2 = '#64748b';
  // 집계(미리 계산): node tools/validate-threebody.js 출력과 같아야 한다
  const SWEEP = {"eps":[{"eps":0.001,"three":42.5,"lo":13.2,"hi":80,"never":3,"two":1343.1},{"eps":0.003,"three":37.8,"lo":12.9,"hi":80,"never":1,"two":447.1},{"eps":0.01,"three":29.9,"lo":8.7,"hi":67.6,"never":0,"two":138.9},{"eps":0.03,"three":20.3,"lo":6.6,"hi":54.9,"never":0,"two":49.7},{"eps":0.1,"three":9.2,"lo":4.5,"hi":55.8,"never":0,"two":15.2}],"q":[{"q":0.3,"ej":6,"n":24,"light":6,"t":20.4,"div":32.6},{"q":1,"ej":3,"n":24,"light":null,"t":41.4,"div":29.9},{"q":3,"ej":5,"n":24,"light":5,"t":52.6,"div":18}],"dist":[{"dist":0.6,"div":14.3,"ej":6},{"dist":1,"div":29.9,"ej":3},{"dist":1.6,"div":58.6,"ej":1}]};
  const EPS = [0.001, 0.002, 0.003, 0.005, 0.01, 0.02, 0.03, 0.05, 0.1];   // 처음 차이 슬라이더 칸
  const fmtEps = (v) => String(v);
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const fDiff = (v) => (v >= 10 ? String(Math.round(v)) : v >= 1 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(2) : v.toFixed(3));
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0;
  const params = () => ({ seed: seedGetter(), eps: EPS[Number($('eps').value)], q: Number($('q').value), dist: Number($('dist').value) });
  const speed = () => ($('speed') ? Number($('speed').value) : 60);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.TbState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB }; }

  // ---------- ② 두 판의 거리 차 (로그 눈금, 재생 시점까지) ----------
  function drawDiff() {
    const cv = $('c-diff'), items = [{ kind: 'line', color: C3, label: '별 셋: 판 A와 B의 차이' }, { kind: 'line', color: C2, label: '별 둘이었다면' }, { kind: 'dash', color: '#7c3aed', label: '갈라짐 기준 (1)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 46, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.steps * TB.C.DT, lo = Math.log10(0.0005), hi = 2;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(0.0005, Math.min(100, v))) - lo) / (hi - lo)) * ph;
    L.axes(c, { X, Y, yTicks: [0.001, 0.01, 0.1, 1, 10, 100], yFmt: (v) => (v === 100 ? '100+' : String(v)), xTicks: [0, 20, 40, 60, 80], xLabel: '시간 (모델 단위)', yLabel: '같은 별끼리 거리 차 (로그 눈금)' });
    ctx.strokeStyle = '#7c3aed'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.l, Y(1)); ctx.lineTo(m.l + pw, Y(1)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    const dt = TB.C.SAMPLE * TB.C.DT, H = sim.hist;
    const pts = (arr) => { const o = arr.map((v, k) => [X(k * dt), Y(v)]); o.push([X(sim.time()), Y(arr === H.diff ? sim.diff : sim.diff2)]); return o; };
    L.line(ctx, pts(H.diff2), C2, 2.2);
    L.line(ctx, pts(H.diff), C3, 2.6);
    [[sim.diff, C3], [sim.diff2, C2]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(sim.time()), Y(v), 4, 0, 7); ctx.fill(); });
    if (sim.tDiv != null) L.vline(c, X(sim.tDiv), '#7c3aed', `갈라짐: 시간 ${f1(sim.tDiv)}`, sim.tDiv > T * 0.6 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  // ---------- ③ 별마다 가운데에서 떨어진 거리 (재생 시점까지) ----------
  function drawR() {
    const cv = $('c-r'), items = [{ kind: 'line', color: COL[0], label: '별 1' }, { kind: 'line', color: COL[1], label: '별 2' }, { kind: 'line', color: COL[2], label: '별 3' }, { kind: 'line', color: '#334155', label: '실선 = 판 A' }, { kind: 'dash', color: '#334155', label: '점선 = 판 B' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.steps * TB.C.DT, YM = 8 * sim.R;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (Math.min(YM, v) / YM) * ph;
    const yt = [0, 2, 4, 6, 8].map((v) => v * sim.R);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => (v >= YM - 1e-9 ? f1(v) + '+' : String(Math.round(v * 10) / 10)), xTicks: [0, 20, 40, 60, 80], xLabel: '시간 (모델 단위)', yLabel: '가운데에서 떨어진 거리' });
    const dt = TB.C.SAMPLE * TB.C.DT, H = sim.hist;
    for (let i = 0; i < 3; i++) {
      ctx.setLineDash([4, 3]); L.line(ctx, H.rB[i].map((v, k) => [X(k * dt), Y(v)]), COL[i], 1.5); ctx.setLineDash([]);
      L.line(ctx, H.r[i].map((v, k) => [X(k * dt), Y(v)]), COL[i], 2.2);
    }
    if (sim.esc) L.vline(c, X(sim.esc.t), COL[sim.esc.body], `판 A: 별 ${sim.esc.body + 1} 튕겨 나감`, sim.esc.t > T * 0.55 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  // ---------- ④ 처음 차이 크기별 갈라지는 시간 (집계) ----------
  function drawEps() {
    const cv = $('c-eps'), items = [{ kind: 'line', color: C3, label: '별 셋 (24판 중앙값)' }, { kind: 'line', color: C2, label: '별 둘' }, { kind: 'dash', color: '#94a3b8', label: '한 판의 길이 (80)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 46, r: 16, t: 30 }), { ctx, m, pw, ph } = c;
    const xl = Math.log10(0.001), xh = Math.log10(0.1), yl = Math.log10(3), yh = Math.log10(3000);
    const X = (v) => m.l + ((Math.log10(v) - xl) / (xh - xl)) * pw, Y = (v) => m.t + ph - ((Math.log10(v) - yl) / (yh - yl)) * ph;
    L.axes(c, { X, Y, yTicks: [3, 10, 30, 100, 300, 1000, 3000], xTicks: [0.001, 0.003, 0.01, 0.03, 0.1], xLabel: '처음 위치 차이 (로그 눈금)', yLabel: '갈라지기까지 시간 (로그 눈금)' });
    ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(80)); ctx.lineTo(m.l + pw, Y(80)); ctx.stroke(); ctx.setLineDash([]);
    const E = SWEEP.eps;
    ctx.fillStyle = L.mix(C3, 0.14); E.forEach((r) => { ctx.fillRect(X(r.eps) - 5, Y(r.hi), 10, Y(r.lo) - Y(r.hi)); });   // 24판의 범위
    L.line(ctx, E.map((r) => [X(r.eps), Y(r.two)]), C2, 2.2);
    L.line(ctx, E.map((r) => [X(r.eps), Y(r.three)]), C3, 2.6);
    ctx.font = '700 11.5px ' + FONT; ctx.textAlign = 'center';
    E.forEach((r) => {
      [[r.three, C3, 15], [r.two, C2, -8]].forEach(([v, col, dy]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(r.eps), Y(v), 4, 0, 7); ctx.fill(); const lx = X(r.eps) + (r.eps === 0.001 ? 12 : r.eps === 0.1 ? -12 : 0); L.label(ctx, String(Math.round(v)), lx, Y(v) + dy, 'center'); });
    });
    const cur = params().eps; if (cur >= 0.001 && cur <= 0.1) L.vline(c, X(cur), css('--rich') || '#1e3a8a', '지금 설정', cur > 0.02 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  // ---------- ⑤ 셋째 별 무게별: 튕겨 나간 판 (집계) ----------
  function drawQ() {
    const cv = $('c-q'), items = [{ kind: 'box', color: C3, label: '한 판(시간 80) 안에 별 하나가 튕겨 나간 판 (%)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 40, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const Q = SWEEP.q, gw = pw / Q.length, YM = 40, Y = (v) => m.t + ph - (v / YM) * ph, cq = params().q;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: [0, 10, 20, 30, 40], xTicks: [], yLabel: '판 비율 (%)' });
    Q.forEach((r, i) => {
      const x0 = m.l + i * gw, v = (r.ej / r.n) * 100, bw = Math.min(54, gw * 0.45);
      if (Math.abs(cq - r.q) < 1e-9) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      ctx.fillStyle = C3; ctx.fillRect(x0 + (gw - bw) / 2, Y(v), bw, Y(0) - Y(v));
      ctx.font = '700 12px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(`${r.ej}판 / ${r.n}판`, x0 + gw / 2, Y(v) - 6);
      ctx.font = '600 12px ' + FONT; ctx.fillText(`셋째 별 ${r.q}배`, x0 + gw / 2, m.t + ph + 16);
      ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted');
      ctx.fillText(r.light == null ? '셋 다 같은 무게' : `가장 가벼운 별: ${r.light}판`, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);
  }
  function notes() {
    const E = SWEEP.eps, D = SWEEP.dist, Q = SWEEP.q;
    $('note-e').textContent = `처음 차이 0.001 → 0.1: 별 셋 ${E[0].three} → ${E[4].three} · 별 둘 ${E[0].two} → ${E[4].two} · 시작 거리 0.6·1·1.6일 때 별 셋 ${D[0].div} · ${D[1].div} · ${D[2].div}`;
    $('note-q').textContent = `튕겨 나간 시간 중앙값: 0.3배 ${Q[0].t} · 1배 ${Q[1].t} · 3배 ${Q[2].t}`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const P = sim.params, s = sim;
    const div = s.tDiv != null ? `시간 ${f1(s.tDiv)}` : '', divSub = s.tDiv != null ? '같은 별끼리 1 넘게 벌어진 때' : `아직 같은 춤 (처음 차이의 ${f1(s.diff / P.eps)}배)`;
    const esc = s.esc ? `별 ${s.esc.body + 1}` : '';
    const escSub = s.esc ? (s.escB ? (s.escB.body === s.esc.body ? `시간 ${f1(s.esc.t)} · 판 B도 별 ${s.escB.body + 1}(시간 ${f1(s.escB.t)})` : `시간 ${f1(s.esc.t)} · 판 B는 별 ${s.escB.body + 1}(시간 ${f1(s.escB.t)})`) : `시간 ${f1(s.esc.t)} · 판 B는 아직 셋이 얽혀 있어요`)
      : s.escB ? `판 B에서 별 ${s.escB.body + 1}이 먼저 튕겨 나갔어요` : (s.done ? '이 판에서는 끝까지 셋이 얽혀 있었어요' : '아직 셋이 얽혀 있어요');
    const cards = [
      ['두 판이 갈라진 때', div, divSub],
      ['지금 두 판의 차이', fDiff(s.diff), `별 둘이었다면 ${fDiff(s.diff2)}`],
      ['판 A에서 튕겨 나간 별', esc, escSub],
      ['에너지 오차 (계산 점검)', (s.eErr * 100 < 0.001 ? '0.001% 미만' : (s.eErr * 100).toFixed(3) + '%'), '처음 에너지에서 벗어난 정도, 작을수록 정확'],
    ];
    $('stats').innerHTML = cards.map(([k, v, sb]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sb}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `시간 ${f1(s.time())} / ${f1(P.steps * TB.C.DT)}`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawDiff(); drawR(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { drawEps(); drawQ(); notes(); }

  const h = L.harness({
    controls: ['eps', 'q', 'dist'],
    format: { eps: (v) => fmtEps(EPS[Number(v)]), q: (v) => Number(v).toFixed(1) + '배', dist: (v) => Number(v).toFixed(1) },
    defaults: { eps: 4, q: 1, dist: 1 },
    speedScale: 1,
    build() {
      sim = TB.create(params());
      if (THUMB) { for (let t = 0; t < 1500; t++) sim.step(); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done) return false; sim.step(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '밤하늘',
  });
  seedGetter = h.seed;
  window.TbApp = { params, sim: () => sim };
})();
