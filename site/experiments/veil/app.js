(function () {
  'use strict';
  const VL = window.Veil, L = window.Lab;
  const { css, mix, pct, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const COL = ['#0ea5a5', '#2f6fed', '#7c5cff', '#f59e42', '#e5484d'];
  const NAME = ['평등 사회', '안전망 사회', '완만한 격차 사회', '가파른 피라미드 사회', '승자독식 복권 사회'];
  const SHORT = ['평등', '안전망', '완만한 격차', '가파른 피라미드', '승자독식 복권'];
  const RULE = { eu: '기대효용', avg: '평균 극대화', maximin: '최소 극대화' };
  const MAXINC = 330, GMAX = 8;
  let sim = null, popCounts = [0, 0, 0, 0, 0], flips = [];
  let seedGetter = () => 1;
  const params = () => ({
    seed: seedGetter(), gamma: Number($('gamma').value), rule: $('rule').value,
    popMean: Number($('popMean').value), popSd: Number($('popSd').value),
  });

  function wrapText(ctx, text, x, y, maxW, lh) {
    const tr = window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(text) : text; // 번역 모드: 문장 전체를 먼저 번역한 뒤 줄바꿈
    const words = tr.split(' '); let line = '';
    words.forEach((w) => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = t; });
    ctx.fillText(line, x, y); return y;
  }

  // ① 후보 사회 5개를 나란히, 고른 사회 강조, 베일 뒤 추첨
  function drawSocieties() {
    const c = L.chart($('c-soc'), 0.66, { l: 8, r: 8, t: 8, b: 8 });
    const { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const colW = (w - 16) / 5, top = 66, bot = h - 62, bh = bot - top;
    ctx.textAlign = 'center';
    VL.SOCIETIES.forEach((s, i) => {
      const x0 = 8 + i * colW, on = i === sim.chosen;
      if (on) { ctx.fillStyle = mix(COL[i], 0.1); roundRect(ctx, x0 + 3, 4, colW - 6, h - 8, 12); ctx.fill(); ctx.strokeStyle = COL[i]; ctx.lineWidth = 2.5; roundRect(ctx, x0 + 3, 4, colW - 6, h - 8, 12); ctx.stroke(); ctx.lineWidth = 1; }
      ctx.fillStyle = on ? COL[i] : css('--text'); ctx.font = '700 12.5px -apple-system, "Apple SD Gothic Neo", sans-serif';
      wrapText(ctx, SHORT[i], x0 + colW / 2, 24, colW - 14, 15);
      if (on) { ctx.fillStyle = COL[i]; ctx.font = '700 11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText('✓ 고른 사회', x0 + colW / 2, 56); }
      const bw = (colW - 24) / 5;
      s.inc.forEach((y, k) => {
        const bh2 = Math.max(2, (y / MAXINC) * bh), x = x0 + 12 + k * bw;
        const hit = on && sim.lastPos() === k;
        ctx.fillStyle = hit ? '#e0a100' : mix(COL[i], on ? 0.85 : 0.55);
        roundRect(ctx, x + 1, bot - bh2, bw - 2, bh2, 2); ctx.fill();
        if (hit) { ctx.fillStyle = '#b07d00'; ctx.font = '700 11px -apple-system, sans-serif'; ctx.fillText(String(y), x + bw / 2, bot - bh2 - 4); }
      });
      ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(x0 + 10, bot + 0.5); ctx.lineTo(x0 + colW - 10, bot + 0.5); ctx.stroke();
      ctx.fillStyle = css('--muted'); ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText('평균 ' + VL.mean(s.inc).toFixed(1), x0 + colW / 2, bot + 18);
      ctx.fillText('최소 ' + VL.minOf(s.inc), x0 + colW / 2, bot + 33);
    });
    // 지금 뽑힌 자리
    const pos = sim.lastPos();
    ctx.fillStyle = css('--text'); ctx.font = '600 12.5px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pos < 0 ? '아직 자리를 뽑지 않았어요' : `당신의 자리: ${pos + 1}분위 → 소득 ${sim.incomes[sim.step - 1]}`, w / 2, h - 10);
    $('when').textContent = `${sim.step}/${sim.params.draws}번째 추첨 · 평균 ${sim.step ? sim.avgSoFar().toFixed(1) : '-'}`;
  }

  // ② 확실성 등가 소득 vs γ
  function drawCE() {
    const c = L.chart($('c-ce'), 0.7), { ctx, m, pw, ph } = c;
    const X = (g) => m.l + (g / GMAX) * pw, Y = (v) => m.t + ph - (v / 120) * ph;
    L.axes(c, { X, Y, yTicks: [0, 30, 60, 90, 120], yFmt: (v) => String(v), xTicks: [0, 2, 4, 6, 8], xFmt: (g) => String(g), xLabel: '위험 회피 정도 γ' });
    VL.SOCIETIES.forEach((s, i) => {
      const pts = []; for (let g = 0; g <= GMAX + 1e-9; g += 0.1) pts.push([X(g), Y(VL.ce(s.inc, g))]);
      L.line(ctx, pts, COL[i], i === sim.chosen ? 3.2 : 1.8);
    });
    if (sim.params.rule === 'eu') L.vline(c, X(sim.params.gamma), css('--rich'), '지금 설정', sim.params.gamma > GMAX * 0.6 ? 'right' : 'left');
  }

  // ③ 1,000명의 선택
  function drawPop() {
    const c = L.chart($('c-pop'), 0.7, { b: 52, t: 18 }), { ctx, m, pw, ph } = c, N = 1000;
    const Y = (v) => m.t + ph - (v / N) * ph;
    L.axes(c, { X: () => 0, Y, yTicks: [0, 250, 500, 750, 1000], yFmt: (v) => String(v) });
    const gw = pw / 5, bw = Math.min(46, gw * 0.6);
    ctx.textAlign = 'center';
    popCounts.forEach((v, i) => {
      const x = m.l + gw * i + (gw - bw) / 2;
      ctx.fillStyle = COL[i]; roundRect(ctx, x, Y(v), bw, Math.max(1, m.t + ph - Y(v)), 5); ctx.fill();
      ctx.fillStyle = css('--text'); ctx.font = '600 12px -apple-system, sans-serif'; ctx.fillText(pct(v / N), x + bw / 2, Y(v) - 6);
      ctx.fillStyle = css('--muted'); ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif';
      wrapText(ctx, SHORT[i], x + bw / 2, m.t + ph + 16, gw - 4, 13);
    });
  }

  // ④ γ에 따라 고른 사회의 평균과 가장 가난한 자리
  function drawSweep() {
    const c = L.chart($('c-sweep'), 0.7), { ctx, m, pw, ph } = c;
    const X = (g) => m.l + (g / GMAX) * pw, Y = (v) => m.t + ph - (v / 120) * ph;
    L.axes(c, { X, Y, yTicks: [0, 30, 60, 90, 120], yFmt: (v) => String(v), xTicks: [0, 2, 4, 6, 8], xFmt: (g) => String(g), xLabel: '위험 회피 정도 γ' });
    const avg = [], mn = [];
    for (let g = 0; g <= GMAX + 1e-9; g += 0.05) { const s = VL.SOCIETIES[VL.choice('eu', g)]; avg.push([X(g), Y(VL.mean(s.inc))]); mn.push([X(g), Y(VL.minOf(s.inc))]); }
    L.line(ctx, avg, '#e0a100', 2.8); L.line(ctx, mn, css('--accent'), 2.8);
    if (sim.params.rule === 'eu') L.vline(c, X(sim.params.gamma), css('--rich'), '지금 설정', sim.params.gamma > GMAX * 0.6 ? 'right' : 'left');
  }

  function renderStats() {
    const s = sim.society, g = sim.params.gamma;
    const rule = sim.params.rule === 'eu' ? `기대효용 (γ ${g})` : RULE[sim.params.rule];
    const cards = [
      ['고른 사회', NAME[sim.chosen], '규칙: ' + rule],
      ['그 사회의 평균 소득', VL.mean(s.inc).toFixed(1), '다섯 자리의 평균'],
      ['가장 가난한 자리의 소득', String(VL.minOf(s.inc)), '1분위 자리'],
      ['지금까지 뽑힌 내 소득', sim.step ? sim.avgSoFar().toFixed(1) : '-', `${sim.step}번 추첨의 평균`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawSocieties(); drawCE(); drawPop(); drawSweep(); }

  function after() {
    let prev = -1; flips = [];
    for (let i = 0; i <= GMAX * 20; i++) { const g = i * 0.05, w = VL.choice('eu', g); if (w !== prev) { if (prev >= 0) flips.push(g); prev = w; } }
    const txt = flips.map((g) => String(+g.toFixed(2))).join(', ');
    $('note-sweep').textContent = `선택이 바뀌는 지점: γ = ${txt}`;
    $('note-pop').textContent = `위험 회피 평균 ${$('popMean').value}, 퍼짐 ${$('popSd').value}인 1,000명이 각자 고른 결과`;
  }

  const h = L.harness({
    controls: ['gamma', 'rule', 'popMean', 'popSd'],
    format: { gamma: (v) => Number(v).toFixed(2), rule: () => '', popMean: (v) => Number(v).toFixed(2), popSd: (v) => Number(v).toFixed(2) },
    defaults: { gamma: 1.5, rule: 'eu', popMean: 2, popSd: 1 },
    build() { const P = params(); sim = VL.create(P); popCounts = VL.population(P.popMean, P.popSd, 1000, P.seed); },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, seedLabel: '추첨',
  });
  seedGetter = h.seed;
})();
