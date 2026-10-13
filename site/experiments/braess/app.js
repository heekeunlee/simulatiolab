(function () {
  'use strict';
  const B = window.Braess, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const GREEN = '#1fa463', RED = '#e5484d', GRAY = '#8a93a6';
  const ROUTE_COLORS = () => [css('--accent'), '#7c5cff', '#e0a100'];
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  let sim = null, S = null, curveN = [], curveC = [], bandsN = null, bandsC = null;
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), cost: Number($('cost').value), sens: Number($('sens').value), plan: $('plan').value });
  const f1 = (v) => v.toFixed(1);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 지름길이 열리고 자리 잡은 장면으로 바로 간다

  // 한 구간을 지나는 시간(분)에 따라 초록(5분 이하) -> 노랑 -> 빨강(45분 이상).
  // RGB로 섞으면 중간이 탁한 갈색·올리브가 되어 색상(hue)을 돌려 섞는다
  function heat(t) {
    const q = Math.max(0, Math.min(1, (t - 5) / 40));
    return `hsl(${Math.round(145 * (1 - q))}, ${Math.round(68 + 10 * q)}%, ${Math.round(42 + 4 * Math.sin(Math.PI * q))}%)`;
  }

  // ---------- ① 도로망 ----------
  function drawNet() {
    const cw = $('c-net').clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 0.95 : 0.7; // 휴대폰에서는 마름모가 납작해지지 않게 더 높게
    const c = L.chart($('c-net'), asp, { l: 14, r: 14, t: 34, b: 66 }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const P = sim.params, n = P.n, a = P.sens / 1000, F = P.fixed, cn = sim.counts(), t = sim.routeTimes();
    const LA = cn[0] + cn[2], LB = cn[1] + cn[2];
    ctx.textAlign = 'left'; ctx.fillStyle = THUMB ? 'rgba(0,0,0,0)' : css('--text'); ctx.font = '600 13px ' + FONT;
    ctx.fillText(`${sim.round}라운드 · 평균 출근 시간 ${f1(sim.avgNow())}분`, m.l, 22);
    ctx.textAlign = 'right'; ctx.fillStyle = sim.open ? css('--unlucky') : css('--lucky');
    if (!THUMB) ctx.fillText(sim.open ? '지름길 열림' : '지름길 닫힘', w - m.r, 22);
    ctx.font = '12px ' + FONT;
    const x0 = m.l + 30, x1 = w - m.r - 30, xm = (x0 + x1) / 2, yt = m.t + 26, yb = m.t + ph - 26, ym = (yt + yb) / 2;
    const Sx = [x0, ym], Ax = [xm, yt], Bx = [xm, yb], Ex = [x1, ym];
    const wd = (load) => 2 + 15 * (load / n);
    // [시작, 끝, 부하, 시간, 이름, 라벨 위치(dx, dy, 정렬)]
    const links = [
      [Sx, Ax, LA, a * LA, '막히는 길', -14, -14, 'right'],
      [Ax, Ex, cn[0], F, '늘 일정한 길', 14, -14, 'left'],
      [Sx, Bx, cn[1], F, '늘 일정한 길', -14, 20, 'right'],
      [Bx, Ex, LB, a * LB, '막히는 길', 14, 20, 'left'],
    ];
    ctx.lineCap = 'round';
    links.forEach(([p, q, load, tm]) => {
      ctx.strokeStyle = heat(tm); ctx.lineWidth = wd(load); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    });
    // 지름길 A -> B
    const shortOpen = sim.open;
    if (shortOpen) { ctx.strokeStyle = heat(P.cost); ctx.lineWidth = wd(cn[2]); ctx.beginPath(); ctx.moveTo(Ax[0], Ax[1]); ctx.lineTo(Bx[0], Bx[1]); ctx.stroke(); }
    else {
      ctx.strokeStyle = GRAY; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(Ax[0], Ax[1] + 24); ctx.lineTo(Bx[0], Bx[1] - 24); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = GRAY; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xm - 7, ym - 7); ctx.lineTo(xm + 7, ym + 7); ctx.moveTo(xm + 7, ym - 7); ctx.lineTo(xm - 7, ym + 7); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.lineCap = 'butt';
    // 노드
    const node = (pt, label) => {
      const bw = 44, bh = 24; ctx.fillStyle = css('--surface'); ctx.strokeStyle = css('--text'); ctx.lineWidth = 1.5;
      L.roundRect(ctx, pt[0] - bw / 2, pt[1] - bh / 2, bw, bh, 12); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.font = '600 12px ' + FONT; ctx.fillText(label, pt[0], pt[1] + 4);
    };
    node(Sx, '출발'); node(Ex, '도착'); node(Ax, 'A'); node(Bx, 'B');
    // 라벨
    ctx.font = '12px ' + FONT;
    if (!THUMB) links.forEach(([p, q, load, tm, name, dx, dy, al]) => {
      const mx = (p[0] + q[0]) / 2 + dx, my = (p[1] + q[1]) / 2 + dy;
      ctx.textAlign = al; ctx.fillStyle = css('--text'); ctx.fillText(`${Math.round(tm)}분 · ${load}명`, mx, my);
      ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.fillText(name, mx, my + 13); ctx.font = '12px ' + FONT;
    });
    ctx.textAlign = 'left'; ctx.fillStyle = shortOpen ? css('--text') : css('--muted');
    if (THUMB) { /* 썸네일에는 작은 글자를 넣지 않는다 */ }
    else if (shortOpen) { ctx.fillText(`${Math.round(P.cost)}분 · ${cn[2]}명`, xm + 12, ym - 2); ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.fillText('지름길', xm + 12, ym + 11); ctx.font = '12px ' + FONT; }
    else { ctx.fillText('지름길 닫힘', xm + 14, ym + 4); }
    // 길 선택 비율 막대
    const sh = [cn[0] / n, cn[1] / n, cn[2] / n], cols = ROUTE_COLORS(), by = h - 46, bh = 14;
    let x = m.l;
    sh.forEach((v, i) => { ctx.fillStyle = cols[i]; ctx.fillRect(x, by, v * pw, bh); x += v * pw; });
    ctx.strokeStyle = css('--line'); ctx.strokeRect(m.l + 0.5, by + 0.5, pw - 1, bh - 1);
    const names = THUMB ? [] : ['A 길', 'B 길', '지름길 경유']; let lx = m.l;
    ctx.font = '12px ' + FONT; ctx.textAlign = 'left';
    names.forEach((_, i) => { const v = sh[i];
      ctx.fillStyle = cols[i]; ctx.fillRect(lx, by + 24, 10, 10);
      ctx.fillStyle = css('--text'); const label = `${names[i]} ${Math.round(v * 100)}%`; ctx.fillText(label, lx + 15, by + 33);
      lx += 15 + ctx.measureText(label).width + 16;
    });
    $('when').textContent = `${sim.round}/${P.rounds}라운드 · ${sim.open ? '지름길 열림' : '지름길 닫힘'}`;
    $('toggle').textContent = sim.open ? '지름길 막기' : '지름길 열기';
  }

  // 공통: 라운드 축 차트 틀
  function roundChart(id, y0, y1, yTicks, yFmt, yLabel) {
    const c = L.chart($(id), 0.62, { l: 46, b: 40 }), { m, pw, ph } = c, R = sim.params.rounds;
    const X = (r) => m.l + (r / R) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const xt = []; for (let r = 0; r <= R; r += 30) xt.push(r);
    L.axes(c, { X, Y, yTicks, yFmt, xTicks: xt, xFmt: (v) => String(v), xLabel: '라운드 (차례)', yLabel });
    return { c, X, Y };
  }
  function changeLines(c, X) {
    sim.changes.forEach((ch) => L.vline(c, X(ch.round), ch.open ? css('--unlucky') : css('--lucky'), ch.open ? '지름길 열림' : '지름길 닫힘', ch.round > sim.params.rounds / 2 ? 'right' : 'left'));
  }

  // ---------- ② 평균 출근 시간 ----------
  function drawTime() {
    const A = sim.avg, refs = [S.closed, S.open, S.opt];
    const lo = Math.min(...A, ...refs), hi = Math.max(...A, ...refs);
    const y0 = Math.max(0, Math.floor((lo - 8) / 10) * 10), y1 = Math.ceil((hi + 4) / 10) * 10, yt = []; for (let v = y0; v <= y1; v += 10) yt.push(v);
    const { c, X, Y } = roundChart('c-time', y0, y1, yt, (v) => String(v), '평균 출근 시간 (분)');
    const { ctx, m, pw } = c, xr = m.l + pw - 6;
    const ref = (v, color, label, dy) => { ctx.setLineDash([5, 3]); ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(m.l + pw, Y(v)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(label, xr, Y(v) + dy); };
    ref(S.closed, GREEN, `지름길 없는 균형 ${f1(S.closed)}분`, -5);
    if (Math.abs(S.open - S.closed) > 0.05) ref(S.open, RED, `지름길 있는 균형 ${f1(S.open)}분`, -5);
    if (S.opt < Math.min(S.open, S.closed) - 0.05) ref(S.opt, GRAY, `사회 최적 ${f1(S.opt)}분`, 14);
    changeLines(c, X);
    L.line(ctx, A.map((v, i) => [X(i), Y(v)]), css('--accent'), 2.8);
    if (A.length) { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(A.length - 1), Y(A[A.length - 1]), 4, 0, 7); ctx.fill(); }
  }

  // ---------- ③ 길 선택 비율 ----------
  function drawShares() {
    const { c, X, Y } = roundChart('c-shares', 0, 1, [0, 0.25, 0.5, 0.75, 1], (v) => Math.round(v * 100) + '%', '선택 비율 (%)');
    const { ctx } = c, sh = sim.shares, cols = ROUTE_COLORS();
    for (let k = 2; k >= 0; k--) { // 아래부터 A, B, 지름길 순으로 쌓는다
      ctx.fillStyle = mix(cols[k], 0.85); ctx.beginPath();
      const top = (i) => sh[i].slice(0, k + 1).reduce((x, y) => x + y, 0);
      sh.forEach((_, i) => (i ? ctx.lineTo(X(i), Y(top(i))) : ctx.moveTo(X(i), Y(top(i)))));
      for (let i = sh.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(0));
      ctx.closePath(); ctx.fill();
    }
    changeLines(c, X);
    L.legend(c, [{ kind: 'box', color: cols[0], label: 'A 길' }, { kind: 'box', color: cols[1], label: 'B 길' }, { kind: 'box', color: cols[2], label: '지름길 경유' }], 'tl');
  }

  // ---------- ④, ⑤ 훑어 보기 (이론 균형) ----------
  function bandsOf(cv, step) { // 지름길이 도움이 되는 구간과 해가 되는 구간
    const eps = 1e-6, help = cv.filter((d) => d.open < d.closed - eps), hurt = cv.filter((d) => d.open > d.closed + eps);
    const rng = (a) => (a.length ? [a[0].x, a[a.length - 1].x] : null);
    return { help: rng(help), hurt: rng(hurt), step };
  }
  function band(cv, ctx, X, Y, m, ph) { // 두 곡선 사이를 칠한다: 해가 되면 빨강, 도움이 되면 초록
    for (let i = 1; i < cv.length; i++) {
      const p = cv[i - 1], q = cv[i], bad = (p.open + q.open) / 2 > (p.closed + q.closed) / 2 + 1e-6, good = (p.open + q.open) / 2 < (p.closed + q.closed) / 2 - 1e-6;
      if (!bad && !good) continue;
      ctx.fillStyle = mix(bad ? RED : GREEN, 0.18); ctx.beginPath();
      ctx.moveTo(X(p.x), Y(p.closed)); ctx.lineTo(X(q.x), Y(q.closed)); ctx.lineTo(X(q.x), Y(q.open)); ctx.lineTo(X(p.x), Y(p.open)); ctx.closePath(); ctx.fill();
    }
  }
  function sweepChart(id, cv, x0, x1, xt, xfmt, xlabel, cur, lpos) {
    let hi = 0, lo = Infinity; cv.forEach((d) => { hi = Math.max(hi, d.open, d.closed); lo = Math.min(lo, d.open, d.closed, d.opt); });
    const y0 = Math.max(0, Math.floor((lo - 5) / 10) * 10), y1 = Math.ceil((hi + 3) / 10) * 10, yt = []; for (let v = y0; v <= y1; v += 10) yt.push(v);
    const c = L.chart($(id), 0.66, { l: 46, b: 40, r: 30 }), { ctx, m, pw, ph } = c; // 오른쪽 끝 눈금(10000명)이 잘리지 않게
    const X = (v) => m.l + ((v - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => String(v), xTicks: xt, xFmt: xfmt, xLabel: xlabel, yLabel: '평균 출근 시간 (분)' });
    band(cv, ctx, X, Y, m, ph);
    L.line(ctx, cv.map((d) => [X(d.x), Y(d.opt)]), GRAY, 2);
    L.line(ctx, cv.map((d) => [X(d.x), Y(d.closed)]), GREEN, 2.8);
    L.line(ctx, cv.map((d) => [X(d.x), Y(d.open)]), RED, 2.8);
    if (cur >= x0 && cur <= x1) L.vline(c, X(cur), css('--rich'), '지금 설정', cur > (x0 + x1) / 2 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: GREEN, label: '지름길 없음' }, { kind: 'line', color: RED, label: '지름길 있음' }, { kind: 'line', color: GRAY, label: '사회 최적' }], lpos || 'br');
  }
  const NMAX = 10000, CMAX = 60;
  function drawN() { sweepChart('c-n', curveN, 0, NMAX, [0, 2000, 4000, 6000, 8000, 10000], (v) => String(v), '운전자 수 (명)', sim.params.n); }
  function drawC() { sweepChart('c-c', curveC, 0, CMAX, [0, 10, 20, 30, 40, 50, 60], (v) => String(v), '지름길 비용 (분)', sim.params.cost, 'bl'); }

  // 구간을 문장으로 (항목마다 따로 번역되도록 요소로 나눈다)
  function rangeText(r, lo, hi, unit, step) {
    if (!r) return '없음';
    const rd = (v) => (unit === '명' ? Math.round(v / 10) * 10 : Math.round(v));
    const a = rd(r[0] - step), b = rd(r[1] + step); // 훑은 점의 바깥 경계
    if (r[0] - step <= lo + 1e-9) return `${b}${unit} 미만`;
    if (r[1] + step >= hi - 1e-9) return `${a}${unit} 이상`;
    return `${a}~${b}${unit}`;
  }
  function notes() {
    const note = (a, ra, b, rb) => `<span>${a}</span> <b>${ra}</b> · <span>${b}</span> <b>${rb}</b>`;
    $('note-n').innerHTML = note('지름길이 도움이 되는 운전자 수:', rangeText(bandsN.help, 0, NMAX, '명', 10), '해가 되는 운전자 수:', rangeText(bandsN.hurt, 0, NMAX, '명', 10));
    $('note-c').innerHTML = note('지름길이 도움이 되는 비용:', rangeText(bandsC.help, 0, CMAX, '분', 0.1), '해가 되는 비용:', rangeText(bandsC.hurt, 0, CMAX, '분', 0.1));
  }

  function renderStats() {
    const P = sim.params, cur = sim.open ? S.open : S.closed, opt = sim.open ? S.opt : S.closed, poa = cur / opt; // 닫혀 있으면 지름길을 쓸 수 없으니 최적도 닫힌 도로망 기준
    const cards = [
      ['지금 평균 출근 시간', `${f1(sim.avgNow())}분`, `${sim.round}/${P.rounds}라운드 · ${sim.open ? '지름길 열림' : '지름길 닫힘'}`],
      ['안정된 상태의 시간: 지름길 없음 → 있음', `${f1(S.closed)} → ${f1(S.open)}분`, '이론값. 모두가 자기에게 가장 빠른 길만 고를 때'],
      ['가장 좋은 평균 시간 (사회 최적)', `${f1(opt)}분`, '누군가 길을 나눠 줄 수 있다면 도달할 최선'],
      ['이기적 선택의 비용', `×${poa.toFixed(2)}`, '지금 상태의 균형 시간 ÷ 사회 최적 (무정부 가격)'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawNet(); drawTime(); drawShares(); }

  function after() {
    const P = params(), base = { n: P.n, cost: P.cost, sens: P.sens };
    const ns = []; for (let k = 100; k <= NMAX; k += 100) ns.push(k);
    const cs = []; for (let k = 0; k <= CMAX; k += 1) cs.push(k);
    curveN = B.curveN(base, ns); curveC = B.curveC(base, cs);
    const fineN = []; for (let k = 10; k <= NMAX; k += 10) fineN.push(k);
    const fineC = []; for (let k = 0; k <= CMAX; k += 0.1) fineC.push(+k.toFixed(1));
    bandsN = bandsOf(B.curveN(base, fineN)); bandsC = bandsOf(B.curveC(base, fineC));
    drawN(); drawC(); notes();
  }

  const h = L.harness({
    controls: ['n', 'cost', 'sens', 'plan'],
    format: { n: (v) => v + '명', cost: (v) => v + '분', sens: (v) => v + '분/천 명', plan: () => '' },
    defaults: { n: 4000, cost: 0, sens: 10, plan: 'open' },
    build() {
      const P = params(); sim = B.create(P); S = B.summary(P);
      if (THUMB) for (let k = 0; k < 140 && !sim.done(); k++) sim.advance();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawN(); drawC(); }, seedLabel: '출근길 번호',
  });
  seedGetter = h.seed;

  // 지름길 열기/막기 (언제든 누를 수 있다)
  $('toggle').addEventListener('click', () => {
    const wasDone = sim.done();
    sim.toggle();
    if (wasDone) { sim.params.rounds += 60; const pb = $('play'); if (pb) pb.click(); }
    draw();
  });
})();
