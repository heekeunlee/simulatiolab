(function () {
  'use strict';
  const QU = window.Queue, L = window.Lab;
  const { css, mix, pct, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 초록(눈총)이 빨강(새치기)을 밀어내는 한가운데 장면
  const COL = ['#3b82f6', '#e5484d', '#1fa463'];
  const NAME = ['질서', '새치기', '눈총'];
  let sim = null, pRows = [], iRows = [];
  let seedGetter = () => 1;
  const params = () => ({
    seed: seedGetter(), rounds: 100,
    gain: Number($('gain').value) / 100, punish: Number($('punish').value) / 100, cost: Number($('cost').value) / 100,
    cutters: Number($('cutters').value) / 100, punishers: Number($('punishers').value) / 100,
  });

  // 칸 모양(둥근 사각형)을 색마다 한 번만 그려 두고 찍는다 (2,500칸을 매번 경로로 그리면 느린 기기가 있음)
  let sprites = null, spriteKey = '';
  function cellSprites(c, dpr) {
    const key = c.toFixed(3) + '|' + dpr;
    if (sprites && spriteKey === key) return sprites;
    const px = Math.max(1, Math.round(c * dpr)), gap = Math.max(0.6, c * 0.12) * dpr;
    sprites = COL.map((col) => {
      const o = document.createElement('canvas'); o.width = o.height = px; const x = o.getContext('2d');
      x.fillStyle = col; roundRect(x, gap / 2, gap / 2, px - gap, px - gap, (px - gap) * 0.32); x.fill(); return o;
    });
    spriteKey = key; return sprites;
  }
  function drawGrid() {
    const { ctx, w } = L.setup($('c-grid'), 1), dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#f1f4fa'; ctx.fillRect(0, 0, w, w);
    const S = sim.size, c = w / S, sp = cellSprites(c, dpr);
    for (let i = 0; i < S * S; i++) ctx.drawImage(sp[sim.grid[i]], (i % S) * c, Math.floor(i / S) * c, c, c);
    const s = sim.shares();
    $('when').textContent = `${sim.round}/${sim.params.rounds} 라운드 · 새치기 ${pct(s[1])}`;
  }

  function drawArea() {
    const c = L.chart($('c-area'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.rounds;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '라운드' });
    const acc = H.map(() => 0);
    [0, 2, 1].forEach((k) => {
      ctx.fillStyle = COL[k]; ctx.beginPath();
      H.forEach((s, t) => ctx.lineTo(X(t), Y(acc[t] + s[k])));
      for (let t = H.length - 1; t >= 0; t--) ctx.lineTo(X(t), Y(acc[t]));
      ctx.closePath(); ctx.fill(); H.forEach((s, t) => { acc[t] += s[k]; });
    });
  }

  const sweepOpts = (key, label, xs, xFmt, cur) => ({
    x0: xs[0], x1: xs[xs.length - 1], xTicks: xs.filter((_, i) => i % Math.ceil(xs.length / 7) === 0), xFmt, xLabel: label, marker: { x: cur },
  });
  function drawP() {
    const xs = []; for (let v = 0; v <= 200; v += 20) xs.push(v / 100);
    L.dots($('c-p'), Object.assign({ data: pRows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })) }, sweepOpts('p', '눈총의 효과 (새치기 이득과 비교)', xs, (v) => v.toFixed(1), sim.params.punish)));
  }
  function drawI() {
    const xs = []; for (let v = 0; v <= 40; v += 5) xs.push(v / 100);
    L.dots($('c-i'), Object.assign({ data: iRows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })) }, sweepOpts('i', '처음에 눈총형이던 사람의 비율', xs, pct, sim.params.punishers)));
  }

  function renderStats() {
    const s = sim.shares(), peak = Math.max(...sim.history.map((x) => x[1]));
    const cards = [
      ['질서', pct(s[0]), '가만히 줄 서는 사람'], ['새치기', pct(s[1]), `가장 많았을 때 ${pct(peak)}`],
      ['눈총', pct(s[2]), '새치기를 응징하는 사람'], ['라운드', sim.round + '회', sim.done ? '끝' : '진행 중'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t], i) => `<div class="stat"><div class="k"${i < 3 ? ` style="color:${COL[i]}"` : ''}>${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawGrid(); drawArea(); }

  function after() {
    const P = params(); pRows = []; iRows = []; drawP(); drawI();
    $('note-p').textContent = '계산 중…'; $('note-i').textContent = '계산 중…';
    const jobs = [];
    for (let v = 0; v <= 200; v += 20) jobs.push(() => { pRows.push({ x: v / 100, runs: QU.final(Object.assign({}, P, { punish: v / 100 }), 5).map((s) => s[1]) }); });
    for (let v = 0; v <= 40; v += 5) jobs.push(() => { iRows.push({ x: v / 100, runs: QU.final(Object.assign({}, P, { punishers: v / 100 }), 5).map((s) => s[1]) }); });
    L.jobs(jobs, () => { drawP(); drawI(); }, () => {
      $('note-p').textContent = '세로축은 100라운드 뒤 새치기의 비율입니다. 눈총의 효과가 새치기 이득을 넘어서면 새치기가 사라집니다';
      $('note-i').textContent = '눈총형이 처음에 일정 비율을 넘지 못하면 새치기가 판을 차지합니다';
    });
  }

  const h = L.harness({
    controls: ['gain', 'punish', 'cost', 'cutters', 'punishers'],
    format: { gain: (v) => (v / 100).toFixed(1), punish: (v) => (v / 100).toFixed(1), cost: (v) => (v / 100).toFixed(1), cutters: (v) => v + '%', punishers: (v) => v + '%' },
    defaults: { gain: 50, punish: 100, cost: 20, cutters: 20, punishers: 20 },
    build() { sim = QU.create(params()); if (THUMB) for (let k = 0; k < 10; k++) sim.advance(); },
    autoplay: !THUMB, speedScale: 0.25, // 이야기가 처음 20라운드 안에 다 일어나서, 보통 속도를 초당 약 2라운드로
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawP(); drawI(); }, seedLabel: '줄 번호',
  });
  seedGetter = h.seed;
})();
