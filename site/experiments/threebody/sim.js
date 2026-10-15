// 세 천체 문제: 질량 셋의 중력 N체(3D). 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32).
// G = 1, 무차원 단위(길이·시간·질량 모두 이 모델의 단위). 적분: 속도 베를레(velocity-Verlet, kick-drift-kick),
// 가까이 지나갈수록 한 걸음을 잘게 쪼갠다(적응 걸음), 아주 작은 소프트닝으로 0 거리 폭주를 막는다.
// 한 판 = "쌍둥이" 두 개: 판 A와, 별 1의 시작 위치만 eps만큼 옮긴 판 B. 비교용으로 별 둘(2체)의 쌍둥이도 함께 돌린다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThreeBody = factory();
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
    DT: 0.02,          // 화면 한 걸음 = 모델 시간 0.02
    ETA: 0.004,        // 적응 걸음: h = ETA × (가장 가까운 쌍이 서로 도는 데 걸리는 시간 정도)
    HMIN: 1e-9, SUBMAX: 400000,
    SOFT: 1e-3,        // 소프트닝 길이 (시작 거리 1 기준)
    VROT: 0.8,         // 처음 회전 속도: 원 궤도 속도의 이 비율 (1보다 작아 셋이 안쪽으로 떨어지며 얽힌다)
    DIVERGE: 1,        // 두 판이 "갈라졌다": 같은 별끼리 거리 차가 이 값을 넘는 첫 때
    ESC: 6,            // 튕겨 나감: 나머지 둘의 중심에서 (시작 거리 × 6)보다 멀고, 묶이지 않은(에너지 > 0) 채 멀어지는 중
    SAMPLE: 5,         // 기록 간격(걸음)
  };
  let HASH = 922;   // 시드를 처음 배치로 바꾸는 상수 (첫 판에서 갈라짐과 튕겨 나감이 둘 다 보이도록 고른 값)
  const DEFAULTS = { seed: 1, q: 1, dist: 1, eps: 0.01, steps: 4000 };

  // ---------- 계(별 n개) ----------
  function makeSys(m, pos, vel) {
    const n = m.length;
    return { n, m: m.slice(), x: Float64Array.from(pos), v: Float64Array.from(vel), a: new Float64Array(n * 3), t: 0, sub: 0 };
  }
  function clone(s) { return { n: s.n, m: s.m.slice(), x: Float64Array.from(s.x), v: Float64Array.from(s.v), a: new Float64Array(s.n * 3), t: s.t, sub: 0 }; }
  function accel(s, soft2) {
    const { n, m, x, a } = s; a.fill(0); let tmin = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = x[j * 3] - x[i * 3], dy = x[j * 3 + 1] - x[i * 3 + 1], dz = x[j * 3 + 2] - x[i * 3 + 2];
      const r2 = dx * dx + dy * dy + dz * dz + soft2, r = Math.sqrt(r2), inv3 = 1 / (r2 * r);
      a[i * 3] += m[j] * dx * inv3; a[i * 3 + 1] += m[j] * dy * inv3; a[i * 3 + 2] += m[j] * dz * inv3;
      a[j * 3] -= m[i] * dx * inv3; a[j * 3 + 1] -= m[i] * dy * inv3; a[j * 3 + 2] -= m[i] * dz * inv3;
      const tp = Math.sqrt(r2 * r / (m[i] + m[j])); if (tp < tmin) tmin = tp;
    }
    return tmin;
  }
  function energy(s, soft2) {
    const { n, m, x, v } = s; let K = 0, U = 0;
    for (let i = 0; i < n; i++) K += 0.5 * m[i] * (v[i * 3] ** 2 + v[i * 3 + 1] ** 2 + v[i * 3 + 2] ** 2);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = x[j * 3] - x[i * 3], dy = x[j * 3 + 1] - x[i * 3 + 1], dz = x[j * 3 + 2] - x[i * 3 + 2];
      U -= m[i] * m[j] / Math.sqrt(dx * dx + dy * dy + dz * dz + soft2);
    }
    return K + U;
  }
  // 모델 시간 dt만큼 나아간다 (속도 베를레, 적응 걸음)
  function advance(s, dt, soft2) {
    const { n, x, v, a } = s; let left = dt, k = 0;
    let tmin = accel(s, soft2);
    while (left > 1e-12 && k < C.SUBMAX) {
      const h = Math.min(left, Math.max(C.HMIN, C.ETA * tmin));
      for (let i = 0; i < n * 3; i++) { v[i] += 0.5 * h * a[i]; x[i] += h * v[i]; }
      tmin = accel(s, soft2);
      for (let i = 0; i < n * 3; i++) v[i] += 0.5 * h * a[i];
      left -= h; k++;
    }
    s.t += dt; s.sub += k;
    return k;
  }
  // 튕겨 나감: 서로 가장 단단히 묶인 두 별(쌍 에너지가 가장 낮고 0보다 작음)을 "쌍"으로 보고, 남은 별 i가
  // 그 쌍의 무게중심에서 lim보다 멀고, 쌍에 묶이지 않은 채(상대 에너지 > 0) 멀어지는 중이면 i가 튕겨 나간 것
  function pairE(s, j, k) {
    const { m, x, v } = s; let r2 = 0, v2 = 0;
    for (let d = 0; d < 3; d++) { r2 += (x[j * 3 + d] - x[k * 3 + d]) ** 2; v2 += (v[j * 3 + d] - v[k * 3 + d]) ** 2; }
    const mu = m[j] * m[k] / (m[j] + m[k]); return 0.5 * mu * v2 - m[j] * m[k] / Math.sqrt(r2);
  }
  function escaper(s, lim) {
    if (s.n < 3) return -1;
    const { m, x, v } = s;
    let best = -1, bestE = 0;
    for (let i = 0; i < 3; i++) { const e = pairE(s, (i + 1) % 3, (i + 2) % 3); if (e < bestE) { bestE = e; best = i; } }
    if (best < 0) return -1;
    const i = best, j = (i + 1) % 3, k = (i + 2) % 3, M = m[j] + m[k];
    let r2 = 0, rv = 0, v2 = 0;
    for (let d = 0; d < 3; d++) {
      const cx = (m[j] * x[j * 3 + d] + m[k] * x[k * 3 + d]) / M, cv = (m[j] * v[j * 3 + d] + m[k] * v[k * 3 + d]) / M;
      const dx = x[i * 3 + d] - cx, dv = v[i * 3 + d] - cv; r2 += dx * dx; rv += dx * dv; v2 += dv * dv;
    }
    const r = Math.sqrt(r2), mu = m[i] * M / (m[i] + M);
    return r > lim && rv > 0 && 0.5 * mu * v2 - m[i] * M / r > 0 ? i : -1;
  }
  function maxDiff(a, b) {
    let d = 0;
    for (let i = 0; i < a.n; i++) { const dx = a.x[i * 3] - b.x[i * 3], dy = a.x[i * 3 + 1] - b.x[i * 3 + 1], dz = a.x[i * 3 + 2] - b.x[i * 3 + 2]; const r = Math.sqrt(dx * dx + dy * dy + dz * dz); if (r > d) d = r; }
    return d;
  }
  function toCOM(m, x, v) {
    const n = m.length, M = m.reduce((p, q) => p + q, 0);
    for (let d = 0; d < 3; d++) {
      let cx = 0, cv = 0; for (let i = 0; i < n; i++) { cx += m[i] * x[i * 3 + d]; cv += m[i] * v[i * 3 + d]; }
      cx /= M; cv /= M; for (let i = 0; i < n; i++) { x[i * 3 + d] -= cx; v[i * 3 + d] -= cv; }
    }
  }

  // ---------- 처음 배치 (시드마다 조금씩 다른 삼각형) ----------
  function initial3(seed, q, R) {
    const rnd = mulberry32((seed | 0) * 9973 + HASH);
    const m = [1, 1, q], x = [], v = [];
    const Mt = 2 + q;
    for (let i = 0; i < 3; i++) {
      const th = (2 * Math.PI * i) / 3 + (rnd() - 0.5) * 0.6, r = R * (0.85 + rnd() * 0.3), z = (rnd() - 0.5) * 0.3 * R;
      x.push(r * Math.cos(th), r * Math.sin(th), z);
      const vc = Math.sqrt(Mt / (Math.sqrt(3) * R)) * 0.76;   // 무게가 같을 때 정삼각형이 제자리에서 돌 속도 √(Mt/(3√3R))의 약 1.32배 (× VROT 0.8 → 약 1.05배)
      const s = vc * C.VROT * (0.85 + rnd() * 0.3);
      v.push(-s * Math.sin(th) + (rnd() - 0.5) * 0.1 * vc, s * Math.cos(th) + (rnd() - 0.5) * 0.1 * vc, (rnd() - 0.5) * 0.1 * vc);
    }
    toCOM(m, x, v);
    return { m, x, v };
  }
  // 비교: 별 둘(질량 1, 1). 시작 거리 2R, 늘 같은 타원 궤도(이심률 0.5, 가장 먼 곳에서 출발)
  function initial2(R) {
    const r0 = 2 * R, e = 0.5, vrel = Math.sqrt(2 * (1 - e) / r0);
    const m = [1, 1], x = [-r0 / 2, 0, 0, r0 / 2, 0, 0], v = [0, -vrel / 2, 0, 0, vrel / 2, 0];
    return { m, x, v };
  }

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const R = P.dist, soft2 = (C.SOFT * R) ** 2;
    const i3 = initial3(P.seed, P.q, R), i2 = initial2(R);
    const A = makeSys(i3.m, i3.x, i3.v), B = clone(A); B.x[0] += P.eps;
    const A2 = makeSys(i2.m, i2.x, i2.v), B2 = clone(A2); B2.x[0] += P.eps;
    const E0 = energy(A, soft2), E0b = energy(B, soft2), E02 = energy(A2, soft2);
    const S = {
      params: P, A, B, A2, B2, t: 0, done: false, R,
      E0, tDiv: null, tDiv2: null, esc: null, escB: null,   // esc = { body, t }
      diff: P.eps, diff2: P.eps, eErr: 0, eErr2: 0, sub: 0,
      hist: { diff: [P.eps], diff2: [P.eps], r: [[], [], []], rB: [[], [], []] },
      trail: { A: new Float32Array((P.steps + 1) * 9), B: new Float32Array((P.steps + 1) * 9), A2: new Float32Array((P.steps + 1) * 6), B2: new Float32Array((P.steps + 1) * 6) },
    };
    function keep() { const k = S.t, tr = S.trail; tr.A.set(A.x, k * 9); tr.B.set(B.x, k * 9); tr.A2.set(A2.x, k * 6); tr.B2.set(B2.x, k * 6); }
    keep();
    function radii(sys) { const out = []; for (let i = 0; i < sys.n; i++) out.push(Math.sqrt(sys.x[i * 3] ** 2 + sys.x[i * 3 + 1] ** 2 + sys.x[i * 3 + 2] ** 2)); return out; }
    function rec() {
      const ra = radii(A), rb = radii(B);
      for (let i = 0; i < 3; i++) { S.hist.r[i].push(ra[i]); S.hist.rB[i].push(rb[i]); }
      S.hist.diff.push(S.diff); S.hist.diff2.push(S.diff2);
    }
    rec(); S.hist.diff.pop(); S.hist.diff2.pop();   // 0걸음: diff·diff2는 위에서 이미 넣었다
    function step() {
      if (S.done) return false;
      S.sub += advance(A, C.DT, soft2) + advance(B, C.DT, soft2);
      advance(A2, C.DT, soft2); advance(B2, C.DT, soft2);
      S.t++;
      const T = S.t * C.DT;
      S.diff = maxDiff(A, B); S.diff2 = maxDiff(A2, B2);
      if (S.tDiv == null && S.diff > C.DIVERGE) S.tDiv = T;
      if (S.tDiv2 == null && S.diff2 > C.DIVERGE) S.tDiv2 = T;
      const lim = C.ESC * R;
      if (!S.esc) { const e = escaper(A, lim); if (e >= 0) S.esc = { body: e, t: T }; }
      if (!S.escB) { const e = escaper(B, lim); if (e >= 0) S.escB = { body: e, t: T }; }
      S.eErr = Math.max(S.eErr, Math.abs((energy(A, soft2) - E0) / E0), Math.abs((energy(B, soft2) - E0b) / E0b));
      S.eErr2 = Math.max(S.eErr2, Math.abs((energy(A2, soft2) - E02) / E02));
      keep(); if (S.t % C.SAMPLE === 0) rec();
      if (S.t >= P.steps) S.done = true;
      return true;
    }
    S.step = step; S.time = () => S.t * C.DT;
    S.momentum = () => { let p = 0; for (let d = 0; d < 3; d++) { let s = 0; for (let i = 0; i < 3; i++) s += A.m[i] * A.v[i * 3 + d]; p += s * s; } return Math.sqrt(p); };
    return S;
  }
  // 한 판을 끝까지 돌려 요약
  function run(opt) {
    const s = create(opt); while (s.step()) { /* */ }
    return { tDiv: s.tDiv, tDiv2: s.tDiv2, esc: s.esc, escB: s.escB, eErr: s.eErr, eErr2: s.eErr2, sub: s.sub, T: s.params.steps * C.DT };
  }
  return { setHash: (h) => { HASH = h; }, create, run, DEFAULTS, C, mulberry32, energy, advance, makeSys, initial2, initial3 };
});
