/*
 * 대기 시간의 역설 (검사 역설, inspection paradox / waiting-time paradox) 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - 버스는 평균 mean분 간격으로 오지만, 간격 H는 감마분포로 들쭉날쭉하다 (변동계수 cv = 표준편차 / 평균).
 *    cv = 0이면 정확히 mean분마다 오는 시간표 운행, cv = 1이면 무작위(푸아송) 도착, cv가 더 크면 버스가 몰려서 온다.
 *  - 승객은 시간축 어디든 같은 확률로 도착한다 (버스 시간표를 모른다).
 *  - 승객이 도착해서 다음 버스까지 기다린 시간이 대기 시간이고, 승객이 도착한 순간 걸쳐 있던 버스 간격이 '승객이 본 간격'이다.
 *  - 긴 간격은 시간축에서 더 넓은 자리를 차지하므로 승객이 그 안에 떨어질 확률이 간격 길이에 비례한다 (길이 편향 표본).
 *    이론: 승객이 본 간격의 평균 = E[H^2]/E[H] = mean (1 + cv^2),  평균 대기 = E[H^2]/(2E[H]) = mean/2 (1 + cv^2)
 *  - 학급 인원 패널: 같은 계산. 학급(=간격)을 하나씩 세면 평균 25명이지만, 학생(=승객)에게 '내 반 인원'을 물으면 평균이 25 (1 + cv^2)에 가까워진다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Inspection = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { mean: 10, cv: 1, n: 500, seed: 1, buses: 3000 };
  const CLASS_MEAN = 25, CLASS_COUNT = 1000;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gaussFrom = (rng) => () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };

  // 감마(shape k, scale 1) 표본: Marsaglia-Tsang. k < 1이면 gamma(k+1) * U^(1/k)
  function gammaFrom(rng, gauss) {
    function g(k) {
      if (k < 1) { let u = 0; while (u === 0) u = rng(); return g(k + 1) * Math.pow(u, 1 / k); }
      const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
      for (;;) {
        let x, v;
        do { x = gauss(); v = 1 + c * x; } while (v <= 0);
        v = v * v * v; const u = rng();
        if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
      }
    }
    return g;
  }
  // 평균 mean, 변동계수 cv인 간격 표본
  function headwayFrom(rng, gauss, mean, cv) {
    if (cv < 0.005) return () => mean;
    const k = 1 / (cv * cv), g = gammaFrom(rng, gauss), scale = mean / k;
    return () => g(k) * scale;
  }

  const theory = (mean, cv) => ({ wait: (mean / 2) * (1 + cv * cv), seen: mean * (1 + cv * cv), naive: mean / 2 });

  // 한 번의 설정. 버스 도착 시각과 승객 도착 시각을 모두 미리 만들어 두고, advance()로 승객을 하나씩 공개한다.
  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 8191 + 3), gauss = gaussFrom(rng), hw = headwayFrom(rng, gauss, p.mean, p.cv);
    const bus = new Float64Array(p.buses + 1), heads = new Float64Array(p.buses);
    for (let i = 0; i < p.buses; i++) { heads[i] = hw(); bus[i + 1] = bus[i] + heads[i]; }
    const T = bus[p.buses];
    const pass = [];
    let sw = 0, ss = 0;
    for (let k = 0; k < p.n; k++) {
      const t = rng() * T;
      let lo = 0, hi = p.buses; // bus[lo] <= t < bus[lo+1]
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (bus[mid] <= t) lo = mid; else hi = mid; }
      const gap = heads[lo], wait = bus[lo + 1] - t;
      pass.push({ t, idx: lo, gap, wait }); sw += wait; ss += gap;
    }
    let hm = 0, hq = 0; for (let i = 0; i < p.buses; i++) { hm += heads[i]; hq += heads[i] * heads[i]; }
    hm /= p.buses; const hv = hq / p.buses - hm * hm;
    const sim = {
      params: p, bus, heads, pass, T, round: 0, last: null, sumWait: 0, sumSeen: 0, history: [], seenHistory: [],
      busMean: hm, busCv: Math.sqrt(Math.max(0, hv)) / hm,
      meanWait: sw / p.n, meanSeen: ss / p.n,
      theory: theory(p.mean, p.cv),
      waits() { return pass.map((q) => q.wait); },
      seen() { return pass.map((q) => q.gap); },
      advance() {
        if (sim.round >= p.n) return false;
        const q = pass[sim.round]; sim.last = q; sim.round++; sim.sumWait += q.wait; sim.sumSeen += q.gap;
        sim.history.push(sim.sumWait / sim.round); sim.seenHistory.push(sim.sumSeen / sim.round);
        return true;
      },
      done() { return sim.round >= p.n; },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 그리기 없는 빠른 반복 (스윕용): 평균 대기, 평균으로 본 간격
  function study(opts, passengers, seedBase) {
    const s = create(Object.assign({}, opts, { n: passengers, seed: seedBase || 5, buses: 1500 }));
    return { wait: s.meanWait, seen: s.meanSeen, busMean: s.busMean };
  }

  // 학급 인원 패널: 학급 count개, 평균 CLASS_MEAN명, 변동계수 cv (정수로 반올림, 최소 1명)
  function classes(opts) {
    const p = Object.assign({ cv: 1, seed: 1, count: CLASS_COUNT, mean: CLASS_MEAN }, opts);
    const rng = mulberry32(p.seed * 4099 + 11), gauss = gaussFrom(rng), hw = headwayFrom(rng, gauss, p.mean, p.cv);
    const sizes = new Array(p.count); let s1 = 0, s2 = 0;
    for (let i = 0; i < p.count; i++) { const v = Math.max(1, Math.round(hw())); sizes[i] = v; s1 += v; s2 += v * v; }
    return { sizes, students: s1, perClass: s1 / p.count, perStudent: s2 / s1, theoryPerStudent: p.mean * (1 + p.cv * p.cv) };
  }

  return { DEFAULTS, CLASS_MEAN, CLASS_COUNT, create, study, classes, theory };
});
