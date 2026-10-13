(function () {
  'use strict';
  const S = window.Secretary, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const GREEN = '#1fa463', RED = '#e5484d', AMBER = '#e0a100', GRAY = '#8a93a6', GOLD = '#f2b705';
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 한 판이 끝나 최고를 골라낸 장면으로 바로 간다
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const pc = (v, d) => (v * 100).toFixed(d == null ? 1 : d);
  let sim = null, cache = { key: '', exact: null, dots: null, rank: null, rankDots: null, opt: null };
  let tally = { sig: '', runs: 0, wins: 0, seen: new Set() }, hold = 0;
  const params = (seed) => ({ seed, n: Number($('n').value), cut: Number($('cut').value), goal: Number($('goal').value) });

  // 계산은 설정이 바뀔 때만 다시 한다 (자동 반복 중 같은 설정이면 그대로 쓴다)
  function prepare(P) {
    const r = S.cutToR(P.n, P.cut), key = [P.n, P.goal, r].join('|'), ck = [P.n, P.goal].join('|');
    if (cache.ck !== ck) {
      cache.ck = ck; cache.exact = S.curve(P.n, P.goal); cache.opt = S.optimum(P.n, P.goal);
      cache.dots = S.simCurve(P.n, P.goal, 600, 1000 + P.n * 10 + P.goal, Math.max(1, Math.floor(P.n / 25)));
    }
    if (cache.key !== key) {
      cache.key = key; cache.rank = S.rankDist(P.n, r); cache.rankDots = S.trialRanks(P.n, r, 4000, 777 + P.n + r).map((c) => c / 4000);
    }
    cache.r = r;
  }

  // 글자 줄바꿈 (번역된 문장을 통째로 받아 그린다)
  function wrap(ctx, text, x, y, maxW, lh) {
    text = tr(text);
    const words = text.split(/(?<=[\s])|(?<=[,.:;!?])/), lines = []; let cur = '';
    const fits = (s) => ctx.measureText(s).width <= maxW;
    words.forEach((w) => {
      if (fits(cur + w)) { cur += w; return; }
      if (cur) lines.push(cur.trimEnd()); cur = '';
      if (fits(w)) { cur = w; return; }
      for (const ch of w) { if (fits(cur + ch)) cur += ch; else { lines.push(cur); cur = ch; } }
    });
    if (cur) lines.push(cur.trimEnd());
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh));
    return lines.length;
  }

  function statusLine() {
    const s = sim, r = s.r, n = s.n;
    if (s.revealAll || s.done) {
      const k = s.kind(), rk = s.pickRank();
      if (k === 'best') return ['성공! 진짜 최고를 골랐습니다', GREEN];
      if (k === 'good') return [`성공으로 칩니다: ${rk}위를 골랐습니다 (기준: 상위 ${s.goal}명)`, GREEN];
      if (k === 'passed') return [s.forced ? `놓쳤습니다: 최고는 ${s.bestIdx + 1}번째로 관찰 구간에서 이미 지나갔고, 기준을 넘는 사람이 없어 마지막 후보(${rk}위)를 받았습니다` : `놓쳤습니다: 최고는 ${s.bestIdx + 1}번째로 관찰 구간에서 이미 지나갔습니다 (${rk}위를 골랐습니다)`, RED];
      return [`놓쳤습니다: 더 좋은 후보가 ${s.bestIdx + 1}번째에 있었는데 ${s.picked + 1}번째에서 먼저 멈췄습니다 (${rk}위)`, AMBER];
    }
    if (s.picked >= 0) return [`${s.picked + 1}번째에서 멈췄습니다: 지금까지 본 누구보다 좋아요`, css('--text')];
    if (s.t === 0) return [r > 0 ? `후보 ${n}명을 한 명씩 만납니다. 처음 ${r}명은 기준만 잡고 모두 거절합니다` : `후보 ${n}명을 한 명씩 만납니다. 관찰 없이 첫 사람을 바로 받습니다`, css('--text')];
    if (s.t <= r) return [`관찰 중 ${s.t}/${r}: 점수를 기억만 하고 모두 거절합니다`, css('--text')];
    return ['이제부터: 지금까지 본 누구보다 점수가 높으면 바로 선택합니다', css('--text')];
  }

  function drawRun() {
    const cw = $('c-run').clientWidth || 600, mobile = cw < 560, asp = THUMB ? 1 : mobile ? 1.05 : 0.6;
    const top = THUMB ? 12 : mobile ? 76 : 50;
    const LEG = THUMB ? 0 : 66;   // 아래쪽 범례 자리
    const c = L.chart($('c-run'), asp + LEG / cw, { l: 10, r: 10, t: top, b: 12 + LEG }), { ctx, w, h, m, pw, ph } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const s = sim, n = s.n;
    if (!THUMB) {
      const [txt, col] = statusLine();
      ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.font = '600 13px ' + FONT;
      const k = wrap(ctx, txt, m.l, 20, w - 20, 17);
      ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
      if (!s.revealAll) wrap(ctx, `지금까지 본 최고 점수: ${s.leader >= 0 ? s.score[s.leader] : '-'} · 본 후보 ${s.t}/${n}명`, m.l, 20 + 17 * k + 3, w - 20, 15);
    }
    // 격자: 타일이 가장 커지는 열 수를 고른다
    let cols = 1, tile = 0;
    for (let q = 1; q <= n; q++) { const t = Math.min(pw / q, ph / Math.ceil(n / q)); if (t > tile) { tile = t; cols = q; } }
    const rows = Math.ceil(n / cols), gap = Math.max(2, tile * 0.07), ox = m.l + (pw - cols * tile) / 2, oy = m.t + (ph - rows * tile) / 2;
    const big = tile >= 34;
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const cx = ox + (i % cols) * tile, cy = oy + Math.floor(i / cols) * tile, x = cx + gap / 2, y = cy + gap / 2, sz = tile - gap;
      const seen = i < s.t, shown = seen || s.revealAll, isPick = i === s.picked, isBest = s.revealAll && i === s.bestIdx;
      const observed = i < s.r;
      let fill, txt;
      if (isPick) { fill = css('--accent'); txt = '#fff'; }
      else if (!shown) { fill = '#e3e8f3'; txt = '#9aa5bd'; }
      else if (!seen) { fill = '#f1f3f8'; txt = '#a9b2c6'; }
      else { fill = '#fff'; txt = observed ? '#8b93a6' : '#4a5367'; }
      ctx.fillStyle = fill; L.roundRect(ctx, x, y, sz, sz, Math.max(3, sz * 0.12)); ctx.fill();
      ctx.strokeStyle = '#d5dbe8'; ctx.lineWidth = 1; if (!isPick) ctx.stroke();
      // 구간 표시 막대: 관찰 구간(주황) / 선택 구간(파랑)
      ctx.fillStyle = observed ? AMBER : css('--accent'); const bh = Math.max(3, sz * 0.09);
      if (!isPick) ctx.fillRect(x + sz * 0.12, y + sz - bh - 2, sz * 0.76, bh);
      ctx.fillStyle = txt; ctx.font = `700 ${Math.max(10, Math.min(sz * 0.4, 26))}px ${FONT}`;
      ctx.fillText(shown ? String(s.score[i]) : '?', x + sz / 2, y + sz * 0.58);
      if (big) { ctx.font = `${Math.max(9, sz * 0.17)}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = isPick ? 'rgba(255,255,255,.8)' : '#9aa5bd'; ctx.fillText(String(i + 1), x + 4, y + sz * 0.22); ctx.textAlign = 'center'; }
      if (seen && !isPick && !s.revealAll && i === s.leader) { ctx.strokeStyle = GOLD; ctx.lineWidth = 2; L.roundRect(ctx, x + 1, y + 1, sz - 2, sz - 2, Math.max(3, sz * 0.12)); ctx.stroke(); ctx.fillStyle = GOLD; ctx.font = `${Math.max(10, sz * 0.26)}px ${FONT}`; ctx.fillText('★', x + sz - sz * 0.2, y + sz * 0.26); }
      if (seen && i === s.t - 1 && s.picked < 0) { ctx.strokeStyle = css('--accent'); ctx.lineWidth = 3; L.roundRect(ctx, x, y, sz, sz, Math.max(3, sz * 0.12)); ctx.stroke(); }
      if (isBest) { ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(3, sz * 0.08); L.roundRect(ctx, x - 1, y - 1, sz + 2, sz + 2, Math.max(3, sz * 0.14)); ctx.stroke(); ctx.fillStyle = GOLD; ctx.font = `${Math.max(11, sz * 0.3)}px ${FONT}`; ctx.fillText('★', x + sz - sz * 0.22, y + sz * 0.3); }
      ctx.lineWidth = 1;
    }
    if (!THUMB) L.legend({ ctx, w, m: { l: m.l, t: m.t + ph, r: m.r, b: 0 }, pw, ph: LEG }, [{ kind: 'box', color: AMBER, label: '관찰 구간 (거절만)' }, { kind: 'box', color: css('--accent'), label: '선택 구간 / 고른 후보' }, { kind: 'box', color: GOLD, label: '★ 지금까지의 최고 · 진짜 최고' }], 'tl');
  }

  // 공통: 가로가 컷오프(%)인 차트의 좌표
  function cutChart(id, y1, yt, yfmt, yLabel, items) {
    const mobile = ($(id).clientWidth || 600) < 560, sp = items ? L.belowSpace($(id), items) : null;
    const c = L.chart($(id), (mobile ? 1.0 : 0.6) + (sp ? sp.extra / ($(id).clientWidth || 400) : 0), { l: 44, r: 16, t: 24, b: sp ? sp.b : 42 }), { m, pw, ph } = c;
    const X = (v) => m.l + (v / 100) * pw, Y = (v) => m.t + ph - (v / y1) * ph;
    L.axes(c, { X, Y, yTicks: yt, yFmt: yfmt, xTicks: [0, 20, 40, 60, 80, 100], xFmt: (v) => v + '%', xLabel: '관찰 구간 (%)', yLabel });
    return { c, X, Y };
  }
  const ticks = (y1, st) => { const a = []; for (let v = 0; v <= y1 + 1e-9; v += st) a.push(v); return a; };
  function nowLine(c, X) { const x = (cache.r / sim.n) * 100; L.vline(c, X(x), css('--rich'), '지금 설정', x > 60 ? 'right' : 'left'); }

  function drawProb() {
    const ex = cache.exact, goal = sim.goal, mx = Math.max(...ex.map((d) => d.p), ...cache.dots.map((d) => d.p));
    const y1 = Math.min(1, Math.ceil((mx + 0.04) * 10) / 10), { c, X, Y } = cutChart('c-prob', y1, ticks(y1, y1 > 0.5 ? 0.2 : 0.1), (v) => Math.round(v * 100) + '%', '성공 확률 (%)');
    const { ctx, m, pw } = c;
    if (goal === 1) {
      const y = Y(1 / Math.E); ctx.setLineDash([5, 3]); ctx.strokeStyle = GRAY; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = GRAY; ctx.textAlign = 'right'; L.label(ctx, '후보가 많을 때의 한계 36.8%', m.l + pw - 4, y + 15, 'right');
    }
    ctx.fillStyle = mix(css('--accent'), 0.5); cache.dots.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.p), 3, 0, 7); ctx.fill(); });
    L.line(ctx, ex.map((d) => [X(d.x), Y(d.p)]), css('--accent'), 2.6);
    const o = cache.opt; ctx.fillStyle = GOLD; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(o.x), Y(o.p), 6, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
    nowLine(c, X);
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '정확한 값' }, { kind: 'dot', color: mix(css('--accent'), 0.5), label: '시뮬레이션 (600번씩)' }, { kind: 'dot', color: GOLD, label: '가장 높은 곳' }], 'tl');
  }

  function drawFail() {
    const fItems = [{ kind: 'box', color: GREEN, label: '최고를 골랐다' }, { kind: 'box', color: AMBER, label: '최고가 오기 전에 먼저 멈췄다' }, { kind: 'box', color: RED, label: '최고를 이미 지나쳐 보냈다' }];
    const ex = cache.exact1, { c, X, Y } = cutChart('c-fail', 1, [0, 0.25, 0.5, 0.75, 1], (v) => Math.round(v * 100) + '%', '비율 (%)', fItems);
    const { ctx } = c, E = ex;
    const layers = [[GREEN, (d) => d.best], [AMBER, (d) => d.settled], [RED, (d) => d.passed]]; // 아래부터 쌓는다
    for (let k = 2; k >= 0; k--) {
      ctx.fillStyle = mix(layers[k][0], 0.8); ctx.beginPath();
      const top = (d) => layers.slice(0, k + 1).reduce((a, l) => a + l[1](d), 0);
      E.forEach((d, i) => (i ? ctx.lineTo(X(d.x), Y(top(d))) : ctx.moveTo(X(d.x), Y(top(d)))));
      for (let i = E.length - 1; i >= 0; i--) ctx.lineTo(X(E[i].x), Y(0));
      ctx.closePath(); ctx.fill();
    }
    nowLine(c, X);
    L.drawLegendBelow(c, fItems);
  }

  function binsOf(n) {
    const defs = [[1, 1], [2, 2], [3, 3], [4, 5], [6, 10], [11, 20], [21, 1e9]], out = [];
    defs.forEach(([a, b]) => { if (a > n) return; const hi = Math.min(b, n); out.push({ a, b: hi, label: a === hi ? `${a}위` : b >= 1e9 ? `${a}위 이하` : `${a}~${hi}위` }); });
    return out;
  }
  function drawRank() {
    const n = sim.n, bins = binsOf(n), sum = (arr, a, b) => { let t = 0; for (let k = a; k <= b; k++) t += arr[k - 1]; return t; };
    const ex = bins.map((b) => sum(cache.rank, b.a, b.b)), sm = bins.map((b) => sum(cache.rankDots, b.a, b.b)), rnd = bins.map((b) => (b.b - b.a + 1) / n);
    const mx = Math.max(...ex, ...sm, ...rnd), y1 = Math.min(1, Math.ceil((mx + 0.05) * 10) / 10), mobile = ($('c-rank').clientWidth || 600) < 560;
    const c = L.chart($('c-rank'), mobile ? 1.1 : 0.6, { l: 44, r: 12, t: 24, b: 38 }), { ctx, m, pw, ph, h } = c;
    const Y = (v) => m.t + ph - (v / y1) * ph, bw = pw / bins.length;
    L.axes(c, { X: (v) => v, Y, yTicks: ticks(y1, y1 > 0.5 ? 0.2 : 0.1), yFmt: (v) => Math.round(v * 100) + '%', xLabel: '고른 후보의 순위', yLabel: '비율 (%)' });
    ctx.textAlign = 'center'; ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT;
    bins.forEach((b, i) => {
      const x0 = m.l + i * bw, good = b.b <= sim.goal;
      ctx.fillStyle = mix(good ? GREEN : GRAY, good ? 0.85 : 0.55); ctx.fillRect(x0 + bw * 0.18, Y(ex[i]), bw * 0.64, m.t + ph - Y(ex[i]));
      ctx.strokeStyle = '#2b3347'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + bw * 0.08, Y(rnd[i])); ctx.lineTo(x0 + bw * 0.92, Y(rnd[i])); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#2b3347'; ctx.beginPath(); ctx.arc(x0 + bw / 2, Y(sm[i]), 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = css('--text'); ctx.font = '600 11px ' + FONT; ctx.fillText(pc(ex[i], 0) + '%', x0 + bw / 2, Y(Math.max(ex[i], sm[i], rnd[i])) - 7);
      ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT; ctx.fillText(b.label, x0 + bw / 2, h - m.b + 16);
    });
    L.legend(c, [{ kind: 'box', color: mix(GREEN, 0.85), label: '성공으로 치는 순위' }, { kind: 'box', color: mix(GRAY, 0.55), label: '그 밖의 순위' }, { kind: 'dot', color: '#2b3347', label: '시뮬레이션 (4,000번)' }, { kind: 'line', color: '#2b3347', label: '아무렇게나 골랐을 때' }], mobile ? 'tr' : 'tl');
  }

  function renderStats() {
    const P = sim, n = P.n, r = P.r, o = cache.opt, goal = P.goal, cur = cache.exact[r].p, simp = cache.rankDots.slice(0, goal).reduce((a, b) => a + b, 0);
    const what = goal === 1 ? '최고 한 명을 고를 확률' : `상위 ${goal}명 안에 들 확률`;
    const cards = [
      [goal === 1 ? '가장 좋은 관찰 비율' : `가장 좋은 관찰 비율 (상위 ${goal}명 기준)`, `${Math.round(o.x)}%`, `${o.r}명을 지켜본 뒤 선택 · 이때 ${pc(o.p)}%`],
      [what, `${pc(cur)}%`, `지금 설정(${Math.round((r / n) * 100)}%, ${r}명 관찰) · 시뮬레이션 평균 ${pc(simp)}%`],
      ['아무렇게나 고르면', `${pc(Math.min(1, goal / n))}%`, '제비뽑기처럼 한 명을 고를 때'],
      ['직접 돌려 본 기록', `${tally.wins}/${tally.runs}`, '자동 반복으로 쌓인 성공 횟수 (설정을 바꾸면 처음부터)'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() {
    const P = { n: sim.n, goal: sim.goal };
    cache.exact1 = cache.exact1 && cache.exact1.n === P.n ? cache.exact1 : Object.assign(S.curve(P.n, 1), { n: P.n });
    renderStats(); drawRun();
  }
  function drawCharts() { drawProb(); drawFail(); drawRank(); }

  function countIfDone(seed) {
    if (sim.picked < 0) return;
    const key = tally.sig + '|' + seed;
    if (tally.seen.has(key)) return; tally.seen.add(key);
    tally.runs++; if (sim.success()) tally.wins++;
  }

  let curSeed = 1;
  const h = L.harness({
    controls: ['n', 'cut', 'goal'],
    format: { n: (v) => v + '명', cut: (v) => v + '%', goal: () => '' },
    defaults: { n: 40, cut: 37, goal: 1 },
    speedScale: 1,
    build(seed) {
      curSeed = seed; hold = 0;
      const P = params(seed), sig = [P.n, P.cut, P.goal].join('|');
      if (tally.sig !== sig) tally = { sig, runs: 0, wins: 0, seen: new Set() };
      prepare(P);
      if (THUMB) { // 성공한 판을 골라 끝까지 진행
        for (let s = seed; s < seed + 400; s++) { sim = S.create(Object.assign({}, P, { seed: s })); sim.run(); if (sim.success() && sim.picked > sim.r && sim.bestIdx > sim.r) break; }
        cache.exact1 = null;
      } else sim = S.create(P);
    },
    autoplay: !THUMB,
    advance() {
      if (sim.done) {
        hold++;
        if (hold > 9 && $('loop') && $('loop').checked) $('reroll').click();
        return hold <= 9;
      }
      const ok = sim.advance(); countIfDone(curSeed); return ok;
    },
    isDone() { return sim.done && hold > 9; },
    draw, after() { drawCharts(); }, redrawExtra() { drawCharts(); }, seedLabel: '이번 판 번호',
  });
})();
