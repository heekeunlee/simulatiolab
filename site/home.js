// 메인 페이지: ① 히어로의 점 떼(분야별로 모이고, 마우스를 피하고, 클릭하면 흩어짐) ② 주기율표 칸의 작은 애니메이션 ③ 실험 노트
(function () {
  'use strict';
  const en = window.I18N && window.I18N.lang === 'en';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const tiles = Array.from(document.querySelectorAll('.el'));
  const fields = Array.from(document.querySelectorAll('.col')).map((c) => ({ key: c.dataset.field, color: c.dataset.color, n: c.querySelectorAll('.el').length }));

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function fit(canvas) {
    const r = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
  }

  // ---------- ① 히어로 점 떼 ----------
  const hero = document.getElementById('swarm');
  if (hero && fields.length) {
    const N = 360, dots = [];
    const rng = mulberry32(11);
    for (let i = 0; i < N; i++) {
      const f = fields[Math.floor(rng() * fields.length)];
      dots.push({ x: rng(), y: rng(), vx: 0, vy: 0, f, r: 2 + rng() * 2.2, phase: rng() * 6.28 });
    }
    let mouse = null, scatter = 0, t0 = performance.now();
    const centers = () => {
      const { w, h } = fit(hero);
      return fields.map((f, i) => {
        const a = -0.55 + (i / Math.max(1, fields.length - 1)) * 1.1;
        const R = Math.min(w, h) * 0.72;
        return { x: w * 0.72 + Math.sin(a) * R * 0.5, y: h * 0.5 - Math.cos(a) * R * 0.42 };
      });
    };
    hero.parentElement.addEventListener('mousemove', (e) => { const r = hero.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    hero.parentElement.addEventListener('mouseleave', () => { mouse = null; });
    hero.parentElement.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; scatter = 1; whatIf(); });
    hero.parentElement.addEventListener('touchstart', () => { scatter = 1; whatIf(); }, { passive: true });

    function frame(now) {
      const { ctx, w, h } = fit(hero);
      const C = centers();
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      scatter = Math.max(0, scatter - dt * 0.6);
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const c = C[fields.indexOf(d.f)];
        let px = d.x * w, py = d.y * h;
        const k = scatter > 0 ? -0.35 * scatter : 0.9;
        let ax = (c.x - px) * k * 0.02, ay = (c.y - py) * k * 0.02;
        ax += Math.cos(now / 900 + d.phase) * 0.4; ay += Math.sin(now / 1100 + d.phase) * 0.4;
        if (mouse) { const dx = px - mouse.x, dy = py - mouse.y, dd = dx * dx + dy * dy; if (dd < 120 * 120) { const m = (1 - Math.sqrt(dd) / 120) * 9; ax += (dx / (Math.sqrt(dd) + 1)) * m; ay += (dy / (Math.sqrt(dd) + 1)) * m; } }
        d.vx = (d.vx + ax) * 0.86; d.vy = (d.vy + ay) * 0.86;
        px += d.vx; py += d.vy;
        px = Math.max(4, Math.min(w - 4, px)); py = Math.max(4, Math.min(h - 4, py));
        d.x = px / w; d.y = py / h;
        ctx.fillStyle = d.f.color; ctx.globalAlpha = 0.72;
        ctx.beginPath(); ctx.arc(px, py, d.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // "만약에…" 질문 순환
  const rq = document.getElementById('rq');
  const QS = en ? ['What if success were mostly luck?', 'What if everyone wanted a slightly better partner?', 'What if a tiny brake tap could jam a whole highway?', 'What if one person could tip a revolution?', 'What if 100 painters copied each other?', 'What if the voting method changed the winner?']
    : ['만약에 성공이 대부분 운이라면?', '만약에 모두가 조금 더 나은 짝을 바란다면?', '만약에 브레이크 한 번이 고속도로 전체를 막는다면?', '만약에 한 사람이 혁명의 방아쇠가 된다면?', '만약에 화가 100명이 서로 따라 그린다면?', '만약에 투표 방식이 당선자를 바꾼다면?'];
  let qi = 0;
  function whatIf() { if (!rq) return; rq.classList.add('fade'); setTimeout(() => { qi = (qi + 1) % QS.length; rq.textContent = QS[qi]; rq.classList.remove('fade'); }, 350); }
  if (rq) { rq.textContent = QS[0]; if (!reduce) setInterval(whatIf, 5200); }

  // ---------- ② 칸의 작은 애니메이션 ----------
  const GLYPH = {
    bars(ctx, w, h, t, c, r) { for (let i = 0; i < 9; i++) { const v = 0.15 + 0.85 * Math.pow(0.55, i) * (0.8 + 0.2 * Math.sin(t / 700 + i)); ctx.fillStyle = i === 0 ? '#e0a100' : c; ctx.globalAlpha = 0.85; ctx.fillRect(10 + i * ((w - 20) / 9), h * 0.72 - v * h * 0.45, (w - 20) / 9 - 2, v * h * 0.45); } },
    stairs(ctx, w, h, t, c) { for (let i = 0; i < 14; i++) { const v = Math.pow(i / 13, 2.2) * 0.5 + 0.03 + 0.03 * Math.sin(t / 500 + i); ctx.fillStyle = i > 10 ? '#e0a100' : c; ctx.globalAlpha = 0.8; ctx.fillRect(8 + i * ((w - 16) / 14), h * 0.74 - v * h, (w - 16) / 14 - 1.5, v * h); } },
    rise(ctx, w, h, t, c) { ctx.globalAlpha = 0.8; for (let i = 0; i < 6; i++) { const p = ((t / 2500 + i / 6) % 1); const v = i === 0 ? Math.pow(p, 0.5) : p * 0.25; ctx.strokeStyle = i === 0 ? '#e0a100' : c; ctx.lineWidth = i === 0 ? 2.5 : 1.2; ctx.beginPath(); for (let x = 0; x <= 1; x += 0.05) { const y = Math.pow(x, 2.4) * v * p; const X = 10 + x * (w - 20), Y = h * 0.74 - y * h * 0.9; x === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); } ctx.stroke(); } },
    grid(ctx, w, h, t, c, r) { const n = 9, s = (w - 16) / n; const ph = Math.floor(t / 1200); for (let y = 0; y < n * 0.78; y++) for (let x = 0; x < n; x++) { const v = r(); const sep = Math.min(1, ph / 6); const k = ((x < n / 2 ? 0 : 1) * sep + (v > 0.5 ? 1 : 0) * (1 - sep)) > 0.5; ctx.fillStyle = k ? c : '#f59e42'; ctx.globalAlpha = r() < 0.1 ? 0.15 : 0.8; ctx.fillRect(8 + x * s + 1, 8 + y * s + 1, s - 2, s - 2); } },
    net(ctx, w, h, t, c, r) { const P = []; for (let i = 0; i < 16; i++) P.push([10 + r() * (w - 20), 10 + r() * (h * 0.7 - 10)]); ctx.globalAlpha = 0.25; ctx.strokeStyle = c; ctx.lineWidth = 1; for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) if (r() < 0.2) { ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke(); } const lit = Math.floor((t / 350) % 16); for (let i = 0; i < 16; i++) { const on = (i * 7) % 16 <= ((t / 350) % 16); ctx.globalAlpha = on ? 0.95 : 0.4; ctx.fillStyle = on ? '#e5484d' : c; ctx.beginPath(); ctx.arc(P[i][0], P[i][1], on ? 3.2 : 2.2, 0, 7); ctx.fill(); } },
    drift(ctx, w, h, t, c, r) { const n = 7; for (let i = 0; i < n; i++) { const ya = 12 + r() * (h * 0.66), yb = 12 + r() * (h * 0.66); const p = Math.min(1, Math.max(0, (t / 4000 + i / n) % 1.4)); ctx.globalAlpha = 0.5; ctx.strokeStyle = c; ctx.lineWidth = 1; if (p > 0.5) { ctx.beginPath(); ctx.moveTo(w * 0.25, ya); ctx.lineTo(w * 0.75, yb); ctx.stroke(); } ctx.globalAlpha = 0.9; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w * 0.25, ya, 2.6, 0, 7); ctx.fill(); ctx.fillStyle = '#f59e42'; ctx.beginPath(); ctx.arc(w * 0.75, yb, 2.6, 0, 7); ctx.fill(); } },
    tri(ctx, w, h, t, c, r) { const rows = [1, 3, 5, 7, 9]; rows.forEach((n, i) => { for (let k = 0; k < n; k++) { const v = r() * 0.6 + 0.2 + 0.2 * Math.sin(t / 900 + i); ctx.fillStyle = v > 0.6 ? c : v > 0.4 ? '#f5c451' : '#e5484d'; ctx.globalAlpha = 0.85; const s = (w - 20) / 9; ctx.beginPath(); ctx.arc(w / 2 + (k - (n - 1) / 2) * s, 14 + i * (h * 0.62 / 4), s * 0.32, 0, 7); ctx.fill(); } }); },
    vote(ctx, w, h, t, c, r) { const cols = ['#e5484d', '#f59e42', c, '#1fa463']; for (let i = 0; i < 4; i++) { let x = 10; const y = 12 + i * (h * 0.66 / 4), bh = h * 0.66 / 4 - 5; const sh = [0.35 + 0.1 * Math.sin(t / 800 + i), 0.3, 0.2, 0.15]; sh.forEach((s, k) => { ctx.fillStyle = cols[(k + i) % 4]; ctx.globalAlpha = 0.85; ctx.fillRect(x, y, s * (w - 20) - 1, bh); x += s * (w - 20); }); } },
    ring(ctx, w, h, t, c) { const cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.3; ctx.strokeStyle = '#dfe4ee'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); for (let i = 0; i < 22; i++) { const base = (i / 22) * 6.28, jam = Math.sin(base * 2 - t / 600); const a = base + t / 2500 - (jam > 0.6 ? 0 : 0); const slow = Math.sin(base * 2 - t / 600) > 0.5; ctx.fillStyle = slow ? '#e5484d' : '#1fa463'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 2.6, 0, 7); ctx.fill(); } },
    wave(ctx, w, h, t, c) { ctx.globalAlpha = 0.9; for (let i = 0; i < 18; i++) { const v = 0.5 + 0.35 * Math.sin(i * 1.7 + t / 500) * Math.sin(i * 0.3); ctx.fillStyle = v > 0.6 ? '#e5484d' : c; ctx.fillRect(8 + i * ((w - 16) / 18), h * 0.74 - v * h * 0.55, (w - 16) / 18 - 1.5, v * h * 0.55); } ctx.setLineDash([3, 2]); ctx.strokeStyle = '#1b1f2a'; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(8, h * 0.74 - 0.6 * h * 0.55); ctx.lineTo(w - 8, h * 0.74 - 0.6 * h * 0.55); ctx.stroke(); ctx.setLineDash([]); },
    grid2(ctx, w, h, t, c, r) { const n = 10, s = (w - 16) / n, ph = (t / 5000) % 1; for (let y = 0; y < n * 0.78; y++) for (let x = 0; x < n; x++) { const v = r(); const red = v < 0.2 + 0.5 * Math.sin(ph * 3.14); ctx.fillStyle = red ? '#e5484d' : v > 0.75 ? '#1fa463' : c; ctx.globalAlpha = 0.85; ctx.fillRect(8 + x * s + 1, 8 + y * s + 1, s - 2, s - 2); } },
    pulse(ctx, w, h, t, c, r) { ctx.fillStyle = '#0f1222'; ctx.globalAlpha = 1; ctx.fillRect(0, 0, w, h); const sync = Math.min(1, (t % 9000) / 6000); for (let i = 0; i < 26; i++) { const x = 8 + r() * (w - 16), y = 8 + r() * (h * 0.7); const own = r() * 6.28; const ph = (t / 1400) * 6.28 + own * (1 - sync); const g = Math.max(0, Math.cos(ph)); ctx.fillStyle = '#ffe28a'; ctx.globalAlpha = 0.15 + g * 0.85; ctx.beginPath(); ctx.arc(x, y, 1.6 + g * 2.2, 0, 7); ctx.fill(); } },
    stripes(ctx, w, h, t, c) { ctx.globalAlpha = 0.9; const k = 5 + 2 * Math.sin(t / 3000); for (let y = 0; y < h * 0.78; y += 3) for (let x = 0; x < w; x += 3) { const v = Math.sin(x / k + Math.sin(y / 9 + t / 2000) * 3 + y / 14); ctx.fillStyle = v > 0.2 ? '#1b1f2a' : '#f3f4f6'; ctx.fillRect(x, y, 3, 3); } },
    spread(ctx, w, h, t, c, r) { const n = 10, s = (w - 16) / n, ph = (t / 6000) % 1; const front = ph * 1.4; for (let y = 0; y < n * 0.78; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x - 1, y - 1) / n + r() * 0.15; const on = d < front; ctx.fillStyle = on ? c : '#dfe4ee'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(8 + x * s + s / 2, 8 + y * s + s / 2, s * 0.32, 0, 7); ctx.fill(); } },
    handshake(ctx, w, h, t, c, r) { const n = 9, s = (w - 16) / n, ph = (t / 7000) % 1; for (let y = 0; y < n * 0.78; y++) for (let x = 0; x < n; x++) { const v = r(); const coop = v < 0.15 + 0.8 * Math.min(1, ph * 1.5); ctx.fillStyle = coop ? '#1fa463' : '#e5484d'; ctx.globalAlpha = 0.85; ctx.fillRect(8 + x * s + 1, 8 + y * s + 1, s - 2, s - 2); } },
    letters(ctx, w, h, t, c, r) { const T = 'TO BE OR NOT TO BE'; const k = Math.floor((t / 350) % (T.length + 6)); ctx.font = '700 11px Menlo, monospace'; ctx.textAlign = 'center'; for (let i = 0; i < T.length; i++) { const ok = i < k; const ch = ok ? T[i] : (T[i] === ' ' ? ' ' : String.fromCharCode(65 + Math.floor(r() * 26 + t / 200 + i) % 26)); ctx.fillStyle = ok ? '#1fa463' : '#9aa3b5'; ctx.globalAlpha = 1; ctx.fillText(ch, 10 + (i % 9) * ((w - 20) / 9) + (w - 20) / 18, 26 + Math.floor(i / 9) * 22); } },
    spiral(ctx, w, h, t, c) { const cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.3; for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.28; const hue = ((i / 40) * 360 + t / 20) % 360; ctx.fillStyle = `hsl(${hue} 80% 55%)`; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 2.4, 0, 7); ctx.fill(); } const ta = (t / 2000) % 6.28; for (let k = 0; k < 3; k++) { const a = ta + k * 2.1; ctx.fillStyle = `hsl(${((a / 6.28) * 360) % 360} 85% 50%)`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6, 4, 0, 7); ctx.fill(); } },
    tiles(ctx, w, h, t, c, r) { const n = 5, s = (w - 16) / n, ph = (t / 8000) % 1; for (let y = 0; y < 4; y++) for (let x = 0; x < n; x++) { const own = r() * 360, hue = own * (1 - ph) + 215 * ph; ctx.fillStyle = `hsl(${hue} 70% 60%)`; ctx.globalAlpha = 0.9; ctx.fillRect(8 + x * s + 1, 8 + y * s + 1, s - 2, s - 2); ctx.fillStyle = `hsl(${(hue + 40) % 360} 70% 40%)`; ctx.beginPath(); ctx.arc(8 + x * s + s / 2 + (r() - 0.5) * s * 0.4, 8 + y * s + s / 2 + (r() - 0.5) * s * 0.4, s * 0.2, 0, 7); ctx.fill(); } },
    tri2(ctx, w, h, t, c) { const ph = (t / 8000) % 1; const rows = 14; for (let i = 0; i < rows; i++) { const age = i / rows; const young = Math.pow(1 - age, 0.6), old = 0.4 + 0.6 * Math.exp(-Math.pow((age - 0.75) * 4, 2)); const v = young * (1 - ph) + old * ph; ctx.fillStyle = age > 0.65 ? '#e0a100' : c; ctx.globalAlpha = 0.85; const bw = v * (w - 20) * 0.5; ctx.fillRect(w / 2 - bw, 10 + (rows - 1 - i) * (h * 0.66 / rows), bw * 2, h * 0.66 / rows - 1.5); } },
    heat(ctx, w, h, t, c, r) { const n = 9, s = (w - 16) / n, ph = (t / 7000) % 1; for (let y = 0; y < n * 0.78; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x - 4, y - 3) / 5; const v = Math.max(0, Math.min(1, (ph * 1.6 - d) * 1.5 + r() * 0.2)); const bust = ph > 0.8 ? (ph - 0.8) * 5 : 0; const vv = v * (1 - bust * 0.8); ctx.fillStyle = `rgb(${Math.round(230 - vv * 60)},${Math.round(230 - vv * 170)},${Math.round(240 - vv * 180)})`; ctx.globalAlpha = 1; ctx.fillRect(8 + x * s + 0.5, 8 + y * s + 0.5, s - 1, s - 1); } },
  };
  function drawGlyph(canvas, kind, color, t) {
    const { ctx, w, h } = fit(canvas); ctx.clearRect(0, 0, w, h);
    const r = mulberry32(kind.length * 977 + 3);
    (GLYPH[kind] || GLYPH.bars)(ctx, w, h, t, color, r); ctx.globalAlpha = 1;
  }
  let visible = new Set();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { rootMargin: '80px' });
    tiles.forEach((el) => io.observe(el));
  } else tiles.forEach((el) => visible.add(el));
  let last = 0;
  function glyphLoop(now) {
    if (now - last > 66) { last = now; for (const el of visible) drawGlyph(el.querySelector('.glyph'), el.dataset.kind, getComputedStyle(el).getPropertyValue('--c').trim(), now); if (current) drawGlyph(nbCanvas, current.dataset.kind, getComputedStyle(current).getPropertyValue('--c').trim(), now); }
    if (!reduce) requestAnimationFrame(glyphLoop);
  }
  // ---------- ③ 실험 노트 ----------
  const nbCanvas = document.getElementById('nbcanvas'), nbTitle = document.getElementById('nbtitle'), nbDesc = document.getElementById('nbdesc');
  const nbModel = document.getElementById('nbmodel'), nbGo = document.getElementById('nbgo'), nbSym = document.getElementById('nbsym');
  const tagToday = document.getElementById('nbtag-today'), tagSel = document.getElementById('nbtag-sel');
  let current = null, pinned = null;
  function show(el, isToday) {
    current = el;
    const g = (cls) => { const s = el.querySelector('.' + cls); return en ? (s.getAttribute('data-en') || s.innerHTML) : s.innerHTML; };
    nbTitle.innerHTML = g('t-title'); nbDesc.innerHTML = g('t-desc'); nbModel.innerHTML = g('t-model');
    nbGo.href = el.getAttribute('href'); nbSym.textContent = el.querySelector('.sym').textContent;
    document.querySelector('.nb-visual').style.background = `linear-gradient(135deg, #0f1222, ${getComputedStyle(el).getPropertyValue('--c').trim()}66)`;
    tagToday.hidden = !isToday; tagSel.hidden = !!isToday;
    tiles.forEach((x) => x.classList.toggle('active', x === el));
    if (reduce) drawGlyph(nbCanvas, el.dataset.kind, getComputedStyle(el).getPropertyValue('--c').trim(), 2000);
  }
  if (tiles.length && nbCanvas) {
    const day = Math.floor(Date.now() / 864e5);
    const today = tiles[day % tiles.length];
    show(today, true);
    tiles.forEach((el) => {
      el.addEventListener('mouseenter', () => show(el, el === today && !pinned));
      el.addEventListener('focus', () => show(el, el === today && !pinned));
    });
    document.querySelector('.ptable').addEventListener('mouseleave', () => show(pinned || today, !pinned));
    const rand = document.getElementById('rand');
    if (rand) rand.addEventListener('click', () => { pinned = tiles[Math.floor(Math.random() * tiles.length)]; show(pinned, false); document.getElementById('nb').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    requestAnimationFrame(glyphLoop);
  }
})();
