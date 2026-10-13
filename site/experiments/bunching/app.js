(function () {
  'use strict';
  const B = window.Bunching, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const RED = '#e5484d', GREEN = '#1fa463', AMBER = '#e0a100', BLUE = '#2f6fed';
  const REM = ['none', 'hold', 'limit'], REM_COL = { none: RED, hold: GREEN, limit: AMBER };
  const BUS_COL = ['#2f6fed', '#e5484d', '#1fa463', '#e0a100', '#7c5cff', '#0ea5a5', '#d6409f', '#6b7280', '#f97316', '#4f46e5', '#65a30d', '#0891b2'];
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 버스가 한 덩어리로 뭉친 장면으로 바로 간다
  let sim = null, refs = null, sums = null, seed = 1;
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), demand: Number($('demand').value), eps: Number($('eps').value), remedy: $('remedy').value });
  const f1 = (v) => v.toFixed(1);
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);

  // 덩어리(서로 이상적 간격의 35% 이내로 붙은 버스들) 수
  function groups(g) { const big = g.filter((x) => x >= 0.35).length; return Math.max(1, big); }

  // ---------- ① 순환 노선 ----------
  function drawRing() {
    const cw = $('c-ring').clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 1.0 : 0.62;
    const c = L.chart($('c-ring'), asp, { l: 8, r: 8, t: 8, b: 8 }), { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const P = sim.p, S = sim.S, n = sim.n, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 52;
    const ang = (x) => -Math.PI / 2 + (2 * Math.PI * x) / S, pt = (x, r) => [cx + r * Math.cos(ang(x)), cy + r * Math.sin(ang(x))];
    // 길
    ctx.strokeStyle = '#dfe5f0'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#c3cce0'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    // 정류장과 줄 선 승객
    const q = sim.queueNow();
    for (let s = 0; s < S; s++) {
      const [x0, y0] = pt(s, R + 13), len = Math.min(q[s] * 3.2, 38), [x1, y1] = pt(s, R + 13 + len);
      if (len > 0) { ctx.strokeStyle = mix(AMBER, 0.9); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.lineCap = 'butt'; }
      const [sx, sy] = pt(s, R); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#8a93a6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, 7); ctx.fill(); ctx.stroke();
    }
    // 버스 (겹치면 길 위에서 폭과 앞뒤로 어긋나게 그린다)
    const order = sim.buses.slice().sort((a, b) => a.id - b.id);
    order.forEach((b) => {
      const x = b.dist % S, lane = ((b.id % 3) - 1) * 9, tang = (Math.floor(b.id / 3) % 2) * 0.05;
      const [bx, by] = pt(x + tang, R + lane), rad = THUMB ? 15 : 10;
      ctx.fillStyle = BUS_COL[b.id % BUS_COL.length]; ctx.strokeStyle = b.dwell ? '#111' : '#fff'; ctx.lineWidth = b.dwell ? 2.5 : 2;
      ctx.beginPath(); ctx.arc(bx, by, rad, 0, 7); ctx.fill(); ctx.stroke();
      if (!THUMB) { ctx.fillStyle = '#fff'; ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(String(b.id + 1), bx, by + 4); }
    });
    if (THUMB) return;
    // 가운데 안내
    const g = sim.gapsNow(), H = sim.nom.H, mn = Math.min(...g) * H, cv = sim.cvNow();
    ctx.textAlign = 'center'; ctx.fillStyle = css('--text'); ctx.font = '700 22px ' + FONT;
    ctx.fillText(`${Math.round(sim.t)}분 경과`, cx, cy - 18);
    ctx.font = '13px ' + FONT; ctx.fillStyle = css('--muted');
    ctx.fillText(`달리는 덩어리 수: ${groups(g)}`, cx, cy + 6);
    ctx.fillText(`가장 붙은 두 버스 간격 ${f1(mn)}분 (이상적 ${f1(H)}분)`, cx, cy + 26);
    L.legend(c, [{ kind: 'box', color: mix(AMBER, 0.9), label: '주황 막대: 정류장에 줄 선 승객' }, { kind: 'dot', color: '#111', label: '검은 테두리: 승객을 태우는 중' }], 'bl');
    $('when').textContent = `${Math.round(sim.t)}/${P.minutes}분`;
  }

  // ---------- ② 간격 히트맵 ----------
  function heatColor(r) {
    // r: 앞차까지의 간격 / 이상적 간격.  1 = 고름(옅은 회색), 0 = 바짝 붙음(빨강), 3 이상 = 크게 벌어짐(파랑)
    const lerp = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const mid = [238, 241, 247], red = [229, 72, 77], blue = [47, 111, 237];
    const c = r < 1 ? lerp(mid, red, Math.min(1, (1 - r) / 0.9)) : lerp(mid, blue, Math.min(1, (r - 1) / 2));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function drawHeat() {
    const n = sim.n, cw = $('c-heat').clientWidth || 600, asp = cw < 560 ? 0.8 : Math.max(0.3, Math.min(0.5, 0.18 + n * 0.03));
    const c = L.chart($('c-heat'), asp, { l: 34, r: 12, t: 24, b: 40 }), { ctx, w, h, m, pw, ph } = c, M = sim.p.minutes;
    const X = (t) => m.l + (t / M) * pw, rh = ph / n;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(m.l, m.t, pw, ph);
    const r = sim.rec, cwid = Math.max(1, pw / M + 0.6);
    for (let i = 0; i < r.t.length; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = heatColor(r.gaps[i][j]); ctx.fillRect(X(r.t[i]), m.t + j * rh, cwid, rh + 0.5); }
    ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.textAlign = 'right';
    const stepRow = n > 8 ? 2 : 1;
    for (let j = 0; j < n; j += stepRow) ctx.fillText(String(j + 1), m.l - 6, m.t + j * rh + rh / 2 + 4);
    ctx.textAlign = 'center';
    for (let t = 0; t <= M; t += 60) ctx.fillText(String(t), X(t), h - m.b + 16);
    ctx.strokeStyle = css('--line'); ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw - 1, ph - 1);
    L.axisNames(c, '시간 (분)', '버스 번호');
    L.legend(c, [{ kind: 'box', color: '#e5484d', label: '앞차에 바짝 붙음' }, { kind: 'box', color: '#c3cce0', label: '고른 간격' }, { kind: 'box', color: '#2f6fed', label: '앞차와 크게 벌어짐' }], 'tr');
  }

  // ---------- ③ 간격 변동계수 ----------
  function drawCV() {
    const M = sim.p.minutes, cmax = Math.max(1, Math.ceil(Math.sqrt(sim.n - 1) * 5) / 5 + 0.2);
    const c = L.chart($('c-cv'), 0.62, { l: 40, r: 14, t: 24, b: 40 }), { ctx, m, pw, ph } = c;
    const X = (t) => m.l + (t / M) * pw, Y = (v) => m.t + ph - (v / cmax) * ph, yt = []; for (let v = 0; v <= cmax + 1e-9; v += 0.5) yt.push(v);
    const xt = []; for (let t = 0; t <= M; t += 60) xt.push(t);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => v.toFixed(1), xTicks: xt, xFmt: (v) => String(v), xLabel: '시간 (분)', yLabel: '간격 흐트러짐 (CV)' });
    REM.forEach((k) => { ctx.globalAlpha = k === sim.p.remedy ? 0.45 : 0.9; L.line(ctx, refs[k].rec.cv.map((v, i) => [X(i), Y(v)]), REM_COL[k], 2); ctx.globalAlpha = 1; });
    const cv = sim.rec.cv;
    L.line(ctx, cv.map((v, i) => [X(i), Y(v)]), css('--text'), 3.2);
    if (cv.length) { ctx.fillStyle = css('--text'); ctx.beginPath(); ctx.arc(X(cv.length - 1), Y(cv[cv.length - 1]), 4.5, 0, 7); ctx.fill(); }
    L.legend(c, [{ kind: 'line', color: RED, label: '처방 없음' }, { kind: 'line', color: GREEN, label: '간격 유지' }, { kind: 'line', color: AMBER, label: '승차 제한' }, { kind: 'line', color: css('--text'), label: '지금 돌리는 중' }], 'tl');
  }

  // ---------- ④ 처방별 기다림과 한 바퀴 시간 ----------
  const NAME = { none: '없음', hold: '간격 유지', limit: '승차 제한' };
  function drawBars() {
    const cw = $('c-bars').clientWidth || 600, c = L.chart($('c-bars'), cw < 560 ? 0.9 : 0.5, { l: 8, r: 8, t: 30, b: 34 }), { ctx, w, h, m, ph } = c;
    const half = (w - m.l - m.r) / 2, base = m.t + ph;
    const panel = (k, title, vals, unit, ref, refLabel) => {
      const x0 = m.l + k * half + 14, pw = half - 28, vmax = Math.max(...vals, ref || 0) * 1.18, bw = pw / 3;
      ctx.fillStyle = css('--text'); ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(title, x0 + pw / 2, 16);
      ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, base + 0.5); ctx.lineTo(x0 + pw, base + 0.5); ctx.stroke();
      REM.forEach((r, i) => {
        const v = vals[i], bh = (v / vmax) * ph, bx = x0 + i * bw + bw * 0.14, bwid = bw * 0.72;
        ctx.fillStyle = r === sim.p.remedy ? REM_COL[r] : mix(REM_COL[r], 0.5); ctx.fillRect(bx, base - bh, bwid, bh);
        if (r === sim.p.remedy) { ctx.strokeStyle = css('--text'); ctx.lineWidth = 2; ctx.strokeRect(bx + 1, base - bh + 1, bwid - 2, bh - 1); }
        ctx.fillStyle = css('--text'); ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(f1(v) + unit, bx + bwid / 2, base - bh - 5);
        ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.fillText(NAME[r], bx + bwid / 2, base + 16);
      });
      if (ref) { const y = base - (ref / vmax) * ph; ctx.setLineDash([5, 3]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + pw, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = GRAY; ctx.font = '11px ' + FONT; ctx.textAlign = 'right'; L.label(ctx, refLabel, x0 + pw, y - 5, 'right'); }
    };
    panel(0, '평균 기다림 (분)', REM.map((k) => sums[k].wait), '', sums.none.even, `이상적 간격이면 ${f1(sums.none.even)}분`);
    panel(1, '한 바퀴 도는 시간 (분)', REM.map((k) => sums[k].lap), '', sums.none.lap0, `이상적일 때 ${f1(sums.none.lap0)}분`);
    ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('같은 설정을 시드 6개로 돌린 평균 (뒤쪽 절반 시간)', w / 2, h - 6);
  }
  const GRAY = '#8a93a6';

  function renderStats() {
    const g = sim.gapsNow(), H = sim.nom.H, cv = sim.cvNow(), ratio = 1 + cv * cv, mn = Math.min(...g) * H, rem = sim.p.remedy;
    const a = sums.none, b = sums[rem];
    const cards = [
      ['지금 기다림은 이상적일 때의 몇 배', `×${ratio.toFixed(1)}`, '같은 버스 수·같은 승객인데 간격이 흐트러진 만큼 (식: 1 + CV²)'],
      ['간격 흐트러짐 (CV)', `${cv.toFixed(2)}`, '0이면 완전히 고름, 클수록 몇 대씩 뭉침'],
      ['가장 붙은 두 버스의 간격', `${f1(mn)}분`, `처음 이상적 간격 ${f1(H)}분`],
      rem === 'none'
        ? ['평균 기다림 (뒤쪽 절반)', `${f1(a.wait)}분`, `이상적 간격이면 ${f1(a.even)}분 · 한 바퀴 ${f1(a.lap)}분`]
        : ['평균 기다림: 처방 없음 → 처방', `${f1(a.wait)} → ${f1(b.wait)}분`, `한 바퀴 시간 ${f1(a.lap)} → ${f1(b.lap)}분`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  let heatLen = -1;
  function draw() {
    renderStats(); drawRing();
    if (sim.rec.t.length !== heatLen) { heatLen = sim.rec.t.length; drawHeat(); drawCV(); }
  }

  function ensure() { // 설정이 바뀌면 세 처방을 같은 조건으로 끝까지 돌려 둔다 (CV 기준선, 막대 차트)
    if (sums) return;
    const P = params(); refs = {}; sums = {};
    REM.forEach((k) => { refs[k] = B.create(Object.assign({}, P, { remedy: k })).run(); sums[k] = B.summary(Object.assign({}, P, { remedy: k }), 6); });
    drawBars();
  }

  const h = L.harness({
    controls: ['n', 'demand', 'eps', 'remedy'],
    format: { n: (v) => v + '대', demand: (v) => v + '명/시간', eps: (v) => v + '%', remedy: () => '' },
    defaults: { n: 6, demand: 40, eps: 5, remedy: 'none' },
    build() {
      const P = params(); sim = B.create(P);
      if (THUMB) { while (sim.rec.t.length < 200) sim.tick(10); }
      heatLen = -1;
      if (refs) { refs = null; sums = null; }
    },
    autoplay: !THUMB,
    advance() { return sim.tick(2); },
    isDone() { return sim.done(); },
    draw() { ensure(); draw(); },
    redrawExtra() { heatLen = -1; drawBars(); draw(); },
    seedLabel: '버스 노선 번호',
  });
  seedGetter = h.seed;
})();
