(function () {
  'use strict';
  const TU = window.Turing, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  const PER_STEP = 40, MAX_ITER = 30000, LEVELS = 28;
  const NAMES = { spots: '점무늬', stripes: '줄무늬', mitosis: '세포 분열', coral: '산호' };
  let sim = null, programmatic = false;
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), F: Number($('F').value), k: Number($('k').value) });

  // 약한 농도 -> 진한 농도 (밝은 바탕에서 짙은 남색까지)
  const STOPS = [[251, 251, 248], [124, 92, 255], [27, 31, 58]];
  const colors = Array.from({ length: LEVELS }, (_, q) => {
    const t = q / (LEVELS - 1), s = t < 0.5 ? 0 : 1, u = t < 0.5 ? t * 2 : (t - 0.5) * 2, a = STOPS[s], b = STOPS[s + 1];
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(',')})`;
  });

  function drawWorld() {
    const c = L.chart($('c-world'), 1, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w } = c, S = sim.size, cell = w / S, v = sim.v;
    ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, w, w);
    const buckets = Array.from({ length: LEVELS }, () => []);
    for (let i = 0; i < S * S; i++) {
      const q = Math.min(LEVELS - 1, Math.max(0, Math.round((v[i] / 0.45) * (LEVELS - 1))));
      if (q > 0) buckets[q].push(i);
    }
    for (let q = 1; q < LEVELS; q++) {
      if (!buckets[q].length) continue;
      ctx.fillStyle = colors[q]; ctx.beginPath();
      for (const i of buckets[q]) ctx.rect((i % S) * cell, Math.floor(i / S) * cell, cell + 0.6, cell + 0.6);
      ctx.fill();
    }
    const st = sim.history[sim.history.length - 1];
    $('when').textContent = `${sim.iter.toLocaleString('ko-KR')}번 진행 · 무늬 면적 ${pct(st.area)}`;
  }

  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history;
    const X = (it) => m.l + (it / MAX_ITER) * pw, Y = (val) => m.t + ph - (val / 0.6) * ph, xt = [0, 10000, 20000, 30000];
    L.axes(c, { X, Y, yTicks: [0, 0.2, 0.4, 0.6], yFmt: (v) => v.toFixed(1), xTicks: xt, xFmt: (t) => (t / 1000) + '천', xLabel: '진행한 횟수' });
    L.line(ctx, H.map((s, i) => [X(i * PER_STEP), Y(s.area)]), css('--accent'), 2.5);
    L.line(ctx, H.map((s, i) => [X(i * PER_STEP), Y(s.vMean)]), css('--rich'), 2.5);
  }

  const PRESET_LABELS = { spots: [8, 4, 'left'], stripes: [8, 4, 'left'], mitosis: [-8, -6, 'right'], coral: [8, 4, 'left'] };
  function drawMap() {
    const c = L.chart($('c-map'), 0.8, { l: 54, b: 40 }), { ctx, m, pw, ph } = c;
    const k0 = 0.05, k1 = 0.07, f0 = 0.02, f1 = 0.06;
    const X = (k) => m.l + ((k - k0) / (k1 - k0)) * pw, Y = (F) => m.t + ph - ((F - f0) / (f1 - f0)) * ph;
    L.axes(c, { X, Y, yTicks: [0.02, 0.03, 0.04, 0.05, 0.06], yFmt: (v) => v.toFixed(2), xTicks: [0.05, 0.055, 0.06, 0.065, 0.07], xFmt: (v) => v.toFixed(3), xLabel: 'k (제거 속도)' });
    ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('F (공급 속도)', 0, 0); ctx.restore();
    ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    Object.keys(TU.PRESETS).forEach((name) => {
      const pr = TU.PRESETS[name], x = X(pr.k), y = Y(pr.F), lab = PRESET_LABELS[name];
      ctx.fillStyle = mix(css('--talent'), 0.85); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      ctx.textAlign = lab[2]; ctx.fillStyle = css('--text'); ctx.fillText(NAMES[name], x + lab[0], y + lab[1]);
    });
    const P = sim.params, cx = X(P.k), cy = Y(P.F);
    ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = css('--unlucky'); ctx.textAlign = cx > m.l + pw * 0.6 ? 'right' : 'left'; ctx.fillText('지금 설정', cx + (cx > m.l + pw * 0.6 ? -14 : 14), cy - 12);
  }

  function nearestPreset() {
    const P = sim.params; let best = null, bd = Infinity;
    Object.keys(TU.PRESETS).forEach((n) => { const d = ((P.F - TU.PRESETS[n].F) / 0.04) ** 2 + ((P.k - TU.PRESETS[n].k) / 0.02) ** 2; if (d < bd) { bd = d; best = n; } });
    return NAMES[best];
  }

  function renderStats() {
    const st = sim.history[sim.history.length - 1], P = sim.params;
    const cards = [
      ['무늬가 차지한 면적', pct(st.area), 'v가 0.2보다 큰 칸의 비율'],
      ['평균 농도 v', st.vMean.toFixed(3), '무늬를 만드는 물질의 평균'],
      ['진행', sim.iter.toLocaleString('ko-KR') + '번', `한 단계에 ${PER_STEP}번씩 계산`],
      ['가장 가까운 무늬 설정', nearestPreset(), `F=${P.F.toFixed(4)}, k=${P.k.toFixed(4)}`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawWorld(); drawTime(); drawMap(); }

  // 프리셋을 고르면 F, k 슬라이더를 맞춘다 (하네스의 다시 시작보다 먼저 실행되도록 하네스 생성 전에 등록)
  $('preset').addEventListener('change', () => {
    const pr = TU.PRESETS[$('preset').value]; if (!pr) return;
    programmatic = true;
    $('F').value = pr.F; $('k').value = pr.k;
    ['F', 'k'].forEach((id) => { try { $(id).dispatchEvent(new Event('input')); } catch (e) { /* 입력 이벤트가 없는 환경 */ } });
    programmatic = false;
  });
  ['F', 'k'].forEach((id) => $(id).addEventListener('input', () => { if (!programmatic) $('preset').value = 'custom'; }));

  // 캔버스를 누르면 그 자리에 새 씨앗을 뿌린다
  $('c-world').addEventListener('click', (e) => {
    if (!sim) return;
    const r = e.currentTarget.getBoundingClientRect(), S = sim.size;
    sim.drop(Math.floor(((e.clientX - r.left) / r.width) * S), Math.floor(((e.clientY - r.top) / r.height) * S), 4);
    drawWorld();
  });

  const h = L.harness({
    controls: ['preset', 'F', 'k'],
    format: { preset: () => '', F: (v) => Number(v).toFixed(4), k: (v) => Number(v).toFixed(4) },
    defaults: { preset: 'spots', F: 0.035, k: 0.065 },
    build() { sim = TU.create(params()); },
    advance() { if (sim.iter >= MAX_ITER) return false; sim.advance(PER_STEP); return true; },
    isDone() { return sim.iter >= MAX_ITER; },
    draw, redrawExtra() {}, seedLabel: '씨앗 배치',
  });
  seedGetter = h.seed;
})();
