/*
 * 착한 사람은 살아남을까: 반복 죄수의 딜레마에서 협력의 진화
 * (Axelrod 1984의 대회, Axelrod & Hamilton 1981, Nowak & Sigmund 1993의 발상. 이 프로젝트의 구현)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 사람 n명이 다섯 가지 전략 중 하나를 쓴다
 *      0 항상 협력, 1 항상 배신, 2 맞받아치기(처음엔 협력, 이후 상대의 지난 수를 따라 함),
 *      3 너그러운 맞받아치기(상대가 배신해도 10%는 용서하고 협력), 4 파블로프(지난 판에 둘이 같은 수를 냈으면 협력, 아니면 배신)
 *  - 한 세대에 모두가 무작위 상대 partners명과 각각 rounds판씩 겨룬다. 협력/배신 점수: 서로 협력 R=3, 서로 배신 P=1,
 *    내가 배신하고 상대가 협력 T(유혹, 기본 5), 내가 협력하고 상대가 배신 S=0
 *  - 실수: 낸 수가 확률 noise로 반대로 바뀐다
 *  - 판당 평균 점수가 "적응도". 세대가 끝나면 모두가 무작위 한 명을 보고, 그 사람의 점수가 더 높을수록 높은 확률(페르미 규칙)로 그 전략을 따라 한다.
 *    아주 작은 확률 mutation으로 무작위 전략으로 바뀐다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cooperation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 240, defectors: 0.5, noise: 0.02, rounds: 10, T: 5, partners: 6, generations: 150, mutation: 0.01, K: 0.4, seed: 1 };
  const NAMES = ['항상 협력', '항상 배신', '맞받아치기', '너그러운 맞받아치기', '파블로프'];
  const C = 0, D = 1;

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
    const rng = mulberry32(p.seed * 97 + 5), n = p.n;
    let strat = new Uint8Array(n);
    const nD = Math.round(p.defectors * n), rest = n - nD;
    for (let i = 0; i < n; i++) strat[i] = i < nD ? 1 : [0, 2, 3, 4][Math.floor(((i - nD) * 4) / rest)];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = strat[i]; strat[i] = strat[j]; strat[j] = t; }
    const R = 3, P = 1, S = 0, T = p.T;
    const pay = (a, b) => (a === C ? (b === C ? R : S) : (b === C ? T : P));
    const intend = (s, my, opp) => {
      if (my < 0) return s === 1 ? D : C;
      if (s === 0) return C; if (s === 1) return D; if (s === 2) return opp;
      if (s === 3) return opp === D ? (rng() < 0.1 ? C : D) : C;
      return my === opp ? C : D; // 파블로프
    };
    const flip = (m) => (rng() < p.noise ? 1 - m : m);

    const sim = {
      params: p, n, get strat() { return strat; }, gen: 0, done: false, history: [], coopHistory: [], payHistory: [],
      shares() { const c = [0, 0, 0, 0, 0]; for (let i = 0; i < n; i++) c[strat[i]]++; return c.map((x) => x / n); },
      advance() {
        if (sim.done) return false;
        const pts = new Float64Array(n), games = new Float64Array(n); let cMoves = 0, moves = 0;
        for (let i = 0; i < n; i++) for (let k = 0; k < p.partners; k++) {
          let j = Math.floor(rng() * (n - 1)); if (j >= i) j++;
          let mi = -1, mj = -1, si = 0, sj = 0;
          for (let r = 0; r < p.rounds; r++) {
            const ai = flip(intend(strat[i], mi, mj)), aj = flip(intend(strat[j], mj, mi));
            si += pay(ai, aj); sj += pay(aj, ai); mi = ai; mj = aj; if (ai === C) cMoves++; if (aj === C) cMoves++; moves += 2;
          }
          pts[i] += si; pts[j] += sj; games[i] += p.rounds; games[j] += p.rounds;
        }
        const fit = new Float64Array(n); let avg = 0;
        for (let i = 0; i < n; i++) { fit[i] = games[i] ? pts[i] / games[i] : 0; avg += fit[i]; }
        sim.coopHistory.push(cMoves / moves); sim.payHistory.push(avg / n);
        const next = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          let j = Math.floor(rng() * (n - 1)); if (j >= i) j++;
          next[i] = rng() < 1 / (1 + Math.exp(-(fit[j] - fit[i]) / p.K)) ? strat[j] : strat[i];
          if (rng() < p.mutation) next[i] = Math.floor(rng() * 5);
        }
        strat = next; sim.gen++; sim.history.push(sim.shares());
        if (sim.gen >= p.generations) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    sim.history.push(sim.shares());
    return sim;
  }

  // 같은 설정으로 여러 번 돌려 마지막 20세대의 평균 협력률과 전략 비율을 얻는다
  function measure(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 19 })).run();
      const tail = Math.min(20, s.coopHistory.length), a = s.coopHistory.slice(-tail);
      const sh = [0, 0, 0, 0, 0]; s.history.slice(-tail).forEach((h) => h.forEach((v, i) => { sh[i] += v / tail; }));
      out.push({ coop: a.reduce((x, y) => x + y, 0) / tail, shares: sh });
    }
    return out;
  }

  return { DEFAULTS, NAMES, create, measure };
});
