(function () {
  'use strict';
  const DK = window.Drake, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 신호 고리가 은하에 퍼진 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_N = '#2f6fed', C_EXP = '#94a3b8', C_RT = '#e8590c', C_L = '#7c3aed', C_MC = '#2f6fed', C_ALONE = '#adb5bd', C_ANS = '#2f6fed', C_TWO = '#94a3b8';
  // 집계(미리 계산): node tools/validate-drake.js 출력의 SWEEP과 같아야 한다 (기본 범위, 수명만 바꿔 시드 4개 평균)
  const SWEEP = {"L":{"20":{"L":100,"n":0.104,"expect":0.1,"rt":68014,"two":1,"ans":0,"died":39},"30":{"L":1000,"n":0.985,"expect":1,"rt":48872,"two":25,"ans":0,"died":40},"40":{"L":10000,"n":9.57,"expect":10,"rt":21060,"two":100,"ans":32,"died":37},"50":{"L":100000,"n":99.3,"expect":100,"rt":7503,"two":100,"ans":100,"died":201},"60":{"L":1000000,"n":998,"expect":1000,"rt":2489,"two":100,"ans":100,"died":1985}},"mc":{"median":0.991,"p10":-0.909,"p90":2.963,"alone":26},"fix":{"L":2.5,"fl":3.6,"rs":3.9}};
  const SMALL = (window.innerWidth || 1000) < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const CAP = SMALL ? 1200 : 3000;   // 3D에 그리는 문명 점의 최대 수 (넘으면 점 하나가 여러 문명을 대신)
  const IDS = ['rs', 'fp', 'ne', 'fl', 'fi', 'fc', 'L'];
  const LNAME = { 20: '100년', 30: '1천 년', 40: '1만 년', 50: '10만 년', 60: '100만 년' };
  const NAMES = { rs: '새 별', fp: '행성', ne: '살 만한 행성', fl: '생명', fi: '지능', fc: '신호', L: '수명' };
  let sim = null, mc = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0;
  const params = () => { const p = { seed: seedGetter(), u: Number($('u').value) }; IDS.forEach((k) => { p[k] = Number($(k).value); }); return p; };
  const speed = () => ($('speed') ? Number($('speed').value) : 20);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };

  // 숫자: 큰 수는 쉼표, 작은 수는 유효숫자 2자리 (지수 표기 없이)
  function fmt(v) {
    if (v == null || !isFinite(v)) return '';
    if (v >= 1000) return Math.round(v).toLocaleString('en-US');
    if (v >= 10) return String(Math.round(v));
    if (v >= 1) return String(Math.round(v * 10) / 10);
    if (v < 1e-6) return '0';
    const d = Math.max(0, 1 - Math.floor(Math.log10(v)));
    return String(Number(v.toPrecision(2)).toFixed(d)).replace(/\.?0+$/, '');
  }
  const decLabel = (e) => fmt(Math.pow(10, e));
  function rangeOf(id) {
    const r = DK.ranges(Object.assign(params(), { seed: 1 })).find((x) => x.id === id);
    const lo = fmt(Math.pow(10, r.lo)), hi = fmt(Math.pow(10, r.hi));
    return lo === hi ? lo : `${lo}~${hi}`;
  }

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.DrakeState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB, small: SMALL }; }

  // ---------- ② 지금 켜진 문명 수 (재생 시점까지) ----------
  function niceTicks(max, n) {
    const raw = max / (n || 4), p = Math.pow(10, Math.floor(Math.log10(raw))), s = [1, 2, 2.5, 5, 10].find((k) => k * p >= raw) * p, out = [];
    for (let v = 0; v <= max + 1e-9; v += s) out.push(+v.toPrecision(6)); return out;
  }
  function xTicksTime() { const t = niceTicks(sim.T, 4); return t.filter((v) => v <= sim.T); }
  function drawCount() {
    const cv = $('c-time'), items = [{ kind: 'line', color: C_N, label: '지금 켜진 문명 수' }, { kind: 'dash', color: C_EXP, label: '평균으로 기대되는 수' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 50, r: 28, t: 30 }), { ctx, m, pw, ph } = c;
    const E = sim.expect, ymax = niceTicks(Math.max(3, E + 4 * Math.sqrt(E) + 1), 4).slice(-1)[0] * 1.0001;
    const yT = niceTicks(ymax, 4), X = (t) => m.l + (t / sim.T) * pw, Y = (v) => m.t + ph - (Math.min(v, ymax) / ymax) * ph;
    L.axes(c, { X, Y, yTicks: yT, yFmt: fmt, xTicks: xTicksTime(), xFmt: fmt, xLabel: '시간 (년)', yLabel: '문명 수 (개)' });
    ctx.strokeStyle = C_EXP; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(m.l, Y(E)); ctx.lineTo(m.l + pw, Y(E)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    const H = sim.hist.n, pts = [];
    H.forEach((v, k) => { const x = X(k * sim.dt); if (k) pts.push([x, Y(H[k - 1])]); pts.push([x, Y(v)]); });
    L.line(ctx, pts, C_N, 2.2);
    const n = H.length - 1; ctx.fillStyle = C_N; ctx.beginPath(); ctx.arc(X(n * sim.dt), Y(H[n]), 4, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }
  // ③ 가장 가까운 이웃과 신호 왕복 vs 수명 (로그 눈금, 재생 시점까지)
  function drawRT() {
    const cv = $('c-rt'), items = [{ kind: 'line', color: C_RT, label: '가장 가까운 이웃과 신호 왕복' }, { kind: 'dash', color: C_L, label: '문명의 수명' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 64, r: 28, t: 30 }), { ctx, m, pw, ph } = c;
    const lo = Math.floor(Math.log10(Math.min(sim.L, 1000))) , hi = Math.max(6, Math.ceil(Math.log10(sim.L)) + 1);
    const X = (t) => m.l + (t / sim.T) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(v, Math.pow(10, lo))) - lo) / (hi - lo)) * ph;
    const yT = []; for (let e = lo; e <= hi; e++) if ((hi - lo) <= 6 || (e - lo) % 2 === 0) yT.push(Math.pow(10, e));
    // 수명 선 위쪽 = 답이 오기 전에 사라지는 곳 (옅은 색 면)
    ctx.fillStyle = 'rgba(124,58,237,.06)'; ctx.fillRect(m.l, m.t, pw, Math.max(0, Y(sim.L) - m.t));
    L.axes(c, { X, Y, yTicks: yT, yFmt: fmt, xTicks: xTicksTime(), xFmt: fmt, xLabel: '시간 (년)', yLabel: '걸리는 시간 (년, 로그 눈금)' });
    ctx.strokeStyle = C_L; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(m.l, Y(sim.L)); ctx.lineTo(m.l + pw, Y(sim.L)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.font = '600 11.5px ' + FONT; ctx.fillStyle = C_L; ctx.textAlign = 'right';
    if (Y(sim.L) - m.t > 22) L.label(ctx, '보라 선 위쪽 = 답이 오기 전에 사라져요', m.l + pw - 6, m.t + 15, 'right');
    const H = sim.hist.rt; let seg = [];
    const flush = () => { if (seg.length) L.line(ctx, seg, C_RT, 2.4); seg = []; };
    H.forEach((v, k) => { if (v == null) flush(); else seg.push([X(k * sim.dt), Y(v)]); }); flush();
    const n = H.length - 1; if (H[n] != null) { ctx.fillStyle = C_RT; ctx.beginPath(); ctx.arc(X(n * sim.dt), Y(H[n]), 4, 0, 7); ctx.fill(); }
    L.drawLegendBelow(c, items);
  }

  // ---------- ④ 몬테카를로 분포 (집계) ----------
  function drawMC() {
    const cv = $('c-mc'), items = [{ kind: 'box', color: C_ALONE, label: '1개 미만 (우리 말고 없음)' }, { kind: 'box', color: C_MC, label: '1개 이상' }, { kind: 'dash', color: '#111827', label: '가운데 값' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 42, r: 30, t: 30 }), { ctx, m, pw, ph } = c;
    const g = mc.logs, x0 = Math.floor(Math.min(-2, g[Math.floor(g.length * 0.005)])), x1 = Math.ceil(Math.max(3, g[Math.floor(g.length * 0.995)]));
    const BW = 0.25, nb = Math.round((x1 - x0) / BW), cnt = new Array(nb).fill(0);
    g.forEach((v) => { const i = Math.floor((v - x0) / BW); if (i >= 0 && i < nb) cnt[i]++; });
    const pc = cnt.map((k) => (k / g.length) * 100), ymax = Math.max(4, Math.ceil(Math.max.apply(null, pc) / 2) * 2);
    const X = (e) => m.l + ((e - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph - (v / ymax) * ph;
    const step = Math.max(1, Math.ceil((x1 - x0) / Math.max(3, Math.floor(pw / 62)))), xt = []; for (let e = x0; e <= x1; e++) if ((e - x0) % step === 0) xt.push(e);
    L.axes(c, { X, Y, yTicks: niceTicks(ymax, 4), yFmt: (v) => v + '%', xTicks: xt, xFmt: decLabel, xLabel: '지금 신호를 내는 문명 수 (개, 로그 눈금)', yLabel: '1만 번 중 비율 (%)' });
    pc.forEach((v, i) => { const a = x0 + i * BW; ctx.fillStyle = a < 0 ? C_ALONE : C_MC; ctx.fillRect(X(a) + 0.5, Y(v), Math.max(1, X(a + BW) - X(a) - 1), Y(0) - Y(v)); });
    const xm = X(mc.median); ctx.strokeStyle = '#111827'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(xm, m.t); ctx.lineTo(xm, m.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.font = '700 12px ' + FONT; ctx.fillStyle = '#111827'; const right = xm > m.l + pw * 0.62;
    L.label(ctx, `가운데 값 ${fmt(Math.pow(10, mc.median))}개`, xm + (right ? -6 : 6), m.t + 13, right ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  // ⑤ 어느 항이 답을 가장 흔드나 (집계: 지금 범위로 계산)
  function drawShare() {
    const cv = $('c-share'), narrow = (cv.clientWidth || 400) < 480;
    const c = L.chart(cv, narrow ? 0.78 : 0.56, { b: 40, l: narrow ? 92 : 112, r: 44, t: 30 }), { ctx, m, pw, ph } = c;
    const S = mc.share, rh = ph / S.length, X = (v) => m.l + v * pw, top = S.reduce((a, s) => (s.v > a.v ? s : a), S[0]);
    L.axes(c, { X: (v) => X(v / 100), Y: () => -99, yTicks: [], xTicks: [0, 25, 50, 75, 100], xFmt: (v) => v + '%', xLabel: '답을 흔드는 몫 (%)', yLabel: '' });
    [0, 25, 50, 75, 100].forEach((v) => { ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(X(v / 100), m.t); ctx.lineTo(X(v / 100), m.t + ph); ctx.stroke(); });
    S.forEach((s, i) => {
      const y = m.t + i * rh + rh * 0.18, h = rh * 0.64;
      ctx.fillStyle = s === top ? C_RT : '#64748b'; ctx.fillRect(m.l, y, Math.max(1, X(s.v) - m.l), h);
      ctx.font = (s === top ? '700 ' : '600 ') + (narrow ? '11.5px ' : '12.5px ') + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'right';
      ctx.fillText(NAMES[s.id], m.l - 8, y + h / 2 + 4);
      ctx.textAlign = 'left'; ctx.fillText(Math.round(s.v * 100) + '%', X(s.v) + 5, y + h / 2 + 4);
    });
  }
  // ⑥ 수명별 비교 (집계: 미리 돌린 20판)
  function drawLsweep() {
    const cv = $('c-L'), items = [{ kind: 'box', color: C_ANS, label: '답장을 받은 문명 (%)' }, { kind: 'box', color: C_TWO, label: '둘 이상이 동시에 켜진 시간 (%)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 40, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const P = params(), keys = [20, 30, 40, 50, 60], gw = pw / keys.length, Y = (v) => m.t + ph - (v / 100) * ph;
    const others = IDS.slice(0, 6).every((k) => P[k] === DK.DEFAULTS[k]) && P.u === 100;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: [0, 25, 50, 75, 100], yFmt: (v) => v + '%', xTicks: [], yLabel: '비율 (%)' });
    keys.forEach((k, i) => {
      const s = SWEEP.L[k], x0 = m.l + i * gw, cur = others && P.L === k;
      if (cur) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      const bw = Math.min(30, (gw - 14) / 2), st = x0 + (gw - bw * 2 - 4) / 2;
      [[s.ans, C_ANS], [s.two, C_TWO]].forEach(([v, col], j) => {
        const x = st + j * (bw + 4); ctx.fillStyle = col; ctx.fillRect(x, Y(v), bw, Math.max(1, Y(0) - Y(v)));
        ctx.font = '700 11px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + bw / 2, Y(v) - 4);
      });
      const nar = gw < 80; ctx.font = (cur ? '700 ' : '600 ') + (nar ? '10.5px ' : '11.5px ') + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(LNAME[k], x0 + gw / 2, m.t + ph + 16);
      ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(nar ? `${fmt(s.n)}개` : `평균 ${fmt(s.n)}개`, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);
  }
  function notes() {
    const S = SWEEP.L;
    $('note-l').textContent = `가장 가까운 이웃과 왕복: 수명 100년 ${fmt(S[20].rt)}년 · 1만 년 ${fmt(S[40].rt)}년 · 100만 년 ${fmt(S[60].rt)}년`;
    $('note-m').textContent = `1만 번 중 가운데 값 ${fmt(Math.pow(10, mc.median))}개 · 열 번 중 여덟 번은 ${fmt(Math.pow(10, mc.p10))}~${fmt(Math.pow(10, mc.p90))}개 · 1개 미만 ${Math.round(mc.pAlone * 100)}%`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const s = sim.last, ended = sim.done;
    const nSub = sim.m > 1 ? `점 하나 = 문명 ${fmt(sim.m)}개로 줄여 그렸어요` : `평균으로는 약 ${fmt(sim.expect)}개 (가운데 값으로 돌린 은하)`;
    let rtV = '', rtS = '켜진 문명이 둘 이상일 때 재요';
    if (s.rt != null) { rtV = `${fmt(s.rt)}년`; rtS = s.rt > sim.L ? `수명 ${fmt(sim.L)}년보다 길어요` : `수명 ${fmt(sim.L)}년 안에 오가요`; }
    let aV = '', aS = '사라진 문명이 생기면 세요';
    if (s.ans != null) { aV = `${Math.round(s.ans * 100)}%`; aS = `지금까지 사라진 ${sim.died}개 중`; }
    const cards = [
      ['지금 동시에 켜진 문명', `${fmt(s.n)}개`, nSub, false],
      ['가장 가까운 이웃과 신호 왕복', rtV, rtS, false],
      ['보낸 신호에 답장을 받은 문명', aV, aS, !ended],
      ['1만 번 굴린 문명 수 (가운데 값)', `${fmt(Math.pow(10, mc.median))}개`, `열 번 중 여덟 번은 ${fmt(Math.pow(10, mc.p10))}~${fmt(Math.pow(10, mc.p90))}개 · 1개 미만 ${Math.round(mc.pAlone * 100)}%`, false],
    ];
    $('stats').innerHTML = cards.map(([k, v, sub, dim]) => `<div class="stat"${dim ? ' style="opacity:.55"' : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${fmt(sim.t)}년 / ${fmt(sim.T)}년`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawCount(); drawRT(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { drawMC(); drawShare(); drawLsweep(); notes(); }

  const fmtR = (id, unit) => () => { const r = rangeOf(id); return unit ? `${r}${unit}` : r; };
  const h = L.harness({
    controls: ['rs', 'fp', 'ne', 'fl', 'fi', 'fc', 'L', 'u'],
    format: { rs: fmtR('rs', '개'), fp: fmtR('fp'), ne: fmtR('ne', '개'), fl: fmtR('fl'), fi: fmtR('fi'), fc: fmtR('fc'), L: fmtR('L', '년'), u: (v) => v + '%' },
    defaults: { rs: 3, fp: -3, ne: -5, fl: -10, fi: -10, fc: -5, L: 40, u: 100 },
    speedScale: 1,
    build() {
      const p = params();
      mc = DK.monteCarlo(p, 10000, p.seed);
      sim = DK.create(Object.assign({}, p, { cap: CAP }));
      if (THUMB) for (let i = 0; i < 230; i++) sim.advance();
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done) return false; sim.advance(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '은하',
  });
  seedGetter = h.seed;
  // harness의 format은 자기 값만 받으므로, 다른 슬라이더(모르는 정도)를 움직여도 범위 글자가 바뀌게 한 번 더 쓴다
  const outAll = () => ['rs', 'fp', 'ne', 'fl', 'fi', 'fc', 'L'].forEach((id) => { const o = $('o-' + id); if (o) o.textContent = ({ rs: fmtR('rs', '개'), ne: fmtR('ne', '개'), L: fmtR('L', '년') }[id] || fmtR(id))(); });
  $('u').addEventListener('input', outAll); outAll();
  window.DrakeApp = { params, sim: () => sim, mc: () => mc };
})();
