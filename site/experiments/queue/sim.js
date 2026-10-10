/*
 * 새치기가 늘면 줄은 어떻게 될까: 격자 위의 진화 게임 (공간 진화 게임, Nowak & May 1992 계열)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - size x size 격자(가장자리는 이어짐)의 각 칸에 사람 한 명. 전략은 세 가지:
 *      0 질서: 새치기 안 하고 가만히 줄 선다
 *      1 새치기: 앞으로 끼어든다
 *      2 눈총: 줄은 서지만 새치기하는 사람을 보면 응징한다 (눈총, 항의). 응징에는 비용이 든다
 *  - 한 라운드에 모두가 둘레 8칸 이웃과 한 번씩 만나서 점수(시간 이득)를 모은다.
 *    기본 점수는 1이고, 만난 조합에 따라 다음과 같이 바뀐다
 *      질서가 새치기를 만나면 1 - gain, 새치기가 질서·눈총을 만나면 +gain, 새치기끼리는 1 - 0.25*gain
 *      새치기가 눈총을 만나면 gain - punish (눈총을 받아 이득이 깎임), 눈총이 새치기를 만나면 1 - cost
 *  - 모두 동시에, 자기와 이웃 중 점수가 가장 높은 사람의 전략을 따라 한다
 *  - 작은 확률 noise로 질서 또는 새치기로 바뀐다 (새로운 사람이 들어오거나 마음이 바뀜). 눈총형은 처음에 있던 사람만 있고 새로 생기지 않는다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Queue = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { size: 50, gain: 0.5, punish: 1.0, cost: 0.2, cutters: 0.2, punishers: 0.2, noise: 0.002, rounds: 150, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 29 + 5);
    const S = p.size, N = S * S;
    let grid = new Uint8Array(N), next = new Uint8Array(N);
    const pay = new Float64Array(N);
    for (let i = 0; i < N; i++) { const r = rng(); grid[i] = r < p.cutters ? 1 : r < p.cutters + p.punishers ? 2 : 0; }
    const g = p.gain;
    // M[나][상대]
    const M = [[1, 1 - g, 1], [1 + g, 1 - 0.25 * g, 1 + g - p.punish], [1, 1 - p.cost, 1]];
    const wrap = (v) => (v + S) % S;
    const counts = () => { const c = [0, 0, 0]; for (let i = 0; i < N; i++) c[grid[i]]++; return c.map((x) => x / N); };
    const sim = {
      params: p, size: S, grid, round: 0, done: false, history: [counts()],
      advance() {
        if (sim.done) return false;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const i = y * S + x; let s = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            s += M[grid[i]][grid[wrap(y + dy) * S + wrap(x + dx)]];
          }
          pay[i] = s;
        }
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const i = y * S + x; let best = i, bp = pay[i];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const j = wrap(y + dy) * S + wrap(x + dx);
            if (pay[j] > bp + 1e-9) { bp = pay[j]; best = j; }
          }
          next[i] = rng() < p.noise ? Math.floor(rng() * 2) : grid[best]; // 새로 들어온 사람은 질서 또는 새치기
        }
        const t = grid; sim.grid = grid = next; next = t;
        sim.round++; sim.history.push(counts());
        if (sim.round >= p.rounds) sim.done = true;
        return true;
      },
      shares() { return sim.history[sim.history.length - 1]; },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  function final(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 11 })).run().shares());
    return out;
  }

  return { DEFAULTS, create, final };
});
