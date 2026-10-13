(function () {
  'use strict';
  const TR = window.Traffic, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, fd = [], fdIdeal = [], psweep = [];
  let seedGetter = () => 1;
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const params = () => ({ seed: seedGetter(), density: Number($('density').value) / 100, p: Number($('p').value) / 100 });

  // 속도 0(빨강) ~ 최고(초록)
  function vcolor(v, vmax) {
    const t = Math.min(1, v / vmax);
    const a = t < 0.5 ? [229, 72, 77] : [245, 196, 81], b = t < 0.5 ? [245, 196, 81] : [31, 164, 99], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(',')})`;
  }

  // 그래프 안 범례(한 줄): 멈춤 [빨강→초록] 최고 속도 | 따라가 볼 차 표시. sample = 'car'(검은 테두리 차) | 'line'(검은 선)
  function speedLegend(ctx, x, y, sample) {
    ctx.save(); ctx.font = '11.5px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = css('--text');
    const vm = sim.params.vmax; let cx = x;
    ctx.fillText('멈춤', cx, y + 4); cx += ctx.measureText('멈춤').width + 5;
    const gw = 48; for (let i = 0; i < gw; i++) { ctx.fillStyle = vcolor((i / (gw - 1)) * vm, vm); ctx.fillRect(cx + i, y - 5, 1.5, 10); }
    cx += gw + 5; ctx.fillStyle = css('--text'); ctx.fillText('최고 속도', cx, y + 4); cx += ctx.measureText('최고 속도').width + 14;
    if (sample === 'car') { ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 2; ctx.strokeRect(cx, y - 4, 12, 8); cx += 17; }
    else { ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + 16, y); ctx.stroke(); cx += 21; }
    ctx.fillStyle = css('--text'); ctx.fillText('따라가 볼 차', cx, y + 4);
    ctx.restore();
  }

  // ---- ① 고리 도로: 단계 사이를 부드럽게 이어 그린다 ----
  const SPEED_SCALE = 0.5; // 보통 = 초당 10단계 (예전 14단계는 차가 한 번에 크게 건너뛰어 따라가기 어려웠다)
  const THUMB = /[?&]thumb=1/.test(location.search);
  let prevPos = null, lastAdv = 0, trail = [], ringC = null, ringW = 0;
  const stepMs = () => 1000 / (Number($('speed').value) * SPEED_SCALE);
  function frac() { // 0 = 직전 위치, 1 = 현재 위치
    if (!prevPos) return 1;
    const dt = performance.now() - lastAdv, ms = stepMs();
    return dt > ms * 1.5 ? 1 : Math.min(1, dt / ms);
  }
  function carPos(i, f) { // 칸 단위 실수 위치 (고리 넘어가기 처리)
    if (!prevPos || f >= 1) return sim.pos[i];
    const d = (sim.pos[i] - prevPos[i] + sim.L) % sim.L;
    return prevPos[i] + d * f;
  }
  function drawRing(f) {
    const cv = $('c-ring');
    if (!ringC || ringW !== cv.clientWidth) { ringC = L.chart(cv, THUMB ? 1 : 1 + 30 / (cv.clientWidth || 400), { l: 0, r: 0, t: 0, b: 0 }); ringW = cv.clientWidth; }
    const { ctx, w, h: hAll } = ringC, legH = THUMB ? 0 : 30, h = hAll - legH, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38;
    if (f == null) f = frac();
    ctx.clearRect(0, 0, w, hAll);
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, hAll);
    const lw = Math.max(14, R * 0.09);
    ctx.strokeStyle = '#e1e6f0'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    const vmax = sim.params.vmax, L2 = sim.L, ang = (x) => (x / L2) * Math.PI * 2 - Math.PI / 2;
    // 정체 구간(멈춘·거의 멈춘 차)을 붉게 깔아 덩어리를 보이게
    ctx.strokeStyle = 'rgba(229,72,77,0.16)'; ctx.lineWidth = lw + 10; ctx.lineCap = 'round';
    for (let i = 0; i < sim.n; i++) {
      if (sim.vel[i] > 1) continue;
      const a = ang(carPos(i, f)); ctx.beginPath(); ctx.arc(cx, cy, R, a - 0.025, a + 0.025); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    // 진행 방향 화살표 (시계 방향)
    ctx.strokeStyle = '#9aa4b8'; ctx.fillStyle = '#9aa4b8'; ctx.lineWidth = 2;
    const ra = R - lw * 1.6; ctx.beginPath(); ctx.arc(cx, cy, ra, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35); ctx.stroke();
    const ea = -Math.PI / 2 + 0.35, ex = cx + ra * Math.cos(ea), ey = cy + ra * Math.sin(ea);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ea + Math.PI / 2); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3, -5); ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    const cl = Math.max(7, Math.min(13, (2 * Math.PI * R / L2) * 1.3)), cwid = Math.max(5, lw * 0.5);
    for (let i = sim.n - 1; i >= 0; i--) {
      const a = ang(carPos(i, f));
      ctx.save(); ctx.translate(cx + R * Math.cos(a), cy + R * Math.sin(a)); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = vcolor(sim.vel[i], vmax); L.roundRect(ctx, -cl / 2, -cwid / 2, cl, cwid, 2); ctx.fill();
      if (i === 0) { ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.restore();
    }
    // 따라가 볼 차 표시
    const a0 = ang(carPos(0, f)), lx = Math.max(28, Math.min(w - 28, cx + (R + lw + 12) * Math.cos(a0))), ly = Math.max(12, Math.min(h - 6, cy + (R + lw + 12) * Math.sin(a0)));
    ctx.fillStyle = '#1b2233'; ctx.textAlign = 'center'; ctx.font = '700 12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('이 차', lx, ly + 4);
    const s = sim.stats();
    ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.font = '700 30px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(Math.round(s.kmh) + ' km/h', cx, cy + 6);
    ctx.font = '13px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
    ctx.fillText('평균 속도', cx, cy + 28); ctx.fillText(`멈춰 있는 차 ${pct(s.stopped)}`, cx, cy + 48);
    if (!THUMB) speedLegend(ctx, 12, hAll - 16, 'car');
    $('when').textContent = `${sim.step}초 경과`;
  }

  let spaceBuf = null;
  const vrgbCache = {};
  const vrgb = (v, vmax) => vrgbCache[v * 10 + vmax] || (vrgbCache[v * 10 + vmax] = vcolor(v, vmax).match(/\d+/g).map(Number));
  function drawSpace() {
    const wide = ($('c-space').clientWidth || 400) > 640;
    const c = L.chart($('c-space'), wide ? 0.42 : 0.8, THUMB ? { l: 0, r: 0, t: 0, b: 0 } : { l: 14, r: 14, t: 24, b: 48 });
    const { ctx, w, h, m, pw, ph } = c, rows = sim.rows, vmax = sim.params.vmax;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(m.l, m.t, pw, ph);
    const cw = pw / sim.L, rh = ph / 160;
    // 칸 하나 = 픽셀 하나인 작은 그림을 만들어 한 번에 늘려 그린다 (칸마다 fillRect를 하면 느렸다)
    if (!spaceBuf || spaceBuf.width !== sim.L) { spaceBuf = document.createElement('canvas'); spaceBuf.width = sim.L; spaceBuf.height = 160; }
    const bctx = spaceBuf.getContext('2d'), img = bctx.createImageData(sim.L, 160), d = img.data;
    for (let o = 0; o < d.length; o += 4) { d[o] = 247; d[o + 1] = 249; d[o + 2] = 253; d[o + 3] = 255; }
    const paint = (x, y, c) => { const o = (y * sim.L + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; };
    // 위에서부터 아래로 쌓는다 (맨 아래 줄이 지금)
    rows.forEach((row, k) => { for (let x = 0; x < sim.L; x++) if (row[x]) paint(x, k, vrgb(row[x] - 1, vmax)); });
    // 따라가 볼 차의 궤적 (오른쪽 아래로 가는 선) — 정체 띠는 반대로 왼쪽 아래로 간다
    const off = trail.length - rows.length, dark = [27, 34, 51];
    for (let k = Math.max(0, -off); k < rows.length; k++) {
      const x = trail[k + off]; if (x == null) continue;
      paint(x, k, dark); paint((x + 1) % sim.L, k, dark);
    }
    bctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spaceBuf, 0, 0, sim.L, rows.length, m.l, m.t, pw, rows.length * rh);
    if (THUMB) return;
    L.axisNames(c, '도로 위치 (칸)', '시간 ↓ (최근 160초)');
    speedLegend(ctx, m.l, h - 24, 'line');
  }

  function drawFD() {
    L.dots($('c-fd'), {
      data: fd.map((d) => ({ x: d.x, runs: [d.flow], mean: d.flow })),
      series: [{ data: fdIdeal.map((d) => ({ x: d.x, runs: [], mean: d.flow })), color: '#8a93a6' }],
      x0: 0.05, x1: 0.6, y0: 0, y1: 3000, xTicks: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xFmt: (v) => String(Math.round(v * 100)), yFmt: (v) => v.toLocaleString('ko-KR'),
      xLabel: '도로가 찬 정도 (밀도, %)', yLabel: '시간당 통과 대수 (대)', marker: { x: sim.params.density },
      legend: [{ kind: 'line', color: css('--accent'), label: '지금 설정' }, { kind: 'line', color: '#8a93a6', label: '브레이크를 안 밟는 완벽한 운전' }], legendPos: 'br',
    });
  }
  function drawP() {
    L.dots($('c-p'), {
      data: psweep.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 0, x1: 0.5, y0: 0, y1: 135, xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], xFmt: (v) => String(Math.round(v * 100)), yFmt: (v) => Math.round(v) + '',
      xLabel: '브레이크를 밟는 확률 (%)', yLabel: '평균 속도 (km/h)', marker: { x: sim.params.p },
      legend: [{ kind: 'dot', color: css('--accent'), label: '도로 1개의 결과' }, { kind: 'line', color: css('--accent'), label: '3개의 평균' }], legendPos: 'bl',
    });
  }

  function renderStats() {
    const s = sim.stats();
    const cards = [
      ['평균 속도', Math.round(s.kmh) + ' km/h', `제한속도(최고) ${sim.params.vmax * TR.KMH_PER_CELL} km/h`],
      ['멈춰 있는 차', pct(s.stopped), `${sim.n}대 중 ${Math.round(s.stopped * sim.n)}대`],
      ['시간당 통과 대수', Math.round(s.flowPerHour).toLocaleString('ko-KR') + '대', '한 지점을 지나가는 차량 수'],
      ['차량 수', sim.n + '대', `길이 ${sim.L}칸 (약 ${(sim.L * 7.5 / 1000).toFixed(1)}km) 한 차선`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRing(); drawSpace(); }
  function ringLoop() { if (sim && frac() < 1) drawRing(); requestAnimationFrame(ringLoop); }
  requestAnimationFrame(ringLoop);

  function after() {
    const P = params(); fd = []; fdIdeal = []; psweep = []; drawFD(); drawP();
    $('note-p').textContent = '계산 중…';
    const jobs = [];
    // 작은 작업을 몇 개씩 묶어 실행 (하나씩 하면 애니메이션 프레임 사이에 끼어 너무 오래 걸렸다)
    for (let d0 = 5; d0 <= 60; d0 += 20) jobs.push(() => {
      for (let d = d0; d < d0 + 20 && d <= 60; d += 5) {
        fd.push({ x: d / 100, flow: TR.measure({ density: d / 100, p: P.p }, 150, 200, 2).flow });
        fdIdeal.push({ x: d / 100, flow: TR.measure({ density: d / 100, p: 0 }, 150, 200, 1).flow });
      }
    });
    for (let q0 = 0; q0 <= 50; q0 += 20) jobs.push(() => {
      for (let q = q0; q < q0 + 20 && q <= 50; q += 5) {
        const runs = [0, 1, 2].map((k) => TR.measure({ density: P.density, p: q / 100, seed: 1 + k * 7 }, 150, 150, 1).avg * TR.KMH_PER_CELL);
        psweep.push({ x: q / 100, runs });
      }
    });
    L.jobs(jobs, () => { drawFD(); drawP(); }, () => {
      const a = psweep[0], b = psweep.find((d) => d.x === 0.25) || psweep[5];
      $('note-p').textContent = `브레이크 0%일 때 ${Math.round(L.mean(a.runs))} km/h, 25%일 때 ${Math.round(L.mean(b.runs))} km/h`;
    });
  }

  const h = L.harness({
    controls: ['density', 'p'],
    format: { density: (v) => v + '%', p: (v) => v + '%' },
    defaults: { density: 20, p: 25 },
    speedScale: SPEED_SCALE,
    build() {
      sim = TR.create(params()); prevPos = null; trail = [sim.pos[0]];
      if (THUMB) for (let t = 0; t < 220; t++) advance();
    },
    advance,
    draw, after, redrawExtra() { drawFD(); drawP(); }, seedLabel: '도로 번호',
  });
  function advance() {
    prevPos = Int32Array.from(sim.pos);
    const r = sim.advance(); lastAdv = performance.now();
    trail.push(sim.pos[0]); if (trail.length > 400) trail.splice(0, trail.length - 200);
    return r;
  }
  seedGetter = h.seed;
  // 3D 보기(app3d.js)가 같은 상태를 쓰도록 노출
  window.TrafficView = { sim: () => sim, frac, carPos: (i, f) => carPos(i, f), vcolorRGB: (v, vmax) => vcolor(v, vmax), trail: () => trail, thumb: THUMB };
})();
