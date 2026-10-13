(function () {
  'use strict';
  const FR = window.Friendship, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const HUBS = []; for (let i = 0; i <= 10; i++) HUBS.push(i / 10);
  const AVGS = [4, 8, 12];
  let sim = null, sel = 0, pos = [], rows = [], staticDirty = true;
  let seedGetter = () => 1;
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일 촬영: 표본을 끝까지 뽑은 장면으로 바로 간다
  // 3D 보기(app3d.js)가 같은 관계망을 쓰도록 공개한다
  function share(ev) { window.FriendshipView = { sim, sel }; window.dispatchEvent(new Event(ev || 'friendship-built')); }
  const params = () => ({ seed: seedGetter(), n: Number($('n').value), hub: Number($('hub').value) / 100, avg: Number($('avg').value) });
  const FONT = '12px -apple-system, "Apple SD Gothic Neo", sans-serif', FONTB = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
  const f1 = (v) => v.toFixed(1);
  const pc = (v) => Math.round(v * 100) + '%';

  // ---------- ① 친구 관계망 ----------
  function drawNet() {
    const LEG = 80, cw0 = $('c-net').clientWidth || 600;   // 아래쪽 범례 자리
    const c = L.chart($('c-net'), 0.74 + LEG / cw0, { l: 14, r: 14, t: 12, b: 58 + LEG }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const { adj, lay, M } = sim, n = M.n;
    pos = []; for (let i = 0; i < n; i++) pos.push([m.l + lay.x[i] * pw, m.t + lay.y[i] * ph]);
    const isFriend = new Uint8Array(n); if (sel >= 0) adj[sel].forEach((j) => { isFriend[j] = 1; });
    // 모든 관계는 흐리게
    ctx.strokeStyle = sel >= 0 ? 'rgba(99,106,122,.13)' : 'rgba(99,106,122,.24)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < n; i++) adj[i].forEach((j) => { if (j > i) { ctx.moveTo(pos[i][0], pos[i][1]); ctx.lineTo(pos[j][0], pos[j][1]); } });
    ctx.stroke();
    if (sel >= 0) {
      ctx.strokeStyle = '#e0a100'; ctx.lineWidth = 1.8; ctx.beginPath();
      adj[sel].forEach((j) => { ctx.moveTo(pos[sel][0], pos[sel][1]); ctx.lineTo(pos[j][0], pos[j][1]); });
      ctx.stroke(); ctx.lineWidth = 1;
    }
    const rad = (i) => 2.2 + 1.05 * Math.sqrt(M.deg[i]);
    const lmin = Math.log(Math.max(1, Math.min(...M.deg))), lmax = Math.log(M.maxDeg), hubT = (i) => (Math.log(M.deg[i]) - lmin) / (lmax - lmin || 1);
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => M.deg[a] - M.deg[b]);
    order.forEach((i) => {
      const dim = sel >= 0 && i !== sel && !isFriend[i];
      // 친구가 많을수록 진한 색 (허브가 한눈에 보이게)
      ctx.fillStyle = i === sel ? css('--unlucky') : isFriend[i] ? '#e0a100' : mix(css('--accent'), dim ? 0.22 + 0.4 * hubT(i) : 0.38 + 0.62 * hubT(i));
      ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], rad(i), 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], rad(i), 0, 7); ctx.stroke();
    });
    if (sel >= 0) { ctx.lineWidth = 2; ctx.strokeStyle = css('--unlucky'); ctx.beginPath(); ctx.arc(pos[sel][0], pos[sel][1], rad(sel) + 3, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    // 표본으로 뽑힌 사람 (재생 중)
    if (sim.lastSelf >= 0) {
      ctx.lineWidth = 2.6; ctx.strokeStyle = css('--text');
      ctx.beginPath(); ctx.arc(pos[sim.lastSelf][0], pos[sim.lastSelf][1], rad(sim.lastSelf) + 3.5, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#a06b00'; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.arc(pos[sim.lastFriend][0], pos[sim.lastFriend][1], rad(sim.lastFriend) + 3.5, 0, 7); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    L.legend({ ctx, w, m: { l: 8, t: h - 58 - LEG, r: 0, b: 0 }, pw: w - 8, ph: LEG }, [
      { kind: 'dot', color: '#e0a100', label: '선택한 사람의 친구' }, { kind: 'dot', color: css('--unlucky'), label: '선택한 사람' },
      { kind: 'line', color: css('--text'), label: '표본: 무작위 사람' }, { kind: 'dash', color: '#a06b00', label: '표본: 그 사람이 말한 친구' }], 'tl');
    ctx.textAlign = 'left';
    if (sel >= 0) {
      ctx.font = FONTB; ctx.fillStyle = M.fr[sel] > M.deg[sel] ? css('--unlucky') : css('--lucky');
      ctx.fillText(`선택한 사람: 내 친구 ${M.deg[sel]}명 · 친구들의 평균 ${f1(M.fr[sel])}명`, m.l, h - 36);
    }
    ctx.font = FONT; ctx.fillStyle = css('--muted');
    ctx.fillText('점의 크기 = 친구 수. 사람을 눌러 보세요: 친구는 금색으로 표시됩니다', m.l, h - 16);
    $('when').textContent = `표본 ${sim.round}/${sim.params.rounds}번 · 무작위 사람 평균 ${f1(sim.selfMean())}명 · 그 사람이 말한 친구 평균 ${f1(sim.friendMean())}명`;
  }

  // ---------- ② 친구들 평균 − 내 친구 수 ----------
  function drawHist() {
    const c = L.chart($('c-hist'), 0.62, { b: 40 }), { ctx, m, pw, ph } = c, M = sim.M, n = M.n;
    const d = Array.from({ length: n }, (_, i) => M.fr[i] - M.deg[i]), srt = d.slice().sort((a, b) => a - b);
    let lo = Math.min(-10, Math.floor(srt[Math.floor(n * 0.01)])), hi = Math.max(10, Math.ceil(srt[Math.floor(n * 0.97)]));
    const nb = 32, bw = (hi - lo) / nb, counts = new Array(nb).fill(0);
    d.forEach((v) => { counts[Math.max(0, Math.min(nb - 1, Math.floor((v - lo) / bw)))]++; });
    const cmax = Math.max(...counts), X = (v) => m.l + ((v - lo) / (hi - lo)) * pw, Y = (v) => m.t + ph - (v / cmax) * ph;
    const step = (hi - lo) > 80 ? 20 : (hi - lo) > 40 ? 10 : 5, xt = []; for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) xt.push(t);
    L.axes(c, { X, Y, yTicks: [0, 0.5, 1].map((q) => q * cmax), yFmt: (v) => String(Math.round(v)), xTicks: xt, xFmt: (v) => (v > 0 ? '+' : '') + v, xLabel: '친구들의 평균 − 내 친구 수 (명)', yLabel: '사람 수 (명)' });
    counts.forEach((v, i) => {
      const mid = lo + (i + 0.5) * bw;
      ctx.fillStyle = mid > 0 ? mix(css('--unlucky'), 0.8) : mix(css('--lucky'), 0.8);
      ctx.fillRect(m.l + (i * pw) / nb + 0.5, Y(v), Math.max(1, pw / nb - 1), m.t + ph - Y(v));
    });
    L.vline(c, X(0), css('--text'), '같음', 'right');
    ctx.font = FONTB; ctx.textAlign = 'right'; ctx.fillStyle = css('--unlucky');
    ctx.fillText(`친구들이 더 많음 ${pc(M.fewerShare)}`, m.l + pw, m.t + 30);
    ctx.fillStyle = css('--lucky'); ctx.textAlign = 'left'; ctx.fillText(`내가 더 많음 ${pc(M.moreShare)}`, m.l + 4, m.t + 30);
    ctx.font = FONT;
  }

  // ---------- ③ 내 친구 수 vs 친구들의 평균 (로그 눈금) ----------
  function drawScat() {
    const c = L.chart($('c-scat'), 0.8, { b: 40 }), { ctx, m, pw, ph } = c, M = sim.M, n = M.n;
    let mx = 10; for (let i = 0; i < n; i++) mx = Math.max(mx, M.deg[i], M.fr[i]);
    const top = Math.log(mx * 1.15), X = (v) => m.l + (Math.log(v) / top) * pw, Y = (v) => m.t + ph - (Math.log(v) / top) * ph;
    const tk = [1, 2, 5, 10, 20, 50, 100, 200].filter((v) => v <= mx * 1.1);
    L.axes(c, { X, Y, yTicks: tk, yFmt: String, xTicks: tk, xFmt: String, xLabel: '내 친구 수 (명)', yLabel: '친구들의 평균 친구 수 (명)' });
    ctx.strokeStyle = css('--text'); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(1), Y(1)); ctx.lineTo(X(Math.exp(top)), Y(Math.exp(top))); ctx.stroke(); ctx.setLineDash([]);
    const jit = FR.mulberry32(5);
    for (let i = 0; i < n; i++) {
      const up = M.fr[i] > M.deg[i], x = X(M.deg[i]) + (jit() - 0.5) * 7;
      ctx.fillStyle = mix(up ? css('--unlucky') : css('--lucky'), 0.45);
      ctx.beginPath(); ctx.arc(x, Y(Math.max(1, M.fr[i])), 3, 0, 7); ctx.fill();
    }
    if (sel >= 0) { ctx.lineWidth = 2.4; ctx.strokeStyle = css('--text'); ctx.beginPath(); ctx.arc(X(M.deg[sel]), Y(M.fr[sel]), 7, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
    L.legend(c, [{ kind: 'dot', color: css('--unlucky'), label: '위: 친구들이 더 많음' }, { kind: 'dot', color: css('--lucky'), label: '아래: 내가 더 많음' }, { kind: 'dash', color: css('--text'), label: '친구 수가 같은 선' }], 'br');
  }

  // ---------- ④ 허브가 많을수록 ----------
  function drawSweep() {
    L.dots($('c-sweep'), {
      data: rows[0] ? rows[0].pts : [], y0: 0.4, y1: 1, yFmt: (v) => Math.round(v * 100) + '%',
      series: rows.slice(1).map((r) => ({ data: r.pts, color: r.color })),
      x0: 0, x1: 1, xTicks: [0, 0.25, 0.5, 0.75, 1], xFmt: (v) => Math.round(v * 100) + '%', xLabel: '인기인 쏠림 (%)', yLabel: '친구들이 더 많은 사람 (%)',
      legend: [{ kind: 'line', color: css('--accent'), label: '평균 친구 4명' }, { kind: 'line', color: '#1fa463', label: '평균 친구 8명' }, { kind: 'line', color: '#7c5cff', label: '평균 친구 12명' }], legendPos: 'br',
      refs: [{ y: 0.5, label: '절반', color: '#8a93a6' }], marker: { x: sim.params.hub, label: '지금 설정' },
    });
  }

  function renderStats() {
    const M = sim.M;
    const cards = [
      ['한 사람의 평균 친구 수', f1(M.meanDeg), `무작위로 고른 사람 기준 · ${M.n}명`],
      ['그 친구들의 평균 친구 수', f1(M.meanFriendDeg), `내 친구들 평균을 사람마다 구해 평균 낸 값 · ${(M.meanFriendDeg / M.meanDeg).toFixed(1)}배`],
      ['친구들이 더 많은 사람', pc(M.fewerShare), '내 친구들의 평균이 내 친구 수보다 높은 사람의 비율'],
      ['선택한 사람', sel >= 0 ? `${M.deg[sel]} : ${f1(M.fr[sel])}` : '-', '내 친구 수 : 친구들의 평균 (사람을 눌러 바꾸기)'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function drawStatic() { drawHist(); drawScat(); staticDirty = false; }
  function draw() { renderStats(); drawNet(); if (staticDirty) drawStatic(); }

  function after() {
    const P = params(); rows = []; drawSweep(); $('note-s').textContent = '계산 중…';
    const cols = [css('--accent'), '#1fa463', '#7c5cff'];
    AVGS.forEach((a, i) => rows.push({ color: cols[i], avg: a, pts: [] }));
    const jobs = [];
    HUBS.forEach((hb) => jobs.push(() => rows.forEach((r, i) => {
      const s = FR.study({ n: P.n, hub: hb, avg: r.avg }, 6, 9);
      r.pts.push({ x: hb, runs: i === 0 ? s.runs.map((q) => q.fewerShare) : [], mean: s.fewerShare });
    })));
    L.jobs(jobs, drawSweep, () => {
      const a = rows[0].pts[0].mean, b = rows[0].pts[rows[0].pts.length - 1].mean;
      $('note-s').textContent = `인기인 쏠림이 0%이면 ${pc(a)}, 100%이면 ${pc(b)}입니다 (파랑 선, 평균 친구 4명)`;
    });
  }

  // 사람 선택
  $('c-net').addEventListener('click', (e) => {
    const r = $('c-net').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = 18 * 18;
    pos.forEach((p, i) => { const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { sel = best; renderStats(); drawNet(); drawScat(); share('friendship-select'); }
  });

  const h = L.harness({
    controls: ['n', 'hub', 'avg'],
    format: { n: (v) => v + '명', hub: (v) => v + '%', avg: (v) => v + '명' },
    defaults: { n: 150, hub: 80, avg: 6 },
    build() {
      const P = params(); sim = FR.create(Object.assign({}, P, { rounds: 300 }));
      sel = FR.typicalPerson(sim.M); staticDirty = true;
      if (THUMB) sim.run();
      share();
    },
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, autoplay: !THUMB, redrawExtra() { drawStatic(); drawSweep(); }, seedLabel: '관계망 번호',
  });
  seedGetter = h.seed;
})();
