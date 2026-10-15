(function () {
  'use strict';
  const SN = window.Sanctions, L = window.Lab;
  const { css, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 제재 18달째(참여국 파랑, 새는 점선이 다 자란 모습)에서 멈춘다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0);   // 확인용: ?t=달 (그 시점으로 바로 가서 멈춤)
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_DMG = '#ea580c', C_LEAK = '#7c3aed', C_PART = '#2f6fed', C_COH = '#b45309', C_OK = '#15803d', C_BASE = '#64748b';
  const pc = (v) => Math.round(v * 100) + '%';
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  let sim = null, seedGetter = () => 1, lastStepAt = 0, rows = [], th = [];
  const params = () => ({
    seed: seedGetter(), p: Number($('p').value) / 100, leak: Number($('leak').value) / 100,
    rally: Number($('rally').value) / 100, hard: Number($('hard').value) / 100,
  });
  const speed = () => ($('speed') ? Number($('speed').value) : 4) * 0.7;
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  function share() { window.SanctionsState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB }; }

  const T = () => sim.T, S0 = () => sim.params.start;
  function timeChart(cv, items, yLabel) {
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.5 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40 });
    const { m, pw, ph } = c;
    c.X = (t) => m.l + (t / T()) * pw; c.Y = (v) => m.t + ph - (v / 100) * ph;
    const ticks = []; for (let k = 0; k <= sim.params.months; k += 12) ticks.push(S0() + k);
    L.axes(c, { X: c.X, Y: c.Y, yTicks: [0, 25, 50, 75, 100], xTicks: ticks, xFmt: (v) => String(v - S0()), xLabel: '제재 뒤 달 수', yLabel });
    c.ctx.fillStyle = 'rgba(100,116,139,.10)'; c.ctx.fillRect(m.l, m.t, c.X(S0()) - m.l, ph);   // 제재 전
    return c;
  }
  function endLabel(c, x, y, text, color) {
    const { ctx, m, pw } = c; const right = x > m.l + pw * 0.82;
    ctx.font = '700 13px ' + FONT; ctx.fillStyle = color; ctx.textAlign = right ? 'right' : 'left';
    L.label(ctx, text, x + (right ? -9 : 9), y + 5); ctx.font = '12px ' + FONT;
  }

  // ---------- ② 피해와 새는 비율 (재생 시점까지) ----------
  function drawTrade() {
    const cv = $('c-trade');
    const items = [{ kind: 'line', color: C_DMG, label: '제재받는 나라의 경제 피해' }, { kind: 'line', color: C_LEAK, label: '새는 비율 (끊긴 무역 중 제3국을 거쳐 들어온 몫)' }, { kind: 'dash', color: C_PART, label: '참여국이 잃은 수출' }];
    const c = timeChart(cv, items, '원래 무역 대비 (%)'), { ctx } = c, t = sim.t;
    const ser = (a) => a.slice(0, t + 1).map((v, i) => [c.X(i), c.Y(v * 100)]);
    ctx.setLineDash([6, 4]); L.line(ctx, ser(sim.partLoss), C_PART, 2.2); ctx.setLineDash([]);
    L.line(ctx, ser(sim.leakRate), C_LEAK, 2.5); L.line(ctx, ser(sim.D), C_DMG, 3);
    if (t >= S0()) {
      const pts = [[sim.D[t], C_DMG], [sim.leakRate[t], C_LEAK]];
      pts.forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.X(t), c.Y(v * 100), 4, 0, 7); ctx.fill(); });
      const a = sim.D[t], b = sim.leakRate[t], close = Math.abs(c.Y(a * 100) - c.Y(b * 100)) < 16, up = a >= b;
      endLabel(c, c.X(t), c.Y(a * 100) + (close ? (up ? -8 : 8) : 0), pc(a), C_DMG);
      endLabel(c, c.X(t), c.Y(b * 100) + (close ? (up ? 8 : -8) : 0), pc(b), C_LEAK);
    }
    ctx.font = '12px ' + FONT; L.drawLegendBelow(c, items);
  }

  // ---------- ③ 결속 지수 (재생 시점까지) ----------
  function drawCoh() {
    const cv = $('c-coh');
    const items = [{ kind: 'line', color: C_COH, label: '결속 지수 (지도부 지지)' }, { kind: 'dash', color: C_BASE, label: '평소 (50)' }, { kind: 'box', color: 'rgba(220,38,38,.22)', label: '압력이 통했다고 보는 선 (30 아래)' }];
    const c = timeChart(cv, items, '결속 지수 (0~100)'), { ctx, m, pw } = c, t = sim.t;
    ctx.fillStyle = 'rgba(220,38,38,.08)'; ctx.fillRect(m.l, c.Y(30), pw, c.Y(0) - c.Y(30));
    ctx.setLineDash([5, 4]); L.line(ctx, [[m.l, c.Y(50)], [m.l + pw, c.Y(50)]], C_BASE, 1.5); ctx.setLineDash([]);
    L.line(ctx, sim.C.slice(0, t + 1).map((v, i) => [c.X(i), c.Y(v)]), C_COH, 3);
    ctx.fillStyle = C_COH; ctx.beginPath(); ctx.arc(c.X(t), c.Y(sim.C[t]), 4.5, 0, 7); ctx.fill();
    endLabel(c, c.X(t), c.Y(sim.C[t]) - 10, String(Math.round(sim.C[t])), C_COH);
    if (sim.hit >= 0 && sim.hit <= t) {
      ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(c.X(sim.hit), c.Y(sim.C[sim.hit]), 5, 0, 7); ctx.fill();
      ctx.font = '600 12px ' + FONT; ctx.textAlign = c.X(sim.hit) > m.l + pw * 0.6 ? 'right' : 'left';
      L.label(ctx, `${sim.hit - S0()}달째 30 아래로`, c.X(sim.hit) + (ctx.textAlign === 'right' ? -8 : 8), c.Y(sim.C[sim.hit]) + 20);
    }
    ctx.font = '12px ' + FONT; L.drawLegendBelow(c, items);
  }

  // ---------- ④ 참여율별 100판 (집계) ----------
  const PS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  function drawSweep() {
    const cv = $('c-sweep'), P = params();
    const items = [{ kind: 'line', color: C_OK, label: '압력이 통한 판 (%)' }, { kind: 'line', color: C_DMG, label: '제재받는 나라의 평균 피해' }, { kind: 'dash', color: C_PART, label: '참여국이 잃은 수출' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.5 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v / 100) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => String(Math.round(v * 100)), xTicks: [0, 20, 40, 60, 80, 100], xLabel: '제재 참여율 (%)', yLabel: '100판 평균 (%)' });
    [['partLoss', C_PART, true], ['damage', C_DMG], ['success', C_OK]].forEach(([k, col, dash]) => {
      const pts = rows.map((d) => [X(d.x), Y(d[k])]);
      if (dash) ctx.setLineDash([6, 4]); L.line(ctx, pts, col, 2.5); ctx.setLineDash([]);
      ctx.fillStyle = col; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill(); });
    });
    L.vline(c, X(P.p * 100), css('--rich'), '지금 설정', P.p > 0.6 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }

  // ---------- ⑤ 새는 정도별 참여율 문턱 (집계) ----------
  const LEAKS = [0, 20, 40, 50, 60, 80, 100];
  function drawThresh() {
    const cv = $('c-thresh'), P = params();
    const c = L.chart(cv, 0.52, { b: 40, l: 40 }), { ctx, m, pw, ph } = c;
    const Y = (v) => m.t + ph - (v / 100) * ph, bw = pw / LEAKS.length;
    L.axes(c, { X: (i) => m.l + bw * (i + 0.5), Y, yTicks: [0, 25, 50, 75, 100], xTicks: LEAKS.map((_, i) => i), xFmt: (i) => LEAKS[i] + '%', xLabel: '새는 정도', yLabel: '참여율 문턱 (%)' });
    th.forEach((d, i) => {
      const x = m.l + bw * i + bw * 0.18, w = bw * 0.64, cur = LEAKS.reduce((bi, v, j) => (Math.abs(v - P.leak * 100) < Math.abs(LEAKS[bi] - P.leak * 100) ? j : bi), 0) === LEAKS.indexOf(d.x);
      ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center';
      if (d.v == null) { ctx.fillStyle = C_BASE; ctx.fillText('없음', x + w / 2, Y(0) - 8); return; }
      ctx.fillStyle = cur ? C_DMG : 'rgba(234,88,12,.45)'; roundRect(ctx, x, Y(d.v * 100), w, Y(0) - Y(d.v * 100), 4); ctx.fill();
      ctx.fillStyle = cur ? C_DMG : css('--text'); ctx.fillText(pc(d.v), x + w / 2, Y(d.v * 100) - 6);
    });
    ctx.font = '12px ' + FONT;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const t = sim.t, P = sim.params, started = t >= P.start, k = sim.part.filter(Boolean).length;
    const el = t - P.start;
    const when = $('when'); if (when) when.textContent = started ? `제재 ${el}달째` : '제재 전';
    const cards = [
      ['제재받는 나라의 경제 피해', started ? pc(sim.D[t]) : '', started ? '원래 무역 = 100%' : '제재 전'],
      ['새는 비율', started ? pc(sim.leakRate[t]) : '', '끊긴 무역 중 제3국을 거쳐 들어온 몫'],
      ['참여국이 잃은 수출', pc(sim.lost), `참여국 ${k}곳 / 다른 나라 ${P.n - 1}곳`],
      ['결속 지수 (지도부 지지)', String(Math.round(sim.C[t])), sim.hit >= 0 && sim.hit <= t ? `${sim.hit - P.start}달째 30 아래로` : '평소 50 · 30 아래면 압력이 통함'],
    ];
    $('stats').classList.toggle('live', !sim.done);
    $('stats').innerHTML = cards.map(([kk, v, s], i) => `<div class="stat"><div class="k"${i === 0 ? ` style="color:${C_DMG}"` : ''}>${kk}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawTrade(); drawCoh(); share(); }

  function after() {
    const P = params(); rows = []; th = []; drawSweep(); drawThresh();
    $('note-s').textContent = '계산 중…'; $('note-t').textContent = '계산 중…';
    const jobs = PS.map((x) => () => {
      const o = SN.sweep(Object.assign({}, P, { p: x / 100, seed: 1 }), 100);
      rows.push({ x, success: o.success, damage: o.damage, partLoss: o.partLoss });
    });
    LEAKS.forEach((x) => jobs.push(() => { th.push({ x, v: SN.threshold(Object.assign({}, P, { leak: x / 100, seed: 1 }), 100) }); }));
    L.jobs(jobs, () => { drawSweep(); drawThresh(); }, () => {
      const cur = rows.find((d) => d.x === Math.round(P.p * 100)) || rows[5];
      $('note-s').textContent = `지금 참여율 ${Math.round(P.p * 100)}%: 압력이 통한 판 ${pc(cur.success)}, 평균 피해 ${pc(cur.damage)}, 참여국이 잃은 수출 ${pc(cur.partLoss)}`;
      const a = th[0], b = th[th.length - 1], f = (d) => (d.v == null ? '없음' : pc(d.v));
      $('note-t').textContent = `새는 정도 0%면 문턱 ${f(a)}, 100%면 ${f(b)} (압력이 통한 판이 절반을 넘는 가장 낮은 참여율)`;
    });
  }

  const h = L.harness({
    controls: ['p', 'leak', 'rally', 'hard'],
    format: { p: (v) => v + '%', leak: (v) => v + '%', rally: (v) => v + '%', hard: (v) => v + '%' },
    defaults: { p: 50, leak: 50, rally: 50, hard: 50 },
    build() {
      sim = SN.create(params());
      const go = THUMB ? sim.params.start + 18 : JUMP;
      for (let k = 0; k < go && sim.advance(); k++);
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB && !JUMP,
    advance() { const ok = sim.advance(); lastStepAt = performance.now(); return ok; },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawSweep(); drawThresh(); }, seedLabel: '무역망',
  });
  seedGetter = h.seed;
})();
