(function () {
  'use strict';
  const H = window.Halftone, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 점이 충분히 찍혀 얼굴이 드러난 장면에서 멈춘다
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const G = H.G, PAPER = [247, 243, 234], INK = [31, 36, 48], ACC = '#2f6fed', GRAY = '#9aa6bd', RED = '#e5484d';
  const NMAX = 20000;   // 그래프 가로축 끝(슬라이더 최댓값)
  let sim = null, seedGetter = () => 1;
  let dotsCv = null, dotsKey = '', dotsDrawn = 0;
  let blurSweep = { key: '', data: [] }, sizeSweep = { key: '', data: [] };
  const params = () => ({ seed: seedGetter(), pic: $('pic').value, count: Number($('count').value), size: Number($('size').value), blur: Number($('blur').value) });
  const pc = (v) => Math.round(v * 100) + '%';
  const fmtN = (v) => Math.round(v).toLocaleString('en-US');

  // ---------- 그림 그리기 도구 ----------
  function grayCanvas(arr) {   // 어두움(0~1) 배열 → G×G 캔버스 (종이색~잉크색)
    const c = document.createElement('canvas'); c.width = c.height = G;
    const g = c.getContext('2d'), img = g.createImageData(G, G), d = img.data;
    for (let i = 0; i < G * G; i++) {
      const v = Math.max(0, Math.min(1, arr[i])), o = i * 4;
      d[o] = PAPER[0] + (INK[0] - PAPER[0]) * v; d[o + 1] = PAPER[1] + (INK[1] - PAPER[1]) * v; d[o + 2] = PAPER[2] + (INK[2] - PAPER[2]) * v; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0); return c;
  }
  let picCv = null, picName = '';
  function pane(ctx, src, x, y, s, smooth) {
    ctx.save(); ctx.imageSmoothingEnabled = smooth !== false; ctx.drawImage(src, x, y, s, s); ctx.restore();
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }
  // 점 그림: 화면 크기의 캔버스에 새로 찍힌 점만 더 그린다 (크기·설정이 바뀌면 처음부터)
  function dotsCanvas(S) {
    const dpr = window.devicePixelRatio || 1, px = Math.round(S * dpr), key = px + '|' + sim.params.size + '|' + sim.params.seed + '|' + sim.params.pic + '|' + sim.params.count;
    if (!dotsCv || key !== dotsKey || dotsDrawn > sim.n) {
      dotsCv = document.createElement('canvas'); dotsCv.width = dotsCv.height = px; dotsKey = key; dotsDrawn = 0;
      const g = dotsCv.getContext('2d'); g.fillStyle = `rgb(${PAPER})`; g.fillRect(0, 0, px, px);
    }
    const g = dotsCv.getContext('2d'), k = px / G, r = Math.max(0.6, sim.params.size * k);
    g.fillStyle = `rgb(${INK})`;
    for (; dotsDrawn < sim.n; dotsDrawn++) { g.beginPath(); g.arc(sim.xs[dotsDrawn] * k, sim.ys[dotsDrawn] * k, r, 0, 7); g.fill(); }
    return dotsCv;
  }
  function wrap(ctx, text, x, y, maxW, lh) {
    text = tr(text);
    const words = text.split(/(?<=\s)/), lines = []; let cur = '';
    words.forEach((w) => { if (ctx.measureText(cur + w).width <= maxW || !cur) cur += w; else { lines.push(cur.trimEnd()); cur = w; } });
    if (cur) lines.push(cur.trimEnd());
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh));
    return lines.length;
  }

  // ---------- ① 점이 찍혀 가는 그림 ----------
  function drawArt() {
    const cv = $('c-art'), cw = cv.clientWidth || 700, mobile = cw < 560;
    if (sim.params.pic !== picName || !picCv) { picCv = grayCanvas(sim.pic); picName = sim.params.pic; }
    if (THUMB) {
      const c = L.chart(cv, 1, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w } = c;
      ctx.drawImage(dotsCanvas(w), 0, 0, w, w); return;
    }
    const far = grayCanvas(sim.far || new Float32Array(G * G)), simv = sim.sim();
    const LH = 22;   // 그림 위 이름 줄
    if (mobile) {
      const S = cw, s2 = Math.floor((cw - 10) / 2), hh = LH + S + 12 + LH + s2 + 8;
      const c = L.chart(cv, hh / cw, { l: 0, r: 0, t: 0, b: 0 }), { ctx } = c;
      ctx.font = '600 12.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
      ctx.fillText('가까이서 본 점 그림', 0, 15);
      ctx.textAlign = 'right'; ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.fillText(`점 ${fmtN(sim.n)}개`, S, 15);
      pane(ctx, dotsCanvas(S), 0, LH, S, true);
      const y2 = LH + S + 12;
      ctx.font = '600 12.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
      ctx.fillText('원래 그림', 0, y2 + 15); ctx.fillText('멀리서 본 모습', s2 + 10, y2 + 15);
      pane(ctx, picCv, 0, y2 + LH, s2); pane(ctx, far, s2 + 10, y2 + LH, s2);
      bigNumber(ctx, simv, s2 + 10 + s2 / 2, y2 + LH + s2 / 2, s2);
      return;
    }
    const S = Math.min(Math.round(cw * 0.46), 460), side = (cw - S - 40) / 2, s2 = Math.min(Math.floor(side), Math.round(S * 0.6));
    const hh = LH + S + 6;
    const c = L.chart(cv, hh / cw, { l: 0, r: 0, t: 0, b: 0 }), { ctx } = c;
    const xL = (side - s2) / 2, xC = side + 20, xR = side + 20 + S + 20 + (side - s2) / 2;
    ctx.font = '600 13px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
    ctx.fillText('원래 그림', xL, 15); ctx.fillText('가까이서 본 점 그림', xC, 15); ctx.fillText('멀리서 본 모습', xR, 15);
    ctx.textAlign = 'right'; ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.fillText(`점 ${fmtN(sim.n)}개`, xC + S, 15);
    pane(ctx, picCv, xL, LH, s2); pane(ctx, dotsCanvas(S), xC, LH, S, true); pane(ctx, far, xR, LH, s2);
    // 원래 그림 아래: 무엇을 하는지 / 멀리서 본 모습 아래: 큰 숫자
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left';
    wrap(ctx, '어두운 곳일수록 점이 더 자주 찍혀요. 점은 아무 곳에나 무작위로 떨어집니다.', xL, LH + s2 + 22, s2, 16);
    ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 12.5px ' + FONT;
    ctx.fillText('원래 그림과 닮은 정도', xR, LH + s2 + 24);
    ctx.font = '700 44px ' + FONT; ctx.fillStyle = ACC; ctx.fillText(pc(simv), xR, LH + s2 + 72);
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted');
    wrap(ctx, '두 그림을 똑같이 흐리게 해서 비교한 값', xR, LH + s2 + 94, s2, 16);
  }
  function bigNumber(ctx, v, cx, cy, s) {   // 휴대폰: 멀리서 본 모습 위에 큰 숫자
    ctx.save(); ctx.font = '700 ' + Math.round(s * 0.2) + 'px ' + FONT;
    const t = pc(v), tw = ctx.measureText(t).width + 18, th = s * 0.27;
    ctx.fillStyle = 'rgba(255,255,255,0.86)'; L.roundRect(ctx, cx - tw / 2, cy - th / 2, tw, th, 10); ctx.fill();
    ctx.fillStyle = ACC; ctx.textAlign = 'center'; ctx.fillText(t, cx, cy + s * 0.07);
    ctx.font = '600 11px ' + FONT; ctx.fillStyle = css('--text'); ctx.fillText('닮은 정도', cx, cy - th / 2 - 6);
    ctx.restore();
  }

  // ---------- ② 점 개수와 닮은 정도 (재생한 데까지만) ----------
  const LX0 = 0, LX1 = Math.log10(NMAX);
  function drawCurve() {
    const c = L.chart($('c-curve'), 0.62, { l: 46, r: 16, t: 24, b: 40 }), { ctx, w, m, pw, ph } = c;
    const X = (n) => m.l + ((Math.log10(Math.max(1, n)) - LX0) / (LX1 - LX0)) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pc, xTicks: [1, 10, 100, 1000, 10000], xFmt: fmtN, xLabel: '찍은 점 (개, 한 칸마다 10배)', yLabel: '닮은 정도 (%)' });
    // 기준선: 80%
    ctx.setLineDash([5, 4]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(m.l, Y(0.8)); ctx.lineTo(m.l + pw, Y(0.8)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '11.5px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; L.label(ctx, '닮은 정도 80%', m.l + 6, Y(0.8) - 6, 'left');
    // 설정한 점 개수 끝
    const xe = X(sim.params.count);
    ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(xe, m.t); ctx.lineTo(xe, m.t + ph); ctx.stroke();
    const hs = sim.hist;
    if (hs.length) {
      ctx.fillStyle = L.mix(ACC, 0.12); ctx.beginPath(); ctx.moveTo(X(hs[0][0]), Y(0));
      hs.forEach(([n, v]) => ctx.lineTo(X(n), Y(v))); ctx.lineTo(X(hs[hs.length - 1][0]), Y(0)); ctx.closePath(); ctx.fill();
      L.line(ctx, hs.map(([n, v]) => [X(n), Y(v)]), ACC, 3);
      const r80 = sim.reach(0.8);
      if (r80) { ctx.fillStyle = css('--text'); ctx.beginPath(); ctx.arc(X(r80), Y(0.8), 4.5, 0, 7); ctx.fill(); }
      const [n, v] = hs[hs.length - 1], px = X(n), py = Y(v);
      ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      chip(ctx, `지금 ${fmtN(n)}개 · ${pc(v)}`, px, py, ACC, c);
      if (r80 && sim.n > r80 * 1.6) {   // 80%를 넘긴 점 개수: 아래로 점선을 내리고 바닥 가까이에 쓴다 (지금 이름표와 겹치지 않게)
        ctx.setLineDash([2, 3]); ctx.strokeStyle = css('--text'); ctx.beginPath(); ctx.moveTo(X(r80), Y(0.8)); ctx.lineTo(X(r80), Y(0)); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '11.5px ' + FONT; ctx.fillStyle = css('--text');
        const t = `${fmtN(r80)}개에서 80%`, right = X(r80) + 8 + ctx.measureText(tr(t)).width > m.l + pw;
        ctx.textAlign = right ? 'right' : 'left'; L.label(ctx, t, X(r80) + (right ? -6 : 6), Y(0) - 10, right ? 'right' : 'left');
      }
    }
  }
  // 이름표: 글상자 모서리와 가리키는 점을 선으로 잇는다
  function chip(ctx, text, x, y, color, c) {
    ctx.save(); ctx.font = '600 12px ' + FONT;
    const tw = ctx.measureText(text).width + 16, th = 22, { m, pw } = c;
    let bx = x - tw - 14, by = y - th - 16;
    if (bx < m.l + 4) bx = Math.min(x + 14, m.l + pw - tw);
    if (by < m.t + 2) by = y + 16;
    const ax = bx + tw / 2 < x ? bx + tw : bx, ay = by + th / 2 < y ? by + th : by;
    ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(Math.max(bx, Math.min(bx + tw, x)), ay); ctx.lineTo(x, y); ctx.stroke();
    ctx.shadowColor = 'rgba(20,30,60,.16)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; L.roundRect(ctx, bx, by, tw, th, 11); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.5; L.roundRect(ctx, bx, by, tw, th, 11); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, bx + 8, by + 15);
    ctx.restore(); void ax;
  }

  // ---------- ③ 멀리서 보는 정도별: 80%까지 필요한 점 (미리 돌린 비교) ----------
  const BLURS = [1, 2, 3, 4, 5, 6], SIZES = [0.5, 1, 2, 3], SW_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  const BLUR_NAME = { 1: '바로 앞', 2: '한 걸음', 3: '몇 걸음', 4: '방 건너', 5: '멀리', 6: '아주 멀리' };
  function drawBlur() {
    const cv = $('c-blur'), c = L.chart(cv, 0.62, { l: 52, r: 12, t: 24, b: 40 }), { ctx, m, pw, ph } = c;
    const d = blurSweep.data;
    if (!d.length) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText(sweepPending ? '위 재생이 끝나면 계산해요' : '계산 중…', c.w / 2, c.h / 2); return; }
    const vals = d.map((q) => q.n || NMAX), top = Math.max(500, ...vals) * 1.18;
    const step = top > 8000 ? 2500 : top > 3000 ? 1000 : top > 1500 ? 500 : 250, YM = Math.ceil(top / step) * step;
    const Y = (v) => m.t + ph - (v / YM) * ph, bw = pw / BLURS.length, X = (b) => m.l + (b - 0.5) * bw;
    const yt = []; for (let v = 0; v <= YM + 1e-9; v += step) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: fmtN, xTicks: [], xLabel: '멀리서 보는 정도', yLabel: '80%까지 필요한 점 (개)' });
    const narrow = c.w < 480;
    d.forEach((q) => {
      const cur = q.b === sim.params.blur, x = m.l + (q.b - 1) * bw + bw * 0.14, ww = bw * 0.72, v = q.n || NMAX;
      ctx.fillStyle = cur ? ACC : L.mix(ACC, 0.32); ctx.fillRect(x, Y(v), ww, Y(0) - Y(v));
      ctx.fillStyle = cur ? ACC : css('--text'); ctx.textAlign = 'center'; ctx.font = (cur ? '700 ' : '600 ') + (narrow ? '11px ' : '12.5px ') + FONT;
      ctx.fillText(q.n ? fmtN(q.n) : '못 닿음', x + ww / 2, Y(v) - 6);
      ctx.font = (cur ? '700 ' : '') + (narrow ? '10.5px ' : '11.5px ') + FONT; ctx.fillStyle = cur ? ACC : css('--muted');
      ctx.fillText(narrow ? String(q.b) : BLUR_NAME[q.b], x + ww / 2, m.t + ph + 16);
    });
    if (narrow) { ctx.font = '10.5px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('1 = 바로 앞 · 6 = 아주 멀리', m.l, m.t + ph + 30); }
  }

  // ---------- ④ 점 크기별: 계속 찍으면 계속 닮아질까 (미리 돌린 비교) ----------
  const SIZE_COL = ['#9ec5ff', '#2f6fed', '#e0a100', '#e5484d'];
  function drawSize() {
    const cv = $('c-size'), items = SIZES.map((z, i) => ({ kind: 'line', color: SIZE_COL[i], label: `점 크기 ${sizeFmt(z)}` }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.62 + sp.extra / (cv.clientWidth || 400), { l: 46, r: 16, t: 24, b: sp.b }), { ctx, m, pw, ph } = c;
    const X = (n) => m.l + ((Math.log10(Math.max(1, n)) - LX0) / (LX1 - LX0)) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pc, xTicks: [1, 10, 100, 1000, 10000], xFmt: fmtN, xLabel: '찍은 점 (개, 한 칸마다 10배)', yLabel: '닮은 정도 (%)' });
    if (!sizeSweep.data.length) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText(sweepPending ? '위 재생이 끝나면 계산해요' : '계산 중…', m.l + pw / 2, m.t + ph / 2); }
    sizeSweep.data.forEach((q) => {
      const i = SIZES.indexOf(q.z), cur = Math.abs(q.z - sim.params.size) < 1e-6;
      L.line(ctx, q.hist.map(([n, v]) => [X(n), Y(v)]), SIZE_COL[i], cur ? 4 : 2.2);
    });
    L.drawLegendBelow(c, items);
  }
  const sizeFmt = (v) => (Number(v) * 2 / G * 100).toFixed(1) + '%';

  // ③④는 계산이 무거워서, 위 재생이 끝난 뒤(또는 15초 뒤) 계산한다: 재생이 끊기지 않게
  let sweepPending = false, sweepTimer = 0;
  function scheduleSweeps() {
    if (THUMB) return;
    sweepPending = true; clearTimeout(sweepTimer); sweepTimer = setTimeout(() => { if (sweepPending) runSweeps(); }, 15000);
    drawBlur(); drawSize();
  }
  function runSweeps() {
    sweepPending = false; clearTimeout(sweepTimer);
    const P = params(), bk = P.pic + '|' + P.size, sk = P.pic + '|' + P.blur, list = [];
    if (blurSweep.key !== bk) {
      blurSweep = { key: bk, data: [] };
      BLURS.forEach((b) => {
        const ns = [];
        SW_SEEDS.forEach((seed, k) => list.push(() => {   // 시드 하나씩 나눠서 계산 (화면이 오래 멈추지 않게)
          const s = H.create({ pic: P.pic, size: P.size, blur: b, count: NMAX, seed }); while (s.step()) if (s.sim() >= 0.8) break; ns.push(s.reach(0.8));
          if (k < SW_SEEDS.length - 1) return;
          const ok = ns.filter((v) => v != null).sort((a, b2) => a - b2);
          blurSweep.data.push({ b, n: ok.length >= SW_SEEDS.length / 2 ? ok[Math.floor((ok.length - 1) / 2)] : null });
        }));
      });
    }
    if (sizeSweep.key !== sk) {
      sizeSweep = { key: sk, data: [] };
      SIZES.forEach((z) => list.push(() => { const s = H.create({ pic: P.pic, size: z, blur: P.blur, count: NMAX, seed: 21 }).run(); sizeSweep.data.push({ z, hist: s.hist }); }));
    }
    drawBlur(); drawSize();
    L.jobs(list, () => { drawBlur(); drawSize(); }, () => { drawBlur(); drawSize(); });
  }

  // ---------- 통계 카드 (모두 '지금까지' 값) ----------
  function renderStats() {
    const v = sim.sim(), r80 = sim.reach(0.8), n = sim.n;
    let half = null; if (n >= 40) { for (const [k, c] of sim.hist) if (k <= n / 2) half = c; }
    const gain = half == null ? '' : (v - half >= 0 ? `${Math.round((v - half) * 100)}%p 오름` : `${Math.round((half - v) * 100)}%p 내림`);
    const cards = [
      ['지금 닮은 정도', pc(v), '멀리서 본 점 그림과 원래 그림이 얼마나 닮았는지'],
      ['찍은 점', `${fmtN(n)} / ${fmtN(sim.params.count)}개`, `종이를 덮은 잉크 ${pc(sim.coverage())}`],
      ['닮은 정도 80%를 처음 넘긴 때', r80 ? `${fmtN(r80)}개째` : '', r80 ? '그 뒤로는 점이 늘어도 조금씩만 올라요' : sim.done() ? '끝까지 못 넘었어요' : '아직이에요'],
      ['점을 두 배로 늘렸을 때', gain, '점이 지금의 절반이던 때와 비교한 닮은 정도 변화'],
    ];
    $('stats').innerHTML = cards.map(([k, val, s], i) => `<div class="stat"><div class="k">${k}</div><div class="v">${val}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() {
    renderStats(); drawArt(); drawCurve();
    if (sweepPending && sim.done()) runSweeps();
    const e = $('when'); if (e) e.textContent = sim.done() ? `점 ${fmtN(sim.n)}개 · 끝` : `점 ${fmtN(sim.n)}개 찍는 중`;
  }

  const h = L.harness({
    controls: ['pic', 'count', 'size', 'blur'],
    format: { pic: () => '', count: (v) => `${fmtN(v)}개`, size: sizeFmt, blur: (v) => BLUR_NAME[v] || String(v) },
    defaults: { pic: 'face', count: 6000, size: 1, blur: 3 },
    build() {
      sim = H.create(params()); sim.measure();
      if (THUMB) { while (sim.n < 3000 && sim.step()); }
    },
    autoplay: !THUMB,
    advance() { return sim.step(); },
    isDone() { return sim.done(); },
    draw, after: scheduleSweeps, redrawExtra() { drawBlur(); drawSize(); }, seedLabel: '점 그림', speedScale: 1,
  });
  seedGetter = h.seed;
})();
