/*
 * 무지의 베일 뒤에서 어떤 사회를 고를까: 사고 실험 모델 (Rawls 1971, Harsanyi 1953/1955에서 발상)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 후보 사회 5개. 각 사회는 인구를 소득 순으로 5등분한 "자리"(1분위=가장 가난, 5분위=가장 부유)마다 소득(단위: 임의의 '만원')을 정한다.
 *    사회마다 총소득(평균)이 다르다: 평등할수록 평균이 낮다고 가정했다 (이 가정이 결과를 좌우한다)
 *  - 베일 뒤의 시민은 자기가 어느 자리에 설지 모른다. 자리는 5개 중 같은 확률로 무작위로 정해진다
 *  - 선택 규칙
 *      eu      기대효용 극대화: 효용 u(y)=y^(1-γ)/(1-γ) (γ=1이면 log). γ는 위험 회피 정도 (0이면 평균 극대화, 클수록 최악의 자리를 중시)
 *      avg     평균 소득 극대화 (공리주의적 규칙, γ=0과 같음)
 *      maximin 가장 가난한 자리의 소득 극대화 (롤스의 차등 원칙에 가까운 규칙)
 *  - 기대효용의 순위는 "확실성 등가 소득"(그 효용과 같은 효용을 주는 확정 소득)의 순위와 같아서, 화면에는 확실성 등가를 그린다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Veil = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SOCIETIES = [
    { id: 'equal', inc: [50, 50, 50, 50, 50] },
    { id: 'safety', inc: [40, 48, 58, 72, 96] },
    { id: 'mild', inc: [36, 46, 58, 80, 130] },
    { id: 'pyramid', inc: [22, 36, 56, 96, 230] },
    { id: 'lottery', inc: [6, 24, 62, 130, 330] },
  ];
  const DEFAULTS = { gamma: 1.5, rule: 'eu', popMean: 2, popSd: 1, n: 1000, seed: 1, draws: 120 };

  const mean = (y) => y.reduce((a, b) => a + b, 0) / y.length;
  const minOf = (y) => Math.min.apply(null, y);

  // 확실성 등가 소득
  function ce(inc, g) {
    if (g === 0) return mean(inc);
    if (Math.abs(g - 1) < 1e-9) return Math.exp(mean(inc.map(Math.log)));
    return Math.pow(mean(inc.map((v) => Math.pow(v, 1 - g))), 1 / (1 - g));
  }
  const argmax = (f) => { let b = 0, bv = -Infinity; SOCIETIES.forEach((s, i) => { const v = f(s); if (v > bv + 1e-12) { bv = v; b = i; } }); return b; };
  function choice(rule, g) {
    if (rule === 'avg') return argmax((s) => mean(s.inc));
    if (rule === 'maximin') return argmax((s) => minOf(s.inc));
    return argmax((s) => ce(s.inc, g));
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 위험 회피가 정규분포(평균 mean, 퍼짐 sd, 0 아래는 0으로 자름)인 n명이 각자 고른 사회의 인원수
  function population(mu, sd, n, seed) {
    const rng = mulberry32((seed || 1) * 7919 + 13), counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      let u = 0; while (u === 0) u = rng();
      const g = Math.max(0, mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()));
      counts[choice('eu', g)]++;
    }
    return counts;
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 31 + 5);
    const chosen = choice(p.rule, p.gamma);
    const sim = {
      params: p, chosen, society: SOCIETIES[chosen], step: 0, done: false, positions: [], incomes: [], sum: 0,
      advance() {
        if (sim.done) return false;
        const pos = Math.floor(rng() * 5), y = sim.society.inc[pos];
        sim.positions.push(pos); sim.incomes.push(y); sim.sum += y; sim.step++;
        if (sim.step >= p.draws) sim.done = true;
        return true;
      },
      avgSoFar() { return sim.step ? sim.sum / sim.step : 0; },
      lastPos() { return sim.step ? sim.positions[sim.step - 1] : -1; },
    };
    return sim;
  }

  return { SOCIETIES, DEFAULTS, ce, choice, population, create, mean, minOf };
});
