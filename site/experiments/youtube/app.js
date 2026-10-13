(function () {
  'use strict';
  const YT = window.Youtube, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, worldRows = [], sweepRows = [];
  const THUMB = /[?&]thumb=1/.test(location.search); // 메인 페이지 썸네일용: 150라운드가 끝난 순위표로 바로 간다
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), social: Number($('social').value) / 100, n: Number($('n').value) });

  // 품질 순위 백분위 → 색 (낮음 빨강, 높음 파랑)
  function qcolor(rank, n) {
    const t = 1 - (rank - 1) / Math.max(1, n - 1);
    const lo = [229, 72, 77], mid = [245, 196, 81], hi = [47, 111, 237];
    const a = t < 0.5 ? lo : mid, b = t < 0.5 ? mid : hi, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`;
  }

  function drawRace() {
    const narrow = ($('c-race').clientWidth || 600) < 560; // 휴대폰: 줄 간격이 너무 좁아 두 줄 라벨이 겹치므로 세로로 길게
    const c = L.chart($('c-race'), THUMB ? 1 : narrow ? 1.25 : 0.66, { l: 12, r: 12, t: 10, b: 10 });
    const { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const s = sim.summary(), top = s.order.slice(0, 12), max = Math.max(1, sim.subs[top[0]]);
    const rowH = (h - 20) / 12, left = narrow ? 104 : 150;
    top.forEach((id, i) => {
      const y = 10 + i * rowH, v = sim.subs[id], len = Math.max(3, (v / max) * (w - left - (narrow ? 44 : 70)));
      ctx.fillStyle = qcolor(sim.qrank[id], sim.n); L.roundRect(ctx, left, y + rowH * 0.15, len, rowH * 0.7, 5); ctx.fill();
      ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = css('--text');
      ctx.fillText(`${i + 1}위 채널 #${id + 1}`, left - 8, y + rowH / 2 + 1);
      ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
      ctx.fillText(`품질 ${sim.qrank[id]}위`, left - 8, y + rowH / 2 + 13);
      ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.fillText(v.toLocaleString('ko-KR'), left + len + 6, y + rowH / 2 + 4);
    });
    if (!THUMB) L.legend(c, [{ kind: 'box', color: qcolor(1, 2), label: '품질 높음' }, { kind: 'box', color: qcolor(2, 3), label: '품질 보통' }, { kind: 'box', color: qcolor(2, 2), label: '품질 낮음' }], 'br');
    $('when').textContent = `${sim.round}/${sim.params.rounds} 라운드 · 누적 구독 ${s.total.toLocaleString('ko-KR')}`;
  }

  function drawScatter() {
    const c = L.chart($('c-scatter'), 0.7, { l: 48 });
    const { ctx, m, pw, ph } = c;
    const qmin = Math.min(...sim.q), qmax = Math.max(...sim.q), lq0 = Math.log(qmin) - 0.05, lq1 = Math.log(qmax) + 0.05;
    const smax = Math.max(10, ...sim.subs), ymax = Math.ceil(Math.log10(smax));
    const X = (q) => m.l + ((Math.log(q) - lq0) / (lq1 - lq0)) * pw, Y = (v) => m.t + ph - (Math.log10(Math.max(1, v)) / ymax) * ph;
    const yt = []; for (let k = 0; k <= ymax; k++) yt.push(Math.pow(10, k));
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => v.toLocaleString('ko-KR'), xTicks: [0.5, 1, 2], xFmt: (v) => (v === 1 ? '보통' : v < 1 ? '낮음' : '높음'), xLabel: '콘텐츠 품질', yLabel: '구독자 수 (명, 로그 눈금)' });
    for (let i = 0; i < sim.n; i++) { ctx.fillStyle = mix(qcolor(sim.qrank[i], sim.n), 0.6); ctx.beginPath(); ctx.arc(X(sim.q[i]), Y(sim.subs[i] + 1 - 1 + (sim.subs[i] === 0 ? 0.6 : 0)), 3, 0, 7); ctx.fill(); }
    const s = sim.summary(), best = sim.q.indexOf(Math.max(...sim.q));
    [[s.top, '#d19200'], [best, '#7c5cff']].forEach(([i, col]) => {
      const x = X(sim.q[i]), y = Y(sim.subs[i] + 0.6 * (sim.subs[i] === 0));
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    });
    L.legend(c, [{ kind: 'dot', color: '#8a93a6', label: '채널 하나 (색은 품질)' }, { kind: 'dot', color: '#d19200', label: '현재 1위 (금색 테두리)' }, { kind: 'dot', color: '#7c5cff', label: '품질 1위 (보라 테두리)' }], 'tl');
  }

  function drawWorlds() {
    const rows = worldRows, n = sim.n;
    const c = L.chart($('c-worlds'), 0.7, { l: 74, r: 24, b: 40 }); // 오른쪽 끝 '200위' 눈금이 잘리지 않게
    const { ctx, m, pw, ph } = c;
    const X = (r) => m.l + ((r - 1) / (n - 1)) * pw, rowH = ph / 8;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    [1, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n].forEach((r) => { ctx.beginPath(); ctx.moveTo(X(r), m.t); ctx.lineTo(X(r), m.t + ph); ctx.stroke(); ctx.fillText(r + '위', X(r), m.t + ph + 16); });
    L.axisNames(c, '1위 채널의 품질 순위 (왼쪽일수록 좋음)', '');
    for (let i = 0; i < 8; i++) {
      const y = m.t + i * rowH + rowH / 2;
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText(`평행우주 ${i + 1}`, m.l - 8, y + 4);
      const d = rows[i]; if (!d) continue;
      ctx.fillStyle = qcolor(d.topQualityRank, n); ctx.beginPath(); ctx.arc(X(d.topQualityRank), y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = css('--text'); ctx.textAlign = d.topQualityRank > n * 0.7 ? 'right' : 'left';
      ctx.fillText(d.topQualityRank + '위', X(d.topQualityRank) + (d.topQualityRank > n * 0.7 ? -12 : 12), y + 4);
    }
  }

  function drawSweep() {
    L.dots($('c-sweep'), {
      data: sweepRows.map((d) => ({ x: d.x, runs: d.corr, mean: L.mean(d.corr) })),
      series: [{ data: sweepRows.map((d) => ({ x: d.x, runs: d.share, mean: L.mean(d.share) })), color: css('--rich'), dots: true }],
      x0: 0, x1: 1, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], xFmt: pct, xLabel: '인기 순 추천 비율 (%)', yLabel: '상관·몫 (%)', legend: [{ kind: 'line', color: css('--accent'), label: '품질과 결과의 상관' }, { kind: 'line', color: css('--rich'), label: '상위 10%의 몫' }], legendPos: 'br',
      marker: { x: sim.params.social },
    });
  }

  function renderStats() {
    const s = sim.summary();
    const cards = [
      ['1위 채널의 구독자', s.topSubs.toLocaleString('ko-KR'), `전체 구독의 ${pct(s.top1Share)}`],
      ['1위 채널의 품질 순위', s.topQualityRank + '위', `${sim.n}개 채널 중 (1위가 최고 품질)`],
      ['품질과 구독자의 상관', s.corr.toFixed(2), '1에 가까울수록 품질대로 결과가 나옴'],
      ['상위 10%의 몫', pct(s.top10Share), '채널 10개 중 1개가 가져가는 구독'],
      ['품질 1위 채널의 성적', s.bestQualityPlace + '위', '가장 좋은 콘텐츠의 최종 순위'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRace(); drawScatter(); }

  function after() {
    const P = params(); worldRows = []; sweepRows = []; drawWorlds(); drawSweep();
    $('note-worlds').textContent = '계산 중…';
    const jobs = [() => { worldRows = YT.worlds(P, 8, 50); }];
    for (let s = 0; s <= 10; s++) jobs.push(() => {
      const w = YT.worlds({ n: P.n, social: s / 10 }, 8, 200);
      sweepRows.push({ x: s / 10, corr: w.map((d) => d.corr), share: w.map((d) => d.top10Share) });
    });
    L.jobs(jobs, () => { drawWorlds(); drawSweep(); }, () => {
      const ranks = worldRows.map((d) => d.topQualityRank).sort((a, b) => a - b);
      $('note-worlds').textContent = `같은 채널로 시작했는데 1위의 품질 순위는 ${ranks[0]}위부터 ${ranks[ranks.length - 1]}위까지 다양합니다`;
    });
  }

  const h = L.harness({
    controls: ['social', 'n'],
    format: { social: (v) => v + '%', n: (v) => v + '개' },
    defaults: { social: 70, n: 200 },
    build() { sim = YT.create(params()); },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawWorlds(); drawSweep(); }, seedLabel: '평행우주',
  });
  seedGetter = h.seed;
  if (THUMB) { while (sim.advance()); draw(); }
})();
