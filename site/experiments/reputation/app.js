(function () {
  'use strict';
  const RP = window.Reputation, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 첫 '어김의 물결' 한가운데(파문이 퍼지는 순간)에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_DEAL = '#2f6fed', C_COOP = '#0f9d76', C_BRK = '#e03131', C_COST = '#7c3aed', C_TEMPT = 'rgba(224,49,49,.14)';
  const NAMES = 'ABCDEFGHIJKLMNOPQRSTUVWX';
  const nm = (i) => `${NAMES[i] || i + 1}국`;
  // 집계(미리 계산): node tools/validate-reputation.js 출력의 SWEEP과 같아야 한다 (시드 8개, 300라운드, 51라운드부터 평균, 100라운드에 일부러 한 번 어김)
  const SWEEP = {"grid":{"0_10":{"deal":27,"coop":26,"brk":0.06,"rec":null},"1_10":{"deal":83,"coop":81,"brk":0.15,"rec":73},"3_10":{"deal":96,"coop":94,"brk":0.26,"rec":24},"5_10":{"deal":96,"coop":92,"brk":0.46,"rec":14},"10_10":{"deal":92,"coop":76,"brk":2.32,"rec":7},"20_10":{"deal":95,"coop":68,"brk":3.74,"rec":3},"0_50":{"deal":28,"coop":28,"brk":0.05,"rec":null},"1_50":{"deal":73,"coop":73,"brk":0.11,"rec":110},"3_50":{"deal":93,"coop":92,"brk":0.14,"rec":37},"5_50":{"deal":95,"coop":94,"brk":0.19,"rec":21},"10_50":{"deal":95,"coop":92,"brk":0.41,"rec":10},"20_50":{"deal":89,"coop":71,"brk":2.67,"rec":5},"0_90":{"deal":28,"coop":28,"brk":0.04,"rec":null},"1_90":{"deal":55,"coop":54,"brk":0.11,"rec":150},"3_90":{"deal":86,"coop":85,"brk":0.1,"rec":59},"5_90":{"deal":92,"coop":91,"brk":0.11,"rec":40},"10_90":{"deal":96,"coop":94,"brk":0.17,"rec":20},"20_90":{"deal":95,"coop":91,"brk":0.42,"rec":10}},"apology":{"0":{"deal":93,"coop":92,"brk":0.14,"rec":37},"25":{"deal":96,"coop":94,"brk":0.14,"rec":29},"50":{"deal":98,"coop":96,"brk":0.18,"rec":21},"75":{"deal":100,"coop":99,"brk":0.11,"rec":11},"100":{"deal":100,"coop":100,"brk":0.02,"rec":1}}};
  const FORGETS = [0, 1, 3, 5, 10, 20], SPREADS = [[10, '#94a3b8', '소문 느리게 (10%)'], [50, '#2f6fed', '소문 보통 (50%)'], [90, '#e8590c', '소문 빠르게 (90%)']];
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0, forced = null;
  const params = () => ({ seed: seedGetter(), tempt: Number($('tempt').value), spread: Number($('spread').value), forget: Number($('forget').value), apology: Number($('apology').value) });
  const speed = () => ($('speed') ? Number($('speed').value) : 5);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.RepState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB, forced: () => forced }; }

  // ---------- ② 협상 성사율 · 협력 수준 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-time'), items = [{ kind: 'line', color: C_DEAL, label: '협상 성사율' }, { kind: 'line', color: C_COOP, label: '둘 다 약속을 지킨 비율' }, { kind: 'box', color: C_BRK, label: '약속을 어긴 횟수 (아래 막대)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 12, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.rounds, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => Math.round(v * 100) + '%', xTicks: [0, 60, 120, 180, 240].filter((x) => x <= T), xLabel: '라운드 (협상 횟수)', yLabel: '비율 (%)' });
    const H = sim.hist, n = H.deal.length, bw = Math.max(1.5, pw / T * 0.8);
    ctx.fillStyle = C_BRK;
    for (let k = 0; k < n; k++) if (H.brk[k]) { const h = Math.min(ph * 0.3, H.brk[k] * ph * 0.06); ctx.fillRect(X(k + 1) - bw / 2, m.t + ph - h, bw, h); }
    if (forced && forced.t) { ctx.strokeStyle = '#111827'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(forced.t), m.t); ctx.lineTo(X(forced.t), m.t + ph); ctx.stroke(); ctx.setLineDash([]); }
    if (n) {
      L.line(ctx, H.coop.map((v, k) => [X(k + 1), Y(v)]), C_COOP, 2.2);
      L.line(ctx, H.deal.map((v, k) => [X(k + 1), Y(v)]), C_DEAL, 2.6);
    }
    L.drawLegendBelow(c, items);
  }
  // ③ "어기면 손해"라는 어림 vs 유혹의 범위 (재생 시점까지)
  function drawCost() {
    const cv = $('c-cost'), items = [{ kind: 'line', color: C_COST, label: '"어기면 이만큼 잃는다"는 어림' }, { kind: 'box', color: 'rgba(224,49,49,.28)', label: '어기고 싶은 마음의 범위' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 12, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.rounds, YM = 20, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (Math.min(YM, v) / YM) * ph;
    const G = sim.params.tempt / 100, ap = sim.params.apology / 100, lo = Math.max(0, G * 0.6 * 0.5 - 2 * ap), hi = Math.max(0, G * 1.4 * 1.5 - 2 * ap);
    ctx.fillStyle = C_TEMPT; ctx.fillRect(m.l, Y(hi), pw, Y(lo) - Y(hi));
    L.axes(c, { X, Y, yTicks: [0, 5, 10, 15, 20], xTicks: [0, 60, 120, 180, 240].filter((x) => x <= T), xLabel: '라운드 (협상 횟수)', yLabel: '거래 수 (회)' });
    const H = sim.hist.cost, n = H.length;
    const pts = [[X(0), Y(RP.C.COST0)]].concat(H.map((v, k) => [X(k + 1), Y(v)]));
    L.line(ctx, pts, C_COST, 2.6);
    const last = pts[pts.length - 1]; ctx.fillStyle = C_COST; ctx.beginPath(); ctx.arc(last[0], last[1], 4, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }

  // ---------- ④⑤ 집계: 잊는 속도별 (소문 속도 세 가지) ----------
  function drawGrid(id, key, yMax, yTicks, yLabel, fmt) {
    const cv = $(id), items = SPREADS.map(([, col, lab]) => ({ kind: 'line', color: col, label: lab }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const X = (k) => m.l + (k / (FORGETS.length - 1)) * pw, Y = (v) => m.t + ph - (Math.min(yMax, v) / yMax) * ph;
    L.axes(c, { X, Y, yTicks, yFmt: fmt, xTicks: FORGETS.map((_, k) => k), xFmt: (k) => FORGETS[k] + '%', xLabel: '잊는 속도 (라운드마다)', yLabel });
    const P = params();
    SPREADS.forEach(([s, col]) => {
      const pts = []; FORGETS.forEach((f, k) => { const v = SWEEP.grid[`${f}_${s}`][key]; if (v != null) pts.push([X(k), Y(v), f]); });
      L.line(ctx, pts.map((p) => [p[0], p[1]]), col, s === 50 ? 2.6 : 2);
      pts.forEach(([x, y, f]) => { const cur = P.spread === s && P.forget === f; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, cur ? 6 : 3.5, 0, 7); ctx.fill(); if (cur) { ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; } });
    });
    if (key === 'rec') { ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('0%: 다시 협상 못 함', X(0) + 6, m.t + ph - 8); }
    L.drawLegendBelow(c, items);
  }
  // ⑥ 집계: 사과·보상
  function drawApology() {
    const cv = $('c-apo'), items = [{ kind: 'box', color: '#7c3aed', label: '다시 협상하기까지 (라운드)' }, { kind: 'box', color: C_COOP, label: '둘 다 약속을 지킨 비율 (%)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 12, t: 30 }), { ctx, m, pw, ph } = c;
    const A = [0, 25, 50, 75, 100], gw = pw / A.length, Y = (v) => m.t + ph - (v / 100) * ph, P = params();
    L.axes(c, { X: (k) => m.l + (k + 0.5) * gw, Y, yTicks: [0, 25, 50, 75, 100], xTicks: A.map((_, k) => k), xFmt: (k) => `보상 ${A[k]}%`, yLabel: '라운드 · 비율' });
    A.forEach((a, k) => {
      const s = SWEEP.apology[a], x0 = m.l + k * gw, bw = Math.min(26, (gw - 14) / 2);
      if (P.apology === a && P.forget === 3 && P.spread === 50) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      [[s.rec, '#7c3aed'], [s.coop, C_COOP]].forEach(([v, col], j) => {
        const x = x0 + gw / 2 - bw - 2 + j * (bw + 4); ctx.fillStyle = col; ctx.fillRect(x, Y(v), bw, Y(0) - Y(v));
        ctx.font = '700 11px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + bw / 2, Y(v) - 4);
      });
    });
    L.drawLegendBelow(c, items);
  }
  function notes() {
    const g = SWEEP.grid, a = SWEEP.apology;
    $('note-co').textContent = `둘 다 지킨 비율 (소문 보통): 잊는 속도 0% ${g['0_50'].coop}% · 3% ${g['3_50'].coop}% · 20% ${g['20_50'].coop}%`;
    $('note-rc').textContent = `다시 협상하기까지 (잊는 속도 3%): 소문 느리게 ${g['3_10'].rec}라운드 · 보통 ${g['3_50'].rec}라운드 · 빠르게 ${g['3_90'].rec}라운드`;
    $('note-ap').textContent = `다시 협상하기까지: 보상 0% ${a[0].rec}라운드 · 50% ${a[50].rec}라운드 · 100% ${a[100].rec}라운드`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const H = sim.hist, n = H.deal.length, w = H.deal.slice(-10);
    const dealNow = n ? Math.round(w.reduce((a, b) => a + b, 0) / w.length * 100) + '%' : '';
    const who = new Set(sim.events.map((e) => e.i)).size, ev = sim.events.length;
    const rec = sim.recov.filter((r) => !r.forced), avg = rec.length ? Math.round(rec.reduce((a, r) => a + r.dur, 0) / rec.length) : null;
    const refusedNow = (() => { let c = 0; for (let i = 0; i < sim.n; i++) if (sim.refusers(i) > 0) c++; return c; })();
    let fv = '', fs = '버튼을 누르면 재 봐요';
    if (forced) {
      const r = sim.recov.find((x) => x.forced);
      if (r) { fv = `${r.dur}라운드`; fs = `${nm(forced.i)}이 어긴 뒤 아무도 거절하지 않게 될 때까지`; }
      else if (!forced.t) fs = `${nm(forced.i)}이 다음 협상에서 약속을 깨요`;
      else if (sim.reBroke) fs = `${nm(forced.i)}이 그 사이 또 어겨서 다시 재요`;
      else fs = sim.done ? '이 판 안에 다시 협상하지 못했어요' : `${nm(forced.i)}을 거절하는 나라 ${sim.refusers(forced.i)}곳`;
    }
    const cards = [
      ['지금 협상 성사율', dealNow, '최근 10라운드, 거절 없이 협상한 짝의 비율'],
      ['약속을 어긴 횟수', `${ev}회`, ev ? `어긴 나라 ${who}곳 · 지금 거절당하는 나라 ${refusedNow}곳` : '아직 아무도 안 어겼어요'],
      ['어긴 나라가 다시 협상하기까지', avg == null ? '' : `${avg}라운드`, avg == null ? '아직 회복한 나라가 없어요' : `지금까지 ${rec.length}번 회복한 것의 평균`],
      ['일부러 한 번 어기면', fv, fs],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${sim.t} / ${sim.params.rounds}라운드`;
    const fb = $('rp-break'); if (fb) fb.disabled = sim.done || !!(forced && !sim.recov.find((x) => x.forced) && !sim.reBroke && !sim.done);
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawTime(); drawCost(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 120) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 140); }
  }
  function drawSweeps() {
    drawGrid('c-co', 'coop', 100, [0, 25, 50, 75, 100], '둘 다 지킨 비율 (%)', (v) => v + '%');
    drawGrid('c-rc', 'rec', 160, [0, 40, 80, 120, 160], '다시 협상하기까지 (라운드)');
    drawApology(); notes();
  }

  const h = L.harness({
    controls: ['tempt', 'spread', 'forget', 'apology'],
    format: { tempt: (v) => v + '%', spread: (v) => v + '%', forget: (v) => v + '%', apology: (v) => v + '%' },
    defaults: { tempt: 150, spread: 50, forget: 3, apology: 0 },
    speedScale: 1,
    build() {
      sim = RP.create(params()); forced = null;
      if (THUMB) { while (sim.t < 25) sim.step(); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() {
      if (sim.done) return false;
      sim.step();
      if (forced && !forced.t) { const e = sim.events.find((x) => x.forced); if (e) forced.t = e.t; }
      lastStepAt = performance.now(); return true;
    },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '세계',
  });
  seedGetter = h.seed;
  const fb = $('rp-break');
  if (fb) fb.addEventListener('click', () => { if (!sim) return; sim.recov.forEach((r) => { r.forced = false; }); sim.events.forEach((e) => { e.forced = false; }); const i = sim.forceBreak(); if (i >= 0) { forced = { i, t: 0 }; sim.reBroke = false; renderStats(); drawCharts(); } });
  window.RepApp = { params, sim: () => sim };
})();
