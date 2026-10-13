(function () {
  'use strict';
  const CO = window.Coincidence, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const ATTRS = ['생일', '고향', '취미', '같은 학교', '좋아하는 음식', '가 본 여행지'];
  const NMAX = 100, SIMN_A = [5, 10, 15, 20, 23, 30, 40, 50, 60, 70, 80, 90, 100], SIMN_B = [10, 25, 50, 100, 150, 200, 254, 300, 365];
  const GOLD = '#d19200';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영용: 일치한 쌍이 여럿 있는 모임 하나
  let sim = null, rowsA = [], rowsB = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), k: Number($('k').value), pool: Number($('pool').value) });
  const pc = (v) => (v * 100 < 99.95 ? (v * 100).toFixed(1) : v * 100 < 100 ? '99.9+' : '100') + '%';
  const nOthers50 = () => CO.smallestN((n) => CO.theoryMe(n, 1, 30), 0.5, 2000) - 1;

  // ---------- ① 방 하나 (원 둘레에 사람, 가능한 모든 짝은 옅은 실로, 일치한 쌍은 굵은 선으로) ----------
  const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const dayName = (d) => { let m = 0; while (d >= MD[m]) { d -= MD[m]; m++; } return `${m + 1}/${d + 1}`; };
  const valName = (j, v) => (j === 0 ? dayName(v) : `${ATTRS[j]} ${v + 1}번`);
  function drawRoom() {
    const cv = $('c-room'), cw = cv.clientWidth || 600, cols = 50, cell = Math.min(14, (cw - 28) / cols);
    const wh = THUMB ? 0 : Math.ceil(sim.params.rounds / cols) * cell + 30; // 아래: 지금까지 모임 기록 (칸 하나 = 모임 하나)
    const ringH = THUMB ? cw : Math.min(cw * 0.78, 560);
    const c = L.chart(cv, (ringH + wh + (THUMB ? 0 : 82)) / cw, { l: 14, r: 14, t: THUMB ? 8 : 34, b: THUMB ? 8 : wh + 48 }), { ctx, w, h, m, pw, ph } = c;
    const P = sim.params, a = sim.last;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 13px ' + FONT;
    if (!a) { ctx.fillStyle = css('--muted'); ctx.fillText('재생을 누르면 모임이 열려요', m.l, 24); }
    else {
      const n = P.n, cx = m.l + pw / 2, cy = m.t + ph / 2 + 4, R = Math.min(pw, ph) / 2 - (THUMB ? 34 : 26);
      const pos = (i) => { const t = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + R * Math.cos(t), cy + R * Math.sin(t)]; };
      if (!THUMB) ctx.fillText(`${sim.round}번째 모임 · ${n}명 · 가능한 짝 ${CO.pairsOf(n)}쌍`, m.l, 22);
      // 가능한 모든 짝: 옅은 실 (사람이 조금만 늘어도 실이 빽빽해진다)
      if (n <= 70) {
        ctx.lineWidth = THUMB ? 0.8 : 0.6; ctx.strokeStyle = mix('#8a93a6', n > 40 ? 0.12 : THUMB ? 0.4 : 0.22); ctx.beginPath();
        for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) { const A = pos(x), B = pos(y); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
        ctx.stroke();
      }
      const lw = a.pairs.length > 600 ? 0.5 : a.pairs.length > 150 ? 0.9 : THUMB ? 4 : 2.4;
      ctx.lineWidth = lw; ctx.strokeStyle = mix(css('--accent'), a.pairs.length > 600 ? 0.25 : 0.85);
      a.pairs.forEach((q) => { if (q.a === 0) return; const A = pos(q.a), B = pos(q.b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); });
      ctx.lineWidth = THUMB ? 4.5 : 2.8; ctx.strokeStyle = css('--unlucky');
      a.pairs.forEach((q) => { if (q.a !== 0) return; const A = pos(0), B = pos(q.b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); });
      ctx.lineWidth = 1;
      const r = Math.max(2.2, Math.min(THUMB ? 9 : 6.5, (Math.PI * R) / n * 0.8));
      for (let i = 1; i < n; i++) {
        const p = pos(i); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7);
        ctx.fillStyle = a.has[i] ? css('--accent') : '#ffffff'; ctx.fill(); ctx.strokeStyle = a.has[i] ? css('--accent') : '#8a93a6'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.lineWidth = 1;
      }
      const p0 = pos(0); ctx.beginPath(); ctx.arc(p0[0], p0[1], r + 3, 0, 7); ctx.fillStyle = a.meCount ? css('--unlucky') : '#ffffff'; ctx.fill();
      ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = 2.4; ctx.stroke(); ctx.lineWidth = 1;
      if (!THUMB) {
        ctx.fillStyle = css('--unlucky'); ctx.textAlign = 'center'; ctx.font = '600 12px ' + FONT; ctx.fillText('나', p0[0], p0[1] - r - 8);
        // 일치한 사람 곁에 같은 값 (최대 12명)
        if (a.pairs.length <= 12) {
          ctx.font = '600 11px ' + FONT;
          a.pairs.forEach((q) => [q.a, q.b].forEach((i) => {
            if (i === 0) return;
            const t = -Math.PI / 2 + (i / n) * Math.PI * 2, x = cx + (R + r + 14) * Math.cos(t), y = cy + (R + r + 14) * Math.sin(t) + 4;
            ctx.textAlign = Math.cos(t) > 0.3 ? 'left' : Math.cos(t) < -0.3 ? 'right' : 'center';
            ctx.fillStyle = q.a === 0 ? css('--unlucky') : css('--accent'); ctx.fillText(valName(q.attrs[0], a.vals[q.attrs[0]][i]), x - (ctx.textAlign === 'left' ? 6 : ctx.textAlign === 'right' ? -6 : 0), y);
          }));
        }
        ctx.textAlign = 'left'; ctx.font = '600 13px ' + FONT;
        const ty = m.t + ph + 22;
        ctx.fillStyle = a.pairs.length ? css('--text') : css('--muted');
        ctx.fillText(`이번 모임: 일치한 쌍 ${a.pairs.length}개 · 나와 일치하는 사람 ${a.meCount}명`, m.l, ty);
        ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
        const ex = a.pairs.find((q) => q.a === 0) || a.pairs[0];
        ctx.fillText(!ex ? '이번 모임에는 일치하는 쌍이 없어요' : ex.a === 0 ? `예: 나 ↔ ${ex.b}번 · 같은 ${ATTRS[ex.attrs[0]]}` : `예: ${ex.a}번 ↔ ${ex.b}번 · 같은 ${ATTRS[ex.attrs[0]]}`, m.l, ty + 18);
        // 지금까지 모임 기록: 칸 하나가 모임 하나 (파랑 = 어딘가에서 일치, 빨강 테두리 = 나와 일치)
        const wy = ty + 40;
        ctx.font = '600 12px ' + FONT; ctx.fillStyle = css('--text');
        ctx.fillText(`지금까지 ${sim.round}번 중 ${sim.anyN}번 일치 (${pc(sim.anyShare())}) · 계산값 ${pc(CO.theoryAny(n, P.k, P.pool))}`, m.l, wy);
        for (let k = 0; k < P.rounds; k++) {
          const x = m.l + (k % cols) * cell, y = wy + 10 + Math.floor(k / cols) * cell;
          ctx.fillStyle = k >= sim.round ? '#e8ecf3' : sim.log[k] & 1 ? css('--accent') : '#c3cad6';
          ctx.fillRect(x + 0.5, y + 0.5, cell - 1.5, cell - 1.5);
          if (k < sim.round && sim.log[k] & 2) { ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = Math.max(1.2, cell / 6); ctx.strokeRect(x + 1.5, y + 1.5, cell - 3.5, cell - 3.5); ctx.lineWidth = 1; }
        }
      }
    }
    if (!THUMB && a) L.legend(c, [{ kind: 'line', color: '#b3b9c7', label: '가능한 모든 짝 (옅은 실)' }, { kind: 'line', color: css('--accent'), label: '일치한 쌍' }, { kind: 'line', color: css('--unlucky'), label: '나와 일치' }, { kind: 'box', color: css('--accent'), label: '일치가 있던 모임 (아래 칸)' }, { kind: 'box', color: '#c3cad6', label: '일치가 없던 모임 (아래 칸)' }].slice(0, w < 440 ? 3 : 5), 'bl');
    $('when').textContent = `${sim.round}/${P.rounds}번 · 일치가 있던 모임 ${pc(sim.anyShare())}`;
  }

  // ---------- 공통: 확률-인원 그래프 틀 ----------
  function frame(canvas, x1, xticks, aspect) {
    const c = L.chart(canvas, aspect || 0.62, { b: 40, r: 14 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + ((v - 2) / (x1 - 2)) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: L.pct, xTicks: xticks, xFmt: (v) => v + '명', xLabel: '모인 사람 수 (명)', yLabel: '확률 (%)' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = '#8a93a6'; ctx.beginPath(); ctx.moveTo(m.l, Y(0.5)); ctx.lineTo(m.l + pw, Y(0.5)); ctx.stroke(); ctx.setLineDash([]);
    return { c, X, Y };
  }
  function curve(f, x1, X, Y, ctx, color, width, dash) {
    const pts = []; for (let n = 2; n <= x1; n++) pts.push([X(n), Y(f(n))]);
    if (dash) ctx.setLineDash(dash); L.line(ctx, pts, color, width); ctx.setLineDash([]);
  }
  function simDots(rows, key, X, Y, ctx, color) {
    ctx.fillStyle = color; rows.forEach((r) => { ctx.beginPath(); ctx.arc(X(r.n), Y(r[key]), 3.4, 0, 7); ctx.fill(); });
  }

  // ---------- ② 어딘가에서 일치할 확률 ----------
  function drawA() {
    const P = sim.params, { c, X, Y } = frame($('c-a'), NMAX, [2, 23, 40, 60, 80, 100]), { ctx } = c;
    curve((n) => CO.theoryAny(n, 1, P.pool), NMAX, X, Y, ctx, css('--muted'), 2, [6, 4]);
    curve((n) => CO.theoryAny(n, P.k, P.pool), NMAX, X, Y, ctx, css('--accent'), 2.6);
    simDots(rowsA, 'any', X, Y, ctx, css('--accent'));
    L.vline(c, X(P.n), css('--rich'), '지금 설정', P.n > 50 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '지금 설정 (선: 계산, 점: 직접 돌림)' }, { kind: 'dash', color: css('--muted'), label: '생일만 (계산)' }], 'br');
  }
  // ---------- ③ 어딘가 vs 나와 ----------
  function drawB() {
    const P = sim.params, X1 = 365, { c, X, Y } = frame($('c-b'), X1, [2, 100, 200, 254, 365]), { ctx } = c;
    curve((n) => CO.theoryAny(n, P.k, P.pool), X1, X, Y, ctx, css('--accent'), 2.6);
    curve((n) => CO.theoryMe(n, P.k, P.pool), X1, X, Y, ctx, css('--unlucky'), 2.6);
    curve((n) => CO.theoryMe(n, 1, P.pool), X1, X, Y, ctx, css('--unlucky'), 1.8, [6, 4]);
    simDots(rowsB, 'any', X, Y, ctx, css('--accent')); simDots(rowsB, 'me', X, Y, ctx, css('--unlucky'));
    L.vline(c, X(P.n), css('--rich'), '지금 설정', P.n > X1 / 2 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '어딘가에서 일치' }, { kind: 'line', color: css('--unlucky'), label: '나와 일치' }, { kind: 'dash', color: css('--unlucky'), label: '나와 일치, 생일만 (계산)' }], 'br');
  }
  // ---------- ④ 짝의 수 ----------
  function drawC() {
    const P = sim.params, c = L.chart($('c-c'), 0.62, { b: 40, r: 14 }), { ctx, m, pw, ph } = c;
    const ymax = 5000, X = (v) => m.l + ((v - 2) / (NMAX - 2)) * pw, Y = (v) => m.t + ph - (v / ymax) * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1].map((q) => q * ymax), yFmt: (v) => String(Math.round(v)), xTicks: [2, 23, 40, 60, 80, 100], xFmt: (v) => v + '명', xLabel: '모인 사람 수 (명)', yLabel: '개수 (명·쌍)' });
    const pts = (f) => { const a = []; for (let n = 2; n <= NMAX; n++) a.push([X(n), Y(f(n))]); return a; };
    L.line(ctx, pts((n) => n), css('--muted'), 2);
    L.line(ctx, pts((n) => CO.pairsOf(n)), css('--accent'), 2.6);
    L.line(ctx, pts((n) => CO.expectedPairs(n, P.k, P.pool)), css('--unlucky'), 2.6);
    L.vline(c, X(P.n), css('--rich'), '지금 설정', P.n > 50 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: css('--muted'), label: '사람' }, { kind: 'line', color: css('--accent'), label: '가능한 짝' }, { kind: 'line', color: css('--unlucky'), label: '일치한 쌍의 평균 예상 수' }], 'tl');
  }

  function renderStats() {
    const P = sim.params, k = P.k;
    const cards = [
      ['가능한 짝의 수', String(CO.pairsOf(P.n)), `${P.n}명이면 N(N−1)/2 쌍 · 나와의 짝은 ${P.n - 1}쌍`],
      ['어딘가에서 일치할 확률', pc(CO.theoryAny(P.n, k, P.pool)), sim.round ? `계산값 · 직접 돌린 ${sim.round}번 중 ${pc(sim.anyShare())}` : '계산값'],
      ['나와 일치할 확률', pc(CO.theoryMe(P.n, k, P.pool)), sim.round ? `계산값 · 직접 돌린 ${sim.round}번 중 ${pc(sim.meShare())}` : '계산값'],
      ['일치한 쌍의 평균 예상 수', CO.expectedPairs(P.n, k, P.pool).toFixed(2) + '쌍', `특징 ${k}가지 · 짝 하나가 일치할 확률 ${(CO.pairMatch(k, P.pool) * 100).toFixed(2)}%`],
    ];
    $('stats').innerHTML = cards.map(([a, v, s]) => `<div class="stat"><div class="k">${a}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRoom(); drawA(); drawB(); drawC(); }

  function after() {
    const P = params(); rowsA = []; rowsB = []; drawA(); drawB();
    $('note-a').textContent = '계산 중…'; $('note-b').textContent = '계산 중…';
    const jobs = [];
    SIMN_A.forEach((n) => jobs.push(() => { const s = CO.study({ n, k: P.k, pool: P.pool }, 800, n * 3 + 1); rowsA.push({ n, any: s.any, me: s.me }); }));
    SIMN_B.forEach((n) => jobs.push(() => { const s = CO.study({ n, k: P.k, pool: P.pool }, 400, n * 5 + 2); rowsB.push({ n, any: s.any, me: s.me }); }));
    L.jobs(jobs, () => { drawA(); drawB(); }, () => {
      const nA = CO.smallestN((n) => CO.theoryAny(n, P.k, P.pool), 0.5, 400), nB = CO.smallestN((n) => CO.theoryAny(n, 1, P.pool), 0.5, 400);
      const nM = CO.smallestN((n) => CO.theoryMe(n, P.k, P.pool), 0.5, 3000);
      $('note-a').textContent = `어딘가에서 일치할 확률이 50%를 넘는 인원: 지금 설정 ${nA}명, 생일만 ${nB}명`;
      $('note-b').textContent = `나와 일치할 확률이 50%를 넘는 인원: 지금 설정 ${nM}명 (생일만이면 ${nOthers50() + 1}명)`;
    });
  }

  const h = L.harness({
    controls: ['n', 'k', 'pool'],
    format: { n: (v) => v + '명', k: (v) => v + '가지', pool: (v) => v + '가지' },
    defaults: { n: 23, k: 1, pool: 30 },
    build() {
      sim = CO.create(Object.assign({}, params(), { rounds: THUMB ? 5000 : 300 })); sim.log = [];
      const adv = sim.advance; sim.advance = () => { const ok = adv(); if (ok) sim.log.push((sim.last.pairs.length ? 1 : 0) | (sim.last.meCount ? 2 : 0)); return ok; };
      if (THUMB) { while (sim.advance() && !(sim.last.meCount >= 1 && sim.last.pairs.length >= 3)); }
    },
    advance() { return THUMB ? false : sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawA(); drawB(); drawC(); }, seedLabel: '모임 번호',
  });
  seedGetter = h.seed;
})();
