(function () {
  'use strict';
  const RM = window.Rumor;
  const { css, setup, mix, roundRect, axisNames, legend } = window.Lab;
  const $ = (id) => document.getElementById(id);
  const DEFAULTS = { p: 1.5, correctionDelay: 3, rooms: 50, perPerson: 3, seeds: 3 };
  const THUMB = /[?&]thumb=1/.test(location.search); // 메인 페이지 썸네일용: 대표 장면으로 바로 간다
  const SPEED = 0.7; // 2026-10-12: 애니메이션을 30% 느리게
  const COL = { unknown: '#b6bfd3', spread: '#e5484d', done: '#f2a3a6', cspread: '#2f6fed', cdone: '#9ec1ff' };

  let seed = 1, sim = null, pos = null;
  let playing = false, acc = 0, lastTs = 0;
  let pData = [], cData = [], base = null, sweepToken = 0;

  const pct = (v) => (v * 100).toFixed(0) + '%';

  function readParams() {
    return {
      seed,
      p: Number($('p').value) / 100,
      correctionDelay: Number($('correctionDelay').value),
      rooms: Number($('rooms').value),
      perPerson: Number($('perPerson').value),
      seeds: Number($('seeds').value),
    };
  }

  // ---------- 네트워크 배치 (힘 기반) ----------
  function layout(s) {
    const n = s.n, R = s.rooms, N = n + R;
    let a = 12345 + seed;
    const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    const x = new Float64Array(N), y = new Float64Array(N);
    for (let r = 0; r < R; r++) { x[n + r] = rnd(); y[n + r] = rnd(); }
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0;
      s.personRooms[i].forEach((r) => { sx += x[n + r]; sy += y[n + r]; });
      x[i] = sx / s.personRooms[i].length + (rnd() - 0.5) * 0.05;
      y[i] = sy / s.personRooms[i].length + (rnd() - 0.5) * 0.05;
    }
    const k = Math.sqrt(1 / N) * 0.9;
    const dx = new Float64Array(N), dy = new Float64Array(N);
    const ITER = 140;
    for (let it = 0; it < ITER; it++) {
      dx.fill(0); dy.fill(0);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let ex = x[i] - x[j], ey = y[i] - y[j];
          let d2 = ex * ex + ey * ey + 1e-9;
          if (d2 > 0.09) continue;
          const f = (k * k) / d2 * (i >= n && j >= n ? 4 : 1);
          dx[i] += ex * f; dy[i] += ey * f; dx[j] -= ex * f; dy[j] -= ey * f;
        }
      }
      for (let i = 0; i < n; i++) {
        for (const r of s.personRooms[i]) {
          const j = n + r, ex = x[i] - x[j], ey = y[i] - y[j];
          const d = Math.sqrt(ex * ex + ey * ey) + 1e-9, f = d / k * 0.5;
          dx[i] -= ex / d * f * d; dy[i] -= ey / d * f * d;
          dx[j] += ex / d * f * d; dy[j] += ey / d * f * d;
        }
      }
      const t = 0.03 * (1 - it / ITER) + 0.002;
      for (let i = 0; i < N; i++) {
        const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) + 1e-9, m = Math.min(d, t);
        x[i] += dx[i] / d * m; y[i] += dy[i] / d * m;
        x[i] = Math.min(1.2, Math.max(-0.2, x[i])); y[i] = Math.min(1.2, Math.max(-0.2, y[i]));
      }
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < N; i++) { x0 = Math.min(x0, x[i]); x1 = Math.max(x1, x[i]); y0 = Math.min(y0, y[i]); y1 = Math.max(y1, y[i]); }
    const nx = new Float64Array(N), ny = new Float64Array(N);
    for (let i = 0; i < N; i++) { nx[i] = (x[i] - x0) / (x1 - x0 || 1); ny[i] = (y[i] - y0) / (y1 - y0 || 1); }
    return { x: nx, y: ny };
  }

  // ---------- ① 네트워크 그리기 ----------
  function drawNet() {
    const nItems = [{ kind: 'dot', color: COL.unknown, label: '소문을 아직 모름' }, { kind: 'dot', color: COL.spread, label: '소문 퍼뜨리는 중' }, { kind: 'dot', color: COL.done, label: '알지만 멈춤' }, { kind: 'dot', color: COL.cspread, label: '정정 퍼뜨리는 중' }, { kind: 'dot', color: COL.cdone, label: '정정을 본 사람' }];
    const nLegH = THUMB ? 0 : window.Lab.belowSpace($('c-net'), nItems).rows * 17 + 8;
    const { ctx, w, h } = setup($('c-net'), 0.78 + nLegH / ($('c-net').clientWidth || 400));
    const n = sim.n, R = sim.rooms, pad = 26;
    const X = (v) => pad + v * (w - pad * 2), Y = (v) => pad + v * (h - nLegH - pad * 2);
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);

    // 평소엔 거의 안 보이는 연결선, 이번 차례에 글이 올라온 방에서는 멤버에게 색 선이 뻗는다
    ctx.strokeStyle = 'rgba(99,106,122,.035)'; ctx.lineWidth = 0.7; ctx.beginPath();
    for (let i = 0; i < n; i++) for (const r of sim.personRooms[i]) {
      ctx.moveTo(X(pos.x[i]), Y(pos.y[i])); ctx.lineTo(X(pos.x[n + r]), Y(pos.y[n + r]));
    }
    ctx.stroke();
    [[sim.lastCorrRoom, '#2f6fed'], [sim.lastRumorRoom, '#e5484d']].forEach(([flags, col]) => {
      ctx.strokeStyle = mix(col, 0.2); ctx.lineWidth = 0.9; ctx.beginPath();
      for (let r = 0; r < R; r++) {
        if (!flags[r]) continue;
        for (const j of sim.roomMembers[r]) { ctx.moveTo(X(pos.x[n + r]), Y(pos.y[n + r])); ctx.lineTo(X(pos.x[j]), Y(pos.y[j])); }
      }
      ctx.stroke();
    });

    // 방: 이번 차례에 글이 올라온 방은 빛난다
    for (let r = 0; r < R; r++) {
      const cx = X(pos.x[n + r]), cy = Y(pos.y[n + r]);
      const size = 8 + Math.sqrt(sim.roomMembers[r].length) * 1.5;
      const glow = sim.lastRumorRoom[r] ? '#e5484d' : sim.lastCorrRoom[r] ? '#2f6fed' : null;
      if (glow) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 2.6);
        g.addColorStop(0, mix(glow, 0.35)); g.addColorStop(1, mix(glow, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, size * 2.6, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = glow ? glow : '#c9d0e0'; ctx.lineWidth = glow ? 2 : 1.2;
      roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 3); ctx.fill(); ctx.stroke();
    }

    // 사람
    const color = (i) => {
      if (sim.corr[i] === 1) return COL.cspread;
      if (sim.corr[i] === 2) return COL.cdone;
      if (sim.rumor[i] === 1) return COL.spread;
      if (sim.rumor[i] === 2) return COL.done;
      return COL.unknown;
    };
    const order = [[], [], []];
    for (let i = 0; i < n; i++) {
      const spreading = sim.rumor[i] === 1 || sim.corr[i] === 1;
      const known = sim.rumor[i] > 0 || sim.corr[i] > 0;
      order[spreading ? 2 : known ? 1 : 0].push(i);
    }
    ctx.lineWidth = 1;
    order.forEach((group, layer) => {
      group.forEach((i) => {
        const x = X(pos.x[i]), y = Y(pos.y[i]);
        const c = color(i);
        if (layer === 2) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
          g.addColorStop(0, mix(c, 0.35)); g.addColorStop(1, mix(c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
        }
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, layer === 2 ? 3.8 : 2.8, 0, 7); ctx.fill();
      });
    });

    if (!THUMB) window.Lab.drawLegendBelow({ ctx, w, h, m: { l: 0, r: 0, t: 0, b: nLegH + 28 } }, nItems);
    const c = sim.history[sim.history.length - 1];
    const tag = sim.params.correctionDelay > 0 && !sim.correctionStarted ? ` · 정정은 ${sim.params.correctionDelay + 1}차례째에 시작` : sim.correctionStarted ? ' · 정정 퍼지는 중' : '';
    $('when').textContent = `${sim.round}차례 · 소문을 아는 사람 ${pct(c.heard / sim.n)}${tag}`;
  }

  // ---------- ② 쌓인 영역 그래프 ----------
  function drawArea() {
    const aItems = [{ kind: 'box', color: '#cfd5e3', label: '모름' }, { kind: 'box', color: '#9ec1ff', label: '정정 덕에 안 속음' }, { kind: 'box', color: '#e5484d', label: '퍼뜨리는 중' }, { kind: 'box', color: '#f2a3a6', label: '알고 멈춤' }], asp = window.Lab.belowSpace($('c-area'), aItems);
    const { ctx, w, h } = setup($('c-area'), 0.7 + asp.extra / ($('c-area').clientWidth || 400));
    const H = sim.history, T = Math.max(H.length - 1, 8), n = sim.n;
    const m = { l: 44, r: 12, t: 24, b: asp.b };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (v / n) * ph;
    const layers = [
      ['#cfd5e3', (c) => c.unknown - c.immune],
      ['#9ec1ff', (c) => c.immune],
      ['#e5484d', (c) => c.spreading],
      ['#f2a3a6', (c) => c.done],
    ];
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    for (let v = 0; v <= 1.0001; v += 0.25) {
      ctx.beginPath(); ctx.moveTo(m.l, Y(v * n)); ctx.lineTo(w - m.r, Y(v * n)); ctx.stroke();
      ctx.fillText(pct(v), m.l - 6, Y(v * n) + 4);
    }
    ctx.textAlign = 'center';
    const stepT = Math.max(1, Math.ceil(T / 8));
    for (let t = 0; t <= T; t += stepT) ctx.fillText(String(t), X(t), h - m.b + 16);
    axisNames({ ctx, w, h, m, pw, ph }, '시간 (차례)', '사람 비율 (%)');

    const acc = H.map(() => 0);
    layers.forEach(([col, fn]) => {
      ctx.fillStyle = col; ctx.beginPath();
      H.forEach((c, t) => { ctx.lineTo(X(t), Y(acc[t] + fn(c))); });
      for (let t = H.length - 1; t >= 0; t--) ctx.lineTo(X(t), Y(acc[t]));
      ctx.closePath(); ctx.fill();
      H.forEach((c, t) => { acc[t] += fn(c); });
    });
    if (sim.params.correctionDelay > 0 && H.length - 1 >= sim.params.correctionDelay) {
      const t = sim.params.correctionDelay + 1 <= H.length - 1 ? sim.params.correctionDelay + 1 : H.length - 1;
      ctx.strokeStyle = css('--accent'); ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(X(t), m.t); ctx.lineTo(X(t), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css('--accent'); ctx.textAlign = 'left'; ctx.fillText('정정 시작', X(t) + 4, m.t + 12);
    }
    window.Lab.drawLegendBelow({ ctx, w, h, m }, aItems);
  }

  // ---------- ③④ 점 그래프 ----------
  function drawDots(canvasId, data, xs, xLabel, xFmt, opts) {
    const dItems = [{ kind: 'dot', color: mix(css('--accent'), 0.5), label: '한 번의 실행' }, { kind: 'line', color: css('--accent'), label: '평균' }], dsp = window.Lab.belowSpace($(canvasId), dItems);
    const { ctx, w, h } = setup($(canvasId), 0.7 + dsp.extra / ($(canvasId).clientWidth || 400));
    const m = { l: 44, r: 14, t: 24, b: dsp.b };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const x0 = xs[0], x1 = xs[xs.length - 1];
    const X = (v) => m.l + ((v - x0) / (x1 - x0 || 1)) * pw, Y = (v) => m.t + ph - v * ph;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    for (let v = 0; v <= 1.0001; v += 0.25) {
      ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke();
      ctx.fillText(pct(v), m.l - 6, Y(v) + 4);
    }
    ctx.textAlign = 'center';
    const every = Math.max(1, Math.ceil(xs.length / 7));
    xs.forEach((v, i) => { if (i % every === 0) ctx.fillText(xFmt(v), X(v), h - m.b + 16); });
    axisNames({ ctx, w, h, m, pw, ph }, xLabel, '소문이 닿은 사람 (%)');

    if (opts.baseline != null) {
      ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--unlucky'); ctx.beginPath();
      ctx.moveTo(m.l, Y(opts.baseline)); ctx.lineTo(w - m.r, Y(opts.baseline)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css('--unlucky'); ctx.textAlign = 'left';
      ctx.fillText('정정 없음 ' + pct(opts.baseline), m.l + 6, Y(opts.baseline) + 15); // 위쪽 '지금 설정' 표시와 겹치지 않게 선 아래에
    }
    ctx.fillStyle = mix(css('--accent'), 0.22);
    data.forEach((d) => d.runs.forEach((r) => { ctx.beginPath(); ctx.arc(X(d.x), Y(r), 2.6, 0, 7); ctx.fill(); }));
    if (data.length) {
      ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
      data.forEach((d, i) => (i ? ctx.lineTo(X(d.x), Y(d.mean)) : ctx.moveTo(X(d.x), Y(d.mean)))); ctx.stroke();
      ctx.lineWidth = 1; ctx.fillStyle = css('--accent');
      data.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.mean), 3.5, 0, 7); ctx.fill(); });
    }
    if (opts.current != null && opts.current >= x0 && opts.current <= x1) {
      ctx.strokeStyle = css('--rich'); ctx.setLineDash([2, 3]); ctx.beginPath();
      ctx.moveTo(X(opts.current), m.t); ctx.lineTo(X(opts.current), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css('--rich'); ctx.textAlign = opts.current > (x0 + x1) / 2 ? 'right' : 'left';
      ctx.fillText('지금 설정', X(opts.current) + (opts.current > (x0 + x1) / 2 ? -5 : 5), m.t + 11);
    }
    window.Lab.drawLegendBelow({ ctx, w, h, m }, dItems);
  }

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const PS = [], DS = [1, 2, 3, 4, 5, 6, 8, 10];
  for (let v = 0.5; v <= 5.0001; v += 0.5) PS.push(v / 100);

  function renderSweeps() {
    drawDots('c-p', pData, PS, '솔깃할 확률 (%)', (v) => (v * 100).toFixed(1), { current: sim.params.p });
    drawDots('c-corr', cData, DS, '정정 시작 시점 (차례)', (v) => String(v), { baseline: base, current: sim.params.correctionDelay || null });
  }

  function runSweeps() {
    const token = ++sweepToken, P = readParams();
    pData = []; cData = []; base = null;
    $('note-p').textContent = '계산 중…'; $('note-corr').textContent = '계산 중…';
    renderSweeps();
    const jobs = [];
    jobs.push(() => { base = mean(RM.reach(Object.assign({}, P, { correctionDelay: 0 }), 10)); });
    DS.forEach((d) => jobs.push(() => {
      const runs = RM.reach(Object.assign({}, P, { correctionDelay: d }), 10);
      cData.push({ x: d, runs, mean: mean(runs) });
    }));
    PS.forEach((pp) => jobs.push(() => {
      const runs = RM.reach(Object.assign({}, P, { p: pp }), 8);
      pData.push({ x: pp, runs, mean: mean(runs) });
    }));
    (function next(i) {
      if (token !== sweepToken) return;
      if (i >= jobs.length) {
        const first = cData[0], last = cData[cData.length - 1];
        $('note-corr').textContent = `정정이 ${first.x}차례 뒤에 나오면 ${pct(first.mean)}, ${last.x}차례 뒤에 나오면 ${pct(last.mean)}가 소문을 알게 됩니다`;
        $('note-p').textContent = '점이 흩어진 곳이 운에 따라 결과가 갈리는 구간입니다';
        return;
      }
      jobs[i]();
      renderSweeps();
      setTimeout(() => next(i + 1), 0);
    })(0);
  }

  // ---------- 통계 / 진행 ----------
  function renderStats() {
    const c = sim.history[sim.history.length - 1];
    const cards = [
      ['소문을 아는 사람', pct(c.heard / sim.n), `${c.heard}명 / ${sim.n}명`],
      ['한꺼번에 퍼뜨린 최대 인원', sim.peakSpreaders + '명', '가장 뜨거웠던 순간'],
      ['지나간 차례', sim.round + '차례', sim.done ? '소문이 잦아듦' : '진행 중'],
      ['정정 덕에 안 속은 사람', c.immune + '명', sim.params.correctionDelay ? '소문보다 정정을 먼저 본 사람' : '정정 없음'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) =>
      `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function showOutputs() {
    $('o-p').textContent = Number($('p').value).toFixed(1) + '%';
    const d = Number($('correctionDelay').value);
    $('o-correctionDelay').textContent = d ? d + '차례 뒤' : '없음';
    $('o-rooms').textContent = $('rooms').value + '개';
    $('o-perPerson').textContent = $('perPerson').value + '개';
    $('o-seeds').textContent = $('seeds').value + '명';
  }

  function refresh() { renderStats(); drawNet(); drawArea(); }

  function restart(auto) {
    sim = RM.create(readParams());
    pos = layout(sim);
    acc = 0; playing = !!auto;
    $('play').textContent = playing ? '⏸ 일시정지' : '▶ 재생';
    $('seedinfo').textContent = `단톡방 구성 #${seed}`;
    refresh();
  }

  function newExperiment() { restart(true); runSweeps(); }

  function stepOnce() {
    if (sim.done) return false;
    sim.advance(); refresh();
    return !sim.done;
  }

  function tick(ts) {
    if (playing) {
      acc += Math.min(0.25, (ts - lastTs) / 1000) * Number($('speed').value) * SPEED; // 첫 프레임·탭 복귀 때 한꺼번에 건너뛰지 않게
      while (acc >= 1 && playing) {
        acc -= 1;
        if (!stepOnce()) { playing = false; $('play').textContent = '▶ 다시 재생'; }
      }
    }
    lastTs = ts;
    requestAnimationFrame(tick);
  }

  ['p', 'correctionDelay', 'rooms', 'perPerson', 'seeds'].forEach((id) => {
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
  $('stepbtn').addEventListener('click', () => { playing = false; $('play').textContent = '▶ 재생'; stepOnce(); });
  $('restart').addEventListener('click', () => restart(false));

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { refresh(); renderSweeps(); }, 150); });

  showOutputs();
  newExperiment();
  if (THUMB) { // 소문이 가장 뜨겁게 퍼지는 차례에서 멈춘 장면
    const probe = RM.create(readParams()); let best = 0, at = 0;
    while (!probe.done) { probe.advance(); const c = probe.history[probe.history.length - 1]; if (c.spreading > best) { best = c.spreading; at = probe.round; } }
    while (sim.round < at && !sim.done) sim.advance();
    playing = false; refresh();
  }
  requestAnimationFrame((ts) => { lastTs = ts; tick(ts); });
})();
