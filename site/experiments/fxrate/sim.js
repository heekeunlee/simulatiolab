/*
 * 캐리 트레이드와 환율: 금리가 높은 통화를 사는 거래가 "계단으로 오르고 엘리베이터로 떨어지는" 이유.
 * 비커버드 이자율 평가(UIP)와 UIP 퍼즐(Fama 1984)을 배경으로 한, 이 프로젝트의 단순화된 모델이다. 예측 도구가 아니다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 한 걸음 = 1주. 환율 x = 높은 금리 통화의 가치(자금 조달 통화 기준)의 로그. 높을수록 높은 금리 통화가 강하다.
 *  - UIP가 완전히 맞다면 높은 금리 통화는 금리차만큼 평균적으로 약해진다: 주간 기대 변화 = -diff/52.
 *    uip(0~1)는 그 상쇄가 실제로 일어나는 비율이다. 0이면 임의보행(상쇄 없음), 1이면 UIP 그대로.
 *  - 캐리 투자자 쏠림 c(0~1): 캐리가 매력적일수록(금리차/변동성) 로지스틱하게 늘어난다. 늘 때는 높은 금리 통화를
 *    조금씩 사들여 환율을 imp*Δc 만큼 밀어 올린다(계단). 쏠림이 클수록 한 주에 일제히 청산할 확률이 커지고,
 *    청산하면 c가 한꺼번에 줄며 환율이 imp*Δc(음수)만큼 떨어진다(엘리베이터).
 *  - 캐리 수익(레버리지 없는 1단위 기준, 주간) = 금리차/52 + 환율 변화율
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FxRate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { diff: 4, vol: 8, uip: 0.3, imp: 0.12, years: 20, seed: 1, c0: 0.1, h0: 0.0004, h1: 0.02, grow: 0.06 };
  const W = 52;

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
    const rng = mulberry32(p.seed * 7919 + 13);
    const normal = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const N = Math.round(p.years * W), sigW = p.vol / 100 / Math.sqrt(W), inc = p.diff / 100 / W, drift = -p.uip * inc;
    const A = p.vol > 0 ? p.diff / p.vol : 0, r = p.grow * A;
    const sim = { params: p, N, week: 0, x: [0], c: [p.c0], pnl: [0], ret: [], crashes: [] };
    let x = 0, c = p.c0, pnl = 0;
    function stepOne() {
      if (sim.week >= N) return false;
      const c0 = c;
      const h = p.h0 + p.h1 * c * c * c;
      let crash = false;
      if (p.imp > 0 && c > 0.15 && rng() < h) {
        crash = true; const u = 0.5 + 0.4 * rng(); c = c * (1 - u);
      } else {
        c = c + r * (0.5 + rng()) * c * (1 - c);
        if (c < 0.02) c = 0.02;
      }
      const dx = drift + p.imp * (c - c0) + sigW * normal();
      const R = inc + dx;
      x += dx; pnl += R;
      sim.week++; sim.x.push(x); sim.c.push(c); sim.pnl.push(pnl); sim.ret.push(R);
      if (crash) sim.crashes.push({ week: sim.week, ret: R });
      return true;
    }
    sim.step = function (k) { let ok = false; for (let i = 0; i < (k || 1); i++) ok = stepOne() || ok; return ok; };
    sim.advance = () => sim.step(4);
    sim.done = () => sim.week >= N;
    sim.run = () => { while (stepOne()); return sim; };
    return sim;
  }

  // ---------- 요약 통계 ----------
  function stats(ret, pnlArr) {
    const n = ret.length; let m = 0; ret.forEach((v) => { m += v; }); m /= n;
    let s2 = 0, s3 = 0; ret.forEach((v) => { const d = v - m; s2 += d * d; s3 += d * d * d; });
    const sd = Math.sqrt(s2 / n), skew = sd > 0 ? s3 / n / (sd * sd * sd) : 0;
    let worst = Infinity, pos = 0; ret.forEach((v) => { if (v < worst) worst = v; if (v > 0) pos++; });
    let peak = 0, dd = 0;
    pnlArr.forEach((v) => { if (v > peak) peak = v; if (peak - v > dd) dd = peak - v; });
    return { mean: m, sd, skew, worst, dd, posShare: pos / n, annMean: m * W, annSd: sd * Math.sqrt(W), worstOverMean: m > 0 ? -worst / m : null };
  }
  function simStats(sim) { return stats(sim.ret, sim.pnl); }

  // 여러 경로(시드)를 돌려 평균을 낸다
  function ensemble(base, paths, seed0) {
    const out = { rets: [], stats: [] };
    for (let k = 0; k < paths; k++) {
      const s = create(Object.assign({}, base, { seed: (seed0 || 100) + k })).run();
      out.rets.push(s.ret); out.stats.push(simStats(s));
    }
    const avg = (f) => out.stats.reduce((a, b) => a + f(b), 0) / paths;
    out.annMean = avg((s) => s.annMean); out.dd = avg((s) => s.dd); out.skew = avg((s) => s.skew); out.worst = avg((s) => s.worst);
    out.sd = avg((s) => s.sd); out.posShare = avg((s) => s.posShare);
    return out;
  }

  // 금리차를 바꿔 가며 훑기: 평균 연 캐리 수익, 평균 최대 낙폭, 평균 최악의 주 손실
  function sweepDiff(base, diffs, paths) {
    return diffs.map((d) => { const e = ensemble(Object.assign({}, base, { diff: d }), paths, 500); return { x: d, mean: e.annMean * 100, dd: e.dd * 100, loss: -e.worst * 100, skew: e.skew }; });
  }

  // 이론: 쏠림 없이 UIP가 uip 비율만큼 성립할 때 주간 기대 캐리 수익과 연 기대 수익
  function theoryMean(p) { p = Object.assign({}, DEFAULTS, p); return { weekly: (1 - p.uip) * p.diff / 100 / W, annual: (1 - p.uip) * p.diff / 100 }; }

  return { DEFAULTS, W, create, stats, simStats, ensemble, sweepDiff, theoryMean };
});
