(function () {
  'use strict';
  const AR = window.ArmsRace, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 탑이 과열선을 넘어 자란 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_A = '#2f6fed', C_B = '#e8590c', C_HOT = '#dc2626', C_CALM = '#16a34a', C_GRAY = '#64748b';
  const K = AR.C, YMAX = 200;
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0;
  let gridCache = null, gridKey = '', agreeCache = null, agreeKey = '';
  const params = () => ({ seed: seedGetter(), kA: Number($('kA').value), kB: Number($('kB').value), a: Number($('a').value), g: Number($('g').value), gap: Number($('gap').value), agree: $('agree').value });
  const speed = () => ($('speed') ? Number($('speed').value) : 4);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const r0 = (v) => Math.round(v);
  const AGREE_NAME = { none: '합의 없음', both: '둘 다 반응 절반', aonly: 'A만 반응 절반', acut: 'A만 군비 한 번 절반' };
  const AGREE_2 = { none: ['합의 없음', ''], both: ['둘 다', '반응 절반'], aonly: ['A만', '반응 절반'], acut: ['A만 군비', '한 번 절반'] };   // 휴대폰: 두 줄

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.ArmsState = { sim, lastStepAt, interval: 1 / (speed() * 0.7), isPaused, thumb: THUMB, hot: K.HOT, cap: K.CAP, nullclines }; }
  // 두 나라의 '균형선'(이 선 위에서는 그 나라의 군비가 그대로): A: x = (kA·y + g)/a, B: y = (kB·x + g)/a  (지금 쓰는 반응 계수로)
  function nullclines() { const P = sim.params; return { a: P.a, g: P.g, kA: sim.kA, kB: sim.kB }; }

  // ---------- ② 두 나라 군비의 시간 변화 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-time'), P = sim.params, th = sim.theory();
    const items = [{ kind: 'line', color: C_A, label: 'A의 군비' }, { kind: 'line', color: C_B, label: 'B의 군비' }, { kind: 'dash', color: C_HOT, label: '과열선 100' }];
    if (th.stable && P.g > 0) items.push({ kind: 'dash', color: C_CALM, label: '계산상 멈추는 수준' });
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (t) => m.l + (t / K.YEARS) * pw, Y = (v) => m.t + ph - (Math.min(YMAX, v) / YMAX) * ph;
    L.axes(c, { X, Y, yTicks: [0, 50, 100, 150, 200], xTicks: [0, 10, 20, 30, 40, 50, 60], xLabel: '시간 (년)', yLabel: '군비 (지수, 처음 10)' });
    ctx.strokeStyle = C_HOT; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(K.HOT)); ctx.lineTo(m.l + pw, Y(K.HOT)); ctx.stroke();
    if (th.stable && P.g > 0) {
      ctx.strokeStyle = C_CALM; [th.x, th.y].forEach((v) => { if (v < YMAX) { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(m.l + pw, Y(v)); ctx.stroke(); } });
    }
    ctx.setLineDash([]); ctx.lineWidth = 1;
    if (P.agree !== 'none' && sim.t >= K.AGREE_YEAR) {
      ctx.strokeStyle = C_GRAY; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(K.AGREE_YEAR), m.t); ctx.lineTo(X(K.AGREE_YEAR), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '600 11px ' + FONT; ctx.fillStyle = C_GRAY; ctx.textAlign = 'left'; L.label(ctx, '합의', X(K.AGREE_YEAR) + 4, m.t + 12);
    }
    L.line(ctx, sim.ys.map((v, t) => [X(t), Y(v)]), C_B, 2.6);
    L.line(ctx, sim.xs.map((v, t) => [X(t), Y(v)]), C_A, 2.6);
    const n = sim.xs.length - 1;
    [[sim.xs[n], C_A], [sim.ys[n], C_B]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(n), Y(v), 4.5, 0, 7); ctx.fill(); });
    if (sim.hot >= 0) {
      ctx.font = '700 12px ' + FONT; ctx.fillStyle = C_HOT; ctx.textAlign = X(sim.hot) > m.l + pw * 0.7 ? 'right' : 'left';
      L.label(ctx, `${sim.hot}년째 과열선을 넘었어요`, X(sim.hot) + (ctx.textAlign === 'right' ? -6 : 6), Y(K.HOT) - 8);
    }
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 위상 평면: 가로 A, 세로 B (재생 시점까지) ----------
  function drawPhase() {
    const cv = $('c-phase'), nc = nullclines();
    const items = [{ kind: 'line', color: C_A, label: 'A가 더 늘리지도 줄이지도 않는 선' }, { kind: 'line', color: C_B, label: 'B가 더 늘리지도 줄이지도 않는 선' }, { kind: 'line', color: '#1f2937', label: '지나온 길' }, { kind: 'box', color: 'rgba(220,38,38,.18)', label: '과열 구역 (100 이상)' }];
    const sp = L.belowSpace(cv, items), wide = (cv.clientWidth || 400);
    const c = L.chart(cv, Math.min(0.92, 0.78 + sp.extra / wide), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const side = Math.min(pw, ph), ox = m.l + (pw - side) / 2;
    const VM = 160, X = (v) => ox + (Math.min(VM, Math.max(0, v)) / VM) * side, Y = (v) => m.t + ph - (Math.min(VM, Math.max(0, v)) / VM) * side;
    // 과열 구역
    ctx.fillStyle = 'rgba(220,38,38,.10)';
    ctx.fillRect(X(K.HOT), Y(VM), X(VM) - X(K.HOT), Y(0) - Y(VM)); ctx.fillRect(X(0), Y(VM), X(K.HOT) - X(0), Y(K.HOT) - Y(VM));
    // 격자·눈금 (정사각형 영역)
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.lineWidth = 1; ctx.font = '12px ' + FONT;
    [0, 40, 80, 120, 160].forEach((v) => {
      ctx.beginPath(); ctx.moveTo(X(0), Y(v)); ctx.lineTo(X(VM), Y(v)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(v), Y(0)); ctx.lineTo(X(v), Y(VM)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(String(v), X(0) - 6, Y(v) + 4); ctx.textAlign = 'center'; ctx.fillText(String(v), X(v), Y(0) + 16);
    });
    L.axisNames(c, 'A의 군비', 'B의 군비');
    // 균형선(직선). 두 선이 오른쪽 위에서 만나면 거기서 멈추고, 벌어지면 폭주
    ctx.save(); ctx.beginPath(); ctx.rect(X(0), Y(VM), side, side); ctx.clip();
    const segA = [[(nc.kA * 0 + nc.g) / nc.a, 0], [(nc.kA * VM + nc.g) / nc.a, VM]];     // x = (kA y + g)/a
    const segB = [[0, (nc.kB * 0 + nc.g) / nc.a], [VM, (nc.kB * VM + nc.g) / nc.a]];     // y = (kB x + g)/a
    L.line(ctx, segA.map(([x, y]) => [X(x), Y(y)]), L.mix(C_A, 0.8), 2);
    L.line(ctx, segB.map(([x, y]) => [X(x), Y(y)]), L.mix(C_B, 0.8), 2);
    const th = sim.theory();
    if (th.stable && nc.g > 0 && th.x < VM && th.y < VM) { ctx.strokeStyle = C_CALM; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(th.x), Y(th.y), 7, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    // 지나온 길
    L.line(ctx, sim.xs.map((x, t) => [X(x), Y(sim.ys[t])]), '#1f2937', 2);
    ctx.restore();
    const n = sim.xs.length - 1, px = X(sim.xs[n]), py = Y(sim.ys[n]);
    ctx.fillStyle = sim.hot >= 0 ? C_HOT : '#1f2937'; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = C_GRAY; ctx.beginPath(); ctx.arc(X(sim.xs[0]), Y(sim.ys[0]), 3.5, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }

  // ---------- ④ 반응 지도 (집계: 지금의 비용 부담·불만으로 441판) ----------
  function drawMap() {
    const cv = $('c-map'), P = params(), N = 20, KM = 0.4;
    const key = [P.a, P.g, P.gap].join(',');
    if (key !== gridKey) { gridKey = key; gridCache = AR.grid({ a: P.a, g: P.g, gap: P.gap }, N, KM); }
    const items = [{ kind: 'box', color: C_HOT, label: '60년 안에 과열선을 넘음 (진할수록 빨리)' }, { kind: 'box', color: C_CALM, label: '안 넘음 (진할수록 높은 수준에서 멈춤)' }, { kind: 'line', color: '#111827', label: '계산상 경계: 두 반응의 곱 = 부담²' }];
    const sp = L.belowSpace(cv, items), wide = (cv.clientWidth || 400);
    const c = L.chart(cv, Math.min(0.95, 0.8 + sp.extra / wide), { b: sp.b, l: 44, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const side = Math.min(pw, ph), ox = m.l + (pw - side) / 2, cell = side / (N + 1);
    const X = (k) => ox + (k / KM) * (side - cell) + cell / 2, Y = (k) => m.t + ph - (k / KM) * (side - cell) - cell / 2;
    gridCache.forEach((g) => {
      let col;
      if (g.hot >= 0) col = `rgba(220,38,38,${(0.25 + 0.7 * (1 - Math.min(59, g.hot - 1) / 59)).toFixed(3)})`;
      else col = `rgba(22,163,74,${(0.12 + 0.6 * Math.min(1, g.total / 150)).toFixed(3)})`;
      ctx.fillStyle = col; ctx.fillRect(X(g.kA) - cell / 2, Y(g.kB) - cell / 2, cell + 0.5, cell + 0.5);
    });
    ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
    [0, 0.1, 0.2, 0.3, 0.4].forEach((v) => { ctx.textAlign = 'center'; ctx.fillText(Math.round(v * 100) + '%', X(v), Y(0) + cell / 2 + 16); ctx.textAlign = 'right'; ctx.fillText(Math.round(v * 100) + '%', X(0) - cell / 2 - 5, Y(v) + 4); });
    L.axisNames(c, 'A가 따라 늘리는 정도', 'B가 따라 늘리는 정도');
    // 경계 곡선 kA·kB = a²
    const pts = []; for (let i = 0; i <= 80; i++) { const kA = (P.a * P.a) / KM + (KM - (P.a * P.a) / KM) * i / 80; const kB = (P.a * P.a) / kA; if (kB <= KM) pts.push([X(kA), Y(kB)]); }
    L.line(ctx, pts, '#111827', 2.2);
    // 지금 설정
    const cx = X(Math.min(KM, P.kA)), cy = Y(Math.min(KM, P.kB));
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    ctx.font = '700 12px ' + FONT; ctx.fillStyle = '#111827'; ctx.textAlign = cx > ox + side * 0.7 ? 'right' : 'left'; L.label(ctx, '지금 설정', cx + (ctx.textAlign === 'right' ? -12 : 12), cy - 10);
    L.drawLegendBelow(c, items);
    const hot = gridCache.filter((g) => g.hot >= 0).length;
    $('note-m').textContent = `이 비용 부담·불만에서 441판 중 ${hot}판이 60년 안에 과열선을 넘었어요`;
  }

  // ---------- ⑤ 합의 방식별 (집계: 지금 설정으로 100판씩) ----------
  function agreeStats(P) {
    const key = [P.kA, P.kB, P.a, P.g, P.gap].join(',');
    if (key !== agreeKey) { agreeKey = key; agreeCache = ['none', 'acut', 'aonly', 'both'].map((ag) => Object.assign({ ag }, AR.many({ kA: P.kA, kB: P.kB, a: P.a, g: P.g, gap: P.gap, agree: ag }, 100))); }
    return agreeCache;
  }
  function drawAgree() {
    const cv = $('c-agree'), P = params(), S = agreeStats(P);
    const items = [{ kind: 'box', color: C_HOT, label: '60년 안에 과열선을 넘은 판 (100판 중)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, ((cv.clientWidth || 400) < 560 ? 0.8 : 0.56) + (sp.extra + 44) / (cv.clientWidth || 400), { b: sp.b + 44, l: 40, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / S.length, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X: (i) => m.l + (i + 0.5) * gw, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => Math.round(v * 100) + '%', xTicks: [], yLabel: '과열선을 넘은 판 (%)' });
    const narrow = (cv.clientWidth || 400) < 560;
    S.forEach((s, i) => {
      const x0 = m.l + i * gw, bw = Math.min(70, gw - 14), x = x0 + (gw - bw) / 2;
      if (s.ag === P.agree) { ctx.fillStyle = 'rgba(47,111,237,.08)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      ctx.fillStyle = s.ag === P.agree ? C_HOT : L.mix(C_HOT, 0.55); ctx.fillRect(x, Y(s.hotRate), bw, Y(0) - Y(s.hotRate));
      ctx.textAlign = 'center'; ctx.font = '700 13px ' + FONT;
      const inside = Y(s.hotRate) < m.t + 22;   // 막대가 꼭대기에 닿으면 숫자를 막대 안에 흰 글자로
      ctx.fillStyle = inside ? '#fff' : css('--text');
      ctx.fillText(Math.round(s.hotRate * 100) + '%', x0 + gw / 2, inside ? Y(s.hotRate) + 17 : Y(s.hotRate) - 6);
      ctx.fillStyle = css('--text'); ctx.font = (narrow ? '600 10.5px ' : '600 12px ') + FONT;
      let yy = Y(0) + 16;
      if (narrow) { ctx.fillText(AGREE_2[s.ag][0], x0 + gw / 2, yy); yy += 14; ctx.fillText(AGREE_2[s.ag][1], x0 + gw / 2, yy); }
      else ctx.fillText(AGREE_NAME[s.ag], x0 + gw / 2, yy);
      const sub = s.hotRate > 0.5 ? (s.medYear != null ? `보통 ${s.medYear}년째` : '') : (s.calmTotal != null ? `합계 약 ${r0(s.calmTotal)}에서 멈춤` : '');
      if (sub) { ctx.fillStyle = s.hotRate > 0.5 ? C_HOT : C_CALM; ctx.font = (narrow ? '600 10px ' : '600 11px ') + FONT;
        if (narrow && sub.indexOf('에서') > 0) { ctx.fillText(sub.split('에서')[0], x0 + gw / 2, yy + 15); ctx.fillText('에서 멈춤', x0 + gw / 2, yy + 28); }
        else ctx.fillText(sub, x0 + gw / 2, yy + 15); }
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 44 }) }), items);
    const f = (ag) => S.find((s) => s.ag === ag);
    $('note-a').textContent = `과열선을 넘은 판: 합의 없음 ${Math.round(f('none').hotRate * 100)}% · A만 군비 한 번 절반 ${Math.round(f('acut').hotRate * 100)}% · A만 반응 절반 ${Math.round(f('aonly').hotRate * 100)}% · 둘 다 반응 절반 ${Math.round(f('both').hotRate * 100)}%`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const th = sim.theory(), tot = sim.x + sim.y;
    let verdict, sub;
    if (sim.hot >= 0) { verdict = '폭주'; sub = `${sim.hot}년째 과열선 100을 넘었어요`; }
    else if (th.stable) { verdict = '멈추는 구조'; sub = sim.params.g > 0 ? `계산상 합계 약 ${r0(th.x + th.y)}에서 멈춰요` : '계산상 0 가까이 줄어요'; }
    else { verdict = '커지는 구조'; sub = `계산상 해마다 약 ${(th.grow * 100).toFixed(0)}%씩 서로 키워요`; }
    const cards = [
      ['두 나라 군비 합계', `${r0(tot)}`, `처음 ${r0(sim.xs[0] + sim.ys[0])}`],
      ['A의 군비', `${r0(sim.x)}`, `상대를 따라 늘리는 정도 ${Math.round(sim.kA * 100)}%`],
      ['B의 군비', `${r0(sim.y)}`, `상대를 따라 늘리는 정도 ${Math.round(sim.kB * 100)}%`],
      ['지금 구조', verdict, sub],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${sim.t}년째 / ${K.YEARS}년`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawTime(); drawPhase(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 120) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 140); }
  }
  function drawSweeps() { drawMap(); drawAgree(); }

  const pc = (v) => Math.round(Number(v) * 100) + '%';
  const h = L.harness({
    controls: ['kA', 'kB', 'a', 'g', 'gap', 'agree'],
    format: { kA: pc, kB: pc, a: pc, g: (v) => (Number(v) > 0 ? '+' : '') + v, gap: (v) => v },
    defaults: { kA: 0.24, kB: 0.24, a: 0.15, g: 1, gap: 0, agree: 'none' },
    speedScale: 0.7,
    build() {
      sim = AR.create(params());
      if (THUMB) { while (sim.step()); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() {
      if (sim.done) return false;
      sim.step(); lastStepAt = performance.now(); return true;
    },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '사건',
  });
  seedGetter = h.seed;
  window.ArmsApp = { params, sim: () => sim };
})();
