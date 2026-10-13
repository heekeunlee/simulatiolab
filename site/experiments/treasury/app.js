(function () {
  'use strict';
  const T = window.Treasury, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const GREEN = '#1fa463', RED = '#e5484d', GRAY = '#8a93a6';
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 10년이 다 지나 경로 부채꼴이 펼쳐진 장면으로 바로 간다
  let sim = null, S = null, seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), r0: Number($('r0').value), b: Number($('b').value), a: Number($('a').value), sig: Number($('sig').value), tp: Number($('tp').value) });
  const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
  const pc = (v, d) => (v * 100).toFixed(d == null ? 1 : d); // 소수 -> % 숫자 문자열
  const sgn = (v, d) => (v >= 0 ? '+' : '-') + Math.abs(v * 100).toFixed(d == null ? 1 : d); // 부호 붙은 %

  // 지금까지의 달마다 단기금리 분위수·평균, 10년 금리 평균
  function series() {
    const M = sim.month, N = sim.R.length, q = sim.q;
    const out = { mean: [], y10: [], p05: [], p25: [], p75: [], p95: [] };
    const buf = new Float64Array(N);
    for (let m = 0; m <= M; m++) {
      let s = 0, s10 = 0;
      for (let i = 0; i < N; i++) { const r = sim.R[i][m]; buf[i] = r; s += r; s10 += T.tenYield(q, r); }
      out.mean.push(s / N); out.y10.push(s10 / N);
      buf.sort();
      const g = (p) => buf[Math.min(N - 1, Math.floor(p * (N - 1) + 0.5))];
      out.p05.push(g(0.05)); out.p25.push(g(0.25)); out.p75.push(g(0.75)); out.p95.push(g(0.95));
    }
    return out;
  }

  // ---------- ① 단기금리 경로 부채꼴 ----------
  function drawFan() {
    const cw = $('c-fan').clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 0.85 : 0.56;
    const c = L.chart($('c-fan'), asp, { l: 44, r: 14, t: THUMB ? 16 : 24, b: THUMB ? 12 : 40 }), { ctx, w, h, m, pw, ph } = c;
    const q = sim.q, M = sim.months(), sr = series();
    // 세로 범위: 이론상 넓게 펼쳐질 범위(평균 ± 2.7 표준편차)와 지금까지 그려진 값을 모두 담는다
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 20; k++) {
      const mm = Math.round((k / 20) * M), yr = mm / 12, mu = sim.expectedShort(mm), sd = q.sig * Math.sqrt((1 - Math.exp(-2 * q.a * yr)) / (2 * q.a));
      lo = Math.min(lo, mu - 2.1 * sd); hi = Math.max(hi, mu + 2.1 * sd);
    }
     sr.y10.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
    const y0 = Math.floor(lo * 100 - 0.2), y1 = Math.ceil(hi * 100 + 0.2), step = y1 - y0 > 9 ? 2 : 1;
    const Y = (v) => m.t + ph - ((v * 100 - y0) / (y1 - y0)) * ph, X = (mm) => m.l + (mm / M) * pw;
    if (!THUMB) {
      const yt = []; for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) yt.push(v);
      const xt = []; for (let yr = 0; yr * 12 <= M; yr += 2) xt.push(yr);
      L.axes(c, { X: (yr) => X(yr * 12), Y: (v) => Y(v / 100), yTicks: yt, yFmt: (v) => v + '%', xTicks: xt, xFmt: (v) => v + '년', xLabel: '시간 (년)', yLabel: '금리 (%)' });
      if (y0 < 0) { ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(m.l + pw, Y(0)); ctx.stroke(); }
    }
    const band = (a, b, alpha) => {
      ctx.fillStyle = mix(css('--accent'), alpha); ctx.beginPath();
      a.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
      for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(b[i]));
      ctx.closePath(); ctx.fill();
    };
    if (sim.month > 0) { band(sr.p05, sr.p95, 0.12); band(sr.p25, sr.p75, 0.16); }
    // 개별 경로 (일부만)
    const show = Math.min(THUMB ? 40 : 30, sim.R.length);
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    for (let i = 0; i < show; i++) {
      ctx.strokeStyle = mix(css('--accent'), 0.3); ctx.beginPath();
      sim.R[i].forEach((v, k) => (k ? ctx.lineTo(X(k), Y(v)) : ctx.moveTo(X(k), Y(v)))); ctx.stroke();
    }
    // 장기 평균
    if (!THUMB) {
      ctx.setLineDash([2, 4]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(m.l, Y(q.b)); ctx.lineTo(m.l + pw, Y(q.b)); ctx.stroke(); ctx.setLineDash([]);
    }
    // 충격 표시
    if (!THUMB) sim.shocks.forEach((s) => L.vline(c, X(s.month), css('--unlucky'), `충격 +${f1(s.dr * 100)}%p`, s.month > M / 2 ? 'right' : 'left'));
    L.line(ctx, sr.mean.map((v, i) => [X(i), Y(v)]), css('--accent'), 3);
    L.line(ctx, sr.y10.map((v, i) => [X(i), Y(v)]), RED, 3);
    const e = sr.mean.length - 1;
    ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(e), Y(sr.mean[e]), 4, 0, 7); ctx.fill();
    ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(X(e), Y(sr.y10[e]), 4, 0, 7); ctx.fill();
    if (!THUMB) L.legend(c, [{ kind: 'line', color: css('--accent'), label: `단기금리 평균 ${f2(sr.mean[e] * 100)}%` }, { kind: 'line', color: RED, label: `10년 금리 평균 ${f2(sr.y10[e] * 100)}%` }, { kind: 'dash', color: GRAY, label: `장기 평균 ${f1(q.b * 100)}%` }], 'tl');
    $('when').textContent = `${sim.month}/${M}개월`;
    return sr;
  }

  // ---------- ② 금리 ↔ 채권 가격 곡선 ----------
  function drawCurve(sr) {
    const c = L.chart($('c-curve'), 0.66, { l: 46, r: 16, t: 24, b: 40 }), { ctx, m, pw, ph } = c;
    const y0 = S.y0, cp = S.c, md = S.mod, x0 = 0, x1 = 10;
    const P = (y) => T.bondPrice(cp, y / 100), tan = (y) => 100 * (1 - md * (y / 100 - y0));
    const lo = Math.floor(P(x1) / 10) * 10 - 10, hi = Math.ceil(P(x0) / 10) * 10 + 10;
    const X = (v) => m.l + ((v - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    const yt = []; for (let v = lo; v <= hi; v += 20) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => String(v), xTicks: [0, 2, 4, 6, 8, 10], xFmt: (v) => v + '%', xLabel: '10년 금리 (%)', yLabel: '채권 가격 (액면 100)' });
    const xs = []; for (let v = x0; v <= x1 + 1e-9; v += 0.1) xs.push(v);
    // 직선(듀레이션 어림)과 실제 곡선 사이: 볼록성
    ctx.fillStyle = mix(GREEN, 0.18); ctx.beginPath();
    xs.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(P(v))) : ctx.moveTo(X(v), Y(P(v)))));
    for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(X(xs[i]), Y(Math.max(lo, tan(xs[i]))));
    ctx.closePath(); ctx.fill();
    L.line(ctx, xs.map((v) => [X(v), Y(Math.max(lo, tan(v)))]), GRAY, 2);
    L.line(ctx, xs.map((v) => [X(v), Y(P(v))]), css('--accent'), 3);
    const dot = (xv, color, txt, dx, dy, al) => {
      const yv = P(xv);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(xv), Y(yv), 5, 0, 7); ctx.fill();
      ctx.font = '12px ' + FONT; ctx.textAlign = al; L.label(ctx, txt, X(xv) + dx, Y(yv) + dy, al);
    };
    const yb = y0 * 100;
    dot(yb, css('--text'), `시작 ${f1(yb)}% · 가격 100`, 10, -10, 'left');
    dot(yb + 1, RED, `+1%p: ${f1(P(yb + 1) - 100)}`, 10, 8, 'left');
    dot(Math.max(0, yb - 1), GREEN, `-1%p: +${f1(P(yb - 1) - 100)}`, -10, -8, 'right');
    const e = sr.y10.length - 1, yn = sr.y10[e] * 100;
    if (Math.abs(yn - yb) > 0.05 && yn >= x0 && yn <= x1) dot(yn, css('--rich'), `지금 ${f1(yn)}%`, 10, -30, 'left');
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '실제 가격 곡선' }, { kind: 'line', color: GRAY, label: '듀레이션 직선' }, { kind: 'box', color: mix(GREEN, 0.5), label: '볼록성(곡선과 직선의 틈)' }], 'tr');
  }

  // ---------- ③ 가격 변화 분포 ----------
  const HB = 2, HLO = -24, HN = 24; // 2% 칸, -24%~+24%
  function drawHist() {
    const c = L.chart($('c-hist'), 0.6, { l: 46, r: 14, t: 24, b: 40 }), { ctx, m, pw, ph } = c;
    const v = sim.priceChangeAt(sim.month).map((x) => x * 100), N = v.length;
    const cnt = new Array(HN).fill(0);
    v.forEach((x) => { cnt[Math.max(0, Math.min(HN - 1, Math.floor((x - HLO) / HB)))]++; });
    const mx = Math.max(...cnt) / N, ymax = Math.max(0.1, Math.ceil(mx * 10 + 0.3) / 10);
    const X = (x) => m.l + ((x - HLO) / (HB * HN)) * pw, Y = (s) => m.t + ph - (s / ymax) * ph;
    const yt = []; for (let s = 0; s <= ymax + 1e-9; s += ymax > 0.5 ? 0.2 : 0.1) yt.push(+s.toFixed(2));
    L.axes(c, { X, Y, yTicks: yt, yFmt: (s) => Math.round(s * 100) + '%', xTicks: [-20, -10, 0, 10, 20], xFmt: (t) => (t > 0 ? '+' : '') + t + '%', xLabel: '채권 가격 변화 (%, 이자 제외)', yLabel: '경로 비율 (%)' });
    cnt.forEach((k, i) => {
      const x = HLO + i * HB, mid = x + HB / 2;
      ctx.fillStyle = mix(mid < 0 ? RED : GREEN, 0.75);
      ctx.fillRect(X(x) + 1, Y(k / N), (pw / HN) - 2, Math.max(0, m.t + ph - Y(k / N)));
    });
    ctx.strokeStyle = css('--text'); ctx.beginPath(); ctx.moveTo(X(0), m.t); ctx.lineTo(X(0), m.t + ph); ctx.stroke();
    const sorted = v.slice().sort((a, b) => a - b), g = (p) => sorted[Math.min(N - 1, Math.floor(p * (N - 1) + 0.5))];
    const mean = v.reduce((a, b) => a + b, 0) / N;
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left';
    ctx.fillText(`${sim.month}개월 뒤`, m.l + 6, m.t + 12);
    L.legend(c, [{ kind: 'box', color: mix(RED, 0.75), label: '값이 떨어진 경로' }, { kind: 'box', color: mix(GREEN, 0.75), label: '값이 오른 경로' }], 'tr');
    const sg = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(1);
    $('note-3').innerHTML = `<span>평균:</span> <b>${sg(mean)}%</b> · <span>하위 5%:</span> <b>${sg(g(0.05))}%</b> · <span>상위 5%:</span> <b>${sg(g(0.95))}%</b>`;
  }

  function renderStats() {
    const P = sim.params;
    const cards = [
      ['10년 금리가 1%p 오르면 채권값은', `-${pc(-S.up)}%`, `반대로 1%p 내리면 +${pc(S.dn)}%. 내릴 때 이득이 오를 때 손해보다 큽니다(볼록성)`],
      ['모델이 정한 10년 금리 (예시 숫자)', `${f2(S.y0 * 100)}%`, '앞으로의 단기금리 예상 평균에 기간 프리미엄을 더한 값'],
      ['단기금리 +1%p일 때 10년 금리', `+${pc(S.dY, 2)}%p`, '회귀가 빠를수록 장기 금리는 덜 움직입니다'],
      ['듀레이션(금리 민감도)', `${f1(S.mod)}년`, `금리 1%p당 가격이 약 ${f1(S.mod)}% 움직이는 정도`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); const sr = drawFan(); drawCurve(sr); drawHist(); }

  const h = L.harness({
    controls: ['r0', 'b', 'a', 'sig', 'tp'],
    format: { r0: (v) => v + '%', b: (v) => v + '%', a: (v) => v, sig: (v) => v + '%p', tp: (v) => v + '%p' },
    defaults: { r0: 2.5, b: 3.5, a: 0.3, sig: 1, tp: 0.5 },
    build() {
      const P = params(); sim = T.create(P); S = T.summary(P);
      if (THUMB) sim.run();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    speedScale: 0.8,
    draw, seedLabel: '금리 경로 번호',
  });
  seedGetter = h.seed;

  // 충격: 지금 모든 경로의 단기금리를 +1%p 올린다 (끝난 뒤에 눌러도 2년을 더 이어 간다)
  $('shock').addEventListener('click', () => {
    const wasDone = sim.done();
    sim.shock(0.01);
    if (wasDone) { sim.extend(24); const pb = $('play'); if (pb) pb.click(); }
    draw();
  });
})();
