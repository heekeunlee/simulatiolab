(function () {
  'use strict';
  const EF = window.ElFarol, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, capRows = [], stratRows = [], sameRegret = null;
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), cap: Number($('cap').value), strategies: Number($('strategies').value), mode: $('mode').value });

  function drawRoom() {
    const c = L.chart($('c-room'), 0.62, { l: 8, r: 8, t: 8, b: 8 });
    const { ctx, w, h } = c, n = sim.n;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const last = sim.hist.length ? sim.hist[sim.hist.length - 1] : null;
    const cols = 20, rows = Math.ceil(n / cols), gx = 120, cell = Math.min((w - gx - 12) / cols, (h - 20) / rows), r = cell * 0.36;
    const ox = gx, oy = (h - rows * cell) / 2;
    const COLORS = { ok: '#2f6fed', crowd: '#e5484d', rightStay: '#d3d9e6', regretStay: '#f5c451' };
    for (let i = 0; i < n; i++) {
      let col = '#e6eaf2';
      if (last != null) {
        const went = sim.went[i], crowded = sim.crowded;
        col = went ? (crowded ? COLORS.crowd : COLORS.ok) : (crowded ? COLORS.rightStay : COLORS.regretStay);
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox + (i % cols) * cell + cell / 2, oy + Math.floor(i / cols) * cell + cell / 2, r, 0, 7); ctx.fill();
    }
    ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = '700 26px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(last == null ? '-' : last + '명', 12, h / 2 - 6);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
    ctx.fillText(`이번 주 손님 / 정원 ${sim.params.cap}명`, 12, h / 2 + 14);
    if (last != null) { ctx.fillStyle = sim.crowded ? css('--unlucky') : css('--accent'); ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(sim.crowded ? '붐볐어요' : '여유로웠어요', 12, h / 2 + 34); }
    $('when').textContent = `${sim.weeks}/${sim.params.weeks}주째`;
  }

  function drawWeeks() {
    const c = L.chart($('c-weeks'), 0.7), { ctx, m, pw, ph } = c, n = sim.n, cap = sim.params.cap;
    const win = 80, data = sim.hist.slice(-win), X = (i) => m.l + (i / win) * pw, Y = (v) => m.t + ph - (v / n) * ph;
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100].map((v) => (v / 100) * n), yFmt: (v) => Math.round(v), xTicks: [], xLabel: `최근 ${win}주 (오른쪽이 최근)` });
    const bw = pw / win;
    data.forEach((v, i) => { ctx.fillStyle = v > cap ? mix('#e5484d', 0.75) : mix('#2f6fed', 0.75); ctx.fillRect(X(i + win - data.length) + 0.5, Y(v), Math.max(1, bw - 1), m.t + ph - Y(v)); });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--text'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.l, Y(cap)); ctx.lineTo(m.l + pw, Y(cap)); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.fillText('정원 ' + cap + '명', m.l + 6, Y(cap) - 6);
  }

  function drawCap() {
    L.dots($('c-cap'), {
      data: capRows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 20, x1: 90, y0: 0, y1: 100, xTicks: [20, 30, 40, 50, 60, 70, 80, 90], xFmt: (v) => v + '', yFmt: (v) => Math.round(v) + '',
      xLabel: '정원 (명)', refs: [], marker: { x: sim.params.cap },
      series: [{ data: [{ x: 20, mean: 20, runs: [] }, { x: 90, mean: 90, runs: [] }], color: '#8a93a6' }],
    });
  }
  function drawStrat() {
    const refs = [{ y: 0.5, label: '동전 던지기 (50%)', color: '#8a93a6' }];
    if (sameRegret != null) refs.push({ y: sameRegret, label: '모두 같은 예측 ' + pct(sameRegret), color: css('--unlucky') });
    L.dots($('c-strat'), {
      data: stratRows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 1, x1: 12, y0: 0, y1: 1, xTicks: [1, 2, 4, 6, 8, 10, 12], xFmt: (v) => v + '개', xLabel: '한 사람이 가진 예측법 수',
      refs, marker: { x: sim.params.strategies },
    });
  }

  function renderStats() {
    const s = sim.summary(Math.max(0, Math.floor(sim.hist.length / 2)));
    const has = sim.hist.length > 0, last = has ? sim.hist[sim.hist.length - 1] : 0;
    const cards = [
      ['평균 손님 수', has ? s.mean.toFixed(1) + '명' : '-', `정원 ${sim.params.cap}명 (뒤쪽 절반 기준)`],
      ['주마다 흔들리는 폭', has ? '±' + s.std.toFixed(1) + '명' : '-', '표준편차. 작을수록 안정적'],
      ['잘못 고른 사람', has ? pct(s.regret) : '-', '갔는데 붐볐거나, 안 갔는데 한산했던 사람 (50%면 동전 던지기)'],
      ['이번 주', has ? last + '명 · ' + (sim.crowded ? '붐빔' : '여유') : '-', `${sim.weeks}주째`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRoom(); drawWeeks(); }

  function after() {
    const P = params(); capRows = []; stratRows = []; sameRegret = null; drawCap(); drawStrat();
    $('note-cap').textContent = '계산 중…'; $('note-strat').textContent = '계산 중…';
    const jobs = [() => { sameRegret = L.mean(EF.measure({ mode: 'same', cap: P.cap, weeks: 120 }, 2).map((s) => s.regret)); }];
    for (let c = 20; c <= 90; c += 10) jobs.push(() => {
      capRows.push({ x: c, runs: EF.measure({ cap: c, strategies: P.strategies, mode: 'diverse', weeks: 120 }, 4).map((s) => s.mean) });
    });
    [1, 2, 3, 4, 6, 8, 10, 12].forEach((k) => jobs.push(() => {
      stratRows.push({ x: k, runs: EF.measure({ cap: P.cap, strategies: k, mode: 'diverse', weeks: 120 }, 4).map((s) => s.regret) });
    }));
    L.jobs(jobs, () => { drawCap(); drawStrat(); }, () => {
      $('note-cap').textContent = '회색 선: 손님 수 = 정원';
      $('note-strat').textContent = '예측법이 많아져도 잘못 고르는 사람의 비율은 50% 근처에 머뭅니다';
    });
  }

  const h = L.harness({
    controls: ['cap', 'strategies', 'mode'],
    format: { cap: (v) => v + '명', strategies: (v) => v + '개', mode: () => '' },
    defaults: { cap: 60, strategies: 5, mode: 'diverse' },
    build() { sim = EF.create(params()); },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawCap(); drawStrat(); }, seedLabel: '동네 번호',
  });
  seedGetter = h.seed;
})();
