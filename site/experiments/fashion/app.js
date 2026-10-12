(function () {
  'use strict';
  const FA = window.Fashion, L = window.Lab;
  const { css, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, betaRows = [], alphaRows = [];
  let seedGetter = () => 1, trail = [];
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 페이지 썸네일용: 600라운드를 다 돈 시간-색상 띠로 바로 간다
  const params = () => ({
    seed: seedGetter(), share: Number($('share').value) / 100, alpha: Number($('alpha').value), beta: Number($('beta').value), jitter: Number($('jitter').value),
  });
  const hsl = (h, a) => `hsla(${Math.round(h)},75%,52%,${a == null ? 1 : a})`;

  // ---------- ① 색상환 ----------
  function drawWheel() {
    const narrow = ($('c-wheel').clientWidth || 600) < 560;   // 휴대폰: 바깥 트렌드세터가 잘리지 않게 거의 정사각형으로
    const c = L.chart($('c-wheel'), narrow ? 1 : 0.72, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c, cx = w / 2, cy = h / 2, R = Math.min(w * 0.36, h * 0.37);
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const ang = (deg) => ((deg - 90) * Math.PI) / 180;
    ctx.lineWidth = 16;
    for (let k = 0; k < 180; k++) { ctx.strokeStyle = hsl(k * 2 + 1, 0.28); ctx.beginPath(); ctx.arc(cx, cy, R, ang(k * 2 - 0.4), ang(k * 2 + 2.4)); ctx.stroke(); }
    ctx.lineWidth = 1;
    for (let i = sim.nLeaders; i < sim.n; i++) {
      const a = ang(sim.hue[i]), rr = R + sim.radial[i] * 14;
      ctx.fillStyle = hsl(sim.hue[i]); ctx.beginPath(); ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3.3, 0, 7); ctx.fill();
    }
    for (let i = 0; i < sim.nLeaders; i++) {
      const a = ang(sim.hue[i]), rr = R + 36;
      ctx.fillStyle = hsl(sim.hue[i]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 7.5, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.lineWidth = 1;
    // 최근 80라운드 동안 대세 스타일이 지나온 길 (화살표 끝이 지금)
    if (trail.length > 2) {
      const tr = trail.slice(-80), rr = R - 30;
      let a = tr[0]; const pts = [a];
      for (let k = 1; k < tr.length; k++) { a += ((tr[k] - tr[k - 1] + 540) % 360) - 180; pts.push(a); }
      if (Math.abs(pts[pts.length - 1] - pts[0]) > 4) {
        ctx.lineCap = 'round';
        for (let k = 1; k < pts.length; k++) {
          ctx.strokeStyle = hsl(pts[k], 0.15 + 0.75 * (k / pts.length)); ctx.lineWidth = 2 + 4 * (k / pts.length);
          ctx.beginPath(); ctx.arc(cx, cy, rr, ang(Math.min(pts[k - 1], pts[k])), ang(Math.max(pts[k - 1], pts[k])) + 0.002); ctx.stroke();
        }
        const e = pts[pts.length - 1], dir = Math.sign(e - pts[pts.length - 6 >= 0 ? pts.length - 6 : 0]) || 1, ea = ang(e);
        const tx = cx + rr * Math.cos(ea), ty = cy + rr * Math.sin(ea), tang = ea + dir * Math.PI / 2;
        ctx.fillStyle = hsl(e); ctx.beginPath();
        ctx.moveTo(tx + 11 * Math.cos(tang), ty + 11 * Math.sin(tang));
        ctx.lineTo(tx + 7 * Math.cos(tang + 2.3), ty + 7 * Math.sin(tang + 2.3));
        ctx.lineTo(tx + 7 * Math.cos(tang - 2.3), ty + 7 * Math.sin(tang - 2.3)); ctx.closePath(); ctx.fill();
        ctx.lineCap = 'butt'; ctx.lineWidth = 1;
      }
    }
    const fm = sim.followerMean(), hueNow = ((fm.angle % 360) + 360) % 360;
    ctx.fillStyle = hsl(hueNow); ctx.beginPath(); ctx.arc(cx, cy - 12, 20, 0, 7); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = css('--text'); ctx.font = '700 18px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(Math.round(hueNow) + '°', cx, cy + 32);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
    ctx.fillText('지금의 대세 스타일', cx, cy + 50);
    if (!narrow) {   // 휴대폰에서는 색상환과 겹치므로 생략 (위 설명 문단에 같은 내용)
      ctx.textAlign = 'left'; ctx.fillText('바깥 큰 점: 트렌드세터', 12, h - 30); ctx.fillText('색상환 위 작은 점: 대중', 12, h - 14);
      ctx.textAlign = 'right'; ctx.fillText('안쪽 화살표: 최근 80라운드의 흐름', w - 12, h - 14);
    }
    $('when').textContent = `${sim.round}/${sim.params.rounds}라운드 · 다양성 ${sim.diversity().toFixed(2)}`;
  }

  // ---------- ② 시간 x 색상 띠 ----------
  function drawStrip() {
    const c = L.chart($('c-strip'), THUMB ? 1 : 0.66, THUMB ? { l: 0, r: 0, t: 0, b: 0 } : { l: 46, b: 40 }), { ctx, m, pw, ph } = c, T = sim.params.rounds, S = sim.strip, n = sim.n;
    const X = (t) => m.l + (t / T) * pw, Y = (hh) => m.t + ph - (hh / 360) * ph;
    ctx.fillStyle = '#fbfcfe'; ctx.fillRect(m.l, m.t, pw, ph);
    const bw = Math.max(1.2, pw / T + 0.6), bh = ph / FA.BINS + 0.6;
    S.forEach((row, t) => {
      for (let j = 0; j < FA.BINS; j++) {
        if (!row[j]) continue;
        ctx.fillStyle = hsl((j + 0.5) * (360 / FA.BINS), Math.min(1, 0.18 + (row[j] / n) * 5));
        ctx.fillRect(X(t), Y((j + 1) * (360 / FA.BINS)), bw, bh);
      }
    });
    const xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    if (!THUMB) L.axes(c, { X, Y, yTicks: [0, 90, 180, 270, 360], yFmt: (v) => v + '°', xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '라운드 (세로는 색상환의 각도)' });
  }

  // ---------- ③ 다양성 ----------
  function drawDiv() {
    const c = L.chart($('c-div'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.rounds;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => v.toFixed(2), xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '라운드' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(1)); ctx.lineTo(m.l + pw, Y(1)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText('1 = 제각각 (최대) · 0 = 모두 같은 스타일', m.l + pw - 4, Y(1) + 15);
    L.line(ctx, H.map((v, t) => [X(t), Y(v)]), css('--accent'), 2.5);
    const last = H.length - 1; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(H[last]), 4.5, 0, 7); ctx.fill();
  }

  // ---------- ④ ⑤ 스윕 ----------
  const sweepOpts = (rows, rows2, label, x1, ticks, marker) => ({
    data: rows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
    series: [{ data: rows2.map((d) => ({ x: d.x, runs: [], mean: L.mean(d.runs) })), color: '#8a93a6' }],
    x0: 0, x1, y0: 0, y1: Math.max(0.8, Math.ceil(Math.max(0, ...rows.concat(rows2).flatMap((d) => d.runs)) * 5 + 0.25) / 5), xTicks: ticks, xFmt: (v) => v.toFixed(v % 1 ? 1 : 0), yFmt: (v) => v.toFixed(1), xLabel: label, marker: { x: marker },
  });
  function drawBeta() { L.dots($('c-beta'), sweepOpts(betaRows, betaRows2, '트렌드세터가 달아나는 속도 (도/라운드)', 5, [0, 1, 2, 3, 4, 5], sim.params.beta)); }
  function drawAlpha() { L.dots($('c-alpha'), sweepOpts(alphaRows, alphaRows2, '대중이 따라 하는 속도 (도/라운드)', 5, [0.5, 1, 2, 3, 4, 5], sim.params.alpha)); }
  let betaRows2 = [], alphaRows2 = [];

  function renderStats() {
    const fm = sim.followerMean(), hueNow = Math.round(((fm.angle % 360) + 360) % 360), r = sim.rotation(), gap = sim.gap();
    const rotating = sim.round >= 30 && Math.abs(r) >= 0.02;
    const cards = [
      ['지금의 대세 스타일', `${hueNow}°`, '대중의 평균 스타일 (색상환의 각도)'],
      ['유행이 도는 속도', sim.round >= 30 ? `${r.toFixed(2)}바퀴/100라운드` : '-', rotating ? `한 바퀴에 약 ${Math.round(100 / Math.abs(r))}라운드` : '도는 유행이 없어요'],
      ['다양성', sim.diversity().toFixed(2), '0이면 모두 같은 스타일, 1이면 제각각'],
      ['트렌드세터의 앞선 정도', `${gap >= 0 ? '+' : ''}${Math.round(gap)}°`, '대중보다 색상환에서 앞에 있는 각도 (+면 앞)'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawWheel(); drawStrip(); drawDiv(); }

  function after() {
    const P = params(); betaRows = []; alphaRows = []; betaRows2 = []; alphaRows2 = [];
    drawBeta(); drawAlpha(); $('note-beta').textContent = '계산 중…'; $('note-alpha').textContent = '계산 중…';
    const R = 300, jobs = [];
    for (let b = 0; b <= 5; b += 0.5) jobs.push(() => {
      betaRows.push({ x: b, runs: FA.measure(Object.assign({}, P, { beta: b, rounds: R }), 2).map((r) => r.rotation) });
      betaRows2.push({ x: b, runs: FA.measure(Object.assign({}, P, { beta: b, alpha: 5, rounds: R }), 1).map((r) => r.rotation) });
    });
    [0.5, 1, 1.5, 2, 2.5, 3, 4, 5].forEach((a) => jobs.push(() => {
      alphaRows.push({ x: a, runs: FA.measure(Object.assign({}, P, { alpha: a, rounds: R }), 2).map((r) => r.rotation) });
      alphaRows2.push({ x: a, runs: FA.measure(Object.assign({}, P, { alpha: a, beta: 5, rounds: R }), 1).map((r) => r.rotation) });
    }));
    L.jobs(jobs, () => { drawBeta(); drawAlpha(); }, () => {
      $('note-beta').textContent = `파랑: 지금 설정(따라 하는 속도 ${P.alpha}도), 회색: 따라 하는 속도 5도인 사회`;
      $('note-alpha').textContent = `파랑: 지금 설정(달아나는 속도 ${P.beta}도), 회색: 달아나는 속도 5도인 트렌드세터`;
    });
  }

  const h = L.harness({
    controls: ['share', 'alpha', 'beta', 'jitter'],
    format: { share: (v) => v + '%', alpha: (v) => Number(v).toFixed(1) + '°', beta: (v) => Number(v).toFixed(1) + '°', jitter: (v) => Number(v).toFixed(1) + '°' },
    defaults: { share: 15, alpha: 2, beta: 2, jitter: 1 },
    build() { sim = FA.create(params()); trail = [sim.followerMean().angle]; if (THUMB) { while (sim.advance()) trail.push(sim.followerMean().angle); } },
    advance() { const r = sim.advance(); if (r) { trail.push(sim.followerMean().angle); if (trail.length > 200) trail.shift(); } return r; },
    autoplay: !THUMB,
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawBeta(); drawAlpha(); }, seedLabel: '유행 번호',
  });
  seedGetter = h.seed;
})();
