/*
 * 평균으로의 회귀: "칭찬했더니 다음엔 못하고, 혼냈더니 다음엔 잘하더라"
 * (Kahneman의 비행 교관 일화를 이 프로젝트가 단순화해 다시 만든 모델. 실험 결과를 재현한 것이 아님)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - 사람마다 변하지 않는 실력(skill)이 있고, 시도마다 새로 뽑히는 운(noise)이 있다. 둘 다 표준정규분포
 *  - 점수 = 50 + 10 × (sqrt(1 - luck) × 실력 + sqrt(luck) × 운).  luck = 점수 흩어짐 중 운이 차지하는 몫
 *    그러면 1회와 2회 점수의 상관(= 신뢰도)은 정확히 1 - luck 이고, 두 점수의 흩어짐은 같다
 *  - 1회 뒤 상위 cut 비율은 칭찬, 하위 cut 비율은 혼내기. 나머지는 아무 말도 듣지 않는다
 *  - 2회 점수에 진짜 효과를 더한다. 'coach' 장면: 칭찬받은 쪽 +eff, 혼난 쪽 -eff (eff = 0이면 말은 아무 효과가 없다)
 *    'sports' 장면: 상위(표지) 쪽에만 +eff, 하위는 0
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Regression = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 400, luck: 0.5, cut: 0.2, eff: 0, view: 'coach', seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gaussFrom = (rng) => () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };

  // 표준정규 분포함수 (Abramowitz-Stegun 7.1.26) 와 역함수(이분법)
  function Phi(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  function invPhi(p) { let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }

  const groupSize = (p) => Math.max(1, Math.min(Math.floor(p.n / 2), Math.round(p.cut * p.n)));

  // 이론값: 큰 표본에서 상위(하위) cut 비율 집단의 1회 평균, 2회 평균 변화
  function theory(opts) {
    const p = Object.assign({}, DEFAULTS, opts), rho = 1 - p.luck;
    const tail = phi(invPhi(1 - p.cut)) / p.cut * 10;        // 상위 집단의 1회 평균이 50보다 높은 만큼
    const topEff = p.eff, botEff = p.view === 'sports' ? 0 : -p.eff;
    const top = -(1 - rho) * tail + topEff, bot = (1 - rho) * tail + botEff;
    return { rho, tail, top, bot, gap: bot - top, trueGap: botEff - topEff, slope: rho };
  }

  // 한 번의 표본: 점수와 집단(+1 상위, -1 하위, 0 나머지)
  function generate(p, rng, gauss) {
    const n = p.n, a = Math.sqrt(1 - p.luck), b = Math.sqrt(p.luck);
    const skill = new Float64Array(n), s1 = new Float64Array(n), s2 = new Float64Array(n), grp = new Int8Array(n);
    for (let i = 0; i < n; i++) { skill[i] = gauss(); s1[i] = 50 + 10 * (a * skill[i] + b * gauss()); s2[i] = 50 + 10 * (a * skill[i] + b * gauss()); }
    const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => s1[x] - s1[y]), k = groupSize(p);
    for (let j = 0; j < k; j++) { grp[order[j]] = -1; grp[order[n - 1 - j]] = 1; }
    const topEff = p.eff, botEff = p.view === 'sports' ? 0 : -p.eff;
    for (let i = 0; i < n; i++) { if (grp[i] === 1) s2[i] += topEff; else if (grp[i] === -1) s2[i] += botEff; }
    return { skill, s1, s2, grp };
  }

  // 지금까지 보인 count명에 대한 요약
  function summarize(d, count) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    const g = { 1: [0, 0, 0], '-1': [0, 0, 0], 0: [0, 0, 0] };
    for (let i = 0; i < count; i++) {
      const x = d.s1[i], y = d.s2[i]; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
      const e = g[d.grp[i]]; e[0]++; e[1] += y - x; e[2] += x;
    }
    const n = count, vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cxy = sxy - sx * sy / n;
    const slope = n > 1 && vx > 0 ? cxy / vx : 0, corr = n > 1 && vx > 0 && vy > 0 ? cxy / Math.sqrt(vx * vy) : 0;
    const m = (e) => (e[0] ? e[1] / e[0] : 0);
    const top = m(g[1]), bot = m(g[-1]);
    return { n, slope, corr, intercept: n ? (sy - slope * sx) / n : 0, top, bot, mid: m(g[0]), gap: bot - top, nTop: g[1][0], nBot: g[-1][0] };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 8191 + 3), gauss = gaussFrom(rng);
    const d = generate(p, rng, gauss);
    const sim = {
      params: p, data: d, shown: 0,
      advance() { if (sim.shown >= p.n) return false; sim.shown++; return true; },
      done() { return sim.shown >= p.n; },
      summary() { return summarize(d, sim.shown); },
      run() { sim.shown = p.n; return sim; },
    };
    return sim;
  }

  // 같은 설정으로 표본을 여러 번 만들어 평균. 모양을 그리지 않는 빠른 버전
  function study(opts, reps, seedBase) {
    const p = Object.assign({}, DEFAULTS, opts), rng = mulberry32((seedBase || 77) * 131 + 5), gauss = gaussFrom(rng);
    let top = 0, bot = 0, mid = 0, slope = 0, corr = 0, gapPos = 0;
    for (let r = 0; r < reps; r++) {
      const s = summarize(generate(p, rng, gauss), p.n);
      top += s.top; bot += s.bot; mid += s.mid; slope += s.slope; corr += s.corr; if (s.gap > 0) gapPos++;
    }
    return { top: top / reps, bot: bot / reps, mid: mid / reps, gap: (bot - top) / reps, slope: slope / reps, corr: corr / reps, gapPos: gapPos / reps };
  }

  return { DEFAULTS, mulberry32, create, study, theory, generate, summarize, Phi, invPhi };
});
