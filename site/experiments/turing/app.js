(function () {
  'use strict';
  const TU = window.Turing, L = window.Lab;
  const { css, mix, pct } = L;
  const worldCv = document.getElementById('c-world');
  worldCv.style.maxWidth = '600px';   // 정사각형이라 너무 크면 한 화면에 다 안 들어온다
  { const bar = worldCv.parentElement.querySelector('.anim-bar'); if (bar) bar.style.maxWidth = '600px'; }
  { const c3 = document.getElementById('c-3d');
    if (c3) {
      c3.setAttribute('aria-label', c3.getAttribute('aria-label').replace(/<[^>]*>/g, '').trim());   // 제목의 3D 배지 태그를 읽지 않게
      const sec = c3.closest('section'); if (sec) sec.style.gridColumn = '1 / -1';   // 3D 지형은 가로 전체를 쓴다
    } }
  const $ = (id) => document.getElementById(id);
  const PER_STEP = 40, MAX_ITER = 30000;
  const NAMES = { spots: '점무늬', stripes: '줄무늬', mitosis: '세포 분열', coral: '산호' };
  let sim = null, programmatic = false;
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), F: Number($('F').value), k: Number($('k').value) });

  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 페이지 썸네일용: 무늬가 다 자란 장면으로 바로 간다
  const VMAX = 0.38;   // 색·높이의 최댓값 (자리 잡은 무늬의 v 꼭대기는 0.25~0.42, 넘으면 가장 진한 색)

  // 약한 농도 -> 진한 농도 (밝은 바탕에서 보라를 거쳐 짙은 남색까지). 3D 보기(app3d.js)도 같은 색을 쓴다
  const STOPS = [[251, 251, 248], [196, 182, 255], [124, 92, 255], [27, 31, 58]], POS = [0, 0.3, 0.62, 1];
  const LUT = new Uint8ClampedArray(256 * 3);
  for (let q = 0; q < 256; q++) {
    const t = q / 255; let s = 0; while (s < POS.length - 2 && t > POS[s + 1]) s++;
    const u = (t - POS[s]) / (POS[s + 1] - POS[s]), a = STOPS[s], b = STOPS[s + 1];
    for (let j = 0; j < 3; j++) LUT[q * 3 + j] = Math.round(a[j] + (b[j] - a[j]) * u);
  }
  let off = null, offImg = null;

  function drawWorld() {
    const cv = $('c-world');
    const c = L.chart(cv, 1, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w } = c, S = sim.size, v = sim.v;
    if (!off || off.width !== S) { off = document.createElement('canvas'); off.width = off.height = S; offImg = off.getContext('2d').createImageData(S, S); }
    const d = offImg.data;
    for (let i = 0; i < S * S; i++) {
      const q = Math.max(0, Math.min(255, Math.round((v[i] / VMAX) * 255))) * 3, o = i * 4;
      d[o] = LUT[q]; d[o + 1] = LUT[q + 1]; d[o + 2] = LUT[q + 2]; d[o + 3] = 255;
    }
    off.getContext('2d').putImageData(offImg, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, w, w);
    const st = sim.history[sim.history.length - 1];
    $('when').textContent = `${sim.iter.toLocaleString('ko-KR')}번 진행 · 무늬 면적 ${pct(st.area)}`;
    rev++;
  }
  // 3D 보기가 같은 상태를 쓰도록 노출한다 (rev가 바뀌면 다시 그림)
  let rev = 0;
  window.TuringLab = { get sim() { return sim; }, get rev() { return rev; }, LUT, VMAX };

  function drawTime() {
    const c = L.chart($('c-time'), 0.7), { ctx, m, pw, ph } = c, H = sim.history;
    const X = (it) => m.l + (it / MAX_ITER) * pw, Y = (val) => m.t + ph - (val / 0.6) * ph, xt = [0, 10000, 20000, 30000];
    L.axes(c, { X, Y, yTicks: [0, 0.2, 0.4, 0.6], yFmt: (v) => v.toFixed(1), xTicks: xt, xFmt: (t) => (t ? (t / 1000) + '천' : '0'), xLabel: '진행한 횟수 (번)', yLabel: '무늬 면적 · 평균 v (값)' });
    L.line(ctx, H.map((s, i) => [X(i * PER_STEP), Y(s.area)]), css('--accent'), 2.5);
    L.line(ctx, H.map((s, i) => [X(i * PER_STEP), Y(s.vMean)]), css('--rich'), 2.5);
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '무늬 면적 (비율)' }, { kind: 'line', color: css('--rich'), label: '평균 농도 v' }], 'br');
  }

  const PRESET_LABELS = { spots: [15, 4, 'left'], stripes: [8, 4, 'left'], mitosis: [-8, -6, 'right'], coral: [8, 4, 'left'] };
  function drawMap() {
    const c = L.chart($('c-map'), 0.8, { l: 54, b: 40, r: 26 }), { ctx, m, pw, ph } = c;
    const k0 = 0.05, k1 = 0.07, f0 = 0.02, f1 = 0.06;
    const X = (k) => m.l + ((k - k0) / (k1 - k0)) * pw, Y = (F) => m.t + ph - ((F - f0) / (f1 - f0)) * ph;
    L.axes(c, { X, Y, yTicks: [0.02, 0.03, 0.04, 0.05, 0.06], yFmt: (v) => v.toFixed(2), xTicks: [0.05, 0.055, 0.06, 0.065, 0.07], xFmt: (v) => v.toFixed(3), xLabel: 'k (제거 속도)', yLabel: 'F (공급 속도)' });
    ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    Object.keys(TU.PRESETS).forEach((name) => {
      const pr = TU.PRESETS[name], x = X(pr.k), y = Y(pr.F), lab = PRESET_LABELS[name];
      ctx.fillStyle = mix(css('--talent'), 0.85); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      ctx.textAlign = lab[2]; ctx.fillStyle = css('--text'); ctx.fillText(NAMES[name], x + lab[0], y + lab[1]);
    });
    const P = sim.params, cx = X(P.k), cy = Y(P.F);
    ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    L.legend(c, [{ kind: 'dot', color: mix(css('--talent'), 0.85), label: '무늬 종류' }, { kind: 'dot', color: css('--unlucky'), label: '지금 설정 (붉은 원)' }], 'bl');
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

  // 썸네일: 얼룩말을 닮은 줄무늬(미로)를 다 자란 상태로 보여 준다
  const THUMB_ITERS = 6000;
  if (THUMB) { const pr = TU.PRESETS.stripes; $('preset').value = 'stripes'; $('F').value = pr.F; $('k').value = pr.k; }

  const h = L.harness({
    controls: ['preset', 'F', 'k'],
    format: { preset: () => '', F: (v) => Number(v).toFixed(4), k: (v) => Number(v).toFixed(4) },
    defaults: { preset: 'spots', F: 0.035, k: 0.065 },
    build() { sim = TU.create(params()); if (THUMB) for (let i = 0; i < THUMB_ITERS / PER_STEP; i++) sim.advance(PER_STEP); },
    advance() { if (sim.iter >= MAX_ITER) return false; sim.advance(PER_STEP); return true; },
    isDone() { return sim.iter >= MAX_ITER; },
    draw, redrawExtra() {}, seedLabel: '씨앗 배치',
  });
  seedGetter = h.seed;
})();
