(function () {
  'use strict';
  const AL = window.Alliance, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  const RED = '#e5484d', BLUE = '#2f6fed', NEUTRAL = '#e9edf5';
  let sim = null, hist = null, swA = [], swC = [];
  let seedGetter = () => 1;
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 썸네일용: 전쟁이 크게 번진 세계(#2)를 끝까지 돌린 장면
  const params = () => ({ seed: THUMB ? 2 : seedGetter(), structure: $('structure').value, allies: Number($('allies').value) / 10, commit: Number($('commit').value) / 100 });
  const name = (i) => String.fromCharCode(65 + i);
  const kind = (size, n) => (size <= 4 ? 'small' : size >= n / 2 ? 'world' : 'mid');
  const KIND = { small: '작게 끝남', mid: '여러 나라로 번짐', world: '세계대전급' };

  function layout(w, h) {
    const n = sim.n, pts = [], s = sim.params.structure;
    if (s === 'blocs') {
      const R = Math.min(w * 0.2, h * 0.36), half = n / 2;
      for (let i = 0; i < n; i++) { const k = i % half, c = i < half ? w * 0.27 : w * 0.73, a = (k / half) * 6.2832 - 1.5708; pts.push([c + Math.cos(a) * R, h / 2 + Math.sin(a) * R]); }
    } else {
      const order = [], seen = new Set();
      for (let i = 0; i < n; i++) { if (seen.has(i)) continue; seen.add(i); order.push(i); sim.adj[i].forEach((j) => { if (!seen.has(j) && s === 'pairs') { seen.add(j); order.push(j); } }); }
      const R = Math.min(w, h) * 0.4;
      order.forEach((id, k) => { const a = (k / n) * 6.2832 - 1.5708; pts[id] = [w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R]; });
    }
    return pts;
  }

  function drawNet() {
    const narrow = ($('c-net').clientWidth || 400) < 560;
    const c = L.chart($('c-net'), THUMB || narrow ? 1 : 0.66, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c, pts = layout(w, h), side = sim.side, k = THUMB ? w / 360 : 1;   // 썸네일은 굵고 크게
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    sim.edges().forEach(([i, j]) => {
      const same = side[i] && side[i] === side[j], opp = side[i] && side[j] && side[i] !== side[j];
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]);
      if (same) { ctx.strokeStyle = side[i] === 1 ? RED : BLUE; ctx.lineWidth = 2.4 * k; ctx.setLineDash([]); }
      else if (opp) { ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2 * k; ctx.setLineDash([5 * k, 4 * k]); }
      else { ctx.strokeStyle = '#b9c1d3'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([]); }
      ctx.stroke();
    });
    ctx.setLineDash([]); ctx.lineWidth = 1;
    for (let i = 0; i < sim.n; i++) {
      const [x, y] = pts[i], s = side[i], fresh = s && sim.joinedAt[i] === sim.round && sim.round > 0 && !sim.done;
      if (fresh) { ctx.fillStyle = mix(s === 1 ? RED : BLUE, 0.22); ctx.beginPath(); ctx.arc(x, y, 24 * k, 0, 7); ctx.fill(); }
      ctx.fillStyle = s === 1 ? RED : s === 2 ? BLUE : NEUTRAL; ctx.beginPath(); ctx.arc(x, y, 13 * k, 0, 7); ctx.fill();
      ctx.strokeStyle = (i === sim.attacker || i === sim.defender) ? '#1b1f2a' : (s ? '#fff' : '#c4cbdb'); ctx.lineWidth = (i === sim.attacker || i === sim.defender) ? 3 * k : 1.5 * k; ctx.stroke(); ctx.lineWidth = 1;
      if (THUMB) continue;
      ctx.fillStyle = s ? '#fff' : '#5a6275'; ctx.textAlign = 'center'; ctx.font = '700 12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(name(i), x, y + 4.2);
    }
    const cnt = sim.counts();
    $('when').textContent = `${sim.round}라운드 · 전쟁에 들어간 나라 ${sim.size()}개 (붉은 편 ${cnt.a}, 푸른 편 ${cnt.b})`;
    if (THUMB) return;
    const [ax, ay] = pts[sim.attacker], [dx, dy] = pts[sim.defender];
    ctx.font = '600 11.5px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = '#1b1f2a'; ctx.textAlign = 'center';
    // 이름표: 흰 바탕 위에 써서 옆 나라 글자와 겹쳐도 읽히게
    const tag = (txt, x, y) => { const ty = y + (y < h / 2 ? -22 : 30), tw = ctx.measureText(txt).width + 10;
      ctx.fillStyle = 'rgba(255,255,255,.92)'; L.roundRect(ctx, Math.max(2, Math.min(w - tw - 2, x - tw / 2)), ty - 12, tw, 17, 5); ctx.fill();
      ctx.fillStyle = '#1b1f2a'; ctx.fillText(txt, Math.max(2 + tw / 2, Math.min(w - tw / 2 - 2, x)), ty); };
    tag('첫 공격', ax, ay); tag('공격받음', dx, dy);
  }

  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = Math.max(H.length - 1, 6), n = sim.n;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (v / n) * ph, xt = []; for (let t = 0; t <= T; t += Math.max(1, Math.ceil(T / 6))) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 6, 12, 18, 24].map((v) => (v / 24) * n), yFmt: (v) => Math.round(v), xTicks: xt, xFmt: (t) => String(t), xLabel: '라운드' });
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(n / 2)); ctx.lineTo(m.l + pw, Y(n / 2)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('절반', m.l + 6, Y(n / 2) - 6);
    L.line(ctx, H.map((v, t) => [X(t), Y(v.a + v.b)]), '#1b1f2a', 2.5);
    L.line(ctx, H.map((v, t) => [X(t), Y(v.a)]), RED, 2);
    L.line(ctx, H.map((v, t) => [X(t), Y(v.b)]), BLUE, 2);
  }

  function drawHist() {
    const n = sim.n, c = L.chart($('c-hist'), 0.7, { l: 44, b: 40 }), { ctx, m, pw, ph } = c;
    const counts = new Array(n + 1).fill(0); (hist || []).forEach((s) => { counts[s]++; });
    const total = (hist || []).length || 1, cmax = Math.max(1, ...counts), top = niceMax(cmax / total);
    const X = (s) => m.l + ((s - 2) / (n - 1)) * pw, Y = (v) => m.t + ph - (v / top) * ph;
    L.axes(c, { X, Y, yTicks: [0, 1, 2, 3, 4].map((i) => (top * i) / 4), yFmt: pct, xTicks: [2, 6, 12, 18, 24].filter((t) => t <= n), xFmt: (t) => String(t), xLabel: '전쟁에 들어간 나라 수' });
    const bw = pw / (n - 1) * 0.8;
    for (let s = 2; s <= n; s++) {
      const v = counts[s] / total; if (!v) continue;
      ctx.fillStyle = s <= 4 ? '#9aa8c7' : s >= n / 2 ? RED : '#f59e42';
      ctx.fillRect(X(s) - bw / 2, Y(v), bw, m.t + ph - Y(v));
    }
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(X(n / 2 - 0.5), m.t); ctx.lineTo(X(n / 2 - 0.5), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
  }
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 0.01)))); const r = v / p; return Math.min(1, (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p); }

  function drawSweepA() {
    L.dots($('c-allies'), {
      data: swA.map((d) => ({ x: d.x, runs: d.size, mean: L.mean(d.size) })),
      series: [{ data: swA.map((d) => ({ x: d.x, runs: d.world, mean: L.mean(d.world) })), color: RED, dots: true }],
      x0: 0, x1: 8, xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8], xFmt: (v) => v + '', xLabel: '나라마다 평균 동맹국 수 (무작위 동맹일 때)', marker: { x: sim.params.allies, label: '지금 설정' },
    });
  }
  function drawSweepC() {
    L.dots($('c-commit'), {
      data: swC.map((d) => ({ x: d.x, runs: d.size, mean: L.mean(d.size) })),
      series: [{ data: swC.map((d) => ({ x: d.x, runs: d.world, mean: L.mean(d.world) })), color: RED, dots: true }],
      x0: 0.1, x1: 1, xTicks: [0.1, 0.2, 0.4, 0.6, 0.8, 1], xFmt: pct, xLabel: '조약을 지킬 확률', marker: { x: sim.params.commit, label: '지금 설정' },
    });
  }
  const sweeps = () => { drawHist(); drawSweepA(); drawSweepC(); };

  function renderStats() {
    const s = sim.size(), cnt = sim.counts(), k = kind(s, sim.n), done = sim.done;
    const cards = [
      ['전쟁에 들어간 나라', `${s}개`, `전체 ${sim.n}개 중 ${pct(s / sim.n)}`],
      ['붉은 편 / 푸른 편', `${cnt.a} / ${cnt.b}`, '처음에는 1 / 1'],
      ['지난 라운드', `${sim.round}회`, done ? '끝' : '진행 중'],
      ['결과', done ? KIND[k] : '진행 중', done ? '4개국 이하는 작게 끝남, 절반 이상은 세계대전급' : '새로 들어가는 나라가 없으면 끝나요'],
    ];
    $('stats').innerHTML = cards.map(([a, v, t]) => `<div class="stat"><div class="k">${a}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawNet(); drawTime(); }

  function after() {
    const P = params(), base = { n: sim.n, structure: P.structure, allies: P.allies, commit: P.commit };
    hist = null; swA = []; swC = []; sweeps();
    ['note-hist', 'note-allies', 'note-commit'].forEach((id) => { $(id).textContent = '계산 중…'; });
    const jobs = [() => { hist = AL.sizes(base, 300, 100); }];
    for (let a = 0; a <= 16; a++) jobs.push(() => { const r = AL.summarize(Object.assign({}, base, { allies: a / 2 }), 6, 40, 500); swA.push({ x: a / 2, size: r.size, world: r.world }); });
    for (let c = 1; c <= 10; c++) jobs.push(() => { const r = AL.summarize(Object.assign({}, base, { commit: c / 10 }), 6, 40, 900); swC.push({ x: c / 10, size: r.size, world: r.world }); });
    L.jobs(jobs, sweeps, () => {
      const w = hist.filter((s) => s >= sim.n / 2).length / hist.length, sm = hist.filter((s) => s <= 4).length / hist.length;
      $('note-hist').textContent = `같은 설정의 세계 300개에서 세계대전급(절반 이상)은 ${pct(w)}, 작게 끝난 것(4개국 이하)은 ${pct(sm)}`;
      $('note-allies').textContent = '파랑: 전쟁에 들어간 나라의 평균 비율, 빨강: 세계대전급이 된 비율 (점은 6묶음의 결과)';
      $('note-commit').textContent = '파랑: 전쟁에 들어간 나라의 평균 비율, 빨강: 세계대전급이 된 비율 (점은 6묶음의 결과)';
    });
  }

  const h = L.harness({
    controls: ['structure', 'allies', 'commit'],
    format: { structure: () => '', allies: (v) => (Number(v) / 10).toFixed(1), commit: (v) => v + '%' },
    defaults: { structure: 'random', allies: 15, commit: 70 },
    build() { sim = AL.create(params()); if (THUMB) while (sim.advance() && sim.round < 60); },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: sweeps, seedLabel: '세계',
  });
  seedGetter = h.seed;
})();
