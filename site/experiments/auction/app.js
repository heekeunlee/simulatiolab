(function () {
  'use strict';
  const AU = window.Auction, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const NS = [2, 3, 4, 5, 7, 10, 15, 20, 30], SHADES = []; for (let s = 0; s <= 3.0001; s += 0.25) SHADES.push(+s.toFixed(2));
  let sim = null, hist = null, breakEven = 0, nRows = [], sRows = [];
  let seedGetter = () => 1;
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 손익 분포를 정사각형으로 그린다
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), sigma: Number($('sigma').value) / 100, shade: Number($('shade').value), rule: $('rule').value });
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
  const f1 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);

  // ---------- ① 경매 한 번 ----------
  // 입찰자 한 명이 한 줄(입찰가 높은 순). 파란 점 = 추정치, 동그라미 = 입찰가, 금색 점선 = 진짜 가치.
  // 낙찰자 줄에는 진짜 가치와 낙찰 가격 사이를 칠해 "이기고도 잃은 만큼"을 보여 준다.
  const FONT = '-apple-system, "Apple SD Gothic Neo", sans-serif';
  function drawAuction() {
    const cw = $('c-auction').clientWidth || 600;
    const c = L.chart($('c-auction'), cw < 560 ? 0.95 : 0.62, { l: 14, r: 14, t: 38, b: 134 }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const a = sim.last;
    ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 13px ' + FONT;
    if (!a) { ctx.fillStyle = css('--muted'); ctx.fillText('재생을 누르면 경매가 시작돼요', m.l, 24); }
    else {
      const lo = Math.min(...a.sig, a.bid[a.winner], a.V) - 8, hi = Math.max(...a.sig, a.V) + 8;
      const X = (v) => m.l + ((v - lo) / (hi - lo)) * pw;
      ctx.fillText(`${sim.round}번째 경매 · 입찰자 ${a.sig.length}명`, m.l, 22);
      const order = a.bid.map((b, i) => i).sort((p, q) => a.bid[q] - a.bid[p]), n = order.length;
      const row = Math.min(30, (ph - 26) / n), y0 = m.t + 4, yEnd = y0 + n * row, rad = Math.max(2.5, Math.min(6, row * 0.24));
      // 눈금 (가격)
      const step = hi - lo > 90 ? 20 : hi - lo > 40 ? 10 : 5;
      ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
        ctx.strokeStyle = 'rgba(99,106,122,.12)'; ctx.beginPath(); ctx.moveTo(X(v), y0); ctx.lineTo(X(v), yEnd); ctx.stroke();
        ctx.fillStyle = css('--muted'); ctx.fillText(String(v), X(v), yEnd + 15);
      }
      // 낙찰자 줄: 진짜 가치 ~ 낙찰 가격 사이
      const wr = order.indexOf(a.winner), wy = y0 + wr * row + row / 2, loss = a.profit < 0;
      ctx.fillStyle = loss ? 'rgba(229,72,77,.18)' : 'rgba(31,164,99,.18)';
      ctx.fillRect(Math.min(X(a.V), X(a.price)), wy - row * 0.42, Math.abs(X(a.price) - X(a.V)), row * 0.84);
      ctx.strokeStyle = loss ? css('--unlucky') : css('--lucky'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(a.price), wy - row * 0.45); ctx.lineTo(X(a.price), wy + row * 0.45); ctx.stroke(); ctx.lineWidth = 1;
      // 진짜 가치
      ctx.strokeStyle = '#d19200'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(a.V), m.t - 4); ctx.lineTo(X(a.V), yEnd); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.fillStyle = '#b07a00'; ctx.font = '600 12px ' + FONT; ctx.textAlign = X(a.V) > m.l + pw - 60 ? 'right' : X(a.V) < m.l + 60 ? 'left' : 'center'; ctx.fillText(`진짜 가치 ${a.V.toFixed(0)}`, X(a.V), m.t - 8);
      order.forEach((i, r) => {
        const y = y0 + r * row + row / 2, win = i === a.winner;
        ctx.strokeStyle = 'rgba(99,106,122,.4)'; ctx.beginPath(); ctx.moveTo(X(a.sig[i]), y); ctx.lineTo(X(a.bid[i]), y); ctx.stroke();
        ctx.fillStyle = mix(css('--accent'), win ? 0.9 : 0.55); ctx.beginPath(); ctx.arc(X(a.sig[i]), y, rad * 0.75, 0, 7); ctx.fill();
        ctx.strokeStyle = win ? css('--unlucky') : css('--muted'); ctx.lineWidth = win ? 2.5 : 1.2; ctx.beginPath(); ctx.arc(X(a.bid[i]), y, win ? rad * 1.5 : rad, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      });
      // 낙찰자 손익 라벨
      ctx.font = '600 12px ' + FONT; ctx.fillStyle = loss ? css('--unlucky') : css('--lucky');
      const right = X(Math.max(a.V, a.price, a.bid[a.winner])) + rad * 2 + 6, room = right < m.l + pw - 70;
      ctx.textAlign = room ? 'left' : 'right';
      ctx.fillText(`낙찰자 ${f1(a.profit)}`, room ? right : X(Math.min(a.V, a.price)) - rad * 2 - 6, wy + 4);
      // 아래 글
      ctx.textAlign = 'left'; ctx.font = '600 13px ' + FONT;
      ctx.fillStyle = loss ? css('--unlucky') : css('--lucky');
      ctx.fillText(`낙찰 가격 ${a.price.toFixed(0)} · 낙찰자 손익 ${f1(a.profit)}`, m.l, h - 52);
      // 지금까지의 평균 손익 (작은 추이선, 0 기준선)
      const H = sim.history, sx = m.l + Math.min(150, pw * 0.36), sw = m.l + pw - sx, yz = h - 14, sc = 9 / Math.max(10, ...H.map((v) => Math.abs(v)));
      const X2 = (i) => sx + (i / Math.max(40, H.length - 1)) * sw; // 지금까지의 경매 수에 맞춰 늘려 그린다
      ctx.fillStyle = css('--muted'); ctx.fillText('평균 손익 추이', m.l, yz + 4);
      ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(sx, yz); ctx.lineTo(sx + sw, yz); ctx.stroke();
      L.line(ctx, H.map((v, i) => [X2(i), yz - v * sc]), css('--unlucky'), 2);
      // 범례 (행 위쪽 띠 아래의 빈 자리)
      L.legend(Object.assign({}, c, { m: Object.assign({}, m, { t: h - 130 }), ph: 64 }), [
        { kind: 'dot', color: css('--accent'), label: '각자의 추정치' },
        { kind: 'dot', color: css('--muted'), label: '입찰가 (동그라미)' },
        { kind: 'dot', color: css('--unlucky'), label: '낙찰자' },
      ], 'tl');
    }
    $('when').textContent = `${sim.round}/${sim.params.rounds}번 · 평균 손익 ${f1(sim.mean())}`;
  }

  // ---------- ② 낙찰자 손익 분포 ----------
  function drawHist() {
    const c = L.chart($('c-hist'), THUMB ? 1 : 0.7, { b: 40 }), { ctx, m, pw, ph } = c;
    // 축 범위는 미리 계산한 표본(hist)으로 고정하고, 막대·평균은 재생이 도달한 경매(sim.profits)까지만 그린다
    let lo = Infinity, hi = -Infinity, sum = 0; hist.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; });
    lo = Math.min(lo, -5); hi = Math.max(hi, 5); const pad = (hi - lo) * 0.04; lo -= pad; hi += pad;
    const cur = sim.profits.slice(0, sim.round), nb = 40, counts = new Array(nb).fill(0), fc = new Array(nb).fill(0);
    cur.forEach((v) => { sum += v; counts[Math.max(0, Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb)))]++; });
    hist.forEach((v) => { fc[Math.max(0, Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb)))]++; });
    const total = sim.params.rounds, cmax = Math.max(Math.ceil((Math.max(...fc) * total) / hist.length * 1.25), 4, ...counts), X = (v) => m.l + ((v - lo) / (hi - lo)) * pw, Y = (v) => m.t + ph - (v / cmax) * ph;
    const step = (hi - lo) > 120 ? 40 : (hi - lo) > 60 ? 20 : 10, xt = []; for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.5, 1].map((q) => q * cmax), yFmt: (v) => String(Math.round(v)), xTicks: xt, xFmt: (v) => String(v), xLabel: '낙찰자 손익 (가치 100 기준)', yLabel: '경매 횟수 (번)' });
    const bw = pw / nb;
    counts.forEach((v, i) => { const mid = lo + ((i + 0.5) / nb) * (hi - lo); ctx.fillStyle = mid < 0 ? mix(css('--unlucky'), 0.8) : mix(css('--lucky'), 0.8); ctx.fillRect(m.l + i * bw + 0.5, Y(v), Math.max(1, bw - 1), m.t + ph - Y(v)); });
    L.vline(c, X(0), css('--text'), '손익 0', 'right');
    const mean = cur.length ? sum / cur.length : null;
    if (mean != null) { ctx.setLineDash([4, 3]); ctx.strokeStyle = '#d19200'; ctx.beginPath(); ctx.moveTo(X(mean), m.t + 18); ctx.lineTo(X(mean), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    // 평균 라벨: 막대 위에서도 읽히게 흰 테두리를 두르고 굵게
    const ml = `평균 ${f1(mean)}`, mx = X(mean) + (mean > (lo + hi) / 2 ? -6 : 6);
    ctx.textAlign = mean > (lo + hi) / 2 ? 'right' : 'left'; ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.strokeText(ml, mx, m.t + 30); ctx.lineWidth = 1;
    ctx.fillStyle = '#b07a00'; ctx.fillText(ml, mx, m.t + 30); }
    const lc = Object.assign({}, c, { m: Object.assign({}, m, { t: m.t + 40 }), ph: ph - 40 });
    const bars = counts.map((v, i) => [m.l + (i + 0.5) * bw, Y(v)]).filter((q, i) => counts[i] > 0);
    if (mean != null) for (let dx = -60; dx <= 60; dx += 10) bars.push([X(mean) + dx, m.t + 24]);
    L.legend(lc, [{ kind: 'box', color: mix(css('--unlucky'), 0.8), label: '손해 본 경매' }, { kind: 'box', color: mix(css('--lucky'), 0.8), label: '이익 본 경매' }], pickPos(lc, bars, 2, true));
  }

  const yLimit = (rows) => { let mx = 20; rows.forEach((s) => s.forEach((d) => d.runs.forEach((v) => { mx = Math.max(mx, Math.abs(v)); }))); return Math.ceil(mx / 10) * 10; };
  // ---------- ③ 입찰자 수에 따라 ----------
  // L.dots와 같지만 범례를 그래프 아래 가로로 둔다 (결과를 가리지 않게)
  function dotsBelow(canvas, o) {
    const sp = L.belowSpace(canvas, o.legend || []);
    const c = L.chart(canvas, (o.aspect || 0.7) + sp.extra / (canvas.clientWidth || 400), { b: sp.b, r: 14, t: 24 });
    const { ctx, m, pw, ph } = c;
    const y0 = o.y0 == null ? 0 : o.y0, y1 = o.y1 == null ? 1 : o.y1;
    const X = (v) => m.l + ((v - o.x0) / (o.x1 - o.x0 || 1)) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const yt = []; for (let i = 0; i <= 4; i++) yt.push(y0 + ((y1 - y0) * i) / 4);
    L.axes(c, { X, Y, yTicks: yt, yFmt: o.yFmt || L.pct, xTicks: o.xTicks, xFmt: o.xFmt, xLabel: o.xLabel, yLabel: o.yLabel });
    (o.refs || []).forEach((r) => {
      ctx.setLineDash([5, 3]); ctx.strokeStyle = r.color; ctx.beginPath(); ctx.moveTo(m.l, Y(r.y)); ctx.lineTo(m.l + pw, Y(r.y)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = r.color; ctx.textAlign = 'left'; L.label(ctx, r.label, m.l + 6, Y(r.y) - 6, 'left');
    });
    const all = [{ data: o.data, color: o.color || css('--accent') }].concat(o.series || []);
    all.forEach((s, k) => {
      if (!s.data || !s.data.length) return;
      if (k === 0 || s.dots) { ctx.fillStyle = mix(s.color, 0.22); s.data.forEach((d) => (d.runs || []).forEach((r) => { ctx.beginPath(); ctx.arc(X(d.x), Y(r), 2.6, 0, 7); ctx.fill(); })); }
      L.line(ctx, s.data.map((d) => [X(d.x), Y(d.mean)]), s.color, 2.5);
      ctx.fillStyle = s.color; s.data.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.mean), 3.3, 0, 7); ctx.fill(); });
    });
    if (o.marker && o.marker.x >= o.x0 && o.marker.x <= o.x1) L.vline(c, X(o.marker.x), css('--rich'), o.marker.label || '지금 설정', o.marker.x > (o.x0 + o.x1) / 2 ? 'right' : 'left');
    L.drawLegendBelow(c, o.legend || []);
    return c;
  }
  function drawN() {
    const lim = yLimit(nRows.map((r) => r.pts));
    const items = [{ kind: 'line', color: css('--accent'), label: '입찰 그대로 · 첫째값' }];
    if (sim.params.shade > 0) items.push({ kind: 'line', color: '#1fa463', label: '지금 낮춤 · 첫째값' });
    items.push({ kind: 'line', color: '#e0a100', label: '입찰 그대로 · 둘째값' });
    dotsBelow($('c-n'), {
      legend: items, data: nRows[0] ? nRows[0].pts : [], y0: -lim, y1: lim, yFmt: (v) => String(Math.round(v)),
      series: nRows.slice(1).map((r) => ({ data: r.pts, color: r.color })),
      x0: 2, x1: 30, xTicks: [2, 5, 10, 15, 20, 25, 30], xFmt: (v) => String(v), xLabel: '입찰자 수 (명)', yLabel: '낙찰자 평균 손익 (점)',
      refs: [{ y: 0, label: '손익 0', color: '#8a93a6' }], marker: { x: sim.params.n, label: '지금 설정' },
    });
  }
  // ---------- ④ 입찰가를 낮추면 ----------
  function drawS() {
    const lim = yLimit(sRows.map((r) => r.pts));
    const c = L.dots($('c-s'), {
      data: sRows[0] ? sRows[0].pts : [], y0: -lim, y1: lim, yFmt: (v) => String(Math.round(v)),
      series: sRows.slice(1).map((r) => ({ data: r.pts, color: r.color })),
      x0: 0, x1: 3, xTicks: [0, 0.5, 1, 1.5, 2, 2.5, 3], xFmt: (v) => String(v), xLabel: '입찰가 낮추는 정도 (σ)', yLabel: '낙찰자 평균 손익 (점)',
      refs: [{ y: 0, label: '손익 0', color: '#8a93a6' }], marker: { x: sim.params.shade, label: '지금 설정' },
    });
    // 선마다 입찰자 수를 적는다 (범례가 없어 어느 선이 몇 명인지 알 수 없었다)
    const { ctx, m, pw, ph } = c, Y = (v) => m.t + ph - ((v + lim) / (2 * lim)) * ph;
    // 선 위(2.4σ 지점)에 흰 바탕 이름표를 얹는다: 선 사이 간격이 가장 넓은 곳이라 겹치지 않는다
    ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'center';
    sRows.filter((r) => r.pts.length > 1).forEach((r) => {
      const P = r.pts, xv = Math.min(2.4, P[P.length - 1].x);
      let i = 1; while (i < P.length - 1 && P[i].x < xv) i++;
      const u = (xv - P[i - 1].x) / ((P[i].x - P[i - 1].x) || 1), yv = P[i - 1].mean + (P[i].mean - P[i - 1].mean) * u;
      const x = m.l + (xv / 3) * pw, y = Y(yv), t = `${r.n}명 입찰`, tw = ctx.measureText(t).width + 10;
      ctx.fillStyle = 'rgba(255,255,255,.95)'; L.roundRect(ctx, x - tw / 2, y - 9, tw, 18, 9); ctx.fill();
      ctx.strokeStyle = r.color; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = r.color; ctx.fillText(t, x, y + 4);
    });
  }

  function renderStats() {
    const P = sim.params;
    const cards = [
      ['낙찰자 평균 손익', sim.round ? f1(sim.mean()) : '-', `가치 평균 100 기준 · ${sim.round}번의 경매`],
      ['손해 본 낙찰자', sim.round ? (sim.lossShare() * 100).toFixed(0) + '%' : '-', '낙찰가가 진짜 가치보다 높았던 경매'],
      ['손익분기 낮춤', breakEven.toFixed(2) + 'σ', P.rule === 'first' ? '모두가 이만큼 낮춰 불러야 평균 0' : '둘째값 방식에서 평균 0이 되는 낮춤'],
      ['입찰자 · 추정 오차', `${P.n}명 · ${(P.sigma * 100).toFixed(0)}%`, `추정 오차 σ = 가치의 ${(P.sigma * 100).toFixed(0)}%`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawAuction(); drawHist(); drawN(); drawS(); }

  function after() {
    const P = params(); nRows = []; sRows = []; drawN(); drawS(); $('note-n').textContent = '계산 중…'; $('note-s').textContent = '계산 중…';
    const cfgN = [
      { color: css('--accent'), opts: { rule: 'first', shade: 0 }, main: true },
      { color: '#1fa463', opts: { rule: 'first', shade: P.shade } },
      { color: '#e0a100', opts: { rule: 'second', shade: 0 } },
    ];
    // 낮춤이 0이면 초록(지금 낮춤) 선이 파랑과 똑같아 파랑을 덮어 버린다 → 그때는 초록 선을 뺀다
    if (!(P.shade > 0)) cfgN.splice(1, 1);
    cfgN.forEach((cf) => { cf.pts = []; nRows.push(cf); });
    const jobs = [];
    NS.forEach((n) => jobs.push(() => cfgN.forEach((cf) => {
      const runs = [1, 2, 3].map((k) => AU.study(Object.assign({ sigma: P.sigma, n }, cf.opts), 3000, k * 7).mean);
      cf.pts.push({ x: n, runs: cf.main ? runs : [], mean: L.mean(runs) });
    })));
    const ns = [P.n, 3, 30].filter((v, i, a) => a.indexOf(v) === i), cols = [css('--accent'), '#1fa463', '#7c5cff'];
    ns.forEach((n, i) => sRows.push({ color: cols[i], n, pts: [] }));
    SHADES.forEach((s) => jobs.push(() => sRows.forEach((r, i) => {
      const runs = [1, 2, 3].map((k) => AU.study({ sigma: P.sigma, n: r.n, rule: P.rule, shade: s }, 3000, k * 11).mean);
      r.pts.push({ x: s, runs: i === 0 ? runs : [], mean: L.mean(runs) });
    })));
    L.jobs(jobs, () => { drawN(); drawS(); }, () => {
      const at = (rows, n) => { const p = rows[0].pts.find((q) => q.x === n); return p ? p.mean : null; };
      const a = at(nRows, 2), b = at(nRows, 30);
      $('note-n').textContent = a != null && b != null ? `입찰자가 2명이면 ${f1(a)}, 30명이면 ${f1(b)}입니다 (파랑 선, 입찰 그대로, 첫째값 방식)` : '';
      // 평균 손익이 0이 되는 낮춤: 선이 직선이라 0을 가로지르는 두 점 사이를 보간하면 정확하다
      const be = sRows.map((r) => {
        const P = r.pts; if (P[0].mean >= 0) return 0;
        for (let i = 1; i < P.length; i++) if (P[i].mean >= 0) return P[i - 1].x + ((0 - P[i - 1].mean) * (P[i].x - P[i - 1].x)) / (P[i].mean - P[i - 1].mean);
        return null;
      });
      // 항목마다 따로 번역되도록 요소를 나눠서 넣는다
      $('note-s').innerHTML = '평균 손익이 0을 넘는 낮춤: ' + sRows.map((r, i) => `<b>입찰자 ${r.n}명 ${be[i] != null ? be[i].toFixed(2) + 'σ' : '3σ 초과'}</b>`).join(' · ');
    });
  }

  const h = L.harness({
    controls: ['n', 'sigma', 'shade', 'rule'],
    format: { n: (v) => v + '명', sigma: (v) => v + '%', shade: (v) => Number(v).toFixed(1) + 'σ', rule: () => '' },
    defaults: { n: 10, sigma: 20, shade: 0, rule: 'first' },
    build() {
      const P = params(); sim = AU.create(Object.assign({}, P, { rounds: 400 }));
      hist = AU.profits(P, 3000, P.seed);
      breakEven = Math.max(0, -AU.study(Object.assign({}, P, { shade: 0 }), 20000, 5).mean / (P.sigma * AU.SCALE));
    },
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawN(); drawS(); drawHist(); }, seedLabel: '경매장 번호',
  });
  seedGetter = h.seed;
})();
