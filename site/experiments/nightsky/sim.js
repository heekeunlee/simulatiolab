// 밤하늘엔 왜 밝은 별이 몇 개뿐일까: 가상의 별을 관측자 둘레 공 안에 고르게(밀도 일정) 뿌리고, 보이는 밝기를 계산한다.
// 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32). 모든 값은 이 프로젝트가 정한 무차원 설정이다.
// - 별의 원래 밝기: 등급으로 평균 M0, 폭 width(정규분포; 폭 0이면 모두 같은 밝기)
// - 보이는 밝기(등급): m = 원래 등급 + 5·log10(거리) + 먼지(거리에 비례해 어두워짐). 등급은 숫자가 작을수록 밝다.
//   (밝기가 거리 제곱에 반비례 → 거리가 10배면 100배 어두움 = 5등급)
// - 재생: 해가 진 뒤 하늘이 점점 어두워진다고 보고, '지금 보이는 가장 어두운 등급'을 START에서 한계 등급(도시 불빛)까지 조금씩 올린다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NightSky = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const C = {
    R: 100,          // 별이 흩어진 공의 반지름(관측자가 가운데)
    DMIN: 1,         // 가장 가까운 별까지의 최소 거리(너무 가까워 끝없이 밝아지는 것을 막음)
    M0: 0,           // 원래 밝기(등급)의 평균: 이 별을 거리 1에 두면 0등급
    DUST: 0.12,      // 먼지 100%일 때 거리 1마다 더해지는 등급(어두워짐)
    LIMITS: [7, 6, 5, 4, 3, 2],   // 도시 불빛 단계별로 보이는 가장 어두운 등급(이 모델의 예시)
    START: 1.5,      // 재생 시작: 해가 막 진 하늘(가장 밝은 별 몇 개만 보임)
    DM: 0.05,        // 한 걸음에 하늘이 어두워지는 정도(등급)
    MMAX: 7.5,       // 정렬해 둘 가장 어두운 등급(이보다 어두운 별은 어떤 하늘에서도 안 보임)
    BIN0: -1, NBIN: 9,   // 등급 칸: '0등급보다 밝음', 0~1, 1~2, …, 7~8
  };
  const DEFAULTS = { seed: 1, n: 100, width: 100, dust: 0, city: 1 };   // n: 천 개 단위, width: 폭×100, dust: %

  function create(p0) {
    const p = Object.assign({}, DEFAULTS, p0 || {});
    const N = Math.round(p.n * 1000), sig = p.width / 100, a = (p.dust / 100) * C.DUST, lim = C.LIMITS[p.city];
    const rnd = mulberry32(p.seed * 7919 + 13);
    const x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N), d = new Float32Array(N), M = new Float32Array(N), m = new Float32Array(N);
    const gauss = () => { let u = 0; while (u <= 1e-12) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const R3 = C.R ** 3, D3 = C.DMIN ** 3;
    for (let i = 0; i < N; i++) {
      // 공 안에 고르게: 거리의 세제곱이 고르게 분포 (DMIN 안쪽은 비움)
      const r = Math.cbrt(D3 + rnd() * (R3 - D3));
      const cz = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), s = Math.sqrt(1 - cz * cz);
      x[i] = r * s * Math.cos(ph); y[i] = r * cz; z[i] = r * s * Math.sin(ph); d[i] = r;
      M[i] = C.M0 + sig * gauss();
      m[i] = M[i] + 5 * Math.log10(r) + a * r;
    }
    // 원래 밝기 상위 10%의 기준(등급이 이보다 작으면 '원래 밝은 별')
    let mcut = -Infinity;
    if (sig > 0) { const s = Array.from(M.subarray(0, Math.min(N, 20000))).sort((u, v) => u - v); mcut = s[Math.floor(s.length * 0.1)]; }
    // 어떤 하늘에서든 보일 수 있는 별만 밝은 순으로 정렬
    const cand = []; for (let i = 0; i < N; i++) if (m[i] < C.MMAX) cand.push(i);
    cand.sort((u, v) => m[u] - m[v]);
    const order = Uint32Array.from(cand);
    const S = {
      params: p, N, lim, x, y, z, d, M, m, order, mcut,
      cur: C.START, shown: 0, t: 0, done: false,
      steps: Math.ceil((lim - C.START) / C.DM),
      step() {
        if (S.done) return false;
        S.t++; S.cur = Math.min(lim, C.START + S.t * C.DM);
        while (S.shown < order.length && m[order[S.shown]] < S.cur) S.shown++;
        if (S.cur >= lim) S.done = true;
        return true;
      },
      finish() { while (S.step()); },
      // 등급 k보다 밝은(숫자가 작은) 별 수: 정렬된 목록에서 이분 탐색
      brighter(k) { let lo = 0, hi = order.length; while (lo < hi) { const md = (lo + hi) >> 1; if (m[order[md]] < k) lo = md + 1; else hi = md; } return lo; },
      // 지금까지 보인 별의 등급 칸별 수 (칸 0 = 0등급보다 밝음, 칸 j = (j-1)~j등급)
      bins() { const b = new Array(C.NBIN).fill(0); for (let k = 0; k < S.shown; k++) { const j = Math.max(0, Math.min(C.NBIN - 1, Math.floor(m[order[k]]) + 1)); b[j]++; } return b; },
      bright(i) { return M[i] < mcut; },
    };
    while (S.shown < order.length && m[order[S.shown]] < S.cur) S.shown++;   // 해가 막 졌을 때 이미 보이는 밝은 별
    return S;
  }
  // 한 등급 어두워질 때 별 수가 몇 배가 되나: lo등급보다 밝은 별 수와 hi등급보다 밝은 별 수에서 등급당 평균 배수
  function ratio(S, hi, lo) { lo = lo == null ? 3 : lo; const a = S.brighter(lo), b = S.brighter(hi); return a > 0 && hi > lo ? Math.pow(b / a, 1 / (hi - lo)) : NaN; }
  // 밝게 보이는 상위 k개 중 원래 밝은 별(원래 밝기 상위 10%) 수
  function topBright(S, k) { let c = 0; const n = Math.min(k, S.order.length); for (let j = 0; j < n; j++) if (S.bright(S.order[j])) c++; return c; }
  function median(arr) { if (!arr.length) return NaN; const s = arr.slice().sort((u, v) => u - v); return s[Math.floor(s.length / 2)]; }
  // 집계 한 판: 하늘 한계와 상관없이 7.5등급까지 다 본 목록의 지표 (배수는 4~7등급 사이: 별이 적은 밝은 쪽의 들쭉날쭉을 줄이려고)
  function summary(p) {
    const S = create(p), lim = S.lim, cum = {};
    for (let k = 0; k <= 7; k++) cum[k] = S.brighter(k);
    const vis = S.brighter(lim), dv = [], da = [];
    for (let j = 0; j < vis; j++) dv.push(S.d[S.order[j]]);
    for (let i = 0; i < Math.min(S.N, 20000); i++) da.push(S.d[i]);
    return { N: S.N, lim, cum, vis, ratio: ratio(S, 7, 4), top20: topBright(S, 20), medVis: median(dv), medAll: median(da) };
  }
  return { create, summary, ratio, topBright, DEFAULTS, C, mulberry32 };
});
