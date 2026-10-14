(function () {
  'use strict';
  const OV = window.Ovation, L = window.Lab;
  const { css, mix, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 기립이 다 번진 끝 장면으로 바로 간다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0); // 확인용: ?t=초 (그 시점으로 바로 가서 멈춤)
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const BLUE = '#2f6fed', NAVY = '#16307a', SEAT = 'rgba(99,106,122,.42)', FRONT = '#e07b39', BACK = '#1b8a8f', GRAY = '#8a93a6';
  const PLACE = { front: '앞쪽 두 줄', random: '아무 데나', back: '뒤쪽 두 줄' };
  const pct = (v) => Math.round(v * 100) + '%';
  let sim = null, seedGetter = () => 1, qRows = [], kRows = { front: [], random: [], back: [] };
  let sel = null; // 시야를 보여 줄 사람(자리 번호). 기본은 뒤쪽 가운데의 한 사람
  const params = () => ({
    seed: seedGetter(), quality: Number($('quality').value) / 100, follow: Number($('follow').value) / 100,
    starters: Number($('starters').value), place: $('place').value,
  });

  // ---------- ① 관객석 ----------
  function personPath(ctx, x, y, h) {   // 사람 픽토그램: 머리 + 어깨/몸통 (발 끝이 y)
    const r = h * 0.22, bw = h * 0.62;
    ctx.beginPath(); ctx.arc(x, y - h + r, r, 0, 7);
    ctx.moveTo(x - bw / 2, y); ctx.lineTo(x - bw / 2, y - h * 0.34); ctx.quadraticCurveTo(x - bw / 2, y - h * 0.58, x, y - h * 0.58);
    ctx.quadraticCurveTo(x + bw / 2, y - h * 0.58, x + bw / 2, y - h * 0.34); ctx.lineTo(x + bw / 2, y); ctx.closePath();
  }
  function chip(ctx, text, x, y, color, w, below) {   // 이름표: 글상자 + 그 사람까지 곧게 이어진 선
    ctx.font = '600 12px ' + FONT;
    const tw = ctx.measureText(text).width + 16, th = 22;
    let cx = x - tw / 2, cy = below ? y + 16 : y - 44;
    cx = Math.max(6, Math.min(cx, w - tw - 6));
    const tx = Math.min(Math.max(x, cx + 12), cx + tw - 12), ty = below ? cy : cy + th;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; roundRect(ctx, cx, cy, tw, th, 11); ctx.fill(); ctx.restore();
    ctx.strokeStyle = color; roundRect(ctx, cx, cy, tw, th, 11); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, cx + 8, cy + 15); ctx.lineWidth = 1;
  }
  let geo = null;   // 자리 → 화면 좌표 (클릭으로 사람을 고를 때도 쓴다)
  const hallItems = () => [{ kind: 'box', color: SEAT, label: '앉아 있는 사람' }, { kind: 'box', color: NAVY, label: '처음 일어선 사람' }, { kind: 'box', color: BLUE, label: '따라 일어선 사람' }, { kind: 'box', color: mix('#f2b705', 0.45), label: '고른 사람에게 보이는 자리' }];
  function drawHall() {
    const cv = $('c-hall'), cw = cv.clientWidth || 400, R = sim.rows, C = sim.cols;
    const pad = 8, px = (cw - pad * 2) / C, py = px * 1.18, stageH = THUMB ? 0 : 30;
    const items = hallItems(), sp = THUMB ? { b: 0 } : L.belowSpace(cv, items), legB = THUMB ? 6 : sp.b - 22;
    const hallH = stageH + 10 + R * py + legB;
    const { ctx, w, h } = L.setup(cv, hallH / cw);
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    if (!THUMB) {   // 무대
      const gr = ctx.createLinearGradient(0, 0, 0, stageH);
      gr.addColorStop(0, '#5b4636'); gr.addColorStop(1, '#8a6a4f');
      ctx.fillStyle = gr; roundRect(ctx, pad, 4, w - pad * 2, stageH - 6, 8); ctx.fill();
      ctx.fillStyle = '#fff4e2'; ctx.font = '600 12.5px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('무대', w / 2, stageH / 2 + 5);
      ctx.font = '11px ' + FONT; ctx.fillStyle = 'rgba(255,244,226,.8)'; ctx.textAlign = 'left'; ctx.fillText('↓ 앞줄', pad + 8, stageH / 2 + 5);
    }
    const top = stageH + 10;
    geo = { pad, px, py, top, R, C };
    const sx = (c) => pad + (c + 0.5) * px, sy = (r) => top + (r + 1) * py;   // 자리 발 끝 위치
    // 고른 사람의 시야
    const seen = new Uint8Array(sim.n);
    if (sel != null && !THUMB) sim.vis[sel].forEach((j) => { seen[j] = 1; });
    for (let i = 0; i < sim.n; i++) {
      const r = Math.floor(i / C), c = i % C;
      ctx.fillStyle = seen[i] ? mix('#f2b705', 0.32) : 'rgba(99,106,122,.07)';
      roundRect(ctx, sx(c) - px * 0.44, sy(r) - py * 0.86, px * 0.88, py * 0.8, 3); ctx.fill();
    }
    for (let i = 0; i < sim.n; i++) {
      const r = Math.floor(i / C), c = i % C, x = sx(c), y = sy(r) - py * 0.08;
      if (sim.stand[i]) {
        const fresh = sim.at[i] === sim.step && sim.step > 0 && !THUMB;
        personPath(ctx, x, y, py * 0.98); ctx.fillStyle = sim.starter[i] ? NAVY : BLUE; ctx.fill();
        if (fresh) { ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.lineWidth = 1; }
      } else { personPath(ctx, x, y, py * 0.5); ctx.fillStyle = SEAT; ctx.fill(); }
    }
    if (sel != null && !THUMB) {
      const r = Math.floor(sel / C), c = sel % C, v = sim.vis[sel];
      let up = 0; v.forEach((j) => { up += sim.stand[j]; });
      const x = sx(c), y = sy(r) - py * (sim.stand[sel] ? 0.98 : 0.5) - py * 0.08;
      const col = '#a36b00';
      const txt = sim.stand[sel] ? `이 사람: 일어섬 · 보이는 ${v.length}명 중 ${up}명 섬` : (sim.th[sel] > 1 ? `이 사람: 보이는 ${v.length}명 중 ${up}명 섬 · 따라 일어서지 않는 사람` : `이 사람: 보이는 ${v.length}명 중 ${up}명 섬 · 기준 ${Math.round(sim.th[sel] * 100)}%`);
      chip(ctx, txt, x, y, col, w, r < 3);
    }
    if (!THUMB) L.drawLegendBelow({ ctx, w, h, m: { l: 0, r: 0, t: 0, b: sp.b } }, items);
    $('when').textContent = `${sim.step}초 · 일어선 사람 ${Math.round(sim.share() * 100)}%`;
  }
  $('c-hall').addEventListener('click', (e) => {
    if (!geo) return;
    const rc = $('c-hall').getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    const c = Math.floor((x - geo.pad) / geo.px), r = Math.floor((y - geo.top) / geo.py);
    if (c < 0 || c >= geo.C || r < 0 || r >= geo.R) return;
    sel = r * geo.C + c; drawHall();
  });

  // ---------- ② 시간에 따른 기립 비율 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-time'), items = [{ kind: 'line', color: NAVY, label: '전체' }, { kind: 'line', color: FRONT, label: '앞쪽 절반 (무대에 가까운 6줄)' }, { kind: 'line', color: BACK, label: '뒤쪽 절반 (먼 6줄)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.62 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40 }), { ctx, m, pw, ph } = c;
    const T = sim.params.maxSteps, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph;
    const xt = []; for (let t = 0; t <= T; t += 10) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => String(Math.round(v * 100)), xTicks: xt, xFmt: (t) => String(t), xLabel: '공연이 끝난 뒤 (초)', yLabel: '일어선 사람 (%)' });
    L.line(ctx, sim.front.map((v, t) => [X(t), Y(v)]), FRONT, 2);
    L.line(ctx, sim.back.map((v, t) => [X(t), Y(v)]), BACK, 2);
    L.line(ctx, sim.history.map((v, t) => [X(t), Y(v)]), NAVY, 3);
    const t = sim.step, v = sim.share();   // 지금 시점의 값에 큰 숫자
    ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(X(t), Y(v), 4.5, 0, 7); ctx.fill();
    ctx.font = '700 15px ' + FONT; ctx.textAlign = X(t) > m.l + pw * 0.8 ? 'right' : 'left';
    L.label(ctx, pct(v), X(t) + (ctx.textAlign === 'right' ? -8 : 8), Math.max(m.t + 14, Y(v) - 8));
    ctx.font = '12px ' + FONT;
    L.drawLegendBelow(c, items);
  }

  // ---------- ③④ 집계: 여러 번 돌린 결과 (점 = 한 번, 선 = 평균) ----------
  function sweepChart(cv, o) {
    const items = o.series.map((s) => ({ kind: 'line', color: s.color, label: s.label }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.62 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40 }), { ctx, m, pw, ph } = c;
    const X = (x) => m.l + ((x - o.x0) / (o.x1 - o.x0)) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => String(Math.round(v * 100)), xTicks: o.xTicks, xFmt: o.xFmt, xLabel: o.xLabel, yLabel: '결국 일어선 사람 (%)' });
    o.series.forEach((s) => {
      ctx.fillStyle = mix(s.color, 0.2);
      s.rows.forEach((d) => d.runs.forEach((r) => { ctx.beginPath(); ctx.arc(X(d.x), Y(r), 2.4, 0, 7); ctx.fill(); }));
      L.line(ctx, s.rows.map((d) => [X(d.x), Y(L.mean(d.runs))]), s.color, 2.5);
      ctx.fillStyle = s.color; s.rows.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(L.mean(d.runs)), 3.3, 0, 7); ctx.fill(); });
    });
    if (o.marker != null) L.vline(c, X(o.marker), css('--rich'), '지금 설정', o.marker > (o.x0 + o.x1) / 2 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  const PCOL = { front: FRONT, random: GRAY, back: BACK };
  function drawQ() {
    const P = params(), xs = [40, 50, 60, 70, 80, 90];
    sweepChart($('c-q'), { x0: 0.4, x1: 0.95, xTicks: xs.map((v) => v / 100), xFmt: (v) => String(Math.round(v * 100)), xLabel: '공연 만족도 (%)', marker: P.quality,
      series: [{ rows: qRows, color: PCOL[P.place], label: `처음 ${P.starters}명이 ${PLACE[P.place]}에서 일어설 때` }] });
  }
  function drawK() {
    const P = params();
    sweepChart($('c-k'), { x0: 0, x1: 30, xTicks: [0, 5, 10, 15, 20, 25, 30], xFmt: (v) => String(v), xLabel: '처음 일어선 사람 (명)', marker: P.starters,
      series: ['front', 'random', 'back'].map((k) => ({ rows: kRows[k], color: PCOL[k], label: PLACE[k] })) });
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const s = sim.share(), n = sim.n, up = Math.round(s * n), followers = up - sim.nStarters, P = sim.params;
    const cards = [
      ['일어선 사람', pct(s), sim.done ? `끝 · ${sim.step}초 동안 번짐` : `${sim.step}초째 · 번지는 중`],
      ['앞쪽 절반 / 뒤쪽 절반', `${pct(sim.front[sim.step])} / ${pct(sim.back[sim.step])}`, '무대에 가까운 6줄 / 먼 6줄'],
      ['처음 일어선 사람', sim.nStarters + '명', `${PLACE[P.place]} · 전체 ${n}명 중 ${Math.round(sim.nStarters / n * 100)}%`],
      ['따라 일어선 사람', followers + '명', sim.nStarters ? `처음 일어선 1명이 평균 ${(followers / sim.nStarters).toFixed(1)}명을 일으킴` : '처음 일어선 사람이 없으면 아무도 안 일어서요'],
    ];
    $('stats').classList.toggle('live', !sim.done);
    $('stats').innerHTML = cards.map(([k, v, t], i) => `<div class="stat"><div class="k"${i === 0 ? ` style="color:${NAVY}"` : ''}>${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawHall(); drawTime(); }

  function after() {
    const P = params(); qRows = []; kRows = { front: [], random: [], back: [] }; drawQ(); drawK();
    $('note-q').textContent = '계산 중…'; $('note-k').textContent = '계산 중…';
    const jobs = [], RUNS = 10;
    for (let q = 40; q <= 95; q += 5) jobs.push(() => { qRows.push({ x: q / 100, runs: OV.finals(Object.assign({}, P, { quality: q / 100, seed: 1 }), RUNS) }); });
    for (let k = 0; k <= 30; k += 2) ['front', 'random', 'back'].forEach((pl) => jobs.push(() => { kRows[pl].push({ x: k, runs: OV.finals(Object.assign({}, P, { starters: k, place: pl, seed: 1 }), RUNS) }); }));
    L.jobs(jobs, () => { drawQ(); drawK(); }, () => {
      $('note-q').textContent = '만족도가 어느 선을 넘으면 결국 일어선 비율이 한꺼번에 올라갑니다 (처음 일어선 사람이 앞쪽에 있을 때)';
      $('note-k').textContent = '같은 수라도 앞쪽에서 일어서면 크게 번지고, 뒤쪽에서 일어서면 거의 번지지 않습니다';
    });
  }

  const h = L.harness({
    controls: ['quality', 'follow', 'starters', 'place'],
    format: { quality: (v) => v + '%', follow: (v) => v + '%', starters: (v) => String(v), place: () => '' },
    defaults: { quality: 75, follow: 60, starters: 8, place: 'front' },
    build() {
      sim = OV.create(params());
      if (sel == null) sel = 8 * sim.cols + 12;
      if (THUMB) sim.run(); else if (JUMP) for (let k = 0; k < JUMP && sim.advance(); k++);
    },
    autoplay: !THUMB && !JUMP, speedScale: 0.6,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawQ(); drawK(); }, seedLabel: '관객석',
  });
  seedGetter = h.seed;
})();
