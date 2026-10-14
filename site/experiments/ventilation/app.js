(function () {
  'use strict';
  const VT = window.Ventilation, L = window.Lab;
  const { css, mix, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 맑은 공기가 방을 가로지르는 중간 장면으로 바로 간다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0); // 확인용: ?t=걸음 (그 시점으로 바로 가서 멈춤)
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const CLEAN = [226, 244, 255], STALE = [140, 104, 70];           // 맑음 ↔ 탁함 (색 2종)
  const WALL = '#334155', OUTSIDE = '#f5f8fc', DOT = '#1e3a8a', PERSON = '#111827';
  const C_IN = '#0284c7', C_OUT = '#b45309', C_NONE = '#64748b';
  const COL = { one: '#94a3b8', same: '#b45309', adjacent: '#7c3aed', opposite: '#0284c7' };
  const LAY = [['one', '창 1개'], ['same', '같은 벽 2개'], ['adjacent', '옆 벽 2개'], ['opposite', '마주 보는 벽 2개']];
  const WALLNAME = { L: '왼쪽 벽', R: '오른쪽 벽', T: '위쪽 벽', B: '아래쪽 벽' };
  const WINDNAME = ['아주 약한 바람', '약한 바람', '보통 바람', '센 바람', '아주 센 바람'];
  const DIRNAME = { front: '정면', diag: '비스듬히', side: '옆' };
  const ADV = 10;                    // 한 번 진행할 때의 걸음 수
  const TMAX = VT.STEPS / VT.UNIT;   // 한 판의 시간 (모델 단위)
  let sim = null, seedGetter = () => 1, chartTimer = 0, lastChart = 0;
  const params = () => ({
    seed: seedGetter(), count: Number($('count').value), layout: $('layout').value, gap: Number($('gap').value),
    wind: Number($('wind').value), dir: $('dir').value, door: $('door').value, src: $('src').value,
  });
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const fmtT = (v) => (v == null ? '' : v < 10 ? v.toFixed(1) : String(Math.round(v)));

  // ---------- 공기 흐름을 따라 움직이는 점 (그림용, 계산 결과에 영향 없음) ----------
  const NP = 260, PX = new Float32Array(NP), PY = new Float32Array(NP), PL = new Int32Array(NP);
  function vel(x, y) {   // 칸 가운데 속도의 쌍선형 보간 (칸/걸음)
    const NX = sim.NX, gx = x - 0.5, gy = y - 0.5, i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
    let u = 0, v = 0;
    for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= NX || j >= sim.NY) continue;
      const k = j * NX + i, w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy);
      if (sim.type[k] === 2) continue; u += w * sim.ux[k]; v += w * sim.uy[k];
    }
    return [u, v];
  }
  function spawn(k) {
    const ins = sim.ops.filter((o) => o.q > 1e-6), tot = ins.reduce((a, o) => a + o.q, 0);
    if (ins.length && Math.random() < 0.5) {
      let r = Math.random() * tot, o = ins[0]; for (const q of ins) { r -= q.q; if (r <= 0) { o = q; break; } }
      const c = o.cells[Math.floor(Math.random() * o.cells.length)], cx = c % sim.NX, cy = Math.floor(c / sim.NX);
      const n = { L: [1, 0], R: [-1, 0], T: [0, 1], B: [0, -1] }[o.wall];
      PX[k] = cx + 0.5 + n[0] * 0.7 + (n[0] ? 0 : Math.random() - 0.5); PY[k] = cy + 0.5 + n[1] * 0.7 + (n[1] ? 0 : Math.random() - 0.5);
    } else { PX[k] = sim.X0 + Math.random() * sim.W; PY[k] = sim.Y0 + Math.random() * sim.H; }
    PL[k] = 250 + Math.floor(Math.random() * 600);
  }
  function moveDots(n) {
    for (let k = 0; k < NP; k++) {
      for (let s = 0; s < n; s++) {
        const [u, v] = vel(PX[k], PY[k]); PX[k] += u; PY[k] += v; PL[k]--;
        const cx = Math.floor(PX[k]), cy = Math.floor(PY[k]);
        const bad = cx < 0 || cy < 0 || cx >= sim.NX || cy >= sim.NY || sim.type[cy * sim.NX + cx] !== 1;
        if (bad || PL[k] <= 0) { spawn(k); break; }
      }
    }
  }
  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim과 같은 점을 그대로 보여 준다(3D는 따로 계산하지 않음)
  function share() { window.VentState = { sim, px: PX, py: PY, np: NP, vel, isPaused, thumb: THUMB }; }

  // ---------- ① 방 평면 ----------
  let off = null, offCtx = null, img = null;
  function airColor(c) { const t = Math.max(0, Math.min(1, c / 100)); return [CLEAN[0] + (STALE[0] - CLEAN[0]) * t, CLEAN[1] + (STALE[1] - CLEAN[1]) * t, CLEAN[2] + (STALE[2] - CLEAN[2]) * t]; }
  const rgb = (a) => `rgb(${Math.round(a[0])},${Math.round(a[1])},${Math.round(a[2])})`;
  function personPath(ctx, x, y, h) {   // 사람 픽토그램: 머리 + 어깨/몸통 (발 끝이 y)
    const r = h * 0.22, bw = h * 0.62;
    ctx.beginPath(); ctx.arc(x, y - h + r, r, 0, 7);
    ctx.moveTo(x - bw / 2, y); ctx.lineTo(x - bw / 2, y - h * 0.34); ctx.quadraticCurveTo(x - bw / 2, y - h * 0.58, x, y - h * 0.58);
    ctx.quadraticCurveTo(x + bw / 2, y - h * 0.58, x + bw / 2, y - h * 0.34); ctx.lineTo(x + bw / 2, y); ctx.closePath();
  }
  function chip(ctx, text, x, y, bx, by, color, w, h) {   // 이름표: 글상자(bx,by = 상자 가운데) + 대상(x,y)까지 곧게 이어진 선
    ctx.font = '600 12px ' + FONT;
    const tw = ctx.measureText(text).width + 16, th = 22;
    const x0 = Math.max(3, Math.min(bx - tw / 2, w - tw - 3)), y0 = Math.max(3, Math.min(by - th / 2, h - th - 3));
    const ax = Math.min(Math.max(x, x0), x0 + tw), ay = Math.min(Math.max(y, y0), y0 + th);
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
    ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.18)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; roundRect(ctx, x0, y0, tw, th, th / 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = color; roundRect(ctx, x0, y0, tw, th, th / 2); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, x0 + 8, y0 + 15); ctx.lineWidth = 1;
  }
  function arrow(ctx, x0, y0, x1, y1, color, width) {
    const a = Math.atan2(y1 - y0, x1 - x0), hl = width * 2.6;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * hl * 0.8, y1 - Math.sin(a) * hl * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * hl, y1 - Math.sin(a - 0.45) * hl); ctx.lineTo(x1 - Math.cos(a + 0.45) * hl, y1 - Math.sin(a + 0.45) * hl); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1; ctx.lineCap = 'butt';
  }
  const flowWord = (q) => (q > 1e-6 ? '들어옴' : q < -1e-6 ? '나감' : '드나듦 거의 없음');
  const flowCol = (q) => (q > 1e-6 ? C_IN : q < -1e-6 ? C_OUT : C_NONE);

  function drawRoom() {
    share();
    const cv = $('c-room'), cw = cv.clientWidth || 700, narrow = cw < 640, NX = sim.NX, NY = sim.NY;
    const mgX = THUMB ? 0 : narrow ? 46 : 112, mgY = THUMB ? 0 : narrow ? 40 : 46;
    let cs, sceneW, asp, panelH = 0;
    if (THUMB) { cs = cw / NX; sceneW = cw; asp = 1; }
    else if (narrow) { cs = (cw - 2 * mgX) / NX; sceneW = cw; panelH = 34 + 18 * sim.ops.length + 26 + 74; /* 아래 74px: 휴대폰에서 재생 막대가 덮는 자리 */ asp = (NY * cs + 2 * mgY + panelH) / cw; }
    else { cs = Math.min(10, (cw * 0.64 - 2 * mgX) / NX); sceneW = NX * cs + 2 * mgX; asp = (NY * cs + 2 * mgY) / cw; }
    const { ctx, w, h } = L.setup(cv, asp);
    ctx.fillStyle = OUTSIDE; ctx.fillRect(0, 0, w, h);
    const ox = THUMB ? 0 : mgX, oy = THUMB ? (h - NY * cs) / 2 : mgY;
    const GX = (x) => ox + x * cs, GY = (y) => oy + y * cs;
    // 바깥 바람 줄무늬 (바람 방향을 보여 주는 그림, 바깥 흐름은 계산하지 않음): 시뮬레이션 시간과 함께 움직인다
    const [wx, wy] = sim.wind, ph = (sim.t * 0.06 * sim.U) % 1;
    ctx.strokeStyle = 'rgba(2,132,199,.22)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const sp = THUMB ? 60 : 46, len = THUMB ? 22 : 16;
    for (let gy = -1; gy < h / sp + 1; gy++) for (let gx = -1; gx < w / sp + 1; gx++) {
      const bx = (gx + ((gy % 2) ? 0.5 : 0) + ph * wx) * sp, by = (gy + ph * wy) * sp + (wx ? 0 : 0);
      const inRoom = bx > GX(-1.5) && bx < GX(NX + 1.5) && by > GY(-1.5) && by < GY(NY + 1.5);
      if (inRoom) continue;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + wx * len, by + wy * len); ctx.stroke();
    }
    ctx.lineCap = 'butt'; ctx.lineWidth = 1;
    // 공기 색 (칸마다)
    if (!off || off.width !== NX) { off = document.createElement('canvas'); off.width = NX; off.height = NY; offCtx = off.getContext('2d'); img = offCtx.createImageData(NX, NY); }
    const C = sim.C, T = sim.type, d = img.data;
    for (let i = 0; i < NX * NY; i++) {
      let c = C[i];
      if (T[i] === 2) { const nbs = [i - 1, i + 1, i - NX, i + NX].filter((j) => j >= 0 && j < NX * NY && T[j] !== 2); c = nbs.length ? C[nbs[0]] : 0; }
      const a = airColor(c), o = i * 4; d[o] = a[0]; d[o + 1] = a[1]; d[o + 2] = a[2]; d[o + 3] = 255;
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, GX(0), GY(0), NX * cs, NY * cs);
    // 벽
    ctx.fillStyle = WALL;
    for (let i = 0; i < NX * NY; i++) if (T[i] === 2) { const x = i % NX, y = (i - x) / NX; ctx.fillRect(GX(x) - 0.3, GY(y) - 0.3, cs + 0.6, cs + 0.6); }
    // 흐름을 따라 움직이는 점 (짧은 꼬리 = 흐르는 방향)
    for (let k = 0; k < NP; k++) {
      const [u, v] = vel(PX[k], PY[k]), s = Math.hypot(u, v); if (s < 0.004) continue;
      const a = Math.min(0.9, 0.25 + s * 12), tl = Math.min(3.2, s * 26) / s;
      const x = GX(PX[k]), y = GY(PY[k]);
      ctx.strokeStyle = `rgba(30,58,138,${a})`; ctx.lineWidth = THUMB ? 2.4 : 1.6; ctx.beginPath(); ctx.moveTo(x - u * tl * cs, y - v * tl * cs); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(30,58,138,${a})`; ctx.beginPath(); ctx.arc(x, y, THUMB ? 2.4 : 1.7, 0, 7); ctx.fill();
    }
    ctx.lineWidth = 1;
    // 사람 (숨을 내쉬는 자리)
    const [pxs, pys] = sim.person, ph2 = Math.max(16, cs * 4.2);
    personPath(ctx, GX(pxs + 0.5), GY(pys + 0.5) + ph2 * 0.45, ph2); ctx.fillStyle = PERSON; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    if (THUMB) { // 썸네일: 바람 화살표만 크게
      arrow(ctx, w * 0.04, h * 0.1, w * 0.22, h * 0.1, '#0284c7', 7);
      return;
    }
    // 바람 화살표 (왼쪽 위 바깥)
    const al = narrow ? 44 : 62, ax0 = 10, ay0 = narrow ? 12 : 14;
    const end = sim.params.dir === 'front' ? [ax0 + al, mgY / 2] : sim.params.dir === 'side' ? [mgX / 2, ay0 + al] : [ax0 + al * 0.75, ay0 + al * 0.75];
    const start = sim.params.dir === 'front' ? [ax0, mgY / 2] : sim.params.dir === 'side' ? [mgX / 2, ay0] : [ax0, ay0];
    arrow(ctx, start[0], start[1], end[0], end[1], '#0284c7', narrow ? 4 : 5);
    ctx.font = '700 ' + (narrow ? 12 : 13) + 'px ' + FONT; ctx.fillStyle = '#0369a1'; ctx.textAlign = 'left';
    const wl = WINDNAME[sim.params.wind - 1];
    if (sim.params.dir === 'front') ctx.fillText(wl, ax0 + al + 8, mgY / 2 + 5);
    else ctx.fillText(wl, (sim.params.dir === 'side' ? mgX / 2 : ax0 + al * 0.75) + 10, ay0 + (sim.params.dir === 'side' ? 12 : al * 0.75 + 2));
    // 창 이름표 (바깥쪽, 선으로 틈 가운데와 이어짐)
    sim.ops.forEach((o) => {
      const x = GX(o.x), y = GY(o.y), col = flowCol(o.q);
      const txt = narrow ? `창 ${o.k + 1}` : `창 ${o.k + 1} · ${Math.abs(o.q) > 1e-6 ? flowWord(o.q) : '흐름 없음'}`;
      let bx = x, by = y;
      if (o.wall === 'L') { bx = narrow ? mgX / 2 - 2 : mgX / 2 - 4; by = y + (narrow ? 0 : 0); }
      if (o.wall === 'R') bx = w - (narrow ? mgX / 2 : (w - sceneW) + mgX / 2) + 2;
      if (o.wall === 'T') by = mgY / 2 + (narrow ? 4 : 2);
      if (o.wall === 'B') by = GY(NY) + mgY / 2;
      if (o.wall === 'R' && !narrow) bx = GX(NX) + mgX / 2;
      if (o.wall === 'L' && !narrow) bx = Math.max(52, mgX / 2);
      chip(ctx, txt, x, y, bx, by, col, narrow ? w : sceneW, narrow ? GY(NY) + mgY : h);
    });
    // 방문 (나누는 벽)
    if (sim.params.door !== 'none') {
      const dx = GX(sim.DIV + 0.5), dy = sim.params.door === 'open' ? GY(sim.Y0 + sim.H / 2) : GY(sim.Y0 + sim.H * 0.75);
      chip(ctx, sim.params.door === 'open' ? '방문 열림' : '방문 닫힘', dx, sim.params.door === 'open' ? dy : GY(NY - 1), dx, GY(NY) + mgY / 2, '#334155', sceneW, h);
    }
    // 흐름이 없을 때 안내
    if (sim.inflow < 1e-6) {
      const msg = narrow ? '방 안 공기가 거의 안 흘러요' : '방 안 공기가 거의 흐르지 않아요 (창가에서만 조금씩 섞여요)';
      ctx.font = '600 ' + (narrow ? 11.5 : 13) + 'px ' + FONT; const tw = ctx.measureText(msg).width + 20;
      const cx = GX(NX / 2), cy = GY(NY * 0.16);
      ctx.fillStyle = 'rgba(255,255,255,.88)'; roundRect(ctx, cx - tw / 2, cy - 13, tw, 24, 12); ctx.fill();
      ctx.fillStyle = '#334155'; ctx.textAlign = 'center'; ctx.fillText(msg, cx, cy + 4);
    }
    // 읽는 곳: 데스크톱은 오른쪽, 휴대폰은 아래
    const m = sim.mean(), rx = narrow ? 12 : sceneW + 20, rw = narrow ? w - 24 : w - sceneW - 32;
    let y = narrow ? GY(NY) + mgY + 6 : 40;
    ctx.textAlign = 'left';
    if (!narrow) {
      ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.fillText('지금 방 평균 탁함 (처음 = 100)', rx, y);
      y += 44; ctx.font = '800 40px ' + FONT; ctx.fillStyle = m < 45 ? '#0369a1' : rgb(airColor(m)); ctx.fillText(String(Math.round(m)), rx, y);
      // 0~100 색 띠와 지금 위치
      y += 16; const bw = Math.min(260, rw);
      for (let k = 0; k < bw; k++) { ctx.fillStyle = rgb(airColor((k / bw) * 100)); ctx.fillRect(rx + k, y, 1, 12); }
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; const mx = rx + Math.min(1, m / 100) * bw; ctx.beginPath(); ctx.moveTo(mx, y - 4); ctx.lineTo(mx, y + 16); ctx.stroke(); ctx.lineWidth = 1;
      ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText('맑음 0', rx, y + 28); ctx.textAlign = 'right'; ctx.fillText('100 탁함', rx + bw, y + 28); ctx.textAlign = 'left';
      y += 58; ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.fillText('창마다 드나드는 공기', rx, y); y += 22;
      sim.ops.forEach((o) => {
        ctx.font = '600 13px ' + FONT; ctx.fillStyle = flowCol(o.q);
        ctx.fillText(`창 ${o.k + 1} (${WALLNAME[o.wall]}): ${flowWord(o.q)}`, rx, y); y += 21;
      });
      y += 8; ctx.font = '12px ' + FONT; ctx.fillStyle = css('--text');
      const words = tr(sim.inflow < 1e-6 ? '창끼리 바람 압력이 같아 공기가 가로지르지 못해요' : '압력이 높은 창으로 들어와 낮은 창으로 나가요').split(' ');
      let line = '';
      words.forEach((wd) => { const tst = line ? line + ' ' + wd : wd; if (ctx.measureText(tst).width > rw && line) { ctx.fillText(line, rx, y); y += 17; line = wd; } else line = tst; });
      if (line) ctx.fillText(line, rx, y);
    } else {
      ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.fillText('지금 방 평균 탁함', rx, y + 12);
      ctx.font = '800 22px ' + FONT; ctx.fillStyle = m < 45 ? '#0369a1' : rgb(airColor(m)); ctx.textAlign = 'right'; ctx.fillText(String(Math.round(m)), rx + rw, y + 16); ctx.textAlign = 'left';
      y += 36;
      sim.ops.forEach((o) => { ctx.font = '600 12px ' + FONT; ctx.fillStyle = flowCol(o.q); ctx.fillText(`창 ${o.k + 1} (${WALLNAME[o.wall]}): ${flowWord(o.q)}`, rx, y); y += 18; });
    }
  }

  // ---------- ③ 시간별 방 평균 탁함 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-time'), items = [{ kind: 'line', color: STALE_HEX, label: '방 평균 탁함' }, { kind: 'line', color: C_IN, label: '사람 자리 공기' }, { kind: 'dash', color: '#64748b', label: '처음의 절반 (50)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 34 }), { ctx, m, pw, ph } = c;
    const X = (t) => m.l + (t / TMAX) * pw, Y = (v) => m.t + ph - (Math.min(150, v) / 150) * ph;
    L.axes(c, { X, Y, yTicks: [0, 50, 100, 150], xTicks: [0, 10, 20, 30, 40, 50, 60], xLabel: '시간 (모델 단위)', yLabel: '탁함 (처음 방 = 100)' });
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#64748b'; ctx.beginPath(); ctx.moveTo(m.l, Y(50)); ctx.lineTo(m.l + pw, Y(50)); ctx.stroke(); ctx.setLineDash([]);
    const dt = sim.sample / sim.unit;
    L.line(ctx, sim.histP.map((v, k) => [X(k * dt), Y(v)]), C_IN, 2.2);
    L.line(ctx, sim.hist.map((v, k) => [X(k * dt), Y(v)]), STALE_HEX, 2.8);
    const n = sim.hist.length - 1, tnow = n * dt;
    ctx.fillStyle = STALE_HEX; ctx.beginPath(); ctx.arc(X(tnow), Y(sim.hist[n]), 4, 0, 7); ctx.fill();
    ctx.font = '700 13px ' + FONT; ctx.fillStyle = STALE_HEX; const right = X(tnow) > m.l + pw * 0.85;
    L.label(ctx, String(Math.round(sim.hist[n])), X(tnow) + (right ? -9 : 9), Y(sim.hist[n]) - 8, right ? 'right' : 'left');
    if (sim.half >= 0) L.vline(c, X(sim.half / sim.unit), '#15803d', `절반까지 ${fmtT(sim.half / sim.unit)}`, sim.half / sim.unit > TMAX * 0.6 ? 'right' : 'left');
    ctx.font = '12px ' + FONT; L.drawLegendBelow(c, items);
  }
  const STALE_HEX = '#8c6846';

  // ---------- 집계 비교 (같은 설정에서 끝까지 미리 돌린 판) ----------
  const cache = {};
  const keyOf = (o) => JSON.stringify(o);
  function layoutParams(id, base) { return Object.assign({}, base, id === 'one' ? { count: 1, layout: 'same' } : { count: 2, layout: id }); }
  function baseParams() { const P = params(); delete P.count; delete P.layout; return P; }
  function get(o) { return cache[keyOf(o)]; }
  function calc(o) { const k = keyOf(o); if (!cache[k]) cache[k] = VT.summary(o); return cache[k]; }
  const curLayout = () => { const P = params(); return P.count === 1 ? 'one' : P.count === 2 ? P.layout : null; };

  // ④ 배치별: 절반이 되는 시간 | 끝에 아직 탁한 곳
  function drawLayouts() {
    const cv = $('c-layout'), base = baseParams(), cw = cv.clientWidth || 500, narrow = cw < 560;
    const items = [{ kind: 'box', color: '#0284c7', label: '절반으로 맑아지는 데 걸린 시간' }, { kind: 'box', color: STALE_HEX, label: '끝(시간 60)에 아직 절반 넘게 탁한 곳' }];
    const sp = L.belowSpace(cv, items), rowH = narrow ? 50 : 44, top = 44, labW = narrow ? 0 : 118;
    const hh = top + LAY.length * rowH + sp.b - 20;
    const { ctx, w, h } = L.setup(cv, hh / cw);
    const c = { ctx, w, h, m: { l: 10, r: 10, t: top, b: sp.b }, pw: w - 20, ph: LAY.length * rowH };
    const gap = 18, colW = (w - 20 - labW - gap) / 2, x1 = 10 + labW, x2 = x1 + colW + gap;
    ctx.font = '600 11.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
    ctx.fillText(narrow ? '절반까지 시간' : '절반까지 걸린 시간 (모델 단위)', x1, 18); ctx.fillText(narrow ? '탁한 곳 (%)' : '아직 탁한 곳 (%)', x2, 18);
    ctx.font = '10.5px ' + FONT; ctx.fillStyle = css('--muted');
    [0, 30, 60].forEach((v) => { ctx.textAlign = v === 0 ? 'left' : v === 60 ? 'right' : 'center'; ctx.fillText(String(v), x1 + (v / 60) * colW, 34); });
    [0, 50, 100].forEach((v) => { ctx.textAlign = v === 0 ? 'left' : v === 100 ? 'right' : 'center'; ctx.fillText(String(v), x2 + (v / 100) * colW, 34); });
    const cur = curLayout();
    LAY.forEach(([id, name], r) => {
      const y = top + r * rowH, s = get(layoutParams(id, base)), bh = narrow ? 14 : 18, by = y + (narrow ? 22 : 12);
      if (id === cur) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(4, y + 2, w - 8, rowH - 4); }
      ctx.font = (id === cur ? '700 ' : '600 ') + '12px ' + FONT; ctx.fillStyle = COL[id] === '#94a3b8' ? '#475569' : COL[id]; ctx.textAlign = 'left';
      ctx.fillText(narrow ? name : name, narrow ? 10 : 10, narrow ? y + 16 : by + 13);
      if (id === cur) { ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText('지금 설정', w - 12, narrow ? y + 16 : y + 12); }
      ctx.fillStyle = 'rgba(99,106,122,.10)'; ctx.fillRect(x1, by, colW, bh); ctx.fillRect(x2, by, colW, bh);
      if (!s) { ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('계산 중…', x1 + 6, by + bh - 4); return; }
      ctx.font = '700 12px ' + FONT;
      if (s.half != null) {
        const bw = (s.half / 60) * colW; ctx.fillStyle = '#0284c7'; ctx.fillRect(x1, by, bw, bh);
        const inside = bw > 40; ctx.fillStyle = inside ? '#fff' : '#0369a1'; ctx.textAlign = inside ? 'right' : 'left'; ctx.fillText(fmtT(s.half), inside ? x1 + bw - 5 : x1 + bw + 5, by + bh - 4);
      } else { ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = '600 11.5px ' + FONT; ctx.fillText('60 안에 절반이 안 됨', x1 + 6, by + bh - 4); }
      const sw = (s.stale) * colW; ctx.fillStyle = STALE_HEX; ctx.fillRect(x2, by, sw, bh);
      ctx.font = '700 12px ' + FONT; const ins2 = sw > 40; ctx.fillStyle = ins2 ? '#fff' : STALE_HEX; ctx.textAlign = ins2 ? 'right' : 'left';
      ctx.fillText(Math.round(s.stale * 100) + '%', ins2 ? x2 + sw - 5 : x2 + sw + 5, by + bh - 4);
    });
    L.drawLegendBelow(c, items);
  }

  // ⑤ 바람 세기별: 절반까지 걸린 시간 (지금 바람 방향)
  function drawWinds() {
    const cv = $('c-wind'), base = baseParams();
    const items = LAY.map(([id, name]) => ({ kind: 'line', color: COL[id], label: name })).concat([{ kind: 'ring', color: '#64748b', label: '60 안에 절반이 안 됨' }]);
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 16, t: 34 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + ((v - 1) / 4) * pw, Y = (v) => m.t + 24 + (1 - v / 60) * (ph - 24);
    L.axes(c, { X, Y, yTicks: [0, 20, 40, 60], xTicks: [1, 2, 3, 4, 5], xLabel: '바람 세기 (1 아주 약하게 ~ 5 아주 세게)', yLabel: '절반까지 걸린 시간 (모델 단위)' });
    ctx.fillStyle = 'rgba(100,116,139,.08)'; ctx.fillRect(m.l, m.t - 2, pw, 16);
    LAY.forEach(([id]) => {
      const pts = []; const rings = [];
      for (let k = 1; k <= 5; k++) { const s = get(Object.assign(layoutParams(id, base), { wind: k })); if (!s) continue; if (s.half != null) pts.push([X(k), Y(s.half)]); else rings.push(X(k)); }
      L.line(ctx, pts, COL[id], 2.5); ctx.fillStyle = COL[id]; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); });
      ctx.strokeStyle = COL[id]; ctx.lineWidth = 1.8; rings.forEach((x, q) => { ctx.beginPath(); ctx.arc(x + (LAY.findIndex((l) => l[0] === id) - 1.5) * 10, m.t + 6, 4, 0, 7); ctx.stroke(); }); ctx.lineWidth = 1;
    });
    { const xv = X(params().wind), col = css('--rich'), al = params().wind > 3 ? 'right' : 'left';
      ctx.strokeStyle = col; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(xv, m.t + 16); ctx.lineTo(xv, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = '12px ' + FONT; ctx.textAlign = al; L.label(ctx, '지금 설정', xv + (al === 'right' ? -5 : 5), m.t + ph - 8, al); }
    L.drawLegendBelow(c, items);
  }

  // ⑥ 바람 방향별: 끝에 아직 탁한 곳 (지금 바람 세기)
  function drawDirs() {
    const cv = $('c-dir'), base = baseParams(), dirs = ['front', 'diag', 'side'];
    const items = LAY.map(([id, name]) => ({ kind: 'box', color: COL[id], label: name }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 12, t: 34 }), { ctx, m, pw, ph } = c;
    const gw = pw / 3, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => String(Math.round(v * 100)), xTicks: [0, 1, 2], xFmt: (v) => tr(DIRNAME[dirs[v]]), xLabel: '바람이 오는 방향', yLabel: '끝에 아직 탁한 곳 (%)' });
    const cur = params().dir;
    dirs.forEach((dname, g) => {
      if (dname === cur) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(m.l + g * gw + 2, m.t, gw - 4, ph); }
      const bw = (gw - 16) / LAY.length;
      LAY.forEach(([id], k) => {
        const s = get(Object.assign(layoutParams(id, base), { dir: dname })); if (!s) return;
        const x = m.l + g * gw + 8 + k * bw; ctx.fillStyle = COL[id]; ctx.fillRect(x + 1, Y(s.stale), bw - 2, Y(0) - Y(s.stale));
      });
    });
    L.drawLegendBelow(c, items);
  }

  function runSweeps() {
    const base = baseParams(), list = [];
    const need = (o) => { if (!get(o)) list.push(() => calc(o)); };
    LAY.forEach(([id]) => need(layoutParams(id, base)));
    ['front', 'diag', 'side'].forEach((d) => LAY.forEach(([id]) => need(Object.assign(layoutParams(id, base), { dir: d }))));
    for (let k = 1; k <= 5; k++) LAY.forEach(([id]) => need(Object.assign(layoutParams(id, base), { wind: k })));
    ['l', 'w', 'd'].forEach((k) => { $('note-' + k).textContent = '계산 중…'; });
    const redraw = () => { drawLayouts(); drawWinds(); drawDirs(); };
    redraw();
    L.jobs(list, redraw, () => {
      const op = get(layoutParams('opposite', base)), sa = get(layoutParams('same', base)), on = get(layoutParams('one', base)), ad = get(layoutParams('adjacent', base));
      const ht = (s) => (s.half == null ? '안 됨' : fmtT(s.half)), pc = (s) => Math.round(s.stale * 100) + '%';
      $('note-l').textContent = `절반까지: 마주 보는 벽 ${ht(op)} · 옆 벽 ${ht(ad)} · 같은 벽 ${ht(sa)} · 창 1개 ${ht(on)} / 아직 탁한 곳: ${pc(op)} · ${pc(ad)} · ${pc(sa)} · ${pc(on)}`;
      const w1 = get(Object.assign(layoutParams('opposite', base), { wind: 1 })), w5 = get(Object.assign(layoutParams('opposite', base), { wind: 5 }));
      $('note-w').textContent = `마주 보는 벽: 아주 약한 바람이면 ${ht(w1)}, 아주 센 바람이면 ${ht(w5)}`;
      const ds = ['front', 'diag', 'side'].map((d) => get(Object.assign(layoutParams('opposite', base), { dir: d })));
      $('note-d').textContent = `마주 보는 벽의 아직 탁한 곳: 정면 ${pc(ds[0])} · 비스듬히 ${pc(ds[1])} · 옆 ${pc(ds[2])}`;
    });
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const m = sim.mean(), half = sim.halfTime(), tnow = sim.t / sim.unit;
    const cards = [
      ['지금 방 평균 탁함', String(Math.round(m)), `처음 100 · 시간 ${Math.round(tnow)} / ${TMAX}`, false],
      ['절반으로 맑아지는 데 걸린 시간', half == null ? '' : fmtT(half), half != null ? '방 평균이 100에서 50이 될 때까지 (모델 단위)' : sim.done ? `이 판의 시간(${TMAX}) 안에 절반이 안 됐어요` : '아직 절반이 안 됐어요', false],
      ['아직 절반 넘게 탁한 곳', Math.round(sim.staleShare() * 100) + '%', '방 바닥 넓이 중 (탁함 50 초과)', !sim.done],
      ['사람 자리 공기', String(Math.round(sim.personAir())), '사람 둘레 5×5칸 평균 (100 넘으면 처음보다 탁함)', false],
    ];
    $('stats').innerHTML = cards.map(([k, v, s, dim]) => `<div class="stat"${dim ? ' style="opacity:.55"' : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `시간 ${Math.round(tnow)} / ${TMAX}`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawTime(); }
  function draw() {
    drawRoom();
    if (performance.now() - lastChart > 120) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 140); }
  }

  const h = L.harness({
    controls: ['count', 'gap', 'wind', 'layout', 'dir', 'door', 'src'],
    format: { count: (v) => v + '개', gap: (v) => v + '칸 폭', wind: (v) => WINDNAME[v - 1], layout: () => '', dir: () => '', door: () => '', src: () => '' },
    defaults: { count: 2, gap: 6, wind: 3, layout: 'opposite', dir: 'front', door: 'none', src: 'center' },
    build() {
      sim = VT.create(params());
      for (let k = 0; k < NP; k++) spawn(k);
      moveDots(40);
      const go = THUMB ? 2200 : JUMP;
      for (let k = 0; k < go && sim.step(); k++) if (k % ADV === 0) moveDots(ADV);
    },
    autoplay: !THUMB && !JUMP,
    advance() { if (sim.done) return false; for (let k = 0; k < ADV; k++) sim.step(); moveDots(ADV); return true; },
    isDone() { return sim.done; },
    draw() { draw(); },
    after() { drawCharts(); runSweeps(); },
    redrawExtra() { drawLayouts(); drawWinds(); drawDirs(); },
    seedLabel: '사람 자리',
  });
  seedGetter = h.seed;
})();
