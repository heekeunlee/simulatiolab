(function () {
  'use strict';
  const FX = window.FxRate, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const GREEN = '#1fa463', RED = '#e5484d', GRAY = '#8a93a6', AMBER = '#e0a100';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 몇 번의 계단과 급락이 쌓인 장면으로 바로 간다
  let sim = null, full = null, ens = null, sweep = [], P = null;
  const params = (seed) => ({ seed, diff: Number($('diff').value), vol: Number($('vol').value), uip: Number($('uip').value) / 100, imp: Number($('imp').value) / 100, years: Number($('years').value) });
  // 범례를 놓을 구석 고르기: 점들 [x, y]이 가장 적게 겹치는 곳. fill=true면 점 아래가 칠해진 막대로 본다
  function pickPos(c, pts, n, fill) {
    const bw = 190, bh = n * 16 + 9, m = c.m; let best = 'tr', bc = 1e9;
    ['tr', 'tl', 'br', 'bl'].forEach((p) => {
      const x0 = p[1] === 'l' ? m.l + 6 : m.l + c.pw - bw - 6, y0 = p[0] === 'b' ? m.t + c.ph - bh - 6 : m.t + 6;
      const cnt = pts.filter(([x, y]) => x >= x0 - 4 && x <= x0 + bw + 4 && (fill ? y <= y0 + bh + 4 : y >= y0 - 4 && y <= y0 + bh + 4)).length;
      if (cnt < bc) { bc = cnt; best = p; }
    });
    return best;
  }
  const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);

  const idx = (x) => 100 * Math.exp(x);
  function ddOf(pnl, upTo) { // 누적 손익의 최대 낙폭과 그 구간
    let peak = 0, pi = 0, best = 0, bs = 0, be = 0;
    for (let i = 0; i <= upTo && i < pnl.length; i++) { if (pnl[i] > peak) { peak = pnl[i]; pi = i; } if (peak - pnl[i] > best) { best = peak - pnl[i]; bs = pi; be = i; } }
    return { dd: best, from: bs, to: be };
  }

  // ---------- ① 환율 경로 + 쏠림 ----------
  function drawFx() {
    const cw = $('c-fx').clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 0.95 : 0.52;
    const c = L.chart($('c-fx'), asp, { l: 48, r: 12, t: THUMB ? 16 : 24, b: THUMB ? 8 : 36 }), { ctx, w, h, m, pw, ph } = c;
    const gap = 14, hc = Math.round(ph * 0.22), hp = ph - hc - gap, N = sim.N;
    const X = (k) => m.l + (k / N) * pw;
    const ix = full.x.map(idx), lo0 = Math.min(...ix), hi0 = Math.max(...ix);
    const step = (hi0 - lo0) > 60 ? 20 : (hi0 - lo0) > 24 ? 10 : 5;
    const y0 = Math.floor((lo0 - 2) / step) * step, y1 = Math.ceil((hi0 + 2) / step) * step;
    const Y = (v) => m.t + hp - ((v - y0) / (y1 - y0)) * hp;
    const yt = []; for (let v = y0; v <= y1 + 1e-9; v += step) yt.push(v);
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.lineWidth = 1;
    yt.forEach((v) => { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(m.l + pw, Y(v)); ctx.stroke(); if (!THUMB) ctx.fillText(String(v), m.l - 6, Y(v) + 4); });
    // 시작 수준(100) 점선
    if (100 >= y0 && 100 <= y1) { ctx.setLineDash([4, 4]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(m.l, Y(100)); ctx.lineTo(m.l + pw, Y(100)); ctx.stroke(); ctx.setLineDash([]); }
    const k = sim.week;
    // 청산 구간 표시 (붉은 세로 띠)
    sim.crashes.forEach((cr) => { ctx.fillStyle = mix(RED, 0.12); ctx.fillRect(X(cr.week) - 1.5, m.t, 3, hp + gap + hc); });
    const pts = []; for (let i = 0; i <= k; i++) pts.push([X(i), Y(idx(sim.x[i]))]);
    L.line(ctx, pts, css('--accent'), THUMB ? 3.2 : 2.4);
    sim.crashes.forEach((cr) => { ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(X(cr.week), Y(idx(sim.x[cr.week])), THUMB ? 5 : 4, 0, 7); ctx.fill(); });
    if (k) { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(k), Y(idx(sim.x[k])), 4, 0, 7); ctx.fill(); }
    // 쏠림 띠
    const cy0 = m.t + hp + gap, CY = (v) => cy0 + hc - v * hc;
    ctx.strokeStyle = css('--line'); ctx.strokeRect(m.l + 0.5, cy0 + 0.5, pw - 1, hc - 1);
    if (k) {
      ctx.fillStyle = mix(AMBER, 0.55); ctx.beginPath(); ctx.moveTo(X(0), CY(0));
      for (let i = 0; i <= k; i++) ctx.lineTo(X(i), CY(sim.c[i]));
      ctx.lineTo(X(k), CY(0)); ctx.closePath(); ctx.fill();
      L.line(ctx, sim.c.slice(0, k + 1).map((v, i) => [X(i), CY(v)]), AMBER, 1.8);
    }
    if (!THUMB) {
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText('100%', m.l - 6, cy0 + 10); ctx.fillText('0%', m.l - 6, cy0 + hc);
      ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
      L.label(ctx, '캐리 투자자 쏠림', m.l + 6, cy0 + 14, 'left');
      ctx.font = '12px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
      for (let yr = 0; yr <= sim.params.years; yr += sim.params.years > 25 ? 10 : 5) ctx.fillText(String(yr), X(yr * 52), h - m.b + 16);
      L.axisNames(c, '시간 (년)', '통화 가치 (시작 = 100)');
      const items = [{ kind: 'line', color: css('--accent'), label: '통화 가치' }, { kind: 'dash', color: GRAY, label: '시작 수준 (100)' }];
      if (sim.crashes.length) items.push({ kind: 'dot', color: RED, label: '일제히 청산' });
      const fc = Object.assign({}, c, { ph: hp });
      L.legend(fc, items, pickPos(fc, full.x.map((v, i) => [X(i), Y(idx(v))]), items.length, false));
    }
    $('when').textContent = `${Math.floor(k / 52)}년째 · 쏠림 ${Math.round(sim.c[k] * 100)}% · 청산 ${sim.crashes.length}번`;
  }

  // ---------- ② 누적 캐리 손익 ----------
  function drawPnl() {
    const N = sim.N, k = sim.week, th = FX.theoryMean(sim.params).annual * 100;
    const all = full.pnl.map((v) => v * 100);
    const refEnd = th * sim.params.years;
    let lo = Math.min(0, ...all, 0), hi = Math.max(...all, refEnd, 1);
    const step = (hi - lo) > 80 ? 20 : (hi - lo) > 30 ? 10 : 5;
    const y0 = Math.floor((lo - 1) / step) * step, y1 = Math.ceil((hi + 1) / step) * step, yt = []; for (let v = y0; v <= y1 + 1e-9; v += step) yt.push(v);
    const c = L.chart($('c-pnl'), 0.62, { l: 48, b: 40 }), { ctx, m, pw, ph } = c;
    const X = (i) => m.l + (i / N) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const xt = []; for (let yr = 0; yr <= sim.params.years; yr += sim.params.years > 25 ? 10 : 5) xt.push(yr * 52);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => String(v), xTicks: xt, xFmt: (v) => String(v / 52), xLabel: '시간 (년)', yLabel: '누적 캐리 손익 (%p)' });
    // UIP가 완전히 맞을 때 기준선(0)과 이 설정의 기대 경로
    ctx.setLineDash([5, 3]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(m.l + pw, Y(0)); ctx.stroke();
    ctx.strokeStyle = GREEN; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(N), Y(refEnd)); ctx.stroke(); ctx.setLineDash([]);
    if (th > 0.2) { ctx.fillStyle = GREEN; ctx.textAlign = 'right'; L.label(ctx, `이 설정의 평균 기대 (연 ${f1(th)}%)`, m.l + pw - 4, Y(refEnd) + (refEnd > 0 ? 16 : -6), 'right'); }
    const d = ddOf(sim.pnl.map((v) => v * 100), k);
    if (d.dd > 0.5) { ctx.fillStyle = mix(RED, 0.15); ctx.fillRect(X(d.from), m.t, Math.max(2, X(d.to) - X(d.from)), ph); }
    sim.crashes.forEach((cr) => { ctx.strokeStyle = mix(RED, 0.4); ctx.beginPath(); ctx.moveTo(X(cr.week), m.t); ctx.lineTo(X(cr.week), m.t + ph); ctx.stroke(); });
    L.line(ctx, sim.pnl.slice(0, k + 1).map((v, i) => [X(i), Y(v * 100)]), css('--accent'), 2.6);
    // 이름표(최대 낙폭, 평균 기대)가 놓일 자리도 피해서 범례를 놓는다
    const fd = ddOf(full.pnl.map((v) => v * 100), N), lblPts = [];
    for (let dx = -130; dx <= 130; dx += 15) lblPts.push([X(fd.from) + dx, m.t + 24]);
    for (let dx = -180; dx <= 0; dx += 15) lblPts.push([m.l + pw + dx, Y(refEnd) + (refEnd > 0 ? 16 : -6)]);
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '누적 캐리 손익' }, { kind: 'dash', color: GREEN, label: '이 설정의 평균 기대' }, { kind: 'dash', color: GRAY, label: 'UIP가 완전할 때 (0)' }],
      pickPos(c, full.pnl.map((v, i) => [X(i), Y(v * 100)]).concat([[X(0), Y(0)], [X(N), Y(refEnd)], [X(N / 2), Y(0)], [X(N / 2), Y(refEnd / 2)]], lblPts), 3, false));
    if (d.dd > 0.5) { ctx.fillStyle = RED; ctx.textAlign = X(d.from) > m.l + pw / 2 ? 'right' : 'left'; L.label(ctx, `최대 낙폭 ${f1(d.dd)}%p`, X(d.from) + (X(d.from) > m.l + pw / 2 ? -4 : 4), m.t + 24, ctx.textAlign); }
  }

  // ---------- ③ 주간 수익 분포 ----------
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const TAIL = -0.05;
  function histData() {
    const all = ens.rets, W = 0.005; let mn = Infinity, mx = -Infinity, n = 0, s = 0;
    all.forEach((r) => r.forEach((v) => { if (v < mn) mn = v; if (v > mx) mx = v; s += v; n++; }));
    const mu = s / n; let s2 = 0; all.forEach((r) => r.forEach((v) => { s2 += (v - mu) * (v - mu); })); const sd = Math.sqrt(s2 / n);
    const b0 = Math.floor(Math.min(mn, -0.05) / W) * W, b1 = Math.ceil(Math.max(mx, 0.05) / W) * W, nb = Math.round((b1 - b0) / W);
    const cnt = new Array(nb).fill(0); let tail = 0;
    all.forEach((r) => r.forEach((v) => { cnt[Math.min(nb - 1, Math.floor((v - b0) / W))]++; if (v < TAIL) tail++; }));
    const norm = cnt.map((_, i) => n * (Phi((b0 + (i + 1) * W - mu) / sd) - Phi((b0 + i * W - mu) / sd)));
    return { cnt, norm, b0, b1, W, nb, n, mu, sd, tail, tailNorm: n * Phi((TAIL - mu) / sd) };
  }
  function drawHist() {
    const hItems = [{ kind: 'box', color: mix(css('--accent'), 0.65), label: '실제 주 수' }, { kind: 'box', color: mix(RED, 0.8), label: '-5% 아래' }, { kind: 'line', color: GRAY, label: '종 모양 (정규분포)' }], hsp = L.belowSpace($('c-hist'), hItems);
    const H = histData(), c = L.chart($('c-hist'), 0.62 + hsp.extra / ($('c-hist').clientWidth || 400), { l: 52, b: hsp.b }), { ctx, m, pw, ph } = c;
    const mxc = Math.max(...H.cnt, ...H.norm), X = (v) => m.l + ((v - H.b0) / (H.b1 - H.b0)) * pw, Y = (v) => m.t + ph - Math.sqrt(Math.max(0, v) / mxc) * ph;
    const yt = [0]; for (let v = 1; v < mxc; v *= 10) yt.push(v);
    const xt = []; for (let v = Math.ceil(H.b0 / 0.05) * 0.05; v <= H.b1 + 1e-9; v += 0.05) xt.push(+v.toFixed(2));
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => String(v), xTicks: xt, xFmt: (v) => String(Math.round(v * 100)), xLabel: '한 주의 캐리 수익률 (%)', yLabel: '주 수 (주, 제곱근 눈금)' });
    H.cnt.forEach((v, i) => { const x0 = X(H.b0 + i * H.W), bw = Math.max(1, X(H.b0 + (i + 1) * H.W) - x0 - 1); ctx.fillStyle = H.b0 + (i + 1) * H.W <= TAIL + 1e-9 ? mix(RED, 0.8) : mix(css('--accent'), 0.65); if (v) ctx.fillRect(x0, Y(v), bw, Y(0) - Y(v)); });
    L.line(ctx, H.norm.map((v, i) => [X(H.b0 + (i + 0.5) * H.W), Y(v)]), GRAY, 2.2);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = RED; ctx.beginPath(); ctx.moveTo(X(TAIL), m.t); ctx.lineTo(X(TAIL), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    const tn = H.tailNorm < 0.5 ? '0' : String(Math.round(H.tailNorm));
    ctx.fillStyle = RED; ctx.textAlign = 'left'; L.label(ctx, `-5% 아래 주: 실제 ${H.tail}주 · 종 모양이라면 약 ${tn}주`, m.l + 6, m.t + 14, 'left');
    L.drawLegendBelow(c, hItems);
    return H;
  }

  // ---------- ④ 금리차 훑기 ----------
  function drawSweep() {
    if (!sweep.length) return;
    const hi = Math.max(...sweep.map((d) => Math.max(d.mean, d.loss)), 10), y1 = Math.ceil((hi + 2) / 10) * 10, yt = []; for (let v = 0; v <= y1; v += 10) yt.push(v);
    const sItems = [{ kind: 'line', color: GREEN, label: '연 평균 캐리 수익' }, { kind: 'line', color: RED, label: '가장 나쁜 한 주의 평균 손실' }], ssp = L.belowSpace($('c-sweep'), sItems);
    const c = L.chart($('c-sweep'), 0.66 + ssp.extra / ($('c-sweep').clientWidth || 400), { l: 46, b: ssp.b, r: 24 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v / 10) * pw, Y = (v) => m.t + ph - (v / y1) * ph;
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => String(v), xTicks: [0, 2, 4, 6, 8, 10], xFmt: (v) => String(v), xLabel: '두 나라의 금리 차이 (%p, 예시)', yLabel: '평균 수익·손실 (%p)' });
    L.line(ctx, sweep.map((d) => [X(d.x), Y(d.loss)]), RED, 2.8);
    L.line(ctx, sweep.map((d) => [X(d.x), Y(d.mean)]), GREEN, 2.8);
    sweep.forEach((d) => { ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(X(d.x), Y(d.loss), 3, 0, 7); ctx.fill(); ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(X(d.x), Y(d.mean), 3, 0, 7); ctx.fill(); });
    L.vline(c, X(sim.params.diff), css('--rich'), '지금 설정', sim.params.diff > 5 ? 'right' : 'left');
    L.drawLegendBelow(c, sItems);
  }

  function renderStats() {
    const k = sim.week, ret = sim.ret.slice(0, k);
    const st = k > 104 ? FX.stats(ret, sim.pnl.slice(0, k + 1)) : null, th = FX.theoryMean(sim.params).annual * 100;
    const cards = [];
    if (st && st.worstOverMean) cards.push(['최악의 한 주가 지운 이익', `약 ${f1(st.worstOverMean / 52)}년치`, `최악의 한 주 ${f1(st.worst * 100)}% · 평소 한 주 평균 이익 ${f2(st.mean * 100)}%`]);
    else cards.push(['최악의 한 주가 지운 이익', k > 104 ? '이익 없음' : '계산 중', k > 104 ? `최악의 한 주 ${f1(st.worst * 100)}% · 아직 번 돈이 없어요` : '시간이 조금 흐르면 나타나요']);
    cards.push(['지금까지 연평균 캐리 수익', st ? `${f1(st.annMean * 100)}%` : '-', `이 설정의 평균 기대 연 ${f1(th)}% (UIP가 완전하면 0)`]);
    cards.push(['누적 손익의 최대 낙폭', st ? `-${f1(ddOf(sim.pnl.map((v) => v * 100), k).dd)}%p` : '-', '꼭대기에서 바닥까지 가장 크게 빠진 폭']);
    cards.push(['수익 분포의 기울기 (왜도, 40경로)', f2(ens.skew), '0이면 좌우 대칭, 음수면 왼쪽(급락) 꼬리가 길어요']);
    $('stats').innerHTML = cards.map(([a, v, s]) => `<div class="stat"><div class="k">${a}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawFx(); drawPnl(); }
  function after() { drawHist(); drawSweep(); renderStats(); }

  function build(seed) {
    P = params(seed); sim = FX.create(P); full = FX.create(P).run();
    ens = FX.ensemble(Object.assign({}, P), 40, 100);
    sweep = FX.sweepDiff(Object.assign({}, P), [0, 1, 2, 3, 4, 6, 8, 10], 24);
    if (THUMB) sim.step(sim.N);
  }

  L.harness({
    controls: ['diff', 'uip', 'imp', 'vol', 'years'],
    format: { diff: (v) => v + '%p', uip: (v) => v + '%', imp: (v) => v + '%', vol: (v) => v + '%', years: (v) => v + '년' },
    defaults: { diff: 4, uip: 30, imp: 12, vol: 8, years: 20 },
    build,
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawHist(); drawSweep(); },
    seedLabel: '시장 번호',
    speedScale: 1,
  });
})();
