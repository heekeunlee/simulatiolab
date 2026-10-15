(function () {
  'use strict';
  const FB = window.FilterBubble, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 하나였던 언덕이 봉우리 셋으로 갈라진 장면에서 멈춘다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0);   // 확인용: ?t=걸음 (그 시점으로 바로 가서 멈춤)
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  // 색 3종 (정치색과 겹치지 않게): A쪽 보라 · 가운데 회색 · B쪽 청록
  const C_A = [124, 58, 237], C_M = [148, 163, 184], C_B = [13, 148, 136];
  const C_POL = '#7c3aed', C_CROSS = '#0d9488', C_MOVE = '#d97706', C_CLU = '#475569';
  // 집계(미리 계산): node tools/validate-filterbubble.js 출력의 SWEEP과 같아야 한다 (시드 4개 평균, 200걸음 중 마지막 20걸음)
  const SWEEP = {"s":{"0":{"pol":9,"cl":1,"cross":42,"move":16,"one":0},"10":{"pol":10,"cl":1,"cross":40,"move":16,"one":0},"20":{"pol":24,"cl":1.5,"cross":22,"move":40,"one":1},"30":{"pol":49,"cl":2,"cross":17,"move":61,"one":0},"50":{"pol":57,"cl":3,"cross":26,"move":30,"one":0},"75":{"pol":59,"cl":3,"cross":14,"move":29,"one":0},"100":{"pol":64,"cl":3,"cross":0,"move":33,"one":0}},"div":{"40_0":{"pol":64,"cl":3,"cross":0,"move":33,"one":0},"40_10":{"pol":59,"cl":3,"cross":12,"move":28,"one":0},"40_30":{"pol":49,"cl":3,"cross":31,"move":21,"one":0},"80_0":{"pol":64,"cl":3,"cross":0,"move":33,"one":0},"80_10":{"pol":55,"cl":3,"cross":12,"move":25,"one":0},"80_30":{"pol":7,"cl":1,"cross":31,"move":16,"one":0}},"eps":{"0_20":{"pol":45,"cl":3,"cross":48,"move":21,"one":0},"0_30":{"pol":45,"cl":2,"cross":32,"move":44,"one":0},"0_40":{"pol":9,"cl":1,"cross":42,"move":16,"one":0},"0_60":{"pol":4,"cl":1,"cross":45,"move":17,"one":0},"0_80":{"pol":4,"cl":1,"cross":46,"move":17,"one":0},"50_20":{"pol":56,"cl":3,"cross":26,"move":27,"one":0},"50_30":{"pol":55,"cl":3,"cross":26,"move":26,"one":0},"50_40":{"pol":57,"cl":3,"cross":26,"move":30,"one":0},"50_60":{"pol":5,"cl":1,"cross":13,"move":44,"one":2},"50_80":{"pol":5,"cl":1,"cross":13,"move":44,"one":2}}};
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0;
  const ui = () => ({ n: Number($('n').value), s: Number($('s').value), eps: Number($('eps').value), div: Number($('div').value), rep: Number($('rep').value), reinf: Number($('reinf').value) });
  const params = () => { const u = ui(); return { seed: seedGetter(), n: u.n, s: u.s / 100, eps: u.eps / 100, div: u.div / 100, rep: u.rep / 100, reinf: u.reinf / 100 }; };
  const speed = () => ($('speed') ? Number($('speed').value) : 6);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const tr = (t) => (window.I18N && window.I18N.lang !== 'ko' && window.I18N.t ? window.I18N.t(t) : t);
  const rgb = (c, a) => (a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  // 의견(−1~1) → 색: 보라 ↔ 회색 ↔ 청록
  function opColor(v) {
    const t = Math.max(-1, Math.min(1, v)), a = Math.abs(t), c = t < 0 ? C_A : C_B, k = Math.min(1, a / 0.6);
    return [0, 1, 2].map((i) => Math.round(C_M[i] + (c[i] - C_M[i]) * k));
  }

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.FbState = { sim, lastStepAt, interval: 1 / (speed() * 0.7), isPaused, thumb: THUMB || !!JUMP, opColor }; }

  // ---------- ② 의견 띠: 시간에 따라 의견 분포가 어떻게 갈라지나 (재생 시점까지) ----------
  function drawStrip() {
    const cv = $('c-strip'), items = [{ kind: 'box', color: rgb(C_A), label: 'A쪽' }, { kind: 'box', color: rgb(C_M), label: '가운데' }, { kind: 'box', color: rgb(C_B), label: 'B쪽' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.5 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 44, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = FB.C.STEPS, B = FB.C.BINS, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - ((v + 100) / 200) * ph;
    ctx.fillStyle = css('--panel') || '#fff';
    const D = sim.hist.dens, cw = pw / T + 0.6, bh = ph / B + 0.6;
    for (let t = 0; t < D.length; t++) {
      const d = D[t];
      for (let b = 0; b < B; b++) {
        if (d[b] <= 0) continue;
        const v = -1 + (b + 0.5) * (2 / B), a = Math.min(1, Math.sqrt(d[b] / 0.12));
        ctx.fillStyle = rgb(opColor(v), 0.08 + 0.92 * a);
        ctx.fillRect(X(t) - (t === 0 ? 0 : cw / 2), Y(-100 + (b + 1) * (200 / B)), t === 0 ? cw / 2 : cw, bh);
      }
    }
    L.axes(c, { X, Y, yTicks: [-100, -50, 0, 50, 100], yFmt: (v) => (v > 0 ? '+' + v : String(v)), xTicks: [0, 50, 100, 150, 200], xLabel: '시간 (일)', yLabel: '의견 (A쪽 −100 ~ B쪽 +100)' });
    const n = D.length - 1;
    ctx.strokeStyle = css('--text'); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(n), m.t); ctx.lineTo(X(n), m.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 시간별 갈라진 정도 · 다른 편 글 · 평균 이동 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-time'), items = [{ kind: 'line', color: C_POL, label: '갈라진 정도' }, { kind: 'line', color: C_CROSS, label: '본 글 중 다른 편 글 (%)' }, { kind: 'dash', color: C_MOVE, label: '처음 생각에서 움직인 정도' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 38, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = FB.C.STEPS, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (Math.min(100, v) / 100) * ph;
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [0, 50, 100, 150, 200], xLabel: '시간 (일)', yLabel: '정도 · 비율 (0~100)' });
    const H = sim.hist;
    const pts = (arr) => arr.map((v, t) => (isNaN(v) ? null : [X(t), Y(v)])).filter(Boolean);
    ctx.setLineDash([5, 4]); L.line(ctx, pts(H.move), C_MOVE, 2); ctx.setLineDash([]);
    L.line(ctx, pts(H.cross), C_CROSS, 2.2);
    L.line(ctx, pts(H.pol), C_POL, 2.6);
    const n = H.pol.length - 1;
    [[H.pol[n], C_POL], [H.cross[n], C_CROSS], [H.move[n], C_MOVE]].forEach(([v, col]) => { if (isNaN(v)) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(n), Y(v), 4, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, items);
  }
  // ④ 덩어리 수 (재생 시점까지)
  function drawClusters() {
    const cv = $('c-clu'), items = [{ kind: 'line', color: C_CLU, label: '의견 덩어리 수' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.5 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 38, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = FB.C.STEPS, YM = 6, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (Math.min(YM, v) / YM) * ph;
    L.axes(c, { X, Y, yTicks: [0, 1, 2, 3, 4, 5, 6], yFmt: (v) => (v === 6 ? '6+' : String(v)), xTicks: [0, 50, 100, 150, 200], xLabel: '시간 (일)', yLabel: '덩어리 수 (개)' });
    const H = sim.hist.cl, pts = [];
    H.forEach((v, t) => { if (t) pts.push([X(t), Y(H[t - 1])]); pts.push([X(t), Y(v)]); });
    L.line(ctx, pts, C_CLU, 2.4);
    const n = H.length - 1; ctx.fillStyle = C_CLU; ctx.beginPath(); ctx.arc(X(n), Y(H[n]), 4, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }

  // ---------- ⑤⑥⑦ 집계 막대 ----------
  // groups: [{ name, vals:[a,b], sub, cur }], series: [{ label, color }]
  function bars(cv, groups, series, yLabel) {
    const items = series.map((s) => ({ kind: 'box', color: s.color, label: s.label }));
    const narrow = (cv.clientWidth || 400) < 480;
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 38, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / groups.length, Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [], yLabel });
    groups.forEach((g, i) => {
      const x0 = m.l + i * gw;
      if (g.cur) { ctx.fillStyle = 'rgba(124,58,237,.08)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      const bw = Math.min(30, (gw - 12) / g.vals.length - 3);
      const start = x0 + (gw - bw * g.vals.length - 3 * (g.vals.length - 1)) / 2;
      g.vals.forEach((v, k) => {
        const x = start + k * (bw + 3); ctx.fillStyle = series[k].color; ctx.fillRect(x, Y(v), bw, Y(0) - Y(v));
        ctx.font = '700 ' + (narrow ? 10 : 11.5) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + bw / 2, Y(v) - 4);
      });
      ctx.font = (g.cur ? '700 ' : '600 ') + (narrow ? 11 : 12) + 'px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(g.name, x0 + gw / 2, m.t + ph + 16);
      ctx.font = (narrow ? 10 : 11) + 'px ' + FONT; ctx.fillStyle = g.warn ? '#b45309' : css('--muted'); ctx.fillText(narrow && g.short != null ? g.short : g.sub, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);   // 막대 이름 두 줄 아래
  }
  const cl = (v) => String(v);
  function drawS() {
    const u = ui(), groups = [0, 10, 20, 30, 50, 75, 100].map((s) => { const a = SWEEP.s[s]; return { name: `${s}%`, vals: [a.pol, a.move], sub: `덩어리 ${cl(a.cl)}`, short: cl(a.cl), cur: u.s === s && u.eps === 40 && u.div === 0 && u.rep === 0 && u.reinf === 100 }; });
    bars($('c-s'), groups, [{ label: '갈라진 정도', color: C_POL }, { label: '처음 생각에서 움직인 정도', color: C_MOVE }], '정도 (0~100)');
  }
  function drawDiv() {
    const u = ui(), groups = [0, 10, 30].map((d) => { const a = SWEEP.div['40_' + d], b = SWEEP.div['80_' + d]; return { name: `반대 글 ${d}%`, vals: [a.pol, b.pol], sub: `덩어리 ${cl(a.cl)} · ${cl(b.cl)}`, short: `${cl(a.cl)} · ${cl(b.cl)}`, cur: u.s === 100 && u.div === d && (u.eps === 40 || u.eps === 80) && u.rep === 0 && u.reinf === 100 }; });
    bars($('c-div'), groups, [{ label: '끌리는 폭 40', color: '#64748b' }, { label: '끌리는 폭 80', color: C_CROSS }], '갈라진 정도 (0~100)');
  }
  function drawEps() {
    const u = ui(), groups = [20, 30, 40, 60, 80].map((e) => {
      const a = SWEEP.eps['0_' + e], b = SWEEP.eps['50_' + e], one = a.one + b.one;
      return { name: `폭 ${e}`, vals: [a.pol, b.pol], sub: one ? `한쪽 끝 쏠림 ${b.one}판` : `덩어리 ${cl(a.cl)} · ${cl(b.cl)}`, short: one ? `쏠림 ${b.one}판` : `${cl(a.cl)} · ${cl(b.cl)}`, warn: !!one, cur: u.eps === e && (u.s === 0 || u.s === 50) && u.div === 0 && u.rep === 0 && u.reinf === 100 };
    });
    bars($('c-eps'), groups, [{ label: '추천 0%', color: '#94a3b8' }, { label: '추천 50%', color: C_POL }], '갈라진 정도 (0~100)');
  }
  function notes() {
    const S = SWEEP.s, V = SWEEP.div, E = SWEEP.eps;
    $('note-s').textContent = `갈라진 정도: 추천 0% ${S[0].pol} · 10% ${S[10].pol} · 20% ${S[20].pol} · 30% ${S[30].pol} · 50% ${S[50].pol} · 100% ${S[100].pol}`;
    $('note-d').textContent = `반대 글 30% 섞으면: 끌리는 폭 40에서 ${V['40_0'].pol} → ${V['40_30'].pol}, 폭 80에서 ${V['80_0'].pol} → ${V['80_30'].pol}`;
    $('note-e').textContent = `추천 50%에서 폭 60·80은 갈라진 정도 ${E['50_60'].pol}이지만 4판 중 ${E['50_60'].one}판은 모두 한쪽 끝으로 쏠렸어요`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const m = sim.last, t = sim.t, early = t < 1;
    const groups = m.groups.slice().sort((a, b) => a.mean - b.mean).map((g) => tr(g.mean < -20 ? 'A쪽' : g.mean > 20 ? 'B쪽' : '가운데'));
    const cards = [
      ['지금 갈라진 정도', String(Math.round(m.pol)), '0 모두 같은 생각 ~ 100 절반씩 양 끝'],
      ['의견 덩어리', `${m.cl}개`, m.cl ? groups.join(' · ') : `${FB.minCluster(sim.n)}명 이상만 셈`],
      ['본 글 중 다른 편 글', early ? '' : `${Math.round(m.cross)}%`, early ? '하루가 지나면 재요' : '가운데(0)를 사이에 둔 맞은편 사람의 글'],
      ['처음 생각에서 움직인 정도', String(Math.round(m.move)), `사람 ${sim.n}명 평균 (의견 눈금 기준)`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${t} / ${FB.C.STEPS}일`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawStrip(); drawTime(); drawClusters(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() { drawS(); drawDiv(); drawEps(); notes(); }

  const h = L.harness({
    controls: ['n', 's', 'eps', 'div', 'rep', 'reinf'],
    format: { n: (v) => String(v), s: (v) => v + '%', eps: (v) => String(v), div: (v) => v + '%', rep: (v) => v + '%', reinf: (v) => v + '%' },
    defaults: { n: 400, s: 50, eps: 40, div: 0, rep: 0, reinf: 100 },
    speedScale: 0.7,
    build() {
      sim = FB.create(params());
      const jump = THUMB ? 60 : JUMP;
      for (let t = 0; t < jump && !sim.done; t++) sim.step();
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB && !JUMP,
    advance() { if (sim.done) return false; sim.step(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '마을',
  });
  seedGetter = h.seed;
  window.FbApp = { params, sim: () => sim };
})();
