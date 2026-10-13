(function () {
  'use strict';
  const A = window.Ant, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 고속도로가 뻗어 나가기 시작한 장면으로 바로 간다
  const THUMB_STEPS = 15000;
  const ORDER_END = 500; // 빈 판·개미 1마리에서 대칭 모양이 마지막으로 나타나는 때(473걸음)를 넘긴 어림값
  const ANT_COLORS = ['#e5484d', '#e0a100', '#1fa463', '#7c5cff'];
  const NICE_VIEW = [32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048];
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  let sim = null, seedGetter = () => 1, sweep = null, sweepKey = '';
  const params = () => ({ seed: seedGetter(), ants: Number($('ants').value), noise: $('start').value === 'noise', dens: Number($('dens').value) / 100, maxSteps: 60000 });

  const rgb = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  const BG = [243, 245, 250], VIS = [196, 208, 238], BLK = [27, 42, 74];
  let off = null, offCtx = null, img = null, buf = null;

  function phase() {
    if (sim.highway()) return 2;
    if (sim.params.ants === 1 && !sim.params.noise && sim.steps <= ORDER_END) return 0;
    return 1;
  }

  // 판을 그린다: 지나간 곳 전체가 보이도록 보이는 범위(칸 수)를 단계적으로 넓힌다
  function drawGrid(ctx, gx, gy, gs, dpr) {
    let minX = sim.minX, maxX = sim.maxX, minY = sim.minY, maxY = sim.maxY;
    sim.ants.forEach((a) => { minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x); minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y); });
    const need = Math.max(maxX - minX, maxY - minY) + 6;
    let B = NICE_VIEW[NICE_VIEW.length - 1]; for (const v of NICE_VIEW) if (v >= need) { B = v; break; }
    const cx = Math.round((minX + maxX) / 2), cy = Math.round((minY + maxY) / 2);
    const vx = Math.max(0, Math.min(sim.G - B, cx - (B >> 1))), vy = Math.max(0, Math.min(sim.G - B, cy - (B >> 1)));
    const R0 = Math.max(64, Math.min(900, Math.round(gs * dpr)));
    const cp = B <= R0 ? Math.floor(R0 / B) : 0, R = cp ? B * cp : R0;
    if (!off) { off = document.createElement('canvas'); offCtx = off.getContext('2d'); }
    if (off.width !== R) { off.width = R; off.height = R; img = offCtx.createImageData(R, R); buf = new Uint32Array(img.data.buffer); }
    const g = sim.grid, G = sim.G, n = Math.max(1, Math.ceil(B / R));
    const cBG = rgb(...BG), cVIS = rgb(...VIS), cBLK = rgb(...BLK);
    const mixc = (a, b, t) => rgb(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t));
    for (let py = 0; py < R; py++) {
      const y0 = vy + Math.floor((py * B) / R);
      for (let px = 0; px < R; px++) {
        const x0 = vx + Math.floor((px * B) / R);
        if (n === 1) { const c = g[y0 * G + x0]; buf[py * R + px] = c & 1 ? cBLK : c ? cVIS : cBG; }
        else {
          let bl = 0, vi = 0;
          for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) { const c = g[(y0 + yy) * G + x0 + xx]; if (c & 1) bl++; else if (c) vi++; }
          buf[py * R + px] = bl ? mixc(BG, BLK, Math.min(1, 0.3 + (bl * 3) / (n * n))) : vi ? mixc(BG, VIS, Math.min(1, 0.4 + (vi * 3) / (n * n))) : cBG;
        }
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, R, R, gx, gy, gs, gs);
    // 개미
    const k = gs / B, r = Math.max(3.5, Math.min(9, k * 0.9));
    sim.ants.forEach((a, i) => {
      const x = gx + (a.x - vx + 0.5) * k, y = gy + (a.y - vy + 0.5) * k;
      ctx.fillStyle = ANT_COLORS[i]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    });
    ctx.lineWidth = 1; ctx.strokeStyle = css('--line'); ctx.strokeRect(gx + 0.5, gy + 0.5, gs - 1, gs - 1);
    return { B, k };
  }

  // 줄바꿈 (번역 모드에서는 번역한 뒤에 나눈다)
  function wrap(ctx, text, x, y, maxW, lh) {
    const t = window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(text) : text;
    const words = t.indexOf(' ') >= 0 ? t.split(' ') : t.split(''), joiner = t.indexOf(' ') >= 0 ? ' ' : '';
    let line = '', yy = y;
    words.forEach((w) => {
      const test = line ? line + joiner + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = test;
    });
    if (line) ctx.fillText(line, x, yy);
    return yy + lh;
  }

  // ---------- ① 판과 개미 ----------
  function drawMain() {
    const cv = $('c-ant'), cw = cv.clientWidth || 600, wide = cw >= 640;
    const asp = THUMB ? 1 : wide ? Math.min(0.6, 0.52) : 1.6;
    const c = L.chart(cv, asp, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w, h } = c, dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = css('--surface') || '#fff'; ctx.fillRect(0, 0, w, h);
    const gs = THUMB ? Math.min(w, h) : wide ? h - 16 : w - 16, gx = THUMB ? 0 : 8, gy = THUMB ? 0 : 8;
    drawGrid(ctx, gx, gy, gs, dpr);
    $('when').textContent = `${fmt(sim.steps)}걸음`;
    if (THUMB) return;
    const ph = phase(), P = sim.params;
    const px = wide ? gx + gs + 28 : 16, py = wide ? 18 : gy + gs + 14, pw = wide ? w - px - 16 : w - 32;
    ctx.textAlign = 'left'; ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
    ctx.fillText('걸음 수', px, py + 10);
    ctx.fillStyle = css('--text'); ctx.font = '700 ' + (wide ? 40 : 30) + 'px ' + FONT;
    ctx.fillText(fmt(sim.steps), px, py + (wide ? 52 : 42));
    // 단계 표시: 질서 → 혼돈 → 고속도로
    const names = ['① 질서', '② 혼돈', '③ 고속도로'], cols = ['#2f6fed', '#e0a100', '#1fa463'];
    let x = px, y = py + (wide ? 74 : 58);
    ctx.font = '600 ' + (wide ? 14 : 13) + 'px ' + FONT;
    const skipOrder = P.ants > 1 || P.noise;
    names.forEach((nm, i) => {
      const tw = ctx.measureText(nm).width + 22, hh = 30, active = i === ph, past = i < ph || (i === 0 && skipOrder && ph > 0);
      if (x + tw > px + pw && x > px) { x = px; y += hh + 8; }
      L.roundRect(ctx, x, y, tw, hh, 15);
      ctx.fillStyle = active ? cols[i] : past ? L.mix(cols[i], 0.18) : 'rgba(138,147,166,0.12)'; ctx.fill();
      ctx.fillStyle = active ? '#fff' : past ? css('--text') : css('--muted'); ctx.textAlign = 'center'; ctx.fillText(nm, x + tw / 2, y + 20);
      if (i < 2) { ctx.textAlign = 'left'; ctx.fillStyle = css('--muted'); ctx.fillText('→', x + tw + 6, y + 20); }
      x += tw + 28;
    });
    ctx.textAlign = 'left'; ctx.font = '13px ' + FONT; ctx.fillStyle = css('--text');
    y += 52;
    const desc = ph === 0 ? '처음에는 대칭인 무늬가 되풀이되며 질서 있게 자랍니다. 빈 판의 개미는 약 470걸음까지 대칭 모양을 만들어요.'
      : ph === 1 ? (skipOrder ? '무작위로 흩어진 점 사이에서 개미는 마구 맴돕니다. 고속도로는 언제 생길까요?' : '대칭이 깨지고 어디로 갈지 알 수 없는 어지러운 무늬가 됩니다. 규칙은 두 줄뿐인데도요.')
      : '갑자기 104걸음짜리 동작이 되풀이되며 대각선으로 곧게 뻗는 길을 냅니다. 아무도 계획하지 않았는데요.';
    y = wrap(ctx, desc, px, y, pw, 19);
    ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
    if (sim.onset !== null) y = wrap(ctx, `고속도로 시작: ${fmt(sim.onset)}걸음`, px, y + 6, pw, 18);
    else if (sim.done()) y = wrap(ctx, `${fmt(sim.params.maxSteps)}걸음까지 고속도로가 보이지 않았습니다.`, px, y + 6, pw, 18);
    // 범례
    y = Math.max(y + 10, wide ? 0 : y + 4);
    if (wide) y = Math.max(y, h - 62);
    const item = (col, circle, label, xx, yy) => {
      ctx.fillStyle = col; ctx.beginPath(); if (circle) ctx.arc(xx + 6, yy - 4, 5.5, 0, 7); else ctx.rect(xx, yy - 10, 12, 12); ctx.fill();
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText(label, xx + 18, yy); return xx + 18 + ctx.measureText(label).width + 14;
    };
    let lx = px; ctx.font = '12px ' + FONT;
    lx = item('rgb(' + BLK + ')', false, '검은 칸', lx, y + 4); lx = item('rgb(' + VIS + ')', false, '지나간 흰 칸', lx, y + 4);
    for (let i = 0; i < P.ants; i++) { if (lx + 70 > px + pw) break; lx = item(ANT_COLORS[i], true, P.ants > 1 ? '개미 ' + (i + 1) : '개미', lx, y + 4); }
  }

  // ---------- 시간 차트 틀 ----------
  function niceStep(max, cnt) {
    const raw = max / cnt, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }
  function timeChart(id, ys, color, yLabel) {
    const H = sim.hist, tmax = [12000, 20000, 30000, 40000, 60000].find((v) => v >= sim.steps) || 60000;
    const ymax0 = Math.max(10, ...ys), st = niceStep(ymax0, 4), ymax = Math.ceil(ymax0 / st) * st;
    const c = L.chart($(id), 0.62, { l: 52, b: 40, r: 26 }), { ctx, m, pw, ph } = c;
    const X = (t) => m.l + (t / tmax) * pw, Y = (v) => m.t + ph - (v / ymax) * ph;
    const yt = []; for (let v = 0; v <= ymax + 1e-9; v += st) yt.push(v);
    const xs = niceStep(tmax, 5), xt = []; for (let v = 0; v <= tmax; v += xs) xt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => fmt(v), xTicks: xt, xFmt: (v) => fmt(v), xLabel: '걸음 수' });
    if (sim.onset !== null) L.vline(c, X(sim.onset), '#1fa463', `고속도로 시작 ${fmt(sim.onset)}걸음`, sim.onset > tmax * 0.55 ? 'right' : 'left');
    if (sim.params.ants === 1 && !sim.params.noise) { // 대칭 구간
      ctx.fillStyle = L.mix('#2f6fed', 0.12); ctx.fillRect(m.l, m.t, X(ORDER_END) - m.l, ph);
    }
    const pts = H.t.map((t, i) => [X(t), Y(ys[i])]);
    L.line(ctx, pts, color, 2.6);
    if (pts.length) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(pts[pts.length - 1][0], pts[pts.length - 1][1], 4, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = css('--muted'); ctx.fillText(yLabel, 0, 0); ctx.restore();
    return c;
  }
  function drawBlack() { timeChart('c-black', sim.hist.black, css('--accent'), '검은 칸 수'); }
  function drawDist() { timeChart('c-dist', sim.hist.dist, '#e5484d', sim.params.ants > 1 ? '원점에서 거리 (칸, 개미 평균)' : '원점에서 거리 (칸)'); }

  // ---------- ④ 무작위 시작 훑어 보기 ----------
  const SWEEP_D = [0, 5, 10, 20, 30, 40, 50], SEEDS = 10;
  function drawSweep() {
    if (!sweep) return;
    const data = SWEEP_D.map((d) => {
      const runs = (sweep.res[d] || []).map((r) => (r === null ? 60000 : r)), s = runs.slice().sort((a, b) => a - b);
      return runs.length ? { x: d, runs, mean: s[s.length >> 1] } : null;
    }).filter(Boolean);
    const refs = sim.params.ants === 1 ? [{ y: 9976, label: '빈 판: 9,976걸음', color: '#1fa463' }] : [];
    L.dots($('c-sweep'), { aspect: 0.62, data, x0: 0, x1: 50, y0: 0, y1: 60000, yFmt: (v) => fmt(v), xTicks: [0, 10, 20, 30, 40, 50], xFmt: (v) => v + '%',
      xLabel: '처음에 흩뿌린 검은 칸의 비율 (0%는 빈 판)', color: '#e5484d', refs, marker: sim.params.noise ? { x: sim.params.dens * 100, label: '지금 설정' } : null });
    let done = 0, ok = 0; SWEEP_D.forEach((d) => (sweep.res[d] || []).forEach((r) => { done++; if (r !== null) ok++; }));
    $('note-s').textContent = `개미 수 ${sweep.ants} · 설정마다 무작위로 ${SEEDS}번씩 돌림 · 고속도로가 생긴 횟수 ${ok}/${done}`;
  }
  function runSweep() {
    const ants = sim.params.ants, key = String(ants);
    if (sweepKey === key && sweep && sweep.finished) { drawSweep(); return; }
    sweepKey = key; sweep = { ants, res: {}, finished: false };
    const mine = sweep, list = [];
    SWEEP_D.forEach((d) => { for (let s = 1; s <= (d === 0 ? 1 : SEEDS); s++) list.push(() => {
      const m = A.create({ ants, noise: true, dens: d / 100, seed: 100 + s, maxSteps: 60000, sample: 1000000 });
      while (m.step() && m.onset === null);
      (mine.res[d] = mine.res[d] || []).push(m.onset);
    }); });
    L.jobs(list, () => { if (sweep === mine) drawSweep(); }, () => { mine.finished = true; });
  }

  function renderStats() {
    const ph = phase(), P = sim.params;
    const pname = ['① 질서', '② 혼돈', '③ 고속도로'][ph];
    const cards = [
      ['고속도로가 시작된 걸음', sim.onset !== null ? `${fmt(sim.onset)}걸음` : '아직', sim.onset !== null ? '이 설정에서 직접 돌려 잰 값' : '속도를 올려 계속 돌려 보세요'],
      ['지금 단계', pname, `${fmt(sim.steps)}걸음째`],
      ['검은 칸', `${fmt(sim.black)}개`, '개미가 뒤집어 놓은 칸 중 지금 검은 것'],
      ['원점에서 거리', `${fmt(sim.dist())}칸 떨어짐`, ph === 2 ? '이제 걸음마다 일정하게 멀어집니다' : '혼돈 속에서는 거의 제자리를 맴돕니다'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawMain(); drawBlack(); drawDist(); }
  function after() { runSweep(); }

  const h = L.harness({
    controls: ['ants', 'start', 'dens'],
    format: { ants: (v) => v, start: () => '', dens: (v) => v + '%' },
    defaults: { ants: 1, start: 'blank', dens: 15 },
    speedScale: 1, // 속도 선택값 = 초당 걸음 수
    build() {
      sim = A.create(params());
      if (THUMB) sim.advance(THUMB_STEPS);
    },
    autoplay: !THUMB,
    advance() { return sim.step(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawSweep(); }, seedLabel: '시작 번호',
  });
  seedGetter = h.seed;
})();
