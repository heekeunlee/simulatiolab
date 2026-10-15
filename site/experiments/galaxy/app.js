(function () {
  'use strict';
  const GX = window.Galaxy, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 첫 근접 통과 뒤 꼬리가 길게 자란 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_A = '#3b6fd8', C_B = '#d98a0b', C_SEP = '#7c3aed', C_MERGE = '#15803d', C_GRAY = '#94a3b8';
  // 집계(미리 계산): node tools/validate-galaxy.js 출력과 같아야 한다
  const SWEEP = {"base":{"peri":1.6,"periR":0.97,"merged":3.4,"tail":49,"tailA":50,"tailB":46,"close":[1498,18,0],"s0":0.02,"n":6000,"nA":4000,"nB":2000},"size":{"close":[1486.3,17.7,0],"pairs":8000000},"spin":{"pro":{"tail":49,"tailA":50,"tailB":49,"merged":3.4},"retro":{"tail":13,"tailA":4,"tailB":31,"merged":3.4},"mix":{"tail":44,"tailA":50,"tailB":31,"merged":3.4}},"rp":{"50":{"tail":49,"tailA":46,"tailB":53,"merged":2.6},"100":{"tail":49,"tailA":50,"tailB":49,"merged":3.4},"150":{"tail":40,"tailA":41,"tailB":38,"merged":6.5},"200":{"tail":0,"tailA":0,"tailB":0,"merged":null},"300":{"tail":0,"tailA":0,"tailB":0,"merged":null}},"q":{"10":{"tail":22,"tailA":20,"tailB":31,"merged":5.3},"25":{"tail":42,"tailA":42,"tailB":42,"merged":4},"50":{"tail":49,"tailA":50,"tailB":49,"merged":3.4},"100":{"tail":55,"tailA":54,"tailB":56,"merged":3.1}},"tilt":{"0":{"tail":51,"tailA":52,"tailB":50,"merged":3.4},"30":{"tail":49,"tailA":50,"tailB":49,"merged":3.4},"60":{"tail":39,"tailA":36,"tailB":47,"merged":3.4},"90":{"tail":25,"tailA":17,"tailB":41,"merged":3.4}}};
  // 휴대폰은 별 수를 줄여서 시작한다 (화면이 부드럽게 움직이도록)
  const SMALL = (window.innerWidth || 1000) < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const NSTAR = SMALL ? 2000 : 6000;
  let sim = null, seedGetter = () => 1, lastStepAt = 0, slowNote = '', stepEma = 0, chartTimer = 0, lastChart = 0;
  const params = () => ({ seed: seedGetter(), n: NSTAR, q: Number($('q').value), rp: Number($('rp').value), tilt: Number($('tilt').value), spin: $('spin').value });
  const speed = () => ($('speed') ? Number($('speed').value) : 90);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const turns = (t) => sim.turns(t);

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.GalaxyState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB, reduce }; }
  function reduce() {
    if (!sim || sim.n <= 800) return;
    const n2 = Math.max(800, Math.round(sim.n * 0.75 / 100) * 100);
    sim.shrink(n2); slowNote = `화면이 느려서 별을 ${sim.n}개로 줄였어요`;
    renderStats();
  }

  // ---------- ② 두 은하 중심 사이 거리 (재생 시점까지) ----------
  function timeAxis(c) {
    const { m, pw } = c, T = sim.params.turns;
    return { X: (tt) => m.l + (tt / T) * pw, ticks: Array.from({ length: T / 2 + 1 }, (_, k) => k * 2) };
  }
  function mergeMark(c, X) {
    if (sim.merged == null) return;
    const { ctx, m, ph } = c, x = X(turns(sim.merged));
    ctx.strokeStyle = C_MERGE; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawSep() {
    const cv = $('c-sep'), items = [{ kind: 'line', color: C_SEP, label: '두 중심 사이 거리' }, { kind: 'dash', color: C_MERGE, label: '합쳐진 때' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 38, r: 14, t: 30 }), { ctx, m, ph } = c;
    const { X, ticks } = timeAxis(c), YM = 8, Y = (v) => m.t + ph - (Math.min(YM, v) / YM) * ph;
    L.axes(c, { X, Y, yTicks: [0, 2, 4, 6, 8], xTicks: ticks, xLabel: '시간 (바퀴)', yLabel: '거리 (큰 은하 반지름 = 1)' });
    // 원반 반지름 1 높이에 옅은 띠: 이보다 가까우면 두 원반이 겹친다
    ctx.fillStyle = 'rgba(124,58,237,.07)'; ctx.fillRect(m.l, Y(1), c.pw, Y(0) - Y(1));
    mergeMark(c, X);
    const H = sim.hist.sep, dt = GX.C.SAMPLE;
    L.line(ctx, H.map((v, k) => [X(turns(k * dt)), Y(v)]), C_SEP, 2.4);
    const n = H.length - 1; ctx.fillStyle = C_SEP; ctx.beginPath(); ctx.arc(X(turns(n * dt)), Y(H[n]), 4, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }
  // ③ 꼬리로 떨어져 나간 별 (재생 시점까지)
  function drawTail() {
    const cv = $('c-tail'), items = [{ kind: 'line', color: C_A, label: '큰 은하의 별' }, { kind: 'line', color: C_B, label: '작은 은하의 별' }, { kind: 'dash', color: C_MERGE, label: '합쳐진 때' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 38, r: 14, t: 30 }), { ctx, m, ph } = c;
    const { X, ticks } = timeAxis(c), Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], xTicks: ticks, xLabel: '시간 (바퀴)', yLabel: '꼬리로 나간 별 (%)' });
    mergeMark(c, X);
    const dt = GX.C.SAMPLE;
    [[sim.hist.tailB, C_B], [sim.hist.tailA, C_A]].forEach(([H, col]) => {
      L.line(ctx, H.map((v, k) => [X(turns(k * dt)), Y(v)]), col, 2.4);
      const n = H.length - 1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(turns(n * dt)), Y(H[n]), 4, 0, 7); ctx.fill();
    });
    L.drawLegendBelow(c, items);
  }

  // ---------- ④⑤⑥ 집계 막대 ----------
  // groups: [{ name, vals:[..], sub, cur }], series: [{ label, color }], yMax, yTicks
  function bars(cv, groups, series, yLabel, yMax, yTicks, valFmt) {
    const items = series.map((s) => ({ kind: 'box', color: s.color, label: s.label }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 44, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / groups.length, Y = (v) => m.t + ph - (Math.min(yMax, v) / yMax) * ph;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks, xTicks: [], yLabel });
    const narrow = (cv.clientWidth || 400) < 480;
    groups.forEach((g, i) => {
      const x0 = m.l + i * gw;
      if (g.cur) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      const bw = Math.min(34, (gw - 18) / g.vals.length);
      const start = x0 + (gw - bw * g.vals.length - 4 * (g.vals.length - 1)) / 2;
      g.vals.forEach((v, k) => {
        const x = start + k * (bw + 4); ctx.fillStyle = series[k].color; ctx.fillRect(x, Y(v), bw, Math.max(v > 0 ? 1.5 : 0, Y(0) - Y(v)));
        ctx.font = '700 ' + (narrow ? 10.5 : 11.5) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(valFmt ? valFmt(v) : String(v), x + bw / 2, Y(v) - 4);
      });
      ctx.font = (g.cur ? '700 ' : '600 ') + (narrow ? 11 : 12) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(g.name, x0 + gw / 2, m.t + ph + 16);
      ctx.font = (narrow ? 10 : 11) + 'px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(g.sub, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);
  }
  function drawSize() {
    if (!SWEEP.size) return;
    const c = SWEEP.size.close, groups = [['1/10', c[0]], ['1/100', c[1]], ['1/1000', c[2]]].map(([nm, v]) => ({ name: `간격의 ${nm}`, vals: [v], sub: v === 0 ? '한 쌍도 없음' : `${Math.round(v).toLocaleString()}쌍` }));
    bars($('c-size'), groups, [{ label: '가까이 지나간 별 쌍 (기본 설정 3판 평균)', color: '#0ea5a5' }], '별 쌍 (쌍)', 1600, [0, 400, 800, 1200, 1600], (v) => (v < 100 ? String(v) : String(Math.round(v))));
  }
  function drawSpin() {
    if (!SWEEP.spin) return;
    const P = params(), S = SWEEP.spin;
    const groups = [['pro', '둘 다 같은 방향'], ['retro', '둘 다 반대 방향'], ['mix', '큰 은하만 같은 방향']].map(([id, name]) => ({ name, vals: [S[id].tailA, S[id].tailB], sub: `전체 ${S[id].tail}%`, cur: P.spin === id && P.q === 50 && P.rp === 100 && P.tilt === 30 }));
    bars($('c-spin'), groups, [{ label: '큰 은하의 별', color: C_A }, { label: '작은 은하의 별', color: C_B }], '꼬리로 나간 별 (%)', 100, [0, 25, 50, 75, 100], (v) => v + '%');
  }
  function drawRp() {
    if (!SWEEP.rp) return;
    const P = params(), R = SWEEP.rp;
    const groups = [50, 100, 150, 200, 300].map((rp) => ({ name: `${fmt1(rp / 100)}배`, vals: [R[rp].tail], sub: R[rp].merged == null ? '안 합쳐짐' : `${fmt1(R[rp].merged)}바퀴`, cur: P.rp === rp && P.spin === 'pro' && P.q === 50 && P.tilt === 30 }));
    bars($('c-rp'), groups, [{ label: '꼬리로 나간 별 (%)', color: C_SEP }], '꼬리로 나간 별 (%)', 100, [0, 25, 50, 75, 100], (v) => v + '%');
  }
  function notes() {
    if (!SWEEP.size) return;
    const c = SWEEP.size.close, S = SWEEP.spin, R = SWEEP.rp;
    $('note-s').textContent = `가능한 별 쌍 ${SWEEP.size.pairs.toLocaleString()}쌍 중 · 간격의 1/10: ${Math.round(c[0])}쌍 · 1/100: ${c[1]}쌍 · 1/1000: ${c[2]}쌍`;
    $('note-p').textContent = `큰 은하의 별이 꼬리로 나간 비율: 같은 방향 ${S.pro.tailA}% · 반대 방향 ${S.retro.tailA}%`;
    $('note-r').textContent = `합쳐지기까지: 0.5배 ${fmt1(R[50].merged)}바퀴 · 1.0배 ${fmt1(R[100].merged)}바퀴 · 1.5배 ${fmt1(R[150].merged)}바퀴 · 2.0배 이상은 이 판 안에 안 합쳐짐`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const L0 = sim.last, cl = sim.close, merged = sim.merged != null;
    const nSub = slowNote || (SMALL ? `휴대폰이라 6000개 대신 ${sim.n}개` : `큰 은하 ${sim.NA}개 · 작은 은하 ${sim.NB}개`);
    const cards = [
      ['별끼리 부딪힐 만큼 가까이 지나간 쌍', `${cl[2]}쌍`, `별 크기가 간격의 1/1000일 때 · 1/100이면 ${cl[1]}쌍 · 1/10이면 ${cl[0]}쌍`],
      ['꼬리로 떨어져 나간 별', `${Math.round(L0.tail)}%`, `큰 은하 ${Math.round(L0.tailA)}% · 작은 은하 ${Math.round(L0.tailB)}%`],
      ['두 은하 중심 사이 거리', merged ? '합쳐짐' : fmt1(L0.sep), merged ? `${fmt1(turns(sim.merged))}바퀴에 하나가 됐어요` : (sim.peri.length ? `가장 가까웠던 거리 ${fmt1(sim.minSep)}` : '큰 은하 반지름 = 1')],
      ['별 수', `별 ${sim.n}개`, nSub],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${fmt1(turns(sim.t))} / ${sim.params.turns}바퀴`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawSep(); drawTail(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { drawSize(); drawSpin(); drawRp(); notes(); }

  const h = L.harness({
    controls: ['q', 'rp', 'tilt', 'spin'],
    format: { q: (v) => v + '%', rp: (v) => fmt1(v / 100) + '배', tilt: (v) => v + '°', spin: () => '' },
    defaults: { q: 50, rp: 100, tilt: 30, spin: 'pro' },
    speedScale: 1,
    build() {
      sim = GX.create(params()); slowNote = ''; stepEma = 0;
      if (THUMB) { const until = Math.round(2.55 * GX.TURN / GX.C.DT); while (sim.t < until) sim.step(); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() {
      if (sim.done) return false;
      const t0 = performance.now(); sim.step(); const dt = performance.now() - t0;
      stepEma = stepEma ? stepEma * 0.95 + dt * 0.05 : dt;
      if (sim.t % 100 === 0 && stepEma * speed() > 450) reduce();   // 1초에 450ms 넘게 계산하면 줄인다
      lastStepAt = performance.now(); return true;
    },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '만남',
  });
  seedGetter = h.seed;
  window.GalaxyApp = { params, sim: () => sim };
})();
