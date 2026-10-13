(function () {
  'use strict';
  const WL = window.Wealth;
  const { css, setup, mix, roundRect, axisNames, legend } = window.Lab;
  const $ = (id) => document.getElementById(id);
  const DEFAULTS = { tax: 0, stake: 20, bias: 0, rounds: 300 };
  const TAXES = [0, 0.5, 1, 2, 3, 4, 5, 6, 8];
  const THUMB = /[?&]thumb=1/.test(location.search); // 메인 페이지 썸네일용: 대표 장면으로 바로 간다
  const SPEED = 0.7; // 2026-10-12: 애니메이션을 30% 느리게

  let seed = 1, sim = null;
  let playing = false, acc = 0, lastTs = 0;
  let sweepData = [], sweepToken = 0;

  const pct = (v) => (v * 100).toFixed(0) + '%';
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  function readParams() {
    return {
      seed,
      tax: Number($('tax').value) / 100,
      stake: Number($('stake').value) / 100,
      bias: Number($('bias').value) / 100,
      rounds: Number($('rounds').value),
    };
  }

  function axes(ctx, m, w, h, pw, ph, X, Y, yTicks, yFmt, xTicks, xFmt, xLabel, yLabel) {
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    yTicks.forEach((v) => {
      ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke();
      ctx.fillText(yFmt(v), m.l - 6, Y(v) + 4);
    });
    ctx.textAlign = 'center';
    xTicks.forEach((v) => ctx.fillText(xFmt(v), X(v), h - m.b + 16));
    axisNames({ ctx, w, h, m, pw, ph }, xLabel, yLabel);
  }

  // ---------- ① 부의 계단 ----------
  function drawBars() {
    const { ctx, w, h } = setup($('c-bars'), THUMB ? 1 : 0.5);
    const q = sim.current(), s = q.sorted, n = sim.n, B = 100, per = n / B;
    const bins = [];
    for (let b = 0; b < B; b++) { let t = 0; for (let i = b * per; i < (b + 1) * per; i++) t += s[i]; bins.push(t / per); }
    const m = { l: 44, r: 10, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const ymax = Math.max(2, ...bins) * 1.08;
    const Y = (v) => m.t + ph - (v / ymax) * ph;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const ticks = []; const step = ymax > 40 ? 20 : ymax > 16 ? 8 : ymax > 8 ? 4 : ymax > 4 ? 2 : 1;
    for (let v = 0; v <= ymax; v += step) ticks.push(v);
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    ticks.forEach((v) => { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke(); ctx.fillText(String(v), m.l - 6, Y(v) + 4); });
    const bw = pw / B;
    bins.forEach((v, b) => {
      ctx.fillStyle = b >= 90 ? css('--rich') : v >= 1 ? css('--accent') : '#b9c3da';
      const x = m.l + b * bw + 0.7, hh = Math.max(1, m.t + ph - Y(v));
      roundRect(ctx, x, Y(v), Math.max(1, bw - 1.4), hh, Math.min(2.5, bw / 2)); ctx.fill();
    });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--text'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(m.l, Y(1)); ctx.lineTo(w - m.r, Y(1)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    axisNames({ ctx, w, h, m, pw, ph }, '재산 순서 (가난 → 부자)', '재산 (평균의 배수)');
    if (!THUMB) legend({ ctx, w, h, m, pw, ph }, [{ kind: 'box', color: '#b9c3da', label: '평균 이하' }, { kind: 'box', color: css('--accent'), label: '평균 이상' }, { kind: 'box', color: css('--rich'), label: '상위 10%' }, { kind: 'dash', color: css('--text'), label: '평균 (모두 같았을 때)' }], 'tl');
    $('when').textContent = `${sim.round}/${sim.params.rounds} 라운드 · 상위 10%의 몫 ${pct(q.top10)}`;
  }

  // ---------- ② 로렌츠 ----------
  function drawLorenz() {
    const { ctx, w, h } = setup($('c-lorenz'), 0.85);
    const q = sim.current(), s = q.sorted, n = sim.n;
    const m = { l: 44, r: 14, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - v * ph;
    const tk = [0, 0.25, 0.5, 0.75, 1];
    axes(ctx, m, w, h, pw, ph, X, Y, tk, pct, tk, pct, '인구 (%, 가난한 사람부터)', '재산 누적 (%)');
    const pts = [[0, 0]]; let acc = 0;
    const step = Math.max(1, Math.floor(n / 200));
    for (let i = 0; i < n; i++) { acc += s[i]; if ((i + 1) % step === 0 || i === n - 1) pts.push([(i + 1) / n, acc / q.total]); }
    ctx.fillStyle = mix(css('--accent'), 0.12); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(X(pts[i][0]), Y(pts[i][1]));
    ctx.closePath(); ctx.fill();
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = css('--accent'); ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(`지니계수 ${q.gini.toFixed(2)}`, X(0.05), Y(0.66));
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = css('--accent');
    ctx.beginPath(); ctx.arc(X(0.5), Y(q.bottom50), 4.5, 0, 7); ctx.fill();
    ctx.textAlign = 'right'; ctx.fillText(`하위 50%는 ${pct(q.bottom50)}`, X(0.5) - 8, Y(q.bottom50) - 8);
    legend({ ctx, w, h, m, pw, ph }, [{ kind: 'dash', color: css('--muted'), label: '완전한 평등' }, { kind: 'line', color: css('--accent'), label: '지금의 사회' }], 'tl');
  }

  // ---------- ③ 시간에 따른 지표 ----------
  function drawTime() {
    const { ctx, w, h } = setup($('c-time'), 0.7);
    const st = sim.stats, T = sim.params.rounds;
    const m = { l: 44, r: 12, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - v * ph;
    const xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    axes(ctx, m, w, h, pw, ph, X, Y, [0, 0.25, 0.5, 0.75, 1], pct, xt, (t) => String(Math.round(t)), '시간 (라운드)', '몫 (%) · 지니계수');
    const line = (key, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
      st.forEach((s, t) => (t ? ctx.lineTo(X(t), Y(s[key])) : ctx.moveTo(X(t), Y(s[key])))); ctx.stroke(); ctx.lineWidth = 1;
      const last = st.length - 1; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(last), Y(st[last][key]), 4, 0, 7); ctx.fill();
    };
    line('bottom50', css('--lucky')); line('top10', css('--rich')); line('gini', css('--accent'));
    legend({ ctx, w, h, m, pw, ph }, [{ kind: 'line', color: css('--accent'), label: '지니계수' }, { kind: 'line', color: css('--rich'), label: '상위 10%의 몫' }, { kind: 'line', color: css('--lucky'), label: '하위 50%의 몫' }], 'tl');
  }

  // ---------- ④ 같은 출발선 8명 ----------
  function drawTrack() {
    const { ctx, w, h } = setup($('c-track'), 0.7);
    const T = sim.params.rounds, n = sim.n, H = sim.history;
    const lo = -3, hi = Math.max(1, Math.ceil(Math.log10(Math.max(...sim.wealth)))) ;
    const m = { l: 48, r: 12, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = (t) => m.l + (t / T) * pw, Y = (k) => m.t + ph - ((k - lo) / (hi - lo)) * ph;
    const yt = []; for (let k = lo; k <= hi; k++) yt.push(k);
    const xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    axes(ctx, m, w, h, pw, ph, X, Y, yt, (k) => (k === 0 ? '1' : String(Math.pow(10, k))), xt, (t) => String(Math.round(t)), '시간 (라운드)', '재산 (평균의 배수, 로그 눈금)');
    const kv = (v) => Math.max(lo, Math.log10(Math.max(v, 1e-9)));
    const rich = sim.wealth.indexOf(Math.max(...sim.wealth));
    const draw = (i, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let t = 0; t <= sim.round; t++) { const v = H[t * n + i]; (t ? ctx.lineTo(X(t), Y(kv(v))) : ctx.moveTo(X(t), Y(kv(v)))); }
      ctx.stroke(); ctx.lineWidth = 1;
    };
    const palette = ['#7c5cff', '#3b82f6', '#1fa463', '#e5484d', '#f59e42', '#0ea5a5', '#c04bd8', '#636a7a'];
    sim.tracked.forEach((i, k) => draw(i, mix(palette[k % palette.length], 0.65), 1.6));
    if (sim.round > 0) draw(rich, css('--rich'), 3);
    legend({ ctx, w, h, m, pw, ph }, [{ kind: 'line', color: css('--rich'), label: '지금 가장 부자인 사람' }, { kind: 'line', color: mix('#636a7a', 0.65), label: '처음 같았던 사람들 (색은 사람별)' }], 'tl');
  }

  // ---------- ⑤ 재분배율 스윕 ----------
  function drawSweep() {
    const { ctx, w, h } = setup($('c-sweep'), 0.7);
    const m = { l: 44, r: 14, t: 24, b: 40 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = (v) => m.l + (v / 8) * pw, Y = (v) => m.t + ph - v * ph;
    axes(ctx, m, w, h, pw, ph, X, Y, [0, 0.25, 0.5, 0.75, 1], (v) => v.toFixed(2), [0, 2, 4, 6, 8], (v) => String(v), '나눠 갖는 비율 (%, 라운드마다)', '지니계수');
    ctx.fillStyle = mix(css('--accent'), 0.22);
    sweepData.forEach((d) => d.runs.forEach((r) => { ctx.beginPath(); ctx.arc(X(d.x), Y(r), 2.6, 0, 7); ctx.fill(); }));
    if (sweepData.length) {
      ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
      sweepData.forEach((d, i) => (i ? ctx.lineTo(X(d.x), Y(d.mean)) : ctx.moveTo(X(d.x), Y(d.mean)))); ctx.stroke();
      ctx.lineWidth = 1; ctx.fillStyle = css('--accent');
      sweepData.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.mean), 3.5, 0, 7); ctx.fill(); });
    }
    const cur = sim.params.tax * 100;
    ctx.strokeStyle = css('--rich'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(cur), m.t); ctx.lineTo(X(cur), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--rich'); ctx.textAlign = cur > 4 ? 'right' : 'left'; ctx.fillText('지금 설정', X(cur) + (cur > 4 ? -5 : 5), m.t + 11);
    legend({ ctx, w, h, m, pw, ph }, [{ kind: 'dot', color: mix(css('--accent'), 0.5), label: '한 번의 실행' }, { kind: 'line', color: css('--accent'), label: '평균' }], 'tr');
  }

  function runSweep() {
    const token = ++sweepToken, P = readParams();
    sweepData = [];
    $('note-sweep').textContent = '계산 중…';
    drawSweep();
    (function next(i) {
      if (token !== sweepToken) return;
      if (i >= TAXES.length) {
        const a = sweepData[0], b = sweepData.find((d) => d.x === 1) || sweepData[1];
        $('note-sweep').textContent = `걷지 않으면 지니계수 ${a.mean.toFixed(2)}, 1%만 걷어 나누면 ${b.mean.toFixed(2)}`;
        return;
      }
      const runs = WL.finalGini(Object.assign({}, P, { tax: TAXES[i] / 100 }), 5);
      sweepData.push({ x: TAXES[i], runs, mean: mean(runs) });
      drawSweep();
      setTimeout(() => next(i + 1), 0);
    })(0);
  }

  // ---------- 통계 / 흐름 ----------
  function renderStats() {
    const q = sim.stats[sim.stats.length - 1], rich = Math.max(...sim.wealth);
    const cards = [
      ['지니계수', q.gini.toFixed(2), '0이면 평등, 1이면 한 사람이 전부'],
      ['상위 10%의 몫', pct(q.top10), '처음엔 10%'],
      ['하위 50%의 몫', pct(q.bottom50), '처음엔 50%'],
      ['가장 부자의 재산', rich >= 10 ? Math.round(rich) + '배' : rich.toFixed(1) + '배', '평균 대비 (처음엔 모두 1배)'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) =>
      `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function refresh() { renderStats(); drawBars(); drawLorenz(); drawTime(); drawTrack(); }

  function showOutputs() {
    $('o-tax').textContent = Number($('tax').value).toFixed(1) + '%';
    $('o-stake').textContent = $('stake').value + '%';
    $('o-bias').textContent = $('bias').value + '%';
    $('o-rounds').textContent = $('rounds').value + '라운드';
  }

  function restart(auto) {
    sim = WL.create(readParams());
    acc = 0; playing = !!auto;
    $('play').textContent = playing ? '⏸ 일시정지' : '▶ 재생';
    $('seedinfo').textContent = `운의 번호 #${seed}`;
    refresh();
  }
  function newExperiment() { restart(true); runSweep(); }

  function tick(ts) {
    if (playing) {
      acc += Math.min(0.25, (ts - lastTs) / 1000) * Number($('speed').value) * SPEED; // 첫 프레임·탭 복귀 때 한꺼번에 건너뛰지 않게
      let moved = false;
      while (acc >= 1 && playing) {
        acc -= 1; moved = sim.advance() || moved;
        if (sim.done) { playing = false; $('play').textContent = '▶ 다시 재생'; }
      }
      if (moved) refresh();
    }
    lastTs = ts;
    requestAnimationFrame(tick);
  }

  ['tax', 'stake', 'bias', 'rounds'].forEach((id) => {
    $(id).addEventListener('input', showOutputs);
    $(id).addEventListener('change', newExperiment);
  });
  $('run').addEventListener('click', newExperiment);
  $('reroll').addEventListener('click', () => { seed++; newExperiment(); });
  $('reset').addEventListener('click', () => {
    Object.entries(DEFAULTS).forEach(([k, v]) => { $(k).value = v; });
    seed = 1; showOutputs(); newExperiment();
  });
  $('play').addEventListener('click', () => {
    if (sim.done) restart(true); else { playing = !playing; $('play').textContent = playing ? '⏸ 일시정지' : '▶ 재생'; }
  });
  $('restart').addEventListener('click', () => restart(false));

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { refresh(); drawSweep(); }, 150); });

  showOutputs();
  newExperiment();
  if (THUMB) { sim.run(); playing = false; refresh(); }
  requestAnimationFrame((ts) => { lastTs = ts; tick(ts); });
})();
