// 필터버블: 추천이 비슷한 글을 더 보여 줄수록 의견이 갈라지는가 (한 가지 쟁점, 한 줄의 의견만 있는 단순 모델, 무차원)
// - 사람 N명, 의견 −1(A쪽 끝) ~ 0(가운데) ~ +1(B쪽 끝). 어느 쪽이 옳다는 뜻이 없는 축이다.
// - 매 걸음(하루) 사람마다 글 4개를 본다. 후보는 무작위로 뽑은 다른 사람 30명의 글.
//   글 한 칸마다: 확률 div → 반대편(0을 사이에 둔 맞은편) 후보 중 무작위 / 아니면 확률 s → 후보 중 내 의견과 가장 가까운 글(추천) / 나머지 → 후보 중 무작위.
// - 본 글이 '끌리는 폭' eps 안이면: ① 그 글 쪽으로 조금 끌리고(MU) ② 그 글이 한쪽 편을 분명히 들면(가운데에서 TH 넘게) 그 편 쪽으로 조금 더 굳어진다(REINF).
//   폭 밖이면 무시하거나, 거슬림 rep > 0이면 그 글 반대쪽으로 조금 밀린다.
// - 사람마다 처음 생각으로 조금씩 돌아가려는 성질(LAM)이 있다. 아주 작은 흔들림(NOISE)도 있다.
// 실제 소셜미디어·알고리즘의 재현이 아니라 이 프로젝트가 정한 단순화된 예시다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FilterBubble = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = {
    STEPS: 200, POOL: 30, POSTS: 4,
    MU: 0.3,          // 폭 안의 글 쪽으로 끌리는 정도 (글 하나당, 글 4개 평균)
    REINF: 0.08,      // '굳어지는 정도' 100%일 때, 한쪽 편을 분명히 드는 글이 그 편 쪽으로 미는 정도
    TH: 0.11, RAMP: 0.3,   // 가운데에서 0.11까지는 어느 편 이야기로도 들리지 않고, 0.41부터 온전히 그 편 이야기
    REP: 0.06,        // '거슬림' 100%일 때, 폭 밖 글에서 밀려나는 정도
    LAM: 0.05,        // 처음 생각으로 돌아가려는 정도 (걸음마다)
    NOISE: 0.004, SD0: 0.25,
    GAP: 0.1,         // 덩어리: 의견을 줄 세웠을 때 0.1(화면 단위 10) 넘게 벌어진 곳에서 끊는다
    BINS: 40,
  };
  const DEFAULTS = { n: 400, s: 0.5, eps: 0.4, rep: 0, div: 0, reinf: 1, seed: 1 };

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const side = (v) => (v > 0 ? 1 : -1);
  // 글이 한쪽 편을 드는 정도: 가운데 근처는 0, 멀어질수록 ±1까지
  const lean = (v) => { const a = Math.abs(v); return a <= C.TH ? 0 : side(v) * Math.min(1, (a - C.TH) / C.RAMP); };

  function minCluster(n) { return Math.max(5, Math.round(n * 0.03)); }
  // 의견 배열 → 지표
  function measure(x, x0) {
    const N = x.length; let m = 0; for (let i = 0; i < N; i++) m += x[i]; m /= N;
    let va = 0, mv = 0; for (let i = 0; i < N; i++) { va += (x[i] - m) ** 2; mv += Math.abs(x[i] - x0[i]); }
    const s = Array.from(x).sort((a, b) => a - b), minC = minCluster(N);
    let cl = 0, sz = 1; const groups = [];
    let start = 0;
    for (let i = 1; i <= N; i++) {
      if (i === N || s[i] - s[i - 1] > C.GAP) { if (sz >= minC) { cl++; let gm = 0; for (let k = start; k < i; k++) gm += s[k]; groups.push({ size: sz, mean: (gm / sz) * 100 }); } sz = 1; start = i; }
      else sz++;
    }
    return { pol: Math.sqrt(va / N) * 100, cl, move: (mv / N) * 100, mean: m * 100, groups };
  }
  function density(x) {
    const B = C.BINS, h = new Float32Array(B);
    for (let i = 0; i < x.length; i++) h[Math.min(B - 1, Math.floor((x[i] + 1) / 2 * B))]++;
    for (let b = 0; b < B; b++) h[b] /= x.length;
    return h;
  }

  function create(opt) {
    const p = Object.assign({}, DEFAULTS, opt || {});
    p.n = Math.max(50, Math.round(p.n));
    const N = p.n, rnd = mulberry32((p.seed || 1) * 9973 + 7);
    const gauss = () => { let u = 0; for (let k = 0; k < 6; k++) u += rnd(); return (u - 3) / Math.SQRT1_2; };   // 평균 0, 표준편차 약 1
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = clamp(gauss() * C.SD0, -0.95, 0.95);
    const x0 = Float64Array.from(x), ox = Float64Array.from(x), nx = new Float64Array(N);
    const cand = new Int32Array(C.POOL);
    const sim = {
      params: p, n: N, x, x0, ox, t: 0, done: false,
      hist: { pol: [], cl: [], cross: [], move: [], dens: [] },
      last: null,
      step,
    };
    function record(cross) {
      const m = measure(x, x0); m.cross = cross;
      sim.hist.pol.push(m.pol); sim.hist.cl.push(m.cl); sim.hist.cross.push(cross); sim.hist.move.push(m.move); sim.hist.dens.push(density(x));
      sim.last = m;
    }
    function step() {
      if (sim.done) return false;
      let cross = 0, seen = 0;
      for (let i = 0; i < N; i++) {
        const xi = x[i];
        for (let k = 0; k < C.POOL; k++) { let j = (rnd() * N) | 0; if (j === i) j = (j + 1) % N; cand[k] = j; }
        let dx = 0;
        for (let q = 0; q < C.POSTS; q++) {
          let j = -1;
          if (p.div > 0 && rnd() < p.div) {          // 일부러 섞은 반대편 글
            let c = 0; for (let k = 0; k < C.POOL; k++) if (side(x[cand[k]]) !== side(xi)) { c++; if (rnd() * c < 1) j = cand[k]; }
            if (j < 0) j = cand[(rnd() * C.POOL) | 0];
          } else if (rnd() < p.s) {                  // 추천: 후보 중 내 의견과 가장 가까운 글
            let bd = 9; for (let k = 0; k < C.POOL; k++) { const d = Math.abs(x[cand[k]] - xi); if (d < bd) { bd = d; j = cand[k]; } }
          } else j = cand[(rnd() * C.POOL) | 0];    // 무작위 글
          const xj = x[j], d = xj - xi; seen++; if (side(xj) !== side(xi)) cross++;
          if (Math.abs(d) < p.eps) dx += C.MU * d + p.reinf * C.REINF * lean(xj) * (1 - xi * xi);
          else if (p.rep > 0) dx -= p.rep * C.REP * side(d) * (1 - xi * xi);
        }
        nx[i] = clamp(xi + dx / C.POSTS + C.LAM * (x0[i] - xi) + (rnd() - 0.5) * C.NOISE, -1, 1);
      }
      ox.set(x); x.set(nx); sim.t++;
      record((cross / seen) * 100);
      if (sim.t >= C.STEPS) sim.done = true;
      return true;
    }
    record(NaN);   // 0걸음: 아직 본 글이 없다
    return sim;
  }
  function runToEnd(opt) { const s = create(opt); while (!s.done) s.step(); return s; }
  // 마지막 20걸음 평균 (여러 판 집계용)
  function summary(opt) {
    const s = runToEnd(opt), H = s.hist, L = H.pol.length, a = L - 20;
    const avg = (arr) => { let v = 0; for (let k = a; k < L; k++) v += arr[k]; return v / (L - a); };
    const m = s.last, oneSide = Math.abs(m.mean) > 40 && m.pol < 25;   // 갈라지지 않고 모두 한쪽 끝으로 쏠린 판
    return { pol: avg(H.pol), cl: avg(H.cl), cross: avg(H.cross), move: avg(H.move), oneSide, last: m, sim: s };
  }
  return { C, DEFAULTS, create, runToEnd, summary, measure, minCluster, lean, mulberry32 };
});
