(function () {
  'use strict';
  const W = window.Farming, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const Q = (k) => (location.search.match(new RegExp('[?&]' + k + '=([a-z0-9.]+)')) || [])[1]; // 확인용: ?t=연수(그 시점으로 바로 가서 멈춤) ?b=sea|mountain ?view=anc
  if (Q('b')) $('barrier').value = Q('b'); if (Q('view')) $('view').value = Q('view');
  const JUMP = THUMB_JUMP();
  function THUMB_JUMP() { return Q('t') ? +Q('t') : /[?&]thumb=1/.test(location.search) ? 600 : 0; }
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 전선이 대륙 절반쯤 퍼진 장면으로 바로 간다
  const GREEN = '#1fa463', RED = '#e5484d', GRAY = '#8a93a6';
  let sweepTimer = 0, sim = null, sweep = [], seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), r: Number($('r').value) / 1000, D: Number($('D').value), mix: Number($('mix').value) / 100, barrier: $('barrier').value });
  const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);

  // ---------- 색 ----------
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const RAMP = ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#9fda3a', '#bddf26'].map(hex); // 도착이 이를수록 진한 보라, 늦을수록 연두 (viridis 앞쪽)
  const BAND = 100, NB = 10; // 100년마다 한 띠
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const bandColor = (b) => { const u = Math.min(1, b / (NB - 1)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(u)); return lerp(RAMP[i], RAMP[i + 1], u - i); };
  const LAND = hex('#e8dcc0'), SEA = hex('#bcd7ee'), SEA2 = hex('#d3e5f5'), MIG = hex('#e07b39'), LOC = hex('#1b8a8f');
  const S = 2; // 격자 한 칸을 가로세로 2픽셀로 그린다
  let off = null, offCtx = null;

  function drawMap() {
    const cw = $('c-map').clientWidth || 700, mapH = Math.round(cw * sim.ny / sim.nx), legendH = THUMB ? 0 : 52;
    const c = L.chart($('c-map'), (mapH + legendH) / cw, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w } = c;
    const nx = sim.nx, ny = sim.ny, Wp = nx * S, Hp = ny * S, F = sim.F, G = sim.G, T = sim.T, land = sim.land;
    if (!off) { off = document.createElement('canvas'); off.width = Wp; off.height = Hp; offCtx = off.getContext('2d'); }
    const img = offCtx.createImageData(Wp, Hp), d = img.data, anc = $('view').value === 'anc';
    const idxRow = new Int16Array(Wp), idxPrev = new Int16Array(Wp).fill(-2);
    const cl = (v, m) => (v < 0 ? 0 : v > m ? m : v);
    for (let py = 0; py < Hp; py++) {
      let left = -2;
      for (let px = 0; px < Wp; px++) {
        const gx = (px + 0.5) / S - 0.5, gy = (py + 0.5) / S - 0.5, i0 = Math.floor(gx), j0 = Math.floor(gy), a = gx - i0, b = gy - j0;
        const ia = cl(i0, nx - 1), ib = cl(i0 + 1, nx - 1), ja = cl(j0, ny - 1), jb = cl(j0 + 1, ny - 1);
        const k00 = ja * nx + ia, k10 = ja * nx + ib, k01 = jb * nx + ia, k11 = jb * nx + ib;
        const kn = cl(Math.round(gy), ny - 1) * nx + cl(Math.round(gx), nx - 1);
        let col, idx = -1;
        if (!land[kn]) {
          col = ((px + py) % 14 < 2) ? SEA2 : SEA;
        } else {
          const w00 = (1 - a) * (1 - b) * land[k00], w10 = a * (1 - b) * land[k10], w01 = (1 - a) * b * land[k01], w11 = a * b * land[k11], ws = w00 + w10 + w01 + w11 || 1;
          const f = (F[k00] * w00 + F[k10] * w10 + F[k01] * w01 + F[k11] * w11) / ws;
          if (f >= 0.5) {
            if (anc) {
              const g = (G[k00] * w00 + G[k10] * w10 + G[k01] * w01 + G[k11] * w11) / ws;
              col = lerp(MIG, LOC, Math.max(0, Math.min(1, g / f)));
            } else {
              let tw = 0, tt = 0;
              const add = (k, wgt) => { if (wgt > 0 && T[k] < Infinity) { tw += wgt; tt += wgt * T[k]; } };
              add(k00, w00); add(k10, w10); add(k01, w01); add(k11, w11);
              const t = tw > 0 ? tt / tw : sim.t; idx = Math.floor(t / BAND); col = bandColor(idx);
            }
          } else if (f > 0.08) {
            const base = anc ? MIG : bandColor(Math.floor(sim.t / BAND)); col = lerp(LAND, base, 0.55 * (f - 0.08) / 0.42);
          } else col = LAND;
          if (sim.params.barrier === 'mountain' && sim.dm[kn] < 1) { col = lerp(col, [120, 100, 90], ((px + py) % 8 < 3) ? 0.45 : 0.22); }
        }
        idxRow[px] = idx;
        if (!anc && idx >= 0 && ((left >= 0 && left !== idx) || (idxPrev[px] >= 0 && idxPrev[px] !== idx))) col = [col[0] * 0.62, col[1] * 0.62, col[2] * 0.62]; // 띠 사이 등고선
        left = idx;
        const o = (py * Wp + px) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
      idxPrev.set(idxRow);
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, mapH);
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, mapH - 1);
    const kx = w / (nx * sim.dx), ox = sim.ox * kx, oy = sim.oy * kx;
    // 기원지 별표
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1d26'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let q = 0; q < 10; q++) { const rr = q % 2 ? 4 : 9, ang = -Math.PI / 2 + q * Math.PI / 5; ctx[q ? 'lineTo' : 'moveTo'](ox + 9 + rr * Math.cos(ang), oy + rr * Math.sin(ang)); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (THUMB) return;
    ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#1a1d26';
    L.label(ctx, '기원지', ox + 22, oy + 4, 'left');
    ctx.font = '12px ' + FONT;
    const bar = sim.params.barrier;
    if (bar === 'sea') { ctx.textAlign = 'center'; ctx.fillStyle = '#1a1d26'; L.label(ctx, '해협', (W.BAR.x0 + 2) * sim.dx * kx, mapH * 0.62, 'center'); L.label(ctx, '땅다리', (W.BAR.x0 + 2) * sim.dx * kx, W.BAR.gapB * 0.5 * sim.dx * kx + 4, 'center'); }
    if (bar === 'mountain') { ctx.textAlign = 'center'; ctx.fillStyle = '#1a1d26'; L.label(ctx, '산맥', ((W.BAR.mx0 + W.BAR.mx1) / 2) * sim.dx * kx, mapH * 0.5, 'center'); }
    // 축척 막대 200km
    const sb = 200 * kx; ctx.strokeStyle = '#1a1d26'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w - 14 - sb, mapH - 14); ctx.lineTo(w - 14, mapH - 14); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillStyle = '#1a1d26'; L.label(ctx, '200 km', w - 14, mapH - 20, 'right');
    ctx.textAlign = 'left'; ctx.font = '600 13px ' + FONT; L.label(ctx, `${Math.round(sim.t)}년째`, 10, 20, 'left');
    // 범례
    ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = css('--muted');
    const ly = mapH + 8, lw = w - 2;
    if (anc) {
      const gr = ctx.createLinearGradient(0, 0, lw, 0); gr.addColorStop(0, `rgb(${MIG})`); gr.addColorStop(1, `rgb(${LOC})`);
      ctx.fillStyle = gr; ctx.fillRect(1, ly, lw, 12);
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('이주해 온 농부의 후손', 1, ly + 28); ctx.textAlign = 'right'; ctx.fillText('토착 수렵채집민의 후손', w - 1, ly + 28);
    } else {
      const sw = lw / NB;
      for (let b = 0; b < NB; b++) { ctx.fillStyle = `rgb(${bandColor(b)})`; ctx.fillRect(1 + b * sw, ly, sw + 0.5, 12); }
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left';
      const step = w < 520 ? 3 : 1;
      for (let b = 0; b <= NB; b += step) { ctx.textAlign = b === 0 ? 'left' : b === NB ? 'right' : 'center'; ctx.fillText(b === NB ? `${b * BAND}+` : String(b * BAND), 1 + b * sw, ly + 26); }
      ctx.textAlign = 'right'; ctx.fillText(w < 520 ? '도착 시각 (년, 한 띠 = 100년)' : '도착 시각: 기원지를 떠난 뒤 지난 햇수 (한 띠 = 100년)', w - 6, ly + 42);
    }
  }

  // 공통: 차트 틀
  function xmaxYears() { const c = Math.max(0.3, W.speedEff(sim.params)); return Math.min(3000, Math.max(400, Math.ceil((1000 / c) * 1.15 / 200) * 200)); }

  // ---------- ② 전선의 위치 ----------
  function drawFront() {
    const P = sim.params, X1 = xmaxYears(), hs = sim.hist, YM = 1000;
    const c = L.chart($('c-front'), 0.62, { l: 52, b: 40, r: 16, t: 24 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v / X1) * pw, Y = (v) => m.t + ph - (v / YM) * ph, xt = []; for (let v = 0; v <= X1; v += X1 > 1400 ? 500 : 200) xt.push(v);
    L.axes(c, { X, Y, yTicks: [0, 250, 500, 750, 1000], yFmt: (v) => String(v), xTicks: xt, xFmt: (v) => String(v), xLabel: '지난 햇수 (년)', yLabel: '기원지에서 전선까지 거리 (km)' });
    if (P.barrier !== 'none') { // 장벽이 놓인 거리
      const d0 = (P.barrier === 'sea' ? W.BAR.x0 : W.BAR.mx0) * sim.dx - sim.ox, d1 = (P.barrier === 'sea' ? W.BAR.x1 : W.BAR.mx1) * sim.dx - sim.ox;
      ctx.fillStyle = P.barrier === 'sea' ? 'rgba(120,170,220,0.28)' : 'rgba(130,110,95,0.25)'; ctx.fillRect(m.l, Y(d1), pw, Y(d0) - Y(d1));
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = '12px ' + FONT; ctx.fillText(P.barrier === 'sea' ? '해협' : '산맥', m.l + 6, (Y(d0) + Y(d1)) / 2 + 4);
    }
    ctx.font = '12px ' + FONT;
    const cB = W.speedBase(P), cE = W.speedEff(P), oR = P.originR;
    const th = (cc, col) => { ctx.setLineDash([6, 4]); L.line(ctx, [[X(0), Y(oR)], [X(Math.min(X1, (YM - oR) / cc)), Y(Math.min(YM, oR + cc * X1))]], col, 2); ctx.setLineDash([]); };
    const lg = [{ kind: 'line', color: css('--accent'), label: '시뮬레이션에서 잰 전선' }];
    if (P.mix > 0.04) { th(cE, RED); lg.push({ kind: 'dash', color: RED, label: `이론, 토착민 흡수 반영 ${f2(cE)} km/년` }); }
    th(cB, GREEN); lg.push({ kind: 'dash', color: GREEN, label: `이론 2√(rD) = ${f2(cB)} km/년` });
    L.line(ctx, hs.t.map((t, i) => [X(t), Y(hs.R[i])]), css('--accent'), 3);
    if (hs.t.length) { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(sim.t), Y(sim.Rmax), 4, 0, 7); ctx.fill(); }
    L.legend(c, lg, 'tl');
  }

  // ---------- ③ 칸마다 도착 시각 ----------
  function drawArrive() {
    const P = sim.params, X1 = xmaxYears(), YM = 1000;
    const c = L.chart($('c-arrive'), 0.62, { l: 52, b: 40, r: 16, t: 24 }), { ctx, m, pw, ph } = c;
    const Xd = (v) => m.l + (v / YM) * pw, Yt = (v) => m.t + ph - (v / X1) * ph, yt = []; for (let v = 0; v <= X1; v += X1 > 1400 ? 500 : 200) yt.push(v);
    L.axes(c, { X: Xd, Y: Yt, yTicks: yt, yFmt: (v) => String(v), xTicks: [0, 250, 500, 750, 1000], xFmt: (v) => String(v), xLabel: '기원지에서의 거리 (km)', yLabel: '도착 시각 (년)' });
    ctx.fillStyle = mix(css('--accent'), 0.45);
    for (let j = 0; j < sim.ny; j += 1) for (let i = 0; i < sim.nx; i += 1) {
      const k = j * sim.nx + i, t = sim.T[k]; if (!(t < Infinity) || ((i + j * 3) % 2)) continue;
      ctx.beginPath(); ctx.arc(Xd(sim.dist[k]), Yt(t), 1.7, 0, 7); ctx.fill();
    }
    const cB = W.speedBase(P), oR = P.originR;
    ctx.setLineDash([6, 4]); L.line(ctx, [[Xd(oR), Yt(0)], [Xd(Math.min(YM, oR + cB * X1)), Yt(Math.min(X1, (YM - oR) / cB))]], GREEN, 2); ctx.setLineDash([]);
    L.legend(c, [{ kind: 'dot', color: mix(css('--accent'), 0.45), label: '지도의 칸 하나' }, { kind: 'dash', color: GREEN, label: '이론의 직선 (기울기 = 1 ÷ 2√(rD))' }], 'tl');
  }

  // ---------- ④ 성장률을 바꾸면 ----------
  function drawSweep() {
    const P = sim.params, R0 = 10, R1 = 40;
    const lg = [{ kind: 'dot', color: css('--accent'), label: '시뮬레이션에서 잰 값' }, { kind: P.mix > 0.04 ? 'dash' : 'line', color: GREEN, label: '이론 2√(rD)' }];
    if (P.mix > 0.04) lg.push({ kind: 'line', color: RED, label: '토착민 흡수를 반영한 이론' });
    lg.push({ kind: 'dash', color: css('--rich'), label: '지금 설정' });
    const sp = L.belowSpace($('c-sweep'), lg), c = L.chart($('c-sweep'), 0.62 + sp.extra / ($('c-sweep').clientWidth || 400), { l: 52, b: sp.b, r: 16, t: 24 }), { ctx, m, pw, ph } = c;
    const mxv = Math.max(4.0, ...sweep.map((d) => d.v || 0)), YM = Math.ceil(mxv * 2) / 2;
    const X = (v) => m.l + ((v - R0) / (R1 - R0)) * pw, Y = (v) => m.t + ph - (v / YM) * ph, yt = []; for (let v = 0; v <= YM + 1e-9; v += 0.5) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => v.toFixed(1), xTicks: [10, 15, 20, 25, 30, 35, 40], xFmt: (v) => (v / 10).toFixed(1), xLabel: '인구 증가율 r (% / 년)', yLabel: '전선 속도 (km/년)' });
    const curve = (fn, col, dash) => { const pts = []; for (let v = R0; v <= R1; v += 1) pts.push([X(v), Y(fn(v / 1000))]); ctx.setLineDash(dash ? [6, 4] : []); L.line(ctx, pts, col, 2); ctx.setLineDash([]); };
    if (P.mix > 0.04) curve((r) => W.speedEff({ r, D: P.D, mix: P.mix, kappa: P.kappa, h0: P.h0 }), RED, false);
    curve((r) => 2 * Math.sqrt(r * P.D), GREEN, P.mix > 0.04);
    ctx.fillStyle = css('--accent');
    sweep.forEach((d) => { if (d.v == null) return; ctx.beginPath(); ctx.arc(X(d.r * 1000), Y(d.v), 4.5, 0, 7); ctx.fill(); });
    L.vline(c, X(P.r * 1000), css('--rich'), '', 'left');
    L.drawLegendBelow(c, lg);
  }

  function renderStats() {
    const P = sim.params, m = sim.speed(), cB = W.speedBase(P), cE = W.speedEff(P), cover = sim.hist.cover.at(-1);
    const cards = [
      ['퍼지는 속도 (시뮬레이션에서 잰 값)', m == null ? '재는 중…' : `${f2(m)} km/년`, `이론 2√(rD) = ${f2(cB)} · 토착민 흡수를 반영하면 ${f2(cE)} km/년`],
      ['한 세대(25년)에 퍼지는 거리', m == null ? '재는 중…' : `약 ${Math.round(m * 25)} km`, '한 세대를 25년으로 본 단순 환산'],
      ['농사짓는 땅', `${Math.round(cover * 100)}%`, `${Math.round(sim.t)}년 경과 · 기원지에서 전선까지 ${Math.round(sim.Rmax)} km`],
      ['농부 가운데 토착 수렵채집민의 후손', `${Math.round(sim.hist.gShare.at(-1) * 100)}%`, `수렵채집 인구의 남은 몫 ${Math.round(sim.hist.hLeft.at(-1) * 100)}% (흡수되거나 밀려남)`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  let frame = 0;
  function draw() { // 재생 중에는 무거운 그래프를 3번에 한 번만 다시 그린다
    renderStats(); drawMap();
    if (++frame % 3 === 0 || sim.done() || THUMB) { drawFront(); drawArrive(); if (sweep.length) drawSweep(); }
    $('when').textContent = `${Math.round(sim.t)}년째 · ${sim.done() ? '끝' : '번지는 중'}`;
  }

  function after() {
    const P = params(), rs = [10, 15, 20, 25, 30, 35, 40]; sweep = [];
    if (THUMB) return;
    clearTimeout(sweepTimer); sweepTimer = setTimeout(() => L.jobs(rs.map((r) => () => { sweep.push({ r: r / 1000, v: W.speed1D({ r: r / 1000, D: P.D, mix: P.mix }) }); }), () => { if (sim) drawSweep(); }), 2500);
  }

  const h = L.harness({
    controls: ['r', 'D', 'mix', 'barrier'],
    format: { r: (v) => `연 ${(v / 10).toFixed(1)}%`, D: (v) => `${v} km²/년`, mix: (v) => `${v}%`, barrier: () => '' },
    defaults: { r: 25, D: 10, mix: 50, barrier: 'none' },
    build() {
      sim = W.create(params()); frame = 2;
      if (JUMP) { while (sim.t < JUMP && sim.advance(5)); }
    },
    autoplay: !JUMP,
    advance() { return sim.advance(5); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawSweep(); }, seedLabel: '땅의 번호',
  });
  seedGetter = h.seed;
  $('view').addEventListener('change', () => { if (sim) draw(); });
})();
