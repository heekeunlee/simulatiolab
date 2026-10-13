(function () {
  'use strict';
  const RV = window.Revolution, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, sweep = [];
  let seedGetter = () => 1, finalRounds = 10;
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 썸네일용: 불씨가 반쯤 번진 장면에서 멈춘다
  const params = () => ({
    seed: seedGetter(), mode: $('mode').value,
    mean: Number($('mean').value) / 100, spread: Number($('spread').value) / 100, radicals: Number($('radicals').value) / 100,
  });

  // 나선 라운드: 일찍(노랑) → 늦게(진한 빨강)
  // 색 눈금은 끝까지 돌렸을 때의 라운드 수로 고정한다 (진행 중에 앞서 나온 사람의 색이 바뀌지 않게)
  function rcolor(r) {
    const t = Math.min(1, r / Math.max(4, finalRounds - 1));
    const A = [255, 200, 50], B = [245, 120, 40], C = [180, 20, 55];   // 노랑 → 주황 → 진한 빨강
    const [a, b, u] = t < 0.5 ? [A, B, t * 2] : [B, C, t * 2 - 1];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`;
  }

  function drawCrowd() {
    const cv = $('c-crowd'), narrow = (cv.clientWidth || 400) < 560;
    const c = L.chart(cv, THUMB ? 1 : narrow ? 1.05 : 0.62, { l: 8, r: 8, t: 8, b: 26 });
    const { ctx, w, h } = c, n = sim.n;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    // 문턱이 낮은 사람부터 왼쪽 위에서 오른쪽 아래로 늘어놓는다
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => sim.threshold[a] - sim.threshold[b]);
    const cols = narrow || THUMB ? Math.round(Math.sqrt(n * (w - 16) / (h - 34))) : n <= 100 ? 20 : 40, rows = Math.ceil(n / cols);
    const cw = (w - 16) / cols, ch = (h - 34) / rows, r = Math.min(cw, ch) * 0.36;
    const last = sim.round - 1;
    order.forEach((i, k) => {
      const x = 8 + (k % cols) * cw + cw / 2, y = 8 + Math.floor(k / cols) * ch + ch / 2;
      if (sim.out[i]) {
        if (sim.joinedAt[i] === last && last > 0 && !sim.done && !THUMB) { ctx.fillStyle = 'rgba(229,72,77,.22)'; ctx.beginPath(); ctx.arc(x, y, r * 1.75, 0, 7); ctx.fill(); }
        ctx.fillStyle = rcolor(sim.joinedAt[i]); ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, 7); ctx.fill();
      } else { ctx.fillStyle = '#c7cedd'; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, 7); ctx.fill(); }
      if (sim.threshold[i] === 0) { ctx.strokeStyle = css('--text'); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r * 1.55, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    });
    if (!THUMB) {
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('문턱이 낮은 사람 →', 10, h - 8);
      ctx.textAlign = 'right'; ctx.fillText('→ 문턱이 높은 사람', w - 10, h - 8);
    }
    const cnt = sim.out.reduce((a, b) => a + b, 0);
    $('when').textContent = `${sim.round}라운드 · 광장에 나온 사람 ${pct(cnt / n)}`;
  }

  function drawCdf() {
    const c = L.chart($('c-cdf'), 0.85, { l: 46, b: 40 });
    const { ctx, m, pw, ph } = c;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - v * ph, tk = [0, 0.25, 0.5, 0.75, 1];
    L.axes(c, { X, Y, yTicks: tk, yFmt: pct, xTicks: tk, xFmt: pct, xLabel: '지금 광장에 나온 사람 (%)', yLabel: '다음에 나설 사람 (%)' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
    const pts = []; for (let i = 0; i <= 200; i++) { const x = i / 200; pts.push([X(x), Y(sim.cdf(x))]); }
    L.line(ctx, pts, css('--accent'), 2.5);
    // 계단 경로: (s,s) → (s, F(s)) → (F(s), F(s))
    const H = sim.history; ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    for (let k = 0; k + 1 < H.length; k++) { ctx.lineTo(X(H[k]), Y(H[k + 1])); ctx.lineTo(X(H[k + 1]), Y(H[k + 1])); }
    ctx.stroke(); ctx.lineWidth = 1;
    const s = H[H.length - 1]; ctx.fillStyle = css('--unlucky'); ctx.beginPath(); ctx.arc(X(s), Y(s), 5, 0, 7); ctx.fill();
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '다음에 나설 사람의 비율' }, { kind: 'dash', color: css('--muted'), label: 'y = x (더 늘지 않는 선)' }, { kind: 'line', color: css('--unlucky'), label: '실제 진행 경로' }], 'br');
  }

  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = Math.max(H.length - 1, 8);
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += Math.max(1, Math.ceil(T / 6))) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (t) => String(t), xLabel: '라운드 (회)', yLabel: '광장에 나온 사람 (%)' });
    L.line(ctx, H.map((v, t) => [X(t), Y(v)]), css('--unlucky'), 2.5);
    const last = H.length - 1; ctx.fillStyle = css('--unlucky'); ctx.beginPath(); ctx.arc(X(last), Y(H[last]), 4.5, 0, 7); ctx.fill();
  }

  function drawSweep() {
    L.dots($('c-sweep'), {
      data: sweep.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      series: [{ data: sweep.map((d) => ({ x: d.x, runs: [], mean: 0 })), color: '#8a93a6' }],
      x0: 0.05, x1: 0.6, xTicks: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xFmt: pct, xLabel: '평균 문턱 (%)', yLabel: '끝난 뒤 나온 사람 (%)',
      legend: [{ kind: 'line', color: css('--accent'), label: '지금 설정' }, { kind: 'line', color: '#8a93a6', label: '선동가가 없을 때' }], legendPos: 'tr',
      marker: { x: sim.params.mean },
    });
  }

  function renderStats() {
    const cnt = sim.out.reduce((a, b) => a + b, 0), s = cnt / sim.n;
    const result = !sim.done ? '진행 중' : s >= 0.5 ? '대규모 참여' : s > 0 ? '작은 모임에서 멈춤' : '아무도 나서지 않음';
    const cards = [
      ['광장에 나온 사람', `${cnt}명`, `전체 ${sim.n}명 중 ${pct(s)}`],
      ['처음부터 나선 사람 (선동가)', `${sim.nRad}명`, '문턱이 0인 사람'],
      ['지난 라운드', `${sim.round}회`, sim.done ? '끝' : '진행 중'],
      ['결과', result, '더는 늘지 않으면 끝나요'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawCrowd(); drawCdf(); drawTime(); }

  function after() {
    const P = params(); sweep = []; drawSweep();
    const xs = []; for (let m = 5; m <= 60; m += 5) xs.push(m / 100);
    L.jobs(xs.map((m) => () => {
      sweep.push({ x: m, runs: RV.finalShare({ mode: 'normal', mean: m, spread: P.spread, radicals: P.radicals }, 6) });
    }), drawSweep, drawSweep);
  }

  const h = L.harness({
    controls: ['mode', 'mean', 'spread', 'radicals'],
    format: { mode: () => '', mean: (v) => v + '%', spread: (v) => v + '%', radicals: (v) => v + '%' },
    defaults: { mode: 'normal', mean: 20, spread: 15, radicals: 1 },
    build() {
      sim = RV.create(params()); finalRounds = RV.create(params()).run().round;
      if (THUMB) { const goal = RV.create(params()).run().share() * 0.4; while (!sim.done && sim.share() < goal) sim.advance(); }
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '광장 번호',
  });
  seedGetter = h.seed;
})();
