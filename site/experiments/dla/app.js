(function () {
  'use strict';
  const D = window.DLA, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 충분히 자란 모습에서 멈춘다
  const BG = '#0a0f1f';
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  let sim = null, off = null, offCtx = null, img = null, drawn = 0, cam = null, dim = null, dimAt = -1, sweep = [], seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), stick: Number($('stick').value), shape: $('shape').value, count: Number($('count').value) });
  const f2 = (v) => (isFinite(v) ? v.toFixed(2) : '–');

  // 붙은 순서 -> 색 (먼저 붙음: 금빛, 나중에 붙음: 하늘색)
  const STOPS = [[0, [255, 226, 122]], [0.25, [255, 138, 61]], [0.5, [230, 62, 138]], [0.75, [122, 77, 255]], [1, [53, 208, 255]]];
  const LUT = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0; while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
    const [t0, c0] = STOPS[k], [t1, c1] = STOPS[k + 1], u = (t - t0) / (t1 - t0);
    LUT.push(c0.map((v, j) => Math.round(v + (c1[j] - v) * u)));
  }
  const lutCss = (i) => `rgb(${LUT[i][0]},${LUT[i][1]},${LUT[i][2]})`;

  function prepare() {
    off = document.createElement('canvas'); off.width = off.height = D.N; offCtx = off.getContext('2d');
    img = offCtx.createImageData(D.N, D.N);
    const d = img.data, Nn = D.N;
    sim.seedCells.forEach(([x, y]) => { const o = (y * Nn + x) * 4; d[o] = 225; d[o + 1] = 232; d[o + 2] = 250; d[o + 3] = 255; });
    drawn = 0; dim = null; dimAt = -1; cam = null;
  }
  function paintNew() {
    const d = img.data, Nn = D.N, tot = sim.params.count;
    let ax0 = D.N, ay0 = D.N, ax1 = 0, ay1 = 0; const from = drawn;
    for (; drawn < sim.n; drawn++) {
      const px = sim.xs[drawn], py = sim.ys[drawn]; if (px < ax0) ax0 = px; if (px > ax1) ax1 = px; if (py < ay0) ay0 = py; if (py > ay1) ay1 = py;
      const c = LUT[Math.min(255, Math.floor((drawn / tot) * 255))], o = (sim.ys[drawn] * Nn + sim.xs[drawn]) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    if (from === 0) offCtx.putImageData(img, 0, 0);
    else if (drawn > from) offCtx.putImageData(img, 0, 0, ax0, ay0, ax1 - ax0 + 1, ay1 - ay0 + 1);
  }

  // ---------- ① 자라는 덩어리 ----------
  function drawCluster() {
    const cv = $('c-grow'), cw = cv.clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 1.0 : 0.62;
    const c = L.chart(cv, asp, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w, h } = c;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    paintNew();
    const bb = sim.bbox(), pad = 14, lv = sim.live();
    let x0 = bb[0] - pad, y0 = bb[1] - pad, x1 = bb[2] + pad, y1 = bb[3] + pad;
    const bw = x1 - x0, bh = y1 - y0, s = Math.min(w / bw, h / bh), tg = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s };
    if (!cam || THUMB) cam = tg; else cam = { cx: cam.cx + (tg.cx - cam.cx) * 0.18, cy: cam.cy + (tg.cy - cam.cy) * 0.18, s: cam.s + (tg.s - cam.s) * 0.18 };
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
    ctx.imageSmoothingEnabled = cam.s < 2.5;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(off, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (lv && !THUMB) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1 / cam.s; ctx.setLineDash([4 / cam.s, 6 / cam.s]);
      ctx.beginPath(); ctx.arc(D.C + 0.5, D.C + 0.5, lv.R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const tl = lv.trail;
      for (let i = 1; i < tl.length; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${(i / tl.length) * 0.75})`; ctx.lineWidth = 1.4 / cam.s;
        ctx.beginPath(); ctx.moveTo(tl[i - 1][0] + 0.5, tl[i - 1][1] + 0.5); ctx.lineTo(tl[i][0] + 0.5, tl[i][1] + 0.5); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(lv.x + 0.5, lv.y + 0.5, 6 / cam.s, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lv.x + 0.5, lv.y + 0.5, 2.6 / cam.s, 0, 7); ctx.fill();
    }
    ctx.restore();
    if (THUMB) return;
    ctx.font = '600 13px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#e8eefc';
    ctx.fillText(`붙은 입자 ${sim.n.toLocaleString('en-US')}개 · 반지름 ${Math.round(sim.rmax())}칸`, 12, 22);
    // 색 범례
    const lx = 12, ly = h - 26, lw = Math.min(160, w * 0.4);
    for (let i = 0; i < lw; i++) { ctx.fillStyle = lutCss(Math.round((i / lw) * 255)); ctx.fillRect(lx + i, ly, 1, 7); }
    ctx.font = '11px ' + FONT; ctx.fillStyle = '#9fb0d0'; ctx.fillText('먼저 붙음', lx, ly - 5);
    ctx.textAlign = 'right'; ctx.fillText('나중에 붙음', lx + lw, ly - 5);
    if (sim.capped) { ctx.textAlign = 'right'; ctx.fillStyle = '#ffd36e'; ctx.fillText('칸이 다 차서 여기서 멈춤', w - 12, 22); }
    ctx.textAlign = 'right'; ctx.fillStyle = '#9fb0d0'; ctx.fillText('떠도는 입자', w - 12, h - 12);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w - 12 - ctx.measureText(tr('떠도는 입자')).width - 9, h - 15, 3, 0, 7); ctx.fill();
  }

  // ---------- ② 질량-반지름 (로그-로그) ----------
  function drawMR() {
    const c = L.chart($('c-mr'), 0.72, { l: 52, r: 14, t: 16, b: 44 }), { ctx, m, pw, ph } = c;
    const d = dim;
    if (!d || !d.pts.length) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('입자가 더 모이면 그려집니다', c.w / 2, c.h / 2); return; }
    const rMax = Math.max(100, d.pts[d.pts.length - 1][0] * 1.1), mMax = Math.max(1000, d.pts[d.pts.length - 1][1] * 1.4);
    const lx0 = Math.log10(2.5), lx1 = Math.log10(rMax), ly0 = 0.5, ly1 = Math.log10(mMax);
    const X = (r) => m.l + ((Math.log10(r) - lx0) / (lx1 - lx0)) * pw, Y = (v) => m.t + ph - ((Math.log10(v) - ly0) / (ly1 - ly0)) * ph;
    const xt = [3, 10, 30, 100, 300].filter((v) => v <= rMax), yt = [10, 100, 1000, 10000, 100000].filter((v) => v <= mMax * 1.2);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => v.toLocaleString('en-US'), xTicks: xt, xFmt: String, xLabel: d.local ? '둘레 반지름 r (칸)' : '중심에서의 반지름 r (칸)' });
    // 기준선: 기울기 2 (꽉 찬 면), 기울기 1.71 (고전값)
    const [ra, ma] = d.pts[0];
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#8a93a6'; ctx.beginPath(); ctx.moveTo(X(ra), Y(ma)); ctx.lineTo(X(rMax), Y(ma * Math.pow(rMax / ra, 2))); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = '#8a93a6'; ctx.textAlign = 'left'; L.label(ctx, '기울기 2: 빈틈없이 꽉 찬 면', m.l + 8, m.t + 14, 'left');
    // 적합선
    const f = (r) => Math.pow(10, d.icpt + d.D * Math.log10(r));
    ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(d.lo), Y(f(d.lo))); ctx.lineTo(X(d.hi), Y(f(d.hi))); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#4c7cf0';
    d.pts.forEach(([r, mm]) => { ctx.beginPath(); ctx.arc(X(r), Y(mm), 3.2, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#e5484d'; ctx.textAlign = 'right';
    L.label(ctx, `잰 기울기 D = ${f2(d.D)}`, m.l + pw - 6, m.t + ph - 12, 'right');
  }

  // ---------- ③ 어디에 붙었나 ----------
  function drawLand() {
    const c = L.chart($('c-land'), 0.62, { l: 44, r: 12, t: 16, b: 44 }), { ctx, m, pw, ph } = c;
    const lan = sim.landing(300), mx = Math.max(0.2, ...lan.bins.map((v) => v / Math.max(1, lan.total))) * 1.1;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - (v / mx) * ph;
    const yt = []; for (let i = 0; i <= 4; i++) yt.push((mx * i) / 4);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => Math.round(v * 100) + '%', xTicks: [0, 0.25, 0.5, 0.75, 1], xFmt: (v) => Math.round(v * 100) + '%', xLabel: '중심에서 거리 ÷ 가장 먼 끝까지 거리' });
    const bw = pw / 20;
    lan.bins.forEach((v, i) => {
      const hh = (v / Math.max(1, lan.total)) / mx * ph, outer = i >= 14;
      ctx.fillStyle = outer ? '#e5484d' : '#4c7cf0'; ctx.fillRect(m.l + i * bw + 1, m.t + ph - hh, bw - 2, hh);
    });
    if (sim.n >= 40) {
      const top = lan.bins.slice(14).reduce((a, b) => a + b, 0) / Math.max(1, lan.total), inn = lan.bins.slice(0, 10).reduce((a, b) => a + b, 0) / Math.max(1, lan.total);
      ctx.fillStyle = '#e5484d'; ctx.textAlign = 'right'; L.label(ctx, `바깥 30%에 ${Math.round(top * 100)}%`, m.l + pw - 4, m.t + 12, 'right');
      ctx.fillStyle = '#4c7cf0'; ctx.textAlign = 'left'; L.label(ctx, `안쪽 절반에는 ${Math.round(inn * 100)}%`, m.l + 6, m.t + 12, 'left');
    }
  }

  // ---------- ④ 붙는 확률별 빈틈 ----------
  function drawSweep() {
    if (!sweep.length) { const c = L.chart($('c-sweep'), 0.62, {}); c.ctx.fillStyle = css('--muted'); c.ctx.textAlign = 'center'; c.ctx.fillText('계산 중…', c.w / 2, c.h / 2); return; }
    const data = sweep.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) }));
    L.dots($('c-sweep'), { aspect: 0.62, data, x0: 0, x1: 1, y0: 0, y1: 0.5, xTicks: [0, 0.25, 0.5, 0.75, 1], xFmt: (v) => Math.round(v * 100) + '%', yFmt: (v) => Math.round(v * 100) + '%', xLabel: '붙는 확률', marker: { x: sim.params.stick, label: '지금 설정' }, color: '#e5484d' });
  }
  const SWEEP_P = [0.05, 0.1, 0.2, 0.4, 0.7, 1], SWEEP_N = 1200;
  function runSweep() {
    sweep = [];
    const P = params(), jobs = SWEEP_P.map((p) => () => {
      const runs = [0, 1].map((k) => D.create({ stick: p, shape: P.shape, count: SWEEP_N, seed: 100 + k }).run().fill());
      sweep.push({ x: p, runs });
    });
    L.jobs(jobs, drawSweep, drawSweep);
  }

  function renderStats() {
    const P = sim.params, d = dim;
    const cards = [
      ['프랙탈 차원 D (질량 ∝ 반지름^D)', d && isFinite(d.D) ? f2(d.D) : '–', '2에 가까울수록 꽉 찬 면, 1에 가까울수록 가는 선. 고전 값은 약 1.71'],
      ['붙은 입자', `${sim.n.toLocaleString('en-US')} / ${P.count.toLocaleString('en-US')}개`, `가장 먼 끝까지 반지름 ${Math.round(sim.rmax())}칸`],
      ['가장 먼 끝까지의 원 중 채운 비율', `${(sim.fill() * 100).toFixed(0)}%`, '나머지는 빈틈. 크게 자랄수록 더 성겨집니다'],
      ['입자 하나가 붙기까지 평균', `${Math.round(sim.steps / Math.max(1, sim.n)).toLocaleString('en-US')}걸음`, '붙는 확률이 낮으면 닿고도 더 떠돌다 붙습니다'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function updateDim(force) {
    if (force || sim.n - dimAt >= Math.max(60, sim.n * 0.08) || sim.done()) {
      dim = sim.dimension(); dim.local = sim.params.shape !== 'point'; dimAt = sim.n;
    }
  }
  function draw() { updateDim(false); renderStats(); drawCluster(); drawMR(); drawLand(); }

  const h = L.harness({
    controls: ['stick', 'shape', 'count'],
    format: { stick: (v) => Math.round(v * 100) + '%', shape: () => '', count: (v) => v + '개' },
    defaults: { stick: 1, shape: 'point', count: 4000 },
    build() {
      sim = D.create(params()); prepare();
      if (THUMB) { sim.run(); updateDim(true); }
    },
    autoplay: !THUMB,
    advance() { if (sim.done()) return false; sim.addParticles(6); sim.stepLive(150); return true; },
    isDone() { return sim.done(); },
    draw() { draw(); },
    after() { runSweep(); },
    redrawExtra() { drawSweep(); }, seedLabel: '무작위 번호', speedScale: 1,
  });
  seedGetter = h.seed;
})();
