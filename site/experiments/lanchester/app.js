(function () {
  'use strict';
  const LC = window.Lanchester, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const BLUE = '#2f6fed', RED = '#e5484d', GRAY = '#8a93a6', DEAD = '#cdd3df';
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 전투가 한창인 장면으로 바로 간다
  let sim = null, ghost = null, seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), a: Number($('a').value), b: Number($('b').value), q: Number($('q').value), law: $('law').value, split: $('split').value });
  const f1 = (v) => v.toFixed(1);
  const f2 = (v) => v.toFixed(2);
  const T = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);

  // ---------- 결과 문구 ----------
  // 이론 결과를 한 줄로: 누가 이기고 처음 병력의 몇 %가 남는가
  function resText(o, a, b) {
    if (!o.winner) return '막상막하 · 서로 전멸';
    const left = o.winner === 'a' ? o.aLeft : o.bLeft, start = o.winner === 'a' ? a : b;
    return `${o.winner === 'a' ? '파랑 승' : '빨강 승'} · ${Math.round((100 * left) / start)}% 남음`;
  }

  // ---------- ① 전장 ----------
  // 한쪽 군대의 점 위치. 무리(그룹)별로 가운데 선에서 바깥쪽으로 칸을 채운다
  function layout(n, groups, dir, front, cy, d, rowsAvail) {
    const pos = new Array(n); let off = 0, idx = 0;
    groups.forEach((ng) => {
      const rows = Math.min(rowsAvail, Math.max(4, Math.ceil(Math.sqrt(ng * 1.8)))), cols = Math.ceil(ng / rows), used = Math.min(rows, ng);
      for (let k = 0; k < ng; k++) {
        const col = Math.floor(k / rows), row = k % rows;
        pos[idx++] = [front + dir * (off + col + 0.5) * d, cy - ((used - 1) / 2) * d + row * d];
      }
      off += cols + 2;
    });
    return { pos, cols: off - 2 };
  }
  function drawField() {
    const cw = $('c-field').clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 1.0 : 0.46;
    const fItems = [{ kind: 'dot', color: DEAD, label: '쓰러진 병사' }, { kind: 'dot', color: mix(BLUE, 0.4), label: '아직 도착하지 않은 무리' }], fsp = L.belowSpace($('c-field'), fItems);
    const c = L.chart($('c-field'), THUMB ? asp : asp + (fsp.b - 30) / cw, { l: 10, r: 10, t: THUMB ? 8 : 62, b: THUMB ? 8 : fsp.b }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const P = sim.params, S = sim.armies, cnt = sim.counts(), cy = m.t + ph / 2, mid = m.l + pw / 2, gap = Math.max(16, pw * 0.09);
    const sizes = (s, n, sp) => (sp ? [Math.floor(n / 2), n - Math.floor(n / 2)] : [n]);
    const ga = sizes(0, P.a, P.split === 'a'), gb = sizes(1, P.b, P.split === 'b');
    // 점 간격: 두 군대가 모두 칸 안에 들어가는 가장 큰 값
    const half = (pw - gap) / 2; let d = 20, la, lb;
    for (; d > 3; d -= 0.5) {
      const ra = Math.floor(ph / d);
      la = layout(P.a, ga, -1, mid - gap / 2, cy, d, ra); lb = layout(P.b, gb, 1, mid + gap / 2, cy, d, ra);
      if (Math.max(la.cols, lb.cols) * d <= half) break;
    }
    const pos = [la.pos, lb.pos], cols = [BLUE, RED], r = d * 0.36;
    // 총알 자국과 일대일 짝
    ctx.lineWidth = 1;
    if (!sim.done()) {
      if (P.law === 'linear') {
        ctx.strokeStyle = 'rgba(120,130,150,0.22)'; ctx.beginPath();
        sim.pairs.forEach(([i, j]) => { ctx.moveTo(pos[0][i][0], pos[0][i][1]); ctx.lineTo(pos[1][j][0], pos[1][j][1]); }); ctx.stroke();
      }
      sim.events.forEach(([s, i, t, j]) => {
        ctx.strokeStyle = mix(cols[s], P.law === 'linear' ? 0.55 : 0.4); ctx.beginPath();
        ctx.moveTo(pos[s][i][0], pos[s][i][1]); ctx.lineTo(pos[t][j][0], pos[t][j][1]); ctx.stroke();
      });
    }
    for (let s = 0; s < 2; s++) {
      const A = S[s];
      for (let i = 0; i < A.n; i++) {
        const [x, y] = pos[s][i];
        if (!A.alive[i]) { ctx.fillStyle = DEAD; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill(); continue; }
        const reserve = A.grp[i] !== A.active;
        ctx.fillStyle = reserve ? mix(cols[s], 0.4) : cols[s]; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }
    if (THUMB) return;
    L.drawLegendBelow(c, fItems);
    // 글자
    ctx.font = '700 15px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = BLUE; ctx.fillText(`파랑 ${cnt[0]}명`, m.l, 24);
    ctx.textAlign = 'right'; ctx.fillStyle = RED; ctx.fillText(`빨강 ${cnt[1]}명`, w - m.r, 24);
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted');
    ctx.textAlign = 'left'; ctx.fillText(`처음 ${P.a}명`, m.l, 42); ctx.textAlign = 'right'; ctx.fillText(`처음 ${P.b}명`, w - m.r, 42);
    ctx.textAlign = 'center';
    if (sim.done()) {
      const res = sim.result(), win = res.winner, left = win === 'a' ? res.aLeft : res.bLeft, start = win === 'a' ? P.a : P.b;
      ctx.font = '700 15px ' + FONT; ctx.fillStyle = win === 'a' ? BLUE : win === 'b' ? RED : css('--text');
      ctx.fillText(win ? `${win === 'a' ? '파랑' : '빨강'} 승 · ${left}명 남음 (${Math.round((100 * left) / start)}%)` : '서로 전멸', mid, 24 + (cw < 560 ? 36 : 0));
    }
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted');
    const capL = P.law === 'square' ? '사각 법칙: 병력 모두가 상대 아무에게나 겨눈다' : '선형 법칙: 일대일로 맞붙는다';
    const cap = P.split === 'none' ? capL : P.split === 'a' ? capL + ' · 파랑은 둘로 나뉘어 차례로 도착' : capL + ' · 빨강은 둘로 나뉘어 차례로 도착';
    ctx.fillText(cap, mid, h - 10);
    $('when').textContent = `${sim.step}단계 · ${sim.done() ? '전투 끝' : '전투 중'}`;
  }

  // ---------- 차트 공통 ----------
  function stepChart(id, ymax, yTicks, yFmt, yLabel, items) {
    const sp = items ? L.belowSpace($(id), items) : null;
    const c = L.chart($(id), 0.58 + (sp ? sp.extra / ($(id).clientWidth || 400) : 0), { l: 50, b: sp ? sp.b : 40, r: 14, t: 24 }), { m, pw, ph } = c, X0 = Math.max(30, Math.ceil(ghost.step / 10) * 10);
    const X = (v) => m.l + (v / X0) * pw, Y = (v) => m.t + ph - (v / ymax) * ph, xt = [];
    const stepv = X0 <= 60 ? 10 : X0 <= 150 ? 25 : 50; for (let t = 0; t <= X0; t += stepv) xt.push(t);
    L.axes(c, { X, Y, yTicks, yFmt, xTicks: xt, xFmt: String, xLabel: '시간 (단계)', yLabel });
    return { c, X, Y };
  }
  // ---------- ② 남은 병력 ----------
  function drawCount() {
    const P = sim.params, ymax = Math.max(P.a, P.b);
    const cItems = [{ kind: 'line', color: BLUE, label: '파랑' }, { kind: 'line', color: RED, label: '빨강' }].concat(P.split === 'none' ? [{ kind: 'dash', color: GRAY, label: '점선: 기대 곡선' }] : []);
    const { c, X, Y } = stepChart('c-count', ymax, [0, 0.25, 0.5, 0.75, 1].map((v) => v * ymax), (v) => String(Math.round(v)), '남은 병사 (명)', cItems);
    const { ctx } = c, H = sim.hist;
    if (P.split === 'none') { // 평균 곡선 (점선)
      const mf = LC.meanField(P, ghost.step + 10);
      [['a', BLUE], ['b', RED]].forEach(([k, col]) => { ctx.setLineDash([5, 4]); L.line(ctx, mf.map((d, i) => [X(i), Y(d[k])]), mix(col, 0.55), 1.8); ctx.setLineDash([]); });
    }
    L.line(ctx, H.map((d, i) => [X(i), Y(d.a)]), BLUE, 2.8);
    L.line(ctx, H.map((d, i) => [X(i), Y(d.b)]), RED, 2.8);
    const e = H[H.length - 1], i = H.length - 1;
    [[e.a, BLUE], [e.b, RED]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(i), Y(v), 4, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, cItems);
  }
  // ---------- ③ 전투력 ----------
  function drawPower() {
    const P = sim.params, al = Math.sqrt(P.q), be = 1 / Math.sqrt(P.q), norm = Math.max(LC.strength(P.law, P.a, al), LC.strength(P.law, P.b, be));
    const ev = (n, q) => (100 * LC.strength(P.law, n, q)) / norm;
    const { c, X, Y } = stepChart('c-power', 100, [0, 25, 50, 75, 100], (v) => String(v), '전투력 (%)');
    const { ctx } = c, H = sim.hist;
    L.line(ctx, H.map((d, i) => [X(i), Y(ev(d.ea, al))]), BLUE, 2.8);
    L.line(ctx, H.map((d, i) => [X(i), Y(ev(d.eb, be))]), RED, 2.8);
    const i = H.length - 1, e = H[i];
    [[ev(e.ea, al), BLUE], [ev(e.eb, be), RED]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(i), Y(v), 4, 0, 7); ctx.fill(); });
    L.legend(c, [{ kind: 'line', color: BLUE, label: '파랑' }, { kind: 'line', color: RED, label: '빨강' }], 'tr');
  }
  // ---------- ④ 나뉘면 어떻게 되나 (이론값 비교) ----------
  function drawCompare() {
    const P = sim.params, big = P.a >= P.b ? 'a' : 'b', small = big === 'a' ? 'b' : 'a';
    const rows = [
      ['사각 법칙 · 모여서', 'square', 'none'], ['사각 법칙 · 큰 쪽이 나뉘면', 'square', big], ['사각 법칙 · 작은 쪽이 나뉘면', 'square', small],
      ['선형 법칙 · 모여서', 'linear', 'none'], ['선형 법칙 · 큰 쪽이 나뉘면', 'linear', big],
    ];
    const cw = $('c-cmp').clientWidth || 600, mob = cw < 560, rh = mob ? 52 : 40;
    const c = L.chart($('c-cmp'), (rows.length * rh + 20) / cw, { l: 10, r: 10, t: 6, b: 14 }), { ctx, w, m, pw } = c;
    const lw = mob ? 0 : Math.min(250, pw * 0.34), bx = m.l + lw, bw = pw - lw - (mob ? 0 : 150);
    rows.forEach(([name, law, sp], k) => {
      const o = LC.outcome(law, P.a, P.b, P.q, sp), y = m.t + k * rh, cur = law === P.law && sp === P.split;
      if (cur) { ctx.fillStyle = mix(GRAY, 0.12); ctx.fillRect(m.l - 4, y, pw + 8, rh - 4); }
      ctx.font = (cur ? '700 ' : '') + '13px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = css('--text');
      const by = mob ? y + 22 : y + 9;
      ctx.fillText(name, m.l, mob ? y + 15 : y + 22);
      const start = o.winner === 'a' ? P.a : P.b, left = o.winner === 'a' ? o.aLeft : o.bLeft, frac = o.winner ? left / start : 0;
      const bw2 = mob ? pw - 120 : bw;
      ctx.fillStyle = mix(GRAY, 0.15); ctx.fillRect(mob ? m.l : bx, by, bw2, 16);
      if (o.winner) { ctx.fillStyle = o.winner === 'a' ? BLUE : RED; ctx.fillRect(mob ? m.l : bx, by, Math.max(2, bw2 * frac), 16); }
      ctx.font = '12px ' + FONT; ctx.fillStyle = css('--text');
      ctx.fillText(resText(o, P.a, P.b), (mob ? m.l + bw2 : bx + bw2) + 8, by + 12);
    });
  }
  // ---------- ⑤ 누가 이기나: 병력 비율 × 질 비율 ----------
  const XR = 3, YR = 2; // 2의 거듭제곱: 병력 1/8~8배, 질 1/4~4배
  function drawPhase() {
    const pItems = [{ kind: 'line', color: css('--text'), label: '사각 법칙 균형선' }, { kind: 'dash', color: css('--text'), label: '선형 법칙 균형선' }], psp = L.belowSpace($('c-phase'), pItems);
    const P = sim.params, c = L.chart($('c-phase'), ($('c-phase').clientWidth < 560 ? 0.9 : 0.62) + psp.extra / ($('c-phase').clientWidth || 400), { l: 52, b: psp.b, r: 14, t: 24 }), { ctx, m, pw, ph } = c;
    const X = (e) => m.l + ((e + XR) / (2 * XR)) * pw, Y = (e) => m.t + ph - ((e + YR) / (2 * YR)) * ph;
    const NX = 72, NY = 48;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const ex = -XR + ((i + 0.5) / NX) * 2 * XR, ey = -YR + ((j + 0.5) / NY) * 2 * YR;
      const o = LC.outcome(P.law, Math.pow(2, ex), 1, Math.pow(2, ey), P.split);
      if (!o.winner) { ctx.fillStyle = mix(GRAY, 0.3); } else {
        const fr = o.winner === 'a' ? o.aLeft / Math.pow(2, ex) : o.bLeft;
        ctx.fillStyle = mix(o.winner === 'a' ? BLUE : RED, 0.1 + 0.6 * Math.min(1, fr));
      }
      const x0 = Math.round(m.l + (i / NX) * pw), x1 = Math.round(m.l + ((i + 1) / NX) * pw), y0 = Math.round(m.t + ph - ((j + 1) / NY) * ph), y1 = Math.round(m.t + ph - (j / NY) * ph);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    const ticks = [-3, -2, -1, 0, 1, 2, 3], tl = (e) => (e === 0 ? '1:1' : e > 0 ? `${Math.pow(2, e)}:1` : `1:${Math.pow(2, -e)}`);
    ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.textAlign = 'center';
    ticks.forEach((e) => ctx.fillText(tl(e), X(e), m.t + ph + 16));
    ctx.textAlign = 'right'; [-2, -1, 0, 1, 2].forEach((e) => ctx.fillText(tl(e), m.l - 6, Y(e) + 4));
    L.axisNames(c, '병력 비율 (파랑 : 빨강)', '질 비율 (파랑 : 빨강)');
    ctx.strokeStyle = css('--line'); ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw - 1, ph - 1);
    // 균형선: 사각 법칙 qr²=1 (실선), 선형 법칙 qr=1 (점선)
    const curve = (k, dash, col) => {
      ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
      let on = false; for (let e = -XR; e <= XR + 1e-9; e += 0.05) { const y = -k * e; if (y < -YR || y > YR) { on = false; continue; } on ? ctx.lineTo(X(e), Y(y)) : ctx.moveTo(X(e), Y(y)); on = true; }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    };
    curve(2, [], css('--text')); curve(1, [6, 4], css('--text'));
    ctx.font = '700 13px ' + FONT; ctx.fillStyle = BLUE; ctx.textAlign = 'right'; L.label(ctx, '파랑 우세', m.l + pw - 8, m.t + 22, 'right'); ctx.fillStyle = RED; ctx.textAlign = 'left'; L.label(ctx, '빨강 우세', m.l + 8, m.t + ph - 10, 'left');
    // 지금 설정
    const ex = Math.max(-XR, Math.min(XR, Math.log2(P.a / P.b))), ey = Math.max(-YR, Math.min(YR, Math.log2(P.q)));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = css('--text'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(ex), Y(ey), 7, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
    ctx.font = '600 12px ' + FONT; ctx.fillStyle = css('--text');
    ctx.textAlign = ex > 0 ? 'right' : 'left'; L.label(ctx, '지금 설정', X(ex) + (ex > 0 ? -12 : 12), Y(ey) + (ey > 0 ? 20 : -12), ex > 0 ? 'right' : 'left');
    L.drawLegendBelow(c, pItems);
    const r = P.a / P.b;
    $('note-p').innerHTML = `<span>파랑 병력이 빨강의 ${f2(r)}배일 때 막상막하가 되려면 빨강의 질이 파랑의</span> <span>사각 법칙</span> <b>${f2(r * r)}배</b> · <span>선형 법칙</span> <b>${f2(r)}배</b>`;
  }

  function renderStats() {
    const P = sim.params, ratio = LC.strengthRatio(P.law, P.a, P.b, P.q), o = LC.outcome(P.law, P.a, P.b, P.q, P.split);
    const other = LC.outcome(P.law === 'square' ? 'linear' : 'square', P.a, P.b, P.q, P.split), cnt = sim.counts();
    const cards = [
      ['전투력 비율 (파랑 ÷ 빨강)', `×${f1(ratio)}`, P.law === 'square' ? `병력 ${f1(P.a / P.b)}배 × 질 ${f2(P.q)}배 → 병력은 제곱으로 작용` : `병력 ${f1(P.a / P.b)}배 × 질 ${f2(P.q)}배 → 병력은 그대로 작용`],
      ['지금 남은 병력', `${cnt[0]} : ${cnt[1]}`, '파랑 : 빨강'],
      ['이론상 결과 (이 설정)', resText(o, P.a, P.b), '연속 근사로 계산한 값'],
      [P.law === 'square' ? '선형 법칙이었다면' : '사각 법칙이었다면', resText(other, P.a, P.b), '같은 설정, 법칙만 바꿔서'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s], i) => `<div class="stat"><div class="k">${k}</div><div class="v"${i === 2 || i === 3 ? ' style="font-size:1.25rem"' : ''}>${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawField(); drawCount(); drawPower(); }
  function after() { drawCompare(); drawPhase(); }

  const h = L.harness({
    controls: ['a', 'b', 'q', 'law', 'split'],
    format: { a: (v) => v + '명', b: (v) => v + '명', q: (v) => '×' + Number(v), law: () => '', split: () => '' },
    defaults: { a: 200, b: 100, q: 1, law: 'square', split: 'none' },
    build() {
      const P = params(); sim = LC.create(P); ghost = LC.create(P).run();
      if (THUMB) for (let k = 0; k < 24 && !sim.done(); k++) sim.advance();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawCompare(); drawPhase(); }, seedLabel: '전투 번호',
  });
  seedGetter = h.seed;

  // 예시 장면 버튼
  const PRESETS = { pr1: { a: 200, b: 100, q: 1, law: 'square', split: 'none' }, pr2: { a: 130, b: 100, q: 1, law: 'square', split: 'a' },
    pr3: { a: 200, b: 100, q: 1, law: 'linear', split: 'none' }, pr4: { a: 200, b: 100, q: 0.25, law: 'square', split: 'none' } };
  Object.keys(PRESETS).forEach((id) => {
    const btn = $(id); if (!btn) return;
    btn.addEventListener('click', () => { Object.entries(PRESETS[id]).forEach(([k, v]) => { $(k).value = v; }); $('a').dispatchEvent(new Event('input')); $('q').dispatchEvent(new Event('input')); $('a').dispatchEvent(new Event('change')); });
  });
})();
