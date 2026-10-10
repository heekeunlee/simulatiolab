/*
 * 해바라기 씨 배열: 피로택시스(Vogel 1979 나선)의 기하학 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - k번째 씨앗은 중심에서 반지름 √k, 각도 k × angle(도)에 놓인다 (c=1로 두면 씨앗 하나가 차지하는 넓이는 π로 일정)
 *  - angle이 황금각(약 137.508°)이면 씨앗이 빈틈 없이 퍼지고, 360°의 간단한 분수(90°, 120°, 144° …)에 가까우면 일정한 방향으로
 *    씨앗이 겹쳐 쌓이는 "바큇살"과 큰 빈틈이 생긴다
 *  - 채움 품질 측정: 원판 안쪽(반지름의 85% 이내)에 격자 모양으로 찍은 점들에서 가장 가까운 씨앗까지의 거리를 재서
 *    평균(빈틈 평균)과 최댓값(가장 큰 빈틈)을 이상적인 간격 √π로 나눠 표시한다. 작을수록 고르게 채워진 것
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sunflower = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const GOLDEN = 360 * (1 - 1 / ((1 + Math.sqrt(5)) / 2)); // 137.5077...°
  const DEFAULTS = { n: 600, angle: 137.51 };
  const IDEAL = Math.sqrt(Math.PI);

  function seedsXY(n, angle) {
    const x = new Float64Array(n), y = new Float64Array(n), a = (angle * Math.PI) / 180;
    for (let k = 0; k < n; k++) { const r = Math.sqrt(k + 0.5), t = k * a; x[k] = r * Math.cos(t); y[k] = r * Math.sin(t); }
    return { x, y };
  }

  // 공간 격자: 셀 하나가 씨앗 1~2개 정도 들어가도록
  function makeGrid(x, y, n, cell) {
    const R = Math.sqrt(n) + 2, S = Math.ceil((2 * R) / cell) + 1, heads = new Int32Array(S * S).fill(-1), next = new Int32Array(n).fill(-1);
    const idx = (v) => Math.min(S - 1, Math.max(0, Math.floor((v + R) / cell)));
    for (let k = 0; k < n; k++) { const c = idx(y[k]) * S + idx(x[k]); next[k] = heads[c]; heads[c] = k; }
    return { S, heads, next, idx, R };
  }
  function nearest(g, x, y, px, py, skip, maxRing) {
    const cx = g.idx(px), cy = g.idx(py); let best = 1e18, bi = -1;
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= g.S || yy >= g.S) continue;
        for (let k = g.heads[yy * g.S + xx]; k !== -1; k = g.next[k]) {
          if (k === skip) continue;
          const d = (x[k] - px) * (x[k] - px) + (y[k] - py) * (y[k] - py); if (d < best) { best = d; bi = k; }
        }
      }
      if (bi >= 0 && Math.sqrt(best) <= ring * g.cell) break;
    }
    return { d: Math.sqrt(best), k: bi };
  }

  // 채움 품질. nn 분포와 가까운 이웃의 번호 차이까지 함께 계산
  function metrics(n, angle, wantNN) {
    const { x, y } = seedsXY(n, angle), cell = IDEAL;
    const g = makeGrid(x, y, n, cell); g.cell = cell;
    const R = Math.sqrt(n) * 0.85, step = IDEAL * 0.35;
    let sum = 0, cnt = 0, max = 0;
    for (let py = -R; py <= R; py += step) for (let px = -R; px <= R; px += step) {
      if (px * px + py * py > R * R) continue;
      const d = nearest(g, x, y, px, py, -1, g.S).d; sum += d; cnt++; if (d > max) max = d;
    }
    const out = { gap: sum / cnt / IDEAL, maxGap: max / IDEAL };
    if (wantNN) {
      const nn = [], diffs = {}, lo = Math.floor(n * 0.2), hi = Math.floor(n * 0.8);
      for (let k = lo; k < hi; k++) { const r = nearest(g, x, y, x[k], y[k], k, g.S); nn.push(r.d / IDEAL); const dk = Math.abs(r.k - k); diffs[dk] = (diffs[dk] || 0) + 1; }
      const m = nn.reduce((a, b) => a + b, 0) / nn.length, sd = Math.sqrt(nn.reduce((a, b) => a + (b - m) * (b - m), 0) / nn.length);
      const top = Object.keys(diffs).map((k) => [Number(k), diffs[k]]).sort((a, b) => b[1] - a[1]).slice(0, 3);
      out.nn = nn; out.nnMean = m; out.nnCV = sd / m; out.topDiffs = top;
    }
    return out;
  }

  // 자라는 모습: advance() 한 번에 씨앗을 몇 개씩 더한다
  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const { x, y } = seedsXY(p.n, p.angle), per = Math.max(1, Math.round(p.n / 150));
    const sim = { params: p, n: p.n, x, y, placed: 0, per,
      advance() { if (sim.placed >= p.n) return false; sim.placed = Math.min(p.n, sim.placed + per); return true; },
      done() { return sim.placed >= p.n; },
      run() { sim.placed = p.n; return sim; } };
    return sim;
  }

  function sweep(n, from, to, step) {
    const out = [];
    for (let a = from; a <= to + 1e-9; a += step) out.push({ angle: a, gap: metrics(n, a).gap });
    return out;
  }

  return { GOLDEN, IDEAL, DEFAULTS, seedsXY, metrics, create, sweep };
});
