(function () {
  'use strict';
  const MG = window.Migration, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 큰길을 막은 뒤 흐름이 옆길로 번진 장면(48개월째)에서 멈춘다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0);   // 확인용: ?t=달
  const R = MG.ROUTES;
  // 길 색: 사고 위험이 낮은 길(파랑) → 높은 길(빨강)
  const COL = ['#1d4ed8', '#60a5fa', '#64748b', '#f59e0b', '#ea580c', '#be123c'];
  const C_RISK = '#c2410c', C_ARR = '#1d4ed8', C_ACC = '#be123c', C_BLOCK = 'rgba(220,38,38,.08)';
  const NAME = R.map((r) => r.ko);
  const pc = (v) => Math.round(v * 100) + '%';
  let sim = null, seedGetter = () => 1, lastStepAt = 0;
  let sw = { str: [], pres: [] };
  const params = () => ({
    seed: seedGetter(), pressure: Number($('pressure').value), block: Number($('block').value), strength: Number($('strength').value),
    gatecap: Number($('gatecap').value), riskw: Number($('riskw').value),
  });
  const speed = () => ($('speed') ? Number($('speed').value) : 3);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  function share() { window.MigState = { sim, lastStepAt, interval: 1 / (speed() * 0.6), isPaused, thumb: THUMB, colors: COL }; }

  // 최근 k달 평균 (재생이 지난 곳까지만)
  const recent = (arr, k) => { const n = arr.length; if (!n) return null; const a = arr.slice(Math.max(0, n - k)); return a.reduce((x, y) => x + y, 0) / a.length; };
  const M = () => sim.params.months;
  function blockBands(c, X) {   // 길을 막고 있던 구간: 옅은 붉은 띠
    const { ctx, m, ph } = c; let on = null;
    for (let t = 0; t <= sim.t; t++) {
      const b = t < sim.t ? sim.blockedAt[t] : false;
      if (b && on == null) on = t;
      if (!b && on != null) { ctx.fillStyle = C_BLOCK; ctx.fillRect(X(on), m.t, Math.max(2, X(t) - X(on)), ph); on = null; }
    }
  }
  const XT = [0, 12, 24, 36, 48, 60, 72];

  // ---------- ② 길마다 나선 사람 (쌓은 넓이, 재생 시점까지) ----------
  function drawFlow() {
    const cv = $('c-flow'), items = R.map((r, i) => ({ kind: 'box', color: COL[i], label: r.ko })).concat([{ kind: 'box', color: 'rgba(220,38,38,.25)', label: '길을 막은 때' }]);
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.55 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 42, r: 12, t: 30 }), { ctx, m, pw, ph } = c;
    const top = Math.max(100, Math.ceil((sim.params.pressure * 6 * 1.25 + 40) / 100) * 100);
    const X = (t) => m.l + (t / M()) * pw, Y = (v) => m.t + ph - (Math.min(top, v) / top) * ph;
    blockBands(c, X);
    const yt = []; for (let v = 0; v <= top; v += top / 4) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, xTicks: XT, xLabel: '달 (개월)', yLabel: '한 달에 길을 나선 사람 (명)' });
    const F = sim.flow, n = F.length;
    if (n) {
      const base = new Array(n).fill(0);
      for (let i = 0; i < R.length; i++) {
        ctx.beginPath();
        for (let t = 0; t < n; t++) { const x = X(t + 0.5), y = Y(base[t] + F[t][i]); t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        for (let t = n - 1; t >= 0; t--) ctx.lineTo(X(t + 0.5), Y(base[t]));
        ctx.closePath(); ctx.fillStyle = COL[i]; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
        for (let t = 0; t < n; t++) base[t] += F[t][i];
      }
    }
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 위험한 길로 간 사람의 비중 (재생 시점까지) ----------
  function drawRisky() {
    const cv = $('c-risky'), items = [{ kind: 'line', color: C_RISK, label: '위험한 길(사고 위험 10% 이상) 비중' }, { kind: 'box', color: 'rgba(220,38,38,.25)', label: '길을 막은 때' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.55 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 42, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (t) => m.l + (t / M()) * pw, Y = (v) => m.t + ph - (Math.min(0.5, v) / 0.5) * ph;
    blockBands(c, X);
    L.axes(c, { X, Y, yTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yFmt: (v) => String(Math.round(v * 100)), xTicks: XT, xLabel: '달 (개월)', yLabel: '위험한 길로 간 사람 (%)' });
    const H = sim.risky;
    if (H.length) {
      L.line(ctx, H.map((v, t) => [X(t + 0.5), Y(v)]), C_RISK, 2.5);
      const t = H.length - 1, v = recent(H, 3); ctx.fillStyle = C_RISK; ctx.beginPath(); ctx.arc(X(t + 0.5), Y(H[t]), 4, 0, 7); ctx.fill();
      ctx.font = '700 13px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'; ctx.textAlign = X(t) > m.l + pw * 0.8 ? 'right' : 'left';
      L.label(ctx, pc(v), X(t + 0.5) + (ctx.textAlign === 'right' ? -9 : 9), Y(H[t]) - 8);
    }
    L.drawLegendBelow(c, items);
  }

  // ---------- ④ 한 달 도착 수와 사고 (재생 시점까지) ----------
  function drawArr() {
    const cv = $('c-arr'), items = [{ kind: 'line', color: C_ARR, label: '도착한 사람' }, { kind: 'line', color: C_ACC, label: '도중에 사고를 겪은 사람 (오른쪽 눈금)' }, { kind: 'box', color: 'rgba(220,38,38,.25)', label: '길을 막은 때' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.55 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 42, r: 34, t: 30 }), { ctx, m, pw, ph } = c;
    const top = Math.max(100, Math.ceil((sim.params.pressure * 6 * 1.05 + 20) / 100) * 100), top2 = Math.max(10, Math.ceil(top / 10 / 10) * 10);
    const X = (t) => m.l + (t / M()) * pw, Y = (v) => m.t + ph - (Math.min(top, v) / top) * ph, Y2 = (v) => m.t + ph - (Math.min(top2, v) / top2) * ph;
    blockBands(c, X);
    const yt = []; for (let v = 0; v <= top; v += top / 4) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, xTicks: XT, xLabel: '달 (개월)', yLabel: '한 달에 (명)' });
    ctx.fillStyle = C_ACC; ctx.textAlign = 'left'; yt.forEach((v, k) => ctx.fillText(String(Math.round(top2 * k / 4)), m.l + pw + 5, Y(v) + 4));
    if (sim.arr.length) {
      L.line(ctx, sim.acc.map((v, t) => [X(t + 0.5), Y2(v)]), C_ACC, 2);
      L.line(ctx, sim.arr.map((v, t) => [X(t + 0.5), Y(v)]), C_ARR, 2.5);
    }
    L.drawLegendBelow(c, items);
  }

  // ---------- ⑤ 막는 세기별 (집계) ----------
  const STR = [0, 20, 40, 60, 80, 100], PRES = [20, 40, 60, 80, 100], RUNS = 8;
  function drawStr() {
    const cv = $('c-str'), P = params();
    const items = [{ kind: 'line', color: C_ARR, label: '도착한 사람' }, { kind: 'line', color: C_RISK, label: '위험한 길로 간 사람' }, { kind: 'line', color: C_ACC, label: '사고를 겪은 사람' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.55 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 42, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v / 100) * pw, Y = (v) => m.t + ph - (Math.min(400, v) / 400) * ph;
    L.axes(c, { X, Y, yTicks: [0, 100, 200, 300, 400], xTicks: STR, xLabel: '막는 세기 (%)', yLabel: '막기 전 = 100' });
    ctx.strokeStyle = css('--muted'); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(m.l, Y(100)); ctx.lineTo(m.l + pw, Y(100)); ctx.stroke(); ctx.setLineDash([]);
    [['arr', C_ARR], ['riskN', C_RISK], ['acc', C_ACC]].forEach(([k, col]) => {
      const pts = sw.str.map((d) => [X(d.x), Y(d[k])]); L.line(ctx, pts, col, 2.5);
      ctx.fillStyle = col; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill(); });
    });
    L.vline(c, X(P.strength), css('--rich'), '지금 설정', P.strength > 60 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  // ⑥ 출발지의 압력별: 막지 않을 때와 막을 때 (집계)
  function drawPres() {
    const cv = $('c-pres'), P = params();
    const items = [{ kind: 'line', color: C_ARR, label: '도착 (막지 않음)' }, { kind: 'dash', color: C_ARR, label: '도착 (길을 막음)' }, { kind: 'line', color: C_RISK, label: '위험한 길 비중 (막지 않음, 오른쪽 눈금)' }, { kind: 'dash', color: C_RISK, label: '위험한 길 비중 (길을 막음)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.55 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 42, r: 34, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + ((v - 20) / 80) * pw, Y = (v) => m.t + ph - (Math.min(600, v) / 600) * ph, Y2 = (v) => m.t + ph - (Math.min(0.4, v) / 0.4) * ph;
    L.axes(c, { X, Y, yTicks: [0, 150, 300, 450, 600], xTicks: PRES, xLabel: '출발지의 압력', yLabel: '한 달 도착 (명)' });
    ctx.fillStyle = C_RISK; ctx.textAlign = 'left'; [0, 0.1, 0.2, 0.3, 0.4].forEach((v) => ctx.fillText(Math.round(v * 100) + '%', m.l + pw + 4, Y2(v) + 4));
    const ser = (key, Yf, col, dash) => {
      const pts = sw.pres.map((d) => [X(d.x), Yf(d[key])]); if (dash) ctx.setLineDash([6, 4]); L.line(ctx, pts, col, 2.5); ctx.setLineDash([]);
      ctx.fillStyle = col; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill(); });
    };
    ser('arr0', Y, C_ARR); ser('arr1', Y, C_ARR, true); ser('risk0', Y2, C_RISK); ser('risk1', Y2, C_RISK, true);
    L.vline(c, X(Math.max(20, P.pressure)), css('--rich'), '지금 설정', P.pressure > 60 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  function after() {
    const P = params(); sw = { str: [], pres: [] }; drawStr(); drawPres();
    $('note-s').textContent = '계산 중…'; $('note-p').textContent = '계산 중…';
    const base = Object.assign({}, P, { seed: 1 });
    const jobs = STR.map((x) => () => {
      const o = MG.sweep(Object.assign({}, base, { strength: x }), RUNS), a = o.pre, b = o.post;
      sw.str.push({ x, arr: 100 * b.arr / a.arr, acc: 100 * b.acc / Math.max(0.01, a.acc), riskN: 100 * (b.risky * b.tries) / Math.max(0.01, a.risky * a.tries), raw: o });
    }).concat(PRES.map((x) => () => {
      const o0 = MG.sweep(Object.assign({}, base, { pressure: x, strength: 0 }), RUNS), o1 = MG.sweep(Object.assign({}, base, { pressure: x }), RUNS);
      sw.pres.push({ x, arr0: o0.post.arr, arr1: o1.post.arr, risk0: o0.post.risky, risk1: o1.post.risky });
    }));
    L.jobs(jobs, () => { drawStr(); drawPres(); }, () => {
      const s0 = sw.str[0].raw.pre, cur = MG.sweep(base, RUNS).post;
      $('note-s').textContent = `지금 설정 ${RUNS}판 평균: 막기 전 한 달 도착 ${Math.round(s0.arr)}명 · 위험한 길 ${pc(s0.risky)} → 막은 뒤 도착 ${Math.round(cur.arr)}명 · 위험한 길 ${pc(cur.risky)}`;
      const lo = sw.pres[1], hi = sw.pres[3];
      $('note-p').textContent = `막지 않을 때 압력 ${lo.x} → 도착 ${Math.round(lo.arr0)}명 · 위험한 길 ${pc(lo.risk0)}, 압력 ${hi.x} → ${Math.round(hi.arr0)}명 · ${pc(hi.risk0)}`;
    });
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const t = sim.t, blockAt = sim.blockLog.length ? sim.blockLog[0].t : -1;
    const preN = blockAt > 0 ? Math.min(12, blockAt) : 0;
    const pre = preN >= 3 ? sim.avg(blockAt - preN, blockAt) : null;
    const rk = t >= 3 ? recent(sim.risky, 3) : null, ar = t >= 3 ? recent(sim.arr, 3) : null, ac = t >= 3 ? recent(sim.acc, 3) : null;
    const costSum = sim.cost.reduce((x, y) => x + y, 0), backSum = sim.back.reduce((x, y) => x + y, 0);
    const blkName = NAME[sim.params.block];
    const after = pre && sim.blocked && t - blockAt >= 3;
    const cards = [
      ['위험한 길로 가는 사람', rk == null ? '' : pc(rk), after ? `최근 3달 평균 · 막기 전 ${pc(pre.risky)}` : '최근 3달 평균 · 사고 위험 10% 이상인 길'],
      ['한 달에 도착한 사람', ar == null ? '' : `${Math.round(ar)}명`, after ? `최근 3달 평균 · 막기 전 ${Math.round(pre.arr)}명` : '최근 3달 평균'],
      ['도중에 사고를 겪은 사람', ac == null ? '' : `${ac.toFixed(1)}명`, after ? `한 달 평균(최근 3달) · 막기 전 ${pre.acc.toFixed(1)}명` : '한 달 평균(최근 3달)'],
      ['쌓인 통제 비용', `${Math.round(costSum)}점`, sim.blocked ? `${blkName} 막는 중 · 되돌려 보낸 사람 ${backSum}명` : (blockAt >= 0 ? `되돌려 보낸 사람 ${backSum}명` : `${sim.params.blockAt}개월째에 ${blkName}을 막아요`)],
    ];
    $('stats').classList.toggle('live', !sim.done);
    $('stats').innerHTML = cards.map(([k, v, s], i) => `<div class="stat"><div class="k"${i === 0 ? ' style="color:#c2410c"' : ''}>${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${t} / ${M()}개월`;
    const tb = $('toggle'); if (tb) tb.textContent = sim.blocked ? '막은 길 풀기' : `${blkName} 막기`;
  }

  function draw() { share(); renderStats(); drawFlow(); drawRisky(); drawArr(); }

  const h = L.harness({
    controls: ['pressure', 'block', 'strength', 'gatecap', 'riskw'],
    format: { pressure: (v) => String(v), block: () => '', strength: (v) => v + '%', gatecap: (v) => v + '%', riskw: (v) => v + '%' },
    defaults: { pressure: 60, block: 1, strength: 80, gatecap: 100, riskw: 100 },
    build() {
      sim = MG.create(params());
      if (THUMB) { for (let k = 0; k < 48; k++) sim.step(); } else if (JUMP) { for (let k = 0; k < JUMP && sim.step(); k++); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB && !JUMP, speedScale: 0.6,
    advance() { const ok = sim.step(); lastStepAt = performance.now(); return ok; },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawStr(); drawPres(); }, seedLabel: '땅',
  });
  seedGetter = h.seed;
  const tb = $('toggle');
  if (tb) tb.addEventListener('click', () => { if (!sim || sim.done) return; sim.setBlock(!sim.blocked); draw(); });
  window.MigApp = { params, sim: () => sim };
})();
