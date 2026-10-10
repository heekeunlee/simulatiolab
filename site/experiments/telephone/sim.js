/*
 * 이야기는 전해지며 어떻게 변할까: 전달 사슬(연쇄 재현) 모델
 * 바틀릿(Bartlett 1932, "Remembering")의 "유령들의 전쟁" 실험과 문화 진화 실험에서 발상을 얻은 이 프로젝트의 단순화 구현
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 이야기 = 모티프(사건·세부 내용) M개의 목록. 모티프마다 숨은 "기억용이성" m(0~1)이 있다.
 *    30%는 생생한 모티프(m 0.7~1), 70%는 평범한 모티프(m 0.15~0.6). 25%는 "튀는 세부"(odd)이다
 *  - 같은 원본 이야기에서 시작하는 사슬이 chains개 있고, 각 사슬은 전달자가 차례로 이야기를 다시 말한다
 *  - 전달자 한 명은 이야기를 이렇게 바꾼다
 *      1) 모티프마다 확률 1-(1-memory)*(1.5*(1-m)+0.1)로 기억해 낸다 (기억용이성이 높을수록 잘 남음). 3개 미만이면 가장 기억에 남는 3개를 유지
 *      2) 튀는 세부는 확률 convention으로 평범하고 익숙한 모티프(m=0.5)로 바뀐다 (관습화)
 *      3) 확률 creativity로 새 모티프를 하나 지어 붙인다 (같은 분포에서 뽑음)
 *      4) 확률 0.1로 이웃한 두 모티프의 순서가 바뀐다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Telephone = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { M: 30, chains: 12, gens: 40, memory: 0.96, creativity: 0.3, convention: 0.3, seed: 1 };

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
    const rng = mulberry32(p.seed * 6151 + 29);
    let nextId = 0;
    const newMotif = (orig) => {
      const vivid = rng() < 0.3;
      return { id: nextId++, m: vivid ? 0.7 + 0.3 * rng() : 0.15 + 0.45 * rng(), odd: rng() < 0.25, orig: !!orig };
    };
    const original = Array.from({ length: p.M }, () => newMotif(true));
    const origIds = new Set(original.map((x) => x.id));
    const chains = Array.from({ length: p.chains }, () => original.map((x) => Object.assign({}, x)));

    function tell(story) {
      let kept = story.filter((mo) => rng() < 1 - (1 - p.memory) * (1.5 * (1 - mo.m) + 0.1));
      if (kept.length < 3) {
        const top = story.slice().sort((a, b) => b.m - a.m).slice(0, 3).map((x) => x.id);
        kept = story.filter((mo) => top.indexOf(mo.id) >= 0);
      }
      kept = kept.map((mo) => (mo.odd && rng() < p.convention ? { id: nextId++, m: 0.5, odd: false, orig: false } : mo));
      if (rng() < p.creativity) { const mo = newMotif(false), at = Math.floor(rng() * (kept.length + 1)); kept.splice(at, 0, mo); }
      if (kept.length > 1 && rng() < 0.1) { const i = Math.floor(rng() * (kept.length - 1)); const t = kept[i]; kept[i] = kept[i + 1]; kept[i + 1] = t; }
      return kept;
    }

    const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    function measure() {
      const surv = [], len = [], mem = [], frac = [], sets = [];
      chains.forEach((s) => {
        const ids = s.filter((x) => origIds.has(x.id)).map((x) => x.id);
        sets.push(new Set(ids)); surv.push(ids.length / p.M); len.push(s.length); mem.push(avg(s.map((x) => x.m))); frac.push(ids.length / s.length);
      });
      // 사슬 쌍마다 남은 원래 모티프 집합의 자카드 유사도
      let jsum = 0, jn = 0;
      for (let a = 0; a < sets.length; a++) for (let b = a + 1; b < sets.length; b++) {
        let inter = 0; sets[a].forEach((x) => { if (sets[b].has(x)) inter++; });
        const uni = sets[a].size + sets[b].size - inter;
        if (uni > 0) { jsum += inter / uni; jn++; }
      }
      const s = avg(surv);
      return { surv, len, mem, frac, survMean: s, lenMean: avg(len), memMean: avg(mem), fracMean: avg(frac), jac: jn ? jsum / jn : 1, jacChance: s / (2 - s) };
    }

    const sim = {
      params: p, chains, original, gen: 0, done: false, history: [], origMem: avg(original.map((x) => x.m)),
      advance() {
        if (sim.done) return false;
        for (let c = 0; c < chains.length; c++) chains[c] = tell(chains[c]);
        sim.gen++; sim.history.push(measure());
        if (sim.gen >= p.gens) sim.done = true;
        return true;
      },
      current() { return sim.history.length ? sim.history[sim.history.length - 1] : measure(); },
      run() { while (sim.advance()); return sim; },
    };
    sim.history.push(measure());
    return sim;
  }

  // 같은 설정을 다른 시드로 여러 번 돌려 마지막 세대의 요약을 얻는다
  function finals(opts, runs, seedBase) {
    const out = [];
    for (let k = 0; k < runs; k++) { const s = create(Object.assign({}, opts, { seed: (seedBase || 400) + k })).run(); out.push(s.current()); }
    return out;
  }

  return { DEFAULTS, create, finals };
});
