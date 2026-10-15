(function () {
  'use strict';
  const CW = window.CosmicWeb, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 거미줄이 또렷해진 순간에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C = CW.C, C_VOID = '#2f6fed', C_BIG = '#d97706', C_TH = '#94a3b8', C_RMS = '#7c3aed';
  // 집계(미리 계산): node tools/validate-cosmicweb.js 출력과 같아야 한다 (기본 설정, 시드 3개 평균)
  const SWEEP = {"amp":{"1":{"void":16,"big":8,"clumps":30,"reveal":9.5,"revealN":3},"2":{"void":53,"big":17,"clumps":24,"reveal":8.2,"revealN":3},"4":{"void":76,"big":30,"clumps":15,"reveal":7,"revealN":3},"0.5":{"void":0,"big":4,"clumps":24,"reveal":null,"revealN":0}},"grain":{"big":{"void":68,"big":34,"clumps":11,"reveal":7.7,"revealN":3},"mix":{"void":53,"big":17,"clumps":24,"reveal":8.2,"revealN":3},"small":{"void":20,"big":5,"clumps":58,"reveal":9.3,"revealN":3}},"expand":{"0":{"void":52,"big":48,"clumps":2,"reveal":4.8,"revealN":3},"50":{"void":83,"big":63,"clumps":7,"reveal":6.4,"revealN":3},"100":{"void":53,"big":17,"clumps":24,"reveal":8.2,"revealN":3},"150":{"void":2,"big":6,"clumps":30,"reveal":null,"revealN":0},"200":{"void":0,"big":1,"clumps":9,"reveal":null,"revealN":0}},"grow":{"0":{"th":1,"sim":1.028},"100":{"th":0.618,"sim":0.635},"200":{"th":0.414,"sim":0.428}}};
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0, reveal = null, hist0 = null;
  const params = () => ({ seed: seedGetter(), amp: Number($('amp').value) / 10, grain: $('grain').value, expand: Number($('expand').value) });
  const speed = () => ($('speed') ? Number($('speed').value) : 20);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const HB = 24, HLO = -2, HHI = 2;   // 밀도 분포: log10(밀도) −2 ~ 2를 24칸으로

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.CosmicState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB }; }
  const T_END = () => sim.params.steps * C.DT;
  const fmtT = (v) => (Math.round(v * 10) / 10).toFixed(1);

  // ---------- ② 빈 공간 · 가장 큰 덩어리 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-time'), items = [{ kind: 'line', color: C_VOID, label: '빈 공간 비율' }, { kind: 'line', color: C_BIG, label: '가장 큰 덩어리에 든 먼지' }, { kind: 'dash', color: '#15803d', label: '거미줄이 드러난 때' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const TE = T_END(), X = (t) => m.l + (t / TE) * pw, Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [0, 2, 4, 6, 8], xLabel: '시간 (모델 단위)', yLabel: '비율 (%)' });
    if (reveal != null) { ctx.strokeStyle = '#15803d'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(reveal), m.t); ctx.lineTo(X(reveal), m.t + ph); ctx.stroke(); ctx.setLineDash([]); }
    const H = sim.hist, tt = H.t.map((t) => t * C.DT);
    L.line(ctx, H.big.map((v, k) => [X(tt[k]), Y(v * 100)]), C_BIG, 2.4);
    L.line(ctx, H.void.map((v, k) => [X(tt[k]), Y(v * 100)]), C_VOID, 2.6);
    const n = H.t.length - 1;
    [[H.void[n], C_VOID], [H.big[n], C_BIG]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(tt[n]), Y(v * 100), 4, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, items);
  }
  // ③ 울퉁불퉁한 정도 (로그 눈금, 재생 시점까지) + 작은 요철일 때의 이론 직선
  function drawGrow() {
    const cv = $('c-grow'), items = [{ kind: 'line', color: C_RMS, label: '시뮬레이션' }, { kind: 'dash', color: C_TH, label: '작을 때의 이론 (지수로 자람)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 46, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const TE = T_END(), LO = -3, HI = 2, X = (t) => m.l + (t / TE) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(1e-3, v)) - LO) / (HI - LO)) * ph;
    const fmt = (v) => (v >= 1 ? String(v) : v === 0.1 ? '0.1' : v === 0.01 ? '0.01' : '0.001');
    L.axes(c, { X, Y, yTicks: [0.001, 0.01, 0.1, 1, 10, 100], yFmt: fmt, xTicks: [0, 2, 4, 6, 8], xLabel: '시간 (모델 단위)', yLabel: '울퉁불퉁한 정도 (밀도 표준편차, 로그)' });
    const H = sim.hist, tt = H.t.map((t) => t * C.DT), n = H.t.length - 1, r0 = H.rms[0];
    // 이론선: 재생이 지난 시점까지만
    const th = []; for (let k = 0; k <= 40; k++) { const t = (k / 40) * tt[n]; const v = r0 * Math.exp(sim.sLin * t); if (v > 150) break; th.push([X(t), Y(v)]); }
    ctx.setLineDash([5, 4]); L.line(ctx, th, C_TH, 2); ctx.setLineDash([]);
    L.line(ctx, H.rms.map((v, k) => [X(tt[k]), Y(v)]), C_RMS, 2.6);
    ctx.fillStyle = C_RMS; ctx.beginPath(); ctx.arc(X(tt[n]), Y(H.rms[n]), 4, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }
  // ④ 칸 밀도 분포 (지금 vs 처음)
  function drawHist() {
    const cv = $('c-hist'), items = [{ kind: 'box', color: '#0ea5a5', label: '지금' }, { kind: 'line', color: '#64748b', label: '처음' }, { kind: 'dash', color: C_VOID, label: '빈 공간 기준 (평균의 0.2배)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const h = sim.densityHist(HB, HLO, HHI), YM = 50, bw = pw / HB, X = (lv) => m.l + ((lv - HLO) / (HHI - HLO)) * pw, Y = (v) => m.t + ph - (Math.min(YM, v * 100) / YM) * ph;
    L.axes(c, { X, Y, yTicks: [0, 10, 20, 30, 40, 50], yFmt: (v) => (v === 50 ? '50+' : String(v)), xTicks: [-2, -1, 0, 1, 2], xFmt: (v) => ['0.01', '0.1', '1', '10', '100'][v + 2], xLabel: '덩이 밀도 (평균 = 1)', yLabel: '덩이 비율 (%)' });
    for (let k = 0; k < HB; k++) { const x = m.l + k * bw; ctx.fillStyle = '#0ea5a5'; ctx.fillRect(x + 1, Y(h[k]), bw - 2, Y(0) - Y(h[k])); }
    if (hist0) { const pts = []; for (let k = 0; k < HB; k++) { const x = m.l + k * bw; pts.push([x, Y(hist0[k])], [x + bw, Y(hist0[k])]); } L.line(ctx, pts, '#64748b', 2); }
    const xv = X(Math.log10(C.VOID)); ctx.strokeStyle = C_VOID; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(xv, m.t); ctx.lineTo(xv, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    L.drawLegendBelow(c, items);
  }

  // ---------- ⑤⑥⑦ 집계 막대 ----------
  function bars(cv, groups, series, yLabel) {
    const items = series.map((s) => ({ kind: 'box', color: s.color, label: s.label }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 38, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / groups.length, Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [], yLabel });
    const narrow = gw < 70;
    groups.forEach((g, i) => {
      const x0 = m.l + i * gw;
      if (g.cur) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      const bw = Math.min(30, (gw - 14) / g.vals.length);
      const start = x0 + (gw - bw * g.vals.length - 3 * (g.vals.length - 1)) / 2;
      g.vals.forEach((v, k) => {
        const x = start + k * (bw + 3); ctx.fillStyle = series[k].color; ctx.fillRect(x, Y(v), bw, Y(0) - Y(v));
        ctx.font = '700 ' + (narrow ? 10.5 : 11.5) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + bw / 2, Y(v) - 4);
      });
      ctx.font = (g.cur ? '700 ' : '600 ') + (narrow ? 11 : 12) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(g.name, x0 + gw / 2, m.t + ph + 16);
      ctx.font = (narrow ? 10 : 11) + 'px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(g.sub, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);
  }
  const SER = [{ label: '빈 공간 (%)', color: C_VOID }, { label: '가장 큰 덩어리 (%)', color: C_BIG }];
  const sub = (s) => `덩어리 ${s.clumps}개`;
  function drawAmp() {
    if (!SWEEP.amp) return;
    const P = params(), base = P.grain === 'mix' && P.expand === 100;
    const groups = [0.5, 1, 2, 4].map((a) => { const s = SWEEP.amp[a]; return { name: `요철 ${a}%`, vals: [s.void, s.big], sub: sub(s), cur: base && P.amp === a }; });
    bars($('c-amp'), groups, SER, '비율 (%)');
  }
  const GNAME = { big: '큰 물결', mix: '섞임', small: '잔물결' };
  function drawGrain() {
    if (!SWEEP.grain) return;
    const P = params(), base = P.amp === 2 && P.expand === 100;
    const groups = ['big', 'mix', 'small'].map((g) => { const s = SWEEP.grain[g]; return { name: GNAME[g], vals: [s.void, s.big], sub: sub(s), cur: base && P.grain === g }; });
    bars($('c-grain'), groups, SER, '비율 (%)');
  }
  function drawExpand() {
    if (!SWEEP.expand) return;
    const P = params(), base = P.amp === 2 && P.grain === 'mix';
    const groups = [0, 50, 100, 150, 200].map((e) => { const s = SWEEP.expand[e]; return { name: `${e}%`, vals: [s.void, s.big], sub: sub(s), cur: base && P.expand === e }; });
    bars($('c-expand'), groups, SER, '비율 (%)');
  }
  const rv = (s) => (s.reveal == null ? '안 드러남' : `t = ${s.reveal}`);
  function notes() {
    if (!SWEEP.amp) return;
    const A = SWEEP.amp, G = SWEEP.grain, E = SWEEP.expand;
    $('note-a').textContent = `거미줄이 드러난 때: 요철 0.5% ${rv(A[0.5])} · 1% ${rv(A[1])} · 2% ${rv(A[2])} · 4% ${rv(A[4])}`;
    $('note-g').textContent = `거미줄이 드러난 때: 큰 물결 ${rv(G.big)} · 섞임 ${rv(G.mix)} · 잔물결 ${rv(G.small)}`;
    $('note-e').textContent = `거미줄이 드러난 때: 팽창 0% ${rv(E[0])} · 50% ${rv(E[50])} · 100% ${rv(E[100])} · 150% ${rv(E[150])} · 200% ${rv(E[200])}`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const m = sim.last, H = sim.hist, r0 = H.rms[0];
    const grow = m.rms / r0;
    const cards = [
      ['빈 공간 비율', `${Math.round(m.void * 100)}%`, '평균의 0.2배보다 성긴 곳', false],
      ['가장 큰 덩어리', `${Math.round(m.big * 100)}%`, `덩어리 ${m.clumps}개 · 전체 먼지 중 비율`, false],
      ['처음보다 울퉁불퉁해진 정도', `${grow < 10 ? grow.toFixed(1) : Math.round(grow)}배`, '밀도가 고르지 않은 정도(표준편차) 기준', false],
      ['거미줄이 드러난 때', reveal == null ? '' : `t = ${fmtT(reveal)}`, reveal == null ? (sim.done ? '이 판에서는 드러나지 않았어요' : '빈 공간이 10%를 넘으면 표시') : '빈 공간이 처음 10%를 넘은 때', false],
    ];
    $('stats').innerHTML = cards.map(([k, v, s, dim]) => `<div class="stat"${dim ? ' style="opacity:.55"' : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `t = ${fmtT(sim.t * C.DT)} / ${fmtT(T_END())}`;
  }
  function track() { if (reveal == null && sim.last.void >= 0.1) reveal = sim.last.t * C.DT; }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawTime(); drawGrow(); drawHist(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { drawAmp(); drawGrain(); drawExpand(); notes(); }
  function stepOnce() { const ok = sim.step(); if (sim.t % C.SAMPLE === 0) track(); return ok; }

  const h = L.harness({
    controls: ['amp', 'grain', 'expand'],
    format: { amp: (v) => (v / 10) + '%', expand: (v) => v + '%', grain: () => '' },
    defaults: { amp: 20, grain: 'mix', expand: 100 },
    speedScale: 1,
    build() {
      sim = CW.create(params()); reveal = null; hist0 = sim.densityHist(HB, HLO, HHI); track();
      if (THUMB) { while (sim.t < 222 && stepOnce()); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() {
      if (sim.done) return false;
      // 거의 고른 동안(울퉁불퉁한 정도 0.3 미만)은 한 번에 세 걸음씩 빨리 감는다 (화면 속도만 바뀌고 결과는 같다)
      const k = sim.last.rms < 0.3 ? 3 : 1;
      for (let i = 0; i < k && !sim.done; i++) stepOnce();
      lastStepAt = performance.now(); return true;
    },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '우주',
  });
  seedGetter = h.seed;
  window.CosmicApp = { params, sim: () => sim };
})();
