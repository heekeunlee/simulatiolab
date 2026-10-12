(function () {
  'use strict';
  const RG = window.Regression, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '12px -apple-system, "Apple SD Gothic Neo", sans-serif', FONTB = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영용: 전원이 나타난 장면으로 바로
  let sim = null, sweep = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), luck: Number($('luck').value) / 100, cut: Number($('cut').value) / 100, eff: Number($('eff').value), view: $('view').value });
  const f1 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
  const sports = () => sim.params.view === 'sports';
  const W = () => sports()
    ? { top: '표지를 장식한 쪽', bot: '최악의 시즌을 보낸 쪽', x: '올해 성적', y: '내년 성적' }
    : { top: '칭찬받은 쪽', bot: '혼난 쪽', x: '1회 점수', y: '2회 점수' };

  // ---------- ① 1회 점수 대 2회 점수 ----------
  function drawScatter() {
    const c = L.chart($('c-scatter'), 0.85, { l: 40, r: 14, t: 30, b: 44 }), { ctx, w, h, m, pw, ph } = c;
    const lo = 10, hi = 90, X = (v) => m.l + ((v - lo) / (hi - lo)) * pw, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    const tk = [10, 30, 50, 70, 90], wd = W(), S = sim.summary(), d = sim.data;
    L.axes(c, { X, Y, yTicks: tk, xTicks: tk, xLabel: wd.x });
    ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = css('--muted'); ctx.fillText(wd.y, 0, 0); ctx.restore();
    // 대각선 = 다음에도 똑같은 점수를 받는 선
    ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(X(lo), Y(lo)); ctx.lineTo(X(hi), Y(hi)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.font = FONTB; ctx.fillStyle = css('--text');
    if (!THUMB) ctx.fillText(sim.shown ? (w < 560 ? `${sim.shown}명 · 점선: 같은 점수 · 화살표: 평균 이동` : `${sim.shown}명 · 점선: 다음에도 같은 점수 · 화살표: 집단 평균의 이동`) : '재생을 누르면 한 명씩 나타나요', m.l, 18);
    ctx.font = FONT;
    const col = { 1: css('--lucky'), '-1': css('--unlucky'), 0: '#8a93a6' };
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < sim.shown; i++) {
      const g = d.grp[i]; if ((g === 0) !== (pass === 0)) continue;
      ctx.fillStyle = mix(col[g], g === 0 ? 0.28 : 0.85); ctx.beginPath(); ctx.arc(X(d.s1[i]), Y(d.s2[i]), g === 0 ? 2.3 : 3, 0, 7); ctx.fill();
    }
    // 집단 평균의 이동: 대각선 위(다음에도 같은 점수였다면) → 실제 2회 평균
    if (sim.shown > 20) {
      [1, -1].forEach((g) => {
        let k = 0, a1 = 0, a2 = 0; for (let i = 0; i < sim.shown; i++) if (d.grp[i] === g) { k++; a1 += d.s1[i]; a2 += d.s2[i]; }
        if (k < 3) return; a1 /= k; a2 /= k;
        const x = X(a1), y0 = Y(a1), y1 = Y(a2), c0 = col[g], dir = y1 > y0 ? 1 : -1;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = c0; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y0, 6, 0, 7); ctx.fill(); ctx.stroke();
        if (Math.abs(y1 - y0) > 12) {
          ctx.beginPath(); ctx.moveTo(x, y0 + dir * 7); ctx.lineTo(x, y1 - dir * 6); ctx.stroke();
          ctx.fillStyle = c0; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x - 6, y1 - dir * 10); ctx.lineTo(x + 6, y1 - dir * 10); ctx.closePath(); ctx.fill();
        }
        ctx.lineWidth = 1; ctx.font = FONTB; ctx.textAlign = g === 1 ? 'left' : 'right'; ctx.fillStyle = c0;
        const tx = x + (g === 1 ? 10 : -10), ty = (y0 + y1) / 2 + 4; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeText(`평균 ${f1(a2 - a1)}`, tx, ty); ctx.lineWidth = 1; ctx.fillText(`평균 ${f1(a2 - a1)}`, tx, ty); ctx.font = FONT;
      });
    }
    // 회귀선
    if (sim.shown > 5) {
      const a = S.intercept, b = S.slope, clip = (x) => Math.max(lo, Math.min(hi, a + b * x));
      L.line(ctx, [[X(lo), Y(clip(lo))], [X(hi), Y(clip(hi))]], css('--accent'), 2.5);
      ctx.fillStyle = css('--accent'); ctx.textAlign = 'left'; ctx.font = FONTB;
      if (!THUMB) ctx.fillText(`회귀선 기울기 ${S.slope.toFixed(2)}`, m.l + 8, m.t + 16);
      ctx.font = FONT;
    }
    $('when').textContent = `${sim.shown}/${sim.params.n}`;
  }

  // ---------- ② 집단별 평균 변화 ----------
  function drawBars() {
    const c = L.chart($('c-bars'), 0.62, { l: 44, r: 14, t: 28, b: 52 }), { ctx, m, pw, ph } = c;
    const S = sim.summary(), P = sim.params, wd = W(), T = RG.theory(P);
    const vals = [S.top, S.bot], real = [P.eff, sports() ? 0 : -P.eff];
    let mx = 10; vals.concat(real).forEach((v) => { mx = Math.max(mx, Math.abs(v)); }); mx = Math.ceil(mx / 5) * 5;
    const Y = (v) => m.t + ph / 2 - (v / mx) * (ph / 2), X0 = m.l;
    L.axes(c, { X: (v) => v, Y, yTicks: [-mx, -mx / 2, 0, mx / 2, mx], yFmt: (v) => (v > 0 ? '+' : '') + Math.round(v) });
    ctx.strokeStyle = css('--text'); ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(m.l + pw, Y(0)); ctx.stroke();
    ctx.font = FONTB; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
    ctx.fillText('다음 점수의 평균 변화 (점)', m.l, 16); ctx.font = FONT;
    const bw = Math.min(90, pw / 5), cx = [X0 + pw * 0.28, X0 + pw * 0.72], cols = [css('--lucky'), css('--unlucky')], names = [wd.top, wd.bot];
    vals.forEach((v, i) => {
      ctx.fillStyle = mix(cols[i], 0.85); const y0 = Y(0), y1 = Y(sim.shown ? v : 0);
      ctx.fillRect(cx[i] - bw / 2, Math.min(y0, y1), bw, Math.abs(y1 - y0));
      ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.font = FONTB;
      ctx.fillText(sim.shown ? f1(v) : '-', cx[i], v >= 0 ? y1 - 6 : y1 + 15); ctx.font = FONT;
      ctx.fillStyle = css('--muted'); ctx.fillText(names[i], cx[i], m.t + ph + 18);
      // 진짜 효과: 말이 실제로 만든 변화
      const ry = Y(real[i]); ctx.strokeStyle = '#d19200'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(cx[i] - bw / 2 - 10, ry); ctx.lineTo(cx[i] + bw / 2 + 10, ry); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    });
    ctx.fillStyle = '#d19200'; ctx.textAlign = 'right'; ctx.fillText(sports() ? '금색 점선: 표지의 진짜 효과' : '금색 점선: 말의 진짜 효과', m.l + pw, m.t + ph + 40);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left';
    ctx.fillText(`이론값 ${f1(T.top)} / ${f1(T.bot)}`, m.l, m.t + ph + 40);
  }

  // ---------- ③ 코치의 믿음 ----------
  function drawCoach() {
    const c = L.chart($('c-coach'), 0.5, { l: 20, r: 20, t: 40, b: 20 }), { ctx, w, h, m, pw } = c;
    const S = sim.summary(), T = RG.theory(sim.params), R = 30, X = (v) => m.l + ((Math.max(-R, Math.min(R, v)) + R) / (2 * R)) * pw, y = m.t + 22;
    const gap = sim.shown ? S.gap : 0;
    ctx.fillStyle = mix(css('--lucky'), 0.28); ctx.fillRect(m.l, y, pw / 2, 18); ctx.fillStyle = mix(css('--unlucky'), 0.28); ctx.fillRect(m.l + pw / 2, y, pw / 2, 18);
    ctx.font = FONT; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText(sports() ? '표지가 도움이 된다' : '칭찬이 효과 있다', m.l, y - 8);
    ctx.textAlign = 'right'; ctx.fillText(sports() ? '표지의 저주 · 부진은 반등한다' : '혼내는 게 효과 있다', m.l + pw, y - 8);
    ctx.strokeStyle = css('--text'); ctx.beginPath(); ctx.moveTo(m.l + pw / 2, y - 3); ctx.lineTo(m.l + pw / 2, y + 21); ctx.stroke();
    // 진짜 차이: 마름모
    const tg = T.trueGap, tx = X(tg); ctx.fillStyle = '#d19200'; ctx.beginPath(); ctx.moveTo(tx, y + 22); ctx.lineTo(tx - 6, y + 31); ctx.lineTo(tx + 6, y + 31); ctx.closePath(); ctx.fill();
    ctx.textAlign = tx > m.l + pw * 0.7 ? 'right' : 'left'; ctx.fillText(`▲ 진짜 차이 ${f1(tg)}`, tx + (tx > m.l + pw * 0.7 ? 6 : -6), y + 46);
    // 코치가 보는 차이: 바늘
    const gx = X(gap); ctx.fillStyle = css('--text'); ctx.fillRect(gx - 2, y - 6, 4, 30);
    ctx.font = FONTB; ctx.textAlign = 'center'; ctx.fillStyle = css('--text');
    const msg = !sim.shown ? '아직 아무것도 보지 못했어요' : gap > 2 ? (sports() ? `기자의 결론: 표지 저주가 있다 (차이 ${f1(gap)}점)` : `코치의 결론: 혼내는 게 낫다 (차이 ${f1(gap)}점)`) : gap < -2 ? (sports() ? `기자의 결론: 표지가 도움이 된다 (차이 ${f1(gap)}점)` : `코치의 결론: 칭찬이 낫다 (차이 ${f1(gap)}점)`) : `결론: 별 차이 없어 보인다 (차이 ${f1(gap)}점)`;
    ctx.fillText(msg, m.l + pw / 2, Math.max(y + 76, h - 40));
    ctx.font = FONT; ctx.fillStyle = css('--muted');
    ctx.fillText('차이 = 혼난 쪽의 평균 변화 − 칭찬받은 쪽의 평균 변화', m.l + pw / 2, Math.max(y + 96, h - 18));
  }

  // ---------- ④ 운의 몫에 따라 ----------
  function drawLuck() {
    const lim = (() => { let mx = 10; sweep.forEach((s) => s.pts.forEach((d) => d.runs.forEach((v) => { mx = Math.max(mx, Math.abs(v)); }))); return Math.ceil(mx / 4) * 4; })();
    const c = L.dots($('c-luck'), {
      data: [], y0: -lim, y1: lim, yFmt: (v) => (v > 0 ? '+' : '') + Math.round(v),
      series: sweep.map((s) => ({ data: s.pts, color: s.color, dots: true })),
      x0: 0, x1: 100, xTicks: [0, 20, 40, 60, 80, 100], xFmt: (v) => v + '%', xLabel: '점수의 흩어짐 중 운이 차지하는 몫',
      refs: [{ y: 0, label: '', color: '#8a93a6' }], marker: { x: sim.params.luck * 100, label: '지금 설정' },
    });
    const { ctx, m, pw, ph } = c, y0 = m.t + ph / 2; // 0 선은 가운데
    ctx.font = FONT; ctx.textAlign = 'right'; ctx.fillStyle = '#8a93a6'; ctx.fillText('변화 없음', m.l + pw - 4, y0 - 6);
  }

  function renderStats() {
    const P = sim.params, S = sim.summary(), T = RG.theory(P), wd = W(), has = sim.shown > 0;
    const effTxt = P.eff === 0 ? '진짜 효과 0' : `진짜 효과 ${f1(P.eff)}점`;
    const cards = [
      [`${wd.top}의 다음 변화`, has ? f1(S.top) : '-', `1회 상위 ${RG.summarize(sim.data, P.n).nTop}명 · ${effTxt}`],
      [`${wd.bot}의 다음 변화`, has ? f1(S.bot) : '-', `1회 하위 ${RG.summarize(sim.data, P.n).nBot}명 · ${effTxt}`],
      [sports() ? '기자가 얻는 차이' : '코치가 얻는 차이', has ? f1(S.gap) : '-', '혼난 쪽 변화 − 칭찬받은 쪽 변화'],
      ['회귀선 기울기', has ? S.slope.toFixed(2) : '-', `운 ${(P.luck * 100).toFixed(0)}%이면 이론상 약 ${T.slope.toFixed(2)}`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawScatter(); drawBars(); drawCoach(); }

  function after() {
    const P = params(); sweep = [
      { color: '#1fa463', pts: [], key: 'top' },
      { color: '#e5484d', pts: [], key: 'bot' },
    ];
    drawLuck(); $('note-l').textContent = '계산 중…';
    const jobs = [];
    for (let l = 0; l <= 100; l += 10) jobs.push(() => {
      const rs = [1, 2, 3].map((k) => RG.study(Object.assign({}, P, { luck: l / 100 }), 40, k * 13));
      sweep.forEach((s) => { const runs = rs.map((r) => r[s.key]); s.pts.push({ x: l, runs, mean: L.mean(runs) }); });
    });
    L.jobs(jobs, drawLuck, () => {
      const a = sweep[0].pts, b = sweep[1].pts, e = a.length - 1;
      const nm = sports() ? ['표지 그룹', '최악의 시즌 그룹'] : ['칭찬받은 쪽', '혼난 쪽'];
      $('note-l').innerHTML = '운이 0%이면 변화는 거의 0이고, 100%이면 ' + `<b>${nm[0]} ${f1(a[e].mean)}</b> · <b>${nm[1]} ${f1(b[e].mean)}</b>`;
    });
  }

  const h = L.harness({
    controls: ['n', 'luck', 'cut', 'eff', 'view'],
    format: { n: (v) => v + '명', luck: (v) => v + '%', cut: (v) => v + '%', eff: (v) => f1(Number(v)) + '점', view: () => '' },
    defaults: { n: 400, luck: 50, cut: 20, eff: 0, view: 'coach' },
    build() { const P = params(); sim = RG.create(P); },
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawLuck(); },
  });
  seedGetter = h.seed;
  if (THUMB) { sim.run(); draw(); }
})();
