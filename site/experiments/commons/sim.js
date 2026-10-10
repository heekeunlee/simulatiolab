/*
 * 공유지의 비극은 피할 수 없을까: 공유 자원 게임 (Hardin 1968, Ostrom 1990에서 발상)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 공유 자원(물고기 떼, 목초지) 저량 S (수용력 K=100). 한 라운드에 로지스틱으로 다시 자란다: S += r*S*(1 - S/K), r=0.4
 *  - 이용자 n명이 라운드마다 노력량 e를 정해 수확한다. 전체 수확 비율 h = 노력량의 합 (최대 0.95). 한 사람의 수확 = e*S (노력량에 비례)
 *    저량 전체가 알맞게 재생되는 노력(지속 가능한 총노력)은 r/2 = 0.2. 이용자 수와 상관없이 총 0.2가 되도록 "절제" 노력 = 0.2/n, "탐욕" 노력 = 절제의 greed배 (기본 3배)
 *  - 이득 = 수확 - 노력 비용 (노력 1당 비용 cost=25, 저량이 25보다 낮으면 탐욕은 손해)
 *  - 전략 세 가지: 0 탐욕(항상 탐욕 노력), 1 절제(항상 절제 노력), 2 조건부 협력자(지난 라운드에 절제한 사람이 절반 이상이면 절제, 아니면 탐욕)
 *  - 감시: 절제 노력보다 많이 잡은 사람은 확률 monitor로 적발되어 그 라운드 수확의 fine 배(1이면 전부)를 벌금으로 낸다
 *  - 진화: 이득은 최근 이득의 지수 평균(기억 0.8). 라운드마다 각자 확률 learn(기본 0.25)으로 무작위 한 명을 보고, 그 사람의 점수가 더 높을수록 전략을 따라 한다 (페르미 규칙). 아주 작은 확률 mutate로 새 전략이 생긴다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Commons = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NAMES = ['탐욕', '절제', '조건부 협력'];
  const DEFAULTS = { n: 40, monitor: 0, fine: 1, cc: 0.2, restrained: 0.1, rounds: 200, seed: 1, K: 100, r: 0.4, cost: 25, mutate: 0.01, greed: 3, learn: 0.25 };

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
    const rng = mulberry32(p.seed * 211 + 17), n = p.n;
    const eR = (p.r / 2) / n, eG = p.greed * eR;
    const strat = new Uint8Array(n), score = new Float64Array(n), act = new Uint8Array(n), caught = new Uint8Array(n);
    const nR = Math.round(p.restrained * n), nC = Math.round(p.cc * n);
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    order.forEach((idx, k) => { strat[idx] = k < nR ? 1 : k < nR + nC ? 2 : 0; });
    let lastRestrainedShare = (nR + nC) / n;       // 조건부 협력자가 처음 볼 "지난 라운드의 절제 비율"
    const shares = () => { const c = [0, 0, 0]; for (let i = 0; i < n; i++) c[strat[i]]++; return c.map((x) => x / n); };
    const sim = {
      params: p, n, strat, act, caught, S: p.K * 0.8, round: 0, done: false, eR, eG,
      stockHist: [p.K * 0.8], harvestHist: [], shareHist: [shares()], restrainHist: [], fined: 0,
      advance() {
        if (sim.done) return false;
        let E = 0, restrained = 0;
        for (let i = 0; i < n; i++) {
          const restrain = strat[i] === 1 || (strat[i] === 2 && lastRestrainedShare >= 0.5);
          act[i] = restrain ? 0 : 1; E += restrain ? eR : eG; if (restrain) restrained++;
        }
        const scale = E > 0.95 ? 0.95 / E : 1, S = sim.S;
        let total = 0;
        for (let i = 0; i < n; i++) {
          const e = (act[i] ? eG : eR) * scale, catchI = e * S; total += catchI;
          let pay = catchI - p.cost * (act[i] ? eG : eR);
          caught[i] = 0;
          if (act[i] && p.monitor > 0 && rng() < p.monitor) { pay -= p.fine * catchI; caught[i] = 1; sim.fined++; }
          score[i] = 0.8 * score[i] + pay;
        }
        sim.S = Math.max(0.01, S + p.r * S * (1 - S / p.K) - total);
        lastRestrainedShare = restrained / n;
        // 모방(페르미 규칙) + 돌연변이
        const nxt = Uint8Array.from(strat);
        for (let i = 0; i < n; i++) {
          if (rng() < p.mutate) { nxt[i] = Math.floor(rng() * 3); continue; }
          if (rng() < p.learn) {
            const j = Math.floor(rng() * n);
            if (strat[j] !== strat[i] && rng() < 1 / (1 + Math.exp(-(score[j] - score[i]) / 0.5))) nxt[i] = strat[j];
          }
        }
        strat.set(nxt);
        sim.round++; sim.stockHist.push(sim.S); sim.harvestHist.push(total); sim.shareHist.push(shares()); sim.restrainHist.push(lastRestrainedShare);
        if (sim.round >= p.rounds) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
      // 마지막 구간의 평균
      tail(arr, k) { const a = arr.slice(-k); return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); },
      summary() {
        const k = Math.max(10, Math.floor(sim.stockHist.length / 5));
        const sh = sim.shareHist[sim.shareHist.length - 1];
        return { stock: sim.tail(sim.stockHist, k) / p.K, harvest: sim.tail(sim.harvestHist, k), restrain: sim.tail(sim.restrainHist, k), shares: sh };
      },
    };
    return sim;
  }

  function measure(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 9 })).run().summary());
    return out;
  }

  return { NAMES, DEFAULTS, create, measure };
});
