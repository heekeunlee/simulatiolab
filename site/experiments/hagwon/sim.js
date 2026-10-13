/*
 * 선행학습 딜레마: 한 집만 학원을 더 보내면 이득인데, 모두가 보내면 왜 순위는 그대로이고 비용만 늘까?
 * 순위재(positional good) 개념 (Hirsch 1976, Social Limits to Growth; Frank의 'positional goods' 논의)과
 * 죄수의 딜레마형 게임(대칭 N인 게임의 내쉬균형)을 이 프로젝트가 단순화한 구현이다. 예시 숫자이며 실제 통계가 아니다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 모델: 아이 n명(가구 n개). 아이마다 학원 없이 얻을 점수 base = 기본 실력(표준정규) + 운(sdLuck)이 있다.
 *  - 가구는 학원을 e개(0..cap) 보낸다. 점수 = base + beta * e.
 *  - 상대평가('rel'): 결과 = 순위(나보다 점수가 낮은 아이의 비율, 0~1). 순위는 서로 맞바꾸는 값이다.
 *  - 절대평가('abs'): 결과 = 합격선(고정)을 넘을 가능성 = 로지스틱((점수 - 합격선) / tau).
 *  - 가구의 이득 = 결과 - cost * e  (cost = 학원 한 개 비용, 결과 1 = 최상위의 가치 대비 비율)
 * 동역학: 매 라운드 일부 가구가 (1) 자기보다 결과가 좋은 이웃이 학원을 더 보내면 한 단계 따라 올리거나 (모방),
 *  (2) 한 단계 바꿔 보고 이득이 늘면 그대로 둔다 (시도). 모두 직전 라운드의 상태를 보고 동시에 정한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Hagwon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 300, beta: 0.3, cost: 0.04, cap: 5, mode: 'rel', K: 5, sdLuck: 0.5, cutoff: 0.6, tau: 0.4, rounds: 100, revise: 0.25, imitate: 0.4, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const logistic = (x) => 1 / (1 + Math.exp(-x));
  function erf(x) { // Abramowitz-Stegun 7.1.26
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  const sigma = (p) => Math.sqrt(1 + p.sdLuck * p.sdLuck); // 학원 없이 얻을 점수의 표준편차

  // ---------- 이론값 (모든 가구가 같은 수준 e를 쓸 때, 아이 수가 아주 많다고 보고) ----------
  function expectNormal(f, mu, sd) { // 정규분포 기댓값 (구간 합)
    let s = 0; const h = 0.05;
    for (let z = -6; z <= 6; z += h) s += f(mu + sd * z) * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) * h;
    return s;
  }
  // 모두가 e일 때: 평균 결과, 혼자 한 개 더 보냈을 때 평균 이득, 가구당 순이득
  function symmetric(p, e) {
    p = Object.assign({}, DEFAULTS, p);
    const sg = sigma(p), mu = p.beta * e;
    let outcome, gainOne;
    if (p.mode === 'rel') { outcome = 0.5; gainOne = Phi(p.beta / (sg * Math.SQRT2)) - 0.5; }
    else {
      const L = (s) => logistic((s - p.cutoff) / p.tau);
      outcome = expectNormal(L, mu, sg);
      gainOne = expectNormal((s) => L(s + p.beta) - L(s), mu, sg);
    }
    return { outcome, gainOne, net: outcome - p.cost * e, costTotal: p.cost * e };
  }
  // 모두가 같은 수준을 쓰는 균형 근사: 한 개 더 보내는 이득이 비용보다 큰 동안 올린다 (평균 가구 기준)
  function equilibriumLevel(p) {
    p = Object.assign({}, DEFAULTS, p);
    let e = 0; while (e < p.cap && symmetric(p, e).gainOne > p.cost) e++;
    return e;
  }

  // ---------- 시뮬레이션 ----------
  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 7919 + 17), n = p.n, c = p.cost, cap = Math.min(p.cap, p.K), beta = p.beta;
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const base = new Float64Array(n), e = new Int8Array(n), score = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      base[i] = gauss() + p.sdLuck * gauss();
      const r = rng(); e[i] = Math.min(cap, r < 0.3 ? 0 : r < 0.7 ? 1 : 2); // 처음엔 학원을 0~2개 보낸다 (평균 약 1개)
    }
    let sorted = new Float64Array(n);
    const sim = { params: p, round: 0, base, e, score, rank0: null, out0: null, meanE: [], outcome: [], net: [], shares: [], moved: [] };

    const lower = (s) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < s) lo = m + 1; else hi = m; } return lo; };
    // 점수 s'를 얻었을 때의 결과 (자기 자신은 빼고 센다)
    const outcomeAt = (own, s2) => (p.mode === 'rel' ? (lower(s2) - (own < s2 ? 1 : 0)) / (n - 1) : logistic((s2 - p.cutoff) / p.tau));
    function refresh() { for (let i = 0; i < n; i++) score[i] = base[i] + beta * e[i]; sorted.set(score); sorted.sort(); }
    sim.outcomes = () => { refresh(); const o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = outcomeAt(score[i], score[i]); return o; };
    sim.line = () => (p.mode === 'rel' ? (refresh(), (sorted[(n >> 1) - 1] + sorted[n >> 1]) / 2) : p.cutoff); // 위쪽 절반 선(상대) 또는 합격선(절대)
    // 지금 상태에서 한 개 더 보냈을 때 가구 평균 이득 (cap 안에서)
    sim.marginal = () => {
      refresh(); let s = 0, k = 0;
      for (let i = 0; i < n; i++) { if (e[i] >= cap) continue; s += outcomeAt(score[i], score[i] + beta) - outcomeAt(score[i], score[i]); k++; }
      return k ? s / k : 0;
    };
    function record() {
      const o = sim.outcomes(); let me = 0, mo = 0; const sh = new Array(p.K + 1).fill(0);
      for (let i = 0; i < n; i++) { me += e[i]; mo += o[i]; sh[e[i]]++; }
      me /= n; mo /= n;
      sim.meanE.push(me); sim.outcome.push(mo); sim.net.push(mo - c * me); sim.shares.push(sh.map((v) => v / n));
      if (!sim.rank0) { sim.rank0 = o; }
      return o;
    }
    sim.change = () => { // 처음보다 결과가 오른/내린 가구의 비율, 평균 변화
      const o = sim.outcomes(); let up = 0, dn = 0, d = 0;
      for (let i = 0; i < n; i++) { const x = o[i] - sim.rank0[i]; d += x; if (x > 0.01) up++; else if (x < -0.01) dn++; }
      return { up: up / n, down: dn / n, mean: d / n };
    };
    sim.advance = function () {
      if (sim.round >= p.rounds) return false;
      refresh();
      const o = new Float64Array(n), pay = new Float64Array(n);
      for (let i = 0; i < n; i++) { o[i] = outcomeAt(score[i], score[i]); pay[i] = o[i] - c * e[i]; }
      const ne = Int8Array.from(e); let moved = 0;
      for (let i = 0; i < n; i++) {
        if (rng() >= p.revise) continue;
        if (rng() < p.imitate) { // 모방: 나보다 결과가 좋은 이웃이 학원을 더 보내면 한 단계 따라 한다
          let j = Math.floor(rng() * (n - 1)); if (j >= i) j++;
          if (o[j] > o[i] && e[j] > e[i] && e[i] < cap) ne[i] = e[i] + 1;
        } else { // 시도: 한 단계 바꿔 보고 이득이 늘면 그대로 둔다
          const e2 = e[i] + (rng() < 0.5 ? -1 : 1);
          if (e2 < 0 || e2 > cap) continue;
          const pay2 = outcomeAt(score[i], base[i] + beta * e2) - c * e2;
          if (pay2 > pay[i] + 1e-9) ne[i] = e2;
        }
        if (ne[i] !== e[i]) moved++;
      }
      e.set(ne); sim.round++; record(); sim.moved.push(moved);
      return true;
    };
    sim.done = () => sim.round >= p.rounds;
    sim.run = () => { while (sim.advance()); return sim; };
    record(); // 라운드 0 (처음 상태)
    sim.round = 0;
    return sim;
  }

  return { DEFAULTS, create, symmetric, equilibriumLevel, sigma, Phi };
});
