(function () {
  'use strict';
  const EF = window.ElFarol, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 한참 지난 뒤 붐빈 주의 식당 풍경
  let sim = null, capRows = [], stratRows = [], sameRegret = null;
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), cap: Number($('cap').value), strategies: Number($('strategies').value), mode: $('mode').value });

  // 식당(자리 = 정원)과 집, 두 칸으로 나눠 이번 주에 누가 어디 있었는지 그린다
  function drawRoom() {
    const cv = $('c-room'), W = cv.clientWidth || 400, pad = W < 520 ? 10 : 18, head = W < 520 ? 58 : 64, lab = 26;
    const n0 = sim.n, cap0 = sim.params.cap, att0 = sim.hist.length ? sim.hist[sim.hist.length - 1] : 0;
    // 칸 높이: 보통 주에 필요한 줄 수만 (정원±15명 여유), 아주 붐비거나 텅 빈 주에만 늘어난다
    const rowsBox = Math.min(10, Math.ceil(Math.max(cap0 + 15, n0 - cap0 + 15, att0, n0 - att0) / 10));
    const cell = Math.min(THUMB ? 60 : 34, (W - pad * 3) / 20), boxW = cell * 10, boxH = cell * rowsBox;
    const need = head + lab + boxH + pad * 2, aspect = THUMB ? 1 : need / W;
    const c = L.chart(cv, aspect, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c, n = sim.n, cap = sim.params.cap, has = sim.hist.length > 0;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const oy = (h - need) / 2, gx = (w - boxW * 2 - pad) / 2, x1 = gx, x2 = gx + boxW + pad, by = oy + head + lab;
    const crowded = has && sim.crowded, att = has ? sim.hist[sim.hist.length - 1] : 0;
    const C = { ok: '#2f6fed', crowd: '#e5484d', rightStay: '#b9c1d0', regretStay: '#f5b731', idle: '#e2e7f0' };
    const F = (wt, px) => `${wt} ${px}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
    // 위쪽 설명
    ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = F(700, W < 520 ? 22 : 26);
    const big = has ? att + '명' : '-'; ctx.fillText(big, x1, oy + 30);
    const bw = ctx.measureText(big).width;
    ctx.font = F(400, 12); ctx.fillStyle = css('--muted'); ctx.fillText(`이번 주 손님 / 정원 ${cap}명`, x1 + bw + 10, oy + 29);
    if (has) { ctx.font = F(700, 14); ctx.fillStyle = crowded ? C.crowd : C.ok; ctx.fillText(crowded ? '붐볐어요' : '여유로웠어요', x1, oy + 50); }
    // 칸 제목과 테두리
    const box = (x, title, col) => {
      ctx.font = F(600, 13); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(title, x, by - 9);
      ctx.strokeStyle = css('--line'); ctx.lineWidth = 1; L.roundRect(ctx, x - 3, by - 3, boxW + 6, boxH + 6, 8); ctx.stroke();
    };
    const went = [], stay = [];
    for (let i = 0; i < n; i++) (has && sim.went[i] ? went : stay).push(i);
    box(x1, `식당 · 자리 ${cap}석`, css('--text'));
    box(x2, has ? `집에 있음 ${stay.length}명` : '집에 있음', css('--muted'));
    const r = cell * 0.36, at = (x0, k) => [x0 + (k % 10) * cell + cell / 2, by + Math.floor(k / 10) * cell + cell / 2];
    // 빈 자리(의자) 표시, 정원을 넘은 사람은 자리 밖(점선 아래)에 선다
    for (let k = 0; k < cap; k++) { const [x, y] = at(x1, k); ctx.strokeStyle = '#cfd6e3'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
    if (att > cap) {
      const yl = by + Math.floor(cap / 10) * cell + (cap % 10 ? cell : 0);
      ctx.setLineDash([4, 3]); ctx.strokeStyle = C.crowd; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x1, yl); ctx.lineTo(x1 + boxW, yl); ctx.stroke(); ctx.setLineDash([]);
    }
    went.forEach((i, k) => { const [x, y] = at(x1, k); ctx.fillStyle = crowded ? C.crowd : C.ok; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    stay.forEach((i, k) => { const [x, y] = at(x2, k); ctx.fillStyle = !has ? C.idle : crowded ? C.rightStay : C.regretStay; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
    ctx.lineWidth = 1;
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
    build() {
      sim = EF.create(params());
      if (THUMB) { while (!sim.done && !(sim.weeks >= 120 && sim.hist[sim.hist.length - 1] > sim.params.cap + 2)) sim.advance(); }
    },
    autoplay: !THUMB, speedScale: 0.35, // 보통 속도 초당 약 5주 (한 주 한 주의 식당 풍경을 따라갈 수 있게)
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawCap(); drawStrat(); }, seedLabel: '동네 번호',
  });
  seedGetter = h.seed;
})();
