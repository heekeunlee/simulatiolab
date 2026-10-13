(function () {
  'use strict';
  const AP = window.Apartment, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, sweepRows = [];
  let seedGetter = () => 1;
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 가격이 가운데서 번져 나가는 도중으로 바로 간다
  const params = () => ({
    seed: seedGetter(), contagion: Number($('contagion').value), ltv: Number($('ltv').value) / 100,
    optimism: Number($('optimism').value) / 100, rateStep: Number($('rateStep').value),
  });

  // 소득 기준선 대비 가격 → 색 (싼 편: 연한 하늘, 기준선: 연한 노랑, 비쌈: 주황 → 빨강 → 진한 자주)
  const STOPS = [[0.9, [199, 224, 250]], [1.0, [255, 244, 204]], [1.3, [245, 158, 66]], [1.7, [214, 49, 59]], [2.4, [122, 16, 32]]];
  function heat(r) {
    if (r <= STOPS[0][0]) return STOPS[0][1];
    for (let i = 1; i < STOPS.length; i++) if (r <= STOPS[i][0]) { const [r0, c0] = STOPS[i - 1], [r1, c1] = STOPS[i], u = (r - r0) / (r1 - r0); return c0.map((v, k) => Math.round(v + (c1[k] - v) * u)); }
    return STOPS[STOPS.length - 1][1];
  }

  function drawMap() {
    const cw = $('c-map').clientWidth || 600, asp = THUMB ? 1 : 1 + 44 / cw; // 지도 아래 범례 몫 44px (휴대폰에서 범례 글자가 잘리지 않게). 썸네일은 범례 없이 정사각형
    const { ctx, w } = L.setup($('c-map'), asp);
    const S = sim.size, pad = 8, bar = 30, side = w - pad * 2, cell = side / S;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, w * asp);
    const anchor = 100 * sim.income;
    for (let i = 0; i < S * S; i++) {
      const [r, g, b] = heat(sim.price[i] / anchor);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(pad + (i % S) * cell, pad + Math.floor(i / S) * cell, cell + 0.4, cell + 0.4);
    }
    // 처음 상승이 시작된 가운데 칸 표시
    const c0 = Math.floor(S / 2);
    ctx.strokeStyle = 'rgba(30,40,70,.55)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
    ctx.strokeRect(pad + (c0 - 3) * cell, pad + (c0 - 3) * cell, 7 * cell, 7 * cell); ctx.setLineDash([]); ctx.lineWidth = 1;
    // 색 범례
    if (THUMB) return;
    const y0 = pad + side + 10, x0 = pad + 44, bw = side - 108, xb = x0 + bw * (0.1 / 1.5);
    for (let k = 0; k < bw; k++) { const [r, g, b] = heat(0.9 + (1.5 * k) / bw); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(x0 + k, y0, 1.5, 10); }
    ctx.strokeStyle = 'rgba(30,40,70,.6)'; ctx.beginPath(); ctx.moveTo(xb, y0 - 2); ctx.lineTo(xb, y0 + 13); ctx.stroke(); // 소득 기준선 위치
    ctx.fillStyle = css('--muted'); ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'right'; ctx.fillText('싼 편', x0 - 6, y0 + 9); ctx.textAlign = 'left'; ctx.fillText('매우 비쌈', x0 + bw + 6, y0 + 9);
    ctx.textAlign = 'center'; ctx.fillText('소득 기준선', xb, y0 + 25);
    const s = sim.history[sim.history.length - 1];
    $('when').textContent = `${sim.step}분기째 · 평균 가격지수 ${s.mean.toFixed(0)}`;
  }

  function drawPrice() {
    const c = L.chart($('c-price'), 0.7), { ctx, m, pw, ph } = c, T = sim.params.steps, H = sim.history;
    const hi = Math.max(250, ...H.map((d) => Math.max(d.mean, d.ceil))) * 1.05, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (v / hi) * ph;
    const xt = []; for (let t = 0; t <= T; t += T / 4) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 100, 200, 300, 400].filter((v) => v <= hi), yFmt: (v) => String(v), xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '시간 (분기)', yLabel: '가격지수' });
    ctx.setLineDash([5, 3]); L.line(ctx, H.map((d, t) => [X(t), Y(d.income)]), '#8a93a6', 2);
    L.line(ctx, H.map((d, t) => [X(t), Y(d.ceil)]), css('--rich'), 2); ctx.setLineDash([]);
    L.line(ctx, H.map((d, t) => [X(t), Y(d.mean)]), css('--accent'), 3);
    const last = H.length - 1; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(H[last].mean), 4.5, 0, 7); ctx.fill();
    if (sim.params.rateStep > 0) L.vline(c, X(sim.params.rateStep), css('--unlucky'), '금리 충격', sim.params.rateStep > T * 0.6 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '평균 가격지수' }, { kind: 'dash', color: '#8a93a6', label: '소득 기준선' }, { kind: 'dash', color: css('--rich'), label: '감당 상한' }], 'tl');
  }

  function drawHot() {
    const c = L.chart($('c-hot'), 0.7), { ctx, m, pw, ph } = c, T = sim.params.steps, H = sim.history;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 4) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '시간 (분기)', yLabel: '비율 (%)' });
    L.line(ctx, H.map((d, t) => [X(t), Y(d.cv)]), '#8a93a6', 2.5);
    L.line(ctx, H.map((d, t) => [X(t), Y(d.hot)]), css('--unlucky'), 2.5);
    if (sim.params.rateStep > 0) L.vline(c, X(sim.params.rateStep), css('--unlucky'), '금리 충격', sim.params.rateStep > T * 0.6 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: css('--unlucky'), label: '고평가 동네 비율' }, { kind: 'line', color: '#8a93a6', label: '동네 간 가격 격차' }], 'tl');
  }

  function drawSweep() {
    L.dots($('c-sweep'), {
      data: sweepRows.map((d) => ({ x: d.x, runs: d.cur, mean: L.mean(d.cur) })),
      series: [{ data: sweepRows.map((d) => ({ x: d.x, runs: d.strict, mean: L.mean(d.strict) })), color: css('--lucky'), dots: true }],
      x0: 0, x1: 1, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], xFmt: (v) => v.toFixed(1), xLabel: '가격 전염의 세기', yLabel: '최대 고평가 비율 (%)', marker: { x: sim.params.contagion },
      legend: [{ kind: 'dot', color: css('--accent'), label: '지금 설정의 대출 한도' }, { kind: 'dot', color: css('--lucky'), label: '대출 한도 40%' }], legendPos: 'tl',
    });
  }

  function renderStats() {
    const H = sim.history, s = H[H.length - 1], peak = sim.peak, drop = 1 - s.mean / peak;
    const cards = [
      ['평균 가격지수', s.mean.toFixed(0), '시작은 100'],
      ['소득 기준선', s.income.toFixed(0), '소득이 천천히 늘어난 만큼'],
      ['고평가 동네 비율', pct(s.hot), '소득 기준선보다 30% 넘게 비싼 동네'],
      ['동네 간 가격 격차', pct(s.cv), '표준편차 ÷ 평균'],
      ['정점 대비', sim.step && drop > 0.005 ? '-' + pct(drop) : '정점', `정점 평균 ${peak.toFixed(0)}`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawMap(); drawPrice(); drawHot(); }

  function after() {
    const P = params(); sweepRows = []; drawSweep(); $('note-sweep').textContent = '계산 중…';
    const jobs = [];
    for (let c = 0; c <= 10; c++) jobs.push(() => {
      const base = Object.assign({}, P, { contagion: c / 10, rateStep: 0 });
      const cur = AP.summarize(base, 5).map((r) => r.peakHot), strict = AP.summarize(Object.assign({}, base, { ltv: 0.4 }), 5).map((r) => r.peakHot);
      sweepRows.push({ x: c / 10, cur, strict });
    });
    L.jobs(jobs, drawSweep, () => { $('note-sweep').textContent = '금리 충격 없이 계산한 결과입니다.'; });
  }

  const h = L.harness({
    controls: ['contagion', 'ltv', 'optimism', 'rateStep'],
    format: { contagion: (v) => Number(v).toFixed(2), ltv: (v) => v + '%', optimism: (v) => v + '%', rateStep: () => '' },
    defaults: { contagion: 0.6, ltv: 60, optimism: 50, rateStep: '50' },
    build() { sim = AP.create(params()); if (THUMB) for (let k = 0; k < 20; k++) sim.advance(); }, // 썸네일: 가운데서 시작된 상승이 번져 나가는 중
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '시장 번호',
  });
  seedGetter = h.seed;
})();
