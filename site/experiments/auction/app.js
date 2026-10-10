(function () {
  'use strict';
  const AU = window.Auction, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const NS = [2, 3, 4, 5, 7, 10, 15, 20, 30], SHADES = []; for (let s = 0; s <= 3.0001; s += 0.25) SHADES.push(+s.toFixed(2));
  let sim = null, hist = null, breakEven = 0, nRows = [], sRows = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), sigma: Number($('sigma').value) / 100, shade: Number($('shade').value), rule: $('rule').value });
  const f1 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);

  // ---------- ① 경매 한 번 ----------
  function drawAuction() {
    const c = L.chart($('c-auction'), 0.66, { l: 14, r: 14, t: 34, b: 70 }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const a = sim.last;
    ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
    if (!a) { ctx.fillStyle = css('--muted'); ctx.fillText('재생을 누르면 경매가 시작돼요', m.l, 24); }
    else {
      const lo = Math.min(...a.sig, a.V) - 10, hi = Math.max(...a.sig, a.V) + 10;
      const X = (v) => m.l + ((v - lo) / (hi - lo)) * pw;
      ctx.fillText(`${sim.round}번째 경매 · 입찰자 ${a.sig.length}명`, m.l, 22);
      const order = a.bid.map((b, i) => i).sort((p, q) => a.bid[q] - a.bid[p]), n = order.length, row = Math.min(14, ph / n);
      ctx.strokeStyle = '#d19200'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(a.V), m.t - 6); ctx.lineTo(X(a.V), m.t + n * row + 4); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.fillStyle = '#d19200'; ctx.textAlign = 'center'; ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(`진짜 가치 ${a.V.toFixed(0)}`, X(a.V), m.t - 10);
      order.forEach((i, r) => {
        const y = m.t + r * row + row / 2, win = i === a.winner;
        ctx.strokeStyle = 'rgba(99,106,122,.35)'; ctx.beginPath(); ctx.moveTo(X(a.sig[i]), y); ctx.lineTo(X(a.bid[i]), y); ctx.stroke();
        ctx.fillStyle = mix(css('--accent'), 0.55); ctx.beginPath(); ctx.arc(X(a.sig[i]), y, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = win ? css('--unlucky') : css('--muted'); ctx.lineWidth = win ? 2.5 : 1.2; ctx.beginPath(); ctx.arc(X(a.bid[i]), y, win ? 5.5 : 3.6, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      });
      ctx.textAlign = 'left'; ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillStyle = a.profit < 0 ? css('--unlucky') : css('--lucky');
      ctx.fillText(`낙찰 가격 ${a.price.toFixed(0)} · 낙찰자 손익 ${f1(a.profit)}`, m.l, h - 50);
      ctx.fillStyle = css('--muted'); ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText('파란 점: 각자의 추정치, 동그라미: 입찰가, 붉은 동그라미: 낙찰', m.l, h - 32);
      // 지금까지의 평균 손익
      const H = sim.history, X2 = (i) => m.l + (i / Math.max(40, sim.params.rounds)) * pw, y0 = h - 14, sc = 18 / Math.max(10, Math.abs(Math.min(...H, 0)));
      ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(m.l, y0 - 9); ctx.lineTo(m.l + pw, y0 - 9); ctx.stroke();
      L.line(ctx, H.map((v, i) => [X2(i), y0 - 9 - v * sc]), css('--unlucky'), 2);
    }
    $('when').textContent = `${sim.round}/${sim.params.rounds}번 · 평균 손익 ${f1(sim.mean())}`;
  }

  // ---------- ② 낙찰자 손익 분포 ----------
  function drawHist() {
    const c = L.chart($('c-hist'), 0.7, { b: 40 }), { ctx, m, pw, ph } = c;
    let lo = Infinity, hi = -Infinity, sum = 0; hist.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; sum += v; });
    lo = Math.min(lo, -5); hi = Math.max(hi, 5); const pad = (hi - lo) * 0.04; lo -= pad; hi += pad;
    const nb = 40, counts = new Array(nb).fill(0); hist.forEach((v) => { counts[Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb))]++; });
    const cmax = Math.max(...counts), X = (v) => m.l + ((v - lo) / (hi - lo)) * pw, Y = (v) => m.t + ph - (v / cmax) * ph;
    const step = (hi - lo) > 120 ? 40 : (hi - lo) > 60 ? 20 : 10, xt = []; for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.5, 1].map((q) => q * cmax), yFmt: (v) => String(Math.round(v)), xTicks: xt, xFmt: (v) => String(v), xLabel: '낙찰자 손익 (진짜 가치 평균 100 기준)' });
    const bw = pw / nb;
    counts.forEach((v, i) => { const mid = lo + ((i + 0.5) / nb) * (hi - lo); ctx.fillStyle = mid < 0 ? mix(css('--unlucky'), 0.8) : mix(css('--lucky'), 0.8); ctx.fillRect(m.l + i * bw + 0.5, Y(v), Math.max(1, bw - 1), m.t + ph - Y(v)); });
    L.vline(c, X(0), css('--text'), '손익 0', 'right');
    const mean = sum / hist.length; ctx.setLineDash([4, 3]); ctx.strokeStyle = '#d19200'; ctx.beginPath(); ctx.moveTo(X(mean), m.t + 18); ctx.lineTo(X(mean), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#d19200'; ctx.textAlign = mean > (lo + hi) / 2 ? 'right' : 'left'; ctx.fillText(`평균 ${f1(mean)}`, X(mean) + (mean > (lo + hi) / 2 ? -5 : 5), m.t + 30);
  }

  const yLimit = (rows) => { let mx = 20; rows.forEach((s) => s.forEach((d) => d.runs.forEach((v) => { mx = Math.max(mx, Math.abs(v)); }))); return Math.ceil(mx / 10) * 10; };
  // ---------- ③ 입찰자 수에 따라 ----------
  function drawN() {
    const lim = yLimit(nRows.map((r) => r.pts));
    L.dots($('c-n'), {
      data: nRows[0] ? nRows[0].pts : [], y0: -lim, y1: lim, yFmt: (v) => String(Math.round(v)),
      series: nRows.slice(1).map((r) => ({ data: r.pts, color: r.color })),
      x0: 2, x1: 30, xTicks: [2, 5, 10, 15, 20, 25, 30], xFmt: (v) => v + '명', xLabel: '입찰자 수',
      refs: [{ y: 0, label: '손익 0', color: '#8a93a6' }], marker: { x: sim.params.n, label: '지금 설정' },
    });
  }
  // ---------- ④ 입찰가를 낮추면 ----------
  function drawS() {
    const lim = yLimit(sRows.map((r) => r.pts));
    L.dots($('c-s'), {
      data: sRows[0] ? sRows[0].pts : [], y0: -lim, y1: lim, yFmt: (v) => String(Math.round(v)),
      series: sRows.slice(1).map((r) => ({ data: r.pts, color: r.color })),
      x0: 0, x1: 3, xTicks: [0, 0.5, 1, 1.5, 2, 2.5, 3], xFmt: (v) => v + 'σ', xLabel: '모두가 입찰가를 낮추는 정도 (추정 오차의 표준편차 σ 단위)',
      refs: [{ y: 0, label: '손익 0', color: '#8a93a6' }], marker: { x: sim.params.shade, label: '지금 설정' },
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
