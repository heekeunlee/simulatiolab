(function () {
  'use strict';
  const SV = window.Survivor, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const NAMES = SV.NAMES, COLORS = ['#c0392b', '#8e44ad', '#5b7db1', '#4f9a8a', '#c98a2b'];
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영용: 돌아온 비행기의 구멍 지도 한 장
  let sim = null, picks = null, full = null, mine = [], geo = null, sweep = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), eng: Number($('eng').value) / 100, budget: Number($('budget').value) });
  const pc = (v) => (v * 100).toFixed(1) + '%';
  const nameList = (a) => (a.length ? a.map((i) => NAMES[i]).join(' · ') : '-');
  const sortNum = (a) => a.slice().sort((x, y) => x - y);

  // ---------- 비행기 그림 ----------
  function sectionPath(ctx, s, P) { // P(x,y) → 화면 좌표
    ctx.beginPath();
    const ell = (c, rx, ry) => { const [x, y] = P(c[0], c[1]); ctx.moveTo(x + rx * P.s, y); ctx.ellipse(x, y, rx * P.s, ry * P.s, 0, 0, Math.PI * 2); };
    const poly = (pts) => pts.forEach(([x, y], i) => { const q = P(x, y); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    if (s === 0) SV.ENG.forEach((c) => ell(c, SV.ENG_RX, SV.ENG_RY));
    else if (s === 1) ell(SV.COCK, SV.COCK_RX, SV.COCK_RY);
    else if (s === 2) { const a = P(SV.FUS.x0, SV.FUS.y0), b = P(SV.FUS.x1, SV.FUS.y1); ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
    else if (s === 3) { poly(SV.wingPoly(1)); ctx.closePath(); poly(SV.wingPoly(-1)); }
    else { const a = P(SV.TAIL.x0, SV.TAIL.y0), b = P(SV.TAIL.x1, SV.TAIL.y1); ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
    if (s === 3) ctx.closePath();
  }
  const ANCHOR = [[0.27, 0.40], [0.5, 0.17], [0.5, 0.55], [0.84, 0.52], [0.5, 0.84]];

  function drawPlane(ctx, ox, oy, ms, mode) {
    const P = (x, y) => [ox + x * ms, oy + y * ms]; P.s = ms;
    const armored = (s) => mine.indexOf(s) >= 0;
    // 부위 바탕 (겹치는 부위는 위에 덮어 그린다: 날개 → 동체 → 꼬리 → 조종석 → 엔진)
    [3, 2, 4, 1, 0].forEach((s) => {
      sectionPath(ctx, s, P);
      ctx.fillStyle = armored(s) ? 'rgba(31,164,99,.28)' : '#e4eaf4'; ctx.fill();
      ctx.strokeStyle = armored(s) ? '#1fa463' : mode === 'thumb' ? '#6f7d96' : '#9aa5ba'; ctx.lineWidth = armored(s) ? 2.6 : mode === 'thumb' ? 2.5 : 1; ctx.stroke();
    });
    ctx.lineWidth = 1;
    // 총탄 자국
    const H = sim.hits, r = mode === 'thumb' ? ms / 190 : Math.max(1.3, ms / 130);
    for (let i = 0; i < sim.round; i++) {
      const down = H.down[i];
      if (mode !== 'all' && down) continue;
      ctx.fillStyle = mode === 'thumb' ? 'rgba(200,40,35,.9)' : mode === 'ret' ? 'rgba(40,52,84,.85)' : down ? 'rgba(210,50,40,.85)' : 'rgba(40,52,84,.55)';
      for (let q = H.start[i]; q < H.start[i + 1]; q++) ctx.fillRect(ox + H.x[q] * ms - r, oy + H.y[q] * ms - r, 2 * r, 2 * r);
    }
    // 방금 출격한 비행기의 총탄: 크게 표시 (어디에 맞았고, 돌아왔는지)
    if (mode !== 'thumb' && sim.round && sim.round < sim.params.n) {
      const i = sim.round - 1, down = H.down[i];
      if (mode === 'all' || !down) {
        ctx.strokeStyle = down ? '#d23228' : '#1d2a4a'; ctx.lineWidth = 2;
        for (let q = H.start[i]; q < H.start[i + 1]; q++) { ctx.beginPath(); ctx.arc(ox + H.x[q] * ms, oy + H.y[q] * ms, r + 4, 0, 7); ctx.stroke(); }
        ctx.lineWidth = 1;
      }
    }
    if (mode === 'thumb') return;
    // 이름표 (흰 테두리를 둘러 구멍 위에서도 읽히게)
    ctx.lineJoin = 'round';
    ctx.font = `600 ${Math.max(10, Math.round(ms / 24))}px ${FONT}`; ctx.textAlign = 'center';
    NAMES.forEach((nm, s) => {
      const [x, y] = P(ANCHOR[s][0], ANCHOR[s][1]);
      ctx.fillStyle = armored(s) ? '#117a46' : '#5a6578';
      const lab = armored(s) ? tr(nm) + ' ' + tr('방탄') : nm;
      const at = s === 0 ? SV.ENG.map((e) => P(e[0], e[1])) : [[x, y]]; // 엔진은 양쪽 엔진 위에, 나머지는 부위 가운데
      at.forEach(([tx, ty]) => {
        ty += 4; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3.5; ctx.strokeText(lab, tx, ty); ctx.lineWidth = 1;
        ctx.fillText(lab, tx, ty);
      });
    });
  }

  function drawMaps() {
    if (THUMB) {
      const c = L.chart($('c-map'), 1, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w } = c;
      ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, w);
      drawPlane(ctx, w * 0.04, w * 0.04, w * 0.92, 'thumb'); return;
    }
    const cw = $('c-map').clientWidth || 600, stack = cw < 480; // 휴대폰: 두 그림을 위아래로
    let ms, aspect;
    if (stack) { ms = Math.min(cw * 0.78, 300); aspect = (2 * (40 + ms * 0.92) + 30) / cw; }
    else { ms = Math.min((cw - 28) / 2, 440); aspect = (40 + ms * 0.9 + 34) / cw; }
    const c = L.chart($('c-map'), aspect, { l: 8, r: 8, t: 34, b: 30 }), { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    let planes;
    if (stack) {
      const ox = (w - ms) / 2, blk = 40 + ms * 0.92;
      planes = [{ ox, ty: 17, oy: 40 }, { ox, ty: 17 + blk, oy: 40 + blk }];
    } else {
      const lx = 8 + ((w - 28) / 2 - ms) / 2, rx = w - 8 - ms - ((w - 28) / 2 - ms) / 2;
      planes = [{ ox: lx, ty: 17, oy: 40 }, { ox: rx, ty: 17, oy: 40 }];
    }
    const pm = ms - 6, txt = [['돌아온 비행기에서 보이는 구멍', `${sim.returned}대 귀환`], ['실제로 맞은 총탄 전부', `${sim.round}대 출격 · ${sim.lost}대 추락`]];
    planes.forEach((q, k) => {
      ctx.textAlign = 'center'; ctx.fillStyle = css('--text'); ctx.font = `600 13px ${FONT}`; ctx.fillText(txt[k][0], q.ox + ms / 2, q.ty);
      ctx.fillStyle = css('--muted'); ctx.font = `12px ${FONT}`; ctx.fillText(txt[k][1], q.ox + ms / 2, q.ty + 14);
      drawPlane(ctx, q.ox, q.oy, pm, k ? 'all' : 'ret');
    });
    geo = { ms: pm, planes };
    ctx.fillStyle = css('--muted'); ctx.font = `12px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(mine.length ? `방탄 장갑 ${mine.length}/${sim.params.budget}곳 · 다시 누르면 뗍니다` : '부위를 눌러 방탄 장갑을 붙여 보세요 (최대 ' + sim.params.budget + '곳)', w / 2, h - 10);
    $('when').textContent = `${sim.round}/${sim.params.n}회 출격 · ${sim.returned}대 귀환`;
  }

  function drawVisible() {
    const items = [{ kind: 'box', color: mix(css('--unlucky'), 0.85), label: '절반 미만' }, { kind: 'box', color: mix(css('--accent'), 0.75), label: '절반 이상 보임' }];
    const sp = L.belowSpace($('c-vis'), items), vw = $('c-vis').clientWidth || 600;
    const c = L.chart($('c-vis'), (vw < 480 ? 0.8 : 0.55) + sp.extra / (vw || 400), { l: 54, r: vw < 480 ? 24 : 46, t: 28, b: sp.b }), { ctx, m, pw, ph, w, h } = c;
    const X = (v) => m.l + v * pw, row = ph / 5;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); ctx.fillText(Math.round(v * 100) + '%', X(v), h - m.b + 16); });
    L.axisNames(c, '보이는 비율 (%)', '비행기 부위');
    NAMES.forEach((nm, s) => {
      const y = m.t + s * row + row / 2, v = sim.holesAll[s] ? sim.holesRet[s] / sim.holesAll[s] : 0;
      ctx.textAlign = 'right'; ctx.fillStyle = css('--text'); ctx.fillText(nm, m.l - 8, y + 4);
      if (sim.holesAll[s]) {
        ctx.fillStyle = v < 0.5 ? mix(css('--unlucky'), 0.85) : mix(css('--accent'), 0.75);
        ctx.fillRect(X(0), y - row * 0.3, v * pw, row * 0.6);
        ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.fillText((v * 100).toFixed(0) + '%', X(v) + 5, y + 4);
      }
    });
    if (!sim.round) { ctx.textAlign = 'center'; ctx.fillStyle = css('--muted'); ctx.fillText('재생을 누르면 채워져요', m.l + pw / 2, m.t + ph / 2); }
    else L.drawLegendBelow(c, items);
  }

  // 재생이 도달한 출격 횟수까지만 센 값 (끝까지 가면 최종값과 같다). 너무 적을 때는 ready=false
  const MIN_ROUNDS = 40;
  let liveKey = -1, liveVal = null;
  function live() {
    if (liveKey === sim.round && liveVal && liveVal.sim === sim) return liveVal;
    const R = sim.round, P = sim.params;
    if (R >= P.n) liveVal = { sim, ready: true, picks, full };
    else if (R < MIN_ROUNDS) liveVal = { sim, ready: false, picks, full: null };
    else {
      const pk = sim.picks(P.budget, R);
      liveVal = { sim, ready: true, picks: pk, full: { none: sim.survival([], R), intuitive: sim.survival(pk.intuitive, R), wald: sim.survival(pk.wald, R), best: sim.survival(pk.best, R) } };
    }
    liveKey = R; return liveVal;
  }
  function strategyRows() {
    const lv = live(), f = lv.full, pk = lv.picks, rd = lv.ready, R = sim.round;
    const rows = [
      { k: '보강 없음', arm: [], v: rd ? f.none : null, color: '#8a93a6' },
      { k: '구멍 많은 곳', arm: rd ? pk.intuitive : [], v: rd ? f.intuitive : null, color: '#e0a100' },
      { k: '빈 곳 (월드)', arm: rd ? pk.wald : [], v: rd ? f.wald : null, color: css('--accent') },
    ];
    if (mine.length) rows.push({ k: '내 선택', arm: sortNum(mine), v: rd ? sim.survival(mine, R) : null, color: '#1fa463' });
    rows.push({ k: '최선 (모든 조합 비교)', arm: rd ? pk.best : [], v: rd ? f.best : null, color: '#7c5cff' });
    return rows;
  }
  function drawBars() {
    const rows = strategyRows(), cw = $('c-bar').clientWidth || 600, c = L.chart($('c-bar'), 0.2 + rows.length * (cw < 480 ? 0.2 : 0.1), { l: 112, r: 50, t: 28, b: 36 }), { ctx, m, pw, ph, w, h } = c;
    const X = (v) => m.l + v * pw, row = ph / rows.length;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); ctx.fillText(Math.round(v * 100) + '%', X(v), h - m.b + 16); });
    L.axisNames(c, '생존율 (%)', '보강 방법');
    rows.forEach((r, i) => {
      const y = m.t + i * row + row / 2;
      ctx.textAlign = 'right'; ctx.fillStyle = css('--text'); ctx.font = `600 12px ${FONT}`; ctx.fillText(r.k, m.l - 8, y - 1);
      ctx.fillStyle = css('--muted'); ctx.font = `11px ${FONT}`; ctx.fillText(nameList(r.arm), m.l - 8, y + 12);
      const v = r.v == null ? 0 : r.v;
      if (r.v != null) { ctx.fillStyle = r.color; ctx.fillRect(X(0), y - row * 0.28, v * pw, row * 0.56); }
      ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = `600 12px ${FONT}`; ctx.fillText(r.v == null ? '–' : pc(r.v), X(v) + 5, y + 4);
      ctx.font = `12px ${FONT}`;
    });
  }

  function drawSweep() {
    if (!sweep.length) { L.dots($('c-sweep'), { data: [], x0: 0, x1: 0.9, y0: 0.4, y1: 1, xTicks: [0, 0.3, 0.6, 0.9], xFmt: L.pct, xLabel: '엔진 치명률 (%)', yLabel: '생존율 (%)' }); return; }
    L.dots($('c-sweep'), {
      data: sweep[0].pts, y0: 0.4, y1: 1, series: sweep.slice(1).map((r) => ({ data: r.pts, color: r.color })),
      x0: 0, x1: 0.9, xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], xFmt: (v) => Math.round(v * 100) + '%', xLabel: '엔진 치명률 (%)', yLabel: '생존율 (%)',
      legend: [{ kind: 'line', color: '#8a93a6', label: '보강 없음' }, { kind: 'line', color: '#e0a100', label: '구멍 많은 곳 보강' }, { kind: 'line', color: css('--accent'), label: '빈 곳 보강' }], legendPos: 'bl',
      marker: { x: sim.params.eng, label: '지금 설정' },
    });
  }

  function renderStats() {
    const P = sim.params, lv = live(), rd = lv.ready, f = lv.full, pk = lv.picks, R = sim.round;
    const mineV = mine.length && rd ? sim.survival(mine, R) : null;
    const cards = [
      ['보강 없을 때 생존율', rd ? pc(f.none) : '-', rd ? `${R}회 출격 중 ${Math.round(f.none * R)}회 귀환` : ''],
      ['구멍 많은 곳에 보강', rd ? pc(f.intuitive) : '-', rd ? nameList(pk.intuitive) : ''],
      ['빈 곳에 보강 (월드)', rd ? pc(f.wald) : '-', rd ? nameList(pk.wald) : ''],
      ['내 선택', mineV == null ? '-' : pc(mineV), mineV == null ? (mine.length ? '' : '그림의 부위를 눌러 고르세요') : nameList(sortNum(mine))],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    if (!rd) { $('note-s').textContent = ''; return; }
    const d = f.wald - f.intuitive;
    const dd = Math.abs(d * 100).toFixed(1) + '%p';
    $('note-s').textContent = d >= 0 ? `빈 곳에 보강하면 구멍 많은 곳에 보강할 때보다 생존율이 ${dd} 높아요` : `빈 곳에 보강하면 구멍 많은 곳에 보강할 때보다 생존율이 ${dd} 낮아요`;
  }

  function syncButtons() {
    NAMES.forEach((nm, s) => { const b = $('tg-' + s); if (b) b.className = mine.indexOf(s) >= 0 ? 'primary' : ''; });
  }
  function toggle(s) {
    const i = mine.indexOf(s);
    if (i >= 0) mine.splice(i, 1); else { mine.push(s); while (mine.length > sim.params.budget) mine.shift(); }
    refreshMine();
  }
  function setMine(a) { mine = a.slice(0, sim.params.budget); refreshMine(); }
  function refreshMine() { syncButtons(); renderStats(); drawMaps(); drawBars(); }

  function draw() { renderStats(); drawMaps(); drawVisible(); drawBars(); syncButtons(); }

  function after() {
    const P = params(); sweep = []; drawSweep(); $('note-n').textContent = '계산 중…';
    const cfg = [{ key: 'wald', color: css('--accent') }, { key: 'none', color: '#8a93a6' }, { key: 'intuitive', color: '#e0a100' }];
    cfg.forEach((c) => { c.pts = []; sweep.push(c); });
    const jobs = [];
    for (let e = 0; e <= 90; e += 10) jobs.push(() => {
      const runs = { none: [], intuitive: [], wald: [] };
      [1, 2, 3].forEach((k) => { const r = SV.study({ seed: k * 17 + e, n: P.n, eng: e / 100, budget: P.budget }); ['none', 'intuitive', 'wald'].forEach((q) => runs[q].push(r[q])); });
      cfg.forEach((c) => c.pts.push({ x: e / 100, runs: c.key === 'wald' ? runs.wald : [], mean: L.mean(runs[c.key]) }));
    });
    L.jobs(jobs, drawSweep, () => {
      const at = (key, x) => sweep.find((c) => c.key === key).pts.find((p) => Math.abs(p.x - x) < 1e-9).mean;
      $('note-n').textContent = `엔진 치명률 0%에서 구멍 많은 곳 보강 ${pc(at('intuitive', 0))} · 빈 곳 보강 ${pc(at('wald', 0))}, 90%에서는 ${pc(at('intuitive', 0.9))} · ${pc(at('wald', 0.9))}입니다`;
    });
  }

  const h = L.harness({
    controls: ['eng', 'n', 'budget'],
    format: { eng: (v) => v + '%', n: (v) => v + '회', budget: (v) => v + '곳' },
    defaults: { eng: 50, n: 2000, budget: 2 },
    build() {
      const P = params(); sim = SV.create(P);
      picks = sim.picks(P.budget);
      full = { none: sim.survival([]), intuitive: sim.survival(picks.intuitive), wald: sim.survival(picks.wald), best: sim.survival(picks.best) };
      mine = mine.slice(0, P.budget);
    },
    advance() { return THUMB ? false : sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawVisible(); drawBars(); drawSweep(); }, seedLabel: '출격 기록 번호',
  });
  seedGetter = h.seed;
  if (THUMB) { while (sim.round < 500 && sim.advance()); draw(); }

  // 눌러서 고르기: 그림의 부위, 또는 아래 버튼
  $('c-map').addEventListener('click', (ev) => {
    if (!geo || !sim) return;
    const r = $('c-map').getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
    for (const q of geo.planes) {
      const s = SV.sectionAt((px - q.ox) / geo.ms, (py - q.oy) / geo.ms);
      if (px >= q.ox && px <= q.ox + geo.ms && py >= q.oy && py <= q.oy + geo.ms && s >= 0) { toggle(s); return; }
    }
  });
  NAMES.forEach((nm, s) => { const b = $('tg-' + s); if (b) b.addEventListener('click', () => toggle(s)); });
  $('pick-int').addEventListener('click', () => setMine(live().picks.intuitive));
  $('pick-wald').addEventListener('click', () => setMine(live().picks.wald));
  $('pick-clear').addEventListener('click', () => setMine([]));
})();
