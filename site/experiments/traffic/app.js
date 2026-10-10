(function () {
  'use strict';
  const TR = window.Traffic, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, fd = [], fdIdeal = [], psweep = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), density: Number($('density').value) / 100, p: Number($('p').value) / 100 });

  // 속도 0(빨강) ~ 최고(초록)
  function vcolor(v, vmax) {
    const t = Math.min(1, v / vmax);
    const a = t < 0.5 ? [229, 72, 77] : [245, 196, 81], b = t < 0.5 ? [245, 196, 81] : [31, 164, 99], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(',')})`;
  }

  function drawRing() {
    const c = L.chart($('c-ring'), 1, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e1e6f0'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    const vmax = sim.params.vmax;
    for (let i = 0; i < sim.n; i++) {
      const a = (sim.pos[i] / sim.L) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = vcolor(sim.vel[i], vmax);
      ctx.beginPath(); ctx.arc(cx + R * Math.cos(a), cy + R * Math.sin(a), 4.2, 0, 7); ctx.fill();
    }
    const s = sim.stats();
    ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.font = '700 30px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(Math.round(s.kmh) + ' km/h', cx, cy + 6);
    ctx.font = '13px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
    ctx.fillText('평균 속도', cx, cy + 28); ctx.fillText(`멈춰 있는 차 ${pct(s.stopped)}`, cx, cy + 48);
    $('when').textContent = `${sim.step}초 경과`;
  }

  function drawSpace() {
    const c = L.chart($('c-space'), 0.8, { l: 14, r: 14, t: 10, b: 30 });
    const { ctx, w, h, m, pw, ph } = c, rows = sim.rows, vmax = sim.params.vmax;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(m.l, m.t, pw, ph);
    const cw = pw / sim.L, rh = ph / 160;
    rows.forEach((row, k) => {
      const y = m.t + (160 - rows.length + k) * rh;
      for (let x = 0; x < sim.L; x++) {
        const v = row[x]; if (!v) continue;
        ctx.fillStyle = vcolor(v - 1, vmax); ctx.fillRect(m.l + x * cw, y, Math.max(1, cw), Math.max(1, rh));
      }
    });
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    ctx.fillText('도로 위치 →', m.l + pw / 2, h - 12); ctx.textAlign = 'left'; ctx.fillText('시간 ↓ (최근 160초)', m.l, h - 1);
  }

  function drawFD() {
    L.dots($('c-fd'), {
      data: fd.map((d) => ({ x: d.x, runs: [d.flow], mean: d.flow })),
      series: [{ data: fdIdeal.map((d) => ({ x: d.x, runs: [], mean: d.flow })), color: '#8a93a6' }],
      x0: 0.05, x1: 0.6, y0: 0, y1: 2000, xTicks: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xFmt: pct, yFmt: (v) => v.toLocaleString('ko-KR'),
      xLabel: '도로가 찬 정도(밀도)', marker: { x: sim.params.density },
    });
  }
  function drawP() {
    L.dots($('c-p'), {
      data: psweep.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 0, x1: 0.5, y0: 0, y1: 135, xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], xFmt: pct, yFmt: (v) => Math.round(v) + '',
      xLabel: '잠깐 브레이크를 밟는 확률', marker: { x: sim.params.p },
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

  function after() {
    const P = params(); fd = []; fdIdeal = []; psweep = []; drawFD(); drawP();
    $('note-fd').textContent = '계산 중…'; $('note-p').textContent = '계산 중…';
    const jobs = [];
    for (let d = 5; d <= 60; d += 5) jobs.push(() => {
      fd.push({ x: d / 100, flow: TR.measure({ density: d / 100, p: P.p }, 150, 200, 2).flow });
      fdIdeal.push({ x: d / 100, flow: TR.measure({ density: d / 100, p: 0 }, 150, 200, 1).flow });
    });
    for (let q = 0; q <= 50; q += 5) jobs.push(() => {
      const runs = [0, 1, 2].map((k) => TR.measure({ density: P.density, p: q / 100, seed: 1 + k * 7 }, 150, 150, 1).avg * TR.KMH_PER_CELL);
      psweep.push({ x: q / 100, runs });
    });
    L.jobs(jobs, () => { drawFD(); drawP(); }, () => {
      $('note-fd').textContent = '파랑: 지금 설정, 회색: 브레이크를 전혀 안 밟는 완벽한 운전';
      const a = psweep[0], b = psweep.find((d) => d.x === 0.25) || psweep[5];
      $('note-p').textContent = `브레이크 0%일 때 ${Math.round(L.mean(a.runs))} km/h, 25%일 때 ${Math.round(L.mean(b.runs))} km/h`;
    });
  }

  const h = L.harness({
    controls: ['density', 'p'],
    format: { density: (v) => v + '%', p: (v) => v + '%' },
    defaults: { density: 20, p: 25 },
    build() { sim = TR.create(params()); },
    advance() { return sim.advance(); },
    draw, after, redrawExtra() { drawFD(); drawP(); }, seedLabel: '도로 번호',
  });
  seedGetter = h.seed;
})();
