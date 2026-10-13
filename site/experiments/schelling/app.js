(function () {
  'use strict';
  const SC = window.Schelling;
  const { css, setup, mix, roundRect } = window.Lab, Lab = window.Lab;
  const $ = (id) => document.getElementById(id);
  const DEFAULTS = { threshold: 30, empty: 10, shareA: 50 };
  const THUMB = /[?&]thumb=1/.test(location.search); // 메인 페이지 썸네일용: 대표 장면으로 바로 간다
  const SPEED = 0.7; // 2026-10-12: 애니메이션을 30% 느리게

  let seed = 1, sim = null, m0 = null;
  let playing = false, acc = 0, lastTs = 0;
  let sweepData = [], sweepToken = 0;

  const pct = (v) => (v * 100).toFixed(0) + '%';

  function readParams() {
    return {
      seed,
      threshold: Number($('threshold').value) / 100,
      empty: Number($('empty').value) / 100,
      shareA: Number($('shareA').value) / 100,
    };
  }

  // ---------- 격자 그리기 ----------
  function drawGrid(canvas, grid, size, unhappySet) {
    const strip = THUMB ? 0 : 66;   // 격자 아래 범례 자리
    const { ctx, w } = setup(canvas, 1 + strip / (canvas.clientWidth || 300));
    ctx.fillStyle = '#f1f4fa'; ctx.fillRect(0, 0, w, w);
    const c = w / size, gap = Math.max(0.6, c * 0.12);
    const ca = css('--ga'), cb = css('--gb');
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i]) continue;
      const x = (i % size) * c, y = Math.floor(i / size) * c;
      ctx.fillStyle = grid[i] === 1 ? ca : cb;
      roundRect(ctx, x + gap / 2, y + gap / 2, c - gap, c - gap, c * 0.28); ctx.fill();
      if (unhappySet && unhappySet.has(i)) {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath(); ctx.arc(x + c / 2, y + c / 2, Math.max(1, c * 0.17), 0, 7); ctx.fill();
      }
    }
    if (strip && canvas.id === 'c-now') Lab.legend({ ctx, w, m: { l: 0, t: w, r: 0, b: 0 }, pw: w, ph: strip }, [{ kind: 'box', color: ca, label: '파랑 집단' }, { kind: 'box', color: cb, label: '주황 집단' }, { kind: 'dot', color: '#c9d0de', label: '빈 칸' }], 'tl');
  }

  function drawBoards() {
    const un0 = new Set(), unNow = new Set();
    // 처음 배치의 불만족자
    const tmp = SC.create(Object.assign({}, sim.params));
    tmp.unhappyList().forEach((i) => un0.add(i));
    sim.unhappyList().forEach((i) => unNow.add(i));
    drawGrid($('c-before'), sim.initial, sim.size, un0);
    drawGrid($('c-now'), sim.grid, sim.size, unNow);
  }

  // ---------- 통계 / 상태 ----------
  function renderStats() {
    const m = sim.metrics();
    const unhappyN = sim.unhappyList().length;
    const cards = [
      ['지금 분리도', pct(m.avgSame), `처음 ${pct(m0.avgSame)} → 지금 ${pct(m.avgSame)} (섞여 있으면 약 50%)`],
      ['원하던 비율', pct(sim.params.threshold), '사람들이 바란 같은 이웃 비율'],
      ['불만족한 사람', unhappyN === 0 ? '0명' : unhappyN + '명', `전체의 ${pct(m.unhappyShare)} · 처음엔 ${pct(m0.unhappyShare)}`],
      ['이사 라운드', sim.round + '회', sim.done ? (unhappyN === 0 ? '모두 만족해서 멈춤' : '끝내 만족 못 한 채 중단') : '진행 중'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) =>
      `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    $('when').textContent = `${sim.round}라운드 · 분리도 ${pct(m.avgSame)}`;
    $('cap-now').textContent = sim.done ? (unhappyN === 0 ? `지금 (${sim.round}라운드 만에 모두 만족)` : `지금 (${sim.round}라운드, 계속 이사 중)`) : `지금 (${sim.round}라운드)`;
  }

  // ---------- 선 그래프: 라운드별 분리도 ----------
  function drawLine() {
    const { ctx, w, h } = setup($('c-line'), 0.7);
    const hist = sim.history, T = Math.max(hist.length - 1, 5);
    const m = { l: 44, r: 12, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const lo = 0.4, hi = 1;
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    for (let v = 0.4; v <= 1.0001; v += 0.2) {
      ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke();
      ctx.fillText(pct(v), m.l - 6, Y(v) + 4);
    }
    ctx.textAlign = 'center';
    const stepT = Math.max(1, Math.ceil(T / 6));
    for (let t = 0; t <= T; t += stepT) ctx.fillText(String(t), X(t), h - m.b + 16);
    Lab.axisNames({ ctx, w, h, m }, '시간 (이사 라운드)', '분리도 (%)');

    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath();
    ctx.moveTo(m.l, Y(0.5)); ctx.lineTo(w - m.r, Y(0.5)); ctx.stroke(); ctx.setLineDash([]);

    ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
    hist.forEach((v, t) => (t ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v)))); ctx.stroke();
    ctx.lineWidth = 1;
    const last = hist.length - 1;
    ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(hist[last]), 4.5, 0, 7); ctx.fill();
    Lab.legend({ ctx, w, m, pw, ph }, [{ kind: 'line', color: css('--accent'), label: '분리도' }, { kind: 'dash', color: css('--muted'), label: '섞여 있을 때(약 50%)' }], 'tl');
  }

  // ---------- 스윕 그래프 ----------
  function drawSweep() {
    const { ctx, w, h } = setup($('c-sweep'), 0.7);
    const m = { l: 44, r: 12, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const lo = 0.4, hi = 1, xmax = 0.8;
    const X = (t) => m.l + (t / xmax) * pw, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    for (let v = 0.4; v <= 1.0001; v += 0.2) {
      ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke();
      ctx.fillText(pct(v), m.l - 6, Y(v) + 4);
    }
    ctx.textAlign = 'center';
    for (let t = 0; t <= 0.8001; t += 0.2) ctx.fillText(pct(t), X(t), h - m.b + 16);
    Lab.axisNames({ ctx, w, h, m }, '원하는 같은 이웃 비율 (%)', '결과 분리도 (%)');

    // y = x (원한 만큼만 분리된 경우)
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath();
    ctx.moveTo(X(0.4), Y(0.4)); ctx.lineTo(X(0.8), Y(0.8)); ctx.stroke(); ctx.setLineDash([]);

    if (sweepData.length) {
      ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
      sweepData.forEach((d, i) => (i ? ctx.lineTo(X(d.threshold), Y(d.avgSame)) : ctx.moveTo(X(d.threshold), Y(d.avgSame)))); ctx.stroke();
      ctx.lineWidth = 1; ctx.fillStyle = css('--accent');
      sweepData.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.threshold), Y(d.avgSame), 3, 0, 7); ctx.fill(); });
    }
    // 지금 설정 위치
    const cur = sim.params.threshold;
    ctx.strokeStyle = css('--rich'); ctx.setLineDash([2, 3]); ctx.beginPath();
    ctx.moveTo(X(cur), m.t); ctx.lineTo(X(cur), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--rich'); ctx.textAlign = cur > 0.6 ? 'right' : 'left';
    ctx.fillText('지금 설정', X(cur) + (cur > 0.6 ? -5 : 5), m.t + 10);
    Lab.legend({ ctx, w, m, pw, ph }, [{ kind: 'line', color: css('--accent'), label: '결과 분리도' }, { kind: 'dash', color: css('--muted'), label: '원한 만큼만 (y=x)' }], 'tl');
  }

  function runSweep() {
    const token = ++sweepToken;
    const p = readParams();
    sweepData = [];
    $('sweepnote').textContent = '계산 중…';
    drawSweep();
    const ts = [];
    for (let t = 0; t <= 80; t += 5) ts.push(t / 100);
    (function next(i) {
      if (token !== sweepToken) return;
      if (i >= ts.length) {
        const at30 = sweepData.find((d) => Math.abs(d.threshold - 0.3) < 1e-6);
        $('sweepnote').textContent = at30 ? `원하는 비율이 30%일 때 결과는 ${pct(at30.avgSame)}` : '';
        return;
      }
      const s = SC.create(Object.assign({}, p, { threshold: ts[i], maxRounds: 100 })).run();
      sweepData.push({ threshold: ts[i], avgSame: s.metrics().avgSame });
      drawSweep();
      setTimeout(() => next(i + 1), 0);
    })(0);
  }

  // ---------- 실행 흐름 ----------
  function showOutputs() {
    $('o-threshold').textContent = $('threshold').value + '%';
    $('o-empty').textContent = $('empty').value + '%';
    $('o-shareA').textContent = $('shareA').value + '%';
  }

  function restart() {
    sim = SC.create(readParams());
    m0 = sim.metrics();
    playing = false; acc = 0;
    $('play').textContent = '▶ 재생';
    $('seedinfo').textContent = `배치 번호 #${seed}`;
    renderStats(); drawBoards(); drawLine();
  }

  function newExperiment() { restart(); runSweep(); }

  function stepOnce() {
    if (sim.done) return false;
    sim.advance();
    renderStats(); drawGrid($('c-now'), sim.grid, sim.size, new Set(sim.unhappyList())); drawLine();
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

  ['threshold', 'empty', 'shareA'].forEach((id) => {
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
    if (sim.done) { restart(); }
    playing = !playing;
    $('play').textContent = playing ? '⏸ 일시정지' : '▶ 재생';
  });
  $('stepbtn').addEventListener('click', () => { playing = false; $('play').textContent = '▶ 재생'; stepOnce(); });
  $('restart').addEventListener('click', restart);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { drawBoards(); drawLine(); drawSweep(); }, 150);
  });

  showOutputs();
  newExperiment();
  if (THUMB) { while (!sim.done && sim.round < 200) sim.advance(); renderStats(); drawBoards(); drawLine(); }
  else { // 처음 들어오면 1초 뒤 이사를 자동으로 재생 (처음 배치를 잠깐 보여 준 뒤)
    setTimeout(() => { if (!playing && sim.round === 0) { playing = true; $('play').textContent = '⏸ 일시정지'; } }, 1000);
  }
  requestAnimationFrame((ts) => { lastTs = ts; tick(ts); });
})();
