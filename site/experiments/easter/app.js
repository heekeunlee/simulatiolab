(function () {
  'use strict';
  const ES = window.Easter, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, sw = { growth: [], regrowth: [], cons: [] };
  let seedGetter = () => 1;
  const params = () => ({
    regrowth: Number($('regrowth').value) / 100, growth: Number($('growth').value) / 100, delay: Number($('delay').value),
    harvest: Number($('harvest').value) * 1e-6, conservation: Number($('conservation').value) / 100,
  });
  const fmt = (v) => Math.round(v).toLocaleString('ko-KR');
  const OUT = { stable: '안정', decline: '크게 감소', collapse: '붕괴' };

  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SITES = (function () { const r = mulberry(5), a = []; while (a.length < 280) { const x = r() * 2 - 1, y = r() * 2 - 1; if (x * x + y * y <= 0.9) a.push({ x, y, u: r() }); } return a; })();
  const FOLK = (function () { const r = mulberry(9), a = []; while (a.length < 260) { const x = r() * 2 - 1, y = r() * 2 - 1; if (x * x + y * y <= 0.85) a.push({ x, y }); } return a; })();

  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  const ticks = (max) => [0, 1, 2, 3, 4].map((i) => (max * i) / 4);

  function drawIsland() {
    const c = L.chart($('c-island'), 0.62, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c, cur = sim.current();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#dcecff'); g.addColorStop(1, '#eef6ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, rx = w * 0.36, ry = h * 0.36;
    const shape = (k) => { ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * 6.2832, r = k * (1 + 0.08 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a)); const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
    shape(1.1); ctx.fillStyle = '#f6e7bf'; ctx.fill();
    shape(1); ctx.fillStyle = '#e6edc9'; ctx.fill();
    // 숲: 남은 비율만큼 나무가 서 있다. 베어진 자리는 밑동으로 표시
    SITES.forEach((s) => {
      const x = cx + s.x * rx * 0.95, y = cy + s.y * ry * 0.95;
      if (s.u < cur.R) { ctx.fillStyle = '#2f8f4e'; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill(); ctx.fillStyle = '#4fb06b'; ctx.beginPath(); ctx.arc(x - 0.8, y - 0.8, 1.7, 0, 7); ctx.fill(); }
      else if (cur.R < 0.995) { ctx.fillStyle = 'rgba(150,110,70,.45)'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill(); }
    });
    // 사람: 점 하나가 scale명
    const scale = Math.max(10, (sim.Pstar * 3) / 260), k = Math.min(FOLK.length, Math.ceil(cur.P / scale));
    for (let i = 0; i < k; i++) { const f = FOLK[i]; ctx.fillStyle = '#1e2a78'; ctx.beginPath(); ctx.arc(cx + f.x * rx * 0.95, cy + f.y * ry * 0.95, 2.6, 0, 7); ctx.fill(); }
    ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.font = '700 28px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(`${sim.year()}년`, 16, 40);
    ctx.font = '12.5px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
    ctx.fillText(`인구 ${fmt(cur.P)}명 · 숲 ${pct(cur.R)}`, 16, 60);
    ctx.textAlign = 'right'; ctx.fillText(`점 하나 ≈ ${fmt(scale)}명`, w - 14, h - 12);
    $('when').textContent = `${sim.year()}년째 · 인구 ${fmt(cur.P)}명 · 숲 ${pct(cur.R)}`;
  }

  function drawTime() {
    const c = L.chart($('c-time'), 0.7, { r: 44 }), { ctx, m, pw, ph } = c, T = sim.years;
    const pmax = niceMax(Math.max(...sim.P, sim.Pstar * 1.1)), X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (v / pmax) * ph, YR = (v) => m.t + ph - v * ph;
    const xt = []; for (let t = 0; t <= T; t += T / 6) xt.push(t);
    L.axes(c, { X, Y, yTicks: ticks(pmax), yFmt: (v) => fmt(v), xTicks: xt, xFmt: (t) => Math.round(t) + '년', xLabel: '경과 시간' });
    ctx.fillStyle = '#2f8f4e'; ctx.textAlign = 'left'; [0, 0.5, 1].forEach((v) => ctx.fillText(pct(v), m.l + pw + 6, YR(v) + 4));
    const step = sim.params.yearsPerStep;
    L.line(ctx, sim.R.map((v, i) => [X(i * step), YR(v)]), '#2f8f4e', 2.5);
    L.line(ctx, sim.P.map((v, i) => [X(i * step), Y(v)]), css('--accent'), 2.5);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(sim.Pstar)); ctx.lineTo(m.l + pw, Y(sim.Pstar)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('균형 인구', m.l + 6, Y(sim.Pstar) - 6);
    const pk = sim.peakP; if (pk > sim.params.p0 * 1.5) { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(sim.peakYear), Y(pk), 4.5, 0, 7); ctx.fill(); ctx.textAlign = 'center'; ctx.fillText('최고점', X(sim.peakYear), Y(pk) - 9); }
  }

  function drawPhase() {
    const c = L.chart($('c-phase'), 0.85, { l: 56, b: 40 }), { ctx, m, pw, ph } = c, p = sim.params;
    const pmax = niceMax(Math.max(...sim.P, sim.Pstar * 1.2)), X = (v) => m.l + v * pw, Y = (v) => m.t + ph - (Math.min(v, pmax) / pmax) * ph;
    L.axes(c, { X, Y, yTicks: ticks(pmax), yFmt: (v) => fmt(v), xTicks: [0, 0.25, 0.5, 0.75, 1], xFmt: pct, xLabel: '남은 숲의 비율' });
    ctx.setLineDash([5, 3]); ctx.lineWidth = 1.4;
    ctx.strokeStyle = css('--accent'); ctx.beginPath(); ctx.moveTo(X(sim.Rstar), m.t); ctx.lineTo(X(sim.Rstar), m.t + ph); ctx.stroke();
    ctx.strokeStyle = '#2f8f4e'; ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const R = i / 60, P = (p.regrowth * (1 - R)) / (p.harvest * (1 - p.conservation)); const x = X(R), y = Y(P); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = css('--accent'); ctx.textAlign = 'left'; ctx.fillText('인구가 늘지도 줄지도 않는 선', X(sim.Rstar) + 5, m.t + 12);
    ctx.fillStyle = '#2f8f4e'; ctx.fillText('숲이 늘지도 줄지도 않는 선', X(0.08), Y((p.regrowth * 0.9) / (p.harvest * (1 - p.conservation))) - 8);
    const n = sim.P.length;
    for (let i = 1; i < n; i++) { const t = i / Math.max(1, n - 1); ctx.strokeStyle = `rgb(${Math.round(47 + 182 * t)},${Math.round(111 - 39 * t)},${Math.round(237 - 160 * t)})`; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(X(sim.R[i - 1]), Y(sim.P[i - 1])); ctx.lineTo(X(sim.R[i]), Y(sim.P[i])); ctx.stroke(); }
    ctx.lineWidth = 1;
    ctx.fillStyle = '#1fa463'; ctx.beginPath(); ctx.arc(X(1), Y(sim.P[0]), 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = css('--unlucky'); ctx.beginPath(); ctx.arc(X(sim.R[n - 1]), Y(sim.P[n - 1]), 5, 0, 7); ctx.fill();
    ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText('✕', X(sim.Rstar), Y(sim.Pstar) + 4);
  }

  const noMark = (x) => ({ x, label: '지금 설정' });
  function drawSweepA() {
    L.dots($('c-growth'), {
      data: sw.growth.map((d) => ({ x: d.x, runs: [], mean: d.ratio })),
      series: [{ data: sw.growth.map((d) => ({ x: d.x, runs: [], mean: d.minR })), color: '#2f8f4e' }],
      x0: 0.035, x1: 0.1, xTicks: [0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1], xFmt: pct, xLabel: '인구가 늘어나는 속도 (숲이 온전할 때, 1년당)', marker: noMark(sim.params.growth),
    });
  }
  function drawSweepB() {
    L.dots($('c-regrow'), {
      data: sw.regrowth.map((d) => ({ x: d.x, runs: [], mean: d.ratio })),
      series: [{ data: sw.regrowth.map((d) => ({ x: d.x, runs: [], mean: d.minR })), color: '#2f8f4e' }],
      x0: 0.005, x1: 0.08, xTicks: [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08], xFmt: pct, xLabel: '숲이 다시 자라는 속도 (1년당)', marker: noMark(sim.params.regrowth),
    });
  }
  function drawSweepC() {
    const mx = niceMax(Math.max(1, ...sw.cons.map((d) => d.peak)));
    L.dots($('c-cons'), {
      data: sw.cons.map((d) => ({ x: d.x, runs: [], mean: d.peak })),
      series: [{ data: sw.cons.map((d) => ({ x: d.x, runs: [], mean: d.final })), color: '#e0a100' }],
      x0: 0, x1: 0.8, y0: 0, y1: mx, yFmt: (v) => fmt(v), xTicks: [0, 0.2, 0.4, 0.6, 0.8], xFmt: pct, xLabel: '벌채를 줄인 비율 (보존)', marker: noMark(sim.params.conservation),
    });
  }
  const sweeps = () => { drawSweepA(); drawSweepB(); drawSweepC(); };

  function renderStats() {
    const cur = sim.current(), s = sim.summary();
    const done = sim.done;
    const cards = [
      ['경과 시간', `${sim.year()}년`, done ? '끝' : '진행 중'],
      ['지금 인구', `${fmt(cur.P)}명`, `최고 ${fmt(sim.peakP)}명 (${Math.round(sim.peakYear)}년)`],
      ['남은 숲', pct(cur.R), `가장 줄었을 때 ${pct(sim.minR)}`],
      ['최고점 대비 지금 인구', pct(s.ratio), '70% 이상이면 안정, 25% 미만이면 붕괴로 봐요'],
      ['결과', done ? OUT[s.outcome] : '진행 중', done ? (sim.extinct ? '인구가 사라졌어요' : '600년이 지난 시점') : '600년까지 지켜봐요'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawIsland(); drawTime(); drawPhase(); }

  function after() {
    const P = params(); sw = { growth: [], regrowth: [], cons: [] }; sweeps();
    ['note-growth', 'note-regrow', 'note-cons'].forEach((id) => { $(id).textContent = '계산 중…'; });
    const jobs = [];
    for (let g = 35; g <= 100; g += 5) jobs.push(() => { const s = ES.outcomeOf(Object.assign({}, P, { growth: g / 1000 })); sw.growth.push({ x: g / 1000, ratio: s.ratio, minR: s.minR }); });
    [5, 10, 15, 20, 30, 40, 50, 60, 70, 80].forEach((r) => jobs.push(() => { const s = ES.outcomeOf(Object.assign({}, P, { regrowth: r / 1000 })); sw.regrowth.push({ x: r / 1000, ratio: s.ratio, minR: s.minR }); }));
    for (let c = 0; c <= 80; c += 10) jobs.push(() => { const s = ES.outcomeOf(Object.assign({}, P, { conservation: c / 100 })); sw.cons.push({ x: c / 100, peak: s.peak, final: s.final }); });
    L.jobs(jobs, sweeps, () => {
      $('note-growth').textContent = '파랑: 마지막 인구 ÷ 최고 인구 (1이면 줄지 않음), 초록: 숲이 가장 줄었을 때 남은 비율';
      $('note-regrow').textContent = '파랑: 마지막 인구 ÷ 최고 인구, 초록: 숲이 가장 줄었을 때 남은 비율';
      $('note-cons').textContent = '파랑: 최고 인구(명), 금색: 600년째 인구(명)';
    });
  }

  const h = L.harness({
    controls: ['regrowth', 'growth', 'delay', 'harvest', 'conservation'],
    format: { regrowth: (v) => Number(v).toFixed(1) + '%', growth: (v) => Number(v).toFixed(1) + '%', delay: (v) => v + '년', harvest: (v) => v, conservation: (v) => v + '%' },
    defaults: { regrowth: 1, growth: 5, delay: 30, harvest: 2, conservation: 0 },
    build() { sim = ES.create(params()); },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: sweeps, seedLabel: '재생',
  });
  seedGetter = h.seed;
})();
