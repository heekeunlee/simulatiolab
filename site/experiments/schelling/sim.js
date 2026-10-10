/*
 * 셸링 분리 모델 (Thomas Schelling, 1971, "Dynamic Models of Segregation")
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - size x size 격자(가장자리는 반대편과 이어짐)에 두 집단(A, B)이 놓이고 일부 칸은 비어 있다
 *  - 이웃은 둘레 8칸. 이웃 중 같은 집단 비율이 threshold 이상이면 만족
 *  - 불만족한 사람은 무작위 빈 칸으로 이사한다 (한 라운드에 모두 순서대로)
 *  - 모두 만족하거나 maxRounds에 도달하면 멈춘다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Schelling = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { size: 50, empty: 0.1, shareA: 0.5, threshold: 0.3, seed: 1, maxRounds: 300 };

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
    const rng = mulberry32(p.seed);
    const S = p.size, N = S * S;
    const grid = new Uint8Array(N); // 0 빈 칸, 1 집단 A, 2 집단 B

    const nEmpty = Math.round(N * p.empty);
    const nPeople = N - nEmpty;
    const nA = Math.round(nPeople * p.shareA);
    for (let i = 0; i < nPeople; i++) grid[i] = i < nA ? 1 : 2;
    for (let i = N - 1; i > 0; i--) { // 섞기
      const j = Math.floor(rng() * (i + 1));
      const t = grid[i]; grid[i] = grid[j]; grid[j] = t;
    }

    const wrap = (v) => (v + S) % S;
    // 이웃 중 같은 집단 비율. 이웃이 없으면 -1
    function sameShare(idx) {
      const me = grid[idx], x = idx % S, y = (idx - x) / S;
      let same = 0, total = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const g = grid[wrap(y + dy) * S + wrap(x + dx)];
        if (g === 0) continue;
        total++; if (g === me) same++;
      }
      return total ? same / total : -1;
    }
    const isUnhappy = (idx) => { const s = sameShare(idx); return s >= 0 && s < p.threshold; };

    const initial = Uint8Array.from(grid);
    const sim = {
      params: p, size: S, grid, initial, round: 0, moved: 0, done: false,
      history: [],

      unhappyList() {
        const out = [];
        for (let i = 0; i < N; i++) if (grid[i] && isUnhappy(i)) out.push(i);
        return out;
      },

      metrics() {
        let sum = 0, cnt = 0, unhappy = 0, people = 0;
        for (let i = 0; i < N; i++) {
          if (!grid[i]) continue;
          people++;
          const s = sameShare(i);
          if (s >= 0) { sum += s; cnt++; if (s < p.threshold) unhappy++; }
        }
        return { avgSame: cnt ? sum / cnt : 0, unhappyShare: unhappy / people };
      },

      // 한 라운드. 이사한 사람 수를 반환
      advance() {
        if (sim.done) return 0;
        const list = sim.unhappyList();
        if (!list.length || sim.round >= p.maxRounds) { sim.done = true; return 0; }
        for (let i = list.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const t = list[i]; list[i] = list[j]; list[j] = t;
        }
        const empties = [];
        for (let i = 0; i < N; i++) if (!grid[i]) empties.push(i);
        let moved = 0;
        for (const from of list) {
          if (!empties.length) break;
          const k = Math.floor(rng() * empties.length);
          const to = empties[k];
          grid[to] = grid[from]; grid[from] = 0;
          empties[k] = from;
          moved++;
        }
        sim.round++; sim.moved = moved;
        sim.history.push(sim.metrics().avgSame);
        if (!sim.unhappyList().length) sim.done = true;
        return moved;
      },

      run() { sim.history = [sim.metrics().avgSame]; while (!sim.done) sim.advance(); return sim; },
    };
    sim.history = [sim.metrics().avgSame];
    return sim;
  }

  // 선호 비율을 0%~maxT까지 바꿔가며 최종 분리 정도를 측정
  function sweep(opts, maxT, step) {
    const out = [];
    for (let t = 0; t <= maxT + 1e-9; t += step) {
      const s = create(Object.assign({}, opts, { threshold: t })).run();
      out.push({ threshold: t, avgSame: s.metrics().avgSame, rounds: s.round });
    }
    return out;
  }

  return { DEFAULTS, create, sweep };
});
