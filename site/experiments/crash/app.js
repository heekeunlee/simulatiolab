(function () {
  'use strict';
  const CR = window.Crash, L = window.Lab;
  const { css, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 손절 기둥이 한창 무너지는 장면에서 멈춘다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0);   // 확인용: ?t=라운드
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_PRICE = '#dc2626', C_BIG = '#dc2626', C_SMALL = '#64748b', C_REF = '#b91c1c', C_WHALE = '#334155', C_BLUE = '#2f6fed';
  const SEED_OFFSET = 7;   // 장 #1 = 내부 시드 8 (연쇄가 끝까지 이어지는 판을 첫 화면으로 고름. 100판 집계는 시드 1~100)
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const SPREAD_NAME = ['아주 촘촘', '촘촘', '중간', '퍼짐', '아주 퍼짐'];
  const IMPACT_NAME = ['아주 두꺼움', '두꺼움', '중간', '얇음', '아주 얇음'];
  const pct1 = (v) => (v * 100).toFixed(1) + '%';
  const neg = (v) => (v > 0.0005 ? '−' : v < -0.0005 ? '+' : '') + Math.abs(v * 100).toFixed(1) + '%';
  let sim = null, seedGetter = () => 1, agg = null, lev = null;
  const params = () => ({
    seed: seedGetter() + SEED_OFFSET, shock: Number($('shock').value), spread: Number($('spread').value), lev: Number($('lev').value),
    impact: Number($('impact').value), whale: Number($('whale').value), dip: Number($('dip').value),
  });
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const speed = () => ($('speed') ? Number($('speed').value) : 3);
  let lastStepAt = 0;
  function share() { window.CrashState = { sim, isPaused, thumb: THUMB, lastStepAt, interval: 1 / (speed() * 0.7) }; }

  // 이름표: 글상자 + 대상(x,y)까지 이어진 선
  function chip(ctx, text, x, y, cx, cy, color, w) {
    ctx.font = '600 12px ' + FONT;
    const tw = ctx.measureText(text).width + 16, th = 22;
    const bx = Math.max(4, Math.min(cx - tw / 2, w - tw - 4)), by = cy - th / 2;
    const ax = Math.min(Math.max(x, bx + 10), bx + tw - 10), ay = y < by ? by : by + th;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; roundRect(ctx, bx, by, tw, th, th / 2); ctx.fill();
    ctx.strokeStyle = color; roundRect(ctx, bx, by, tw, th, th / 2); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, bx + 8, by + 15);
  }

  // ---------- ② 하루 가격 경로 (재생 시점까지) ----------
  function drawPath() {
    const cv = $('c-path'), items = [{ kind: 'line', color: C_PRICE, label: '가격 (장 시작 대비)' }, { kind: 'dash', color: C_REF, label: '큰 폭락 기준 (−7%)' }, { kind: 'box', color: 'rgba(47,111,237,.35)', label: '이번 라운드에 판 양' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 44, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const R = CR.C.ROUNDS, lo = Math.ceil(sim.worst() * 100 / 2) * 2 / 100;
    const X = (r) => m.l + (r / R) * pw, Y = (d) => m.t + ((d + 0.01) / (lo + 0.01)) * ph;   // d = 낙폭(양수일수록 아래)
    const yt = []; for (let v = 0; v <= lo + 1e-9; v += lo > 0.16 ? 0.04 : 0.02) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => (v ? '−' + Math.round(v * 100) : '0'), xTicks: [0, 10, 20, 30, 40], xLabel: '라운드 (하루 = 40)', yLabel: '시작 대비 (%)' });
    // 판 양 막대 (아래에서 위로, 최대 = 시장 전체의 10%)
    const maxS = CR.C.N * 0.1;
    ctx.fillStyle = 'rgba(47,111,237,.3)';
    for (let r = 1; r <= sim.round; r++) { const v = Math.min(1, sim.sold[r] / maxS) * ph * 0.22; if (v > 0) ctx.fillRect(X(r) - Math.max(1.5, pw / R * 0.35), m.t + ph - v, Math.max(3, pw / R * 0.7), v); }
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C_REF; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.l, Y(0.07)); ctx.lineTo(m.l + pw, Y(0.07)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    const pts = [[X(0), Y(0)]]; for (let r = 0; r <= sim.round; r++) pts.push([X(r), Y(1 - Math.exp(sim.path[r]))]);
    L.line(ctx, pts, C_PRICE, 2.6);
    const r = sim.round, d = 1 - Math.exp(sim.path[r]);
    ctx.fillStyle = C_PRICE; ctx.beginPath(); ctx.arc(X(r), Y(d), 4.5, 0, 7); ctx.fill();
    ctx.font = '700 13px ' + FONT; ctx.textAlign = r > R * 0.8 ? 'right' : 'left'; ctx.fillStyle = C_PRICE;
    L.label(ctx, neg(d), X(r) + (r > R * 0.8 ? -9 : 9), Y(d) - 8);
    if (sim.whaleRound > 0 && sim.whaleRound <= r) {
      const wr = sim.whaleRound, wd = 1 - Math.exp(sim.path[wr - 1]);
      chip(ctx, '큰손이 한꺼번에 팖', X(wr - 1), Y(wd), X(wr - 1) + (wr > R / 2 ? -90 : 90), Math.max(m.t + 10, Y(wd) - 34), C_WHALE, c.w);
    }
    ctx.font = '12px ' + FONT; L.drawLegendBelow(c, items);
  }

  // ---------- ③ 같은 설정 100판의 하루 낙폭 (집계) ----------
  function drawHist() {
    const cv = $('c-hist'), items = [{ kind: 'box', color: C_SMALL, label: '−7%보다 작게 빠진 판' }, { kind: 'box', color: C_BIG, label: '큰 폭락 (−7% 이상)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    if (!agg || !agg.hist) { L.axes(c, { X: () => 0, Y: () => 0, xLabel: '하루 낙폭 (%)', yLabel: '판 수' }); L.drawLegendBelow(c, items); return; }
    const top = Math.max(16, Math.ceil(sim.worst() * 100) + 1), bins = new Array(top).fill(0);
    agg.hist.drops.forEach((d) => { bins[Math.max(0, Math.min(top - 1, Math.floor(d * 100)))]++; });
    const yMax = Math.max(20, Math.ceil(Math.max(...bins) / 20) * 20), bw = pw / top;
    const X = (v) => m.l + v * bw, Y = (n) => m.t + ph - (n / yMax) * ph;
    const xt = []; for (let v = 0; v <= top; v += top > 24 ? 6 : 2) xt.push(v);
    L.axes(c, { X, Y, yTicks: [0, yMax / 4, yMax / 2, yMax * 3 / 4, yMax], yFmt: (v) => String(Math.round(v)), xTicks: xt, xFmt: (v) => (v ? '−' + v : '0'), xLabel: '하루 낙폭 (%)', yLabel: '판 수 (100판 중)' });
    bins.forEach((n, i) => { if (!n) return; ctx.fillStyle = i >= 7 ? C_BIG : C_SMALL; ctx.fillRect(X(i) + 1, Y(n), Math.max(2, bw - 2), Y(0) - Y(n)); });
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C_REF; ctx.beginPath(); ctx.moveTo(X(7), m.t); ctx.lineTo(X(7), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    // 이번 판은 하루가 끝난 뒤에만 표시 (재생 중에는 결과를 미리 보여 주지 않음)
    if (sim.done) {
      const d = sim.drop(), i = Math.max(0, Math.min(top - 1, Math.floor(d * 100)));
      chip(ctx, '이번 판 ' + neg(d), X(i) + bw / 2, Y(bins[i]), X(i) + bw / 2 + (i > top / 2 ? -60 : 60), m.t + 14, C_BLUE, c.w);
    }
    L.drawLegendBelow(c, items);
  }

  // ---------- ④ 무엇을 바꾸면 큰 폭락이 잦아질까 (집계: 막대 하나 = 100판) ----------
  const LEVERS = [
    { key: 'spread', name: '손절선이 퍼진 정도', vals: [1, 2, 3, 4, 5], fmt: (v) => String(v) },
    { key: 'lev', name: '빚을 낸 사람 비율', vals: [0, 10, 20, 40, 60], fmt: (v) => v + '%' },
    { key: 'whale', name: '큰손 비중', vals: [0, 10, 20, 30, 40], fmt: (v) => v + '%' },
    { key: 'dip', name: '저가 매수자 비율', vals: [0, 10, 20, 30, 40], fmt: (v) => v + '%' },
  ];
  function drawLevers() {
    const cv = $('c-lever'), W = cv.clientWidth || 400, narrow = W < 560;
    const { ctx, w, h } = L.setup(cv, narrow ? 1.05 : 0.42);
    const P = params(), gx = 2, gy = 2, padL = 34, padR = 8, padT = 40, padB = 34;
    const cw = w / gx, chh = h / gy;
    LEVERS.forEach((lv, k) => {
      const x0 = (k % gx) * cw, y0 = Math.floor(k / gx) * chh, pw = cw - padL - padR, ph = chh - padT - padB;
      const X = (i) => x0 + padL + (i + 0.5) * (pw / lv.vals.length), Y = (v) => y0 + padT + ph - v * ph;
      ctx.font = '700 ' + (narrow ? 12 : 13) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
      ctx.fillText(lv.name, x0 + 6, y0 + 16);
      if (narrow && lv.key !== 'spread') { const tw = ctx.measureText(lv.name).width; ctx.font = '600 11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(' (%)', x0 + 6 + tw, y0 + 16); }
      ctx.font = '600 11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText('큰 폭락 판 (%)', x0 + 6, y0 + 31);
      ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.font = '11px ' + FONT;
      [0, 0.5, 1].forEach((v) => { ctx.beginPath(); ctx.moveTo(x0 + padL, Y(v)); ctx.lineTo(x0 + padL + pw, Y(v)); ctx.stroke(); ctx.fillText(String(v * 100), x0 + padL - 5, Y(v) + 4); });
      const bw = Math.min(30, pw / lv.vals.length - 8);
      lv.vals.forEach((v, i) => {
        const cur = P[lv.key] === v, r = agg && agg.lev && agg.lev[lv.key] && agg.lev[lv.key][i];
        ctx.textAlign = 'center'; ctx.font = (cur ? '700 ' : '') + (narrow ? '10.5px ' : '11px ') + FONT; ctx.fillStyle = cur ? css('--text') : css('--muted');
        ctx.fillText(lv.key === 'spread' || narrow ? String(v) : lv.fmt(v), X(i), y0 + padT + ph + 15);
        if (r == null) return;
        ctx.fillStyle = cur ? C_BIG : 'rgba(220,38,38,.38)'; ctx.fillRect(X(i) - bw / 2, Y(r.big), bw, Math.max(1, Y(0) - Y(r.big)));
        ctx.font = '700 11px ' + FONT; ctx.fillStyle = css('--text'); ctx.fillText(String(Math.round(r.big * 100)), X(i), Y(r.big) - 4);
      });
      if (lv.key === 'spread') { ctx.font = '10.5px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('촘촘', x0 + padL, y0 + padT + ph + 29); ctx.textAlign = 'right'; ctx.fillText('퍼짐', x0 + padL + pw, y0 + padT + ph + 29); }
    });
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const d = sim.drop(), r = sim.round, R = CR.C.ROUNDS, nl = sim.levCount();
    const big = agg && agg.hist ? Math.round(agg.hist.big * 100) : null;
    const cards = [
      ['지금 가격 (장 시작 대비)', neg(d), sim.done ? '장 마감 · 하루 낙폭' : `${r} / ${R}라운드 · 진행 중`, d >= CR.C.BIG ? C_BIG : ''],
      ['연쇄 단계', `${sim.chainRounds}단계 연쇄`, '누군가 손절해서 판 라운드 수', ''],
      ['손절·청산한 사람', pct1(sim.soldShare()).replace('.0%', '%'), nl ? `빚을 낸 사람 중 ${Math.round(sim.soldLev / nl * 100)}%` : '빚을 낸 사람 없음', ''],
      ['같은 설정 100판 중 큰 폭락 (집계)', big == null ? '' : `${big}판 / 100`, '하루 −7% 이상 빠진 판', ''],
    ];
    $('stats').classList.toggle('live', !sim.done);
    $('stats').innerHTML = cards.map(([k, v, s, col]) => `<div class="stat"><div class="k">${k}</div><div class="v"${col ? ` style="color:${col}"` : ''}>${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = sim.done ? '장 마감' : `${r} / ${R}라운드`;
  }

  function draw() { share(); renderStats(); drawPath(); drawHist(); }

  function notes() {
    const H = agg.hist; if (!H) return;
    const s = H.drops.slice().sort((a, b) => a - b);
    $('note-h').textContent = `100판 중 큰 폭락 ${Math.round(H.big * 100)}판 · 가운데 판의 낙폭 −${(s[50] * 100).toFixed(1)}% · 가장 크게 빠진 판 −${(s[99] * 100).toFixed(1)}%`;
    const lv = agg.lev, f = (k) => (lv[k] ? lv[k].map((r) => Math.round(r.big * 100)).join('·') : '');
    if (lv.dip && lv.dip.length === 5) $('note-l').textContent = `큰 폭락 판(%): 손절선 퍼짐 1~5 → ${f('spread')} · 빚 0~60% → ${f('lev')} · 큰손 0~40% → ${f('whale')} · 저가 매수자 0~40% → ${f('dip')}`;
  }
  function after() {
    const P = params(); agg = { hist: null, lev: {} };
    drawHist(); drawLevers(); $('note-h').textContent = '계산 중…'; $('note-l').textContent = '계산 중…';
    const base = Object.assign({}, P); delete base.seed;
    const jobs = [() => { agg.hist = CR.sweep(base, 100, 1); }];
    LEVERS.forEach((lv) => { agg.lev[lv.key] = []; lv.vals.forEach((v) => jobs.push(() => { const o = CR.sweep(Object.assign({}, base, { [lv.key]: v }), 100, 1); agg.lev[lv.key].push({ big: o.big }); })); });
    L.jobs(jobs, () => { renderStats(); drawHist(); drawLevers(); }, () => { renderStats(); drawHist(); drawLevers(); notes(); });
  }

  const h = L.harness({
    controls: ['shock', 'spread', 'lev', 'impact', 'whale', 'dip'],
    format: { shock: (v) => '−' + Number(v).toFixed(1) + '%', spread: (v) => SPREAD_NAME[v - 1], lev: (v) => v + '%', impact: (v) => IMPACT_NAME[v - 1], whale: (v) => v + '%', dip: (v) => v + '%' },
    defaults: { shock: 2, spread: 3, lev: 20, impact: 3, whale: 10, dip: 10 },
    speedScale: 0.7,
    build() {
      sim = CR.create(params());
      if (THUMB) for (let k = 0; k < 10 && sim.advance(); k++); else if (JUMP) for (let k = 0; k < JUMP && sim.advance(); k++);
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB && !JUMP,
    advance() { const ok = sim.advance(); lastStepAt = performance.now(); return ok; },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawHist(); drawLevers(); }, seedLabel: '장',
  });
  seedGetter = h.seed;
  window.CrashApp = { params, sim: () => sim, agg: () => agg };
})();
