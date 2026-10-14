(function () {
  'use strict';
  const MM = window.Murmuration, L = window.Lab;
  const { css, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 떼가 한 몸으로 날다 매가 파고드는 순간에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_POL = '#2f6fed', C_COH = '#d97706', C_HAWK = 'rgba(217,72,15,.13)', C_HAWK_LINE = '#d9480f', C_A = '#2f6fed', C_B = '#94a3b8';
  // 집계(미리 계산): node tools/validate-murmuration.js 출력과 같아야 한다 (기본 설정, 시드 4개 평균)
  const SWEEP = {"k":{"1":{"pol":29,"coh":7,"clu":0,"big":1,"nb":1},"3":{"pol":81,"coh":54,"clu":1.4,"big":70,"nb":3},"7":{"pol":91,"coh":72,"clu":1,"big":95,"nb":7},"15":{"pol":93,"coh":77,"clu":1,"big":99,"nb":15}},"rules":{"all":{"pol":91,"coh":72,"clu":1,"big":95,"nb":7},"coh0":{"pol":91,"coh":65,"clu":1.1,"big":87,"nb":7},"ali0":{"pol":3,"coh":25,"clu":0,"big":1,"nb":7},"sep0":{"pol":78,"coh":56,"clu":3.2,"big":53,"nb":7}},"density":{"topo":{"preBig":93,"prePol":94,"nb":7,"pol":82,"big":78,"clu":2.1},"metric":{"preBig":73,"prePol":86,"nb":6.3,"pol":65,"big":54,"clu":2}},"hawk":{"rec":[57,4,183,616],"dip":[43,42,34,20]}};
  // 휴대폰은 새 수를 줄여서 시작한다 (화면이 부드럽게 움직이도록)
  const SMALL = (window.innerWidth || 1000) < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const CAP = SMALL ? 700 : 3000;
  let sim = null, seedGetter = () => 1, lastStepAt = 0, slowNote = '', stepEma = 0, chartTimer = 0, lastChart = 0;
  const params = () => ({
    seed: seedGetter(), n: Math.min(CAP, Number($('n').value)), k: Number($('k').value), mode: $('mode').value,
    coh: Number($('coh').value), ali: Number($('ali').value), sep: Number($('sep').value),
  });
  const speed = () => ($('speed') ? Number($('speed').value) : 30);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() {
    window.MurmState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB, reduce, notice: () => slowNote };
  }
  // 너무 느리면 새 수를 줄인다 (3D 쪽 프레임 측정 또는 한 걸음 계산 시간)
  function reduce(why) {
    if (!sim || sim.n <= 300) return;
    const n2 = Math.max(300, Math.round(sim.n * 0.75 / 50) * 50);
    sim.shrink(n2); slowNote = `화면이 느려서 새를 ${sim.n}마리로 줄였어요`;
    renderStats();
  }

  // ---------- ② 시간별 방향 맞음 · 뭉친 정도 (재생 시점까지) ----------
  function hawkBands(c, X) {
    const { ctx, m, ph } = c, ev = sim.events;
    for (let i = 0; i < ev.length; i++) {
      if (ev[i].type !== 'hawk') continue;
      const end = ev.slice(i + 1).find((e) => e.type === 'leave'), t1 = end ? end.t : sim.t;
      ctx.fillStyle = C_HAWK; ctx.fillRect(X(ev[i].t), m.t, Math.max(2, X(t1) - X(ev[i].t)), ph);
      const back = ev.slice(i + 1).find((e) => e.type === 'back');
      if (back) { ctx.strokeStyle = '#15803d'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(back.t), m.t); ctx.lineTo(X(back.t), m.t + ph); ctx.stroke(); ctx.setLineDash([]); }
    }
  }
  function drawTime() {
    const cv = $('c-time'), items = [{ kind: 'line', color: C_POL, label: '방향이 맞은 정도' }, { kind: 'line', color: C_COH, label: '뭉친 정도' }, { kind: 'box', color: 'rgba(217,72,15,.35)', label: '매가 있던 때' }, { kind: 'dash', color: '#15803d', label: '다시 모인 때' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 38, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.steps, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (v / 100) * ph;
    hawkBands(c, X);
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [0, 600, 1200, 1800, 2400], xLabel: '시간 (걸음)', yLabel: '정도 (0~100)' });
    const dt = MM.C.SAMPLE, H = sim.hist;
    L.line(ctx, H.coh.map((v, k) => [X(k * dt), Y(v)]), C_COH, 2.2);
    L.line(ctx, H.pol.map((v, k) => [X(k * dt), Y(v)]), C_POL, 2.6);
    const n = H.pol.length - 1;
    [[H.pol[n], C_POL], [H.coh[n], C_COH]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(n * dt), Y(v), 4, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, items);
  }
  // ③ 덩어리 수 (재생 시점까지)
  function drawClusters() {
    const cv = $('c-clu'), items = [{ kind: 'line', color: '#7c3aed', label: '덩어리 수' }, { kind: 'box', color: 'rgba(217,72,15,.35)', label: '매가 있던 때' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 38, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.steps, YM = 10, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (Math.min(YM, v) / YM) * ph;
    hawkBands(c, X);
    L.axes(c, { X, Y, yTicks: [0, 2, 4, 6, 8, 10], yFmt: (v) => (v === 10 ? '10+' : String(v)), xTicks: [0, 600, 1200, 1800, 2400], xLabel: '시간 (걸음)', yLabel: '덩어리 수 (개)' });
    const dt = MM.C.SAMPLE, H = sim.hist.clu, pts = [];
    H.forEach((v, k) => { if (k) pts.push([X(k * dt), Y(H[k - 1])]); pts.push([X(k * dt), Y(v)]); });
    L.line(ctx, pts, '#7c3aed', 2.2);
    const n = H.length - 1; ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.arc(X(n * dt), Y(H[n]), 4, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }

  // ---------- ④⑤⑥ 집계 막대 ----------
  // groups: [{ name, vals:[a,b], sub, cur }], series: [{ label, color }]
  function bars(cv, groups, series, yLabel) {
    const items = series.map((s) => ({ kind: 'box', color: s.color, label: s.label }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 38, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / groups.length, Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [], yLabel });
    groups.forEach((g, i) => {
      const x0 = m.l + i * gw;
      if (g.cur) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      const bw = Math.min(34, (gw - 18) / g.vals.length);
      const start = x0 + (gw - bw * g.vals.length - 4 * (g.vals.length - 1)) / 2;
      g.vals.forEach((v, k) => {
        const x = start + k * (bw + 4); ctx.fillStyle = series[k].color; ctx.fillRect(x, Y(v), bw, Y(0) - Y(v));
        ctx.font = '700 11.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + bw / 2, Y(v) - 4);
      });
      ctx.font = (g.cur ? '700 ' : '600 ') + '12px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(g.name, x0 + gw / 2, m.t + ph + 16);
      ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(g.sub, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);   // 막대 이름 두 줄 아래
  }
  const SER = [{ label: '방향이 맞은 정도', color: C_A }, { label: '가장 큰 덩어리에 든 새 (%)', color: C_B }];
  function drawK() {
    if (!SWEEP.k) return;
    const P = params(), groups = [1, 3, 7, 15].map((k) => { const s = SWEEP.k[k]; return { name: `이웃 ${k}마리`, vals: [s.pol, s.big], sub: `덩어리 ${s.clu}`, cur: P.mode === 'topo' && P.k === k }; });
    bars($('c-k'), groups, SER, '정도 · 비율 (0~100)');
  }
  function drawRules() {
    if (!SWEEP.rules) return;
    const P = params(), R = SWEEP.rules, cur = (a, b, c) => P.mode === 'topo' && P.k === 7 && P.coh === a && P.ali === b && P.sep === c;
    const groups = [['all', '모두 있음', cur(100, 100, 100)], ['coh0', '붙기 없음', cur(0, 100, 100)], ['ali0', '맞추기 없음', cur(100, 0, 100)], ['sep0', '피하기 없음', cur(100, 100, 0)]]
      .map(([id, name, c]) => ({ name, vals: [R[id].pol, R[id].big], sub: `덩어리 ${R[id].clu}`, cur: c }));
    bars($('c-rules'), groups, SER, '정도 · 비율 (0~100)');
  }
  function drawDensity() {
    if (!SWEEP.density) return;
    const P = params(), D = SWEEP.density;
    const groups = [['topo', '가까운 7마리'], ['metric', '일정 거리 안']].map(([id, name]) => ({ name, vals: [D[id].preBig, D[id].big], sub: `이웃 평균 ${D[id].nb}`, cur: P.mode === id }));
    bars($('c-dens'), groups, [{ label: '옮기기 전', color: '#64748b' }, { label: '절반을 퍼뜨린 뒤', color: '#0ea5a5' }], '가장 큰 덩어리에 든 새 (%)');
  }
  function notes() {
    if (!SWEEP.k) return;
    const K = SWEEP.k, R = SWEEP.rules, D = SWEEP.density;
    $('note-k').textContent = `방향이 맞은 정도: 이웃 1마리 ${K[1].pol} · 3마리 ${K[3].pol} · 7마리 ${K[7].pol} · 15마리 ${K[15].pol}`;
    $('note-r').textContent = `방향이 맞은 정도: 모두 ${R.all.pol} · 붙기 없음 ${R.coh0.pol} · 맞추기 없음 ${R.ali0.pol} · 피하기 없음 ${R.sep0.pol}`;
    $('note-d').textContent = `가장 큰 덩어리: 가까운 7마리 ${D.topo.preBig}% → ${D.topo.big}% · 일정 거리 안 ${D.metric.preBig}% → ${D.metric.big}%`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const m = sim.last, H = sim.hawk, ev = sim.events, minC = MM.minCluster(sim.n);
    let back = '', backSub = '매 보내기를 누르면 재 봐요';
    if (ev.some((e) => e.type === 'hawk')) {
      if (sim.recover != null) { back = `${sim.recover}걸음`; backSub = '매가 떠난 뒤 다시 한 덩어리로 모일 때까지'; }
      else if (H) backSub = H.phase === 'dive' ? '매가 떼로 돌진하는 중' : '매가 떠나는 중';
      else backSub = sim.done ? '이 판 안에 다시 모이지 못했어요' : '다시 모이는 중';
    }
    const want = Number($('n').value), nSub = slowNote || (sim.n < want ? `휴대폰이라 ${want}마리 대신 줄였어요` : `한 마리가 보는 이웃: 평균 ${sim.avgNeighbors().toFixed(1)}마리`);
    const cards = [
      ['지금 방향이 맞은 정도', String(Math.round(m.pol)), '0 제각각 ~ 100 모두 같은 방향', false],
      ['덩어리 수', `${m.clu}개`, `새 ${minC}마리 이상 무리만 셈`, false],
      ['새 수', `새 ${sim.n}마리`, nSub, false],
      ['매가 지나간 뒤 다시 모인 시간', back, backSub, false],
    ];
    $('stats').innerHTML = cards.map(([k, v, s, dim]) => `<div class="stat"${dim ? ' style="opacity:.55"' : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${sim.t} / ${sim.params.steps}걸음`;
    const hb = $('hawk'); if (hb) hb.disabled = !!H || sim.done;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawTime(); drawClusters(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { drawK(); drawRules(); drawDensity(); notes(); }

  const h = L.harness({
    controls: ['n', 'k', 'coh', 'ali', 'sep', 'mode'],
    format: { n: (v) => String(Math.min(CAP, v)), k: (v) => String(v), coh: (v) => v + '%', ali: (v) => v + '%', sep: (v) => v + '%', mode: () => '' },
    defaults: { n: 1500, k: 7, coh: 100, ali: 100, sep: 100, mode: 'topo' },
    speedScale: 1,
    build() {
      sim = MM.create(params()); slowNote = ''; stepEma = 0;
      if (THUMB) { for (let t = 0; t < 520; t++) { if (t === 425) sim.sendHawk(); sim.step(); } }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() {
      if (sim.done) return false;
      const t0 = performance.now(); sim.step(); const dt = performance.now() - t0;
      stepEma = stepEma ? stepEma * 0.95 + dt * 0.05 : dt;
      if (sim.t % 60 === 0 && stepEma * speed() > 450) reduce('step');   // 1초에 450ms 넘게 계산하면 줄인다
      lastStepAt = performance.now(); return true;
    },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '날',
  });
  seedGetter = h.seed;
  const hb = $('hawk');
  if (hb) hb.addEventListener('click', () => { if (sim && sim.sendHawk()) { renderStats(); drawCharts(); } });
  window.MurmApp = { params, sendHawk: () => sim && sim.sendHawk(), sim: () => sim };
})();
