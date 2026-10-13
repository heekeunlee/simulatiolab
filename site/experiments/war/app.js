(function () {
  'use strict';
  const W = window.War, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const GREEN = '#1fa463', RED = '#e5484d', GRAY = '#8a93a6', PURPLE = '#7c5cff', ORANGE = '#e0a100';
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 분쟁이 충분히 쌓인 장면으로 바로 간다
  let sim = null, seedGetter = () => 1, curveU = [], curveQ = [], spreadNow = null;
  const params = () => ({ seed: seedGetter(), u: Number($('u').value), c: Number($('c').value), k: Number($('k').value), a: Number($('a').value), q: Number($('q').value) });
  const f1 = (v) => v.toFixed(1), pc0 = (v) => Math.round(v * 100);

  // ---------- ① 협상: 분쟁이 하나씩 쌓인다 ----------
  function drawBar() {
    const cw = $('c-bar').clientWidth || 600, asp = THUMB ? 0.7 : cw < 560 ? 1.0 : 0.66;
    const c = L.chart($('c-bar'), asp, { l: 16, r: 16, t: 34, b: 14 }), { ctx, w, h, m, pw } = c, P = sim.params;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const b = W.bounds(P), thr = W.threshold(P), dem = W.demand(P);
    const X = (v) => m.l + v * pw, yTop = m.t + 8, yBot = h - 138;
    ctx.textAlign = 'left'; ctx.fillStyle = THUMB ? 'rgba(0,0,0,0)' : css('--text'); ctx.font = '600 13px ' + FONT;
    ctx.fillText(`분쟁 ${sim.disputes.length}건 · 그중 전쟁 ${pc0(sim.warRate())}%`, m.l, 22);
    // A가 짐작하는 범위, 전쟁 쪽과 합의 쪽
    ctx.fillStyle = mix(RED, 0.10); ctx.fillRect(X(b.lo), yTop, X(thr) - X(b.lo), yBot - yTop);
    ctx.fillStyle = mix(GREEN, 0.10); ctx.fillRect(X(thr), yTop, X(b.hi) - X(thr), yBot - yTop);
    ctx.strokeStyle = GRAY; ctx.lineWidth = 1; ctx.strokeRect(X(b.lo) + 0.5, yTop + 0.5, X(b.hi) - X(b.lo) - 1, yBot - yTop - 1);
    if (thr > b.lo + 1e-9) { ctx.strokeStyle = RED; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(thr), yTop); ctx.lineTo(X(thr), yBot); ctx.stroke(); ctx.setLineDash([]); }
    // 분쟁 점: 가로는 A가 실제로 이길 가능성 (B는 알고, A는 모른다)
    const R = THUMB ? 3.4 : cw < 560 ? 2.4 : 2.9;
    sim.disputes.forEach((d, i) => {
      const yy = yTop + 8 + (((i * 0.6180339887) % 1) * (yBot - yTop - 16));
      ctx.fillStyle = mix(d.war ? RED : GREEN, 0.72); ctx.beginPath(); ctx.arc(X(d.p), yy, R, 0, 7); ctx.fill();
    });
    ctx.font = '12px ' + FONT;
    if (!THUMB) {
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
      [0, 0.25, 0.5, 0.75, 1].forEach((v) => ctx.fillText(pc0(v) + '%', X(v), yBot + 16));
      ctx.fillText('A가 실제로 이길 가능성 (B는 정확히 알고, A는 범위만 짐작)', m.l + pw / 2, yBot + 32);
      ctx.textAlign = 'left'; ctx.fillStyle = RED; if (thr > b.lo + 0.06) ctx.fillText('거절 → 전쟁', X(b.lo) + 6, yTop + 14);
      ctx.fillStyle = GREEN; ctx.textAlign = 'right'; ctx.fillText('수락 → 합의', X(b.hi) - 6, yTop + 14);
    }
    // 가장 최근 분쟁: 협상 범위와 A의 요구
    const d = sim.disputes[sim.disputes.length - 1], ay = h - 62;
    if (d) {
      const lo = Math.max(0, d.lo), hi = Math.min(1, d.hi);
      ctx.fillStyle = mix(GREEN, 0.35); ctx.fillRect(X(lo), ay - 7, X(hi) - X(lo), 14);
      ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(m.l, ay + 0.5); ctx.lineTo(m.l + pw, ay + 0.5); ctx.stroke();
      ctx.strokeStyle = d.war ? RED : GREEN; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(dem), ay - 13); ctx.lineTo(X(dem), ay + 13); ctx.stroke(); ctx.lineWidth = 1;
      if (!THUMB) {
        ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = css('--muted');
        ctx.fillText('가장 최근 분쟁: A가 가져갈 파이의 몫 (초록 띠 = 양쪽이 전쟁보다 나은 합의 범위, 막대 = A의 요구)', m.l, ay - 22);
        ctx.fillStyle = d.war ? RED : GREEN; ctx.font = '600 12px ' + FONT;
        ctx.fillText(d.war ? `합의 범위 ${pc0(lo)}~${pc0(hi)}% 가 있었지만 요구 ${pc0(dem)}%는 그 밖이라 거절 → 전쟁` : `요구 ${pc0(dem)}%가 합의 범위 ${pc0(lo)}~${pc0(hi)}% 안이라 수락 → 합의`, m.l, ay + 32);
      }
    }
    $('when').textContent = `${sim.round}/${P.rounds}라운드`;
  }

  // ---------- ② 불확실성과 전쟁 ----------
  function drawU() {
    const c = L.chart($('c-u'), 0.62, { l: 46, b: 40, r: 18 }), { ctx, m, pw, ph } = c, P = sim.params;
    const X = (v) => m.l + (v / 0.5) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => pc0(v) + '%', xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], xFmt: (v) => pc0(v) + '%', xLabel: '불확실성 (A가 짐작하는 B의 힘 범위의 절반 폭)' });
    L.line(ctx, curveU.map((d) => [X(d.x), Y(d.theory)]), RED, 2.8);
    ctx.fillStyle = mix(GREEN, 0.9); curveU.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.sim), 3.3, 0, 7); ctx.fill(); });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(X(P.c), m.t); ctx.lineTo(X(P.c), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = GRAY; ctx.textAlign = 'left'; L.label(ctx, '전쟁 비용 이하에서는 0%', Math.min(X(P.c) + 5, m.l + pw - 150), m.t + ph - 8, 'left');
    L.vline(c, X(P.u), css('--rich'), '지금 설정', P.u > 0.25 ? 'right' : 'left');
  }

  // ---------- ③ 군비 경쟁 ----------
  function drawArms() {
    const c = L.chart($('c-arms'), 0.62, { l: 46, b: 40, r: 14 }), { ctx, m, pw, ph } = c, P = sim.params, T = P.rounds, Dg = P.danger, y1 = Dg * 1.3;
    const X = (r) => m.l + (r / T) * pw, Y = (v) => m.t + ph - (Math.min(v, y1) / y1) * ph;
    const yt = [0, 2, 4, 6, 8, 10, 12];
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => String(v), xTicks: [0, 40, 80, 120, 160], xFmt: (v) => String(v), xLabel: '라운드 (두 나라가 서로 군비를 다시 정하는 차례)' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = RED; ctx.beginPath(); ctx.moveTo(m.l, Y(Dg)); ctx.lineTo(m.l + pw, Y(Dg)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = RED; ctx.textAlign = 'right'; L.label(ctx, '과열선 (이 프로젝트가 정한 기준)', m.l + pw - 6, Y(Dg) - 5, 'right');
    const lv = W.armsLevel(P);
    if (lv < y1) { ctx.setLineDash([2, 3]); ctx.strokeStyle = GREEN; ctx.beginPath(); ctx.moveTo(m.l, Y(lv)); ctx.lineTo(m.l + pw, Y(lv)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = GREEN; ctx.textAlign = 'right'; L.label(ctx, `이론상 안정 수준 ${lv.toFixed(1)}`, m.l + pw - 6, Y(lv) - 5, 'right'); }
    L.line(ctx, sim.x.map((v, i) => [X(i), Y(v)]), css('--accent'), 2.6);
    L.line(ctx, sim.y.map((v, i) => [X(i), Y(v)]), PURPLE, 2.6);
    if (sim.cross > 0) L.vline(c, X(sim.cross), RED, `${sim.cross}라운드에 과열선 도달`, sim.cross > T / 2 ? 'right' : 'left');
  }

  // ---------- ④ 번짐 ----------
  function drawGrid() {
    const cw = $('c-grid').clientWidth || 600, narrow = cw < 560;
    const c = L.chart($('c-grid'), narrow ? 1.18 : 0.6, { l: 14, r: 14, t: 34, b: 14 }), { ctx, w, h, m, pw, ph } = c, P = sim.params, G = P.grid, sp = sim.spread;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'left'; ctx.font = '600 13px ' + FONT; ctx.fillStyle = THUMB ? 'rgba(0,0,0,0)' : css('--text');
    ctx.fillText(sp.running ? `지금 번지는 중: 참전 ${sp.size}개국` : `이번 전쟁은 끝: 참전 ${sp.size}개국`, m.l, 22);
    const side = narrow ? Math.min(pw, ph - 90) : Math.min(ph, pw * 0.5), cell = side / G, gx = m.l, gy = m.t;
    const maxL = Math.max(3, ...Array.from(sp.born).filter((v) => v >= 0));
    for (let i = 0; i < G * G; i++) {
      const r = Math.floor(i / G), cc = i % G, x = gx + cc * cell, y = gy + r * cell;
      if (sp.inf[i]) { const t = sp.born[i] / maxL; ctx.fillStyle = `hsl(${Math.round(8 + 38 * t)}, ${Math.round(78 - 10 * t)}%, ${Math.round(42 + 14 * t)}%)`; }
      else ctx.fillStyle = mix('#8a93a6', 0.22);
      L.roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, Math.min(4, cell / 4)); ctx.fill();
    }
    const sx = gx + (sp.start % G) * cell, sy = gy + Math.floor(sp.start / G) * cell;
    ctx.strokeStyle = css('--text'); ctx.lineWidth = 2; ctx.strokeRect(sx + 1.5, sy + 1.5, cell - 3, cell - 3); ctx.lineWidth = 1;
    if (THUMB) return;
    // 지금까지 끝난 전쟁의 규모
    const ox = narrow ? m.l : gx + side + 24, oy = narrow ? gy + side + 26 : gy + 6, bw = narrow ? pw : pw - side - 24, N = G * G;
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left';
    ctx.fillText(`끝난 전쟁의 참전국 수 (전체 ${N}개국, 최근 순)`, ox, oy);
    const list = sim.sizes.slice(-8).reverse();
    list.forEach((s, i) => {
      const y = oy + 12 + i * 20;
      ctx.fillStyle = mix(RED, 0.75); ctx.fillRect(ox, y, Math.max(2, (s / N) * (bw - 40)), 13);
      ctx.fillStyle = css('--text'); ctx.fillText(String(s), ox + Math.max(2, (s / N) * (bw - 40)) + 5, y + 11);
    });
    if (!list.length) { ctx.fillStyle = css('--muted'); ctx.fillText('첫 전쟁이 끝나면 여기에 쌓입니다', ox, oy + 28); }
  }

  // ---------- ⑤ 번짐 확률에 따른 규모 ----------
  function drawQ() {
    const c = L.chart($('c-q'), 0.62, { l: 46, b: 40, r: 18 }), { ctx, m, pw, ph } = c, P = sim.params;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => pc0(v) + '%', xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], xFmt: (v) => pc0(v) + '%', xLabel: '전쟁 중인 나라가 이웃 한 곳을 끌어들일 확률' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(X(0.5), m.t); ctx.lineTo(X(0.5), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = GRAY; ctx.textAlign = 'left'; L.label(ctx, '이론상 임계점 50%', X(0.5) + 5, m.t + ph - 8, 'left');
    L.line(ctx, curveQ.map((d) => [X(d.x), Y(d.mean)]), css('--accent'), 2.8);
    L.line(ctx, curveQ.map((d) => [X(d.x), Y(d.big)]), RED, 2.8);
    ctx.fillStyle = css('--accent'); curveQ.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.mean), 3, 0, 7); ctx.fill(); });
    ctx.fillStyle = RED; curveQ.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.big), 3, 0, 7); ctx.fill(); });
    L.vline(c, X(P.q), css('--rich'), '지금 설정', P.q > 0.5 ? 'right' : 'left');
  }

  function renderStats() {
    const P = sim.params, th = W.theoryWar(P), gap = 2 * P.c;
    const arms = W.armsStable(P) ? [`안정 ${f1(W.armsLevel(P))}`, '군비가 이 수준에서 멈춥니다 (반응 < 피로)'] : [sim.cross > 0 ? `${sim.cross}라운드` : '과열 중', '반응이 피로보다 커서 과열선을 넘습니다'];
    const cards = [
      ['협상 가능했는데도 전쟁이 난 분쟁', `${pc0(sim.warRate())}%`, `이론값 ${f1(th * 100)}% · 정보가 정확하면 0%`],
      ['양쪽이 나눠 가질 수 있었던 몫', `${pc0(gap)}%`, '전쟁 때 둘 다 잃는 비용의 합. 이만큼은 항상 합의 여지'],
      ['군비 경쟁', arms[0], arms[1]],
      ['한 전쟁에 끌려드는 평균 나라', `${f1(spreadNow.mean)}개국`, `전체 ${P.grid * P.grid}개국 중 · 이웃 확률 ${pc0(P.q)}%`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { if (spreadNow) renderStats(); drawBar(); drawArms(); drawGrid(); }

  function after() {
    const P = params(), us = [], qs = [];
    for (let v = 0; v <= 0.5001; v += 0.025) us.push(+v.toFixed(3));
    for (let v = 0; v <= 1.0001; v += 0.05) qs.push(+v.toFixed(2));
    curveU = W.curveU(Object.assign({}, W.DEFAULTS, P), us, 4000);
    curveQ = W.curveQ(Object.assign({}, W.DEFAULTS, P), qs, 300);
    spreadNow = W.spreadStats(P.q, W.DEFAULTS.grid, 1000, 3);
    renderStats(); drawU(); drawQ();
  }

  const h = L.harness({
    controls: ['u', 'c', 'k', 'a', 'q'],
    format: { u: (v) => '±' + pc0(v) + '%', c: (v) => pc0(v) + '%', k: (v) => Number(v).toFixed(2), a: (v) => Number(v).toFixed(2), q: (v) => pc0(v) + '%' },
    defaults: { u: 0.25, c: 0.15, k: 0.6, a: 0.45, q: 0.5 },
    build() {
      sim = W.create(params());
      if (THUMB) { for (let i = 0; i < 160 && !sim.done(); i++) sim.advance(); }
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawU(); drawQ(); }, seedLabel: '분쟁 번호',
  });
  seedGetter = h.seed;
})();
