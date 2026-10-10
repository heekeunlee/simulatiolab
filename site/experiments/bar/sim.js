/*
 * 엘 파롤 바 문제 (W. Brian Arthur, 1994, "Inductive reasoning and bounded rationality")
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 사람 n명이 매주 "오늘 그 식당(바)에 갈까?"를 정한다. 손님이 정원(cap)을 넘으면 붐벼서 불만족, 아니면 만족
 *  - 각자 "이번 주 손님이 몇 명일까?"를 예측하는 방법을 strategies개 갖고 있다 (지난 8주 기록에 사람마다 다른 비중을 두는 무작위 계산식)
 *  - 가장 최근에 잘 맞힌 예측법으로 이번 주 손님 수를 예측하고, 예측이 정원보다 적으면 간다
 *  - 모든 사람이 "지난주와 같을 것"이라고 예측하는 "모두 같음" 설정과 비교할 수 있다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ElFarol = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 100, cap: 60, strategies: 5, mode: 'diverse', weeks: 200, seed: 1 };

  // 예측법: 지난 MEM주 손님 수에 사람마다 다른 비중을 곱해 더한 값. 비중은 -1~1 사이 무작위라 "지난주 따라가기", "지난주의 반대로 가기",
  // "평균 내기" 같은 다양한 예측이 저절로 생긴다.  예측 = n * clamp(a0 + sum(w_j * (h_j / n - 0.5)))
  const MEM = 8;
  function randomPredictor(rng) {
    const w = Array.from({ length: MEM }, () => (rng() * 2 - 1) / 2), a0 = rng();
    return (h, n) => {
      let x = a0;
      for (let j = 1; j <= MEM; j++) x += w[j - 1] * (h[h.length - j] / n - 0.5);
      return n * clamp(x, 0, 1);
    };
  }
  const lastWeek = (h) => h[h.length - 1];
  function avg(h, k) { let s = 0; for (let i = 1; i <= k; i++) s += h[h.length - i]; return s / k; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

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
    const rng = mulberry32(p.seed * 17 + 3);
    const n = p.n;
    const mine = [], score = [];
    for (let i = 0; i < n; i++) {
      if (p.mode === 'same') { mine.push([lastWeek]); score.push([0]); continue; }
      mine.push(Array.from({ length: p.strategies }, () => randomPredictor(rng))); score.push(new Array(p.strategies).fill(0));
    }
    const h = [];
    for (let k = 0; k < 20; k++) h.push(Math.round(clamp(n * 0.5 + (rng() - 0.5) * 0.3 * n, 0, n))); // 처음 20주 기록
    const sim = {
      params: p, n, weeks: 0, done: false, hist: [], regretHist: [], went: new Uint8Array(n), regret: new Uint8Array(n), crowded: false,
      advance() {
        if (sim.done) return false;
        let att = 0; const go = sim.went;
        for (let i = 0; i < n; i++) {
          let best = 0;
          for (let s = 1; s < mine[i].length; s++) if (score[i][s] < score[i][best]) best = s;
          const pred = mine[i][best](h, n);
          go[i] = pred < p.cap ? 1 : 0; att += go[i];
        }
        sim.crowded = att > p.cap; let wrong = 0;
        for (let i = 0; i < n; i++) {
          sim.regret[i] = (go[i] && sim.crowded) || (!go[i] && !sim.crowded) ? 1 : 0; wrong += sim.regret[i];
          for (let s = 0; s < mine[i].length; s++) score[i][s] = 0.9 * score[i][s] + Math.abs(mine[i][s](h, n) - att);
        }
        h.push(att); sim.hist.push(att); sim.regretHist.push(wrong / n); sim.weeks++;
        if (sim.weeks >= p.weeks) sim.done = true;
        return true;
      },
      summary(from) {
        const a = sim.hist.slice(from == null ? Math.floor(sim.hist.length / 2) : from);
        if (!a.length) return { mean: 0, std: 0, regret: 0 };
        const m = a.reduce((x, y) => x + y, 0) / a.length;
        const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
        const r = sim.regretHist.slice(sim.regretHist.length - a.length);
        return { mean: m, std: sd, regret: r.reduce((x, y) => x + y, 0) / r.length, attend: a };
      },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  function measure(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 3 })).run().summary());
    return out;
  }

  return { DEFAULTS, create, measure };
});
