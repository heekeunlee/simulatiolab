/*
 * 저출산이 계속되면 인구 구조는? : 코호트 요인법(cohort-component) 인구 추계의 단순 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 주의: 통계청 공식 추계가 아니라 구조를 보여 주는 단순 모델이다.
 *  - 나이는 0~100세(100은 100세 이상) 한 살 단위, 남녀는 합쳐서 계산하고 출산 계산에만 "각 연령의 절반이 여성"이라고 가정한다
 *  - 2024년 연령 구조는 "근사"다: 공표된 연령대 비중(0~14세 약 10.6%, 15~64세 약 70.2%, 65세 이상 약 19.2%, 총인구 약 5,170만 명)에
 *    맞추어 크기를 조정했고, 각 연령대 안의 모양은 연도별 출생아 수(대략값)와 생존율로 만든 추정이다 (연령별 공식 통계가 아님)
 *  - 출산: 합계출산율 tfr을 15~49세 여성의 연령별 출산율 곡선(평균 32.5세, 표준편차 4.5)에 나눠 적용한다
 *  - 사망: 연령별 사망확률 q(x) = min(1, 0.0002 + A * exp(0.1 x)), 영아(0세)는 0.002. A는 그 해의 기대수명이 되도록 맞춘다
 *  - 기대수명은 e0에서 시작해 10년마다 lifeGain년씩 늘어난다
 *  - 순이민은 해마다 migration명이 20~39세에 균등하게 더해지거나(양수) 빠진다(음수)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Population = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { tfr: 0.72, migration: 0, lifeGain: 1, e0: 83.5, startYear: 2024, endYear: 2070 };
  const AGES = 101;
  const START_TOTAL = 51.7e6;
  const SHARES = { young: 0.106, work: 0.702, old: 0.192 };   // 2024년 0~14 / 15~64 / 65+ 비중 (공표된 값으로 맞춤)

  // 연도별 출생아 수(천 명), 대략값. 시작 연령 구조의 모양을 만드는 데만 쓴다
  const BIRTHS = [[1924, 500], [1935, 600], [1945, 700], [1955, 800], [1960, 1000], [1971, 1020], [1975, 870], [1980, 860], [1985, 660], [1990, 650],
    [1995, 720], [2000, 640], [2002, 490], [2005, 440], [2010, 470], [2012, 480], [2016, 410], [2018, 330], [2020, 270], [2022, 250], [2023, 230], [2024, 240]];
  function birthsIn(y) {
    for (let i = 1; i < BIRTHS.length; i++) if (y <= BIRTHS[i][0]) { const [y0, b0] = BIRTHS[i - 1], [y1, b1] = BIRTHS[i]; return (b0 + ((b1 - b0) * (y - y0)) / (y1 - y0)) * 1000; }
    return BIRTHS[BIRTHS.length - 1][1] * 1000;
  }

  // 기대수명 e0가 되도록 맞춘 생존확률 s(x) = 1 - q(x)
  function survival(e0) {
    const q = (x, A) => (x === 0 ? 0.002 : Math.min(1, 0.0002 + A * Math.exp(0.1 * x)));
    const life = (A) => { let l = 1, sum = 0; for (let x = 0; x < 130; x++) { const nl = l * (1 - q(x, A)); sum += (l + nl) / 2; l = nl; } return sum; };
    let lo = 1e-9, hi = 1e-2;
    for (let k = 0; k < 60; k++) { const mid = Math.sqrt(lo * hi); if (life(mid) > e0) lo = mid; else hi = mid; }
    const A = Math.sqrt(lo * hi), s = new Float64Array(AGES);
    for (let x = 0; x < AGES; x++) s[x] = 1 - q(x, A);
    return s;
  }

  const ASFR = (() => {
    const w = new Float64Array(AGES); let sum = 0;
    for (let a = 15; a <= 49; a++) { w[a] = Math.exp(-0.5 * ((a - 32.5) / 4.5) ** 2); sum += w[a]; }
    for (let a = 15; a <= 49; a++) w[a] /= sum;
    return w;
  })();

  // 2024년 연령 구조 (근사)
  function startPopulation(e0) {
    const s = survival(e0), pop = new Float64Array(AGES);
    let cum = 1;
    for (let a = 0; a < AGES; a++) {
      if (a > 0) cum *= s[a - 1];
      pop[a] = birthsIn(2024 - a) * cum;
    }
    const sum = (lo, hi) => { let t = 0; for (let a = lo; a <= hi; a++) t += pop[a]; return t; };
    const k = { young: START_TOTAL * SHARES.young / sum(0, 14), work: START_TOTAL * SHARES.work / sum(15, 64), old: START_TOTAL * SHARES.old / sum(65, 100) };
    for (let a = 0; a < AGES; a++) pop[a] *= a <= 14 ? k.young : a <= 64 ? k.work : k.old;
    return pop;
  }

  function summary(pop) {
    let total = 0, young = 0, work = 0, old = 0;
    for (let a = 0; a < AGES; a++) { total += pop[a]; if (a <= 14) young += pop[a]; else if (a <= 64) work += pop[a]; else old += pop[a]; }
    let acc = 0, median = 0;
    for (let a = 0; a < AGES; a++) { acc += pop[a]; if (acc >= total / 2) { median = a + (acc - total / 2 <= pop[a] ? 1 - (acc - total / 2) / pop[a] : 0); break; } }
    return { total, young, work, old, shareOld: old / total, shareWork: work / total, shareYoung: young / total, oldDep: old / work, median };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const pop = startPopulation(p.e0);
    const sim = {
      params: p, pop, start: Float64Array.from(pop), year: p.startYear, done: false, history: [], births: [], lastBirths: 0,
      advance() {
        if (sim.done) return false;
        const yrs = sim.year - p.startYear;
        const s = survival(Math.min(100, p.e0 + (p.lifeGain * yrs) / 10));
        let births = 0;
        for (let a = 15; a <= 49; a++) births += pop[a] * 0.5 * ASFR[a] * p.tfr;
        const nx = new Float64Array(AGES);
        nx[0] = births * s[0];
        for (let a = 1; a < AGES; a++) nx[a] = pop[a - 1] * s[a - 1];
        nx[AGES - 1] += pop[AGES - 1] * s[AGES - 1];
        for (let a = 20; a <= 39; a++) nx[a] = Math.max(0, nx[a] + p.migration / 20);
        pop.set(nx);
        sim.year++; sim.lastBirths = births; sim.births.push(births);
        sim.history.push(Object.assign({ year: sim.year }, summary(pop)));
        if (sim.year >= p.endYear) sim.done = true;
        return true;
      },
      summary() { return summary(pop); },
      run() { while (sim.advance()); return sim; },
    };
    sim.history.push(Object.assign({ year: p.startYear }, summary(pop)));
    return sim;
  }

  // 시나리오를 끝까지 계산해 연도별 요약을 돌려준다
  function project(opts) { return create(opts).run().history; }

  return { DEFAULTS, AGES, START_TOTAL, SHARES, create, project, survival, summary };
});
