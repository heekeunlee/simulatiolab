/*
 * 확산 제한 응집(DLA, Diffusion-Limited Aggregation): 무작위로 떠도는 입자가 닿으면 붙어 자라는 가지 모양 덩어리 모델.
 * (Witten & Sander 1981, Physical Review Letters 47, 1400). 이 프로젝트의 단순화된 격자 구현이며 논문 수치를 재현한 것은 아니다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 격자(N x N) 위에 씨앗(점·선·고리)을 놓는다. 입자는 씨앗을 감싸는 "출발 원"에서 무작위 방향으로 한 칸씩 떠돌다가,
 * 덩어리에 (상하좌우로) 닿으면 확률 stick으로 그 자리에 붙는다. 너무 멀리 가면(바깥 "버림 원") 버리고 새 입자를 출발시킨다.
 * 출발 원은 덩어리의 가장 먼 끝보다 6칸 바깥, 버림 원은 그보다 한참 바깥이라 입자 하나의 계산이 한없이 길어지지 않는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DLA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const N = 560, C = N / 2, RCAP = 160; // 격자 크기, 중심, 덩어리가 이 반지름에 닿으면 성장 중단
  const DEFAULTS = { stick: 1, shape: 'point', count: 4000, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32((P.seed * 2654435761) >>> 0);
    const grid = new Int32Array(N * N); // 0 = 빈 칸, 1 = 씨앗, k+2 = k번째로 붙은 입자
    const xs = new Int16Array(P.count + 1), ys = new Int16Array(P.count + 1);
    const seedCells = [];
    const put = (x, y) => { if (!grid[y * N + x]) { grid[y * N + x] = 1; seedCells.push([x, y]); } };
    if (P.shape === 'line') { for (let x = C - 45; x <= C + 45; x++) put(x, C); }
    else if (P.shape === 'ring') { for (let k = 0; k < 2000; k++) { const a = (k / 2000) * 2 * Math.PI; put(Math.round(C + 45 * Math.cos(a)), Math.round(C + 45 * Math.sin(a))); } }
    else put(C, C);
    let r2max = 0, minx = N, maxx = 0, miny = N, maxy = 0;
    seedCells.forEach(([x, y]) => { const d = (x - C) * (x - C) + (y - C) * (y - C); if (d > r2max) r2max = d; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; });
    const r0 = Math.sqrt(r2max);
    const sim = { params: P, grid, xs, ys, seedCells, N, C, r0, n: 0, steps: 0, capped: false };
    const p = P.stick, always = p >= 1;
    let wx = 0, wy = 0, active = false;
    let L2, K2; // 출발·버림 반지름의 제곱
    const TR = 160, trx = new Int16Array(TR), try_ = new Int16Array(TR); let trn = 0;
    function radii() {
      const R = Math.sqrt(r2max) + 6, K = Math.min(N / 2 - 3, R * 1.6 + 20);
      L2 = R; K2 = K * K;
    }
    radii();
    function launch() {
      const a = rng() * 2 * Math.PI;
      wx = Math.round(C + L2 * Math.cos(a)); wy = Math.round(C + L2 * Math.sin(a)); active = true; trn = 0;
    }
    // 입자 하나를 최대 max걸음 움직인다. 붙으면 true. (trail: 최근 경로 기록 여부)
    function run(max, trail) {
      let x = wx, y = wy, s = 0, stuck = false;
      while (s < max) {
        s++;
        const r = (rng() * 4) | 0;
        let nx = x, ny = y;
        if (r === 0) nx++; else if (r === 1) nx--; else if (r === 2) ny++; else ny--;
        if (!grid[ny * N + nx]) { x = nx; y = ny; }
        const dx = x - C, dy = y - C;
        if (dx * dx + dy * dy > K2) { sim.steps += s; wx = x; wy = y; launch(); x = wx; y = wy; s = 0; continue; }
        if (trail) { trx[trn % TR] = x; try_[trn % TR] = y; trn++; }
        const i = y * N + x;
        if (grid[i - 1] || grid[i + 1] || grid[i - N] || grid[i + N]) {
          if (always || rng() < p) {
            const k = sim.n++;
            grid[i] = k + 2; xs[k] = x; ys[k] = y;
            const d = dx * dx + dy * dy;
            if (d > r2max) { r2max = d; radii(); }
            if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
            stuck = true; break;
          }
        }
      }
      sim.steps += s; wx = x; wy = y;
      return stuck;
    }
    sim.done = () => sim.n >= P.count || sim.capped;
    sim.rmax = () => Math.sqrt(r2max);
    sim.bbox = () => [minx, miny, maxx, maxy];
    sim.addParticles = function (k) {
      for (let i = 0; i < k && !sim.done(); i++) {
        if (Math.sqrt(r2max) >= RCAP) { sim.capped = true; break; }
        if (!active) launch();
        run(1e9, false); active = false;
      }
    };
    // 화면에 보이는 "떠도는 입자": 최대 s걸음 움직이고, 붙으면 true
    sim.stepLive = function (s) {
      if (sim.done()) { active = false; return false; }
      if (Math.sqrt(r2max) >= RCAP) { sim.capped = true; active = false; return false; }
      if (!active) launch();
      const st = run(s, true);
      if (st) active = false;
      return st;
    };
    sim.live = () => {
      if (!active) return null;
      const m = Math.min(trn, TR), pts = [];
      for (let k = trn - m; k < trn; k++) pts.push([trx[k % TR], try_[k % TR]]);
      return { x: wx, y: wy, trail: pts, R: L2 };
    };
    // 질량-반지름. 점 씨앗은 중심에서, 선·고리 씨앗은 붙은 입자 가운데 표본을 골라 그 둘레의 질량을 평균한다.
    // 반환: { D, pts:[[r, M]], lo, hi }  (실패하면 D = NaN)
    sim.dimension = function () {
      const n = sim.n, out = { D: NaN, pts: [], lo: 0, hi: 0 };
      if (n < 60) return out;
      const rm = sim.rmax(), pts = [];
      const rs = []; for (let r = 3; r <= rm * 0.5; r *= 1.25) rs.push(r);
      if (P.shape === 'point') {
        const cnt = new Float64Array(rs.length + 1);
        for (let k = 0; k < n; k++) {
          const d = Math.hypot(xs[k] - C, ys[k] - C);
          for (let j = 0; j < rs.length; j++) if (d <= rs[j]) cnt[j]++;
        }
        for (let j = 0; j < rs.length; j++) pts.push([rs[j], cnt[j] + 1]); // +1: 씨앗
      } else {
        const rsl = rs.filter((r) => r <= Math.max(6, rm * 0.2)); // 가장자리 효과를 줄이려고 짧은 반지름만
        const m = Math.min(150, n), cnt = new Float64Array(rsl.length);
        for (let t = 0; t < m; t++) {
          const c = n < 150 ? t : Math.floor(((t + 0.5) / m) * n);
          const cx = xs[c], cy = ys[c];
          for (let k = 0; k < n; k++) {
            const d = Math.hypot(xs[k] - cx, ys[k] - cy);
            for (let j = 0; j < rsl.length; j++) if (d <= rsl[j]) cnt[j]++;
          }
        }
        for (let j = 0; j < rsl.length; j++) pts.push([rsl[j], cnt[j] / m]);
      }
      const use = pts.filter((q) => q[0] >= 4);
      if (use.length < 4) return out;
      let sx = 0, sy = 0, sxx = 0, sxy = 0; const nn = use.length;
      use.forEach(([r, mm]) => { const a = Math.log10(r), b = Math.log10(mm); sx += a; sy += b; sxx += a * a; sxy += a * b; });
      const slope = (nn * sxy - sx * sy) / (nn * sxx - sx * sx);
      out.D = slope; out.pts = pts; out.lo = use[0][0]; out.hi = use[nn - 1][0];
      out.icpt = (sy - slope * sx) / nn;
      return out;
    };
    // 최근 입자들이 붙은 자리: 중심에서의 거리 ÷ 가장 먼 끝, 20칸 히스토그램(0~1)
    sim.landing = function (last) {
      const n = sim.n, from = Math.max(0, n - (last || 300)), bins = new Array(20).fill(0), rm = sim.rmax();
      for (let k = from; k < n; k++) {
        const q = Math.min(19, Math.floor((Math.hypot(xs[k] - C, ys[k] - C) / rm) * 20));
        bins[q]++;
      }
      return { bins, total: n - from };
    };
    sim.fill = function () { const rm = Math.max(1, sim.rmax()); return (sim.n + seedCells.length) / (Math.PI * rm * rm); };
    sim.run = function () { while (!sim.done()) sim.addParticles(200); return sim; };
    return sim;
  }

  return { N, C, DEFAULTS, create, mulberry32 };
});
