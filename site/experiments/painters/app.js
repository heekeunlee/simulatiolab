(function () {
  'use strict';
  const PA = window.Painters, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, rows = [];
  let seedGetter = () => 1;
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 화풍이 어느 정도 수렴한 장면으로 바로 간다
  const params = () => ({
    seed: seedGetter(), copy: Number($('copy').value) / 100, bias: Number($('bias').value) / 100,
    originality: Number($('originality').value) / 100,
  });
  const hsl = (h, s, l, a) => `hsla(${Math.round(h * 360)},${Math.round(s * 100)}%,${Math.round(l * 100)}%,${a == null ? 1 : a})`;

  // 화풍으로 작은 추상화를 그린다: 색조=팔레트, 붓 크기=도형 크기, 복잡도=도형 수, 각진 정도=사각형/붓질 비율
  function paint(ctx, x, y, w, i, st) {
    const [h, size, comp, ang] = st;
    ctx.fillStyle = hsl(h, 0.35, 0.93); ctx.fillRect(x, y, w, w);
    let a = (i * 2654435761 + 12345) >>> 0;
    const r = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
    const k = 3 + Math.round(comp * 8);
    for (let s = 0; s < k; s++) {
      const px = x + r() * w, py = y + r() * w, sz = w * (0.08 + size * 0.28) * (0.6 + r() * 0.8);
      const hue = s % 4 === 3 ? h + 0.5 : h + (r() - 0.5) * 0.12, sat = 0.55 + r() * 0.35, lig = 0.35 + r() * 0.3;
      ctx.fillStyle = hsl(hue, sat, lig, 0.85);
      if (r() < ang) {
        if (r() < 0.5) ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz * (0.5 + r()));
        else { ctx.save(); ctx.translate(px, py); ctx.rotate((r() - 0.5) * 2); ctx.fillRect(-sz, -sz * 0.12, sz * 2, sz * 0.24); ctx.restore(); }
      } else { ctx.beginPath(); ctx.arc(px, py, sz / 2, 0, 7); ctx.fill(); }
    }
  }

  function drawGallery() {
    const { ctx, w } = L.setup($('c-gallery'), 1);
    ctx.fillStyle = '#eef1f7'; ctx.fillRect(0, 0, w, w);
    const G = 10, gap = 4, tile = (w - gap * (G + 1)) / G;
    const m = sim.metrics();
    for (let i = 0; i < sim.n; i++) {
      const x = gap + (i % G) * (tile + gap), y = gap + Math.floor(i / G) * (tile + gap);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, tile, tile); ctx.clip();
      paint(ctx, x, y, tile, i, sim.style[i]);
      ctx.restore();
      if (i === m.top) { ctx.strokeStyle = '#d19200'; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, tile, tile); }
      else if (sim.act[i] === 2 && !THUMB) { // 혁신한 화가: 테두리 대신 모서리의 초록 점 (테두리는 40장이 한꺼번에 깜빡여 그림을 가렸다)
        const r = Math.max(3, tile * 0.07); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + tile - r - 2, y + r + 2, r + 1.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#1fa463'; ctx.beginPath(); ctx.arc(x + tile - r - 2, y + r + 2, r, 0, 7); ctx.fill();
      }
    }
    ctx.lineWidth = 1;
    $('when').textContent = `${sim.round}/${sim.params.rounds} 라운드 · 화풍 쏠림 ${pct(sim.history[sim.history.length - 1].concentration)}`;
  }

  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.rounds;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => v.toFixed(2), xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '시간 (라운드)', yLabel: '정도 (0~1)' });
    L.line(ctx, H.map((v, t) => [X(t), Y(v.concentration)]), css('--rich'), 2.5);
    L.line(ctx, H.map((v, t) => [X(t), Y(v.diversity)]), css('--accent'), 2.5);
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '다양성' }, { kind: 'line', color: css('--rich'), label: '화풍 쏠림' }], 'tl');
  }

  function drawMap() {
    const litems = [{ kind: 'dot', color: '#8a93a6', label: '화가 한 명 (클수록 인기)' }, { kind: 'dot', color: '#d19200', label: '가장 인기 있는 화풍(금색 원)' }];
    const sp = L.belowSpace($('c-map'), litems);
    const c = L.chart($('c-map'), 0.85 + sp.extra / ($('c-map').clientWidth || 400), { l: 40, b: sp.b }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - v * ph, tk = [0, 0.25, 0.5, 0.75, 1];
    L.axes(c, { X, Y, yTicks: tk, yFmt: pct, xTicks: [0, 0.25, 0.5, 0.75, 1], xFmt: (v) => Math.round(v * 360) + '°', xLabel: '색조 (도)', yLabel: '복잡도 (%)' });
    const mt = sim.metrics();
    for (let i = 0; i < sim.n; i++) {
      const st = sim.style[i], r = 3.5 + Math.min(6, sim.pop[i] * 0.6);
      ctx.fillStyle = hsl(st[0], 0.7, 0.5, 0.55); ctx.beginPath(); ctx.arc(X(st[0]), Y(st[2]), r, 0, 7); ctx.fill();
    }
    const t = sim.style[mt.top]; ctx.strokeStyle = '#d19200'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(t[0]), Y(t[2]), 12, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    L.drawLegendBelow(c, litems);
  }

  function drawSweep() {
    const mk = (key, src) => rows.map((d) => ({ x: d.x, runs: d[src].map((r) => r[key]), mean: L.mean(d[src].map((r) => r[key])) }));
    L.dots($('c-sweep'), {
      data: mk('diversity', 'cur'),
      series: [{ data: mk('concentration', 'cur'), color: css('--rich'), dots: true }, { data: mk('diversity', 'nob'), color: '#8a93a6' }],
      x0: 0, x1: 1, y0: 0, y1: 1, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], xFmt: pct, yFmt: (v) => v.toFixed(2), xLabel: '따라 그리는 비율 (%)', yLabel: '정도 (0~1)', marker: { x: sim.params.copy }, legend: [{ kind: 'line', color: css('--accent'), label: '다양성' }, { kind: 'line', color: css('--rich'), label: '화풍 쏠림' }, { kind: 'line', color: '#8a93a6', label: '인기 편향이 없을 때의 다양성' }], legendPos: 'tl',
    });
  }

  function renderStats() {
    const H = sim.history, now = H[H.length - 1], a = sim.act;
    let cp = 0, inn = 0; for (let i = 0; i < sim.n; i++) { if (a[i] === 1) cp++; else if (a[i] === 2) inn++; }
    const cards = [
      ['지금 다양성', now.diversity.toFixed(2), `처음 ${H[0].diversity.toFixed(2)} (최대 1)`],
      ['화풍 쏠림', pct(now.concentration), '가장 인기 있는 화풍과 비슷한 화가'],
      ['이번 라운드 따라 그림', cp + '명', '다른 화가의 화풍을 따라간 사람'],
      ['이번 라운드 혁신', inn + '명', '새 화풍을 시도한 사람'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawGallery(); drawTime(); drawMap(); }

  function after() {
    const P = params(); rows = []; drawSweep();
    const jobs = [];
    for (let c = 0; c <= 10; c++) jobs.push(() => {
      const o = Object.assign({}, P, { copy: c / 10, rounds: 80 });
      rows.push({ x: c / 10, cur: PA.final(o, 4), nob: PA.final(Object.assign({}, o, { bias: 0 }), 4) });
    });
    L.jobs(jobs, drawSweep);
  }

  const h = L.harness({
    controls: ['copy', 'bias', 'originality'],
    format: { copy: (v) => v + '%', bias: (v) => v + '%', originality: (v) => v + '%' },
    defaults: { copy: 60, bias: 50, originality: 40 },
    build() { sim = PA.create(params()); if (THUMB) for (let k = 0; k < 90; k++) sim.advance(); },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '화단 번호',
  });
  seedGetter = h.seed;
})();
