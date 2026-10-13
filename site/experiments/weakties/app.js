(function () {
  'use strict';
  const W = window.WeakTies, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const WEAK = '#7c5cff', HOT = '#f08a00', RICH = '#e0a100', GRAY = '#8a93a6';
  const PS = [0, 0.001, 0.002, 0.005, 0.01, 0.02, 0.03, 0.05, 0.1, 0.2, 0.5, 1]; // 슬라이더 값(번호) -> 약한 연결 비율
  const GRID = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
  const CURVE_PS = [0, 0.005, 0.02, 0.1, 1];
  const CURVE_COLORS = [GRAY, '#4f7cf0', '#1fa463', RICH, '#e5484d'];
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 소식이 절반 넘게 퍼진 장면으로 바로 간다
  const pctText = (p) => { const v = p * 100; return (v < 1 && v > 0 ? String(+v.toFixed(1)) : String(Math.round(v))) + '%'; };
  let sim = null, seedGetter = () => 1, startNode = 0;
  let base0 = NaN, baseCur = NaN, weakSet = null, pos = [], geo = null;
  let sw = null, curves = null, curveLen = 0;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), k: Number($('k').value), p: PS[Number($('p').value)], q: Number($('q').value) / 100, start: startNode });
  const f1 = (v) => (isFinite(v) ? v.toFixed(1) : '—');
  const ratio = (v) => (isFinite(v) ? Math.round(v) : '—');

  // 먼저 안 사람일수록 진한 남색, 나중일수록 연한 하늘색
  function nodeColor(t, scale) {
    const q = Math.max(0, Math.min(1, t / scale));
    return `hsl(${Math.round(226 - 12 * q)}, ${Math.round(78 - 8 * q)}%, ${Math.round(24 + 42 * q)}%)`;
  }

  // ---------- ① 사람들의 원 ----------
  function drawNet() {
    const cv = $('c-net'), cw = cv.clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 1.12 : Math.min(0.62, 560 / cw);
    const c = L.chart(cv, asp, { l: 12, r: 12, t: THUMB ? 12 : 34, b: THUMB ? 12 : cw < 560 ? 74 : 44 }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const g = sim.g, n = g.n, sp = sim.sp, cx = m.l + pw / 2, cy = m.t + ph / 2, R = Math.min(pw, ph) / 2 - 8;
    geo = { cx, cy, R, w, h, m };
    pos = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; pos.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    const informedPct = Math.round((100 * sp.informed) / n);
    if (!THUMB) {
      ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 13px ' + FONT;
      ctx.fillText(`${sp.step}턴째 · 소식을 아는 사람 ${informedPct}%`, m.l, 22);
      if (sim.t90 >= 0) { ctx.textAlign = 'right'; ctx.fillStyle = HOT; ctx.fillText(`90% 도달: ${sim.t90}턴`, w - m.r, 22); }
      ctx.font = '12px ' + FONT;
    }
    // 가까운 사람끼리의 연결
    ctx.strokeStyle = 'rgba(120,132,160,0.30)'; ctx.lineWidth = 1; ctx.beginPath();
    g.lattice.forEach(([a, b]) => { ctx.moveTo(pos[a][0], pos[a][1]); ctx.lineTo(pos[b][0], pos[b][1]); });
    ctx.stroke();
    // 약한 연결 (먼 사람과 잇는 선). 소식이 실제로 건너간 선은 굵고 진하게
    const carried = (a, b) => sp.via[b] === a || sp.via[a] === b;
    const arc = (a, b) => { const pa = pos[a], pb = pos[b], mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2; ctx.moveTo(pa[0], pa[1]); ctx.quadraticCurveTo(cx + (mx - cx) * 0.3, cy + (my - cy) * 0.3, pb[0], pb[1]); };
    const many = g.weak.length > 120;
    ctx.strokeStyle = mix(WEAK, many ? 0.28 : 0.5); ctx.lineWidth = many ? 1 : 1.5; ctx.beginPath();
    g.weak.forEach(([a, b]) => { if (!carried(a, b)) arc(a, b); }); ctx.stroke();
    ctx.strokeStyle = WEAK; ctx.lineWidth = 2.6; ctx.beginPath();
    g.weak.forEach(([a, b]) => { if (carried(a, b)) arc(a, b); }); ctx.stroke(); ctx.lineWidth = 1;
    // 사람들
    const r = Math.max(1.8, Math.min(5.2, ((R * Math.PI) / n) * 0.78)), scale = Math.max(8, isFinite(base0) ? base0 : 40);
    for (let i = 0; i < n; i++) {
      const t = sp.at[i];
      ctx.fillStyle = t < 0 ? '#cfd5e2' : nodeColor(t, scale);
      ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], r, 0, 7); ctx.fill();
      if (t >= 0 && t >= sp.step - 1 && t > 0) { ctx.strokeStyle = HOT; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], r + 2.2, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    }
    const s0 = pos[sim.params.start || 0]; ctx.strokeStyle = css('--text'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s0[0], s0[1], r + 3.5, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    // 범례
    if (!THUMB) {
      const items = [['dot', '#cfd5e2', '아직 모름'], ['dot', nodeColor(0, scale), '소식을 안 사람 (진할수록 일찍)'], ['ring', HOT, '방금 전해 들은 사람'], ['line', WEAK, '약한 연결 (먼 사람과 이은 선)'], ['ring', css('--text'), '처음 아는 사람']];
      ctx.font = '12px ' + FONT; ctx.textAlign = 'left';
      let lx = m.l, ly = h - (cw < 560 ? 60 : 24);
      items.forEach(([kind, col, text]) => {
        const tw = ctx.measureText(text).width, need = 18 + tw + 14;
        if (lx + need > w - m.r && lx > m.l) { lx = m.l; ly += 18; }
        ctx.fillStyle = col; ctx.strokeStyle = col;
        if (kind === 'dot') { ctx.beginPath(); ctx.arc(lx + 6, ly - 4, 5, 0, 7); ctx.fill(); }
        else if (kind === 'ring') { ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx + 6, ly - 4, 5, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        else { ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + 13, ly - 4); ctx.stroke(); ctx.lineWidth = 1; }
        ctx.fillStyle = css('--text'); ctx.fillText(text, lx + 18, ly);
        lx += need;
      });
    }
    $('when').textContent = `${sp.step}턴째 · 소식을 아는 사람 ${informedPct}%`;
  }

  // 사람을 누르면 그 사람이 소식을 처음 듣는다
  function pickNode(ev) {
    if (!sim || !geo) return;
    const rc = $('c-net').getBoundingClientRect(), x = ev.clientX - rc.left, y = ev.clientY - rc.top;
    let best = -1, bd = Infinity;
    pos.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = i; } });
    const lim = Math.max(14, (geo.R * Math.PI) / sim.g.n * 1.6);
    if (best >= 0 && Math.sqrt(bd) <= lim) { startNode = best; $('run').click(); }
  }

  // ---------- 로그 눈금 틀 ----------
  const XA = 0.0005, XB = 1;
  function logChart(id, y0, y1, yTicks, yFmt, aspect, yLabel, litems) {
    const sp = litems ? L.belowSpace($(id), litems) : null;
    const c = L.chart($(id), sp ? aspect + sp.extra / ($(id).clientWidth || 400) : aspect, { l: 50, b: sp ? sp.b : 44, r: 16 }), { m, pw, ph } = c;
    const X = (p) => m.l + ((Math.log10(p) - Math.log10(XA)) / (Math.log10(XB) - Math.log10(XA))) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    L.axes(c, { X, Y, yTicks, yFmt, xTicks: [0.001, 0.01, 0.1, 1], xFmt: (v) => pctText(v), xLabel: '약한 연결의 비율 p (%, 로그 눈금)', yLabel });
    const p = sim.params.p;
    if (p > 0) L.vline(c, X(p), css('--rich'), '지금 설정', Math.log10(p) > -1.5 ? 'right' : 'left');
    else { c.ctx.fillStyle = css('--rich'); c.ctx.textAlign = 'left'; L.label(c.ctx, '지금 설정: 약한 연결 0 (왼쪽 바깥)', c.m.l + 6, c.m.t + 12, 'left'); }
    return { c, X, Y };
  }

  // ---------- ② 작은 세상 그래프 ----------
  function drawSmall() {
    const SMALL_LEG = [{ kind: 'line', color: css('--accent'), label: '평균 거리' }, { kind: 'line', color: RICH, label: '친구 무리의 촘촘함' }];
    if (!sw) return;
    const { c, X, Y } = logChart('c-small', 0, 1, [0, 0.25, 0.5, 0.75, 1], (v) => Math.round(v * 100) + '%', 0.62, '없을 때를 100%로 한 값 (%)', SMALL_LEG), { ctx } = c;
    const Lp = sw.pts.map((d) => [X(d.x), Y(d.Lr)]), Cp = sw.pts.map((d) => [X(d.x), Y(d.Cr)]);
    L.line(ctx, Lp, css('--accent'), 2.8); L.line(ctx, Cp, RICH, 2.8);
    sw.pts.forEach((d) => { ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(d.x), Y(d.Lr), 3.2, 0, 7); ctx.fill(); ctx.fillStyle = RICH; ctx.beginPath(); ctx.arc(X(d.x), Y(d.Cr), 3.2, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, SMALL_LEG);
  }

  // ---------- ③ 소식이 퍼지는 속도 ----------
  function drawSpread() {
    if (!curves) return;
    const len = curveLen, xt = []; const stepx = len > 120 ? 40 : len > 60 ? 20 : 10; for (let v = 0; v <= len; v += stepx) xt.push(v);
    const c = L.chart($('c-spread'), ($('c-spread').clientWidth || 700) < 560 ? 0.95 : 0.62, { l: 50, b: 44, r: 16 }), { ctx, m, pw, ph } = c;
    const X = (t) => m.l + (t / len) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => Math.round(v * 100) + '%', xTicks: xt, xFmt: String, xLabel: '턴 (회)', yLabel: '소식을 아는 사람 (%)' });
    ctx.strokeStyle = css('--line'); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(m.l, Y(0.9)); ctx.lineTo(m.l + pw, Y(0.9)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; L.label(ctx, '90%', m.l + pw - 4, Y(0.9) - 4, 'right');
    const draw = (arr, color, wd) => L.line(ctx, arr.slice(0, len + 1).map((v, i) => [X(i), Y(v)]), color, wd);
    curves.fixed.forEach((arr, i) => draw(arr, CURVE_COLORS[i], 2.2));
    draw(curves.cur, css('--text'), 3.4);
    L.legend(c, [0, 1, 2, 3, 4].map((i) => ({ kind: 'line', color: CURVE_COLORS[i], label: '약한 연결 ' + ['0%', '0.5%', '2%', '10%', '100%'][i] })).concat([{ kind: 'line', color: css('--text'), label: '지금 설정' }]), 'br');
  }

  // ---------- ④ 90%에 닿는 시간 ----------
  function drawT90() {
    if (!sw) return;
    const z = sw.zero.T, top = Math.ceil((z * 1.08) / 10) * 10, yt = []; for (let v = 0; v <= top; v += top > 60 ? 20 : 10) yt.push(v);
    const { c, X, Y } = logChart('c-t90', 0, top, yt, (v) => v + '턴', 0.5, '90%에 닿는 시간 (턴)'), { ctx, m, pw } = c;
    ctx.setLineDash([5, 3]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(m.l, Y(z)); ctx.lineTo(m.l + pw, Y(z)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; L.label(ctx, `약한 연결이 없으면 ${f1(z)}턴`, m.l + pw - 4, Y(z) - 5, 'right');
    const pts = sw.pts.filter((d) => isFinite(d.T));
    L.line(ctx, pts.map((d) => [X(d.x), Y(d.T)]), WEAK, 2.8);
    pts.forEach((d) => { ctx.fillStyle = WEAK; ctx.beginPath(); ctx.arc(X(d.x), Y(d.T), 3.2, 0, 7); ctx.fill(); });
  }

  function renderStats() {
    const P = sim.params, sp = sim.sp, g = sim.g, n = g.n, total = g.weak.length + g.lattice.length;
    const fast = isFinite(base0) && isFinite(baseCur) && baseCur > 0 ? base0 / baseCur : NaN;
    const cards = [
      ['소식이 90%에 퍼지는 속도', isFinite(fast) ? `×${fast.toFixed(1)}` : '—', `평균 ${f1(baseCur)}턴 · 약한 연결이 없으면 ${f1(base0)}턴`],
      ['지금 소식을 아는 사람', `${Math.round((100 * sp.informed) / n)}%`, `${sp.step}턴째 · ${sp.informed}/${n}명`],
      ['이번에 90%에 닿기까지', sim.t90 >= 0 ? `${sim.t90}턴` : '아직', sim.t90 >= 0 ? '이 실행에서 걸린 시간' : '아직 퍼지는 중'],
      ['약한 연결', `${g.weak.length}개`, `전체 연결 ${total}개 중 ${(100 * g.weak.length / total).toFixed(1)}%`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawNet(); }

  function after() {
    const P = params(), base = { n: P.n, k: P.k, q: P.q, seed: P.seed };
    sw = W.sweep(base, GRID, 6);
    const z = W.curve(base, 0, 8, 1500), full = z.findIndex((v) => v >= 0.995);
    curveLen = Math.max(20, (full < 0 ? 200 : full) + 2);
    curves = { fixed: CURVE_PS.map((p) => (p === 0 ? z : W.curve(base, p, 8, curveLen + 1))).map((a) => a.slice(0, curveLen + 1)), cur: W.curve(base, P.p, 8, curveLen + 1) };
    drawSmall(); drawSpread(); drawT90();
  }

  const h = L.harness({
    controls: ['p', 'n', 'k', 'q'],
    format: { p: (v) => pctText(PS[Number(v)]), n: (v) => v + '명', k: (v) => v + '명', q: (v) => v + '%' },
    defaults: { p: 5, n: 300, k: 6, q: 50 },
    build() {
      const P = params(); sim = W.create(P);
      const base = { n: P.n, k: P.k, q: P.q, seed: P.seed };
      base0 = W.t90Mean(base, 0, 14); baseCur = P.p === 0 ? base0 : W.t90Mean(base, P.p, 14);
      if (THUMB) for (let i = 0; i < 400 && sim.informed < 0.62 * P.n && !sim.done(); i++) sim.advance();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    speedScale: 0.85,
    draw, after, redrawExtra() { drawSmall(); drawSpread(); drawT90(); }, seedLabel: '소문 번호',
  });
  seedGetter = h.seed;
  $('c-net').style.cursor = 'pointer';
  $('c-net').addEventListener('click', pickNode);
})();
