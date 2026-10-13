/*
 * 산불 모델 (Drossel-Schwabl 숲불 모델을 바탕으로 한 이 프로젝트의 단순화된 구현) + 소방(작은 불 끄기)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 격자(n x n)의 칸은 빈 땅 또는 나무. 매 단계(시간 한 칸):
 *  1) 빈 땅마다 확률 p로 나무가 자란다.
 *  2) 칸마다 확률 f로 번개가 친다 (칸 수 x f 개가 무작위 칸에 떨어짐). 나무에 맞으면 불이 붙는다.
 *  3) 불은 상하좌우로 이웃한 나무에 곧바로 번져, 이어진 나무 덩어리 전체가 한 번에 탄다 (불난 칸은 빈 땅이 된다).
 *  소방: 불이 붙은 순간 그 불이 작으면(덩어리가 smallFrac x 칸 수 이하) 확률 s로 곧바로 끈다. 큰 불은 끌 수 없다.
 * 가장자리는 이어지지 않는 벽이다(바깥은 빈 땅).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Wildfire = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 100, p: 0.01, f: 0.0002, s: 0, smallFrac: 0.05, seed: 1, init: 0.4 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts), n = P.n, N = n * n, rng = mulberry32(P.seed * 7919 + 13);
    const tree = new Uint8Array(N);          // 1 = 나무
    const age = new Uint16Array(N);          // 나무 나이 (단계)
    const burnt = new Int16Array(N);         // 불난 뒤 지난 단계 + 1 (0 = 최근 불 없음, 화면용)
    const empties = new Int32Array(N), pos = new Int32Array(N); // 빈 땅 목록 (자라기 빠르게)
    let ne = 0, trees = 0;
    const stack = new Int32Array(N), mark = new Int32Array(N); let stamp = 0;
    for (let i = 0; i < N; i++) {
      if (rng() < P.init) { tree[i] = 1; age[i] = Math.floor(rng() * 40); trees++; pos[i] = -1; }
      else { empties[ne] = i; pos[i] = ne++; }
    }
    const sim = { P, n, N, tree, age, burnt, step: 0, dens: [], fires: [], fireStep: [], suppressed: 0, ignitions: 0, burned: 0, cumBurned: [], lastFire: null, flame: [], smallMax: Math.max(1, Math.round(P.smallFrac * N)), flameMax: 0 };
    const lambdaG = (m) => { // 푸아송 수 (작으면 곱셈 방식, 크면 정규 근사)
      if (m <= 0) return 0;
      if (m < 30) { const L = Math.exp(-m); let k = 0, q = 1; do { k++; q *= rng(); } while (q > L); return k - 1; }
      const u = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
      return Math.max(0, Math.round(m + Math.sqrt(m) * u));
    };
    function plant(i) { tree[i] = 1; age[i] = 0; trees++; const k = pos[i], last = empties[--ne]; empties[k] = last; pos[last] = k; pos[i] = -1; }
    function clear(i) { tree[i] = 0; trees--; empties[ne] = i; pos[i] = ne++; }
    function cluster(start) { // 이어진 나무 덩어리 (깊이 우선). 결과: stack[0..size)
      stamp++; let top = 0, size = 0; stack[top++] = start; mark[start] = stamp;
      while (top) {
        const c = stack[--top]; stack[N - 1 - size] = c; size++; // 방문 순서는 뒤쪽에 보관
        const x = c % n, y = (c - x) / n;
        if (x > 0 && tree[c - 1] && mark[c - 1] !== stamp) { mark[c - 1] = stamp; stack[top++] = c - 1; }
        if (x < n - 1 && tree[c + 1] && mark[c + 1] !== stamp) { mark[c + 1] = stamp; stack[top++] = c + 1; }
        if (y > 0 && tree[c - n] && mark[c - n] !== stamp) { mark[c - n] = stamp; stack[top++] = c - n; }
        if (y < n - 1 && tree[c + n] && mark[c + n] !== stamp) { mark[c + n] = stamp; stack[top++] = c + n; }
      }
      return size;
    }
    sim.advance = function () {
      sim.step++;
      for (let i = 0; i < N; i++) if (burnt[i]) burnt[i] = burnt[i] > 14 ? 0 : burnt[i] + 1;
      for (let i = 0; i < N; i++) if (tree[i] && age[i] < 65535) age[i]++;
      let g = lambdaG(ne * P.p); if (g > ne) g = ne;
      for (let k = 0; k < g; k++) plant(empties[Math.floor(rng() * ne)]);
      const strikes = lambdaG(N * P.f);
      sim.lastFire = null; let burnedNow = 0;
      for (let k = 0; k < strikes; k++) {
        const c = Math.floor(rng() * N);
        if (!tree[c]) continue;
        sim.ignitions++;
        const size = cluster(c);
        if (size <= sim.smallMax && rng() < P.s) { sim.suppressed++; continue; } // 작은 불은 끈다
        for (let q = 0; q < size; q++) { const i = stack[N - 1 - q]; clear(i); burnt[i] = 1; }
        sim.fires.push(size); sim.fireStep.push(sim.step); sim.burned += size; burnedNow += size;
        sim.lastFire = { size, start: c };
      }
      sim.dens.push(trees / N); sim.cumBurned.push(sim.burned);
      return true;
    };
    sim.density = () => trees / N;
    sim.run = (steps) => { for (let i = 0; i < steps; i++) sim.advance(); return sim; };
    return sim;
  }

  // 통계: warm 단계 이후의 불만 센다. 큰 불 = 숲 전체 칸의 bigFrac(기본 10%) 이상을 태운 불
  function stats(sim, warm, bigFrac) {
    const bigMin = (bigFrac || 0.1) * sim.N, sizes = [];
    for (let i = 0; i < sim.fires.length; i++) if (sim.fireStep[i] > warm) sizes.push(sim.fires[i]);
    const steps = sim.step - warm, d = sim.dens.slice(warm), tot = sizes.reduce((x, y) => x + y, 0);
    const cls = [0, 0, 0]; // 면적: 작은 불(1% 미만), 중간 불, 큰 불(10% 이상)
    sizes.forEach((v) => { cls[v >= bigMin ? 2 : v >= 0.01 * sim.N ? 1 : 0] += v; });
    const big = sizes.filter((v) => v >= bigMin).length;
    const sorted = sizes.slice().sort((a, b) => b - a), top = Math.max(1, Math.ceil(sorted.length * 0.01));
    return { count: sizes.length, total: tot, steps, big, bigPer10k: (big / steps) * 10000, bigShare: tot ? cls[2] / tot : 0, cls, burnPerStep: tot / steps / sim.N, meanDens: d.reduce((x, y) => x + y, 0) / (d.length || 1), largest: sorted[0] || 0, top1Share: tot ? sorted.slice(0, top).reduce((x, y) => x + y, 0) / tot : 0, sizes };
  }
  // 크기 x 이상인 불이 1000단계에 몇 번 나는지
  function ccdf(st, N, xs) { return xs.map((x) => st.sizes.filter((v) => v >= x).length / st.steps * 1000); }

  return { DEFAULTS, create, stats, ccdf };
});
