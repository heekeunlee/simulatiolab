(function () {
  'use strict';
  const AJ = window.AiJobs, L = window.Lab;
  const { css, mix, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 22해쯤, 신입·중간 층이 얇아지고 밀린 일 상자가 쌓인 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const CJ = '#22a06b', CM = '#2f6fed', CS = '#5b3cc4', CB = '#c2410c', CZ = '#8a94a6', CY = '#e8590c', CC = '#7c3aed';
  // 집계(미리 계산): node tools/validate-aijobs.js 출력의 SWEEP과 같아야 한다 (시드 8개, 역전 해·사라진 해는 중앙값)
  const SWEEP = {"grid":{"30_0":{"rev":26,"revN":5,"even":-1,"evenN":2,"total":95,"first5":96,"last5":106,"S":135,"S0":184},"30_50":{"rev":-1,"revN":4,"even":-1,"evenN":3,"total":97,"first5":97,"last5":104,"S":144,"S0":184},"30_100":{"rev":-1,"revN":2,"even":-1,"evenN":0,"total":97,"first5":99,"last5":96,"S":165,"S0":184},"50_0":{"rev":14,"revN":8,"even":19,"evenN":7,"total":114,"first5":93,"last5":145,"S":101,"S0":184},"50_50":{"rev":18,"revN":8,"even":25,"evenN":5,"total":102,"first5":97,"last5":119,"S":127,"S0":184},"50_100":{"rev":-1,"revN":2,"even":-1,"evenN":0,"total":97,"first5":100,"last5":96,"S":161,"S0":184},"70_0":{"rev":12,"revN":8,"even":15,"evenN":8,"total":135,"first5":91,"last5":183,"S":70,"S0":184},"70_50":{"rev":14,"revN":8,"even":18,"evenN":7,"total":110,"first5":96,"last5":133,"S":111,"S0":184},"70_100":{"rev":15,"revN":5,"even":-1,"evenN":4,"total":101,"first5":101,"last5":102,"S":148,"S0":184},"90_0":{"rev":10,"revN":8,"even":13,"evenN":8,"total":156,"first5":89,"last5":221,"S":36,"S0":184},"90_50":{"rev":11,"revN":8,"even":13,"evenN":8,"total":129,"first5":95,"last5":166,"S":86,"S0":184},"90_100":{"rev":11,"revN":5,"even":-1,"evenN":4,"total":103,"first5":101,"last5":106,"S":141,"S0":184}},"mix":{"0_0":{"rev":14,"revN":8,"even":19,"evenN":7,"total":114,"first5":93,"last5":145,"S":101,"S0":184},"0_50":{"rev":14,"revN":8,"even":20,"evenN":8,"total":113,"first5":94,"last5":145,"S":107,"S0":184},"50_0":{"rev":18,"revN":8,"even":25,"evenN":5,"total":102,"first5":97,"last5":119,"S":127,"S0":184},"50_50":{"rev":-1,"revN":2,"even":-1,"evenN":1,"total":93,"first5":98,"last5":97,"S":151,"S0":184},"100_0":{"rev":-1,"revN":2,"even":-1,"evenN":0,"total":97,"first5":100,"last5":96,"S":161,"S0":184},"100_50":{"rev":25,"revN":5,"even":-1,"evenN":0,"total":102,"first5":102,"last5":102,"S":185,"S0":184}},"pen":{"0":{"rev":-1,"revN":0,"even":-1,"evenN":0,"total":75,"first5":93,"last5":67,"S":101,"S0":184},"1":{"rev":22,"revN":5,"even":-1,"evenN":1,"total":94,"first5":93,"last5":106,"S":101,"S0":184},"2":{"rev":14,"revN":8,"even":19,"evenN":7,"total":114,"first5":93,"last5":145,"S":101,"S0":184},"4":{"rev":11,"revN":8,"even":13,"evenN":8,"total":153,"first5":93,"last5":223,"S":101,"S0":184}},"ret":{"6":{"rev":-1,"revN":0,"even":-1,"evenN":0,"total":77,"first5":95,"last5":65,"S":192,"S0":299},"10":{"rev":14,"revN":8,"even":19,"evenN":7,"total":114,"first5":93,"last5":145,"S":101,"S0":184},"14":{"rev":7,"revN":8,"even":8,"evenN":8,"total":139,"first5":97,"last5":167,"S":69,"S0":133}}};
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0;
  const params = () => ({
    seed: seedGetter(), s: Number($('s').value), b: Number($('b').value), e: Number($('e').value),
    r: Number($('r').value), pen: Number($('pen').value),
  });
  const speed = () => ($('speed') ? Number($('speed').value) : 2);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  // 3D 사다리(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.AiJobsState = { sim, lastStepAt, interval: 1 / (speed() * 0.7), isPaused, thumb: THUMB }; }

  // ---------- ② 단계별 사람 수 (재생 시점까지, 점선 = 같은 해 AI 없음) ----------
  function yMaxPop() {   // 축은 시작할 때 아는 값(0해 사람 수)으로 정해 재생 중 흔들리지 않게
    const H = sim.hist, m = Math.max(H.J[0], H.M[0], H.S[0]);
    return Math.max(150, Math.ceil((m * 1.35) / 50) * 50);
  }
  function drawPop() {
    const cv = $('c-pop'), items = [{ kind: 'line', color: CJ, label: '신입' }, { kind: 'line', color: CM, label: '중간 경력' }, { kind: 'line', color: CS, label: '숙련' }, { kind: 'dash', color: CZ, label: '점선: AI 없을 때 (같은 해)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.years, YM = yMaxPop(), X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (Math.min(v, YM) / YM) * ph;
    const yt = []; for (let v = 0; v <= YM; v += YM > 250 ? 100 : 50) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, xTicks: [0, 5, 10, 15, 20, 25, 30], xLabel: 'AI가 들어온 뒤 (해)', yLabel: '사람 수 (명)' });
    const H = sim.hist;
    [['J0', CJ], ['M0', CM], ['S0', CS]].forEach(([k, col]) => { ctx.setLineDash([5, 4]); L.line(ctx, H[k].map((v, t) => [X(t), Y(v)]), mix(col, 0.55), 1.8); ctx.setLineDash([]); });
    [['J', CJ], ['M', CM], ['S', CS]].forEach(([k, col]) => L.line(ctx, H[k].map((v, t) => [X(t), Y(v)]), col, 2.8));
    const n = H.J.length - 1;
    [['J', CJ], ['M', CM], ['S', CS]].forEach(([k, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(n), Y(H[k][n]), 4, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, items);
  }
  // ---------- ③ 비용 (AI 없을 때 = 100, 재생 시점까지) ----------
  function drawCost() {
    const cv = $('c-cost'), items = [{ kind: 'line', color: CY, label: '그해 비용' }, { kind: 'dash', color: CC, label: '처음부터 합친 비용' }, { kind: 'line', color: CZ, label: 'AI 없을 때 = 100' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.years, Y0 = 50, Y1 = 250, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - ((Math.max(Y0, Math.min(Y1, v)) - Y0) / (Y1 - Y0)) * ph;
    L.axes(c, { X, Y, yTicks: [50, 100, 150, 200, 250], xTicks: [0, 5, 10, 15, 20, 25, 30], xLabel: 'AI가 들어온 뒤 (해)', yLabel: '비용 (AI 없을 때 = 100)' });
    const H = sim.hist, n = H.cost.length;
    // 아낀 쪽(100 아래)은 초록, 더 든 쪽(100 위)은 빨강으로 칠한다
    for (let k = 0; k < n; k++) {
      const v = (100 * H.cost[k]) / H.cost0[k], x0 = X(k), x1 = X(k + 1);
      ctx.fillStyle = v < 100 ? 'rgba(34,160,107,.16)' : 'rgba(220,38,38,.14)';
      ctx.fillRect(x0, Math.min(Y(v), Y(100)), x1 - x0, Math.abs(Y(v) - Y(100)));
    }
    ctx.strokeStyle = CZ; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(m.l, Y(100)); ctx.lineTo(m.l + pw, Y(100)); ctx.stroke(); ctx.lineWidth = 1;
    const yr = H.cost.map((c0, k) => [X(k + 0.5), Y((100 * c0) / H.cost0[k])]);
    let a = 0, z = 0; const cum = H.cost.map((c0, k) => { a += c0; z += H.cost0[k]; return [X(k + 1), Y((100 * a) / z)]; });
    ctx.setLineDash([6, 4]); L.line(ctx, cum, CC, 2.2); ctx.setLineDash([]);
    L.line(ctx, yr, CY, 2.8);
    if (n) { ctx.fillStyle = CY; ctx.beginPath(); ctx.arc(yr[n - 1][0], yr[n - 1][1], 4, 0, 7); ctx.fill(); }
    if (sim.revYear > 0) L.vline(c, X(sim.revYear - 0.5), '#b91c1c', '역전 ' + sim.revYear + '해째', sim.revYear > T * 0.6 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }

  // ---------- ④ 대체율 × 보충 비율: 역전된 해 (집계 표) ----------
  function drawGrid() {
    const cv = $('c-grid'), narrow = (cv.clientWidth || 400) < 560;
    const c = L.chart(cv, narrow ? 0.92 : 0.5, { l: narrow ? 76 : 120, r: 10, t: 46, b: narrow ? 50 : 36 }), { ctx, m, pw, ph } = c;
    const S = [30, 50, 70, 90], B = [0, 50, 100], P = params(), cw = pw / B.length, ch = ph / S.length;
    ctx.font = '600 11.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
    ctx.fillText('미래를 위해 계속 뽑는 비율 →', m.l, 16);
    B.forEach((b, j) => { ctx.textAlign = 'center'; ctx.font = '700 12.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.fillText(b + '%', m.l + (j + 0.5) * cw, m.t - 9); });
    S.forEach((s, i) => {
      ctx.textAlign = 'right'; ctx.font = '700 12.5px ' + FONT; ctx.fillStyle = css('--text');
      ctx.fillText((narrow ? '' : 'AI 대체율 ') + s + '%', m.l - 8, m.t + (i + 0.5) * ch + 4);
      B.forEach((b, j) => {
        const g = SWEEP.grid[s + '_' + b], x = m.l + j * cw + 3, y = m.t + i * ch + 3, w = cw - 6, h = ch - 6;
        const col = g.rev < 0 ? '#eef1f6' : g.rev <= 12 ? '#dc2626' : g.rev <= 16 ? '#f97316' : g.rev <= 22 ? '#fdba74' : '#fde6c8';
        ctx.fillStyle = col; roundRect(ctx, x, y, w, h, 7); ctx.fill();
        if (P.s === s && P.b === b && P.e === 0 && P.r === 10 && P.pen === 2) { ctx.strokeStyle = '#111827'; ctx.lineWidth = 2.5; roundRect(ctx, x, y, w, h, 7); ctx.stroke(); ctx.lineWidth = 1; }
        const dark = g.rev > 0 && g.rev <= 16;
        ctx.fillStyle = dark ? '#fff' : css('--text'); ctx.textAlign = 'center';
        ctx.font = '800 ' + (narrow ? 15 : 18) + 'px ' + FONT; ctx.fillText(g.rev < 0 ? '없음' : g.rev + '해째', x + w / 2, y + h / 2 + (narrow ? 0 : 1));
        ctx.font = (narrow ? 10.5 : 11.5) + 'px ' + FONT; ctx.fillStyle = dark ? 'rgba(255,255,255,.9)' : css('--muted');
        ctx.fillText('합계 ' + g.total, x + w / 2, y + h / 2 + (narrow ? 15 : 18));
      });
    });
    ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.textAlign = 'left';
    if (narrow) { ctx.fillText('칸 = 역전된 해(8판 중앙값)', 6, c.h - 24); ctx.fillText('합계: 30해, AI 없음 = 100', 6, c.h - 8); }
    else ctx.fillText('칸 = 역전된 해(8판 중앙값) · 합계: 30해, AI 없음 = 100', 6, c.h - 10);
  }
  // ---------- 집계 막대 (⑤ 보충×가르침, ⑥ 벌점, ⑦ 은퇴) ----------
  function bars(cv, groups, series, yLabel, yMax) {
    const items = series.map((s) => ({ kind: 'box', color: s.color, label: s.label }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 40, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / groups.length, Y = (v) => m.t + ph - (Math.min(v, yMax) / yMax) * ph;
    const yt = []; for (let v = 0; v <= yMax; v += 50) yt.push(v);
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: yt, xTicks: [], yLabel });
    ctx.strokeStyle = CZ; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(m.l, Y(100)); ctx.lineTo(m.l + pw, Y(100)); ctx.stroke(); ctx.setLineDash([]);
    groups.forEach((g, i) => {
      const x0 = m.l + i * gw;
      if (g.cur) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      const bw = Math.min(40, (gw - 18) / g.vals.length), start = x0 + (gw - bw * g.vals.length - 4 * (g.vals.length - 1)) / 2;
      g.vals.forEach((v, k) => {
        const x = start + k * (bw + 4); ctx.fillStyle = series[k].color; ctx.fillRect(x, Y(v), bw, Y(0) - Y(v));
        ctx.font = '700 11.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + bw / 2, Y(v) - 4);
      });
      ctx.font = (g.cur ? '700 ' : '600 ') + '12px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(g.name, x0 + gw / 2, m.t + ph + 16);
      ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(g.sub, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);
  }
  const revTxt = (g) => (g.rev < 0 ? '없음' : g.rev + '해째');
  function drawMix() {
    const P = params(), base = P.s === 50 && P.r === 10 && P.pen === 2;
    const groups = [0, 50, 100].map((b) => ({ name: '뽑기 ' + b + '%', vals: [SWEEP.mix[b + '_0'].total, SWEEP.mix[b + '_50'].total], sub: revTxt(SWEEP.mix[b + '_0']) + ' / ' + revTxt(SWEEP.mix[b + '_50']), cur: base && P.b === b && (P.e === 0 || P.e === 50) }));
    bars($('c-mix'), groups, [{ label: '가르치는 효과 0%', color: '#94a3b8' }, { label: '가르치는 효과 50%', color: CJ }], '30해 합계 비용 (AI 없을 때 = 100)', 150);
  }
  function drawPen() {
    const P = params(), base = P.s === 50 && P.b === 0 && P.e === 0 && P.r === 10;
    const groups = [0, 1, 2, 4].map((v) => ({ name: '손해 ' + v, vals: [SWEEP.pen[v].total], sub: revTxt(SWEEP.pen[v]), cur: base && P.pen === v }));
    bars($('c-pen'), groups, [{ label: '30해 합계 비용', color: CY }], '30해 합계 비용 (AI 없을 때 = 100)', 200);
  }
  function drawRet() {
    const P = params(), base = P.s === 50 && P.b === 0 && P.e === 0 && P.pen === 2;
    const groups = [6, 10, 14].map((v) => ({ name: '은퇴 ' + v + '%', vals: [SWEEP.ret[v].total], sub: revTxt(SWEEP.ret[v]), cur: base && P.r === v }));
    bars($('c-ret'), groups, [{ label: '30해 합계 비용', color: CS }], '30해 합계 비용 (AI 없을 때 = 100)', 200);
  }
  function notes() {
    const G = SWEEP.grid, X = SWEEP.mix, Pn = SWEEP.pen, R = SWEEP.ret;
    $('note-g').textContent = `계속 뽑기 0%: 대체율 30% ${G['30_0'].rev}해째 · 50% ${G['50_0'].rev}해째 · 70% ${G['70_0'].rev}해째 · 90% ${G['90_0'].rev}해째에 역전`;
    $('note-x').textContent = `30해 합계: 계속 뽑기 0% ${X['0_0'].total} → 가르침 더하면 ${X['0_50'].total} · 계속 뽑기 50% ${X['50_0'].total} → ${X['50_50'].total}`;
    $('note-p').textContent = `밀린 일을 손해로 안 치면(0) 30해 합계 ${Pn[0].total}, 손해 4면 ${Pn[4].total}`;
    $('note-r').textContent = `숙련자 수(30해 뒤, AI 없을 때): 은퇴 6% ${R[6].S}명(${R[6].S0}명) · 10% ${R[10].S}명(${R[10].S0}명) · 14% ${R[14].S}명(${R[14].S0}명)`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const H = sim.hist, t = sim.t, l = sim.last;
    const ratio = t ? Math.round((100 * H.cost[t - 1]) / H.cost0[t - 1]) : 100;
    let rev = '', revSub = '아직 비용이 AI 없을 때보다 크지 않아요';
    if (sim.revYear > 0) { rev = `${sim.revYear}해째`; revSub = sim.evenYear > 0 ? `아낀 돈은 ${sim.evenYear}해째에 다 사라졌어요` : '그 뒤로 해마다 비용이 더 들어요'; }
    else if (sim.done) revSub = '이 판에서는 30해 안에 역전되지 않았어요';
    const cards = [
      ['올해 비용 (AI 없을 때 = 100)', t ? String(ratio) : '', t ? (ratio < 100 ? `${100 - ratio}만큼 아낌` : ratio > 100 ? `${ratio - 100}만큼 더 듦` : 'AI 없을 때와 같음') : 'AI가 들어오기 직전'],
      ['비용이 역전된 해', rev, revSub],
      ['숙련자', `${l.S}명`, `AI 없을 때 ${H.S0[t]}명`],
      ['신입', `${l.J}명`, `AI 없을 때 ${H.J0[t]}명`],
      ['밀린 숙련 일', `${Math.round(l.B)}`, t ? `숙련자 임금 지수 ${(l.idx || 1).toFixed(2)}배` : '처음엔 밀린 일이 없어요'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${t}해 / ${sim.params.years}해`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawPop(); drawCost(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 120) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 140); }
  }
  function drawSweeps() { drawGrid(); drawMix(); drawPen(); drawRet(); notes(); }

  const h = L.harness({
    controls: ['s', 'b', 'e', 'r', 'pen'],
    format: { s: (v) => v + '%', b: (v) => v + '%', e: (v) => v + '%', r: (v) => v + '%', pen: (v) => String(v) },
    defaults: { s: 50, b: 0, e: 0, r: 10, pen: 2 },
    speedScale: 0.7,
    build() {
      sim = AJ.create(params());
      if (THUMB) { while (sim.t < 22) sim.step(); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done) return false; sim.step(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '업계',
  });
  seedGetter = h.seed;
  window.AiJobsApp = { params, sim: () => sim };
})();
