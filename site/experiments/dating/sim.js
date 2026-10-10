/*
 * 눈높이와 짝 찾기: 양쪽이 모두 동의해야 맺어지는 매칭 시장 (탐색·기대 수준 모델)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - A집단 n명, B집단 n명. 모든 사람은 0~1의 "매력"(서로가 비슷하게 평가하는 값)을 가진다
 *  - 사람마다 "최소 기준" = 내 매력 + eye (eye > 0: 나보다 나은 사람을 원함, eye < 0: 눈을 낮춤)
 *  - 한 라운드에 아직 짝이 없는 사람끼리 무작위로 한 쌍씩 만난다. 두 사람이 서로 상대가 자기 기준 이상이라고
 *    생각할 때만 맺어진다 (한쪽만 마음에 들면 안 됨)
 *  - 라운드가 끝날 때마다 짝이 없는 사람은 기준을 drift만큼 낮춘다 (조금씩 현실을 받아들임)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dating = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 200, eye: 0.1, drift: 0.01, rounds: 100, seed: 1 };

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
    const rng = mulberry32(p.seed * 131 + 17);
    const n = p.n;
    const a = Float64Array.from({ length: n }, () => rng()), b = Float64Array.from({ length: n }, () => rng());
    const thA = Float64Array.from(a, (x) => Math.max(0, x + p.eye)), thB = Float64Array.from(b, (x) => Math.max(0, x + p.eye));
    const mA = new Int32Array(n).fill(-1), mB = new Int32Array(n).fill(-1);
    const wA = new Int32Array(n), wB = new Int32Array(n); // 짝을 찾은 라운드
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    const sim = {
      params: p, n, a, b, mA, mB, wA, wB, thA, thB, round: 0, done: false, history: [0],
      advance() {
        if (sim.done) return false;
        sim.round++;
        const ua = [], ub = [];
        for (let i = 0; i < n; i++) { if (mA[i] < 0) ua.push(i); if (mB[i] < 0) ub.push(i); }
        shuffle(ua); shuffle(ub);
        const k = Math.min(ua.length, ub.length);
        for (let t = 0; t < k; t++) {
          const i = ua[t], j = ub[t];
          if (b[j] >= thA[i] && a[i] >= thB[j]) { mA[i] = j; mB[j] = i; wA[i] = wB[j] = sim.round; }
        }
        for (let i = 0; i < n; i++) {
          if (mA[i] < 0) thA[i] = Math.max(0, thA[i] - p.drift);
          if (mB[i] < 0) thB[i] = Math.max(0, thB[i] - p.drift);
        }
        const s = sim.stats(); sim.history.push(s.matched);
        if (s.matched >= 1 || sim.round >= p.rounds) sim.done = true;
        return true;
      },
      stats() {
        let m = 0, wait = 0, diff = 0, lone = 0, loneSum = 0, loneHi = 0, loneLo = 0;
        for (let i = 0; i < n; i++) {
          if (mA[i] >= 0) { m++; wait += wA[i]; diff += Math.abs(a[i] - b[mA[i]]); }
          else { lone++; loneSum += a[i]; if (a[i] > 0.8) loneHi++; if (a[i] < 0.2) loneLo++; }
          if (mB[i] < 0) { lone++; loneSum += b[i]; if (b[i] > 0.8) loneHi++; if (b[i] < 0.2) loneLo++; }
        }
        return {
          matched: m / n, meanWait: m ? wait / m : 0, meanDiff: m ? diff / m : 0,
          loneMean: lone ? loneSum / lone : 0, lone, loneHi, loneLo,
        };
      },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  function measure(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) { const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 5 })).run(); out.push(s.stats()); }
    return out;
  }

  return { DEFAULTS, create, measure };
});
