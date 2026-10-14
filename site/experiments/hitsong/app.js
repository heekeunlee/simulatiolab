(function () {
  'use strict';
  const H = window.Hitsong, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 듣는 사람이 모두 다녀간 끝 장면으로 바로 간다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0); // 확인용: ?t=기록 번호(0~80)로 바로 가서 멈춤
  const GOLD = '#e0a100', GOLD_D = '#9a6b00', BLUE = '#2f6fed', RED = '#d6457a', GRAY = '#8a93a6';
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const comma = (v) => Math.round(v).toLocaleString('en-US');
  let sim = null, statsAll = [], seedGetter = () => 1;
  let sweep = { key: '', data: [] }, sweepTimer = 0;
  const params = () => ({ seed: seedGetter(), s: Number($('s').value) / 100, spread: Number($('spread').value) / 100, N: Number($('N').value) });
  const MIN_STEP = 4; // 듣는 사람이 5%도 안 왔을 때는 1등을 말하기 이르다

  // 곡 색: 1번 곡(실력 1위)은 금색, 나머지는 실력이 좋을수록 진한 파랑
  const songColor = (k) => (k === 0 ? GOLD : mix(BLUE, 0.25 + 0.65 * Math.pow(1 - k / (sim.n - 1), 1.6)));

  // ---------- 이름표 ----------
  function chip(ctx, text, cx, cy, color) {
    ctx.font = '600 11.5px ' + FONT;
    const tw = ctx.measureText(text).width + 14, th = 20;
    ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.16)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#fff'; L.roundRect(ctx, cx, cy, tw, th, 10); ctx.fill(); ctx.restore();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; L.roundRect(ctx, cx, cy, tw, th, 10); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, cx + 7, cy + 14);
    return { tw, th };
  }

  // ---------- ① 세계 8개의 순위표 ----------
  function drawWorlds() {
    const cv = $('c-worlds'), cw = cv.clientWidth || 700, W = sim.W, s = sim.step;
    const cols = cw >= 640 ? 4 : 2, rowsW = Math.ceil(W / cols), gap = THUMB ? 12 : cw < 560 ? 8 : 12;
    const top = THUMB ? 0 : 30, NR = 5;
    const pw = (cw - gap * (cols - 1)) / cols;
    let head = cw < 560 ? 22 : 26, rowH = cw < 560 ? 21 : 24, ph = head + NR * rowH + 8;
    if (THUMB) { ph = (cw - gap * (rowsW - 1)) / rowsW; head = ph * 0.12; rowH = (ph - head - 10) / NR; }
    const Ht = top + rowsW * ph + (rowsW - 1) * gap + (THUMB ? 0 : 2);
    const { ctx, w } = L.setup(cv, Ht / cw);
    if (!THUMB) {
      ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 13px ' + FONT;
      ctx.fillText(`듣는 사람 ${comma(sim.listeners(s))} / ${comma(sim.P.N)}명`, 2, 18);
      const st = statsAll[s];
      if (s >= MIN_STEP) { ctx.textAlign = 'right'; ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.fillText(`서로 다른 1등 곡 ${st.distinct}가지`, w - 2, 18); }
    }
    let mx = 30; for (let wi = 0; wi < W; wi++) { const cc = sim.counts(s, wi); mx = Math.max(mx, cc[sim.chart(s, wi)[0]] * 1.12); } // 막대 눈금: 지금 8개 세계 중 가장 많이 받은 곡이 거의 끝까지 닿게
    for (let wi = 0; wi < W; wi++) {
      const px = (wi % cols) * (pw + gap), py = top + Math.floor(wi / cols) * (ph + gap);
      ctx.fillStyle = '#fff'; L.roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 10); ctx.fill();
      ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.stroke();
      const c = sim.counts(s, wi), ord = sim.chart(s, wi);
      const fs = THUMB ? Math.max(14, rowH * 0.42) : cw < 560 ? 11 : 12;
      if (!THUMB) { ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '700 12.5px ' + FONT; ctx.fillText(`세계 ${wi + 1}`, px + 9, py + head - 8); }
      const labW = THUMB ? 0 : cw < 560 ? 42 : 48, numW = THUMB ? 8 : cw < 560 ? 30 : 36;
      const bx = px + 8 + labW, bwMax = pw - 16 - labW - numW;
      for (let r = 0; r < NR; r++) {
        const k = ord[r], y = py + head + r * rowH, bh = rowH * (THUMB ? 0.72 : 0.62), by = y + (rowH - bh) / 2;
        const len = Math.max(c[k] > 0 ? 2 : 0, (c[k] / mx) * bwMax);
        ctx.fillStyle = 'rgba(99,106,122,.08)'; ctx.fillRect(bx, by, bwMax, bh);
        ctx.fillStyle = songColor(k); L.roundRect(ctx, bx, by, len, bh, Math.min(4, bh / 2)); if (len > 0) ctx.fill();
        if (THUMB) continue;
        ctx.font = (k === 0 ? '700 ' : '') + fs + 'px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = k === 0 ? GOLD_D : css('--text');
        ctx.fillText(`${k + 1}번 곡`, px + 8, by + bh / 2 + 4);
        ctx.fillStyle = css('--muted'); ctx.font = fs - 1 + 'px ' + FONT; ctx.fillText(String(c[k]), bx + len + 4, by + bh / 2 + 4);
      }
      // 지금 1등 곡에 이름표: 2등과 격차가 벌어진 뒤에만 (처음부터 정답을 붙이지 않는다)
      const k1 = ord[0], k2 = ord[1];
      if (!THUMB && s >= MIN_STEP * 2 && c[k1] >= 20 && c[k1] >= 1.3 * c[k2]) {
        const col = k1 === 0 ? GOLD_D : '#23408e', text = `1등 · 실력 ${k1 + 1}위`;
        ctx.font = '600 11.5px ' + FONT;
        const tw = ctx.measureText(text).width + 14, cx = px + pw - 8 - tw, cy = py + 4;
        const ex = bx + Math.max(2, (c[k1] / mx) * bwMax), ey = py + head + rowH * 0.19;
        const sx = Math.min(Math.max(ex, cx + 10), cx + tw - 10);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, cy + 20); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, 7); ctx.fill();
        chip(ctx, text, cx, cy, col);
      }
    }
    $('when').textContent = `듣는 사람 ${comma(sim.listeners(s))}명 · ${sim.done() ? '끝' : '고르는 중'}`;
  }

  // ---------- ② 곡의 실력과 다운로드 수 ----------
  function niceTop(v) { const m = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))), r = v / m; return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => r <= x + 1e-9)) * m; }
  function drawScatter() {
    const cv = $('c-scatter'), mobile = (cv.clientWidth || 600) < 560, s = sim.step, n = sim.n, now = sim.listeners(s);
    const items = [{ kind: 'dot', color: mix(BLUE, 0.55), label: '곡 하나 (세계마다 점 하나)' }, { kind: 'dot', color: GOLD, label: '그 세계의 지금 1등 곡' }, { kind: 'dash', color: GRAY, label: '순위표를 안 볼 때 기대되는 수' }];
    const sp = L.belowSpace(cv, items);
    const c = L.chart(cv, (mobile ? 0.9 : 0.62) + sp.extra / (cv.clientWidth || 400), { l: 46, r: 14, t: 24, b: sp.b }), { ctx, m, pw, ph } = c;
    const y1 = niceTop(sim.maxCount * 1.05), X = (v) => m.l + ((v - 0.5) / n) * pw, Y = (v) => m.t + ph - (v / y1) * ph;
    const yt = []; for (let i = 0; i <= 4; i++) yt.push((y1 * i) / 4);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => comma(v), xTicks: [1, 8, 16, 24, 32, 40, 48].filter((v) => v <= n), xFmt: (v) => String(v), xLabel: '곡 번호 = 실력 순위 (번)', yLabel: '다운로드 수 (회)' });
    // 순위표를 보지 않을 때의 기댓값: 지금까지 온 사람 × (1/곡 수) × 매력
    ctx.setLineDash([5, 4]); L.line(ctx, sim.ap.map((a, k) => [X(k + 1), Y((now * a) / n)]), GRAY, 2); ctx.setLineDash([]);
    const lead = new Set();
    for (let wi = 0; wi < sim.W; wi++) {
      const cc = sim.counts(s, wi), L1 = sim.chart(s, wi)[0];
      ctx.fillStyle = mix(BLUE, 0.4);
      for (let k = 0; k < n; k++) { if (s >= MIN_STEP && k === L1) continue; const jx = ((wi + 0.5) / sim.W - 0.5) * (pw / n) * 0.8; ctx.beginPath(); ctx.arc(X(k + 1) + jx, Y(cc[k]), mobile ? 2.4 : 3, 0, 7); ctx.fill(); }
      if (s >= MIN_STEP) lead.add([L1, cc[L1], wi]);
    }
    lead.forEach(([k, v, wi]) => { const jx = ((wi + 0.5) / sim.W - 0.5) * (pw / n) * 0.8; ctx.fillStyle = GOLD; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(k + 1) + jx, Y(v), mobile ? 4.5 : 5.5, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1; });
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 듣는 사람이 늘어날수록: 1등 곡이 몇 가지인가 ----------
  function drawTime() {
    const cv = $('c-time'), mobile = (cv.clientWidth || 600) < 560, s = sim.step, W = sim.W;
    const items = [{ kind: 'line', color: RED, label: '서로 다른 1등 곡 수' }, { kind: 'line', color: GOLD, label: '1번 곡이 1등인 세계 수' }];
    const sp = L.belowSpace(cv, items);
    const c = L.chart(cv, (mobile ? 0.85 : 0.62) + sp.extra / (cv.clientWidth || 400), { l: 40, r: 30, t: 24, b: sp.b }), { ctx, m, pw, ph } = c;
    const N = sim.P.N, X = (v) => m.l + (v / N) * pw, Y = (v) => m.t + ph - (v / W) * ph;
    const xt = []; for (let i = 0; i <= 4; i++) xt.push((N * i) / 4);
    L.axes(c, { X, Y, yTicks: [0, 2, 4, 6, 8].filter((v) => v <= W), yFmt: (v) => String(v), xTicks: xt, xFmt: (v) => comma(v), xLabel: '지금까지 온 사람 (명)', yLabel: '개수 (개)' });
    const ser = (f) => { const pts = []; for (let k = MIN_STEP; k <= s; k++) pts.push([X(sim.listeners(k)), Y(f(statsAll[k]))]); return pts; };
    const a = ser((t) => t.distinct), b = ser((t) => t.bestWins);
    L.line(ctx, b, GOLD, 3); L.line(ctx, a, RED, 3);
    if (s >= MIN_STEP) [[a, RED], [b, GOLD]].forEach(([p, col]) => { const q = p[p.length - 1]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, items);
  }

  // ---------- ④ 남의 선택을 보는 정도별 비교 (집계) ----------
  const S_GRID = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], REPS = 160;
  function drawSweep() {
    const cv = $('c-sweep'), mobile = (cv.clientWidth || 600) < 560;
    const items = [{ kind: 'line', color: GOLD, label: '1번 곡이 1등이 된 세계의 비율' }, { kind: 'line', color: BLUE, label: '1등 곡이 가져간 몫 (평균)' }];
    const sp = L.belowSpace(cv, items);
    const c = L.chart(cv, (mobile ? 0.85 : 0.62) + sp.extra / (cv.clientWidth || 400), { l: 44, r: 16, t: 24, b: sp.b }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v / 100) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => Math.round(v * 100) + '%', xTicks: [0, 20, 40, 60, 80, 100], xFmt: (v) => v + '%', xLabel: '남의 선택을 보는 정도 (%)', yLabel: '비율 (%)' });
    const d = sweep.data;
    [[GOLD, (r) => r.bestWin], [BLUE, (r) => r.topShare]].forEach(([col, f]) => {
      L.line(ctx, d.map((r) => [X(r.s), Y(f(r))]), col, 2.6);
      ctx.fillStyle = col; d.forEach((r) => { ctx.beginPath(); ctx.arc(X(r.s), Y(f(r)), 3.6, 0, 7); ctx.fill(); });
    });
    if (d.length < S_GRID.length) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.font = '12px ' + FONT; ctx.fillText('계산 중…', m.l + pw / 2, m.t + ph / 2); }
    const cur = Number($('s').value); L.vline(c, X(cur), css('--rich'), '지금 설정', cur > 60 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }
  function startSweep() {
    const P = params(), key = [P.spread, P.N].join('|');
    if (THUMB) return;
    if (sweep.key === key && sweep.data.length === S_GRID.length) { drawSweep(); return; }
    sweep = { key, data: [] }; drawSweep();
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(() => L.jobs(S_GRID.map((sv) => () => { const r = H.aggregate({ s: sv / 100, spread: P.spread, N: P.N }, REPS, 101 + sv); r.s = sv; sweep.data.push(r); }), () => drawSweep(), () => drawSweep()), 600);
  }

  // ---------- 숫자 카드 ----------
  function renderStats() {
    const s = sim.step, st = statsAll[s], ok = s >= MIN_STEP, W = sim.W;
    const ranks = ok ? [...new Set(st.leaders)].sort((a, b) => a - b).map((k) => k + 1).join(', ') : '';
    const cards = [
      ['실력 1위 곡(1번)이 1등인 세계', ok ? `${st.bestWins}/${W}곳` : '', `세계 ${W}개 중`],
      ['세계마다 1등 곡이 몇 가지인가', ok ? `${st.distinct}가지` : '', ok ? `1등 곡의 실력 순위: ${ranks}위` : ''],
      ['1등 곡이 가져간 몫', ok ? `${Math.round(st.topShare * 100)}%` : '', `${W}개 세계 평균 · 곡마다 똑같이 나누면 ${(100 / sim.n).toFixed(1)}%`],
      ['쏠림 정도 (지니 계수)', ok ? st.gini.toFixed(2) : '', '0이면 고르게, 1에 가까우면 한 곡이 독차지'],
    ];
    $('stats').classList.toggle('live', !sim.done());
    $('stats').innerHTML = cards.map(([k, v, sub]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join('');
  }

  function drawCharts() { drawScatter(); drawTime(); renderStats(); }
  function draw() { drawWorlds(); drawCharts(); }

  const h = L.harness({
    controls: ['s', 'spread', 'N'],
    format: { s: (v) => v + '%', spread: (v) => `90% vs ${90 - Number(v)}%`, N: (v) => comma(v) + '명' },
    defaults: { s: 60, spread: 70, N: 10000 },
    build() {
      sim = H.create(params());
      statsAll = []; for (let k = 0; k <= sim.S; k++) statsAll.push(sim.stats(k));
      if (THUMB) sim.run(); else if (JUMP) while (sim.step < JUMP && sim.advance());
    },
    autoplay: !THUMB && !JUMP,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after() { startSweep(); }, redrawExtra() { drawSweep(); }, seedLabel: '실험',
  });
  seedGetter = h.seed;
})();
