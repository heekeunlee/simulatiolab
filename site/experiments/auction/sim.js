/*
 * 경매에서 이기면 왜 손해일까: 승자의 저주 (Capen, Clapp & Campbell 1971; Thaler 1988)의 공통 가치 경매 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - 그림 한 점의 진짜 가치 V는 모두에게 같지만 아무도 모른다 (경매마다 70~130 사이 무작위)
 *  - 입찰자 n명은 저마다 V에 오차가 섞인 추정치를 받는다: 추정치 = V + 오차, 오차는 평균 0, 표준편차 sigma × 100 (값 100 기준)
 *  - 모두 "추정치 - shade × 오차의 표준편차"를 입찰가로 낸다. shade = 0이면 추정치를 그대로 부르는 순진한 입찰
 *  - 가장 높은 입찰가가 낙찰. 가격은 first = 자기 입찰가, second = 두 번째로 높은 입찰가
 *  - 낙찰자의 손익 = V - 낙찰 가격
 *  - 모두가 같은 만큼 낮추면 낙찰자는 바뀌지 않고 가격만 shade × sigma × 100 만큼 내려가므로, 평균 손익은 shade와 함께 정확히 일차함수로 오른다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Auction = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 10, sigma: 0.2, shade: 0, rule: 'first', rounds: 400, seed: 1, myShade: null };
  const SCALE = 100;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gaussFrom = (rng) => () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };

  // 경매 한 번. 입찰자 0번은 myShade가 있으면 그 값으로, 나머지는 shade로 입찰
  function auctionOnce(p, rng, gauss) {
    const n = p.n, sd = p.sigma * SCALE;
    const V = 70 + 60 * rng();
    const sig = new Array(n), bid = new Array(n);
    let top = -Infinity, ti = -1, second = -Infinity;
    for (let i = 0; i < n; i++) {
      sig[i] = V + sd * gauss();
      const sh = i === 0 && p.myShade != null ? p.myShade : p.shade;
      bid[i] = sig[i] - sh * sd;
      if (bid[i] > top) { second = top; top = bid[i]; ti = i; } else if (bid[i] > second) second = bid[i];
    }
    const price = p.rule === 'second' ? (n > 1 ? second : top) : top;
    return { V, sig, bid, winner: ti, price, profit: V - price, top };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 8191 + 3), gauss = gaussFrom(rng);
    const sim = {
      params: p, round: 0, last: null, sum: 0, losses: 0, history: [], profits: [],
      advance() {
        if (sim.round >= p.rounds) return false;
        const a = auctionOnce(p, rng, gauss); sim.last = a; sim.round++; sim.sum += a.profit; if (a.profit < 0) sim.losses++;
        sim.profits.push(a.profit); sim.history.push(sim.sum / sim.round);
        return true;
      },
      done() { return sim.round >= p.rounds; },
      mean() { return sim.round ? sim.sum / sim.round : 0; },
      lossShare() { return sim.round ? sim.losses / sim.round : 0; },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 많은 경매의 평균 (낙찰자 손익, 손해 본 비율, 내가 이긴 비율과 내 손익). 모양을 그리지 않는 빠른 버전
  function study(opts, auctions, seedBase) {
    const p = Object.assign({}, DEFAULTS, opts), rng = mulberry32((seedBase || 77) * 131 + 5), gauss = gaussFrom(rng);
    let sum = 0, loss = 0, myWins = 0, mySum = 0;
    for (let k = 0; k < auctions; k++) {
      const a = auctionOnce(p, rng, gauss); sum += a.profit; if (a.profit < 0) loss++;
      if (a.winner === 0) { myWins++; mySum += a.profit; }
    }
    return { mean: sum / auctions, lossShare: loss / auctions, myWin: myWins / auctions, myProfit: mySum / auctions };
  }

  // 여러 번의 경매에서 낙찰자 손익 목록 (히스토그램용)
  function profits(opts, auctions, seedBase) {
    const p = Object.assign({}, DEFAULTS, opts), rng = mulberry32((seedBase || 91) * 131 + 7), gauss = gaussFrom(rng), out = new Float64Array(auctions);
    for (let k = 0; k < auctions; k++) out[k] = auctionOnce(p, rng, gauss).profit;
    return out;
  }

  return { DEFAULTS, SCALE, create, study, profits, auctionOnce };
});
