/*
 * 기립박수는 어떻게 시작될까: 관객석 위의 문턱 모델
 * (Granovetter 1978의 문턱 모델을 "앞사람만 보이는 관객석"에 올린 이 프로젝트의 변형. Miller & Page의 기립박수 문제에서 아이디어를 얻음)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 관객석은 rows줄 × cols자리. 0번 줄이 무대 바로 앞(앞줄)이다.
 *  - 사람마다 공연 만족도 e = 공연 만족도(quality) + 사람마다 다른 차이(정규분포, sd = spread), 0~0.99로 자름
 *  - 공연이 끝나면 '처음 일어선 사람' starters명이 바로 일어선다. 자리(place): front(앞쪽 두 줄) | random(아무 데나) | back(뒤쪽 두 줄)
 *  - 앉아 있는 사람은 자기 눈에 보이는 사람(같은 줄 양옆 1자리 + 앞쪽 depth줄까지의 부채꼴: d줄 앞이면 좌우 d자리까지) 중
 *    일어선 사람의 비율 s를 본다. 문턱 th = (1 − e) / follow 보다 s가 크거나 같으면 일어선다 (follow = 남들을 따라 하는 정도)
 *    → 만족도가 높을수록, 따라 하는 정도가 클수록 문턱이 낮다. 앞줄은 앞이 무대라서 양옆밖에 안 보인다.
 *  - 한 번 일어선 사람은 다시 앉지 않는다. 매 초(한 단계) 앉아 있는 사람은 확률 react로만 주변을 살핀다(반응이 제각각이라 물결처럼 번짐).
 *  - 더 일어설 사람이 아무도 없으면(모든 앉은 사람의 문턱이 지금 보이는 비율보다 높으면) 끝난다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ovation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { rows: 12, cols: 25, quality: 0.75, spread: 0.15, follow: 0.6, starters: 8, place: 'front', depth: 4, react: 0.45, maxSteps: 40, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 자리 i(= r*cols + c)에서 보이는 자리 목록
  function visibility(p) {
    const R = p.rows, C = p.cols, vis = [], seenBy = new Int32Array(R * C);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const v = [];
      for (const dc of [-1, 1]) if (c + dc >= 0 && c + dc < C) v.push(r * C + c + dc);
      for (let d = 1; d <= p.depth; d++) {
        const rr = r - d; if (rr < 0) break;
        for (let dc = -d; dc <= d; dc++) { const cc = c + dc; if (cc >= 0 && cc < C) v.push(rr * C + cc); }
      }
      vis.push(Int32Array.from(v)); v.forEach((j) => seenBy[j]++);
    }
    return { vis, seenBy };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const R = p.rows, C = p.cols, N = R * C;
    const rng = mulberry32(p.seed * 41 + 7);
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const { vis, seenBy } = visibility(p);
    const enjoy = new Float64Array(N), th = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      enjoy[i] = Math.min(0.99, Math.max(0, p.quality + p.spread * gauss()));
      th[i] = p.follow > 0 ? (1 - enjoy[i]) / p.follow : Infinity;
    }
    // 처음 일어선 사람: 정해진 구역에서 무작위로 고른다
    const pool = [];
    for (let i = 0; i < N; i++) { const r = Math.floor(i / C); if (p.place === 'front' ? r < 2 : p.place === 'back' ? r >= R - 2 : true) pool.push(i); }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const k = Math.min(p.starters, pool.length);
    const stand = new Uint8Array(N), at = new Int16Array(N).fill(-1), starter = new Uint8Array(N);
    for (let q = 0; q < k; q++) { stand[pool[q]] = 1; at[pool[q]] = 0; starter[pool[q]] = 1; }
    const seenShare = (i) => { const v = vis[i]; let s = 0; for (let q = 0; q < v.length; q++) s += stand[v[q]]; return v.length ? s / v.length : 0; };
    const count = () => { let s = 0; for (let i = 0; i < N; i++) s += stand[i]; return s; };
    const half = (front) => { let s = 0, n = 0; for (let i = 0; i < N; i++) { const r = Math.floor(i / C); if ((r < R / 2) === front) { s += stand[i]; n++; } } return s / n; };
    const ready = () => { for (let i = 0; i < N; i++) if (!stand[i] && seenShare(i) >= th[i]) return true; return false; };
    const sim = {
      params: p, rows: R, cols: C, n: N, enjoy, th, stand, at, starter, vis, seenBy, nStarters: k, step: 0, done: false,
      history: [count() / N], front: [half(true)], back: [half(false)],
      share() { return sim.history[sim.history.length - 1]; },
      seenShare,
      advance() {
        if (sim.done) return false;
        const go = [];
        for (let i = 0; i < N; i++) if (!stand[i] && rng() < p.react && seenShare(i) >= th[i]) go.push(i);
        sim.step++;
        go.forEach((i) => { stand[i] = 1; at[i] = sim.step; });
        sim.history.push(count() / N); sim.front.push(half(true)); sim.back.push(half(false));
        if (!ready() || sim.step >= p.maxSteps) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    if (!ready()) sim.done = true;   // 아무도 따라 일어설 사람이 없으면 바로 끝
    return sim;
  }

  // 같은 설정으로 여러 번(시드만 바꿔) 돌린 최종 기립 비율
  function finals(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 13 })).run().share());
    return out;
  }

  return { DEFAULTS, create, finals, visibility };
});
