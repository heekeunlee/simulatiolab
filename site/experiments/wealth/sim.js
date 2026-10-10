/*
 * 부의 쏠림: 야드세일(yard-sale) 교환 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - 모두 같은 재산(1)으로 시작한다
 *  - 한 라운드에 n번, 무작위로 두 사람을 골라 거래시킨다
 *  - 판돈 = 두 사람 중 가난한 쪽 재산 x stake. (가난한 쪽이 파산하지 않게 하는 규칙)
 *  - 동전 던지기로 이긴 쪽이 판돈을 가져간다. 기본은 정확히 50:50 (완전히 공정한 거래)
 *  - bias > 0 이면 재산이 많은 쪽이 이길 확률이 조금 높다: 0.5 + bias * (부자-가난) / (부자+가난)
 *  - 라운드가 끝날 때마다 모든 사람이 재산의 tax 비율을 내고, 모인 돈을 똑같이 나눠 가진다 (재분배)
 *  총 재산은 늘 일정하다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Wealth = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 1000, stake: 0.2, tax: 0, bias: 0, rounds: 300, seed: 1, tracked: 8 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 지니계수와 로렌츠 곡선용 정렬 배열
  function inequality(w) {
    const n = w.length, s = Float64Array.from(w).sort();
    let total = 0, weighted = 0;
    for (let i = 0; i < n; i++) { total += s[i]; weighted += (i + 1) * s[i]; }
    const gini = (2 * weighted) / (n * total) - (n + 1) / n;
    const share = (frac) => { // 상위 frac 비율이 가진 몫
      const k = Math.max(1, Math.round(n * frac)); let sum = 0;
      for (let i = n - k; i < n; i++) sum += s[i];
      return sum / total;
    };
    let bottom = 0; for (let i = 0; i < Math.floor(n / 2); i++) bottom += s[i];
    return { gini, top1: share(0.01), top10: share(0.1), bottom50: bottom / total, sorted: s, total };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed);
    const n = p.n;
    const wealth = new Float64Array(n).fill(1);
    const history = new Float64Array((p.rounds + 1) * n);
    history.set(wealth, 0);
    // 추적할 사람 (처음엔 모두 같은 재산)
    const tracked = [];
    while (tracked.length < Math.min(p.tracked, n)) {
      const i = Math.floor(rng() * n);
      if (!tracked.includes(i)) tracked.push(i);
    }

    const sim = {
      params: p, n, wealth, history, tracked, round: 0, done: false, stats: [],

      advance() {
        if (sim.done) return false;
        for (let k = 0; k < n; k++) {
          const i = Math.floor(rng() * n);
          let j = Math.floor(rng() * (n - 1)); if (j >= i) j++;
          const wi = wealth[i], wj = wealth[j];
          const bet = p.stake * Math.min(wi, wj);
          const rich = wi >= wj ? i : j, poor = rich === i ? j : i;
          const sum = wi + wj;
          const pRich = sum > 0 ? 0.5 + p.bias * (wealth[rich] - wealth[poor]) / sum : 0.5;
          if (rng() < pRich) { wealth[rich] += bet; wealth[poor] -= bet; }
          else { wealth[rich] -= bet; wealth[poor] += bet; }
        }
        if (p.tax > 0) {
          let pool = 0;
          for (let i = 0; i < n; i++) { const t = wealth[i] * p.tax; wealth[i] -= t; pool += t; }
          const each = pool / n;
          for (let i = 0; i < n; i++) wealth[i] += each;
        }
        sim.round++;
        history.set(wealth, sim.round * n);
        const q = inequality(wealth);
        sim.stats.push({ gini: q.gini, top1: q.top1, top10: q.top10, bottom50: q.bottom50 });
        if (sim.round >= p.rounds) sim.done = true;
        return true;
      },

      current() { return inequality(wealth); },
      run() { while (sim.advance()); return sim; },
    };
    const q0 = inequality(wealth);
    sim.stats.push({ gini: q0.gini, top1: q0.top1, top10: q0.top10, bottom50: q0.bottom50 });
    return sim;
  }

  // 같은 설정으로 여러 번 돌려 최종 지니계수 목록
  function finalGini(opts, runs, seedBase) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (seedBase || 500) + k })).run().current().gini);
    return out;
  }

  return { DEFAULTS, create, inequality, finalGini };
});
