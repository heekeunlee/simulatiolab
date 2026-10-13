(function () {
  'use strict';
  const DT = window.Dating, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 시장이 끝난 뒤의 커플 선
  let sim = null, sweep = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), eye: Number($('eye').value) / 100, drift: Number($('drift').value) / 100, rounds: Number($('rounds').value) });

  // 만난 시점: 일찍(파랑) → 중간(자주) → 늦게(주황). 두 색을 바로 섞으면 가운데가 탁한 회색이 되어 자주색을 거쳐 간다
  function tcolor(round, total) {
    const t = Math.min(1, (round - 1) / Math.max(1, total - 1));
    const st = [[47, 111, 237], [176, 76, 196], [245, 158, 66]], k = t < 0.5 ? 0 : 1, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgb(${st[k].map((v, i) => Math.round(v + (st[k + 1][i] - v) * u)).join(',')})`;
  }

  // 범례를 놓을 구석 고르기: 점들 [x, y]이 가장 적게 겹치는 곳
  function pickPos(c, pts, n) {
    const bw = 190, bh = n * 16 + 9, m = c.m; let best = 'tr', bc = 1e9;
    ['tr', 'tl', 'br', 'bl'].forEach((p) => {
      const x0 = p[1] === 'l' ? m.l + 6 : m.l + c.pw - bw - 6, y0 = p[0] === 'b' ? m.t + c.ph - bh - 6 : m.t + 6;
      const cnt = pts.filter(([x, y]) => x >= x0 - 4 && x <= x0 + bw + 4 && y >= y0 - 4 && y <= y0 + bh + 4).length;
      if (cnt < bc) { bc = cnt; best = p; }
    });
    return best;
  }
  // 같은 높이(매력)의 점이 겹치지 않도록 사람마다 정해진 가로 흔들림을 준다
  const jit = (i, side) => (((i * 0.6180339 + side * 0.37) % 1) - 0.5);
  function drawMarket() {
    const cw = $('c-market').clientWidth || 600, c = L.chart($('c-market'), THUMB ? 1 : cw < 560 ? 1.05 : 0.72, THUMB ? { l: 10, r: 10, t: 34, b: 24 } : { l: 10, r: 10, t: 50, b: 84 });
    const { ctx, w, h, m, ph } = c, n = sim.n, R = sim.params.rounds;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const band = Math.min(110, w * 0.13), xl = w * 0.2, xr = w * 0.8, Y = (a) => m.t + (1 - a) * ph;
    const XA = (i) => xl + jit(i, 0) * band, XB = (i) => xr + jit(i, 1) * band;
    // 띠 배경과 눈금
    ctx.fillStyle = 'rgba(47,111,237,0.05)'; [xl, xr].forEach((x) => ctx.fillRect(x - band / 2 - 8, m.t - 6, band + 16, ph + 12));
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'center';
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(xl + band / 2 + 10, Y(v)); ctx.lineTo(xr - band / 2 - 10, Y(v)); ctx.stroke(); ctx.setLineDash([]); if (!THUMB) ctx.fillText(pct(v), w / 2, Y(v) - 3); });
    ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText('A 집단', xl, 20); ctx.fillText('B 집단', xr, 20);
    if (!THUMB) L.axisNames(c, '', '매력 (%, 위쪽일수록 높음)');
    ctx.lineWidth = THUMB ? 2.4 : 1.1;
    for (let i = 0; i < n; i++) if (sim.mA[i] >= 0) {
      ctx.strokeStyle = tcolor(sim.wA[i], R); ctx.globalAlpha = THUMB ? 0.5 : 0.42; ctx.beginPath(); ctx.moveTo(XA(i), Y(sim.a[i])); ctx.lineTo(XB(sim.mA[i]), Y(sim.b[sim.mA[i]])); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const r = THUMB ? 5.5 : w < 500 ? 2.6 : 3.4;
    const dot = (x, y, col) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
      if (col) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = '#8f99ad'; ctx.lineWidth = 1.2; ctx.stroke(); }
    };
    for (let i = 0; i < n; i++) {
      dot(XA(i), Y(sim.a[i]), sim.mA[i] >= 0 ? tcolor(sim.wA[i], R) : null);
      dot(XB(i), Y(sim.b[i]), sim.mB[i] >= 0 ? tcolor(sim.wB[i], R) : null);
    }
    ctx.lineWidth = 1;
    if (!THUMB) L.legend(Object.assign({}, c, { m: Object.assign({}, m, { t: h - 84 }), ph: 84 }), [
      { kind: 'dot', color: tcolor(1, R), label: '일찍 짝을 찾음' }, { kind: 'dot', color: tcolor((R + 1) / 2, R), label: '중간에 짝을 찾음' },
      { kind: 'dot', color: tcolor(R, R), label: '늦게 짝을 찾음' }, { kind: 'dot', color: '#8f99ad', label: '아직 혼자 (속이 빈 점)' }], 'tl');
    const s = sim.stats();
    $('when').textContent = `${sim.round}/${R} 라운드 · 짝 ${pct(s.matched)}`;
  }

  function drawCouples() {
    const c = L.chart($('c-couples'), 0.85, { l: 40, b: 40 });
    const { ctx, m, pw, ph } = c, n = sim.n, R = sim.params.rounds;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - v * ph, tk = [0, 0.25, 0.5, 0.75, 1];
    L.axes(c, { X, Y, yTicks: tk, yFmt: (v) => String(Math.round(v * 100)), xTicks: tk, xFmt: (v) => String(Math.round(v * 100)), xLabel: 'A의 매력 (%)', yLabel: '짝이 된 B의 매력 (%)' });
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < n; i++) {
      if (sim.mA[i] >= 0) { ctx.fillStyle = mix('#2f6fed', 0.0) && tcolor(sim.wA[i], R); ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(X(sim.a[i]), Y(sim.b[sim.mA[i]]), 3.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      else { ctx.strokeStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(X(sim.a[i]), Y(0) + 2); ctx.lineTo(X(sim.a[i]), Y(0) + 8); ctx.stroke(); }
      if (sim.mB[i] < 0) { ctx.strokeStyle = '#9aa3b5'; ctx.beginPath(); ctx.moveTo(m.l - 2, Y(sim.b[i])); ctx.lineTo(m.l - 8, Y(sim.b[i])); ctx.stroke(); }
    }
    const pts = [], dots = []; for (let q = 0; q <= 1; q += 0.1) pts.push([X(q), Y(q)]);
    for (let i = 0; i < n; i++) if (sim.mA[i] >= 0) pts.push([X(sim.a[i]), Y(sim.b[sim.mA[i]])]);
    L.legend(c, [{ kind: 'dash', color: css('--muted'), label: '대각선: 서로 매력이 같음' }, { kind: 'dot', color: tcolor(1, R), label: '일찍 맺어진 커플' }, { kind: 'dot', color: tcolor(R, R), label: '늦게 맺어진 커플' }], pickPos(c, pts, 3));
  }

  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.rounds;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => String(Math.round(v * 100)), xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '라운드 (번)', yLabel: '짝을 찾은 사람 (%)' });
    L.line(ctx, H.map((v, t) => [X(t), Y(v)]), css('--accent'), 2.5);
    const last = H.length - 1; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(H[last]), 4.5, 0, 7); ctx.fill();
  }

  function drawSweep() {
    const c = L.dots($('c-sweep'), {
      data: sweep.map((d) => ({ x: d.x, runs: d.matched, mean: L.mean(d.matched) })),
      series: [{ data: sweep.map((d) => ({ x: d.x, runs: d.wait, mean: L.mean(d.wait) })), color: css('--rich') }],
      x0: -0.3, x1: 0.4, xTicks: [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4], xFmt: (v) => (v > 0 ? '+' : '') + Math.round(v * 100), xLabel: '눈높이 (내 매력 대비 %p)',
      marker: { x: sim.params.eye }, yFmt: (v) => String(Math.round(v * 100)), yLabel: '비율 (%)',
    });
    const lc = Object.assign({}, c, { m: Object.assign({}, c.m, { t: c.m.t + 20 }), ph: c.ph - 20 }), pts = [];
    sweep.forEach((d) => { const x = c.m.l + ((d.x + 0.3) / 0.7) * c.pw; pts.push([x, c.m.t + c.ph - L.mean(d.matched) * c.ph], [x, c.m.t + c.ph - L.mean(d.wait) * c.ph]); });
    L.legend(lc, [{ kind: 'line', color: css('--accent'), label: '짝을 찾은 사람의 비율' }, { kind: 'line', color: css('--rich'), label: '짝 찾기까지 걸린 시간 (전체 기간 대비)' }], pickPos(lc, pts, 2));
  }

  function renderStats() {
    const s = sim.stats();
    const cards = [
      ['짝을 찾은 사람', pct(s.matched), `${sim.n * 2}명 중 ${Math.round(s.matched * sim.n * 2)}명`],
      ['평균 걸린 시간', s.meanWait ? s.meanWait.toFixed(1) + '라운드' : '-', '짝을 찾은 사람 기준'],
      ['아직 혼자인 사람', s.lone + '명', `매력 상위 20% ${s.loneHi}명, 하위 20% ${s.loneLo}명`],
      ['커플의 매력 차이', s.meanDiff ? (s.meanDiff * 100).toFixed(0) + '%p' : '-', '작을수록 비슷한 사람끼리'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawMarket(); drawCouples(); drawTime(); }

  function after() {
    const P = params(); sweep = []; drawSweep();
    const xs = []; for (let e = -30; e <= 40; e += 5) xs.push(e / 100);
    L.jobs(xs.map((e) => () => {
      const r = DT.measure({ eye: e, drift: P.drift, rounds: P.rounds }, 5);
      sweep.push({ x: e, matched: r.map((s) => s.matched), wait: r.map((s) => s.meanWait / P.rounds) });
    }), drawSweep);
  }

  const h = L.harness({
    controls: ['eye', 'drift', 'rounds'],
    format: { eye: (v) => (Number(v) > 0 ? '+' : '') + v + '%p', drift: (v) => v + '%p', rounds: (v) => v + '라운드' },
    defaults: { eye: 10, drift: 0.5, rounds: 50 },
    build() { sim = DT.create(params()); if (THUMB) sim.run(); },
    autoplay: !THUMB, speedScale: 0.5, // 20라운드쯤에 짝이 한꺼번에 생겨서, 그 순간을 따라갈 수 있게 보통 속도를 초당 4라운드로
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawSweep, seedLabel: '시장 번호',
  });
  seedGetter = h.seed;
})();
