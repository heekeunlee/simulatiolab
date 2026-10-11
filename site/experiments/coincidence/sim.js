/*
 * 우연의 일치는 우연이 아니다?: 생일 문제(birthday problem)와 "아주 큰 수의 법칙"을 보여주는 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - 방에 n명이 모인다. 사람마다 k가지 "눈에 띄는 특징"이 있다. 첫째는 생일(365가지, 윤일 무시, 모두 같은 확률),
 *    나머지 k-1가지는 저마다 pool가지 중 하나를 같은 확률로 독립적으로 갖는다 (고향, 취미, 공통 지인 같은 것)
 *  - 두 사람이 특징 하나라도 같으면 "일치한 쌍"이다. 0번 사람이 "나"다
 *  - 이론값: 한 특징에서 n명 모두 다를 확률 = Π(1 - i/c) (i=0..n-1), 특징들은 서로 독립이므로 곱하면
 *    "방 안 누구도 누구와 일치하지 않을 확률"이 정확히 나온다. "나와 일치하는 사람이 있을 확률"은 1 - Π(1-1/c)^(n-1)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Coincidence = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 23, k: 1, pool: 30, rounds: 300, seed: 1 };
  const DAYS = 365;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const sizes = (k, pool) => { const a = [DAYS]; for (let j = 1; j < k; j++) a.push(pool); return a; };
  const pairsOf = (n) => (n * (n - 1)) / 2;

  // ---------- 이론값 ----------
  function pAllDifferent(n, c) { if (n > c) return 0; let p = 1; for (let i = 1; i < n; i++) p *= 1 - i / c; return p; }
  // 방 안에 일치하는 쌍이 하나라도 있을 확률 (특징 k가지 중 어느 것이든)
  function theoryAny(n, k, pool) { let q = 1; sizes(k, pool).forEach((c) => { q *= pAllDifferent(n, c); }); return 1 - q; }
  // 나(0번)와 일치하는 사람이 있을 확률
  function theoryMe(n, k, pool) { let q = 1; sizes(k, pool).forEach((c) => { q *= Math.pow(1 - 1 / c, n - 1); }); return 1 - q; }
  // 한 쌍이 일치할 확률과, 방 안 일치한 쌍의 기댓값
  function pairMatch(k, pool) { let q = 1; sizes(k, pool).forEach((c) => { q *= 1 - 1 / c; }); return 1 - q; }
  const expectedPairs = (n, k, pool) => pairsOf(n) * pairMatch(k, pool);
  // 확률이 target 이상이 되는 가장 작은 인원 (나 말고 몇 명 더 필요한지는 n-1)
  function smallestN(fn, target, max) { for (let n = 2; n <= max; n++) if (fn(n) >= target) return n; return null; }

  // ---------- 방 하나 ----------
  function drawRoom(p, rng) {
    const n = p.n, k = p.k, cs = sizes(k, p.pool), vals = [];
    for (let j = 0; j < k; j++) { const v = new Int32Array(n); for (let i = 0; i < n; i++) v[i] = Math.floor(rng() * cs[j]); vals.push(v); }
    return vals;
  }

  function analyse(vals, n) {
    const map = new Map(), has = new Uint8Array(n);
    vals.forEach((v, j) => {
      const buckets = new Map();
      for (let i = 0; i < n; i++) { const l = buckets.get(v[i]); if (l) l.push(i); else buckets.set(v[i], [i]); }
      buckets.forEach((l) => {
        for (let x = 0; x < l.length; x++) for (let y = x + 1; y < l.length; y++) {
          const key = l[x] * n + l[y], e = map.get(key);
          if (e) e.attrs.push(j); else map.set(key, { a: l[x], b: l[y], attrs: [j] });
          has[l[x]] = 1; has[l[y]] = 1;
        }
      });
    });
    const pairs = Array.from(map.values());
    let meCount = 0; pairs.forEach((q) => { if (q.a === 0) meCount++; });
    return { pairs, has, meCount, people: has.reduce((s, v) => s + v, 0) };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 8191 + 3);
    const sim = {
      params: p, round: 0, last: null, anyN: 0, meN: 0, pairSum: 0, history: [],
      advance() {
        if (sim.round >= p.rounds) return false;
        const vals = drawRoom(p, rng), a = analyse(vals, p.n);
        a.vals = vals; sim.last = a; sim.round++;
        if (a.pairs.length) sim.anyN++;
        if (a.meCount) sim.meN++;
        sim.pairSum += a.pairs.length; sim.history.push(sim.anyN / sim.round);
        return true;
      },
      done() { return sim.round >= p.rounds; },
      anyShare() { return sim.round ? sim.anyN / sim.round : 0; },
      meShare() { return sim.round ? sim.meN / sim.round : 0; },
      meanPairs() { return sim.round ? sim.pairSum / sim.round : 0; },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 많은 방의 비율. 모양은 만들지 않는 빠른 버전.
  // any: 현재 특징 전체로 쌍이 있는 방, me: 현재 특징 전체로 나와 일치하는 사람이 있는 방,
  // anyBday / meBday: 생일 하나만 볼 때
  function study(opts, trials, seedBase) {
    const p = Object.assign({}, DEFAULTS, opts), rng = mulberry32((seedBase || 77) * 131 + 5), n = p.n, cs = sizes(p.k, p.pool);
    let any = 0, me = 0, anyB = 0, meB = 0;
    for (let t = 0; t < trials; t++) {
      let a = false, m = false, aB = false, mB = false;
      for (let j = 0; j < p.k; j++) {
        const v = new Int32Array(n), cnt = new Map();
        for (let i = 0; i < n; i++) { v[i] = Math.floor(rng() * cs[j]); const c = (cnt.get(v[i]) || 0) + 1; cnt.set(v[i], c); }
        cnt.forEach((c) => { if (c > 1) a = true; });
        if (cnt.get(v[0]) > 1) m = true;
        if (j === 0) { aB = a; mB = m; }
      }
      if (a) any++; if (m) me++; if (aB) anyB++; if (mB) meB++;
    }
    return { any: any / trials, me: me / trials, anyBday: anyB / trials, meBday: meB / trials };
  }

  return { DEFAULTS, DAYS, sizes, pairsOf, pAllDifferent, theoryAny, theoryMe, pairMatch, expectedPairs, smallestN, create, study, mulberry32 };
});
