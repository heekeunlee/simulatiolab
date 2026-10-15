(function () {
  'use strict';
  const MA = window.MoonAxis, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 축이 크게 흔들리며 꼬리를 남긴 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_ME = '#2f6fed', C_TW = '#94a3b8', C_BEAT = '#e8590c';
  // 집계(미리 계산): node tools/validate-moonaxis.js 출력의 SWEEP과 같아야 한다 (시작 8가지 평균)
  const SWEEP = {"moon":{"0.0":{"mean":13.1,"lo":11.9,"hi":14.2,"min":15.6,"max":33.6},"0.1":{"mean":27.5,"lo":18.7,"hi":36.3,"min":2,"max":42.2},"0.2":{"mean":23.6,"lo":16.2,"hi":35.5,"min":5.1,"max":52},"0.3":{"mean":25.6,"lo":17,"hi":40,"min":0.9,"max":60.2},"0.4":{"mean":28.1,"lo":14.9,"hi":45.2,"min":3.1,"max":48.3},"0.5":{"mean":20.9,"lo":11.9,"hi":31.4,"min":13.2,"max":52.2},"0.6":{"mean":9,"lo":8.1,"hi":9.9,"min":16.3,"max":32},"0.7":{"mean":6.4,"lo":5.9,"hi":7,"min":18,"max":28.9},"0.8":{"mean":5.3,"lo":5,"hi":5.4,"min":18.7,"max":27.6},"0.9":{"mean":4.4,"lo":4.2,"hi":4.6,"min":19.4,"max":26.7},"1.0":{"mean":3.7,"lo":3.6,"hi":3.9,"min":19.8,"max":26.3}},"pert":{"m0":{"0":0,"1":13.1,"2":27,"0.5":6.9,"1.5":19.7},"m1":{"0":0,"1":3.7,"2":7.4,"0.5":1.8,"1.5":5.6}}};
  let sim = null, twin = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0;
  const params = () => ({ seed: seedGetter(), moon: Number($('moon').value) / 100, pert: Number($('pert').value) / 100, eps0: Number($('eps0').value) });
  const speed = () => ($('speed') ? Number($('speed').value) : 20);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const yr = (kyr) => `${Math.round(kyr * 1000).toLocaleString('en-US')}년`;
  const yrRound = (kyr) => `${(Math.round(kyr) * 1000).toLocaleString('en-US')}년`;   // 천 년 단위로 반올림
  const twinName = () => (twin && twin.params.moon === 0 ? '비교: 달 없는 지구' : '비교: 지금의 달이 있는 지구');
  const period = (s) => 2 * Math.PI / Math.max(1e-6, s.precRate());   // 축이 한 바퀴 도는 데 걸리는 시간 (천 년)

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.MoonState = { sim, twin, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB }; }

  // ---------- ② 기울기의 시간 변화 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-eps');
    const items = [{ kind: 'line', color: C_ME, label: '지금 설정의 지구' }, { kind: 'line', color: C_TW, label: twinName() }, { kind: 'dash', color: '#64748b', label: '처음 기울기' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.years, YM = 90, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (Math.min(YM, v) / YM) * ph;
    L.axes(c, { X, Y, yTicks: [0, 15, 30, 45, 60, 75, 90], yFmt: (v) => v + '°', xTicks: [0, 200, 400, 600, 800, 1000], xLabel: '시간 (천 년)', yLabel: '자전축 기울기 (도)' });
    ctx.strokeStyle = '#64748b'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(m.l, Y(sim.params.eps0)); ctx.lineTo(m.l + pw, Y(sim.params.eps0)); ctx.stroke(); ctx.setLineDash([]);
    // 지금까지의 최소~최대 띠 (지금 설정)
    ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(m.l, Y(sim.max), X(sim.t) - m.l, Y(sim.min) - Y(sim.max));
    L.line(ctx, twin.hist.map((v, k) => [X(k), Y(v)]), C_TW, 2);
    L.line(ctx, sim.hist.map((v, k) => [X(k), Y(v)]), C_ME, 2.4);
    const n = sim.hist.length - 1; ctx.fillStyle = C_ME; ctx.beginPath(); ctx.arc(X(n), Y(sim.hist[n]), 4.5, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 축의 박자 지도 (재생 시점까지) ----------
  // 가로: 축이 한 바퀴 도는 데 걸리는 시간(로그 눈금), 세로: 기울기. 주황 세로 띠 = 다른 행성이 궤도면을 흔드는 박자 3가지
  function drawBeat() {
    const cv = $('c-beat');
    const items = [{ kind: 'box', color: 'rgba(232,89,12,.45)', label: '다른 행성이 궤도를 흔드는 박자' }, { kind: 'dot', color: C_ME, label: '지금 설정의 지구' }, { kind: 'dot', color: C_TW, label: twinName() }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const P0 = 15, P1 = 400, X = (p) => m.l + (Math.log(Math.min(P1, Math.max(P0, p)) / P0) / Math.log(P1 / P0)) * pw, Y = (v) => m.t + ph - (Math.min(90, v) / 90) * ph;
    // 흔들림 박자: 공명 근처를 옅은 띠로
    MA.C.G.forEach((g, i) => {
      const p = 2 * Math.PI / -g, x0 = X(p * 0.88), x1 = X(p / 0.88);
      ctx.fillStyle = 'rgba(232,89,12,.13)'; ctx.fillRect(x0, m.t, x1 - x0, ph);
      ctx.strokeStyle = C_BEAT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(p), m.t); ctx.lineTo(X(p), m.t + ph); ctx.stroke(); ctx.lineWidth = 1;
    });
    L.axes(c, { X, Y, yTicks: [0, 15, 30, 45, 60, 75, 90], yFmt: (v) => v + '°', xTicks: [20, 50, 100, 200, 400], xLabel: '축이 한 바퀴 도는 데 걸리는 시간 (천 년)', yLabel: '자전축 기울기 (도)' });
    // 이 달 무게에서 축이 있을 수 있는 자리(옅은 선: 기울기에 따라 한 바퀴 시간이 정해진다, 이론 곡선)
    [[twin, C_TW], [sim, C_ME]].forEach(([s, col]) => {
      const pts = []; for (let e = 0; e <= 88; e += 2) pts.push([X(2 * Math.PI / (s.alpha * Math.cos(e * MA.DEG))), Y(e)]);
      ctx.globalAlpha = 0.35; L.line(ctx, pts, col, 1.2); ctx.globalAlpha = 1;
    });
    // 지나온 자리 (오래된 것은 옅게)
    [[twin, C_TW], [sim, C_ME]].forEach(([s, col]) => {
      const H = s.hist, n = H.length, step = Math.max(1, Math.floor(n / 400));
      ctx.fillStyle = L.mix(col, 0.18);
      for (let k = 0; k < n; k += step) { const p = 2 * Math.PI / (s.alpha * Math.cos(H[k] * MA.DEG)); ctx.beginPath(); ctx.arc(X(p), Y(H[k]), 2.2, 0, 7); ctx.fill(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(period(s)), Y(s.eps), 6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    });
    L.drawLegendBelow(c, items);
  }

  // ---------- ④ 달 무게별 흔들림 폭 (집계) ----------
  function drawMoon() {
    const cv = $('c-moon'), P = params();
    const items = [{ kind: 'box', color: C_ME, label: '흔들림 폭 평균 (시작 8가지)' }, { kind: 'line', color: '#334155', label: '가장 작은 판 ~ 가장 큰 판' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const keys = Object.keys(SWEEP.moon), gw = pw / keys.length, YM = 50, Y = (v) => m.t + ph - (Math.min(YM, v) / YM) * ph;
    L.axes(c, { X: (i) => m.l + (i + 0.5) * gw, Y, yTicks: [0, 10, 20, 30, 40, 50], yFmt: (v) => v + '°', xTicks: [0, 2, 4, 6, 8, 10], xFmt: (i) => (i * 10) + '%', xLabel: '달의 무게 (지금의 달 = 100%)', yLabel: '흔들림 폭 (도)' });
    const cur = Math.round(P.moon * 10);
    keys.forEach((k, i) => {
      const s = SWEEP.moon[k], x0 = m.l + i * gw, bw = Math.min(28, gw - 6), x = x0 + (gw - bw) / 2;
      if (i === cur) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x0 + 1, m.t, gw - 2, ph); }
      ctx.fillStyle = i === cur ? C_ME : L.mix(C_ME, 0.55); ctx.fillRect(x, Y(s.mean), bw, Y(0) - Y(s.mean));
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0 + gw / 2, Y(s.lo)); ctx.lineTo(x0 + gw / 2, Y(s.hi)); ctx.stroke(); ctx.lineWidth = 1;
      ctx.font = '700 11px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      if (gw > 22 || i % 2 === 0) ctx.fillText(String(s.mean), x0 + gw / 2, Y(s.hi) - 5);
    });
    L.drawLegendBelow(c, items);
  }
  // ---------- ⑤ 섭동 세기별 (집계) ----------
  function drawPert() {
    const cv = $('c-pert'), P = params();
    const items = [{ kind: 'line', color: '#d97706', label: '달 없는 지구' }, { kind: 'line', color: C_ME, label: '지금의 달이 있는 지구' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const xs = [0, 0.5, 1, 1.5, 2], X = (v) => m.l + (v / 2) * pw, YM = 30, Y = (v) => m.t + ph - (v / YM) * ph;
    L.axes(c, { X, Y, yTicks: [0, 10, 20, 30], yFmt: (v) => v + '°', xTicks: xs, xFmt: (v) => Math.round(v * 100) + '%', xLabel: '다른 행성이 흔드는 세기 (보통 = 100%)', yLabel: '흔들림 폭 평균 (도)' });
    if (P.pert >= 0 && P.pert <= 2) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(X(P.pert) - 6, m.t, 12, ph); }
    [['m0', '#d97706'], ['m1', C_ME]].forEach(([id, col]) => {
      const pts = xs.map((v) => [X(v), Y(SWEEP.pert[id][v])]); L.line(ctx, pts, col, 2.5);
      ctx.fillStyle = col; pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(String(SWEEP.pert[id][xs[i]]), x, id === 'm1' ? y + 17 : y - 8); });
    });
    L.drawLegendBelow(c, items);
  }
  function notes() {
    const S = SWEEP.moon;
    $('note-m').textContent = `흔들림 폭 평균: 달 없음 ${S['0.0'].mean}° · 30% ${S['0.3'].mean}° · 60% ${S['0.6'].mean}° · 지금의 달 ${S['1.0'].mean}°`;
    $('note-p').textContent = `보통 세기에서 달 없음 ${SWEEP.pert.m0[1]}° · 지금의 달 ${SWEEP.pert.m1[1]}° (약 ${Math.round(SWEEP.pert.m0[1] / SWEEP.pert.m1[1] * 10) / 10}배)`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const early = sim.t < 30;
    const ratio = !early && twin.range() > 0.05 ? (sim.range() / twin.range()) : null;
    const cards = [
      ['지금 자전축 기울기', `${sim.eps.toFixed(1)}°`, `처음 ${sim.params.eps0}°`],
      ['지금까지 흔들림 폭', `${sim.range().toFixed(1)}°`, `가장 작게 ${sim.min.toFixed(1)}° ~ 가장 크게 ${sim.max.toFixed(1)}°`],
      [twinName(), `${twin.range().toFixed(1)}°`, ratio == null ? '' : `지금 설정이 ${ratio.toFixed(1)}배`],
      ['축이 한 바퀴 도는 데', `약 ${yrRound(period(sim))}`, '팽이처럼 천천히 도는 세차'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${yr(sim.t)} / ${yr(sim.params.years)}`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawTime(); drawBeat(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { drawMoon(); drawPert(); notes(); }

  const h = L.harness({
    controls: ['moon', 'pert', 'eps0'],
    format: { moon: (v) => (Number(v) === 0 ? '없음' : Number(v) === 100 ? '지금의 달' : v + '%'), pert: (v) => v + '%', eps0: (v) => v + '°' },
    defaults: { moon: 0, pert: 100, eps0: 23 },
    speedScale: 1,
    build() {
      const P = params();
      sim = MA.create(P); twin = MA.create(Object.assign({}, P, { moon: P.moon >= 0.95 ? 0 : 1 }));
      if (THUMB) { for (let t = 0; t < 520; t++) { sim.step(); twin.step(); } }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() {
      if (sim.done) return false;
      sim.step(); twin.step(); lastStepAt = performance.now(); return true;
    },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '시작',
  });
  seedGetter = h.seed;
  window.MoonApp = { params, sim: () => sim, twin: () => twin };
})();
