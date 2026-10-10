/*
 * 아파트 가격은 어떻게 번질까: 이웃 가격 전염과 대출 한도를 담은 단순 공간 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 주의: 장난감 모델이다. 실제 어떤 도시나 지역의 가격 전망, 투자·부동산 조언이 아니다.
 *
 * 구조
 *  - 30x30 격자의 각 칸이 한 "동네". 가격지수는 모두 100에서 시작하고, 한 걸음은 한 분기로 본다
 *  - "소득 기준선" = 100 x 소득지수. 소득지수는 분기마다 incomeGrowth(0.5%)씩 천천히 늘어난다
 *  - 한 걸음의 가격 상승률 g (바로 앞 걸음의 상승률은 gPrev)
 *      g = 0.30 * (내 gPrev) + contagion * (8 이웃 gPrev 평균) + 0.004 * optimism + 무작위 충격(표준편차 0.6%)
 *          - 과열 압력 + 바닥 지지 - 금리 충격
 *    · contagion: 이웃의 최근 상승이 내 상승을 끄는 정도 ("가격 전염", 쏠림)
 *    · optimism: 앞으로도 오를 것이라는 기대의 기본 세기
 *  - 감당 상한 = 소득 기준선 x 대출배수, 대출배수 = (ltv / 0.4)^1.5 (대출 한도 ltv가 클수록 감당 상한이 높아져 더 오를 수 있다)
 *  - 과열 압력: 가격이 감당 상한을 넘으면 넘은 정도(로그)의 25%만큼 상승률이 깎인다
 *  - 바닥 지지: 가격이 소득 기준선 아래로 내려가면 그 정도(로그)의 25%만큼 상승률이 올라간다 (싸지면 사는 사람이 생김)
 *  - 금리 충격(rateStep > 0): 그 걸음부터 대출배수가 30% 줄고, 기대의 기본 세기가 4분의 1로 줄며, 12걸음에 걸쳐 사라지는 하락 압력(최대 -1.2%)이 더해진다
 *  - 처음에 가운데 7x7 칸(hot spot)에서 상승이 시작된다 (gPrev = 0.03)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Apartment = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { size: 30, contagion: 0.6, ltv: 0.6, optimism: 0.5, rateStep: 50, steps: 80, seed: 1, incomeGrowth: 0.005 };
  const HOT = 1.3; // 소득 기준선 대비 30% 넘게 비싸면 "고평가"

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
    const rng = mulberry32(p.seed * 97 + 5), S = p.size, N = S * S;
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const price = new Float64Array(N).fill(100), g = new Float64Array(N), ng = new Float64Array(N);
    const c0 = Math.floor(S / 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (Math.abs(x - c0) <= 3 && Math.abs(y - c0) <= 3) g[y * S + x] = 0.03;
    const sim = {
      params: p, size: S, n: N, price, g, step: 0, income: 1, done: false, history: [], peak: 100, peakStep: 0,
      stats() {
        let sum = 0, hot = 0;
        for (let i = 0; i < N; i++) { sum += price[i]; if (price[i] > HOT * 100 * sim.income) hot++; }
        const mean = sum / N; let v = 0; for (let i = 0; i < N; i++) v += (price[i] - mean) ** 2;
        return { mean, std: Math.sqrt(v / N), cv: Math.sqrt(v / N) / mean, hot: hot / N, income: sim.income * 100 };
      },
      advance() {
        if (sim.done) return false;
        const since = p.rateStep > 0 ? sim.step - p.rateStep : -1, shocked = since >= 0;
        const mult = Math.pow(p.ltv / 0.4, 1.5) * (shocked ? 0.7 : 1);
        const anchor = 100 * sim.income, ceil = anchor * mult;
        const base = 0.004 * p.optimism * (shocked ? 0.25 : 1), drag = shocked ? 0.012 * Math.max(0, 1 - since / 12) : 0;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const i = y * S + x; let s = 0, k = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
            s += g[yy * S + xx]; k++;
          }
          let v = 0.30 * g[i] + p.contagion * (s / k) + base + 0.006 * gauss() - drag;
          if (price[i] > ceil) v -= 0.25 * Math.log(price[i] / ceil);
          if (price[i] < anchor) v += 0.25 * Math.log(anchor / price[i]);
          ng[i] = Math.max(-0.08, Math.min(0.08, v));
        }
        for (let i = 0; i < N; i++) { price[i] *= 1 + ng[i]; g[i] = ng[i]; }
        sim.step++; sim.income *= 1 + p.incomeGrowth;
        const st = sim.stats(); st.ceil = ceil; sim.history.push(st);
        if (st.mean > sim.peak) { sim.peak = st.mean; sim.peakStep = sim.step; }
        if (sim.step >= p.steps) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    const st0 = sim.stats(); st0.ceil = 100 * Math.pow(p.ltv / 0.4, 1.5); sim.history.push(st0);
    return sim;
  }

  // 같은 설정을 여러 번 돌려 정점에서의 번짐 정도 등을 요약
  function summarize(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 7 })).run();
      let peakHot = 0; s.history.forEach((h) => { peakHot = Math.max(peakHot, h.hot); });
      const last = s.history[s.history.length - 1];
      out.push({ peakMean: s.peak, peakHot, final: last.mean, drop: 1 - last.mean / s.peak });
    }
    return out;
  }

  return { DEFAULTS, create, summarize };
});
