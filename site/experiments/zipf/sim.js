/*
 * 왜 소수의 단어만 자주 쓰일까: 지프의 법칙 (Zipf 1949)과 사이먼의 "부익부" 모델 (Simon 1955)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 글을 한 단어씩 이어 쓴다. 매 단계 확률 novelty로 지금까지 없던 새 단어를 만들고,
 *    아니면 기존 단어를 다시 쓴다
 *  - mode = 'copy': 지금까지 쓴 글에서 무작위 위치의 단어를 그대로 베낀다 (많이 쓴 단어일수록 베껴질 확률이 크다 = 부익부)
 *  - mode = 'uniform': 지금까지 나온 서로 다른 단어 중 하나를 똑같은 확률로 고른다 (대조군)
 *  - 순위-빈도 그래프의 기울기는 로그-로그 축에서 최소제곱으로 구한다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Zipf = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { novelty: 0.03, mode: 'copy', total: 100000, batch: 2500, batchFrac: 0.03, batchMin: 8, seed: 1, fitFrom: 3, fitTo: 200 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 단어 번호를 읽을 수 있는 가짜 단어로 (음절 조합). 같은 번호는 늘 같은 단어
  const ON = ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z', 'ch', 'sh', 'th'];
  const VO = ['a', 'e', 'i', 'o', 'u', 'ar', 'en', 'ia'];
  function wordName(id) {
    let x = (id + 1) * 2654435761 >>> 0, s = '';
    const syl = 1 + (id < 30 ? 0 : id < 400 ? 1 : 2) + (x % 3 === 0 ? 1 : 0);
    for (let i = 0; i < Math.min(3, syl); i++) { s += ON[x % ON.length]; x = Math.imul(x ^ (x >>> 7), 40503) >>> 0; s += VO[x % VO.length]; x = Math.imul(x ^ (x >>> 11), 2246822519) >>> 0; }
    return s;
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 8191 + 3);
    const tokens = new Int32Array(p.total), counts = [];
    const sim = {
      params: p, n: 0, counts, tokens, newAt: [], done: false,
      addOne() {
        let id;
        if (sim.n === 0 || rng() < p.novelty) { id = counts.length; counts.push(0); sim.newAt.push(sim.n); }
        else if (p.mode === 'copy') id = tokens[Math.floor(rng() * sim.n)];
        else id = Math.floor(rng() * counts.length);
        counts[id]++; tokens[sim.n++] = id;
        return id;
      },
      advance() {
        if (sim.done) return false;
        // 처음에는 몇 단어씩(눈으로 따라갈 수 있게), 글이 길어질수록 지금 길이의 3%씩 (최대 batch) — 결과 수치에는 영향 없음
        const m = Math.min(p.batch, Math.max(p.batchMin, Math.round(sim.n * p.batchFrac)), p.total - sim.n);
        for (let k = 0; k < m; k++) sim.addOne();
        if (sim.n >= p.total) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
      // 빈도 내림차순 [{id, count}]
      ranked() { return counts.map((c, id) => ({ id, count: c })).sort((a, b) => b.count - a.count || a.id - b.id); },
      summary() {
        const r = sim.ranked(), n = sim.n || 1;
        const share = (k) => r.slice(0, k).reduce((s, x) => s + x.count, 0) / n;
        const hi = Math.min(p.fitTo, r.length), lo = Math.max(1, Math.min(p.fitFrom, hi - 2));
        let sx = 0, sy = 0, sxx = 0, sxy = 0, m = 0;
        for (let k = lo; k <= hi; k++) { const x = Math.log10(k), y = Math.log10(r[k - 1].count); sx += x; sy += y; sxx += x * x; sxy += x * y; m++; }
        const slope = m > 2 ? (m * sxy - sx * sy) / (m * sxx - sx * sx) : NaN;
        const icpt = m > 2 ? (sy - slope * sx) / m : 0;
        return { ranked: r, vocab: r.length, top10: share(10), top100: share(100), slope, icpt, fitFrom: lo, fitTo: hi };
      },
    };
    sim.addOne(); // 첫 단어로 시작 (빈 글이 없도록)
    return sim;
  }

  function slopes(opts, runs, seedBase) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(create(Object.assign({}, opts, { seed: (seedBase || 700) + k })).run().summary());
    return out;
  }

  return { DEFAULTS, create, slopes, wordName };
});
