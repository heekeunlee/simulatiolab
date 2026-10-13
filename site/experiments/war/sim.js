/*
 * 전쟁은 어떻게 일어나고 번질까: 세 가지 추상 모델을 한 작업대에서 돌린다. 이 프로젝트의 단순화된 구현이며 실제 국가·전쟁과 무관하다.
 *  1) 협상 실패로서의 전쟁 (Fearon 1995, International Organization): 전쟁에는 비용이 들어 늘 서로 나은 합의가 있는데도,
 *     A가 B의 힘을 정확히 모르면(불확실성 u) 욕심 낸 요구가 거절되어 전쟁이 날 수 있다.
 *  2) 군비 경쟁 (Richardson 1960, Arms and Insecurity): 상대 군비에 반응(k)하고 자기 부담에 피로(a)를 느끼는 두 나라. k < a 이면 안정, k > a 이면 폭주.
 *  3) 번짐: 격자 위 추상 국가들. 전쟁 중인 나라가 이웃을 확률 q로 끌어들인다 (결합 퍼콜레이션; 정사각 격자의 임계값은 1/2).
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.War = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { u: 0.25, c: 0.15, k: 0.6, a: 0.45, q: 0.5, seed: 1, rounds: 160, grid: 15, perStep: 4, g: 0.1, dt: 0.5, danger: 10, x0: 0.3, y0: 0.7, noise: 0.02, hold: 6 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 1) 협상 ----------
  // A의 승리 가능성 p ~ U[0.5-u, 0.5+u] (B는 정확히 알고, A는 분포만 안다). 전쟁 비용은 양쪽 모두 c (파이 1 기준).
  // 전쟁을 하면 A는 p-c, B는 1-p-c. 협상 범위(A의 몫) = [p-c, p+c], 폭 2c > 0.
  // A가 요구 x를 하면 B는 x <= p + c 일 때 받아들인다 (p >= x - c).
  // A의 기대 몫을 최대화하는 문턱 t = x - c 는 t* = hi - 2c (hi = 0.5+u), 문턱보다 작은 p는 전쟁.
  function bounds(P) { return { lo: 0.5 - P.u, hi: 0.5 + P.u }; }
  function threshold(P) { const b = bounds(P); return Math.max(b.lo, b.hi - 2 * P.c); }
  function demand(P) { return threshold(P) + P.c; }
  function theoryWar(P) { // 이론 전쟁 확률 = max(0, 1 - 2c/(2u))
    if (P.u <= 0) return 0;
    return Math.max(0, 1 - (2 * P.c) / (2 * P.u));
  }
  function dispute(P, rand) {
    const b = bounds(P), p = b.lo + (b.hi - b.lo) * rand(), x = demand(P);
    return { p, x, war: p + P.c < x - 1e-12, lo: p - P.c, hi: p + P.c };
  }
  function bargainRun(P, n, seed) {
    const r = mulberry32(seed || 1); let w = 0;
    for (let i = 0; i < n; i++) if (dispute(P, r).war) w++;
    return w / n;
  }

  // ---------- 2) 군비 경쟁 ----------
  // x' = x + dt (k y - a x + g) + 잡음,  y' = y + dt (k x - a y + g) + 잡음.  k < a 이면 안정 (곱 k*k < a*a), 균형 g/(a-k).
  function armsStep(P, s, rand) {
    const n1 = (rand() - 0.5) * 2 * P.noise, n2 = (rand() - 0.5) * 2 * P.noise;
    const x = s.x + P.dt * (P.k * s.y - P.a * s.x + P.g) + n1, y = s.y + P.dt * (P.k * s.x - P.a * s.y + P.g) + n2;
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }
  function armsRun(P, steps, seed) {
    const r = mulberry32(seed || 1); let s = { x: P.x0, y: P.y0 }; const xs = [s.x], ys = [s.y]; let cross = -1;
    for (let i = 0; i < steps; i++) { s = armsStep(P, s, r); xs.push(s.x); ys.push(s.y); if (cross < 0 && Math.max(s.x, s.y) > P.danger) cross = i + 1; }
    return { xs, ys, cross };
  }
  const armsStable = (P) => P.k < P.a;
  const armsLevel = (P) => (P.k < P.a ? P.g / (P.a - P.k) : Infinity);

  // ---------- 3) 번짐 ----------
  function neighbors(G, i) {
    const r = Math.floor(i / G), c = i % G, out = [];
    if (r > 0) out.push(i - G); if (r < G - 1) out.push(i + G); if (c > 0) out.push(i - 1); if (c < G - 1) out.push(i + 1);
    return out;
  }
  function cascadeOnce(q, G, seedNode, rand) { // 한 번의 전쟁이 퍼진 나라 수
    const inf = new Uint8Array(G * G); inf[seedNode] = 1; let front = [seedNode], size = 1;
    while (front.length) {
      const nx = [];
      front.forEach((i) => neighbors(G, i).forEach((j) => { if (!inf[j] && rand() < q) { inf[j] = 1; size++; nx.push(j); } }));
      front = nx;
    }
    return size;
  }
  function spreadStats(q, G, runs, seed) {
    const r = mulberry32(seed || 7), N = G * G; let sum = 0, big = 0;
    const sizes = [];
    for (let i = 0; i < runs; i++) { const s = cascadeOnce(q, G, Math.floor(r() * N), r); sizes.push(s); sum += s; if (s >= 0.25 * N) big++; }
    return { mean: sum / runs, big: big / runs, sizes };
  }
  function curveQ(P, qs, runs) { return qs.map((q) => { const s = spreadStats(q, P.grid, runs || 300, 11); return { x: q, mean: s.mean / (P.grid * P.grid), big: s.big }; }); }
  function curveU(P, us, n) { return us.map((u) => { const Q = Object.assign({}, P, { u }); return { x: u, theory: theoryWar(Q), sim: bargainRun(Q, n || 2000, 5) }; }); }

  // ---------- 애니메이션용 상태 ----------
  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts), rand = mulberry32(P.seed * 7919 + 13), G = P.grid, N = G * G;
    const sim = { params: P, round: 0, disputes: [], wars: 0, x: [P.x0], y: [P.y0], cross: -1, sizes: [], hist: [] };
    let sp = null;
    function newCascade() {
      const start = Math.floor(rand() * N), inf = new Uint8Array(N), born = new Int16Array(N).fill(-1);
      inf[start] = 1; born[start] = 0;
      sp = { start, inf, born, front: [start], size: 1, layer: 0, hold: 0, running: true };
      sim.spread = sp;
    }
    newCascade();
    let arms = { x: P.x0, y: P.y0 };
    sim.advance = function () {
      if (sim.round >= P.rounds) return false;
      sim.round++;
      for (let i = 0; i < P.perStep; i++) { const d = dispute(P, rand); sim.disputes.push(d); if (d.war) sim.wars++; }
      arms = armsStep(P, arms, rand); sim.x.push(arms.x); sim.y.push(arms.y);
      if (sim.cross < 0 && Math.max(arms.x, arms.y) > P.danger) sim.cross = sim.round;
      if (sp.running) {
        const nx = [];
        sp.front.forEach((i) => neighbors(G, i).forEach((j) => { if (!sp.inf[j] && rand() < P.q) { sp.inf[j] = 1; sp.born[j] = sp.layer + 1; sp.size++; nx.push(j); } }));
        sp.layer++; sp.front = nx;
        if (!nx.length) { sp.running = false; sim.sizes.push(sp.size); }
      } else if (++sp.hold >= P.hold) newCascade();
      return true;
    };
    sim.done = () => sim.round >= P.rounds;
    sim.run = function () { while (sim.advance()); return sim; };
    sim.warRate = () => (sim.disputes.length ? sim.wars / sim.disputes.length : 0);
    return sim;
  }

  function summary(opts) {
    const P = Object.assign({}, DEFAULTS, opts);
    return { war: theoryWar(P), range: 2 * P.c, stable: armsStable(P), level: armsLevel(P), thr: threshold(P), demand: demand(P) };
  }

  return { DEFAULTS, create, summary, theoryWar, threshold, demand, bounds, dispute, bargainRun, armsRun, armsStable, armsLevel, cascadeOnce, spreadStats, curveQ, curveU, mulberry32 };
});
