(function () {
  'use strict';
  const SF = window.Sunflower, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 다 자란 꽃으로 바로
  const PRESETS = { golden: 137.508, a137: 137, a138: 138, a120: 120, a144: 144, a90: 90, a150: 150 };
  const BARS = [[90, '90°'], [120, '120°'], [137, '137°'], [137.508, '137.5°'], [138, '138°'], [144, '144°'], [150, '150°'], [180, '180°']];
  let sim = null, mt = null, sweepRows = [], sweepN = 0, barRows = [], programmatic = false;
  let seedGetter = () => 1;
  // 범례를 놓을 구석 고르기: 점들 [x, y]이 가장 적게 겹치는 곳. fill=true면 점 아래가 칠해진 막대로 본다
  function pickPos(c, pts, n, fill) {
    const bw = 95, bh = n * 16 + 9, m = c.m; let best = 'tr', bc = 1e9;
    ['tr', 'tl', 'br', 'bl'].forEach((p) => {
      const x0 = p[1] === 'l' ? m.l + 6 : m.l + c.pw - bw - 6, y0 = p[0] === 'b' ? m.t + c.ph - bh - 6 : m.t + 6;
      const cnt = pts.filter(([x, y]) => x >= x0 - 4 && x <= x0 + bw + 4 && (fill ? y <= y0 + bh + 4 : y >= y0 - 4 && y <= y0 + bh + 4)).length;
      if (cnt < bc) { bc = cnt; best = p; }
    });
    return best;
  }
  const params = () => ({ seed: seedGetter(), angle: Number($('angle').value), n: Number($('n').value) });

  // 번호 → 색: 안쪽은 노랑, 바깥은 갈색. 나선 보기를 고르면 번호를 F로 나눈 나머지로 색을 칠한다
  function seedColor(k, n) {
    const mode = $('color').value;
    if (mode !== 'index') { const F = Number(mode); return `hsl(${Math.round((360 * (k % F)) / F)} 72% 52%)`; }
    const t = k / n; return `hsl(${Math.round(48 - 24 * t)} 88% ${Math.round(62 - 28 * t)}%)`;
  }

  // ---------- ① 해바라기 ----------
  // 꽃판(짙은 갈색)과 꽃잎이 씨앗과 함께 자란다. 씨앗 사이 빈틈은 짙은 꽃판 색으로 드러난다
  function drawFlower() {
    const el = $('c-flower'), wide = (el.clientWidth || 400) > 560;
    const c = L.chart(el, wide ? 0.72 : 1, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c;
    ctx.fillStyle = '#fdf8ec'; ctx.fillRect(0, 0, w, h);
    const R = Math.min(w, h) / 2 - 8, Rh = R / 1.36, sc = Rh / Math.sqrt(sim.n), cx = w / 2, cy = h / 2;
    const rad = Math.max(0.8, (Number($('size').value) / 100) * 0.5 * SF.IDEAL * sc);
    const rc = Math.max(rad * 2, Math.sqrt(sim.placed + 0.5) * sc + rad * 1.1); // 지금까지 자란 꽃판 반지름
    // 꽃잎 두 겹 (뒤쪽은 조금 진하게)
    const pl = rc * 0.36 + 4, pw = Math.max(2, (Math.PI * 2 * rc) / 34 * 0.55);
    [[0, '#e9a50f'], [0.5, '#f7c531']].forEach(([off, col]) => {
      ctx.fillStyle = col;
      for (let i = 0; i < 34; i++) {
        const t = ((i + off) / 34) * Math.PI * 2;
        ctx.save(); ctx.translate(cx + Math.cos(t) * (rc + pl * 0.42), cy + Math.sin(t) * (rc + pl * 0.42)); ctx.rotate(t);
        ctx.beginPath(); ctx.ellipse(0, 0, pl * 0.62, pw, 0, 0, 7); ctx.fill(); ctx.restore();
      }
    });
    const g = ctx.createRadialGradient(cx, cy, rc * 0.1, cx, cy, rc);
    g.addColorStop(0, '#5a3a17'); g.addColorStop(1, '#2e1c0b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rc, 0, 7); ctx.fill();
    for (let k = 0; k < sim.placed; k++) {
      ctx.fillStyle = seedColor(k, sim.n);
      ctx.beginPath(); ctx.arc(cx + sim.x[k] * sc, cy + sim.y[k] * sc, rad, 0, 7); ctx.fill();
    }
    $('when').textContent = `${sim.placed}/${sim.n}번째 씨앗 · 각도 ${sim.params.angle.toFixed(3)}°`;
    share();
  }

  // 3D 보기(app3d.js)가 쓰는 상태
  let ver = 0;
  function share() { window.SunflowerState = { sim, color: $('color').value, size: Number($('size').value), ver: ++ver, thumb: THUMB }; }

  // ---------- ② 각도별 빈틈 (로그 눈금) ----------
  function drawSweep() {
    const c = L.chart($('c-sweep'), 0.7), { ctx, m, pw, ph } = c;
    const lo = Math.log10(0.3), hi = Math.log10(20);
    const X = (a) => m.l + ((a - 90) / 90) * pw, Y = (v) => m.t + ph - ((Math.log10(Math.max(0.3, Math.min(20, v))) - lo) / (hi - lo)) * ph;
    L.axes(c, { X, Y, yTicks: [0.5, 1, 2, 5, 10], yFmt: (v) => String(v), xTicks: [90, 105, 120, 135, 150, 165, 180], xFmt: (a) => a + '°', xLabel: '씨앗 사이의 각도 (°)', yLabel: '빈틈 평균 (이상 간격 = 1)' });
    L.line(ctx, sweepRows.map((r) => [X(r.angle), Y(r.gap)]), css('--accent'), 2);
    // 두 이름이 서로 반대쪽으로 쓰이게 하고, 지금 설정이 황금각과 거의 같으면 선만 긋는다
    const below = sim.params.angle < SF.GOLDEN, near = Math.abs(sim.params.angle - SF.GOLDEN) < 4;
    L.vline(c, X(SF.GOLDEN), '#d19200', '황금각 137.5°', below && !near ? 'left' : 'right');
    L.vline(c, X(sim.params.angle), css('--unlucky'), near ? '' : '지금 설정', below ? 'right' : 'left');
    // 간단한 분수 이름은 둘째 줄에 (위쪽 선 이름과 겹치지 않게)
    const fr = [[90, '1/4', 'left'], [120, '1/3', 'center'], [144, '2/5', 'center'], [180, '1/2', 'right']];
    ctx.fillStyle = css('--muted');
    fr.forEach(([a, t, al]) => { ctx.textAlign = al; ctx.fillText(t, X(a) + (al === 'left' ? 3 : al === 'right' ? -3 : 0), m.t + 27); });
  }

  // ---------- ③ 특별한 각도 비교 ----------
  function drawBars() {
    const c = L.chart($('c-bars'), 0.7, { b: 44, t: 24 }), { ctx, m, pw, ph } = c;
    const ymax = 6, Y = (v) => m.t + ph - (Math.min(v, ymax) / ymax) * ph;
    L.axes(c, { X: () => 0, Y, yTicks: [0, 1, 2, 3, 4, 5, 6], yFmt: (v) => String(v), xLabel: '씨앗 사이의 각도 (°)', yLabel: '빈틈 평균 (이상 간격 = 1)' });
    const gw = pw / BARS.length, bw = Math.min(30, gw * 0.62);
    BARS.forEach(([a, label], i) => {
      const d = barRows.find((r) => r.a === a); if (!d) return;
      const x = m.l + gw * i + (gw - bw) / 2, gold = a === 137.508;
      ctx.fillStyle = gold ? '#d19200' : mix(css('--accent'), 0.7); L.roundRect(ctx, x, Y(d.gap), bw, m.t + ph - Y(d.gap), 4); ctx.fill();
      ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(d.gap.toFixed(2), x + bw / 2, Y(d.gap) - 5);
      ctx.fillStyle = gold ? '#d19200' : css('--muted'); ctx.font = (gold ? '700 ' : '') + '12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(label, x + bw / 2, m.t + ph + 17);
      ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    });
    const tops = []; BARS.forEach(([a], i) => { const d = barRows.find((r) => r.a === a); if (d) tops.push([m.l + gw * (i + 0.5), Y(d.gap) - 16]); });
    L.legend(c, [{ kind: 'box', color: '#d19200', label: '황금각' }, { kind: 'box', color: mix(css('--accent'), 0.7), label: '다른 각도' }], pickPos(c, tops, 2, true));
  }

  // ---------- ④ 이웃 거리 분포 ----------
  function drawHist() {
    const c = L.chart($('c-hist'), 0.7, { b: 40 }), { ctx, m, pw, ph } = c;
    const nb = 40, hi = 2, counts = new Array(nb).fill(0);
    mt.nn.forEach((d) => { counts[Math.min(nb - 1, Math.floor((d / hi) * nb))]++; });
    const cmax = Math.max(...counts), X = (v) => m.l + (v / hi) * pw, Y = (v) => m.t + ph - (v / cmax) * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.5, 1].map((q) => q * cmax), yFmt: (v) => String(Math.round(v)), xTicks: [0, 0.5, 1, 1.5, 2], xFmt: (v) => v.toFixed(1), xLabel: '가장 가까운 이웃까지의 거리 (이상 간격 = 1)', yLabel: '씨앗 수 (개)' });
    const bw = pw / nb;
    counts.forEach((v, i) => { ctx.fillStyle = mix('#d19200', 0.85); ctx.fillRect(m.l + i * bw + 0.5, Y(v), Math.max(1, bw - 1), m.t + ph - Y(v)); });
    L.vline(c, X(mt.nnMean), css('--text'), `평균 ${mt.nnMean.toFixed(2)}`, mt.nnMean > 1 ? 'right' : 'left');
  }

  function renderStats() {
    const d = mt.topDiffs.slice(0, 2).map((x) => x[0]).join(', ');
    const cards = [
      ['빈틈 평균', mt.gap.toFixed(2), '이상 간격 대비, 작을수록 고르게 채워짐'],
      ['가장 큰 빈틈', mt.maxGap.toFixed(2), '씨앗이 없는 가장 넓은 자리'],
      ['이웃 거리의 들쭉날쭉함', mt.nnCV.toFixed(3), '변동계수, 작을수록 간격이 일정'],
      ['가까운 이웃의 번호 차이', d, '가장 흔한 두 값 (황금각이면 피보나치 수)'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawFlower(); drawSweep(); drawBars(); drawHist(); }

  function after() {
    const P = params();
    barRows = BARS.map(([a]) => ({ a, gap: SF.metrics(P.n, a).gap })); drawBars();
    if (sweepN !== P.n) {
      sweepN = P.n; sweepRows = []; drawSweep(); $('note-sweep').textContent = '계산 중…';
      const jobs = [];
      for (let a = 90; a <= 180; a += 10) jobs.push(() => { for (let q = a; q < a + 10 && q <= 180.0001; q += 0.5) sweepRows.push({ angle: q, gap: SF.metrics(P.n, q).gap }); });
      L.jobs(jobs, drawSweep, () => {
        const best = sweepRows.reduce((x, y) => (y.gap < x.gap ? y : x));
        const calm = sweepRows.filter((r) => r.gap < 0.5).length, tot = sweepRows.length;
        $('note-sweep').textContent = `전체 ${tot}개 각도 중 ${calm}개는 빈틈 평균 0.5 미만이지만, 120°나 144°처럼 360°의 간단한 분수에 가까우면 크게 나빠집니다 (가장 낮은 값 ${best.gap.toFixed(2)}, 각도 ${best.angle.toFixed(1)}°)`;
      });
    }
  }

  // 프리셋을 고르면 각도 슬라이더를 맞춘다 (하네스보다 먼저 등록)
  $('preset').addEventListener('change', () => {
    const a = PRESETS[$('preset').value]; if (a == null) return;
    programmatic = true; $('angle').value = a;
    try { $('angle').dispatchEvent(new Event('input')); } catch (e) { /* 입력 이벤트가 없는 환경 */ }
    programmatic = false;
  });
  $('angle').addEventListener('input', () => { if (!programmatic) $('preset').value = 'custom'; });

  if (THUMB) $('color').value = '34'; // 썸네일: 나선 팔이 색으로 드러나게
  const h = L.harness({
    controls: ['preset', 'angle', 'n', 'size', 'color'],
    format: { preset: () => '', color: () => '', angle: (v) => Number(v).toFixed(3) + '°', n: (v) => v + '개', size: (v) => v + '%' },
    defaults: { preset: 'golden', angle: 137.508, n: 600, size: 80, color: 'index' },
    build() { sim = SF.create(params()); if (THUMB) sim.run(); mt = SF.metrics(sim.n, sim.params.angle, true); },
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawSweep(); drawBars(); drawHist(); }, seedLabel: '해바라기 번호',
  });
  seedGetter = h.seed;
})();
