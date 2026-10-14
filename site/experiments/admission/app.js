(function () {
  'use strict';
  const A = window.Admission, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 배정이 끝난 장면으로 바로 간다
  const MN = { queue: '선착순', rsd: '추첨 순번', boston: '보스턴', da: '지연 수락' };
  const BUCKET = ['#1fa463', '#a3c93a', '#e0a100', '#e5484d', '#8a93a6']; // 1지망, 2~3, 4~5, 6 이하, 미배정
  const bucket = (r, M) => (r >= M ? 4 : r === 0 ? 0 : r <= 2 ? 1 : r <= 4 ? 2 : 3);
  const LETTERS = 'ABCDEFGH';
  let sim = null, S = null, cmp = null, ftest = null, lies = {}, sweep = [], focus = 0, label = [], seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), c: Number($('c').value) / 100, rho: Number($('rho').value) / 100, ratio: Number($('ratio').value) / 100, early: Number($('early').value) / 100, mech: $('mech').value });
  const LEG5 = ['1지망', '2~3지망', '4~5지망', '6지망 이하', '배정 못 받음'].map((label, b) => ({ color: BUCKET[b], label }));
  // 가로로 늘어놓는 그래프 안 범례(색 막대용). draw=false이면 높이만 잰다
  function hLegend(ctx, items, x0, y0, maxW, draw) {
    ctx.save(); ctx.font = '11.5px ' + FONT; let x = x0, y = y0, rows = 1;
    items.forEach((it) => {
      const tw = ctx.measureText(it.label).width, iw = 16 + tw + 12;
      if (x > x0 && x + iw > x0 + maxW) { x = x0; y += 16; rows++; }
      if (draw) {
        ctx.fillStyle = it.color; ctx.strokeStyle = it.color; ctx.lineWidth = 2;
        if (it.ring) { ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(x + 6, y + 6, 5, 0, 7); ctx.stroke(); }
        else if (it.dot) { ctx.beginPath(); ctx.arc(x + 6, y + 6, 4, 0, 7); ctx.fill(); }
        else ctx.fillRect(x, y + 1, 12, 10);
        ctx.lineWidth = 1; ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.fillText(it.label, x + 16, y + 10.5);
      }
      x += iw;
    });
    ctx.restore(); return rows * 16;
  }
  const f1 = (v) => v.toFixed(1), pc = (v) => Math.round(v * 100) + '%';

  // ---------- ① 배정 과정 ----------
  function drawAnim() {
    const cv = $('c-anim'), cw = cv.clientWidth || 600, mobile = cw < 560;
    const asp = THUMB ? 1 : mobile ? 1.5 : 0.62;
    const c = L.chart(cv, asp, { l: 10, r: 10, t: 10, b: 10 }), { ctx, w, h: hFull } = c, N = S.N, M = S.M;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, hFull);
    const ANIM_LEG = LEG5.concat([{ color: '#3b6fd8', dot: true, label: '일찍 접수할 수 있는 집(대기 중)' }, { color: '#111', ring: true, label: '시험해 보는 아이' }]);
    const legH = THUMB ? 0 : hLegend(ctx, ANIM_LEG, 10, 0, w - 20, false) + 8, h = hFull - legH;
    const fr = sim.current(), a = fr.a;
    let waiting = 0; for (let i = 0; i < N; i++) if (a[i] < 0) waiting++;
    // 영역 나누기
    const poolW = mobile ? w - 20 : Math.round(w * 0.2), poolH = mobile ? 96 : h - 20, px = 10, py = 10;
    const ix = mobile ? 10 : px + poolW + 14, iy = mobile ? py + poolH + 12 : 10, iw = w - ix - 10, ih = h - iy - 10;
    const cols = mobile ? 2 : 4, rows = mobile ? 4 : 2, gap = 8, bw = (iw - gap * (cols - 1)) / cols, bh = (ih - gap * (rows - 1)) / rows;
    // 대기 아이: 번호 자리에 고정된 점
    ctx.fillStyle = '#eef1f8'; L.roundRect(ctx, px, py, poolW, poolH, 10); ctx.fill();
    const headH = THUMB ? 6 : 26, pa = (poolW - 16) * (poolH - headH - 12);
    let cs = Math.floor(Math.sqrt(pa / N) * 0.98); cs = Math.max(4, cs); const pcols = Math.max(1, Math.floor((poolW - 16) / cs));
    const pos = (i) => [px + 8 + (i % pcols) * cs + cs / 2, py + headH + 4 + Math.floor(i / pcols) * cs + cs / 2];
    for (let i = 0; i < N; i++) {
      if (a[i] >= 0) continue; const [x, y] = pos(i);
      ctx.fillStyle = S.early[i] ? '#3b6fd8' : '#aab2c5'; ctx.beginPath(); ctx.arc(x, y, cs * 0.36, 0, 7); ctx.fill();
    }
    if (!THUMB) { ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 12px ' + FONT; ctx.fillText(`대기 중 ${waiting}명`, px + 10, py + 18); }
    // 기관 블록 (인기 순서대로: 가 = 가장 인기)
    const occ = Array.from({ length: M }, () => []);
    for (let i = 0; i < N; i++) if (a[i] >= 0) occ[a[i]].push(i);
    const rk = (i, j) => S.trueRank[i * M + j];
    let focusPos = null;
    for (let d = 0; d < M; d++) {
      const j = label.indexOf(d), col = d % cols, row = Math.floor(d / cols), x0 = ix + col * (bw + gap), y0 = iy + row * (bh + gap);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = css('--line'); L.roundRect(ctx, x0, y0, bw, bh, 10); ctx.fill(); ctx.stroke();
      const hh = THUMB ? 4 : 34, cap = S.cap[j];
      if (!THUMB) {
        ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '600 12px ' + FONT; ctx.fillText(`${LETTERS[d]} · 정원 ${cap}`, x0 + 8, y0 + 16);
        ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.fillText(`1지망 ${S.demand[j]}명`, x0 + 8, y0 + 29);
      }
      // 자리 칸
      let best = 0, bc = 1; const aw = bw - 12, ah = bh - hh - 8;
      for (let k = 1; k <= cap; k++) { const r = Math.ceil(cap / k), s = Math.min(aw / k, ah / r); if (s > best) { best = s; bc = k; } }
      const cell = Math.floor(best), rowsN = Math.ceil(cap / bc), gx = x0 + (bw - cell * bc) / 2, gy = y0 + hh + (ah - cell * rowsN) / 2 + 2;
      const list = occ[j].slice().sort((p, q) => (rk(p, j) - rk(q, j)) || (p - q));
      for (let k = 0; k < cap; k++) {
        const cx = gx + (k % bc) * cell, cy = gy + Math.floor(k / bc) * cell;
        if (k < list.length) {
          const i = list[k], b = bucket(rk(i, j), M);
          ctx.fillStyle = fr.tentative ? mix(BUCKET[b], 0.7) : BUCKET[b]; ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
          if (i === focus) focusPos = [cx + cell / 2, cy + cell / 2, cell];
        } else { ctx.strokeStyle = '#d9deea'; ctx.strokeRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3); }
      }
    }
    if (a[focus] < 0) { const [x, y] = pos(focus); focusPos = [x, y, cs]; }
    if (focusPos && !THUMB) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(focusPos[0], focusPos[1], Math.max(6, focusPos[2] * 0.8), 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    }
    if (!THUMB) hLegend(ctx, ANIM_LEG, 10, hFull - legH + 2, w - 20, true);
    // 단계 설명
    const m = sim.mech, last = sim.done();
    let t;
    if (last) t = `${MN[m]} · 배정이 끝났어요`;
    else if (m === 'queue') t = `선착순 · 접수한 순서대로 ${fr.n}/${N}명이 골랐어요`;
    else if (m === 'rsd') t = `추첨 순번 · 추첨 번호 순서대로 ${fr.n}/${N}명이 골랐어요`;
    else if (m === 'boston') t = `보스턴 · ${fr.n}지망 접수 중 (정원이 차면 바로 확정)`;
    else t = `지연 수락 · ${fr.n}번째 라운드: 임시 배정, 밀려난 아이는 다음 지망으로`;
    $('when').textContent = t;
  }

  // ---------- 내 아이 시험 ----------
  function drawFocus() {
    const el = $('focus'); if (!el) return;
    const t = ftest, M = S.M, nm = (j) => LETTERS[label[j]];
    const honest = t.truthRank >= M ? null : `${t.truthRank + 1}`;
    let html = `<b>내 아이 시험</b> `;
    if (t.gain > 0) {
      html += honest ? `<span>아이 ${focus + 1}번은 솔직하게 적으면 ${t.truthRank + 1}지망 '${nm(t.truthAssign)}'에 배정됩니다.</span> ` : `<span>아이 ${focus + 1}번은 솔직하게 적으면 배정받지 못합니다.</span> `;
      html += `<span>'${nm(t.move.item)}'을(를) ${t.move.to + 1}번째로 옮겨 적으면 ${t.lieRank + 1}지망 '${nm(t.lieAssign)}'에 배정됩니다.</span>`;
    } else {
      html += honest ? `<span>아이 ${focus + 1}번은 솔직하게 적으면 ${t.truthRank + 1}지망 '${nm(t.truthAssign)}'에 배정됩니다.</span> ` : `<span>아이 ${focus + 1}번은 솔직하게 적으면 배정받지 못합니다.</span> `;
      html += `<span>순서를 ${t.cand}가지로 바꿔 적어 봐도 더 나은 곳은 얻지 못합니다.</span>`;
    }
    el.innerHTML = html; el.style.opacity = sim.done() ? '' : '0.55';
  }

  // ---------- ② 어디로 갔나 ----------
  // 재생 중 선택한 방식의 지금까지 배정 현황 (지망 순위별 인원, 마지막 칸 = 아직 배정 전/못 받음)
  function liveDist() {
    const M = S.M, a = sim.current().a, dist = new Array(M + 1).fill(0);
    for (let i = 0; i < S.N; i++) dist[a[i] < 0 ? M : S.trueRank[i * M + a[i]]]++;
    return dist;
  }
  function drawDist() {
    const cv = $('c-dist'), cw = cv.clientWidth || 600, mobile = cw < 560;
    const tmp = L.chart(cv, 1, {}); const lh = hLegend(tmp.ctx, LEG5, 0, 0, tmp.w - 16, false);
    const c = L.chart(cv, mobile ? 0.8 : 0.42, { l: mobile ? 92 : 84, r: 12, t: 24, b: 40 + lh + 4 }), { ctx, m, pw, ph } = c, N = S.N, M = S.M;
    const rowH = ph / 4, bh = rowH * 0.62, playing = !sim.done();
    A.MECHS.forEach((mech, k) => {
      const sel = mech === sim.mech, dist = sel && playing ? liveDist() : cmp[mech].dist, y = m.t + k * rowH + (rowH - bh) / 2;
      ctx.globalAlpha = playing && !sel ? 0.45 : 1;
      ctx.textAlign = 'right'; ctx.fillStyle = css('--text'); ctx.font = (sel ? '700 ' : '') + '12px ' + FONT; ctx.fillText(MN[mech], m.l - 8, y + bh / 2 + 4);
      const g = [0, 0, 0, 0, 0]; dist.forEach((v, r) => { g[bucket(r, M)] += v; });
      let x = m.l;
      g.forEach((v, b) => {
        const wv = (v / N) * pw; if (!v) return;
        ctx.fillStyle = BUCKET[b]; ctx.fillRect(x, y, wv, bh);
        if (wv > 34) { ctx.fillStyle = b === 1 || b === 2 ? '#222' : '#fff'; ctx.textAlign = 'center'; ctx.font = '600 11px ' + FONT; ctx.fillText(pc(v / N), x + wv / 2, y + bh / 2 + 4); }
        x += wv;
      });
      if (sel) { ctx.strokeStyle = css('--text'); ctx.lineWidth = 1.5; ctx.strokeRect(m.l - 0.5, y - 0.5, pw + 1, bh + 1); ctx.lineWidth = 1; }
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.font = '12px ' + FONT;
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => ctx.fillText(pc(v), m.l + v * pw, m.t + ph + 16));
    L.axisNames(c, '아이 비율 (%)', '배정 방식');
    hLegend(ctx, LEG5, 8, m.t + ph + 26, c.w - 16, true);
  }

  // ---------- ③ 바꿔 적으면 이득? ----------
  function drawLie() {
    const cv = $('c-lie'), cw = cv.clientWidth || 600, mobile = cw < 560;
    const c = L.chart(cv, mobile ? 0.8 : 0.42, { l: mobile ? 92 : 84, r: 12, t: 24, b: 40 }), { ctx, m, pw, ph } = c;
    const rowH = ph / 4, bh = rowH * 0.62, x1 = 1;
    const X = (v) => m.l + (v / x1) * pw;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT; ctx.textAlign = 'center';
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); ctx.fillText(pc(v), X(v), m.t + ph + 16); });
    A.MECHS.forEach((mech, k) => {
      const y = m.t + k * rowH + (rowH - bh) / 2, sel = mech === sim.mech, r = lies[mech];
      ctx.textAlign = 'right'; ctx.fillStyle = css('--text'); ctx.font = (sel ? '700 ' : '') + '12px ' + FONT; ctx.fillText(MN[mech], m.l - 8, y + bh / 2 + 4);
      ctx.font = '12px ' + FONT;
      if (!r) { ctx.textAlign = 'left'; ctx.fillStyle = css('--muted'); ctx.fillText('계산 중…', m.l + 6, y + bh / 2 + 4); return; }
      const col = r.share > 0 ? '#e5484d' : '#1fa463';
      ctx.fillStyle = r.share > 0 ? col : mix(col, 0.9); ctx.fillRect(m.l, y, Math.max(2, X(r.share) - m.l), bh);
      const tx = r.share > 0.62 ? X(r.share) - 6 : X(r.share) + 6;
      ctx.textAlign = r.share > 0.62 ? 'right' : 'left'; ctx.fillStyle = r.share > 0.62 ? '#fff' : css('--text'); ctx.font = '600 12px ' + FONT;
      ctx.fillText(`${pc(r.share)} (${r.gain}/${r.tested}명)`, tx, y + bh / 2 + 4);
    });
    L.axisNames(c, '이득 보는 아이 (%)', '배정 방식');
  }

  // ---------- ④ 언제 솔직함이 손해가 될까 ----------
  const CX = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  function drawSweep() {
    const cv = $('c-sweep'), cw = cv.clientWidth || 600, mobile = cw < 560;
    const c = L.chart(cv, mobile ? 0.8 : 0.5, { l: 46, r: 16, t: 24, b: 40 }), { ctx, m, pw, ph } = c;
    const mx = Math.max(0.4, ...sweep.map((d) => d.share)), y1 = Math.min(1, Math.ceil((mx + 0.05) * 5) / 5);
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - (v / y1) * ph, yt = []; for (let v = 0; v <= y1 + 1e-9; v += 0.2) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: pc, xTicks: [0, 0.25, 0.5, 0.75, 1], xFmt: pc, xLabel: '취향이 비슷한 정도 (%)', yLabel: '이득 보는 아이 (%)' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = '#1fa463'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(0)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (sweep.length) {
      L.line(ctx, sweep.map((d) => [X(d.x), Y(d.share)]), '#e5484d', 2.8);
      ctx.fillStyle = '#e5484d'; sweep.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.share), 3.4, 0, 7); ctx.fill(); });
    }
    const cur = sim.params.c;
    L.vline(c, X(cur), css('--rich'), '지금 설정', cur > 0.6 ? 'right' : 'left');
    if (sweep.length < CX.length) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.font = '12px ' + FONT; ctx.fillText('계산 중…', c.w - m.r, m.t + ph - 6); }
    L.legend(c, [{ kind: 'line', color: '#e5484d', label: '보스턴 방식' }, { kind: 'dash', color: '#1fa463', label: '나머지 세 방식 (0%)' }], 'tl');
  }

  function renderStats() {
    let r; const m = sim.mech, b = lies.boston, d = lies.da, M = S.M;
    const playing = !sim.done();
    r = cmp[m];
    if (playing) { // 재생 중에는 지금까지 배정된 값으로
      const dd = liveDist(), n = dd.reduce((p, q) => p + q, 0) - dd[M]; let sr = 0; for (let k = 0; k < M; k++) sr += dd[k] * k;
      r = { first: dd[0] / S.N, avgRank: n ? sr / n + 1 : NaN, unassigned: dd[M], envy: NaN, gap: NaN };
    }
    const cards = [
      ['순위를 바꿔 적어 이득 보는 아이: 보스턴 / 지연 수락', b && d ? `${pc(b.share)} / ${pc(d.share)}` : '…', '다른 집은 솔직하게 적고 이 아이만 순서를 바꿔 본 시험 (아이 60명 표본)'],
      [`1지망으로 간 아이 (${MN[m]})`, pc(r.first), (isNaN(r.avgRank) ? '' : `평균 ${f1(r.avgRank)}지망 · 미배정 ${r.unassigned}명`)],
      [`억울한 아이 (${MN[m]})`, isNaN(r.envy) ? '–' : pc(r.envy), '더 원하는 곳에 자리가 남았거나, 나보다 순번이 낮은 아이가 들어간 아이'],
      [`먼저 접수한 집의 이득 (${MN[m]})`, isNaN(r.gap) ? '–' : `${Math.abs(r.gap) < 0.05 ? '' : r.gap > 0 ? '+' : '-'}${Math.abs(r.gap).toFixed(1)}지망`, `일찍 접수할 수 있는 집이 나머지보다 평균 몇 지망 더 좋은 곳에 갔는지 (미배정은 ${M + 1}지망으로 계산)`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawAnim(); drawFocus(); drawDist(); drawLie(); drawSweep(); }

  function after() {
    lies = {}; sweep = [];
    const P = params(), base = { n: P.n, c: P.c, rho: P.rho, ratio: P.ratio, early: P.early, seed: P.seed };
    const jobs = [];
    A.MECHS.slice().sort((x, y) => (x === sim.mech ? -1 : y === sim.mech ? 1 : 0)).forEach((mech) => jobs.push(() => { lies[mech] = sim.manip(mech, 60); }));
    CX.forEach((cv) => jobs.push(() => { sweep.push(A.sweepManip(base, 'c', [cv], 'boston', 60, 3)[0]); }));
    L.jobs(jobs, () => { renderStats(); drawLie(); drawSweep(); });
  }

  const SPEED = { queue: 1, rsd: 1, boston: 0.9, da: 0.3 };
  const h = L.harness({
    controls: ['n', 'c', 'rho', 'ratio', 'early', 'mech'],
    format: { n: (v) => v + '명', c: (v) => v + '%', rho: (v) => v + '%', ratio: (v) => v + '%', early: (v) => v + '%', mech: () => '' },
    defaults: { n: 200, c: 60, rho: 50, ratio: 100, early: 25, mech: 'boston' },
    build() {
      const P = params(); sim = A.create(P); S = sim.S; cmp = sim.compare();
      // 인기 순서 이름표: 가 = 가장 인기 있는 곳
      const idx = Array.from({ length: S.M }, (_, j) => j).sort((x, y) => S.q[y] - S.q[x]); label = new Array(S.M); idx.forEach((j, d) => { label[j] = d; });
      // 시험 대상 아이: 보스턴에서 순위를 바꿔 가장 이득을 보는 아이 (없으면 0번)
      const bm = sim.manip('boston', 60); focus = bm.best ? bm.best.child : 0;
      ftest = sim.childTest(sim.mech, focus);
      if (THUMB) sim.finish();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    get speedScale() { return 0.7 * (SPEED[$('mech').value] || 1); },
    draw, after, seedLabel: '배정 번호',
  });
  seedGetter = h.seed;
})();
