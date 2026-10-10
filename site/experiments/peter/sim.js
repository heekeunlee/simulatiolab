/*
 * 피터의 원리 모델 (Pluchino, Rapisarda, Garofalo 2010, "The Peter principle revisited")를 단순화한 구현
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 6단계 피라미드 조직: 위에서부터 1, 5, 11, 21, 41, 81명 (160명)
 *  - 모든 사람은 능력(0~10, 평균 7, 표준편차 2)과 나이를 가진다. 60세가 되면 은퇴하고 빈자리가 생긴다
 *  - 빈자리는 바로 아래 단계 사람 중 한 명을 승진시켜 채운다. 맨 아래는 신입이 채운다
 *  - 승진 방식: 최고 능력자 / 최저 능력자 / 무작위 / 번갈아(최고, 최저, 최고 ...)
 *  - 승진한 사람의 새 직무 능력: 확률 continuity로 예전 능력 유지, 아니면 완전히 새로 뽑힘
 *    (continuity=1: 상식 가설 "일 잘하면 승진해도 잘한다", continuity=0: 피터 가설 "새 직무 능력은 별개")
 *  - 조직 효율 = 단계별 평균 능력의 가중 평균 (위 단계일수록 영향이 커서 가중치 6,5,4,3,2,1)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Peter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SIZES = [1, 5, 11, 21, 41, 81];
  const WEIGHTS = [6, 5, 4, 3, 2, 1];
  const DEFAULTS = { strategy: 'best', continuity: 0, years: 60, seed: 1 };

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
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const fresh = () => Math.min(10, Math.max(0, 7 + 2 * gauss()));
    const levels = SIZES.map((n) => Array.from({ length: n }, () => ({ c: fresh(), age: 25 + Math.floor(rng() * 35) })));
    let flip = 0;

    function efficiency() {
      let s = 0, w = 0;
      levels.forEach((L, l) => { const m = L.reduce((a, x) => a + x.c, 0) / L.length; s += WEIGHTS[l] * m; w += WEIGHTS[l]; });
      return s / w;
    }
    function levelMeans() { return levels.map((L) => L.reduce((a, x) => a + x.c, 0) / L.length); }

    const sim = {
      params: p, levels, year: 0, done: false, promotions: 0, history: [efficiency()], levelMeans,
      efficiency,
      advance() {
        if (sim.done) return false;
        sim.year++;
        const vac = SIZES.map(() => 0);
        levels.forEach((L, l) => {
          L.forEach((x) => { x.age++; });
          const keep = L.filter((x) => x.age < 60);
          vac[l] = L.length - keep.length; levels[l] = keep;
        });
        for (let l = 0; l < levels.length; l++) {
          while (vac[l] > 0) {
            if (l === levels.length - 1) { levels[l].push({ c: fresh(), age: 22 + Math.floor(rng() * 6) }); }
            else {
              const pool = levels[l + 1];
              if (!pool.length) break;
              let k = 0;
              const best = () => pool.reduce((b, x, i) => (x.c > pool[b].c ? i : b), 0);
              const worst = () => pool.reduce((b, x, i) => (x.c < pool[b].c ? i : b), 0);
              if (p.strategy === 'best') k = best();
              else if (p.strategy === 'worst') k = worst();
              else if (p.strategy === 'random') k = Math.floor(rng() * pool.length);
              else { k = flip % 2 === 0 ? best() : worst(); flip++; }
              const [person] = pool.splice(k, 1);
              if (rng() >= p.continuity) person.c = fresh();
              levels[l].push(person); vac[l + 1]++; sim.promotions++;
            }
            vac[l]--;
          }
        }
        sim.history.push(efficiency());
        if (sim.year >= p.years) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  function finalEfficiency(opts, runs, seedBase) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (seedBase || 300) + k })).run().efficiency());
    return out;
  }

  return { SIZES, WEIGHTS, DEFAULTS, create, finalEfficiency };
});
