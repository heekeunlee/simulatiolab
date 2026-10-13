/*
 * 10년 국채 금리와 채권 가격: 단기금리를 평균회귀 확률과정(Vasicek 1977, Journal of Financial Economics)으로 돌리고,
 * 10년 금리 = (Vasicek 닫힌 해로 구한 수익률) + 기간 프리미엄 으로 정한 뒤, 10년 만기 이표채의 가격 변화를 본다.
 * 이 프로젝트의 단순화된 구현이다. 금리·환율을 맞히려는 모델이 아니고, 기본값은 모두 '예시 숫자'다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 단기금리  dr = a (b - r) dt + sigma dW   (a 회귀 속도/년, b 장기 평균, sigma 변동성/년, 모두 연율)
 * 닫힌 해   P(tau) = exp(A - B r),  B = (1 - e^{-a tau}) / a,  A = (b - sigma^2 / (2 a^2)) (B - tau) - sigma^2 B^2 / (4 a)
 *           수익률(연속복리) y = (B r - A) / tau
 * 입력 단위: r0, b, sig, tp 는 % (예: 3 = 3%), a 는 연율 값.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Treasury = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { r0: 2.5, b: 3.5, a: 0.3, sig: 1, tp: 0.5, n: 400, years: 10, tenor: 10, seed: 1 };
  const DT = 1 / 12; // 한 단계 = 1개월

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const norm = (p) => ({ r0: p.r0 / 100, b: p.b / 100, a: p.a, sig: p.sig / 100, tp: p.tp / 100, tenor: p.tenor });

  // ---------- 닫힌 해 (소수 단위: 0.03 = 3%) ----------
  function Bf(a, tau) { return (1 - Math.exp(-a * tau)) / a; }
  function Af(q, tau) { const B = Bf(q.a, tau); return (q.b - (q.sig * q.sig) / (2 * q.a * q.a)) * (B - tau) - (q.sig * q.sig * B * B) / (4 * q.a); }
  function zcb(q, r, tau) { return Math.exp(Af(q, tau) - Bf(q.a, tau) * r); } // 만기 tau년 무이표채 가격 (액면 1)
  function yieldCC(q, r, tau) { return (Bf(q.a, tau) * r - Af(q, tau)) / tau; } // 연속복리 수익률
  const toAnnual = (y) => Math.expm1(y); // 연속복리 -> 연 복리 (채권 계산용)
  // 모델 10년 금리(연 복리, 소수). 기간 프리미엄은 그대로 더한다
  function tenYield(q, r) { return toAnnual(yieldCC(q, r, q.tenor) + q.tp); }

  // ---------- 10년 만기 이표채 (연 1회 이자, 액면 100) ----------
  function bondPrice(c, y, n) { // c, y: 소수
    n = n || 10; let p = 0;
    for (let t = 1; t <= n; t++) p += (100 * c) / Math.pow(1 + y, t);
    return p + 100 / Math.pow(1 + y, n);
  }
  function macaulay(c, y, n) {
    n = n || 10; let s = 0, p = bondPrice(c, y, n);
    for (let t = 1; t <= n; t++) s += (t * 100 * c) / Math.pow(1 + y, t);
    s += (n * 100) / Math.pow(1 + y, n);
    return s / p;
  }
  const modified = (c, y, n) => macaulay(c, y, n) / (1 + y);

  // 닫힌 해만으로 계산하는 요약 (난수 없음). 이표는 시작 시점 10년 금리에 맞춰 액면가(100)로 산다
  function summary(p) {
    const P = Object.assign({}, DEFAULTS, p), q = norm(P), n = q.tenor;
    const y0 = tenYield(q, q.r0), c = y0;
    const up = bondPrice(c, y0 + 0.01, n) / 100 - 1, dn = bondPrice(c, y0 - 0.01, n) / 100 - 1;
    const mod = modified(c, y0, n);
    const dY = tenYield(q, q.r0 + 0.01) - y0; // 단기금리 +1%p가 10년 금리에 미치는 영향
    const avgExp = q.b + (q.r0 - q.b) * Bf(q.a, n) / n; // 앞으로 n년간 단기금리 예상 평균
    return { y0, c, up, dn, mod, mac: macaulay(c, y0, n), dY, avgExp, ycc: yieldCC(q, q.r0, n), sdStat: q.sig / Math.sqrt(2 * q.a) };
  }

  // ---------- 시뮬레이션 ----------
  function create(p) {
    const P = Object.assign({}, DEFAULTS, p), q = norm(P), N = P.n;
    let months = Math.round(P.years * 12);
    const rng = mulberry32(P.seed * 7919 + 17);
    const gauss = () => { let u = rng(); if (u < 1e-12) u = 1e-12; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const e = Math.exp(-q.a * DT), sd = q.sig * Math.sqrt((1 - Math.exp(-2 * q.a * DT)) / (2 * q.a));
    const R = []; for (let i = 0; i < N; i++) R.push([q.r0]);
    const S = { params: P, q, R, month: 0, shocks: [], y0: tenYield(q, q.r0) };
    S.months = () => months;
    S.extend = (m) => { months += m; };
    S.done = () => S.month >= months;
    S.advance = function () { // 한 달 진행 (정확한 이산화: 오차 없이 Ornstein-Uhlenbeck 전이분포를 쓴다)
      if (S.month >= months) return false;
      for (let i = 0; i < N; i++) { const r = R[i][S.month]; R[i].push(q.b + (r - q.b) * e + sd * gauss()); }
      S.month++; return true;
    };
    S.run = function () { while (S.advance()); return S; };
    S.shock = function (dr) { // 지금 모든 경로의 단기금리를 dr(소수)만큼 올린다
      dr = dr == null ? 0.01 : dr;
      for (let i = 0; i < N; i++) R[i][S.month] += dr;
      S.shocks.push({ month: S.month, dr });
    };
    S.shortAt = (m) => R.map((r) => r[m]);
    S.yieldsAt = (m) => R.map((r) => tenYield(q, r[m]));
    S.priceChangeAt = (m) => R.map((r) => bondPrice(S.y0, tenYield(q, r[m])) / 100 - 1);
    S.expectedShort = function (m) { // 충격을 포함한 단기금리 평균의 이론값
      let v = q.b + (q.r0 - q.b) * Math.exp(-q.a * m * DT);
      S.shocks.forEach((s) => { if (m >= s.month) v += s.dr * Math.exp(-q.a * (m - s.month) * DT); });
      return v;
    };
    return S;
  }

  return { create, summary, DEFAULTS, norm, Bf, Af, zcb, yieldCC, tenYield, bondPrice, macaulay, modified, toAnnual, DT };
});
