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
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 썸네일용: 다섯 사회를 정사각형에 담고 몇 번 추첨한 장면
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
    const narrow = ($('c-soc').clientWidth || 400) < 560;
    const LEG = THUMB ? 0 : 68, cw0 = $('c-soc').clientWidth || 600;   // 아래쪽 범례 자리
    const c = L.chart($('c-soc'), (THUMB ? 1 : narrow ? 0.95 : 0.66) + LEG / cw0, { l: 8, r: 8, t: 8, b: 8 });
    const { ctx, w, h: H0 } = c, h = H0 - LEG;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, H0);
    // 아래쪽 28px은 "당신의 자리" 문구 자리 (고른 사회 테두리와 겹치지 않게)
    const colW = (w - 16) / 5, top = THUMB ? 20 : narrow ? 78 : 66, bot = h - (THUMB ? 20 : 78), bh = bot - top, boxB = h - (THUMB ? 8 : 34);
    const hits = [0, 0, 0, 0, 0]; sim.positions.forEach((q) => { hits[q]++; });
    ctx.textAlign = 'center';
    VL.SOCIETIES.forEach((s, i) => {
      const x0 = 8 + i * colW, on = i === sim.chosen;
      if (on) { ctx.fillStyle = mix(COL[i], 0.1); roundRect(ctx, x0 + 3, 4, colW - 6, boxB - 4, 12); ctx.fill(); ctx.strokeStyle = COL[i]; ctx.lineWidth = 2.5; roundRect(ctx, x0 + 3, 4, colW - 6, boxB - 4, 12); ctx.stroke(); ctx.lineWidth = 1; }
      if (!THUMB) {
      ctx.fillStyle = on ? COL[i] : css('--text'); ctx.font = '700 12.5px -apple-system, "Apple SD Gothic Neo", sans-serif';
      wrapText(ctx, SHORT[i], x0 + colW / 2, 24, colW - 14, 15);
      if (on) { ctx.fillStyle = COL[i]; ctx.font = '700 11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText('✓ 고른 사회', x0 + colW / 2, top - 10); }
      }
      const bw = (colW - 24) / 5;
      s.inc.forEach((y, k) => {
        const bh2 = Math.max(2, (y / MAXINC) * bh), x = x0 + 12 + k * bw;
        const hit = on && sim.lastPos() === k;
        ctx.fillStyle = hit ? '#e0a100' : mix(COL[i], on ? 0.85 : 0.55);
        roundRect(ctx, x + 1, bot - bh2, bw - 2, bh2, 2); ctx.fill();
        if (hit && !THUMB) { ctx.fillStyle = '#b07d00'; ctx.font = '700 11px -apple-system, sans-serif'; ctx.fillText(String(y), x + bw / 2, bot - bh2 - 4); }
        // 고른 사회: 지금까지 그 자리가 뽑힌 횟수를 막대 아래 작은 점으로 쌓는다
        if (on && hits[k] && !THUMB && bw >= 20) { ctx.fillStyle = css('--muted'); ctx.font = '10px -apple-system, sans-serif'; ctx.fillText('×' + hits[k], x + bw / 2, bot + 12); }
      });
      if (on && sim.step) {   // 지금까지 뽑힌 내 소득의 평균 (추첨이 쌓일수록 그 사회의 평균에 가까워진다)
        const ya = bot - (sim.avgSoFar() / MAXINC) * bh;
        ctx.strokeStyle = '#b07d00'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0 + 8, ya); ctx.lineTo(x0 + colW - 8, ya); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
        if (!THUMB && !narrow) { ctx.fillStyle = '#b07d00'; ctx.font = '600 10.5px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('내 평균', x0 + 10, ya - 4); ctx.textAlign = 'center'; }
      }
      if (THUMB) return;
      ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(x0 + 10, bot + 0.5); ctx.lineTo(x0 + colW - 10, bot + 0.5); ctx.stroke();
      ctx.fillStyle = css('--muted'); ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText('평균 ' + VL.mean(s.inc).toFixed(1), x0 + colW / 2, bot + 28);
      ctx.fillText('최소 ' + VL.minOf(s.inc), x0 + colW / 2, bot + 42);
    });
    $('when').textContent = `${sim.step}/${sim.params.draws}번째 추첨 · 평균 ${sim.step ? sim.avgSoFar().toFixed(1) : '-'}`;
    if (THUMB) return;
    // 지금 뽑힌 자리
    const pos = sim.lastPos();
    ctx.fillStyle = css('--text'); ctx.font = '600 12.5px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pos < 0 ? '아직 자리를 뽑지 않았어요' : `당신의 자리: ${pos + 1}분위 → 소득 ${sim.incomes[sim.step - 1]}`, w / 2, h - 12);
    L.legend({ ctx, w, m: { l: 8, t: h, r: 8, b: 0 }, pw: w - 16, ph: LEG }, [{ kind: 'box', color: '#e0a100', label: '이번에 뽑힌 자리' }, { kind: 'dash', color: '#b07d00', label: '점선: 지금까지 뽑힌 내 소득의 평균' }, { kind: 'box', color: css('--muted'), label: '×숫자: 그 자리가 뽑힌 횟수' }], 'tl');
  }

  // ② 확실성 등가 소득 vs γ
  function drawCE() {
    const c = L.chart($('c-ce'), ($('c-ce').clientWidth || 600) < 560 ? 1 : 0.7), { ctx, m, pw, ph } = c;   // 휴대폰에서는 범례(5줄)가 선을 덜 가리게 더 높게
    const X = (g) => m.l + (g / GMAX) * pw, Y = (v) => m.t + ph - (v / 120) * ph;
    L.axes(c, { X, Y, yTicks: [0, 30, 60, 90, 120], yFmt: (v) => String(v), xTicks: [0, 2, 4, 6, 8], xFmt: (g) => String(g), xLabel: '위험 회피 정도 γ', yLabel: '확실성 등가 소득' });
    VL.SOCIETIES.forEach((s, i) => {
      const pts = []; for (let g = 0; g <= GMAX + 1e-9; g += 0.1) pts.push([X(g), Y(VL.ce(s.inc, g))]);
      L.line(ctx, pts, COL[i], i === sim.chosen ? 3.2 : 1.8);
    });
    if (sim.params.rule === 'eu') L.vline(c, X(sim.params.gamma), css('--rich'), '지금 설정', sim.params.gamma > GMAX * 0.6 ? 'right' : 'left');
    L.legend(c, SHORT.map((label, i) => ({ kind: 'line', color: COL[i], label })), 'tr');
  }

  // ③ 1,000명의 선택
  function drawPop() {
    const c = L.chart($('c-pop'), 0.7, { b: 52, t: 24 }), { ctx, m, pw, ph } = c, N = 1000;
    const Y = (v) => m.t + ph - (v / N) * ph;
    L.axes(c, { X: () => 0, Y, yTicks: [0, 250, 500, 750, 1000], yFmt: (v) => String(v), yLabel: '사람 수 (명)' });
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
    L.axes(c, { X, Y, yTicks: [0, 30, 60, 90, 120], yFmt: (v) => String(v), xTicks: [0, 2, 4, 6, 8], xFmt: (g) => String(g), xLabel: '위험 회피 정도 γ', yLabel: '소득' });
    const avg = [], mn = [];
    for (let g = 0; g <= GMAX + 1e-9; g += 0.05) { const s = VL.SOCIETIES[VL.choice('eu', g)]; avg.push([X(g), Y(VL.mean(s.inc))]); mn.push([X(g), Y(VL.minOf(s.inc))]); }
    L.line(ctx, avg, '#e0a100', 2.8); L.line(ctx, mn, css('--accent'), 2.8);
    if (sim.params.rule === 'eu') L.vline(c, X(sim.params.gamma), css('--rich'), '지금 설정', sim.params.gamma > GMAX * 0.6 ? 'right' : 'left');
    L.legend(c, [{ kind: 'line', color: '#e0a100', label: '고른 사회의 평균 소득' }, { kind: 'line', color: css('--accent'), label: '가장 가난한 자리의 소득' }], 'br');
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
    build() { const P = params(); sim = VL.create(P); popCounts = VL.population(P.popMean, P.popSd, 1000, P.seed); if (THUMB) for (let i = 0; i < 12; i++) sim.advance(); },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, seedLabel: '추첨',
  });
  seedGetter = h.seed;
})();
