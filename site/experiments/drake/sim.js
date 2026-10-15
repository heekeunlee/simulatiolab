// 드레이크 방정식과 페르미 역설: 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32).
// (1) 몬테카를로: 드레이크 방정식 7개 항을 각각 "범위"로 받아(로그 눈금에서 고르게) 1만 번 뽑아 곱한다 → 지금 신호를 내는 문명 수 N의 분포.
// (2) 가상 은하: 범위의 가운데 값(로그 눈금)으로 1년에 문명이 생기는 빠르기 B = R*·fp·ne·fl·fi·fc 와 수명 L을 정하고,
//     지름 10만 광년의 납작한 원반에 문명을 무작위로 생겼다(포아송) 사라지게(L년 뒤) 한다. 신호는 빛의 속도(1년에 1광년).
//     지표: 지금 동시에 켜진 문명 수, 가장 가까운 이웃까지 신호 왕복 시간, "보낸 신호에 답장을 받은" 문명 비율.
// 모든 범위·크기는 이 프로젝트가 고른 예시 설정이며 관측값이 아니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Drake = factory();
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
  // 7개 항. c = 슬라이더 기본 가운데(log10), w = 범위 반폭(log10, "모르는 정도" 100%일 때), max = 위 한계(log10; 비율은 1을 넘지 않음)
  const TERMS = [
    { id: 'rs', c: 0.3, w: 0.3, min: 0, max: 99 },     // 1년에 새로 생기는 별 수: 1~4개
    { id: 'fp', c: -0.3, w: 0.3, min: -99, max: 0 },   // 행성을 가진 별의 비율: 0.25~1
    { id: 'ne', c: -0.5, w: 0.5, min: -99, max: 0 },   // 별 하나에 생명이 살 만한 행성 수: 0.1~1
    { id: 'fl', c: -1, w: 1, min: -99, max: 0 },       // 그 행성에 생명이 생길 비율: 0.01~1
    { id: 'fi', c: -1, w: 1, min: -99, max: 0 },       // 생명이 지능으로 이어질 비율: 0.01~1
    { id: 'fc', c: -0.5, w: 0.5, min: -99, max: 0 },   // 지능이 신호를 보내는 기술 문명이 될 비율: 0.1~1
    { id: 'L', c: 4, w: 2, min: 0, max: 99 },          // 문명이 신호를 내는 기간(수명, 년): 100~1,000,000년
  ];
  const G = { R: 50000, H: 10000, Z: 300, RING: 100000 };   // 은하 원반 반지름·규모 길이·두께(광년), 신호 고리를 그리는 최대 반지름
  const DEFAULTS = { rs: 3, fp: -3, ne: -5, fl: -10, fi: -10, fc: -5, L: 40, u: 100, seed: 1 };   // 슬라이더 값(log10 × 10), u = 모르는 정도(%)

  // 슬라이더 값 → 항마다 [lo, hi] (log10)
  function ranges(p) {
    const u = (p.u == null ? 100 : p.u) / 100;
    return TERMS.map((t) => {
      const c = (p[t.id] == null ? t.c * 10 : p[t.id]) / 10, w = p.fix === t.id ? 0 : t.w * u;   // fix: 그 항만 정확히 안다고 치고 폭 0
      let lo = Math.max(t.min, c - w), hi = Math.min(t.max, c + w);
      if (lo > hi) lo = hi;
      return { id: t.id, lo, hi, mid: (lo + hi) / 2 };
    });
  }
  // 몬테카를로: n번 뽑아 log10 N 분포
  function monteCarlo(p, n, seed) {
    const R = ranges(p), rnd = mulberry32((seed || 1) * 7919 + 13), out = new Float64Array(n || 10000);
    for (let k = 0; k < out.length; k++) { let s = 0; for (const r of R) s += r.lo + (r.hi - r.lo) * rnd(); out[k] = s; }
    const sorted = Array.from(out).sort((a, b) => a - b), q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
    let alone = 0, many = 0; for (const v of sorted) { if (v < 0) alone++; if (v >= 3) many++; }
    // 로그 눈금에서 항마다 흔드는 몫: 서로 독립인 고른 분포라 분산이 그대로 더해진다(폭²/12)
    const vars = R.map((r) => (r.hi - r.lo) ** 2 / 12), vt = vars.reduce((a, b) => a + b, 0) || 1;
    return { logs: sorted, median: q(0.5), p10: q(0.1), p90: q(0.9), pAlone: alone / sorted.length, pMany: many / sorted.length,
      share: R.map((r, i) => ({ id: r.id, v: vars[i] / vt })), ranges: R, midLog: R.reduce((a, r) => a + r.mid, 0) };
  }
  // 은하 3D용: 가운데 값에서 생기는 빠르기 B(1년에)와 수명 L(년)
  function rates(p) {
    const R = ranges(p), L = Math.pow(10, R[6].mid);
    let lb = 0; for (let i = 0; i < 6; i++) lb += R[i].mid;
    return { B: Math.pow(10, lb), L };
  }

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32(P.seed * 2654435761 >>> 0 || 1);
    const { B, L } = P.B != null ? P : rates(P);
    const CAP = P.cap || 3000, steps = P.steps || 300;
    const expect = B * L;                       // 평균적으로 동시에 켜져 있을 문명 수(꾸준한 상태)
    const m = expect > CAP ? expect / CAP : 1;  // 너무 많으면 점 하나가 문명 m개를 대신한다(거리는 1/√m로 어림)
    const Bt = B / m, scale = 1 / Math.sqrt(m);
    const T = Math.max(2 * L, 40 / B), dt = T / steps;
    function pos() {
      let r; do { r = -G.H * Math.log((rnd() || 1e-9) * (rnd() || 1e-9)); } while (r > G.R);   // 지수 원반(가운데가 빽빽)
      const a = rnd() * Math.PI * 2, u1 = rnd() || 1e-9, z = G.Z * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rnd());
      return [r * Math.cos(a), r * Math.sin(a), z];
    }
    function poisson(lam) {
      if (lam <= 0) return 0;
      if (lam > 40) return Math.max(0, Math.round(lam + Math.sqrt(lam) * Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())));
      const e = Math.exp(-lam); let k = 0, q = 1; do { k++; q *= rnd(); } while (q > e); return k - 1;
    }
    const civs = [];   // {x,y,z,b,e,ans}
    function born(b) { const p = pos(); civs.push({ x: p[0], y: p[1], z: p[2], b, e: b + L, ans: null }); }
    // 처음부터 꾸준한 상태: 지난 L년(신호 고리를 위해 조금 더) 동안 생긴 문명을 미리 놓는다
    const back = Math.max(L, Math.min(G.RING, 150 / Bt));
    { const k = poisson(Bt * back); const bs = []; for (let i = 0; i < k; i++) bs.push(-back * rnd()); bs.sort((a, b) => a - b).forEach(born); }
    const S = { params: P, B, L, T, dt, m, scale, expect, civs, t: 0, step: 0, steps, done: false,
      alive: [], hist: { n: [], rt: [], ans: [] }, died: 0, answered: 0, last: null };
    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2) * scale;
    // i가 보낸 신호에 누군가 답해서 그 답이 i가 살아 있을 때 돌아왔나: 2d ≤ L 이고 [b_i+d, e_i−d]와 [b_j, e_j]가 겹친다
    function checkAnswer(i) {
      for (let k = 0; k < civs.length; k++) {
        const j = civs[k]; if (j === i || j.b >= i.e || j.e <= i.b) continue;
        const d = dist(i, j); if (2 * d > L) continue;
        if (Math.max(i.b + d, j.b) <= Math.min(i.e - d, j.e)) return true;
      }
      return false;
    }
    let pruneAt = 0;
    function measure() {
      const t = S.t, al = civs.filter((c) => c.b <= t && c.e > t); S.alive = al;
      let rt = null;
      if (al.length >= 2) {
        const qs = al.length <= 400 ? al : al.filter((_, i) => i % Math.ceil(al.length / 300) === 0);
        let s = 0; for (const a of qs) { let best = Infinity; for (const b of al) { if (a === b) continue; const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; if (d < best) best = d; } s += Math.sqrt(best) * scale; }
        rt = 2 * s / qs.length;   // 왕복 = 거리의 2배(년)
      }
      const n = al.length * m;
      S.last = { n, rt, ans: S.died ? S.answered / S.died : null };
      S.hist.n.push(n); S.hist.rt.push(rt); S.hist.ans.push(S.last.ans);
    }
    S.advance = function () {
      if (S.done) return false;
      const t0 = S.t, t1 = t0 + dt, k = poisson(Bt * dt);
      const bs = []; for (let i = 0; i < k; i++) bs.push(t0 + dt * rnd()); bs.sort((a, b) => a - b).forEach(born);
      S.t = t1; S.step++;
      // 이번 걸음에 사라진 문명: 답장을 받았는지 판정 (그 문명보다 늦게 생긴 문명은 판정에 상관없음)
      for (const c of civs) if (c.ans === null && c.e <= t1) {
        if (c.e <= 0) { c.ans = false; continue; }   // 시작 전에 사라진 문명(고리만 남음)은 세지 않는다
        c.ans = checkAnswer(c); S.died++; if (c.ans) S.answered++;
      }
      // 더는 필요 없는 오래된 문명 정리(신호 고리도 다 퍼졌고, 판정 후보도 아님)
      if (S.step - pruneAt > 20) { pruneAt = S.step; const cut = t1 - Math.max(2 * L, G.RING); for (let i = civs.length - 1; i >= 0; i--) if (civs[i].e < cut && civs[i].ans !== null) civs.splice(i, 1); }
      measure();
      if (S.step >= steps) S.done = true;
      return true;
    };
    S.step = 0;
    for (const c of civs) if (c.e <= 0) c.ans = false;
    measure();
    return S;
  }
  // 집계용: 한 판 끝까지
  function summary(opt) {
    const s = create(opt); while (s.advance()) {}
    const H = s.hist, n = H.n.reduce((a, b) => a + b, 0) / H.n.length, rts = H.rt.filter((v) => v != null);
    return { n, expect: s.expect, rt: rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null, rtShare: rts.length / H.rt.length, ans: s.died ? s.answered / s.died : 0, died: s.died, m: s.m, B: s.B, L: s.L };
  }
  return { create, summary, monteCarlo, ranges, rates, TERMS, G, DEFAULTS, mulberry32 };
});
