(function () {
  'use strict';
  const WF = window.Wildfire, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 억제한 숲에 큰 불이 난 장면으로 바로 간다
  const C_FREE = '#e5484d', C_SUP = '#1f7a45', C_GRAY = '#8a93a6';
  const tr = (t) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(t) : t);
  let A = null, B = null, seedGetter = () => 1, pre = null, preToken = 0, flash = 0;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), p: Number($('p').value), f: Number($('f').value) * 1e-4, s: Number($('s').value) / 100 });
  const BIG = 0.1; // 큰 불: 숲 칸의 10% 이상
  const pct0 = (v) => Math.round(v * 100) + '%';
  const off = document.createElement('canvas');
  // 가로로 늘어놓는 그래프 안 범례(색 칸 설명용). draw=false이면 높이만 잰다
  function hLegend(ctx, items, x0, y0, maxW, draw) {
    ctx.save(); ctx.font = '11.5px ' + FONT; let x = x0, y = y0, rows = 1;
    items.forEach((it) => {
      const tw = ctx.measureText(it.label).width, iw = 16 + tw + 12;
      if (x > x0 && x + iw > x0 + maxW) { x = x0; y += 16; rows++; }
      if (draw) { ctx.fillStyle = it.color; ctx.fillRect(x, y + 1, 12, 10); ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.fillText(it.label, x + 16, y + 10.5); }
      x += iw;
    });
    ctx.restore(); return rows * 16;
  }
  const FOREST_LEG = [{ color: 'rgb(150,214,120)', label: '어린 나무' }, { color: 'rgb(20,108,50)', label: '오래된 나무' }, { color: '#ffa028', label: '번지는 불꽃' }, { color: '#2e2a24', label: '탄 자리·빈 땅' }];

  // ---------- 격자 그림 ----------
  function paint(sim, ctx, x, y, size) {
    const n = sim.n; off.width = n; off.height = n;
    const o = off.getContext('2d'), img = o.createImageData(n, n), d = img.data, T = sim.tree, G = sim.age, Bt = sim.burnt;
    for (let i = 0; i < n * n; i++) {
      let r, g, b;
      if (T[i]) { const a = Math.min(1, G[i] / 160); r = 150 - 130 * a; g = 214 - 106 * a; b = 120 - 70 * a; } // 어린 나무 연두 -> 오래된 나무 짙은 초록
      else if (Bt[i]) {
        const k = Bt[i];
        if (k <= 2) { r = 255; g = k === 1 ? 190 : 120; b = 40; } // 불꽃
        else { const a = (k - 3) / 12; r = 20 + 36 * a; g = 18 + 28 * a; b = 18 + 24 * a; } // 재 -> 흙
      } else { r = 62; g = 50; b = 40; }
      const j = i * 4; d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
    }
    o.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(off, x, y, size, size);
  }
  function flames(sim) { let c = 0; for (let i = 0; i < sim.N; i++) if (sim.burnt[i] === 1) c++; return c; }

  function drawForest() {
    const cv = $('c-forest'), cw = cv.clientWidth || 600, gap = 12, side = Math.min(330, Math.floor((cw - gap) / 2)), ox = Math.floor((cw - 2 * side - gap) / 2);
    const head = 40, tmp = L.chart(cv, 1, {}), lh = THUMB ? 0 : hLegend(tmp.ctx, FOREST_LEG, 0, 0, cw - 20, false), foot = THUMB ? 40 : 46 + lh + 4, c = L.chart(cv, (side + head + foot) / cw, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, c.h);
    const P = B.P, sims = [[A, 0, '그냥 두기', C_FREE], [B, 1, `작은 불 끄기 ${pct0(P.s)}`, C_SUP]];
    sims.forEach(([sim, k, title, col]) => {
      const x = ox + k * (side + gap);
      ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.font = '700 14px ' + FONT; ctx.fillText(THUMB ? '' : title, x + 2, 18);
      ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
      if (!THUMB) ctx.fillText(`나무 ${pct0(sim.density())} · ${sim.step}단계`, x + 2, 34);
      paint(sim, ctx, x, head, side);
      const big = flames(sim) >= BIG * sim.N * 0.5;
      ctx.strokeStyle = col; ctx.lineWidth = big ? 4 : 2; ctx.strokeRect(x + 1, head + 1, side - 2, side - 2); ctx.lineWidth = 1;
      ctx.font = '12px ' + FONT; ctx.fillStyle = css('--text');
      if (!THUMB) {
        const st = sim.fires.length, lf = sim.lastFire;
        ctx.fillText(`불 ${st}번 · 큰 불 ${sim.fires.filter((v) => v >= BIG * sim.N).length}번`, x + 2, head + side + 17);
        ctx.fillStyle = css('--muted'); ctx.fillText(k ? `끈 불 ${sim.suppressed}번` : (lf ? `방금 ${lf.size}그루 탐` : '방금 불: 없음'), x + 2, head + side + 33);
      }
    });
    if (!THUMB) hLegend(ctx, FOREST_LEG, 10, head + side + 44, w - 20, true);
  }

  // ---------- 차트 공통 ----------
  function stepChart(id, y0, y1, yt, yfmt, yName) {
    const n = Math.max(A.dens.length, 60), c = L.chart($(id), 0.72, { l: 46, r: 14, t: 24, b: 38 }), { m, pw, ph } = c;
    const X = (v) => m.l + (v / n) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const xt = []; const stp = n > 600 ? 200 : n > 240 ? 100 : 50; for (let v = 0; v <= n; v += stp) xt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: yfmt, xTicks: xt, xFmt: (v) => v, xLabel: '시간 (단계)', yLabel: yName });
    return { c, X, Y };
  }

  function drawDens() {
    const { c, X, Y } = stepChart('c-dens', 0, 0.8, [0, 0.2, 0.4, 0.6, 0.8], (v) => String(Math.round(v * 100)), '나무 밀도 (%)'), { ctx, m, pw } = c;
    ctx.setLineDash([5, 3]); ctx.strokeStyle = C_GRAY; ctx.beginPath(); ctx.moveTo(m.l, Y(0.5927)); ctx.lineTo(m.l + pw, Y(0.5927)); ctx.stroke(); ctx.setLineDash([]);
    const ln = (sim, col) => L.line(ctx, sim.dens.map((v, i) => [X(i + 1), Y(v)]), col, 2);
    ln(A, C_FREE); ln(B, C_SUP);
    L.legend(c, [{ kind: 'line', color: C_FREE, label: '그냥 두기' }, { kind: 'line', color: C_SUP, label: '작은 불 끄기' }, { kind: 'dash', color: C_GRAY, label: '숲 전체로 번지는 밀도 (약 59%)' }], 'br');
  }

  function drawSize() {
    const cv = $('c-size');
    if (!pre) { const c = L.chart(cv, 0.6, {}); c.ctx.fillStyle = css('--muted'); c.ctx.textAlign = 'center'; c.ctx.fillText('계산 중…', c.w / 2, c.h / 2); return; }
    const c = L.chart(cv, 0.62, { l: 52, r: 14, t: 24, b: 40 }), { ctx, m, pw, ph } = c, N = pre.N;
    const x0 = 0, x1 = Math.log10(N), ymin = -1, ymax = Math.ceil(Math.log10(Math.max(1, pre.ymax)));
    const X = (v) => m.l + ((Math.log10(Math.max(1, v)) - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(v, 0.1)) - ymin) / (ymax - ymin)) * ph;
    const yt = []; for (let e = ymin; e <= ymax; e++) yt.push(Math.pow(10, e));
    const xt = [1, 10, 100, 1000, N].filter((v) => v <= N);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => (v >= 1 ? String(Math.round(v)) : '0.1'), xTicks: xt, xFmt: (v) => (v === N ? '전부' : v >= 1000 ? v / 1000 + '천' : v), xLabel: '불이 태운 나무 수 (그루, 로그 눈금)', yLabel: '불 횟수 (1,000단계당)' });
    const bx = X(BIG * N), sx = X(pre.smallMax);
    ctx.fillStyle = 'rgba(229,72,77,0.07)'; ctx.fillRect(bx, m.t, m.l + pw - bx, ph);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = C_GRAY; ctx.beginPath(); ctx.moveTo(sx, m.t); ctx.lineTo(sx, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    const draw = (arr, col) => { const pts = []; pre.xs.forEach((x, i) => { if (arr[i] > 0) pts.push([X(x), Y(arr[i])]); }); L.line(ctx, pts, col, 2.6); };
    draw(pre.cA, C_FREE); draw(pre.cB, C_SUP);
    L.legend(c, [{ kind: 'line', color: C_FREE, label: '그냥 두기' }, { kind: 'line', color: C_SUP, label: '작은 불 끄기' }, { kind: 'dash', color: C_GRAY, label: '소방이 끌 수 있는 크기' }, { kind: 'box', color: 'rgba(229,72,77,0.25)', label: '큰 불 (붉은 영역)' }], 'bl');
  }

  function drawArea() {
    const cv = $('c-area');
    if (!pre) { const c = L.chart(cv, 0.4, {}); c.ctx.fillStyle = css('--muted'); c.ctx.textAlign = 'center'; c.ctx.fillText('계산 중…', c.w / 2, c.h / 2); return; }
    const tmp = L.chart(cv, 1, {}), lh = hLegend(tmp.ctx, [{ label: '작은 불 (숲의 1% 미만)' }, { label: '중간 불' }, { label: '큰 불 (숲의 10% 이상)' }], 0, 0, cv.clientWidth - 24, false);
    const c = L.chart(cv, 0.7, { l: 12, r: 12, t: 12, b: 16 + lh + 8 }), { ctx, m, pw, ph } = c;
    const cols = ['#9bd3ae', '#f2b24c', C_FREE], names = ['작은 불 (숲의 1% 미만)', '중간 불', '큰 불 (숲의 10% 이상)'];
    const mx = Math.max(pre.sA.burnPerStep, pre.sB.burnPerStep) * 1.08, rows = [[pre.sA, '그냥 두기', C_FREE], [pre.sB, `작은 불 끄기 ${pct0(pre.s)}`, C_SUP]];
    const bh = Math.min(54, ph / 2 - 36);
    rows.forEach(([st, name, col], r) => {
      const y = m.t + 22 + r * (bh + 40), tot = st.cls[0] + st.cls[1] + st.cls[2], full = (st.burnPerStep / mx) * pw;
      ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.font = '700 13px ' + FONT; ctx.fillText(name, m.l, y - 7);
      let x = m.l; ctx.font = '12px ' + FONT;
      st.cls.forEach((v, k) => {
        const wd = tot ? (v / tot) * full : 0; ctx.fillStyle = cols[k]; ctx.fillRect(x, y, wd, bh);
        if (wd > 34) { ctx.fillStyle = k === 1 ? '#3a2a00' : k === 0 ? '#14502d' : '#fff'; ctx.textAlign = 'center'; ctx.fillText(Math.round((v / tot) * 100) + '%', x + wd / 2, y + bh / 2 + 4); }
        x += wd;
      });
      ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.fillText(`매 단계 숲의 ${(st.burnPerStep * 100).toFixed(2)}% 탐`, m.l, y + bh + 15);
    });
    hLegend(ctx, names.map((label, k) => ({ label, color: cols[k] })), m.l, m.t + ph + 8, c.w - 24, true);
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const P = A.P;
    const cards = pre ? [
      ['큰 불이 태운 면적의 비중', `${pct0(pre.sA.bigShare)} → ${pct0(pre.sB.bigShare)}`, '숲의 10% 이상을 태운 불 · 그냥 두기 → 작은 불 끄기'],
      ['큰 불 횟수 (1만 단계당)', `${pre.sA.bigPer10k.toFixed(0)} → ${pre.sB.bigPer10k.toFixed(0)}`, `${pre.steps}단계를 돌려 센 값`],
      ['평균 나무 밀도', `${pct0(pre.sA.meanDens)} → ${pct0(pre.sB.meanDens)}`, '불을 끄면 연료(나무)가 더 쌓인다'],
      ['타는 면적(매 단계)', `${(pre.sA.burnPerStep * 100).toFixed(2)}% → ${(pre.sB.burnPerStep * 100).toFixed(2)}%`, '총량은 비슷하고, 나눠 타는 방식이 달라진다'],
    ] : [
      ['큰 불이 태운 면적의 비중', '계산 중…', ''], ['큰 불 횟수 (1만 단계당)', '계산 중…', ''], ['평균 나무 밀도', '계산 중…', ''], ['타는 면적(매 단계)', '계산 중…', ''],
    ];
    $('stats').innerHTML = cards.map(([k, v, s], i) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  // 3D 보기(app3d.js)가 같은 두 숲을 따라 그리도록 내보낸다 (3D는 따로 계산하지 않음)
  function share() { window.WildfireState = { A, B, thumb: THUMB }; }
  function draw() { share(); drawForest(); drawDens(); }

  // ---------- 오래 돌려서 통계 내기 (화면은 잠깐씩 쉬며) ----------
  function precompute(P) {
    const token = ++preToken; pre = null; renderStats(); drawSize(); drawArea();
    const warm = 2000, total = Math.min(60000, Math.max(14000, Math.round(4e8 / (P.n * P.n)))) + warm;
    const a = WF.create(Object.assign({}, P, { s: 0, seed: P.seed + 100 })), b = WF.create(Object.assign({}, P, { seed: P.seed + 100 }));
    (function chunk() {
      if (token !== preToken) return;
      const k = Math.min(1500, total - a.step);
      a.run(k); b.run(k);
      if (a.step < total) { setTimeout(chunk, 0); return; }
      const sA = WF.stats(a, warm, BIG), sB = WF.stats(b, warm, BIG), N = a.N, xs = [];
      for (let e = 0; e <= 40; e++) xs.push(Math.pow(N, e / 40));
      const cA = WF.ccdf(sA, N, xs), cB = WF.ccdf(sB, N, xs);
      pre = { sA, sB, N, xs, cA, cB, s: P.s, smallMax: b.smallMax, steps: sA.steps, ymax: Math.max(...cA, ...cB) };
      renderStats(); drawSize(); drawArea();
    })();
  }

  const h = L.harness({
    controls: ['p', 'f', 's', 'n'],
    format: { p: (v) => `${(v * 100).toFixed(1)}%`, f: (v) => `1만 칸당 ${v}번`, s: (v) => `${v}%`, n: (v) => `${v}×${v}칸` },
    defaults: { p: 0.01, f: 2, s: 90, n: 100 },
    build() {
      const P = params(); A = WF.create(Object.assign({}, P, { s: 0 })); B = WF.create(P);
      if (THUMB) { for (let k = 0; k < 3000; k++) { A.advance(); B.advance(); if (k > 500 && flames(B) > 0.12 * B.N) break; } }
    },
    autoplay: !THUMB,
    advance() { A.advance(); B.advance(); return true; },
    isDone() { return false; },
    draw, after() { precompute(params()); }, redrawExtra() { drawSize(); drawArea(); }, seedLabel: '숲 번호',
    speedScale: 1,
  });
  seedGetter = h.seed;
})();
