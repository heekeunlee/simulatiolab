(function () {
  'use strict';
  const S = window.Pollock, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 그림이 다 그려진 모습으로 바로 가서 멈춘다
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const WALL = '#1d2029', CANVAS_BG = '#e9e0cc', GRAY = '#8a93a6', ORANGE = '#d9822b';
  const NAME = { brush: '구불구불한 붓질', ruler: '자로 그은 직선', dots: '무작위 점' };
  const REFC = { brush: '#4c7cf0', ruler: GRAY, dots: ORANGE };
  const PER = S.G / S.STEP; // 캔버스 너비 하나 = 256걸음
  let sim = null, refs = {}, sweep = [], sweepRefs = null, seedGetter = () => 1;
  let off = null, offCtx = null, drawnStroke = 0, drawnPt = 0;
  const OS = 2; // 화면용 그림은 격자의 2배 해상도
  const params = () => ({ seed: seedGetter(), turn: (Number($('turn').value) * Math.PI) / 180, stroke: Math.round(Number($('stroke').value) * PER), amount: Math.round(Number($('amount').value) * PER), mode: $('mode').value });
  const f2 = (v) => (isFinite(v) ? v.toFixed(2) : '');
  const others = () => ['brush', 'ruler', 'dots'].filter((k) => k !== sim.params.mode);
  const enough = () => sim.used >= Math.max(300, sim.params.amount * 0.06); // 너무 이른 순간의 숫자는 의미가 없다

  // 비교용 그림(같은 물감 양)을 끝까지 그려 두되, 화면에는 지금 쓴 물감 양까지만 보여 준다
  function buildRefs() {
    refs = {};
    others().forEach((k) => { refs[k] = S.create(Object.assign({}, sim.params, { mode: k })).run().hist; });
  }
  function refAt(k, used) { // 같은 물감 양에서의 비교 그림 복잡도 (기록 사이는 직선 보간)
    const h = refs[k]; if (!h || !h.length || used < h[0].used) return NaN;
    for (let i = 1; i < h.length; i++) if (h[i].used >= used) { const a = h[i - 1], b = h[i], u = (used - a.used) / Math.max(1, b.used - a.used); return a.D + (b.D - a.D) * u; }
    return h[h.length - 1].D;
  }

  // ---------- 그림 (화면 밖 캔버스에 새로 그은 만큼만 덧그린다) ----------
  function prepare() {
    off = document.createElement('canvas'); off.width = off.height = S.G * OS; offCtx = off.getContext('2d');
    offCtx.fillStyle = CANVAS_BG; offCtx.fillRect(0, 0, off.width, off.height);
    // 천의 결 (아주 옅게)
    offCtx.fillStyle = 'rgba(120,100,70,0.05)';
    for (let i = 0; i < off.width; i += 6) { offCtx.fillRect(i, 0, 1, off.height); offCtx.fillRect(0, i, off.width, 1); }
    drawnStroke = 0; drawnPt = 0;
  }
  function paintNew() {
    const st = sim.strokes, ctx = offCtx; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (; drawnStroke < st.length; drawnStroke++, drawnPt = 0) {
      const s = st[drawnStroke], p = s.pts;
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.w * OS;
      if (sim.params.mode === 'dots') { ctx.beginPath(); ctx.arc(p[0] * OS, p[1] * OS, (s.w * OS) / 2, 0, 7); ctx.fill(); continue; }
      const from = Math.max(0, drawnPt - 2);
      if (p.length - from >= 4) {
        ctx.beginPath(); ctx.moveTo(p[from] * OS, p[from + 1] * OS);
        for (let i = from + 2; i < p.length; i += 2) ctx.lineTo(p[i] * OS, p[i + 1] * OS);
        ctx.stroke();
      }
      if (drawnStroke === st.length - 1) { drawnPt = p.length; break; } // 아직 긋는 중인 획: 다음에 이어서
    }
  }

  // 복잡도 눈금자: 1(반듯한 선) ~ 2(빈틈없이 칠한 면)
  function gauge(ctx, x, y, w, big) {
    const D = enough() ? sim.D() : NaN, X = (v) => x + Math.max(0, Math.min(1, v - 1)) * w;
    ctx.textAlign = 'left'; ctx.fillStyle = '#aeb6c8'; ctx.font = `600 ${big ? 13 : 12}px ${FONT}`;
    ctx.fillText('이 그림의 복잡도 (칸 세기로 잰 값)', x, y);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${big ? 54 : 34}px ${FONT}`;
    ctx.fillText(isFinite(D) ? D.toFixed(2) : '…', x, y + (big ? 58 : 38));
    const by = y + (big ? 112 : 78);
    const gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#3a4256'); gr.addColorStop(1, '#8fa3d6');
    ctx.fillStyle = gr; L.roundRect(ctx, x, by - 5, w, 10, 5); ctx.fill();
    ctx.font = `11.5px ${FONT}`; ctx.fillStyle = '#aeb6c8';
    ctx.textAlign = 'left'; ctx.fillText('1 반듯한 선 한 줄', x, by - 12);
    ctx.textAlign = 'right'; ctx.fillText('2 빈틈없이 칠한 면', x + w, by - 12);
    // 비교 그림 (같은 물감 양) 눈금: 아래쪽 두 줄
    if (big) {
      const vis = others().map((k, i) => ({ k, i, v: refAt(k, sim.used) })).filter((o) => isFinite(o.v) && enough());
      vis.forEach(({ k, i, v }) => {
        const px = X(v), ly = by + 30 + i * 22;
        ctx.strokeStyle = REFC[k]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, by + 6); ctx.lineTo(px, ly - 10); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = REFC[k]; ctx.beginPath(); ctx.arc(px, by, 4, 0, 7); ctx.fill();
      });
      vis.forEach(({ k, i, v }) => {
        const px = X(v), ly = by + 30 + i * 22;
        const txt = `같은 양의 ${NAME[k]} ${f2(v)}`; ctx.font = `12px ${FONT}`;
        const tw = ctx.measureText(txt).width, tx = Math.max(x, Math.min(x + w - tw, px - tw / 2));
        ctx.fillStyle = 'rgba(29,32,41,0.92)'; ctx.fillRect(tx - 4, ly - 12, tw + 8, 17);
        ctx.fillStyle = REFC[k] === GRAY ? '#c3c9d6' : REFC[k]; ctx.textAlign = 'left'; ctx.fillText(txt, tx, ly);
      });
    }
    if (isFinite(D)) { // 지금 그림: 크고 흰 표시
      const px = X(D); ctx.fillStyle = '#fff'; ctx.strokeStyle = WALL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, by, 8, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
    }
    return by;
  }

  function drawPainting() {
    const cv = $('c-paint'), cw = cv.clientWidth || 600, narrow = cw < 640;
    const asp = THUMB ? 1 : narrow ? 1 + 124 / cw : Math.min(0.6, 600 / cw);
    const c = L.chart(cv, asp, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w, h } = c;
    paintNew();
    ctx.fillStyle = WALL; ctx.fillRect(0, 0, w, h);
    if (THUMB) { ctx.drawImage(off, 0, 0, w, h); return; }
    const side = narrow ? w - 16 : h - 32, px = narrow ? 8 : 16, py = narrow ? 8 : 16;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.fillStyle = CANVAS_BG; ctx.fillRect(px, py, side, side); ctx.restore();
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, px, py, side, side);
    // 지금 붓 끝
    const cur = sim.strokes[sim.strokes.length - 1];
    if (cur && !sim.done()) {
      const k = side / S.G, bx = px + cur.x * k, by = py + cur.y * k;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.stroke();
      ctx.strokeStyle = WALL; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7); ctx.stroke();
    }
    const usedPct = Math.round((sim.used / sim.params.amount) * 100);
    const info = `물감 ${usedPct}% 사용 · ${sim.strokes.length}획`;
    if (narrow) {
      ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#1b1f2a'; L.label(ctx, info, px + 8, py + 18, 'left');
      gauge(ctx, 12, side + py + 22, w - 24, false);
    } else {
      const gx = px + side + 32, gw = Math.min(420, w - gx - 24);
      ctx.font = `600 13px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#aeb6c8'; ctx.fillText(info, gx, py + 16);
      gauge(ctx, gx, py + 58, gw, true);
      ctx.font = `12px ${FONT}`; ctx.fillStyle = '#7f889c'; ctx.textAlign = 'left';
      if (sim.params.mode !== 'brush') ctx.fillText('지금은 비교용 그리기 방식입니다', gx, h - 20);
    }
  }

  // ---------- ② 칸을 줄여 가며 세기 ----------
  const PANELS = [64, 16, 4];
  function drawBoxes() {
    const cv = $('c-box'), cw = cv.clientWidth || 400, gap = 10, pw = (cw - gap * 2) / 3, capH = 44;
    const c = L.chart(cv, (pw + capH + 6) / cw, { l: 0, r: 0, t: 0, b: 0 }), { ctx } = c;
    PANELS.forEach((s, i) => {
      const l = Math.round(Math.log2(s)), n = S.G / s, box = sim.boxes[l], x0 = i * (pw + gap);
      const im = document.createElement('canvas'); im.width = im.height = n; const ic = im.getContext('2d'), idt = ic.createImageData(n, n), d = idt.data;
      for (let j = 0; j < n * n; j++) { const o = j * 4, on = box[j]; d[o] = on ? 47 : 238; d[o + 1] = on ? 111 : 240; d[o + 2] = on ? 237 : 245; d[o + 3] = 255; }
      ic.putImageData(idt, 0, 0);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(im, x0, 0, pw, pw); ctx.imageSmoothingEnabled = true;
      if (n <= 32) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let q = 1; q < n; q++) { const t = (q / n) * pw; ctx.moveTo(x0 + t, 0); ctx.lineTo(x0 + t, pw); ctx.moveTo(x0, t); ctx.lineTo(x0 + pw, t); } ctx.stroke(); }
      ctx.strokeStyle = css('--line'); ctx.strokeRect(x0 + 0.5, 0.5, pw - 1, pw - 1);
      ctx.textAlign = 'center'; ctx.fillStyle = css('--text'); ctx.font = `600 12px ${FONT}`;
      ctx.fillText(i === 0 ? '큰 칸' : i === 1 ? '중간 칸' : '작은 칸', x0 + pw / 2, pw + 17);
      ctx.fillStyle = css('--muted'); ctx.font = `11.5px ${FONT}`;
      ctx.fillText(`${(n * n).toLocaleString('en-US')}칸 중 ${sim.counts[l].toLocaleString('en-US')}칸`, x0 + pw / 2, pw + 34);
    });
  }

  // ---------- ③ 로그-로그: 칸 크기 대 물감 묻은 칸 수 ----------
  function drawLogLog() {
    const lg = [{ kind: 'dot', color: css('--accent'), label: '물감 묻은 칸 수' }, { kind: 'line', color: '#e5484d', label: '맞춘 기울기 = 복잡도' }, { kind: 'dash', color: GRAY, label: '기울기 1(선)과 2(면)' }];
    const cv = $('c-loglog'), sp = L.belowSpace(cv, lg);
    const c = L.chart(cv, 0.66 + sp.extra / (cv.clientWidth || 400), { l: 56, r: 14, t: 24, b: sp.b }), { ctx, m, pw, ph } = c;
    const sizes = []; for (let l = 0; l <= 8; l++) sizes.push(1 << l);
    const lx0 = Math.log10(1 / 1.4), lx1 = Math.log10(256 * 1.4), ly0 = 0, ly1 = Math.log10(S.G * S.G);
    // x: 칸이 작을수록 오른쪽 (1/s)
    const X = (s) => m.l + ((lx1 - Math.log10(s)) / (lx1 - lx0)) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(1, v)) - ly0) / (ly1 - ly0)) * ph;
    L.axes(c, { X, Y, yTicks: [1, 10, 100, 1000, 10000, 100000], yFmt: (v) => (v >= 1000 ? (v / 1000) + 'k' : String(v)), xTicks: [256, 64, 16, 4, 1], xFmt: (s) => '1/' + (S.G / s), xLabel: '칸 한 변 (캔버스 너비 대비, 오른쪽일수록 작은 칸)', yLabel: '물감 묻은 칸 수 (개)' });
    // 기울기를 잰 범위
    ctx.fillStyle = 'rgba(47,111,237,0.06)'; ctx.fillRect(X(S.FIT[S.FIT.length - 1]), m.t, X(S.FIT[0]) - X(S.FIT[S.FIT.length - 1]), ph);
    const ok = enough(), meas = sim.measure();
    if (ok && isFinite(meas.D)) {
      const s0 = 64, n0 = sim.counts[6];
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = GRAY;
      [1, 2].forEach((k) => { ctx.beginPath(); ctx.moveTo(X(256), Y(n0 * Math.pow(s0 / 256, k))); ctx.lineTo(X(1), Y(Math.min(S.G * S.G, n0 * Math.pow(s0, k)))); ctx.stroke(); });
      ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.fillStyle = GRAY; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left';
      const f = (s) => Math.pow(10, meas.icpt + meas.D * -Math.log10(s));
      ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(S.FIT[S.FIT.length - 1]), Y(f(S.FIT[S.FIT.length - 1]))); ctx.lineTo(X(S.FIT[0]), Y(f(S.FIT[0]))); ctx.stroke(); ctx.lineWidth = 1;
    }
    sizes.forEach((s, l) => { const v = sim.counts[l]; if (!v) return; const inFit = S.FIT.indexOf(s) >= 0; ctx.fillStyle = inFit ? css('--accent') : mix('#2f6fed', 0.35); ctx.beginPath(); ctx.arc(X(s), Y(v), inFit ? 5 : 4, 0, 7); ctx.fill(); });
    if (ok && isFinite(meas.D)) { ctx.font = `600 12.5px ${FONT}`; ctx.fillStyle = '#e5484d'; ctx.textAlign = 'left'; L.label(ctx, `잰 기울기 ${f2(meas.D)}`, m.l + 8, m.t + 14, 'left'); }
    L.drawLegendBelow(c, lg);
  }

  // ---------- ④ 물감이 늘수록 복잡도는 (지금까지) ----------
  function drawGrowth() {
    const ks = others(), lg = [{ kind: 'line', color: css('--accent'), label: '지금 그림' }].concat(ks.map((k) => ({ kind: 'dash', color: REFC[k], label: `같은 양의 ${NAME[k]}` })));
    const cv = $('c-grow'), sp = L.belowSpace(cv, lg);
    const c = L.chart(cv, 0.62 + sp.extra / (cv.clientWidth || 400), { l: 44, r: 14, t: 30, b: sp.b }), { ctx, m, pw, ph } = c;
    const A = sim.params.amount / PER, y0 = 0.6, y1 = 2;
    const X = (u) => m.l + (u / PER / A) * pw, Y = (v) => m.t + ph - ((Math.max(y0, Math.min(y1, v)) - y0) / (y1 - y0)) * ph;
    const xt = []; const stp = A > 120 ? 50 : A > 50 ? 20 : 10; for (let v = 0; v <= A + 1e-9; v += stp) xt.push(v);
    L.axes(c, { X: (v) => X(v * PER), Y, yTicks: [0.6, 1, 1.4, 1.8, 2], yFmt: (v) => v.toFixed(1), xTicks: xt, xFmt: String, xLabel: '뿌린 물감 (캔버스 너비 몇 배 길이)', yLabel: '복잡도' });
    const minU = Math.max(300, sim.params.amount * 0.06), now = sim.used;
    ks.forEach((k) => {
      const pts = refs[k].filter((q) => q.used >= minU && q.used <= now).map((q) => [X(q.used), Y(q.D)]);
      const v = refAt(k, now); if (now >= minU && isFinite(v)) pts.push([X(now), Y(v)]);
      ctx.setLineDash([6, 4]); L.line(ctx, pts, REFC[k], 2); ctx.setLineDash([]);
    });
    const pts = sim.hist.filter((q) => q.used >= minU).map((q) => [X(q.used), Y(q.D)]);
    if (enough()) pts.push([X(now), Y(sim.D())]);
    L.line(ctx, pts, css('--accent'), 3);
    if (pts.length) { const q = pts[pts.length - 1]; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(q[0], q[1], 4.5, 0, 7); ctx.fill(); }
    L.drawLegendBelow(c, lg);
  }

  // ---------- ⑤ 방향 바꾸는 정도별 복잡도 (집계) ----------
  const SW_T = [0, 15, 30, 45, 60, 75, 90, 105, 120], SW_SEEDS = [101, 102, 103];
  function drawSweep() {
    const lg = [{ kind: 'dot', color: css('--accent'), label: '붓질 한 번 (끝까지)' }, { kind: 'line', color: css('--accent'), label: '세 번의 평균' }, { kind: 'dash', color: GRAY, label: '같은 양의 자로 그은 직선' }, { kind: 'dash', color: ORANGE, label: '같은 양의 무작위 점' }];
    const cv = $('c-sweep'), sp = L.belowSpace(cv, lg);
    const c = L.chart(cv, 0.62 + sp.extra / (cv.clientWidth || 400), { l: 44, r: 14, t: 24, b: sp.b }), { ctx, m, pw, ph } = c;
    const y0 = 1, y1 = 2, X = (v) => m.l + (v / 120) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    L.axes(c, { X, Y, yTicks: [1, 1.25, 1.5, 1.75, 2], yFmt: (v) => v.toFixed(2), xTicks: [0, 30, 60, 90, 120], xFmt: (v) => v + '°', xLabel: '한 걸음마다 방향을 트는 정도 (도)', yLabel: '다 그린 그림의 복잡도' });
    if (!sweep.length) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('계산 중…', c.w / 2, c.h / 2); L.drawLegendBelow(c, lg); return; }
    if (sweepRefs) [['ruler', GRAY], ['dots', ORANGE]].forEach(([k, col]) => { ctx.setLineDash([6, 4]); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.l, Y(sweepRefs[k])); ctx.lineTo(m.l + pw, Y(sweepRefs[k])); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; });
    ctx.fillStyle = mix('#2f6fed', 0.3); sweep.forEach((d) => d.runs.forEach((v) => { ctx.beginPath(); ctx.arc(X(d.x), Y(v), 3, 0, 7); ctx.fill(); }));
    L.line(ctx, sweep.map((d) => [X(d.x), Y(L.mean(d.runs))]), css('--accent'), 2.5);
    ctx.fillStyle = css('--accent'); sweep.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(L.mean(d.runs)), 4, 0, 7); ctx.fill(); });
    const deg = Number($('turn').value); L.vline(c, X(deg), css('--rich'), '지금 설정', deg > 60 ? 'right' : 'left');
    L.drawLegendBelow(c, lg);
  }
  function runSweep() {
    sweep = []; sweepRefs = null;
    const P = params(), list = SW_T.map((t) => () => {
      sweep.push({ x: t, runs: SW_SEEDS.map((seed) => S.create({ turn: (t * Math.PI) / 180, stroke: P.stroke, amount: P.amount, mode: 'brush', seed }).run().D()) });
    });
    list.push(() => { sweepRefs = {}; ['ruler', 'dots'].forEach((k) => { sweepRefs[k] = L.mean(SW_SEEDS.map((seed) => S.create({ stroke: P.stroke, amount: P.amount, mode: k, seed }).run().D())); }); });
    L.jobs(list, drawSweep, drawSweep);
  }

  function renderStats() {
    const ok = enough(), D = ok ? sim.D() : NaN, cover = sim.cover();
    const k0 = others()[0], k1 = others()[1], r0 = ok ? refAt(k0, sim.used) : NaN, r1 = ok ? refAt(k1, sim.used) : NaN;
    const cards = [
      ['지금 그림의 복잡도', f2(D), '1이면 반듯한 선 한 줄, 2면 빈틈없이 칠한 면'],
      ['물감이 덮은 넓이', `${Math.round(cover * 100)}%`, `물감 ${Math.round((sim.used / sim.params.amount) * 100)}% 사용 · ${sim.strokes.length}획`],
      [`같은 양의 ${NAME[k0]}`, f2(r0), '같은 물감 양까지 그렸을 때'],
      [`같은 양의 ${NAME[k1]}`, f2(r1), '같은 물감 양까지 그렸을 때'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v || '&nbsp;'}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() {
    renderStats(); drawPainting(); drawBoxes(); drawLogLog(); drawGrowth();
    const w = $('when'); if (w) w.textContent = sim.done() ? '다 그림' : `물감 ${Math.round((sim.used / sim.params.amount) * 100)}%`;
  }

  const h = L.harness({
    controls: ['turn', 'stroke', 'amount', 'mode'],
    format: { turn: (v) => `${v}°`, stroke: (v) => `캔버스 너비 ×${Number(v).toFixed(1)}`, amount: (v) => `캔버스 너비 ×${v}`, mode: () => '' },
    defaults: { turn: 10, stroke: 1.2, amount: 60, mode: 'brush' },
    build() {
      sim = S.create(params()); prepare(); buildRefs();
      if (THUMB) sim.run();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(36); },
    isDone() { return sim.done(); },
    draw, after() { if (!THUMB) runSweep(); }, redrawExtra() { drawSweep(); }, seedLabel: '그림', speedScale: 1,
  });
  seedGetter = h.seed;
})();
