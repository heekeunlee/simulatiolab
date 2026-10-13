(function () {
  'use strict';
  const S = window.Seating, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const GREEN = '#1fa463', RED = '#e5484d', GRAY = '#8a93a6';
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 모든 줄이 꽉 막힌 장면으로 바로 간다
  const RULE_COLORS = () => [css('--accent'), '#7c5cff', '#e0a100', GREEN];
  const RULE_NAMES = ['무작위로 앉기', '가장 먼 자리로', '끝자리 먼저', '정돈해서 앉기'];
  const RULE_SHORT = ['무작위', '가장 먼 자리', '끝자리 먼저', '정돈'];
  let sim = null, seedGetter = () => 1;
  let stats = null; // 규칙별 평균 (이번 설정)
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), g: Number($('g').value), arrivals: Number($('arrivals').value) });
  const f1 = (v) => v.toFixed(1);
  const pct = (v) => (v * 100).toFixed(1) + '%';

  // ---------- 벤치 그리기 ----------
  function person(ctx, cx, y, sw, rh, color) {
    const r = Math.max(2, Math.min(sw * 0.3, rh * 0.2));
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, y + rh * 0.3, r, 0, 7); ctx.fill();
    const bw = Math.min(sw * 0.72, rh * 0.8);
    L.roundRect(ctx, cx - bw / 2, y + rh * 0.3 + r + 1, bw, rh * 0.7 - r - 4, Math.min(5, bw / 2)); ctx.fill();
  }
  // occ: 앉은 자리, hl: 강조할 자리, hover: {i, ok}
  function bench(ctx, x0, y, pw, rh, occ, n, g, color, hl, hover, by) {
    const sw = pw / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * sw, dead = !occ[i] && !S.canSit(occ, n, g, i);
      ctx.fillStyle = occ[i] ? mix(color, 0.12) : dead ? mix(RED, 0.13) : css('--surface');
      ctx.strokeStyle = occ[i] ? mix(color, 0.5) : dead ? mix(RED, 0.35) : css('--line');
      L.roundRect(ctx, x + 1, y, Math.max(2, sw - 2), rh, Math.min(4, sw / 3)); ctx.fill(); ctx.stroke();
      if (occ[i]) person(ctx, x + sw / 2, y, sw, rh, by ? (by[i] === 1 ? css('--rich') : color) : color);
      else if (dead && sw >= 9) { // 앉을 수 없는 빈 자리 표시
        ctx.strokeStyle = mix(RED, 0.5); ctx.lineWidth = 1.5; const c = x + sw / 2, d = Math.min(sw * 0.2, 4), m = y + rh / 2;
        ctx.beginPath(); ctx.moveTo(c - d, m - d); ctx.lineTo(c + d, m + d); ctx.moveTo(c + d, m - d); ctx.lineTo(c - d, m + d); ctx.stroke(); ctx.lineWidth = 1;
      }
    }
    if (hl >= 0) { ctx.strokeStyle = color; ctx.lineWidth = 2.5; L.roundRect(ctx, x0 + hl * sw + 0.5, y - 1.5, Math.max(2, sw - 1), rh + 3, Math.min(5, sw / 3)); ctx.stroke(); ctx.lineWidth = 1; }
    if (hover && hover.i >= 0 && !occ[hover.i]) { // 마우스를 올린 자리 미리보기
      ctx.fillStyle = mix(hover.ok ? GREEN : RED, 0.28); L.roundRect(ctx, x0 + hover.i * sw + 1, y, Math.max(2, sw - 2), rh, Math.min(4, sw / 3)); ctx.fill();
    }
  }

  // ---------- ① 네 가지 앉는 방식 ----------
  function drawRows() {
    const cw = $('c-rows').clientWidth || 600, P = sim.params, n = P.n, pad = 10;
    const pw = cw - pad * 2, sw = pw / n, rh = Math.max(20, Math.min(46, sw * 1.35)), lh = 24, gap = 12;
    const legH = THUMB ? 0 : 64, H = pad + 4 * (lh + rh + gap) + legH;
    const c = L.chart($('c-rows'), H / cw, { l: pad, r: pad, t: 0, b: 0 }), { ctx } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, c.w, c.h);
    const cols = RULE_COLORS();
    sim.rows.forEach((r, k) => {
      const y0 = pad + k * (lh + rh + gap);
      if (!THUMB) {
        ctx.font = '600 13px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.fillText(RULE_NAMES[k], pad, y0 + 14);
        ctx.font = '12px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = css('--muted');
        ctx.fillText(`앉은 ${r.seated}명 · 돌려보냄 ${r.turned}명`, c.w - pad, y0 + 14);
      }
      bench(ctx, pad, y0 + lh, pw, rh, r.occ, n, P.g, cols[k], r.last);
    });
    if (!THUMB) L.legend({ ctx, w: c.w, m: { l: pad, t: 0, r: pad, b: 0 }, pw, ph: c.h - 6 }, [{ kind: 'box', color: css('--accent'), label: '앉은 사람' }, { kind: 'box', color: mix(RED, 0.5), label: '앉을 수 없는 빈 자리 (×)' }, { kind: 'box', color: '#cfd6e4', label: '앉을 수 있는 빈 자리' }], 'bl');
    $('when').textContent = `${sim.t}/${P.arrivals}번째 도착`;
  }

  // ---------- ② 직접 앉혀 보기 ----------
  let man = null, hover = { i: -1, ok: false }, manTimer = 0;
  const manMsg = (t) => { $('m-msg').textContent = t; };
  function manReset() {
    clearInterval(manTimer);
    const P = sim.params;
    man = { occ: new Uint8Array(P.n), by: new Uint8Array(P.n), placed: 0, rand: 0, turned: 0, remain: P.arrivals, filling: false, done: false, rng: S.mulberry32(P.seed * 31 + 5) };
    manStatus();
  }
  function manStatus() {
    const P = sim.params;
    if (man.done) {
      const tot = man.placed + man.rand;
      manMsg(`끝! 모두 ${tot}명이 앉았고 ${man.turned}명은 돌아갔습니다. 정돈했다면 ${sim.cap}명, 무작위로만 앉으면 평균 ${f1(stats.mean[0])}명이었습니다.`);
    } else if (man.filling) manMsg(`나머지 ${man.remain}명이 무작위로 들어오는 중…`);
    else if (P.g === 0) manMsg(`직접 앉힌 ${man.placed}명, 앞으로 도착할 사람 ${man.remain}명. 자리를 눌러 앉혀 보세요 (칸을 비울 필요는 없습니다).`);
    else manMsg(`직접 앉힌 ${man.placed}명, 앞으로 도착할 사람 ${man.remain}명. 자리를 눌러 앉혀 보세요 (앉은 사람 양옆 ${P.g}칸은 비워 둡니다).`);
    $('m-go').disabled = man.filling || man.done;
  }
  function drawMan() {
    const cw = $('c-play').clientWidth || 600, P = sim.params, pad = 10, pw = cw - pad * 2, sw = pw / P.n;
    const rh = Math.max(40, Math.min(70, sw * 1.9));
    const c = L.chart($('c-play'), (rh + pad * 2 + 18) / cw, { l: pad, r: pad, t: 0, b: 0 }), { ctx } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, c.w, c.h);
    bench(ctx, pad, pad, pw, rh, man.occ, P.n, P.g, css('--accent'), -1, man.filling || man.done ? null : hover, man.by);
    ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    if (!THUMB) { ctx.fillText('1', pad + sw / 2, pad + rh + 14); ctx.fillText(String(P.n), pad + pw - sw / 2, pad + rh + 14); }
  }
  function seatAt(ev) {
    const r = $('c-play').getBoundingClientRect(), pad = 10, pw = r.width - pad * 2;
    return Math.floor(((ev.clientX - r.left - pad) / pw) * sim.params.n);
  }
  function startFill() {
    if (man.filling || man.done) return;
    man.filling = true; manStatus(); drawMan();
    manTimer = setInterval(() => {
      const P = sim.params;
      if (man.remain <= 0) { finishFill(); return; }
      const i = S.pickRandom(man.occ, P.n, P.g, man.rng);
      if (i < 0) { man.turned += man.remain; man.remain = 0; } // 더는 앉을 곳이 없으니 남은 사람은 모두 돌아간다
      else { man.occ[i] = 1; man.by[i] = 2; man.rand++; man.remain--; }
      if (man.remain <= 0) finishFill(); else manStatus();
      drawMan();
    }, 160);
  }
  function finishFill() { clearInterval(manTimer); man.filling = false; man.done = true; manStatus(); drawMan(); }
  function manClick(ev) {
    if (!man || man.filling || man.done) return;
    const i = seatAt(ev), P = sim.params;
    if (i < 0 || i >= P.n || man.occ[i]) return;
    if (!S.canSit(man.occ, P.n, P.g, i)) { manMsg(P.g === 0 ? '이미 누가 앉은 자리입니다.' : `그 자리는 앉은 사람과 너무 가깝습니다 (양옆 ${P.g}칸은 비워 둬야 해요).`); return; }
    man.occ[i] = 1; man.by[i] = 1; man.placed++; man.remain--;
    if (man.remain <= 0) { man.done = true; manStatus(); } else manStatus();
    drawMan();
  }
  function manMove(ev) {
    if (!man || man.filling || man.done) return;
    const i = seatAt(ev), P = sim.params;
    const h = { i: i >= 0 && i < P.n ? i : -1, ok: i >= 0 && i < P.n && S.canSit(man.occ, P.n, P.g, i) };
    if (h.i !== hover.i || h.ok !== hover.ok) { hover = h; drawMan(); }
  }

  // ---------- 차트 공통 ----------
  const NMAX = 200, NGRID = [5, 10, 15, 20, 30, 40, 60, 80, 120, 160, 200];
  let curve = null;
  function computeCurve() {
    const P = sim.params, ex = S.exact(NMAX, P.g);
    curve = { ex, theta: S.theta(P.g), pts: NGRID.map((n) => ({ n, v: S.meanFill('random', n, P.g, 150, 21 + n).mean / n })) };
  }
  function drawN() {
    const P = sim.params, g = P.g, c = L.chart($('c-n'), 0.62, { l: 50, b: 40, r: 16, t: 24 }), { ctx, m, pw, ph } = c;
    const x0 = 4, x1 = NMAX, th = curve.theta;
    let ymax = 0; for (let n = x0; n <= x1; n++) ymax = Math.max(ymax, S.cap(n, g) / n);
    const y0 = Math.max(0, Math.floor((th - 0.08) * 20) / 20), y1 = Math.min(1, Math.ceil((ymax + 0.02) * 20) / 20);
    const X = (v) => m.l + ((v - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph, yt = [];
    for (let v = y0; v <= y1 + 1e-9; v += y1 - y0 > 0.5 ? 0.1 : 0.05) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => Math.round(v * 100) + '%', xTicks: [0, 50, 100, 150, 200].filter((v) => v >= x0 || v === 0), xFmt: (v) => String(v), xLabel: '자리 수 (석)', yLabel: '앉은 비율 (%)' });
    const line = (fn, color, w) => { const pts = []; for (let n = x0; n <= x1; n++) pts.push([X(n), Y(fn(n))]); L.line(ctx, pts, color, w); };
    line((n) => S.cap(n, g) / n, GRAY, 1.8);
    ctx.setLineDash([5, 3]); ctx.strokeStyle = RED; ctx.beginPath(); ctx.moveTo(m.l, Y(th)); ctx.lineTo(m.l + pw, Y(th)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = RED; ctx.textAlign = 'right'; L.label(ctx, `긴 벤치 이론값 ${pct(th)}`, m.l + pw - 4, Y(th) + (g === 0 ? 16 : 16), 'right');
    line((n) => curve.ex[n] / n, GREEN, 2.4);
    curve.pts.forEach((d) => { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(d.n), Y(d.v), 4, 0, 7); ctx.fill(); });
    if (P.n >= x0) L.vline(c, X(P.n), css('--rich'), '지금 설정', P.n > (x0 + x1) / 2 ? 'right' : 'left');
    L.legend(c, [{ kind: 'dot', color: css('--accent'), label: '시뮬레이션 평균' }, { kind: 'line', color: GREEN, label: '정확한 기댓값' }, { kind: 'dash', color: RED, label: '긴 벤치 이론값' }, { kind: 'line', color: GRAY, label: '정돈했을 때 최대' }], 'tr');
  }
  function drawRules() {
    const P = sim.params, c = L.chart($('c-rules'), 0.62, { l: 46, b: 52, r: 16, t: 20 }), { ctx, m, pw, ph } = c, cols = RULE_COLORS();
    const top = Math.ceil(sim.cap * 1.4), step = top > 12 ? 4 : top > 6 ? 2 : 1;
    const Y = (v) => m.t + ph - (v / top) * ph, yt = []; for (let v = 0; v <= top; v += step) yt.push(v);
    L.axes(c, { X: () => 0, Y, yTicks: yt, yFmt: (v) => String(v), yLabel: '앉은 사람 (명)' });
    const bw = pw / 4;
    stats.mean.forEach((v, k) => {
      const x = m.l + k * bw + bw * 0.18, w = bw * 0.64;
      ctx.fillStyle = cols[k]; ctx.fillRect(x, Y(v), w, Y(0) - Y(v));
      ctx.textAlign = 'center'; ctx.fillStyle = css('--text'); ctx.font = '600 12px ' + FONT; ctx.fillText(`${f1(v)}명`, x + w / 2, Y(v) - 6);
      ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(RULE_SHORT[k], x + w / 2, c.h - m.b + 16);
      ctx.fillText(`(정돈의 ${Math.round((100 * v) / sim.cap)}%)`, x + w / 2, c.h - m.b + 31);
    });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = GREEN; ctx.beginPath(); ctx.moveTo(m.l, Y(sim.cap)); ctx.lineTo(m.l + pw, Y(sim.cap)); ctx.stroke(); ctx.setLineDash([]);
    L.legend(c, [{ kind: 'dash', color: GREEN, label: '정돈했을 때 최대' }], 'tl');
  }
  function drawG() {
    const P = sim.params, c = L.chart($('c-g'), 0.55, { l: 50, b: 40, r: 20, t: 24 }), { ctx, m, pw, ph } = c;
    const gs = [0, 1, 2, 3, 4, 5], ex = gs.map((g) => S.exact(P.n, g)[P.n] / S.cap(P.n, g)), th = gs.map((g) => S.theta(g) * (g + 1));
    const y0 = 0.7, y1 = 1.02;
    const X = (v) => m.l + (v / 5) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    L.axes(c, { X, Y, yTicks: [0.7, 0.8, 0.9, 1.0], yFmt: (v) => Math.round(v * 100) + '%', xTicks: gs, xFmt: (v) => String(v), xLabel: '비워 두는 칸 (칸)', yLabel: '정돈 대비 앉은 비율 (%)' });
    L.line(ctx, gs.map((g, i) => [X(g), Y(th[i])]), RED, 2);
    L.line(ctx, gs.map((g, i) => [X(g), Y(ex[i])]), GREEN, 2.6);
    gs.forEach((g, i) => { ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(X(g), Y(ex[i]), 4, 0, 7); ctx.fill(); });
    ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
    gs.forEach((g, i) => { if (g > 0) L.label(ctx, `${Math.round(ex[i] * 100)}%`, X(g), Y(ex[i]) + 20, 'center'); });
    L.vline(c, X(P.g), css('--rich'), '지금 설정', P.g > 2.5 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: GREEN, label: '지금 벤치 길이' }, { kind: 'line', color: RED, label: '아주 긴 벤치' }], 'br');
  }

  function renderStats() {
    const P = sim.params, r = sim.rows[0], waste = 1 - stats.mean[0] / sim.cap, ex = curve ? curve.ex[P.n] / P.n : 0;
    const cards = [
      ['정돈했다면 앉았을 사람 중 놓친 비율', `${Math.round(waste * 100)}%`, `무작위 평균 ${f1(stats.mean[0])}명 · 정돈하면 ${sim.cap}명 (자리 ${P.n}개, 비우는 칸 ${P.g}개)`],
      ['이번 판 (무작위 줄)', `${r.seated} / ${sim.cap}명`, `앉은 사람 / 정돈했을 때 최대 · 앉을 수 없는 빈 자리 ${P.n - r.seated - S.allowedList(r.occ, P.n, P.g).length}개`],
      ['돌려보낸 사람', `${r.turned}명`, `도착한 ${sim.t}명 중 앉을 곳이 없어 돌아간 사람 (무작위 줄)`],
      ['긴 벤치 이론값', pct(curve ? curve.theta : 0), `시뮬레이션 평균 ${pct(stats.mean[0] / P.n)} (이 벤치 길이), 정돈 ${pct(sim.cap / P.n)}`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRows(); if (man) drawMan(); }

  function after() { computeCurve(); renderStats(); drawN(); drawRules(); drawG(); }

  const h = L.harness({
    controls: ['n', 'g', 'arrivals'],
    format: { n: (v) => v + '석', g: (v) => v + '칸', arrivals: (v) => v + '명' },
    defaults: { n: 30, g: 2, arrivals: 24 },
    build() {
      const P = params(); sim = S.create(P);
      stats = { mean: S.RULES.map((r) => S.meanFill(r, P.n, P.g, 300, 99 + P.seed).mean) };
      curve = null;
      if (THUMB) sim.run();
      hover = { i: -1, ok: false }; manReset();
    },
    autoplay: !THUMB,
    speedScale: 0.9,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawN(); drawRules(); drawG(); drawMan(); }, seedLabel: '도착 순서 번호',
  });
  seedGetter = h.seed;

  const cv = $('c-play');
  cv.addEventListener('click', manClick);
  cv.addEventListener('mousemove', manMove);
  cv.addEventListener('mouseleave', () => { hover = { i: -1, ok: false }; if (man) drawMan(); });
  $('m-go').addEventListener('click', startFill);
  $('m-clear').addEventListener('click', () => { hover = { i: -1, ok: false }; manReset(); drawMan(); });
})();
