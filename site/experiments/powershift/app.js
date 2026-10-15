(function () {
  'use strict';
  const PS = window.Powershift, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 100년이 다 흘러 위험 봉우리가 다 자란 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_D = '#2f6fed', C_C = '#e8590c', C_WAR = '#d6336c', C_GRAY = '#94a3b8', C_INK = '#111827';
  let sim = null, seedGetter = () => 1, lastStepAt = 0, sweepD = null, reformBars = null, growthBars = null;
  const params = () => ({ seed: seedGetter(), g: Number($('g').value), d: Number($('d').value), u: Number($('u').value), reform: $('reform').value });
  const speed = () => ($('speed') ? Number($('speed').value) : 6);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const p1 = (v) => (v * 100 < 10 ? (Math.round(v * 1000) / 10).toFixed(1) : String(Math.round(v * 100)));
  const r2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
  const narrowOf = (cv) => (cv.clientWidth || 400) < 520;

  // 3D(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다
  function share() { window.PowershiftState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB, hmax: 0.06 }; }

  // ---------- ② 첫 번째 세계: 두 나라의 힘 (재생 시점까지) ----------
  function drawPower() {
    const cv = $('c-power'), w0 = sim.worlds[0], T = sim.T;
    const items = [{ kind: 'line', color: C_D, label: '지키는 나라' }, { kind: 'line', color: C_C, label: '추격하는 나라' }, { kind: 'box', color: mix(C_WAR, 0.35), label: '그 해의 충돌 위험' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 46, r: 46, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, HM = 0.04, YH = (h) => m.t + ph - (Math.min(h, HM) / HM) * ph * 0.45;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => Math.round(v * 100) + '%', xTicks: [0, 20, 40, 60, 80, 100], xLabel: '해 (년)', yLabel: '두 나라 힘 중 차지하는 몫 (%)' });
    // 오른쪽 눈금: 위험 (아래 45% 높이에 0~4%)
    ctx.fillStyle = C_WAR; ctx.textAlign = 'left'; ctx.font = '11px ' + FONT;
    [0, 0.02, 0.04].forEach((h) => ctx.fillText(Math.round(h * 100) + '%', m.l + pw + 6, YH(h) + 4));
    // 위험 면 (재생 시점까지)
    const H = w0.haz; ctx.fillStyle = mix(C_WAR, 0.28); ctx.beginPath(); ctx.moveTo(X(0), YH(0));
    H.forEach((h, k) => { const v = h == null ? 0 : h; ctx.lineTo(X(k), YH(v)); ctx.lineTo(X(k + 1), YH(v)); });
    ctx.lineTo(X(H.length), YH(0)); ctx.closePath(); ctx.fill();
    // 반반 선
    ctx.strokeStyle = C_GRAY; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(m.l, Y(0.5)); ctx.lineTo(m.l + pw, Y(0.5)); ctx.stroke(); ctx.setLineDash([]);
    const sC = w0.C_.map((c_, k) => c_ / (c_ + w0.D_[k]));
    L.line(ctx, sC.map((v, k) => [X(k), Y(1 - v)]), C_D, 2.4);
    L.line(ctx, sC.map((v, k) => [X(k), Y(v)]), C_C, 2.4);
    const n = sC.length - 1; [[1 - sC[n], C_D], [sC[n], C_C]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(n), Y(v), 4, 0, 7); ctx.fill(); });
    ctx.font = '600 11.5px ' + FONT;
    if (w0.cross >= 0 && w0.cross <= sim.t) { const x = X(w0.cross); ctx.strokeStyle = C_INK; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C_INK; L.label(ctx, `${w0.cross}년째 따라잡음`, x + (x > m.l + pw * 0.7 ? -5 : 5), m.t + 12, x > m.l + pw * 0.7 ? 'right' : 'left'); }
    if (w0.war >= 0) { const x = X(w0.war); ctx.fillStyle = C_WAR; ctx.beginPath(); ctx.arc(x, Y(0.5), 7, 0, 7); ctx.fill(); ctx.font = '700 12px ' + FONT; L.label(ctx, `${w0.war}년째 충돌`, x + (x > m.l + pw * 0.7 ? -10 : 10), Y(0.5) - 12, x > m.l + pw * 0.7 ? 'right' : 'left'); }
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 충돌한 해의 힘 비율 (재생 시점까지, 100개 세계) ----------
  const BINS = [0.3, 0.45, 0.6, 0.75, 0.9, 1.1, 1.35, 1.65, 2, 2.5, 3.5];
  function drawHist() {
    const cv = $('c-hist'), narrow = narrowOf(cv);
    const c = L.chart(cv, narrow ? 0.72 : 0.5, { b: 58, l: 40, r: 12, t: 30 }), { ctx, m, pw, ph } = c;
    const nb = BINS.length - 1, cnt = new Array(nb).fill(0);
    sim.worlds.forEach((w) => { if (w.war < 0) return; let i = BINS.findIndex((b, k) => k < nb && w.warRatio >= b && w.warRatio < BINS[k + 1]); if (w.warRatio < BINS[0]) i = 0; if (i < 0) i = nb - 1; cnt[i]++; });
    const ymax = Math.max(10, Math.ceil((Math.max.apply(null, cnt) * 1.25 + 1) / 5) * 5), Y = (v) => m.t + ph - (v / ymax) * ph, bw = pw / nb;
    const yt = []; for (let v = 0; v <= ymax; v += ymax > 20 ? 10 : 5) yt.push(v);
    L.axes(c, { X: () => -99, Y, yTicks: yt, xTicks: [], yLabel: '충돌한 세계 (곳)' });
    const near = (k) => BINS[k] >= 0.75 && BINS[k + 1] <= 1.35;
    ctx.fillStyle = 'rgba(214,51,108,.06)'; const k0 = BINS.indexOf(0.75), k1 = BINS.indexOf(1.35); ctx.fillRect(m.l + k0 * bw, m.t, (k1 - k0) * bw, ph);
    cnt.forEach((v, k) => { ctx.fillStyle = near(k) ? C_WAR : C_GRAY; const x = m.l + k * bw + 3; ctx.fillRect(x, Y(v), bw - 6, Math.max(0, Y(0) - Y(v))); if (v) { ctx.font = '700 11px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + (bw - 6) / 2, Y(v) - 4); } });
    ctx.font = (narrow ? '10px ' : '11px ') + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    BINS.forEach((b, k) => { if (narrow && k % 2) return; ctx.fillText(String(b), m.l + k * bw, m.t + ph + 15); });
    ctx.font = '600 11.5px ' + FONT; ctx.fillStyle = C_WAR; L.label(ctx, '힘이 비슷한 구간', m.l + ((k0 + k1) / 2) * bw, m.t + 13, 'center');
    L.axisNames(c, '충돌한 해의 힘 비율 (추격국 ÷ 지키는 나라)', null);
  }

  // ---------- ④ 힘 비율별 해마다의 위험 (이론, 지금 설정) ----------
  const RAT = []; for (let e = Math.log(0.3); e <= Math.log(3.34); e += 0.01) RAT.push(Math.exp(e));
  function drawCurve() {
    const cv = $('c-curve'), P = params();
    const items = [{ kind: 'line', color: C_WAR, label: '지금 설정' }, { kind: 'dash', color: C_GRAY, label: '불만이 없을 때' }, { kind: 'dash', color: C_D, label: '힘을 정확히 알 때' }];
    const a = PS.curve(P, RAT), b = PS.curve(Object.assign({}, P, { d: 0 }), RAT), z = PS.curve(Object.assign({}, P, { u: 0 }), RAT);
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.52 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 44, r: 16, t: 30 }), { ctx, m, pw, ph } = c;
    const top = 1.18 * Math.max(0.015, Math.max.apply(null, a.concat(b, z).map((x) => x.h)));
    const ymax = top <= 0.02 ? 0.02 : top <= 0.04 ? 0.04 : top <= 0.06 ? 0.06 : 0.1, step = ymax / 4;
    const lx = (r) => Math.log(r), X = (r) => m.l + ((lx(r) - lx(0.3)) / (lx(3.34) - lx(0.3))) * pw, Y = (v) => m.t + ph - (v / ymax) * ph;
    const yt = []; for (let v = 0; v <= ymax + 1e-9; v += step) yt.push(v);
    ctx.fillStyle = 'rgba(214,51,108,.06)'; ctx.fillRect(X(0.8), m.t, X(1.25) - X(0.8), ph);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => (Math.round(v * 1000) / 10) + '%', xTicks: [0.3, 0.5, 1, 2, 3], xLabel: '힘 비율 (추격국 ÷ 지키는 나라)', yLabel: '해마다의 충돌 위험 (%)' });
    ctx.strokeStyle = C_INK; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(1), m.t); ctx.lineTo(X(1), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    const dash = (pts, col) => { ctx.setLineDash([5, 4]); L.line(ctx, pts, col, 2); ctx.setLineDash([]); };
    dash(z.map((x) => [X(x.r), Y(x.h)]), C_D); dash(b.map((x) => [X(x.r), Y(x.h)]), C_GRAY);
    L.line(ctx, a.map((x) => [X(x.r), Y(Math.min(x.h, ymax))]), C_WAR, 2.8);
    const pk = a.reduce((p, x) => (x.h > p.h ? x : p), a[0]);
    if (pk.h > 0) { ctx.fillStyle = C_WAR; ctx.beginPath(); ctx.arc(X(pk.r), Y(pk.h), 4.5, 0, 7); ctx.fill(); ctx.font = '700 12px ' + FONT; const right = X(pk.r) > m.l + pw * 0.6; L.label(ctx, `봉우리 해마다 ${p1(pk.h)}% (비율 약 ${pk.r.toFixed(1)})`, X(pk.r) + (right ? -8 : 8), Math.max(m.t + 12, Y(pk.h) - 8), right ? 'right' : 'left'); }
    ctx.font = '600 11px ' + FONT; ctx.fillStyle = C_INK; ctx.textAlign = 'left'; L.label(ctx, '비율 1 = 힘이 같음', X(1) + 5, m.t + ph - 8, 'left');
    L.drawLegendBelow(c, items);
    $('note-c').textContent = `지금 설정: 힘 비율 0.4일 때 해마다 ${p1(PS.curve(P, [0.4])[0].h)}%, 1일 때 ${p1(PS.curve(P, [1])[0].h)}%, 3일 때 ${p1(PS.curve(P, [3])[0].h)}%`;
  }

  // ---------- ⑤ 불만이 클수록 (집계: 계산값) ----------
  const DS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], US = [{ u: 10, col: '#74c0fc' }, { u: 25, col: C_WAR }, { u: 50, col: '#7c3aed' }];
  function drawSweep() {
    const cv = $('c-sweep'), P = params();
    const items = US.map((s) => ({ kind: 'line', color: s.col, label: `힘을 잘못 보는 정도 ±${s.u}%` })).concat([{ kind: 'dash', color: C_GRAY, label: '미리 질서 개편 (±25%)' }]);
    const key = JSON.stringify([P.g]);
    if (!sweepD || sweepD.key !== key) sweepD = { key, rows: US.map((s) => DS.map((d) => PS.warChance(Object.assign({}, P, { d, u: s.u, reform: 'off' })).p)), early: DS.map((d) => PS.warChance(Object.assign({}, P, { d, u: 25, reform: 'early' })).p) };
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.52 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 44, r: 16, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (d) => m.l + (d / 100) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => Math.round(v * 100) + '%', xTicks: [0, 20, 40, 60, 80, 100], xFmt: (v) => v + '%', xLabel: '추격국의 불만 (%)', yLabel: '100년 안에 충돌할 확률 (%)' });
    ctx.setLineDash([5, 4]); L.line(ctx, sweepD.early.map((v, i) => [X(DS[i]), Y(v)]), C_GRAY, 2); ctx.setLineDash([]);
    US.forEach((s, j) => { L.line(ctx, sweepD.rows[j].map((v, i) => [X(DS[i]), Y(v)]), s.col, 2.4); ctx.fillStyle = s.col; sweepD.rows[j].forEach((v, i) => { ctx.beginPath(); ctx.arc(X(DS[i]), Y(v), 2.8, 0, 7); ctx.fill(); }); });
    const now = PS.warChance(P); ctx.fillStyle = C_INK; ctx.beginPath(); ctx.arc(X(P.d), Y(now.p), 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    ctx.font = '700 12px ' + FONT; const right = X(P.d) > m.l + pw * 0.6; L.label(ctx, `지금 설정 ${Math.round(now.p * 100)}%`, X(P.d) + (right ? -10 : 10), Y(now.p) + (now.p > 0.8 ? 18 : -10), right ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }

  // ---------- ⑥ 질서 개편 시점과 추격 속도 (집계: 계산값) ----------
  function drawBars() {
    const cv = $('c-bars'), P = params(), narrow = narrowOf(cv);
    const rs = [['off', '개편 없음', ['없음']], ['late', '따라잡은 뒤 개편', ['늦게']], ['early', '미리 개편', ['미리']]].map(([k, n, two]) => ({ n, two, v: PS.warChance(Object.assign({}, P, { reform: k })).p, cur: P.reform === k, col: k === 'off' ? C_WAR : k === 'late' ? '#f59f00' : '#37b24d' }));
    const gs = [0.5, 1, 2, 3, 4].map((g) => ({ n: `+${g}%p`, v: PS.warChance(Object.assign({}, P, { g })).p, cur: P.g === g, col: '#64748b' }));
    const c = L.chart(cv, narrow ? 0.86 : 0.62, { b: 62, l: 40, r: 10, t: 30 }), { ctx, m, pw, ph } = c, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X: () => -99, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => Math.round(v * 100) + '%', xTicks: [], yLabel: '100년 안에 충돌할 확률 (%)' });
    const all = rs.concat([null], gs), gw = pw / all.length;
    all.forEach((b, i) => {
      if (!b) return; const x0 = m.l + i * gw, bw = Math.min(46, gw * 0.62), x = x0 + (gw - bw) / 2;
      if (b.cur) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x0 + 1, m.t, gw - 2, ph); }
      ctx.fillStyle = b.col; ctx.fillRect(x, Y(b.v), bw, Math.max(1, Y(0) - Y(b.v)));
      ctx.font = '700 11.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(Math.round(b.v * 100) + '%', x + bw / 2, Y(b.v) - 4);
    });
    ctx.font = (narrow ? '10px ' : '11px ') + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
    rs.forEach((b, i) => b.two.forEach((ln, j) => ctx.fillText(ln, m.l + (i + 0.5) * gw, m.t + ph + 15 + j * 12)));
    gs.forEach((b, i) => ctx.fillText(b.n, m.l + (i + 4.5) * gw, m.t + ph + 15));
    ctx.font = '600 11.5px ' + FONT; ctx.fillStyle = css('--muted');
    ctx.fillText(narrow ? '질서 개편' : '질서 개편 시점', m.l + 1.5 * gw, h0(c) - 8);
    ctx.fillText(narrow ? '추격 속도' : '추격국이 더 빨리 크는 정도', m.l + 6.5 * gw, h0(c) - 8);
  }
  const h0 = (c) => c.h;

  // ---------- 통계 카드 ----------
  function renderStats() {
    const w0 = sim.worlds[0], ended = sim.done(), P = sim.params, t = sim.t;
    const peace = sim.worlds.filter((w) => w.war < 0).length;
    const ratio = w0.ratio[t], hz = w0.war < 0 && t > 0 ? w0.haz[t - 1] : null;
    const exp = PS.warChance(P);
    const cards = [
      ['100개 세계 중 충돌한 곳', `${sim.wars}곳`, `아직 평화 ${peace}곳 · ${t}년째`, false],
      ['첫 번째 세계의 힘 비율', r2(ratio), ratio >= 1 ? '추격국이 앞섬 (1 = 힘이 같음)' : '지키는 나라가 앞섬 (1 = 힘이 같음)', false],
      ['첫 번째 세계의 올해 위험', hz == null ? '' : `${p1(hz)}%`, w0.war >= 0 ? `${w0.war}년째에 충돌했어요` : '다툼거리가 생길 확률 × 전쟁이 될 확률', false],
      ['100년 안에 충돌할 확률 (계산값)', `${Math.round(exp.p * 100)}%`, `위험이 가장 높은 때: 힘 비율 약 ${exp.peakR.toFixed(1)} (해마다 ${p1(exp.peak)}%)`, !ended],
    ];
    $('stats').innerHTML = cards.map(([k, v, sub, dim]) => `<div class="stat"${dim ? ' style="opacity:.55"' : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${t}년 / ${sim.T}년`;
  }

  let lastChart = 0, chartTimer = 0;
  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawPower(); drawHist(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 120) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 140); }
  }
  function drawStatic() { drawCurve(); drawSweep(); drawBars(); }

  const h = L.harness({
    controls: ['g', 'd', 'u', 'reform'],
    format: { g: (v) => `해마다 +${v}%p`, d: (v) => v + '%', u: (v) => `±${v}%` },
    defaults: { g: 2, d: 30, u: 25, reform: 'off' },
    speedScale: 1,
    build() {
      sim = PS.create(params());
      if (THUMB) sim.run();
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done()) return false; sim.advance(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done(); },
    draw,
    after() { drawCharts(); drawStatic(); },
    redrawExtra() { drawCharts(); drawStatic(); },
    seedLabel: '세계',
  });
  seedGetter = h.seed;
  window.PowershiftApp = { params, sim: () => sim };
})();
