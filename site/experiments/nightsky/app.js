(function () {
  'use strict';
  const NS = window.NightSky, L = window.Lab, C = NS.C;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 시골 하늘이 다 어두워진 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_STAR = '#2f6fed', C_LUM = '#e8590c', C_REF = '#64748b', C_A = '#2f6fed', C_B = '#94a3b8';
  const CITY = ['깜깜한 산속', '시골', '교외', '작은 도시', '큰 도시', '도심 한복판'];
  const fmt = (v) => Math.round(v).toLocaleString('en-US');
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0, SWEEP = null;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), width: Number($('width').value), dust: Number($('dust').value), city: Number($('city').value) });
  const speed = () => ($('speed') ? Number($('speed').value) : 20);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.NightState = { sim, lastStepAt, interval: 1 / (speed() * 0.7), isPaused, thumb: THUMB }; }

  // ---------- ② 등급별 별 수 (재생 시점까지, 세로축은 로그) ----------
  const YMAX = 100000, Y0 = -0.35, logY = (c, v) => c.m.t + c.ph - ((Math.log10(Math.max(0.45, v)) - Y0) / (Math.log10(YMAX) - Y0)) * c.ph;   // 맨 아래를 1보다 조금 낮게: 1개짜리 막대도 보이게
  const binName = (j) => (j === 0 ? '~0' : `${j - 1}~${j}`);
  function drawHist() {
    const cv = $('c-hist'), items = [{ kind: 'box', color: C_STAR, label: '그 등급에 보이는 별 수' }, { kind: 'dash', color: C_REF, label: '한 등급마다 4배씩 늘어나는 선' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 50, r: 12, t: 30 }), { ctx, m, pw, ph } = c;
    const nb = sim.lim + 1, gw = pw / nb, Y = (v) => logY(c, v);
    L.axes(c, { X: (j) => m.l + (j + 0.5) * gw, Y, yTicks: [1, 10, 100, 1000, 10000, 100000], yFmt: (v) => (v >= 1000 ? fmt(v) : String(v)), xTicks: [], xLabel: '보이는 밝기 (등급, 오른쪽일수록 어두움)', yLabel: '별 수 (개, 눈금마다 10배)' });
    const b = sim.bins(), narrow = pw < 420;
    for (let j = 0; j < nb; j++) {
      const x0 = m.l + j * gw + gw * 0.14, bw = gw * 0.72, v = b[j];
      if (v > 0) { ctx.fillStyle = C_STAR; ctx.fillRect(x0, Y(v), bw, m.t + ph - Y(v)); }
      if (v > 0 || sim.cur >= j) { ctx.font = '700 ' + (narrow ? 10 : 11.5) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(fmt(v), x0 + bw / 2, (v > 0 ? Y(v) : m.t + ph) - 4); }
      ctx.font = (narrow ? 10 : 11.5) + 'px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
      ctx.fillText(binName(j), x0 + bw / 2, m.t + ph + 15);
    }
    // 4배 선: 다 드러난 칸 가운데 10개 이상인 첫 칸을 기준으로, 드러난 칸까지만
    const full = Math.min(nb - 1, Math.floor(sim.cur));   // 칸 j는 (j-1)~j등급 → cur ≥ j 이면 다 드러남
    let a = -1; for (let j = 1; j <= full; j++) if (b[j] >= 10) { a = j; break; }
    if (a >= 0 && full > a) {
      ctx.strokeStyle = C_REF; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath();
      for (let j = a; j <= full; j++) { const x = m.l + (j + 0.5) * gw, y = Y(b[a] * Math.pow(4, j - a)); if (j === a) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 거리와 보이는 밝기 (재생 시점까지) ----------
  function drawDist() {
    const cv = $('c-dist'), items = [{ kind: 'dot', color: C_LUM, label: '원래 밝은 별 (원래 밝기 상위 10%)' }, { kind: 'dot', color: C_STAR, label: '그 밖의 별' }, { kind: 'dash', color: C_REF, label: '지금 보이는 한계' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 12, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (d) => m.l + (d / C.R) * pw, Y = (v) => m.t + ((v + 1.5) / (C.LIMITS[0] + 2)) * ph;   // 위가 밝음 (-1.5 ~ 7.5등급 고정)
    L.axes(c, { X, Y, yTicks: [-1, 1, 3, 5, 7], xTicks: [0, 20, 40, 60, 80, 100], xLabel: '관측자에서 거리 (이 모델의 단위)', yLabel: '보이는 밝기 (등급, 위가 밝음)' });
    const o = sim.order, r = pw < 420 ? 1.6 : 2;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? C_LUM : C_STAR; ctx.globalAlpha = pass ? 0.9 : 0.55;
      for (let k = 0; k < sim.shown; k++) { const i = o[k]; if (sim.bright(i) !== !!pass) continue; ctx.beginPath(); ctx.arc(X(sim.d[i]), Y(sim.m[i]), r, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C_REF; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(sim.cur)); ctx.lineTo(m.l + pw, Y(sim.cur)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    L.drawLegendBelow(c, items);
  }

  // 막대 이름: 칸보다 길면 띄어쓰기에서 두 줄로 (휴대폰에서 이름끼리 겹치지 않게)
  function nameLines(ctx, name, w) {
    const t = window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(name) : name;
    if (ctx.measureText(t).width <= w) return [name];
    const k = t.lastIndexOf(' ');   // 번역된 글자에서 나눈다(조각으로 나누면 번역이 깨진다)
    return k > 0 ? [t.slice(0, k), t.slice(k + 1)] : [name];
  }
  function barName(ctx, name, cx, y, w, bold, narrow, sub) {
    ctx.font = (bold ? '700 ' : '600 ') + (narrow ? 10 : 12) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
    const ls = nameLines(ctx, name, w); ls.forEach((l, i) => ctx.fillText(l, cx, y + i * 12));
    ctx.font = (narrow ? 9.5 : 11) + 'px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(sub, cx, y + 15 + (ls.length - 1) * 12);
  }
  // ---------- ④⑤ 집계 (기본 설정, 8판 평균: validate와 같은 계산) ----------
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  const CONDS = [['base', '기본', {}], ['n2', '별 2배', { n: 200 }], ['w0', '밝기 모두 같음', { width: 0 }], ['w2', '밝기 차이 2배', { width: 200 }], ['d50', '먼지 50%', { dust: 50 }], ['d100', '먼지 100%', { dust: 100 }]];
  function computeSweep(done) {
    const out = { cond: {}, city: null }, jobs = [];
    CONDS.forEach(([id, , o]) => jobs.push(() => {
      const rs = SEEDS.map((seed) => NS.summary(Object.assign({}, NS.DEFAULTS, o, { seed })));
      const avg = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
      out.cond[id] = { ratio: Math.round(avg((r) => r.ratio) * 10) / 10, n6: Math.round(avg((r) => r.cum[6])), n2: Math.round(avg((r) => r.cum[2])) };
      if (id === 'base') out.city = C.LIMITS.map((lim) => Math.round(avg((r) => r.cum[lim])));
    }));
    L.jobs(jobs, null, () => { SWEEP = out; done(); });
  }
  function drawCond() {
    if (!SWEEP) return;
    const cv = $('c-sweep'), items = [{ kind: 'box', color: C_A, label: '한 등급마다 별이 늘어나는 배수' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 34, l: 38, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / CONDS.length, Y = (v) => m.t + ph - (v / 5) * ph, narrow = gw < 70, P = params();
    L.axes(c, { X: (v) => v, Y, yTicks: [0, 1, 2, 3, 4, 5], yFmt: (v) => v + '×', xTicks: [], yLabel: '배수 (×)' });
    ctx.strokeStyle = C_REF; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(m.l, Y(4)); ctx.lineTo(m.l + pw, Y(4)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    CONDS.forEach(([id, name, o], i) => {
      const s = SWEEP.cond[id], x0 = m.l + i * gw, bw = Math.min(40, gw * 0.55), x = x0 + (gw - bw) / 2;
      const cur = Object.entries(Object.assign({}, NS.DEFAULTS, o)).every(([k, v]) => k === 'seed' || k === 'city' || P[k] === v);
      if (cur) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      ctx.fillStyle = C_A; ctx.fillRect(x, Y(s.ratio), bw, Y(0) - Y(s.ratio));
      ctx.font = '700 ' + (narrow ? 10.5 : 12) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(s.ratio.toFixed(1), x + bw / 2, Y(s.ratio) - 4);
      barName(ctx, name, x0 + gw / 2, m.t + ph + 15, gw - 4, cur, narrow, `${fmt(s.n6)}개`);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 30 }) }), items);
  }
  function drawCity() {
    if (!SWEEP) return;
    const cv = $('c-city'), items = [{ kind: 'box', color: C_B, label: '보이는 별 수 (하늘 전체)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 34, l: 50, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / CITY.length, Y = (v) => logY(c, v), narrow = gw < 70, P = params();
    L.axes(c, { X: (v) => v, Y, yTicks: [1, 10, 100, 1000, 10000, 100000], yFmt: (v) => (v >= 1000 ? fmt(v) : String(v)), xTicks: [], yLabel: '별 수 (개, 눈금마다 10배)' });
    CITY.forEach((name, i) => {
      const v = SWEEP.city[i], x0 = m.l + i * gw, bw = Math.min(40, gw * 0.55), x = x0 + (gw - bw) / 2, cur = P.city === i;
      if (cur) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      ctx.fillStyle = cur ? C_A : C_B; if (v > 0) ctx.fillRect(x, Y(v), bw, m.t + ph - Y(v));
      ctx.font = '700 ' + (narrow ? 10.5 : 12) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(fmt(v), x + bw / 2, (v > 0 ? Y(v) : m.t + ph) - 4);
      barName(ctx, name, x0 + gw / 2, m.t + ph + 15, gw - 4, cur, narrow, `${C.LIMITS[i]}등급까지`);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 30 }) }), items);
  }
  function notes() {
    if (!SWEEP) return;
    const S = SWEEP.cond;
    $('note-s').textContent = `한 등급마다: 기본 ${S.base.ratio.toFixed(1)}배 · 별 2배 ${S.n2.ratio.toFixed(1)}배 · 밝기 모두 같음 ${S.w0.ratio.toFixed(1)}배 · 먼지 100% ${S.d100.ratio.toFixed(1)}배`;
    $('note-c').textContent = `보이는 별: 깜깜한 산속 ${fmt(SWEEP.city[0])}개 · 시골 ${fmt(SWEEP.city[1])}개 · 큰 도시 ${fmt(SWEEP.city[4])}개 · 도심 한복판 ${fmt(SWEEP.city[5])}개`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const playing = !sim.done, hi = Math.min(7, Math.floor(sim.cur)), rt = hi >= 5 ? NS.ratio(sim, hi) : NaN;
    const n2 = sim.brighter(Math.min(2, sim.cur)), top = sim.shown >= 20 ? NS.topBright(sim, 20) : -1;
    const cards = [
      ['지금 보이는 별', `${fmt(sim.shown)}개`, `가상의 별 ${fmt(sim.N)}개 중 ${(sim.shown / sim.N * 100).toFixed(2)}%`, false],
      ['아주 밝은 별 (2등급보다 밝음)', `${fmt(n2)}개`, sim.cur >= 2 ? '하늘 전체에서' : '하늘이 더 어두워지면 다 보여요', false],
      ['한 등급 어두워질 때마다', isFinite(rt) ? `${rt.toFixed(1)}배` : '', isFinite(rt) ? `3등급~${hi}등급 사이 평균` : '5등급까지 보이면 잴 수 있어요', playing],
      ['밝게 보이는 20개 중 원래 밝은 별', top >= 0 ? `${top}개` : '', top >= 0 ? '나머지는 가까워서 밝아 보이는 별' : '별이 20개 보이면 셀 수 있어요', playing],
    ];
    $('stats').innerHTML = cards.map(([k, v, s, dim]) => `<div class="stat"${dim ? ' style="opacity:.55"' : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `보이는 한계 ${sim.cur.toFixed(1)}등급 / ${sim.lim}등급`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawHist(); drawDist(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 120) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 140); }
  }
  function drawSweeps() { drawCond(); drawCity(); notes(); }

  const h = L.harness({
    controls: ['n', 'width', 'dust', 'city'],
    format: { n: (v) => fmt(v * 1000), width: (v) => '±' + (v / 100).toFixed(2), dust: (v) => v + '%', city: (v) => CITY[v] },
    defaults: { n: 100, width: 100, dust: 0, city: 1 },
    speedScale: 0.7,
    build() {
      sim = NS.create(params());
      if (THUMB) sim.finish();
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done) return false; sim.step(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '밤',
  });
  seedGetter = h.seed;
  computeSweep(drawSweeps);
  window.NightSkyApp = { params, sim: () => sim, sweep: () => SWEEP };
})();
