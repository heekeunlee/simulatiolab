// 달이 없었다면 지구의 계절은: 자전축 세차 + 공명 장난감 모델. 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32), 고정 dt, RK4.
// - 자전축 s(길이 1)는 공전 궤도면의 수직 방향 n(t) 둘레를 돈다(세차): ds/dt = α (s·n)(s × n). 기울기 ε = acos(s·n).
// - 세차 빠르기 α = α해 × (1 + LUNAR × 달 질량). 달이 무거울수록 빨라진다(이 프로젝트의 단순화).
// - 다른 행성의 섭동: 궤도면이 주기 3개의 작은 흔들림으로 기운다(n = (Re z, Im z, 1)/|…|, z = Σ A_k e^{i(g_k t + φ_k)}).
//   세차 빠르기 α cos ε 가 흔들림 빠르기 −g_k와 비슷해지면(공명) 기울기가 크게 흔들린다.
// 시간 단위 = 1천 년(kyr, 모델 시간). 모든 상수는 무차원·단순화 설정이며 실제 태양계 값의 재현이 아니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoonAxis = factory();
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
  const DEG = Math.PI / 180;
  const C = {
    ALPHA_SUN: 0.0756,       // 해만 있을 때 세차 빠르기 (라디안 / 천 년)
    LUNAR: 2.17,             // 달 질량 1(지금의 달)이 더하는 몫 (α = α해 × (1 + 2.17 × 달))
    G: [-0.034, -0.087, -0.127],   // 궤도면 흔들림 세 가지의 빠르기 (라디안 / 천 년, 음수 = 세차와 같은 방향)
    A: [1.5, 1.0, 0.8],      // 흔들림 크기 (도, 섭동 세기 1일 때)
    DT: 0.25,                // 적분 간격 (천 년)
    SAMPLE: 1,               // 기록 간격 (천 년) = 한 걸음
  };
  const DEFAULTS = { moon: 0, pert: 1, eps0: 23, years: 1000, seed: 1 };   // years: 천 년 단위 (1000 = 100만 년)

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32(P.seed * 7919 + 13);
    const phi = C.G.map(() => rnd() * 2 * Math.PI);
    const prec0 = rnd() * 2 * Math.PI;                 // 처음 축이 기운 방향(세차 각)
    const alpha = C.ALPHA_SUN * (1 + C.LUNAR * P.moon);
    const amp = C.A.map((a) => a * DEG * P.pert);
    function normal(t, out) {
      let x = 0, y = 0;
      for (let k = 0; k < 3; k++) { const a = C.G[k] * t + phi[k]; x += amp[k] * Math.cos(a); y += amp[k] * Math.sin(a); }
      const L = Math.sqrt(x * x + y * y + 1); out[0] = x / L; out[1] = y / L; out[2] = 1 / L; return out;
    }
    const n0 = normal(0, [0, 0, 0]);
    // 처음 축: 궤도면 수직 n0에서 eps0만큼, prec0 방향으로 기울인다
    const e0 = P.eps0 * DEG;
    let ux = 1 - n0[0] * n0[0], uy = -n0[0] * n0[1], uz = -n0[0] * n0[2]; { const l = Math.hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l; }   // n0에 수직인 단위벡터 u (x축에서 n0 성분을 뺀 것)
    let wx = n0[1] * uz - n0[2] * uy, wy = n0[2] * ux - n0[0] * uz, wz = n0[0] * uy - n0[1] * ux;   // w = n0 × u
    const cp = Math.cos(prec0), sp = Math.sin(prec0);
    const s = [Math.cos(e0) * n0[0] + Math.sin(e0) * (cp * ux + sp * wx), Math.cos(e0) * n0[1] + Math.sin(e0) * (cp * uy + sp * wy), Math.cos(e0) * n0[2] + Math.sin(e0) * (cp * uz + sp * wz)];
    const nb = [0, 0, 0];
    function deriv(t, v, out) {
      normal(t, nb); const d = v[0] * nb[0] + v[1] * nb[1] + v[2] * nb[2];
      out[0] = alpha * d * (v[1] * nb[2] - v[2] * nb[1]);
      out[1] = alpha * d * (v[2] * nb[0] - v[0] * nb[2]);
      out[2] = alpha * d * (v[0] * nb[1] - v[1] * nb[0]);
      return out;
    }
    const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0], tmp = [0, 0, 0];
    function rk4(t, h) {
      deriv(t, s, k1);
      for (let i = 0; i < 3; i++) tmp[i] = s[i] + 0.5 * h * k1[i]; deriv(t + 0.5 * h, tmp, k2);
      for (let i = 0; i < 3; i++) tmp[i] = s[i] + 0.5 * h * k2[i]; deriv(t + 0.5 * h, tmp, k3);
      for (let i = 0; i < 3; i++) tmp[i] = s[i] + h * k3[i]; deriv(t + h, tmp, k4);
      for (let i = 0; i < 3; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    const nNow = [0, 0, 0];
    function obliq() { normal(S.t, nNow); const d = s[0] * nNow[0] + s[1] * nNow[1] + s[2] * nNow[2]; return Math.acos(Math.max(-1, Math.min(1, d))) / DEG; }
    const S = {
      params: P, alpha, phi, t: 0, s, n: nNow, done: false,
      hist: [], sh: [], min: P.eps0, max: P.eps0, normErr: 0, prevS: s.slice(),
      // 세차 빠르기(지금 기울기에서)와 흔들림 빠르기 (라디안/천 년)
      precRate() { return alpha * Math.cos(S.eps * DEG); },
      step() {
        if (S.done) return false;
        S.prevS = s.slice();
        const nsub = Math.round(C.SAMPLE / C.DT);
        for (let j = 0; j < nsub; j++) { rk4(S.t, C.DT); S.t = Math.round((S.t + C.DT) * 1e6) / 1e6; }
        const L = Math.hypot(s[0], s[1], s[2]); S.normErr = Math.max(S.normErr, Math.abs(L - 1));
        s[0] /= L; s[1] /= L; s[2] /= L;   // 길이 1 유지 (오차는 normErr로 기록)
        S.eps = obliq(); S.hist.push(S.eps); S.sh.push(s[0], s[1], s[2]);
        if (S.eps < S.min) S.min = S.eps; if (S.eps > S.max) S.max = S.eps;
        if (S.t >= P.years - 1e-9) S.done = true;
        return true;
      },
      range() { return S.max - S.min; },
      // 세차 각: 축이 궤도면 위에서 가리키는 방향 (3D 꼬리용)
      normalAt(t) { return normal(t, [0, 0, 0]); },
    };
    S.eps = obliq(); S.hist.push(S.eps); S.sh.push(s[0], s[1], s[2]);
    return S;
  }
  // 집계용: 끝까지 돌려 최소·최대·폭
  function run(opt) { const s = create(opt); while (s.step()); return { min: s.min, max: s.max, range: s.range(), normErr: s.normErr, hist: s.hist }; }
  return { create, run, DEFAULTS, C, DEG, mulberry32 };
});
