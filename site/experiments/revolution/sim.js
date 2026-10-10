/*
 * 혁명은 어떻게 시작될까: 문턱 모델 (Granovetter 1978, "Threshold Models of Collective Behavior")
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 광장 근처에 사람 n명이 있고, 저마다 "문턱"을 가진다: 광장에 이미 나와 있는 사람이 전체의 이 비율 이상이면 자기도 나선다
 *    (문턱 0이면 아무도 안 나와도 나서는 사람 = 선동가)
 *  - 문턱은 평균 mean, 퍼짐 spread의 정규분포를 0~1로 자른 값이다. 그중 radicals 비율의 사람은 문턱이 0인 선동가다
 *  - mode가 classic이면 문턱이 정확히 0, 1%, 2%, ... (Granovetter의 고전 예시, 100명), missing이면 그중 한 명(문턱 1/n)의 문턱만 2/n으로 바뀐 경우
 *  - 한 라운드마다 "지금 나온 사람의 비율" 이하의 문턱을 가진 사람이 모두 나선다. 더는 늘지 않으면 끝난다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Revolution = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 1000, mean: 0.2, spread: 0.15, radicals: 0.01, seed: 1, mode: 'normal' };

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
    const classic = p.mode === 'classic' || p.mode === 'missing';
    const rng = mulberry32(p.seed * 53 + 9), n = classic ? 100 : p.n;   // 고전 예시는 Granovetter처럼 100명
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const th = new Float64Array(n);
    const nRad = Math.round(p.radicals * n);
    for (let i = 0; i < n; i++) {
      if (p.mode === 'classic') { th[i] = i / n; continue; }                         // 고전 예시: 문턱이 0, 1/n, 2/n, ...
      if (p.mode === 'missing') { th[i] = (i === 1 ? 2 : i) / n; continue; }          // 고전 예시에서 문턱 1/n인 사람 한 명을 2/n으로 바꿈
      if (i < nRad) { th[i] = 0; continue; }
      let t; do { t = p.mean + p.spread * gauss(); } while (t < 0 || t > 1);
      th[i] = Math.max(t, 1e-9);
    }
    // 섞어서 화면에서 선동가가 한곳에 몰리지 않게 한다
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    const threshold = new Float64Array(n); order.forEach((src, i) => { threshold[i] = th[src]; });
    const sorted = Float64Array.from(threshold).sort();

    const out = new Uint8Array(n);      // 광장에 나온 사람
    const joinedAt = new Int16Array(n).fill(-1);
    const sim = {
      params: p, n, nRad: p.mode === 'normal' ? nRad : 1, threshold, out, joinedAt, round: 0, done: false, history: [], path: [0],
      // 문턱이 s 이하인 사람의 비율 = 누적분포 F(s)
      cdf(s) { let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= s) lo = mid + 1; else hi = mid; } return lo / n; },
      share() { let c = 0; for (let i = 0; i < n; i++) c += out[i]; return c / n; },
      advance() {
        if (sim.done) return false;
        const s = sim.share(); let added = 0;
        for (let i = 0; i < n; i++) if (!out[i] && threshold[i] <= s) { out[i] = 1; joinedAt[i] = sim.round; added++; }
        sim.round++;
        const ns = sim.share(); sim.history.push(ns); sim.path.push(ns);
        if (!added) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    // 0라운드: 선동가가 먼저 나온다
    sim.history.push(0);
    return sim;
  }

  function finalShare(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 17 })).run().share());
    return out;
  }

  return { DEFAULTS, create, finalShare };
});
