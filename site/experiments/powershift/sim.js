/*
 * 힘이 비슷해질 때 왜 위험할까 (세력 전이의 장난감 모델). 이 프로젝트의 단순화된 설계이며 실제 국가·사건과 무관하다.
 *  - 가상의 두 나라: 지키는 나라(D, 처음 힘 1)와 추격하는 나라(C, 처음 힘 0.4). 해마다 다른 빠르기로 자란다(약간의 흔들림 포함).
 *  - 이길 가능성: w = C^k / (C^k + D^k)  (k = 3). 힘이 비슷할수록 w가 힘의 작은 차이에 민감하다.
 *  - 해마다 확률 mu로 다툼거리가 생긴다. 그때 두 나라는 힘의 비율을 각자 잘못 볼 수 있다:
 *      ln(보이는 비율) = ln(C/D) + e,  e ~ N(0, s)  (두 나라 따로, s = 상대 힘을 모르는 정도)
 *    추격국은 자기가 이길 가능성 wC에 (1+불만)을 곱한 몫을 원하고(전부를 넘지는 못함), 지키는 나라는 자기 눈의 wD에 전쟁 비용 c를 더한 만큼까지 양보할 수 있다.
 *    전쟁 = 원하는 몫 − 비용 > 양보할 수 있는 몫 + 비용 :  min(1, wC(1+d)) − wD > 2c   (war 실험 ①의 협상 실패와 같은 생각)
 *  - '질서 개편': 추격국 힘이 지키는 나라의 60%(미리) 또는 100%(따라잡은 뒤)에 닿는 해부터 불만이 0이 된다(몫을 힘에 맞게 다시 나눔).
 * 브라우저와 Node.js 양쪽에서 같은 파일을 쓴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Powershift = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { g: 2, d: 30, u: 25, reform: 'off', seed: 1, years: 100, runs: 100, c0: 0.4, gD: 0.015, sg: 0.012, k: 3, cost: 0.2, mu: 0.1, };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rand) { let u = 0, v = 0; while (u === 0) u = rand(); v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const W = (lr, k) => 1 / (1 + Math.exp(-k * lr));   // ln(C/D) → 추격국이 이길 가능성
  function fails(lr, eC, eD, d, P) {
    const wC = W(lr + eC, P.k), wD = W(lr + eD, P.k);
    return Math.min(1, wC * (1 + d)) - wD > 2 * P.cost;
  }
  // 다툼이 전쟁이 될 확률: 추격국의 오차는 문턱을 풀어 정확히(정규분포 누적), 지키는 나라의 오차 eD는 심프슨 적분(120칸)으로.
  //   전쟁 ⇔ wC > (wD + 2c)/(1+d)  (단 wD < 1 − 2c일 때만 가능: 원하는 몫은 전부(1)를 넘지 못한다) → eD의 위 끝을 정확히 자른다
  function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const logit = (p) => Math.log(p / (1 - p));
  function pFail(lr, d, s, P) {
    if (s <= 0) return fails(lr, 0, 0, d, P) ? 1 : 0;
    if (1 - 2 * P.cost <= 0) return 0;
    const lo = -6 * s, hi = Math.min(6 * s, logit(1 - 2 * P.cost) / P.k - lr - 1e-9);
    if (hi <= lo) return 0;
    const N = 120, h = (hi - lo) / N; let acc = 0;
    for (let j = 0; j <= N; j++) {
      const e = lo + j * h, wD = W(lr + e, P.k), need = (wD + 2 * P.cost) / (1 + d);
      const tail = need >= 1 ? 0 : 1 - Phi((logit(need) / P.k - lr) / s);
      const f = tail * Math.exp(-e * e / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
      acc += f * (j === 0 || j === N ? 1 : j % 2 ? 4 : 2);
    }
    return Math.max(0, (acc * h) / 3);
  }
  const norm = (o) => { const P = Object.assign({}, DEFAULTS, o); P.dd = P.d / 100; P.ss = P.u / 100; P.gC = P.gD + P.g / 100; P.rAt = P.reform === 'early' ? 0.6 : P.reform === 'late' ? 1 : 0; return P; };
  // 그 해의 충돌 위험(해마다): 다툼이 생길 확률 × 다툼이 전쟁이 될 확률
  function hazard(lr, d, P) { return P.mu * pFail(lr, d, P.ss, P); }
  const dNow = (P, reformed) => (reformed ? 0 : P.dd);

  // ---------- 100개의 평행 세계 ----------
  function create(opts) {
    const P = norm(opts), R = P.runs, worlds = [];
    for (let i = 0; i < R; i++) {
      const rand = mulberry32((P.seed * 7919 + i * 104729 + 17) >>> 0);
      worlds.push({ rand, C: P.c0, D: 1, reformed: false, war: -1, warRatio: null, cross: -1, ratio: [P.c0], haz: [], C_: [P.c0], D_: [1] });
    }
    const sim = { params: P, t: 0, T: P.years, worlds, wars: 0 };
    sim.advance = function () {
      if (sim.t >= P.years) return false;
      sim.t++;
      worlds.forEach((w) => {
        // 올해의 위험은 해가 시작할 때의 힘으로 정한다
        const lr = Math.log(w.C / w.D);
        if (!w.reformed && P.rAt && w.C / w.D >= P.rAt) w.reformed = true;
        const d = dNow(P, w.reformed);
        if (w.war < 0) {
          w.haz.push(hazard(lr, d, P));
          if (w.rand() < P.mu) { // 다툼거리가 생긴 해
            const eC = gauss(w.rand) * P.ss, eD = gauss(w.rand) * P.ss;
            if (fails(lr, eC, eD, d, P)) { w.war = sim.t; w.warRatio = w.C / w.D; sim.wars++; }
          }
        } else w.haz.push(null);
        w.C *= Math.exp(P.gC + gauss(w.rand) * P.sg); w.D *= Math.exp(P.gD + gauss(w.rand) * P.sg);
        if (w.cross < 0 && w.C >= w.D) w.cross = sim.t;
        w.ratio.push(w.C / w.D); w.C_.push(w.C); w.D_.push(w.D);
      });
      return true;
    };
    sim.done = () => sim.t >= P.years;
    sim.run = function () { while (sim.advance()); return sim; };
    return sim;
  }

  // ---------- 집계 ----------
  // 흔들림 없는 평균 경로로 100년 안에 한 번이라도 충돌할 확률 (계산값)
  function warChance(opts) {
    const P = norm(opts); let lr = Math.log(P.c0), surv = 1, reformed = false, peak = 0, peakR = 0;
    for (let t = 0; t < P.years; t++) {
      if (P.rAt && Math.exp(lr) >= P.rAt) reformed = true;
      const h = hazard(lr, dNow(P, reformed), P); if (h > peak) { peak = h; peakR = Math.exp(lr); }
      surv *= 1 - h; lr += P.gC - P.gD;
    }
    return { p: 1 - surv, peak, peakR, cross: Math.log(1 / P.c0) / ((P.gC - P.gD)) };
  }
  // 힘 비율별 해마다의 위험 곡선 (이론)
  function curve(opts, ratios) { const P = norm(opts); return ratios.map((r) => ({ r, h: hazard(Math.log(r), P.dd, P) })); }
  // 100판 결과 요약 (끝까지 돌린 뒤)
  function summarize(sim) {
    const ws = sim.worlds, war = ws.filter((w) => w.war >= 0), rs = war.map((w) => w.warRatio);
    const band = (lo, hi) => rs.filter((r) => r >= lo && r < hi).length;
    const rel = war.filter((w) => w.cross >= 0).map((w) => w.war - w.cross);
    return { n: ws.length, wars: war.length, near: band(0.8, 1.25), low: band(0, 0.6), high: band(1.67, 99), rs, rel };
  }

  return { DEFAULTS, create, warChance, curve, summarize, hazard, pFail, norm, W, mulberry32 };
});
