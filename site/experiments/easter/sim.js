/*
 * 이스터섬은 왜 몰락했을까: 자원-인구 과잉 성장(overshoot) 모델
 * Brander & Taylor (1998), "The Simple Economics of Easter Island", American Economic Review 88(1)의 발상을 단순화한 이 프로젝트의 구현이다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조 (시간 단위: 년)
 *  - R: 숲(재생 가능한 자원), 섬이 감당할 수 있는 최대치를 1로 둔다. 로지스틱으로 자라고 사람이 베어 간다
 *      dR/dt = regrowth * R * (1 - R) - harvest * (1 - conservation) * P * R
 *  - P: 인구(명). 숲에서 얻는 먹거리가 충분하면 늘고 모자라면 준다. 아이가 자라 일손이 되기까지 시간이 걸려서
 *    인구는 "숲의 최근 평균"에 반응한다 (평균을 내는 기간 = delay년)
 *      dP/dt = P * (growth * R_avg - death)
 *  - conservation: 숲을 지키려고 줄인 벌채 비율 (0 = 제한 없음)
 *  - 인구가 1명 아래로 내려가면 사라진 것으로 본다
 *  - 균형점(수치로 확인): R* = death / growth,  P* = regrowth * (1 - R*) / (harvest * (1 - conservation))
 *    벌채 강도와 보존율은 P*의 크기(섬이 감당하는 인구)만 바꾸고, 시간에 따른 모양은 growth·regrowth·delay가 정한다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Easter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = {
    regrowth: 0.01,       // 숲이 다시 자라는 속도 (1/년)
    harvest: 2e-6,        // 한 사람이 숲에 주는 부담(벌채 강도, 1/(명·년))
    growth: 0.05,         // 숲이 온전할 때 인구가 늘어나는 속도 (1/년)
    conservation: 0,      // 0~1
    death: 0.03,          // 죽는 속도 (1/년)
    delay: 30,            // 인구가 숲의 상태에 반응하는 데 걸리는 시간(년)
    years: 600, p0: 50, dt: 0.25, yearsPerStep: 5,
  };

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    let R = 1, P = p.p0, Ra = 1, t = 0;
    const Rstar = p.death / p.growth;
    const sim = {
      params: p, years: p.years, Rstar, Pstar: p.regrowth * (1 - Rstar) / (p.harvest * (1 - p.conservation)), step: 0, done: false,
      R: [R], P: [P], peakP: P, peakYear: 0, minR: 1, extinct: false,
      advance() {
        if (sim.done) return false;
        const sub = Math.round(p.yearsPerStep / p.dt);
        for (let i = 0; i < sub; i++) {
          const harvest = p.harvest * (1 - p.conservation);
          const dR = p.regrowth * R * (1 - R) - harvest * P * R;
          const dP = P * (p.growth * Ra - p.death);
          const dRa = (R - Ra) / p.delay;
          R = Math.min(1, Math.max(0, R + dR * p.dt)); P = Math.max(0, P + dP * p.dt); Ra += dRa * p.dt; t += p.dt;
          if (P < 1) { P = 0; sim.extinct = true; }
        }
        sim.step++;
        sim.R.push(R); sim.P.push(P);
        if (P > sim.peakP) { sim.peakP = P; sim.peakYear = t; }
        if (R < sim.minR) sim.minR = R;
        if (t >= p.years - 1e-9) sim.done = true;
        return true;
      },
      year() { return Math.round(t); },
      current() { return { R, P, t }; },
      run() { while (sim.advance()); return sim; },
      summary() {
        const last = sim.P[sim.P.length - 1], ratio = sim.peakP > 0 ? last / sim.peakP : 0;
        let outcome = 'stable';      // 마지막 인구가 최고점의 70% 이상이면 안정, 25% 이상이면 감소, 그보다 낮으면 붕괴
        if (sim.extinct || ratio < 0.25) outcome = 'collapse';
        else if (ratio < 0.7) outcome = 'decline';
        return { peak: sim.peakP, peakYear: sim.peakYear, final: last, finalR: sim.R[sim.R.length - 1], minR: sim.minR, ratio, outcome, extinct: sim.extinct };
      },
    };
    return sim;
  }

  function outcomeOf(opts) { return create(opts).run().summary(); }

  return { DEFAULTS, create, outcomeOf };
});
