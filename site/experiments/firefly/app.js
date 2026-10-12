(function () {
  'use strict';
  const FF = window.Firefly, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  // ?thumb=1 (메인 페이지 썸네일용): 동기화가 끝난 뒤 다 함께 반짝이는 순간에서 멈춘다
  const THUMB = /[?&]thumb=1/.test(location.search);
  let thumbFrozen = false;
  let sim = null, avgNb = 0, couplingRows = [], radiusRows = [];
  let seedGetter = () => 1;
  const params = () => ({
    seed: seedGetter(),
    coupling: Number($('coupling').value) / 100,
    radius: Number($('radius').value) / 100,
    spread: Number($('spread').value) / 100,
  });

  const cycles = () => sim.step * sim.params.dt;

  // ---------- ① 밤하늘 ----------
  function drawNight() {
    $('when').textContent = `${cycles().toFixed(0)}주기 · 동기화 r=${sim.sync().toFixed(2)}`;
    const c = L.chart($('c-night'), 0.85, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0f24'); g.addColorStop(1, '#16213f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const side = Math.min(w, h) * 0.92, ox = (w - side) / 2, oy = (h - side) / 2;
    ctx.strokeStyle = 'rgba(160,175,220,.18)'; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, side, side);
    const X = (v) => ox + v * side, Y = (v) => oy + v * side;
    // 한 마리(0번)가 볼 수 있는 범위
    ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(190,205,255,.45)'; ctx.beginPath();
    ctx.arc(X(sim.x[0]), Y(sim.y[0]), sim.params.radius * side, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < sim.n; i++) {
      const gl = sim.glow[i], x = X(sim.x[i]), y = Y(sim.y[i]);
      if (gl > 0.02) {
        const R = 6 + 18 * gl, gr = ctx.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, `rgba(255,236,120,${0.95 * gl})`); gr.addColorStop(0.35, `rgba(255,214,90,${0.5 * gl})`); gr.addColorStop(1, 'rgba(255,214,90,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
      }
      ctx.fillStyle = gl > 0.3 ? '#fff6b8' : 'rgba(140,152,190,.65)';
      ctx.beginPath(); ctx.arc(x, y, i === 0 ? 3.4 : 2.4, 0, 7); ctx.fill();
    }
    if (THUMB) return;
    ctx.fillStyle = 'rgba(210,220,250,.85)'; ctx.textAlign = 'left'; ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('동기화 정도 r = ' + sim.sync().toFixed(2), 12, 22);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = 'rgba(190,200,235,.7)';
    ctx.fillText('점선 원: 한 마리가 볼 수 있는 범위', 12, h - 12);
  }

  // ---------- ② 위상 시계 ----------
  function drawClock() {
    const c = L.chart($('c-clock'), 0.9, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c, cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) * 0.36;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * 2 * Math.PI - Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx + (R - 5) * Math.cos(a), cy + (R - 5) * Math.sin(a)); ctx.lineTo(cx + (R + 5) * Math.cos(a), cy + (R + 5) * Math.sin(a)); ctx.stroke(); }
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('반짝!', cx, cy - R - 12);
    let sx = 0, sy = 0;
    for (let i = 0; i < sim.n; i++) {
      const a = sim.phase[i] * 2 * Math.PI - Math.PI / 2;
      sx += Math.cos(a); sy += Math.sin(a);
      ctx.fillStyle = sim.glow[i] > 0.3 ? '#e0a100' : mix(css('--accent'), 0.55);
      const rr = R + ((i % 5) - 2) * 3.2;   // 같은 위상에 몰린 점이 겹쳐 사라지지 않게 원 둘레 안팎으로 조금씩 나눠 그린다
      ctx.beginPath(); ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3.2, 0, 7); ctx.fill();
    }
    const r = Math.sqrt(sx * sx + sy * sy) / sim.n, ang = Math.atan2(sy, sx);
    ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * R * Math.cos(ang), cy + r * R * Math.sin(ang)); ctx.stroke(); ctx.lineWidth = 1; ctx.lineCap = 'butt';
    ctx.fillStyle = css('--unlucky'); ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
    ctx.fillStyle = css('--text'); ctx.font = '600 14px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText('r = ' + r.toFixed(2), cx, cy + R + 28);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
    ctx.fillText('붉은 화살표: 모두의 평균 방향', cx, cy + R + 46);
  }

  // ---------- ③ 시간에 따른 동기화 ----------
  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.cycles, dtc = 5 * sim.params.dt;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 6) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => v.toFixed(2), xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '지난 주기' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(0.9)); ctx.lineTo(m.l + pw, Y(0.9)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('거의 동시 (0.9)', m.l + 6, Y(0.9) - 6);
    L.line(ctx, H.map((v, i) => [X((i + 1) * dtc), Y(v)]), css('--accent'), 2.5);
    if (H.length) { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(H.length * dtc), Y(H[H.length - 1]), 4.5, 0, 7); ctx.fill(); }
  }

  // ---------- ④⑤ 스윕 ----------
  function drawCouplingSweep() {
    L.dots($('c-coupling'), {
      data: couplingRows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 0, x1: 0.08, xTicks: [0, 0.02, 0.04, 0.06, 0.08], xFmt: (v) => (v * 100).toFixed(0) + '%', yFmt: (v) => v.toFixed(2),
      xLabel: '서로 앞당겨 주는 정도 (결합 세기)', marker: { x: sim.params.coupling },
    });
  }
  function drawRadiusSweep() {
    L.dots($('c-radius'), {
      data: radiusRows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 0.1, x1: 1, xTicks: [0.1, 0.3, 0.5, 0.7, 0.9], xFmt: pct, yFmt: (v) => v.toFixed(2),
      xLabel: '볼 수 있는 범위 (화면 너비 대비)', marker: { x: sim.params.radius },
    });
  }

  function neighbors() {
    let c = 0; const r2 = sim.params.radius * sim.params.radius;
    for (let i = 0; i < sim.n; i++) for (let j = i + 1; j < sim.n; j++) { const dx = sim.x[i] - sim.x[j], dy = sim.y[i] - sim.y[j]; if (dx * dx + dy * dy <= r2) c++; }
    return (2 * c) / sim.n;
  }

  function renderStats() {
    const r = sim.sync(), maxFlash = sim.flashHist.length ? Math.max(...sim.flashHist) : 0;
    const cards = [
      ['동기화 정도 r', r.toFixed(2), '0이면 제각각, 1이면 완전히 동시'],
      ['지난 주기', cycles().toFixed(0) + '주기', `전체 ${sim.params.cycles}주기 중`],
      ['한꺼번에 반짝인 최대 마리 수', maxFlash + '마리', `${sim.n}마리 중, 한 시점에`],
      ['한 마리가 보는 이웃', '평균 ' + avgNb.toFixed(0) + '마리', `볼 수 있는 범위 ${pct(sim.params.radius)}`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawNight(); drawClock(); drawTime(); }

  function after() {
    const P = params(); couplingRows = []; radiusRows = []; drawCouplingSweep(); drawRadiusSweep();
    $('note-coupling').textContent = '계산 중…'; $('note-radius').textContent = '계산 중…';
    const jobs = [];
    for (let c = 0; c <= 80; c += 5) jobs.push(() => {
      couplingRows.push({ x: c / 1000, runs: FF.finalSync({ coupling: c / 1000, radius: P.radius, spread: P.spread, seed: P.seed, cycles: 30 }, 3) });
    });
    for (let r = 10; r <= 100; r += 10) jobs.push(() => {
      radiusRows.push({ x: r / 100, runs: FF.finalSync({ coupling: P.coupling, radius: r / 100, spread: P.spread, seed: P.seed, cycles: 30 }, 3) });
    });
    L.jobs(jobs, () => { drawCouplingSweep(); drawRadiusSweep(); }, () => {
      const at = (rows, x) => { const d = rows.find((q) => Math.abs(q.x - x) < 1e-9); return d ? L.mean(d.runs) : null; };
      const a = at(couplingRows, 0.01), b = at(couplingRows, 0.03);
      $('note-coupling').textContent = a != null && b != null ? `결합 1%일 때 r=${a.toFixed(2)}, 3%일 때 r=${b.toFixed(2)}` : '';
      const c = at(radiusRows, 0.2), d = at(radiusRows, 0.5);
      $('note-radius').textContent = c != null && d != null ? `볼 수 있는 범위가 20%일 때 r=${c.toFixed(2)}, 50%일 때 r=${d.toFixed(2)}` : '';
    });
  }

  const h = L.harness({
    controls: ['coupling', 'radius', 'spread'],
    format: { coupling: (v) => Number(v).toFixed(1) + '%', radius: (v) => v + '%', spread: (v) => v + '%' },
    defaults: { coupling: 2.5, radius: 30, spread: 10 },
    build() {
      sim = FF.create(params()); avgNb = neighbors(); thumbFrozen = false;
      window.dispatchEvent(new CustomEvent('firefly:build', { detail: params() }));   // 3D 보기(app3d.js)도 같은 설정으로 다시 시작
      if (THUMB) {   // 동기화(r>0.9)된 뒤, 절반 넘게 한꺼번에 반짝인 직후에서 멈춘다
        while (sim.advance() && !(sim.step > 200 && sim.sync() > 0.9 && sim.flashedLast() > sim.n / 2));
        sim.advance(); sim.advance(); thumbFrozen = true;
      }
    },
    advance() { return thumbFrozen ? false : sim.advance(); },
    isDone() { return sim.step >= sim.maxSteps; },
    draw, after, redrawExtra() { drawCouplingSweep(); drawRadiusSweep(); }, seedLabel: '숲 번호',
  });
  seedGetter = h.seed;
  window.FireflyApp = { params };   // 3D 보기가 현재 설정을 읽는다
})();
