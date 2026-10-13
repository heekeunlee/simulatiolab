(function () {
  'use strict';
  const H = window.Hagwon, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const GREEN = '#1fa463', RED = '#e5484d', GRAY = '#8a93a6', BLUE = '#2f6fed';
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 학원 경쟁이 자리 잡은 장면으로 바로 간다
  let sim = null, seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), beta: Number($('beta').value), cost: Number($('cost').value), cap: Number($('cap').value), mode: $('mode').value });
  const K = H.DEFAULTS.K;
  const f1 = (v) => v.toFixed(1);
  const pc = (v) => Math.round(v * 100);
  const signed = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(1);

  // 학원 수가 많을수록 진한 파랑
  const A0 = [196, 211, 238], A1 = [16, 44, 112];
  const lvl = (e) => { const q = e / K; return `rgb(${A0.map((v, i) => Math.round(v + (A1[i] - v) * q)).join(',')})`; };
  const LVLS = [0, 1, 2, 3, 4, 5].map(lvl);

  // ---------- ① 학원 경쟁 ----------
  function drawRace() {
    const P = sim.params, cw = $('c-race').clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 0.95 : 0.62;
    const c = L.chart($('c-race'), asp, { l: 46, r: 14, t: THUMB ? 12 : cw < 560 ? 46 : 30, b: THUMB ? 14 : 44 }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const x0 = -3.6, x1 = 3.6, y0 = -3.6, y1 = 3.6 + P.beta * K;
    const X = (v) => m.l + ((v - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    if (!THUMB) {
      L.axes(c, { X, Y, yTicks: [-2, 0, 2, 4].filter((v) => v < y1), yFmt: (v) => String(v), xTicks: [-3, -2, -1, 0, 1, 2, 3], xFmt: (v) => String(v), xLabel: cw < 560 ? '학원 없이 얻을 점수' : '학원 없이 얻을 점수 (실력과 운이 좋을수록 오른쪽)' });
      ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = css('--muted'); ctx.fillText('지금 점수', 0, 0); ctx.restore();
    }
    // 학원이 없을 때의 점수(대각선)
    ctx.setLineDash([4, 4]); ctx.strokeStyle = GRAY; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(x0), Y(x0)); ctx.lineTo(X(x1), Y(x1)); ctx.stroke(); ctx.setLineDash([]);
    // 위쪽 절반 선(상대평가) 또는 합격선(절대평가)
    const ln = sim.line(), rel = P.mode === 'rel';
    ctx.strokeStyle = rel ? RED : GREEN; ctx.lineWidth = THUMB ? 3.5 : 2.4; ctx.beginPath(); ctx.moveTo(m.l, Y(ln)); ctx.lineTo(m.l + pw, Y(ln)); ctx.stroke(); ctx.lineWidth = 1;
    // 가구들
    const r = THUMB ? 6.5 : cw < 560 ? 3.2 : 4;
    for (let i = 0; i < P.n; i++) {
      const bx = sim.base[i], sy = sim.score[i];
      if (bx < x0 || bx > x1) continue;
      ctx.fillStyle = lvl(sim.e[i]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(X(bx), Y(sy), r, 0, 7); ctx.fill(); ctx.stroke();
    }
    if (THUMB) return;
    ctx.font = '12px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = rel ? RED : GREEN;
    L.label(ctx, rel ? `위쪽 절반 선 (점수 ${ln.toFixed(1)})` : `합격선 (고정) ${ln.toFixed(1)}`, m.l + pw - 4, Y(ln) - 6, 'right');
    ctx.textAlign = 'left'; ctx.fillStyle = css('--muted'); L.label(ctx, '학원 없을 때', X(1.7) - 20, Y(1.7) + 28, 'left');
    ctx.font = '600 13px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
    ctx.fillText(`${sim.round}라운드 · 평균 학원 ${f1(mean(sim.e))}개`, m.l, 18);
    // 색 설명
    ctx.font = '11px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = css('--muted');
    const ly = cw < 560 ? 34 : 17, bx0 = cw < 560 ? m.l + 52 : w - 14 - 6 * 14 - 30; ctx.fillText('학원 수', bx0 - 4, ly);
    for (let e = 0; e <= K; e++) { ctx.fillStyle = lvl(e); ctx.fillRect(bx0 + e * 14, ly - 9, 12, 12); }
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText(`${K}개`, bx0 + 6 * 14 + 2, ly + 1);
    $('when').textContent = `${sim.round}/${P.rounds}라운드 · ${rel ? '상대평가' : '절대평가'}`;
  }
  function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }

  // ---------- 공통: 라운드 축 ----------
  function roundChart(id, y0, y1, yTicks, yFmt) {
    const c = L.chart($(id), 0.58, { l: 46, b: 40, r: 14 }), { m, pw, ph } = c, R = sim.params.rounds;
    const X = (r) => m.l + (r / R) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const xt = []; for (let r = 0; r <= R; r += 20) xt.push(r);
    L.axes(c, { X, Y, yTicks, yFmt, xTicks: xt, xFmt: (v) => String(v), xLabel: $(id).clientWidth < 560 ? '라운드' : '라운드 (가구들이 학원 수를 다시 정하는 차례)' });
    return { c, X, Y };
  }

  // ---------- ② 시간에 따른 결과와 학원비 ----------
  function drawTime() {
    const P = sim.params, c0 = P.cost;
    const { c, X, Y } = roundChart('c-time', 0, 1, [0, 0.25, 0.5, 0.75, 1], (v) => Math.round(v * 100) + '%');
    const { ctx, m, pw } = c, O = sim.outcome, N = sim.net, C = sim.meanE.map((v) => v * c0);
    const rel = P.mode === 'rel', last = O.length - 1;
    L.line(ctx, O.map((v, i) => [X(i), Y(v)]), GRAY, 2.4);
    L.line(ctx, C.map((v, i) => [X(i), Y(v)]), RED, 2.4);
    L.line(ctx, N.map((v, i) => [X(i), Y(v)]), css('--accent'), 3);
    const dot = (v, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(last), Y(v), 4, 0, 7); ctx.fill(); };
    dot(O[last], GRAY); dot(C[last], RED); dot(N[last], css('--accent'));
    ctx.font = '12px ' + FONT; ctx.textAlign = 'right';
    const xr = m.l + pw - 4;
    ctx.fillStyle = '#6b7488'; L.label(ctx, rel ? `평균 순위 ${pc(O[last])}%` : `평균 합격 가능성 ${pc(O[last])}%`, xr, Y(O[last]) - 9, 'right');
    ctx.fillStyle = RED; L.label(ctx, `학원비 ${pc(C[last])}%`, xr, Y(C[last]) + 18, 'right');
    ctx.fillStyle = css('--accent'); L.label(ctx, `순이득 ${pc(N[last])}%`, xr, Y(N[last]) - 9, 'right');
  }

  // ---------- ③ 학원 수별 가구 비율 ----------
  function drawShares() {
    const { c, X, Y } = roundChart('c-shares', 0, 1, [0, 0.25, 0.5, 0.75, 1], (v) => Math.round(v * 100) + '%');
    const { ctx } = c, sh = sim.shares;
    for (let k = K; k >= 0; k--) {
      ctx.fillStyle = LVLS[k]; ctx.beginPath();
      const top = (i) => { let s = 0; for (let q = 0; q <= k; q++) s += sh[i][q]; return s; };
      sh.forEach((_, i) => (i ? ctx.lineTo(X(i), Y(top(i))) : ctx.moveTo(X(i), Y(top(i)))));
      for (let i = sh.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(0));
      ctx.closePath(); ctx.fill();
    }
  }

  // ---------- ④, ⑤ 모두가 같은 수준을 쓸 때 (이론값) ----------
  const grid = []; for (let e = 0; e <= K + 1e-9; e += 0.1) grid.push(+e.toFixed(1));
  function sweepChart(id, y1, yTicks, yFmt, series, fills, extra) {
    const c = L.chart($(id), 0.62, { l: 46, b: 40, r: 18 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v / K) * pw, Y = (v) => m.t + ph - (v / y1) * ph;
    L.axes(c, { X, Y, yTicks, yFmt, xTicks: [0, 1, 2, 3, 4, 5], xFmt: (v) => v + '개', xLabel: '모든 집이 보내는 학원 수 (개)' });
    if (fills) fills(ctx, X, Y);
    series.forEach(([pts, col, wd, dash]) => { ctx.setLineDash(dash || []); L.line(ctx, pts.map(([x, y]) => [X(x), Y(y)]), col, wd); ctx.setLineDash([]); });
    if (extra) extra(c, X, Y);
    const ce = mean(sim.e);
    L.vline(c, X(ce), css('--rich'), '지금 평균', ce > K / 2 ? 'right' : 'left');
    return c;
  }
  function drawGain() {
    const P = sim.params, cost = P.cost * 100;
    const g = grid.map((e) => [e, H.symmetric(P, e).gainOne * 100]);
    const y1 = Math.max(12, Math.ceil(Math.max(cost, ...g.map((d) => d[1])) / 2) * 2 + 2), yt = []; for (let v = 0; v <= y1; v += y1 > 16 ? 5 : 2) yt.push(v);
    sweepChart('c-gain', y1, yt, (v) => v + '%p', [[g, BLUE, 3], [[[0, cost], [K, cost]], RED, 2.4, [6, 3]]], (ctx, X, Y) => {
      for (let i = 1; i < g.length; i++) {
        const a = g[i - 1], b = g[i], good = (a[1] + b[1]) / 2 > cost;
        ctx.fillStyle = mix(good ? GREEN : RED, 0.16); ctx.beginPath();
        ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.lineTo(X(b[0]), Y(cost)); ctx.lineTo(X(a[0]), Y(cost)); ctx.closePath(); ctx.fill();
      }
    });
  }
  function drawNet() {
    const P = sim.params, mk = (mode) => grid.map((e) => [e, H.symmetric(Object.assign({}, P, { mode }), e).net]);
    const c = sweepChart('c-net', 1, [0, 0.25, 0.5, 0.75, 1], (v) => Math.round(v * 100) + '%', [[mk('rel'), RED, P.mode === 'rel' ? 3.4 : 2], [mk('abs'), GREEN, P.mode === 'abs' ? 3.4 : 2]], null, (c2, X) => {
      if (P.cap < K) L.vline(c2, X(P.cap), css('--unlucky'), '합의 상한', P.cap > K / 2 ? 'right' : 'left');
    });
  }

  // ---------- 숫자 카드 ----------
  function renderStats() {
    const P = sim.params, rel = P.mode === 'rel', R = sim.round, e0 = sim.meanE[0], e1 = sim.meanE[R];
    const ce = e1, s0 = H.symmetric(P, ce), s1 = H.symmetric(P, ce + 1), ch = sim.change();
    const one = s0.gainOne * 100, all = (s1.outcome - s0.outcome) * 100;
    const ratio = e0 > 0 ? e1 / e0 : 1;
    const cards = [
      ['한 집만 학원을 한 개 더 보내면', `${signed(one)}%p`, rel ? '내 순위가 오르는 폭 (평균, 이론값)' : '내 합격 가능성이 오르는 폭 (평균, 이론값)'],
      ['모든 집이 한 개씩 더 보내면', `${signed(Math.abs(all) < 0.05 ? 0 : all)}%p`, rel ? '평균 순위 변화. 누가 오르면 누군가는 내려갑니다' : '평균 합격 가능성 변화 (이론값)'],
      ['학원비 총액', `×${ratio.toFixed(1)}`, `처음 대비 (평균 ${f1(e0)}개 → ${f1(e1)}개)`],
      ['가구당 순이득', `${pc(sim.net[R])}%`, `결과 − 학원비 · 처음 ${pc(sim.net[0])}% · 오른 집 ${pc(ch.up)}% / 내린 집 ${pc(ch.down)}%`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRace(); drawTime(); drawShares(); }
  function after() { drawGain(); drawNet(); }

  const h = L.harness({
    controls: ['beta', 'cost', 'cap', 'mode'],
    format: { beta: (v) => Number(v).toFixed(2) + '점', cost: (v) => '순위 ' + Math.round(v * 100) + '%p 가치', cap: (v) => (Number(v) >= K ? '제한 없음' : v + '개까지'), mode: () => '' },
    defaults: { beta: 0.3, cost: 0.04, cap: 5, mode: 'rel' },
    build() {
      sim = H.create(params());
      if (THUMB) for (let k = 0; k < 85 && !sim.done(); k++) sim.advance();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawGain(); drawNet(); }, seedLabel: '가구 번호',
  });
  seedGetter = h.seed;
})();
