(function () {
  'use strict';
  const ZP = window.Zipf, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, S = null, sweepCopy = [], sweepUni = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), novelty: Number($('novelty').value) / 100, mode: $('mode').value });
  const fmtN = (v) => Number(v).toLocaleString('ko-KR');
  const pow10 = (k) => Math.pow(10, k);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 페이지 썸네일용: 10만 단어를 다 쓴 순위-빈도 그래프로 바로 간다

  function drawStream() {
    const c = L.chart($('c-stream'), 0.5, { l: 14, r: 14, t: 12, b: 12 });
    const { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const rank = new Map(); S.ranked.slice(0, 10).forEach((x, i) => rank.set(x.id, i));
    const K = Math.min(sim.n, Math.round((w / 62) * Math.floor((h - 24) / 28)));
    ctx.font = '600 15px Menlo, "SF Mono", Consolas, monospace'; ctx.textBaseline = 'middle';
    let x = 14, y = 26;
    for (let i = 0; i < K; i++) {
      const pos = sim.n - K + i, id = sim.tokens[pos], name = ZP.wordName(id);
      const wd = ctx.measureText(name).width + 12;
      if (x + wd > w - 14) { x = 14; y += 28; if (y > h - 10) break; }
      if (sim.newAt[id] === pos) { ctx.fillStyle = mix(css('--accent'), 0.18); L.roundRect(ctx, x - 3, y - 12, wd - 4, 24, 6); ctx.fill(); ctx.fillStyle = css('--accent'); }
      else if (rank.has(id)) ctx.fillStyle = css('--text');
      else ctx.fillStyle = css('--muted');
      ctx.textAlign = 'left'; ctx.fillText(name, x, y);
      x += wd;
    }
    ctx.textBaseline = 'alphabetic';
    $('when').textContent = `${fmtN(sim.n)}번째 단어 · 어휘 ${fmtN(S.vocab)}개`;
  }

  function drawLog() {
    const c = L.chart($('c-loglog'), THUMB ? 1 : 0.78, THUMB ? { l: 14, r: 14, t: 14, b: 14 } : { l: 50, b: 40 });
    const { ctx, m, pw, ph } = c, R = S.ranked;
    const xmax = Math.max(1, Math.ceil(Math.log10(Math.max(10, S.vocab)))), ymax = Math.max(1, Math.ceil(Math.log10(Math.max(10, R[0].count))));
    const X = (r) => m.l + (Math.log10(r) / xmax) * pw, Y = (f) => m.t + ph - (Math.log10(Math.max(1, f)) / ymax) * ph;
    const xt = [], yt = []; for (let k = 0; k <= xmax; k++) xt.push(pow10(k)); for (let k = 0; k <= ymax; k++) yt.push(pow10(k));
    if (THUMB) { ctx.strokeStyle = css('--line'); yt.forEach((v) => { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(m.l + pw, Y(v)); ctx.stroke(); }); xt.forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); }); }
    else {
      L.axes(c, { X, Y, yTicks: yt, yFmt: fmtN, xTicks: xt, xFmt: fmtN, xLabel: '단어 순위 (로그 눈금)' });
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('쓰인 횟수 (로그 눈금) ↑', m.l + 4, m.t + 12);
    }
    // 점: 순위를 로그 간격으로 솎아서
    // 기울기 -1 기준선: 적합 구간의 시작점(순위 fitFrom)을 지나게 그려 기울기를 바로 비교할 수 있게 한다
    //  (1위 단어는 맨 처음 생겨 가장 오래 베껴진 탓에 선에서 크게 벗어나므로 기준점으로 쓰지 않는다)
    const a0 = R.length >= S.fitFrom ? Math.log10(R[S.fitFrom - 1].count) + Math.log10(S.fitFrom) : Math.log10(R[0].count);
    const rA = Math.pow(10, Math.max(0, a0 - ymax)), rB = Math.pow(10, Math.min(xmax, a0));
    ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--rich'); ctx.lineWidth = THUMB ? 3 : 1.8; ctx.beginPath();
    ctx.moveTo(X(rA), Y(Math.pow(10, a0) / rA)); ctx.lineTo(X(rB), Y(Math.pow(10, a0) / rB)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = mix(css('--accent'), 0.6);
    let lastX = -9; const dr = THUMB ? 4.2 : 2.6;
    for (let r = 1; r <= R.length; r++) { const px = X(r); if (r > 60 && px - lastX < dr * 0.85) continue; lastX = px; ctx.beginPath(); ctx.arc(px, Y(R[r - 1].count), dr, 0, 7); ctx.fill(); }
    if (!THUMB && R.length > 1 && R[0].count > 3 * R[1].count) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; const y1 = Y(R[0].count); ctx.fillText('← 1위: 맨 처음 생긴 단어', X(1) + 8, y1 < m.t + 24 ? y1 + 18 : y1 + 4); }
    // 적합선
    if (!isNaN(S.slope)) {
      ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = THUMB ? 3.5 : 2.4; ctx.beginPath();
      const yy = (r) => Math.pow(10, S.icpt + S.slope * Math.log10(r));
      ctx.moveTo(X(S.fitFrom), Y(yy(S.fitFrom))); ctx.lineTo(X(S.fitTo), Y(yy(S.fitTo))); ctx.stroke(); ctx.lineWidth = 1;
      if (!THUMB) { ctx.fillStyle = css('--unlucky'); ctx.textAlign = 'right'; ctx.fillText('관측 기울기 ' + S.slope.toFixed(2), m.l + pw - 6, m.t + 28); }
    }
    if (!THUMB) { ctx.fillStyle = css('--rich'); ctx.textAlign = 'right'; ctx.fillText('기울기 -1 (지프의 법칙)', m.l + pw - 6, m.t + 12); }
  }

  function drawTop() {
    const c = L.chart($('c-top'), 0.78, { l: 78, r: 54, t: 10, b: 24 });
    const { ctx, w, m, pw, ph } = c, R = S.ranked.slice(0, 20), n = Math.max(1, sim.n);
    const max = Math.max(1, R[0].count), rowH = ph / 20;
    R.forEach((x, i) => {
      const y = m.t + i * rowH, bw = Math.max(1, (x.count / max) * pw);
      ctx.fillStyle = i < 10 ? css('--accent') : mix(css('--accent'), 0.45); L.roundRect(ctx, m.l, y + rowH * 0.16, bw, rowH * 0.68, 3); ctx.fill();
      ctx.font = '12px Menlo, "SF Mono", Consolas, monospace'; ctx.fillStyle = css('--text'); ctx.textAlign = 'right'; ctx.fillText(ZP.wordName(x.id), m.l - 8, y + rowH * 0.68);
      ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText((x.count / n * 100).toFixed(1) + '%', m.l + bw + 5, y + rowH * 0.68);
    });
  }

  function drawSweep() {
    const mk = (rows) => rows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) }));
    L.dots($('c-sweep'), {
      data: mk(sweepCopy), series: [{ data: mk(sweepUni), color: '#8a93a6', dots: true }],
      x0: 0.005, x1: 0.1, y0: 0, y1: 1.4, xTicks: [0.005, 0.02, 0.04, 0.06, 0.08, 0.1], xFmt: (v) => (v * 100).toFixed(v < 0.01 ? 1 : 0) + '%', yFmt: (v) => v.toFixed(1),
      xLabel: '새 단어가 나올 확률', refs: [{ y: 1, label: '기울기 -1 (지프의 법칙)', color: css('--rich') }], marker: { x: sim.params.novelty },
    });
  }

  function renderStats() {
    const ok = !isNaN(S.slope);
    const cards = [
      ['쓴 단어 수', fmtN(sim.n), '10만 단어까지 이어 써요'],
      ['어휘 크기', fmtN(S.vocab), '서로 다른 단어의 수'],
      ['상위 10개 단어의 몫', pct(S.top10), '글 전체에서 차지하는 비율'],
      ['상위 100개 단어의 몫', pct(S.top100), '글 전체에서 차지하는 비율'],
      ['순위-빈도 기울기', ok ? S.slope.toFixed(2) : '-', `지프의 법칙은 -1 근처 · 순위 ${S.fitFrom}~${S.fitTo}에서 측정`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { S = sim.summary(); renderStats(); drawStream(); drawLog(); drawTop(); drawSweep(); }

  function after() {
    const P = params(); sweepCopy = []; sweepUni = []; drawSweep();
    $('note-sweep').textContent = '계산 중…';
    const xs = [0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1], jobs = [];
    xs.forEach((a) => jobs.push(() => { sweepCopy.push({ x: a, runs: ZP.slopes({ novelty: a, mode: 'copy' }, 4, 900).map((s) => -s.slope) }); }));
    xs.forEach((a) => jobs.push(() => { sweepUni.push({ x: a, runs: ZP.slopes({ novelty: a, mode: 'uniform' }, 4, 900).map((s) => -s.slope) }); }));
    L.jobs(jobs, drawSweep, () => {
      const mc = sweepCopy.map((d) => L.mean(d.runs)), mu = sweepUni.map((d) => L.mean(d.runs));
      $('note-sweep').textContent = `새 단어 확률을 0.5%~10%로 바꿔도 복사 모드의 기울기는 ${Math.min(...mc).toFixed(2)}~${Math.max(...mc).toFixed(2)}, 균등 선택은 ${Math.min(...mu).toFixed(2)}~${Math.max(...mu).toFixed(2)}입니다`;
    });
  }

  const h = L.harness({
    controls: ['novelty', 'mode'],
    format: { novelty: (v) => v + '%', mode: () => '' },
    defaults: { novelty: 3, mode: 'copy' },
    build() { sim = ZP.create(params()); if (THUMB) sim.run(); },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawSweep(); }, seedLabel: '글 번호',
  });
  seedGetter = h.seed;
})();
