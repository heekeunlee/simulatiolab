/*
 * 같은 노래를 계속 들으면 좋아질까, 질릴까?
 * '단순 노출 효과'(자주 접할수록 호감이 생긴다는 알려진 설명)와, 선호가 처음엔 오르다 나중엔 내려간다는
 * '역U자' 설명을 이 프로젝트가 아주 단순하게 흉내 낸 모델이다. 두 힘(익숙함이 주는 호감, 쌓이는 질림)을 더하기만 했고,
 * 모든 파라미터는 이 프로젝트의 설계(예시 값)이며 실제 실험값이 아니다. 브라우저와 Node.js 양쪽에서 같은 파일을 쓴다.
 *
 * 모델: 듣는 사람 n명이 같은 곡을 '간격'(일)마다 한 번씩 listens번 듣는다.
 *  - 익숙함 F(k) = 1 - exp(-k / tauF),  tauF = 1.5 + 12 * c   (c = 곡의 복잡도 0~1, 복잡할수록 천천히 익숙해진다)
 *  - 질림 B: 한 번 들을 때마다 delta_i = 0.045 * rate * s_i * (1.1 - c) 만큼 쌓이고 (단순한 곡일수록 많이),
 *            쉬는 동안 a = exp(-gap / REST) 배로 가라앉는다 (REST = 30일).  B_k = a * B_{k-1} + delta_i
 *  - 호감 L_i(k) = 100 * (F(k) - B_i(k))   (점, 0 = 듣기 전과 같은 마음, 음수 = 듣기 전보다 싫어짐)
 *  - s_i: 사람마다 다른 질림 민감도 (로그정규, 평균 1)
 *  닫힌 식: B_k = delta (1 - a^k) / (1 - a)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MereExposure = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 100, listens: 100, c: 0.3, rate: 1, gap: 1, sdS: 0.5, seed: 1 };
  const REST = 30, BASE = 0.045;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const tauF = (c) => 1.5 + 12 * c;
  const fam = (k, c) => 1 - Math.exp(-k / tauF(c));
  const decay = (gap) => Math.exp(-gap / REST);
  const delta = (p, s) => BASE * p.rate * s * (1.1 - p.c);
  // 질림 민감도가 s인 한 사람의 k번째 호감 (닫힌 식)
  function likingAt(p, k, s) {
    p = Object.assign({}, DEFAULTS, p);
    if (k <= 0) return 0;
    const a = decay(p.gap), B = delta(p, s == null ? 1 : s) * (1 - Math.pow(a, k)) / (1 - a);
    return 100 * (fam(k, p.c) - B);
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 9973 + 31), n = p.n;
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const s = new Float64Array(n), B = new Float64Array(n), like = new Float64Array(n), best = new Float64Array(n), bestAt = new Int16Array(n);
    const m2 = Math.exp(-p.sdS * p.sdS / 2); // 로그정규의 평균을 1로 맞춘다
    for (let i = 0; i < n; i++) s[i] = Math.exp(p.sdS * gauss()) * m2;
    const a = decay(p.gap);
    const sim = { params: p, n, k: 0, s, B, like, best, bestAt, mean: [0], hist: [Float64Array.from(like)], disliked: [0] };
    sim.advance = function () {
      if (sim.k >= p.listens) return false;
      const k = ++sim.k, F = fam(k, p.c); let sum = 0, neg = 0;
      for (let i = 0; i < n; i++) {
        B[i] = (k > 1 ? B[i] * a : 0) + delta(p, s[i]);
        like[i] = 100 * (F - B[i]); sum += like[i]; if (like[i] < 0) neg++;
        if (like[i] > best[i] || k === 1) { best[i] = like[i]; bestAt[i] = k; }
      }
      sim.mean.push(sum / n); sim.hist.push(Float64Array.from(like)); sim.disliked.push(neg);
      return true;
    };
    sim.done = () => sim.k >= p.listens;
    sim.run = () => { while (sim.advance()); return sim; };
    // k번째까지 본 평균 호감의 최고점과 그 위치
    sim.peak = (upto) => { const K = upto == null ? sim.k : upto; let bi = 0; for (let j = 1; j <= K; j++) if (sim.mean[j] > sim.mean[bi]) bi = j; return { at: bi, value: sim.mean[bi] }; };
    return sim;
  }

  // 요약: 기본 지표
  function summary(o, seeds) {
    seeds = seeds || [1];
    const rs = seeds.map((seed) => {
      const S = create(Object.assign({}, o, { seed })).run(), pk = S.peak(), K = S.params.listens;
      const at = Array.from(S.bestAt).sort((x, y) => x - y);
      return { peakAt: pk.at, peak: pk.value, final: S.mean[K], disliked: S.disliked[K] / S.n, firstAt: at[Math.floor(S.n * 0.1)], lastAt: at[Math.floor(S.n * 0.9)], at10: S.mean[10], at30: S.mean[30] };
    });
    const avg = (key) => rs.reduce((x, r) => x + r[key], 0) / rs.length;
    return { peakAt: avg('peakAt'), peak: avg('peak'), final: avg('final'), disliked: avg('disliked'), firstAt: avg('firstAt'), lastAt: avg('lastAt'), at10: avg('at10'), at30: avg('at30') };
  }

  return { DEFAULTS, REST, create, summary, likingAt, tauF, fam, decay };
});
