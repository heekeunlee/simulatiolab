(function () {
  'use strict';
  const MK = window.Monkey, L = window.Lab;
  const { css, mix, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, selRows = [], mutRows = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), target: $('target').value, offspring: Number($('offspring').value), mutation: Number($('mutation').value) / 100 });

  // 큰 수를 읽기 좋게: 100만 이상은 1.8×10^9 꼴
  function fmtBig(log10v) {
    if (log10v < 6) return Math.round(Math.pow(10, log10v)).toLocaleString('ko-KR');
    const e = Math.floor(log10v), m = Math.pow(10, log10v - e);
    return m.toFixed(1) + '×10^' + e;
  }
  const fmtRatio = (r) => (r < 1000 ? (r < 10 ? r.toFixed(2) : String(Math.round(r))) : fmtBig(Math.log10(r)));

  // ---------- ① 글자 판 ----------
  function drawRow(ctx, text, tgt, x0, y, cell, colorOn, dim) {
    ctx.font = `700 ${Math.round(cell * 0.62)}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    for (let j = 0; j < text.length; j++) {
      const ch = text[j], ok = tgt && ch === tgt[j];
      const x = x0 + j * cell;
      ctx.fillStyle = ok ? colorOn : (dim ? '#eef1f7' : '#e8ecf4');
      roundRect(ctx, x + 1, y, cell - 2, cell * 1.15, 4); ctx.fill();
      if (ch !== ' ') { ctx.fillStyle = ok ? '#ffffff' : '#7b8499'; ctx.fillText(ch, x + cell / 2, y + cell * 0.78); }
    }
  }

  function drawText() {
    const c = L.chart($('c-text'), 0.8, { l: 14, r: 14, t: 10, b: 10 });
    const { ctx, w, h } = c, n = sim.L, tgt = sim.text;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const cell = Math.min(30, (w - 28) / n), x0 = (w - cell * n) / 2;
    const label = (txt, y, color) => { ctx.font = '700 13px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = color || css('--text'); ctx.fillText(txt, 14, y); };
    const sub = (txt, y) => { ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = css('--muted'); ctx.fillText(txt, w - 14, y); };
    const gap = (h - 20) / 4;
    label('목표 문장 (햄릿)', 22, css('--muted'));
    drawRow(ctx, tgt, tgt, x0, 30, cell, '#8a93a6', false);
    // 순수한 우연
    let y = 30 + gap;
    label('순수한 우연: 지금까지의 최고 기록', y - 2, css('--unlucky'));
    sub(`${sim.chanceAttempts.toLocaleString('ko-KR')}번 시도 · 일치 ${sim.chanceBestMatch}/${n}`, y - 2);
    drawRow(ctx, sim.chanceString(), tgt, x0, y + 6, cell, css('--unlucky'), false);
    ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = css('--muted');
    ctx.fillText('방금 찍은 글자', 14, y + 6 + cell * 1.15 + 16);
    drawRow(ctx, sim.chanceLastString(), null, x0, y + 6 + cell * 1.15 + 22, cell * 0.78, '#cfd5e3', true);
    // 누적 선택
    y = 30 + gap * 3 - 6;
    label('누적 선택: 지금 부모 문장', y - 2, css('--lucky'));
    sub(`${sim.selGen}세대 · 일치 ${sim.selMatch}/${n}`, y - 2);
    drawRow(ctx, sim.selString(), tgt, x0, y + 6, cell, css('--lucky'), false);
    $('when').textContent = `단계 ${sim.step}/${sim.params.maxSteps} · 우연 ${sim.chanceAttempts.toLocaleString('ko-KR')}번 · 선택 ${sim.selGen}세대`;
  }

  // ---------- ② 일치한 글자 수 vs 시도 횟수 (가로축 로그) ----------
  function drawRace() {
    const c = L.chart($('c-race'), 0.7, { l: 44, b: 40 }), { ctx, m, pw, ph } = c, n = sim.L;
    const xmax = Math.ceil(Math.log10(sim.params.maxSteps * sim.params.chancePerStep));
    const X = (v) => m.l + (v / xmax) * pw, Y = (v) => m.t + ph - (v / n) * ph;
    const yt = []; for (let v = 0; v <= n; v += Math.ceil(n / 5)) yt.push(v);
    const xt = []; for (let k = 0; k <= xmax; k++) xt.push(k);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => String(v), xTicks: xt, xFmt: (k) => (k < 4 ? Math.pow(10, k).toLocaleString('ko-KR') : '10^' + k), xLabel: '시도 횟수 (로그 눈금)' });
    const pts = (hist) => { const o = []; hist.forEach(([a, mt], i) => { const x = X(Math.log10(Math.max(1, a))); if (i) o.push([x, o[o.length - 1][1]]); o.push([x, Y(mt)]); }); return o; };
    L.line(ctx, pts(sim.chanceHist), css('--unlucky'), 2.5);
    L.line(ctx, pts(sim.selHist), css('--lucky'), 2.5);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(n)); ctx.lineTo(m.l + pw, Y(n)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('완성', m.l + 6, Y(n) + 14);
    if (sim.selDoneGen > 0) { ctx.fillStyle = css('--lucky'); ctx.beginPath(); ctx.arc(X(Math.log10(sim.selAttempts)), Y(n), 5, 0, 7); ctx.fill(); }
  }

  // ---------- ③ 기대 시도 횟수: 우연 27^L vs 선택 (세로축 로그) ----------
  function drawExpect() {
    const n = sim.L, y1 = Math.ceil(MK.log10Chance(n) / 4) * 4;
    const xs = []; for (let l = 1; l <= n; l += Math.max(1, Math.ceil(n / 7))) xs.push(l); if (xs[xs.length - 1] !== n) xs.push(n);
    L.dots($('c-expect'), {
      data: selRows.map((d) => ({ x: d.x, runs: d.runs.map((a) => Math.log10(a)), mean: L.mean(d.runs.map((a) => Math.log10(a))) })),
      series: [{ data: Array.from({ length: n }, (_, i) => ({ x: i + 1, runs: [], mean: MK.log10Chance(i + 1) })), color: css('--unlucky') }],
      x0: 1, x1: n, y0: 0, y1, xTicks: xs, xFmt: (v) => String(v), yFmt: (v) => (Math.round(v) === 0 ? '1' : '10^' + Math.round(v)),
      xLabel: '문장 길이 (앞에서부터 L글자)',
    });
  }

  // ---------- ④ 돌연변이율 vs 세대 수 ----------
  function drawMut() {
    const mx = Math.max(10, ...mutRows.flatMap((d) => d.runs)), y1 = Math.ceil(mx / 50) * 50;
    L.dots($('c-mut'), {
      data: mutRows.map((d) => ({ x: d.x, runs: d.runs, mean: L.mean(d.runs) })),
      x0: 0, x1: 15, y0: 0, y1, xTicks: [0, 2, 5, 10, 15], xFmt: (v) => v + '%', yFmt: (v) => String(Math.round(v)),
      xLabel: '글자마다 바뀔 확률 (돌연변이율)', marker: { x: sim.params.mutation * 100 },
    });
  }

  function renderStats() {
    const n = sim.L, perSec = 1e9;
    const lc = MK.log10Chance(n), years = MK.chanceYears(n, perSec);
    const done = sim.selMatch === n;
    const cards = [
      ['순수한 우연: 최고 일치', `${sim.chanceBestMatch}/${n}`, `${sim.chanceAttempts.toLocaleString('ko-KR')}번 시도 뒤`],
      ['누적 선택: 지금 일치', `${sim.selMatch}/${n}`, done ? `${sim.selDoneGen}세대 만에 완성 (${sim.selAttempts.toLocaleString('ko-KR')}번 시도)` : `${sim.selGen}세대째 진행 중`],
      ['우연으로 한 번에 맞히려면', `약 ${fmtBig(lc)}번`, `기대 시도 횟수 (27^${n})`],
      ['걸리는 시간 (초당 10억 번 시도)', `약 ${fmtBig(Math.log10(years))}년`, `우주 나이(약 138억 년)의 ${fmtRatio(years / MK.UNIVERSE_YEARS)}배`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawText(); drawRace(); }

  function after() {
    const P = params(), text = MK.TARGETS[P.target], n = text.length;
    selRows = []; mutRows = []; drawExpect(); drawMut();
    $('note-expect').textContent = '계산 중…'; $('note-mut').textContent = '계산 중…';
    const jobs = [];
    for (let l = 1; l <= n; l += Math.max(1, Math.ceil(n / 7))) jobs.push(() => { selRows.push({ x: l, runs: MK.selectionAttempts(text, l, P.offspring, P.mutation, 6) }); });
    if ((n - 1) % Math.max(1, Math.ceil(n / 7)) !== 0) jobs.push(() => { selRows.push({ x: n, runs: MK.selectionAttempts(text, n, P.offspring, P.mutation, 6) }); });
    [0.5, 1, 2, 3, 5, 7, 10, 15].forEach((r) => jobs.push(() => { mutRows.push({ x: r, runs: MK.selectionGens(text, P.offspring, r / 100, 6) }); }));
    L.jobs(jobs, () => { drawExpect(); drawMut(); }, () => {
      const last = selRows[selRows.length - 1];
      $('note-expect').textContent = `${n}글자: 선택은 평균 약 ${Math.round(L.mean(last.runs)).toLocaleString('ko-KR')}번 시도, 우연은 기대 약 ${fmtBig(MK.log10Chance(n))}번`;
      const best = mutRows.reduce((a, b) => (L.mean(a.runs) < L.mean(b.runs) ? a : b));
      $('note-mut').textContent = `이 설정에서는 ${best.x}% 부근이 가장 빨랐습니다 (평균 약 ${Math.round(L.mean(best.runs))}세대)`;
    });
  }

  const h = L.harness({
    controls: ['target', 'offspring', 'mutation'],
    format: { target: () => '', offspring: (v) => v + '개', mutation: (v) => Number(v).toFixed(1) + '%' },
    defaults: { target: 'tobe', offspring: 100, mutation: 5 },
    build() { sim = MK.create(params()); },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawExpect(); drawMut(); }, seedLabel: '원숭이 번호',
  });
  seedGetter = h.seed;
})();
