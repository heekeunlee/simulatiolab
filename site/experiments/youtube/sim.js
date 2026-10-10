/*
 * 구독자 쏠림 모델: 인기에 끌리는 선택 (선호적 연결, Barabási-Albert 계열) + Salganik 외(2006) 음악 실험의 발상
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 채널 n개, 채널마다 품질 q (로그정규분포, 높을수록 좋은 콘텐츠). 품질은 qseed로 고정되어 "같은 채널 세트"를 만든다
 *  - 한 라운드에 시청자 perRound명이 와서 각자 한 채널을 구독한다
 *  - 시청자는 확률 social로 인기 순 추천을 따른다: 구독자+1에 비례해 후보 2개를 뽑고 더 큰 쪽을 추천받는다.
 *    나머지는 품질에 비례해 고른다
 *  - seed를 바꾸면 같은 채널 세트에서 우연만 다른 "평행우주"가 된다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Youtube = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 200, perRound: 100, rounds: 150, social: 0.7, seed: 1, qseed: 7 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ranks(values) { // 큰 값이 1등
    const idx = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);
    const r = new Array(values.length); idx.forEach((i, k) => { r[i] = k + 1; });
    return r;
  }
  function spearman(a, b) {
    const ra = ranks(a), rb = ranks(b), n = a.length;
    const ma = (n + 1) / 2; let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; }
    return num / Math.sqrt(da * db);
  }

  function qualities(n, qseed) {
    const r = mulberry32(qseed * 9973 + n);
    return Array.from({ length: n }, () => {
      let u = 0; while (u === 0) u = r();
      return Math.exp(0.5 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()));
    });
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 7919 + 1);
    const n = p.n, q = qualities(n, p.qseed);
    const cum = []; q.reduce((s, x, i) => (cum[i] = s + x), 0);
    const totalQ = cum[n - 1];
    const byQuality = () => {
      const x = rng() * totalQ; let lo = 0, hi = n - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] >= x) hi = mid; else lo = mid + 1; }
      return lo;
    };
    const subs = new Array(n).fill(0), events = [];
    const qrank = ranks(q);
    const sim = {
      params: p, n, q, subs, qrank, round: 0, done: false, history: [],
      advance() {
        if (sim.done) return false;
        for (let k = 0; k < p.perRound; k++) {
          let c;
          if (rng() < p.social) {
            const pick = () => { const r = Math.floor(rng() * (events.length + n)); return r < n ? Math.floor(rng() * n) : events[r - n]; };
            const a = pick(), b = pick();       // 인기 후보 2개 중 구독자가 더 많은 쪽을 추천 (알고리즘의 인기 편향)
            c = subs[a] >= subs[b] ? a : b;
          } else c = byQuality();
          subs[c]++; events.push(c);
        }
        sim.round++;
        sim.history.push(Math.max(...subs));
        if (sim.round >= p.rounds) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
      summary() {
        const total = subs.reduce((a, b) => a + b, 0) || 1;
        const order = subs.map((_, i) => i).sort((a, b) => subs[b] - subs[a]);
        const top = order[0], k10 = Math.max(1, Math.round(n * 0.1));
        let s10 = 0; for (let i = 0; i < k10; i++) s10 += subs[order[i]];
        const best = q.indexOf(Math.max(...q));
        return {
          top, topSubs: subs[top], topQualityRank: qrank[top], order,
          corr: spearman(q, subs), top1Share: subs[top] / total, top10Share: s10 / total,
          bestQualityPlace: order.indexOf(best) + 1, total,
        };
      },
    };
    return sim;
  }

  // 같은 채널 세트에서 우연만 다른 여러 세계
  function worlds(opts, k, seedBase) {
    const out = [];
    for (let i = 0; i < k; i++) { const s = create(Object.assign({}, opts, { seed: (seedBase || 50) + i })).run(); out.push(s.summary()); }
    return out;
  }

  return { DEFAULTS, create, worlds, spearman, ranks };
});
