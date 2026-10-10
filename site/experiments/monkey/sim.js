/*
 * 원숭이가 햄릿을 쓸 수 있을까: 순수한 우연(무한 원숭이 정리) vs 누적 선택
 * 리처드 도킨스의 "위즐(weasel) 프로그램"(The Blind Watchmaker, 1986)에서 발상을 얻은 이 프로젝트의 구현이다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 글자는 알파벳 대문자 26개 + 띄어쓰기 = 27가지. 목표 문장은 햄릿의 대사다.
 *  - 순수한 우연: 한 단계마다 chancePerStep개의 문자열을 완전히 무작위로 찍어 보고, 목표와 가장 많이 맞은 것을 기록한다
 *  - 누적 선택: 무작위 문자열 하나에서 시작해, 한 세대마다 offspring개의 복사본을 만든다.
 *    복사본은 글자마다 확률 mutation으로 무작위 글자로 바뀐다. 부모와 복사본 중 가장 많이 맞은 것(동점이면 복사본)이 다음 세대의 부모가 된다
 *  - 두 방식 모두 "목표와 맞은 글자 수"로만 평가한다. 선택 쪽은 맞은 글자를 다음 세대로 이어 가는 점이 다르다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Monkey = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';          // 27 symbols
  const TARGETS = { tobe: 'TO BE OR NOT TO BE', weasel: 'METHINKS IT IS LIKE A WEASEL' };
  const DEFAULTS = { target: 'tobe', offspring: 100, mutation: 0.05, chancePerStep: 5000, maxSteps: 200, seed: 1, chance: true };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const idxOf = (s) => Array.from(s, (c) => ALPHABET.indexOf(c));
  const strOf = (a) => Array.from(a, (i) => ALPHABET[i]).join('');

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const text = TARGETS[p.target] || p.target;       // p.target 에 문장을 직접 줄 수도 있다
    const tgt = idxOf(text), L = tgt.length;
    const rng = mulberry32(p.seed * 97 + 5);
    const rnd = () => Math.floor(rng() * 27);

    // 누적 선택의 부모 (처음엔 무작위)
    let parent = Array.from({ length: L }, rnd);
    const matches = (a) => { let m = 0; for (let j = 0; j < L; j++) if (a[j] === tgt[j]) m++; return m; };
    let parentMatch = matches(parent);

    const sim = {
      params: p, text, L, step: 0, done: false,
      chanceBest: [], chanceLast: [], chanceBestMatch: 0, chanceAttempts: 0, chanceHist: [],
      selParent: parent, selMatch: parentMatch, selGen: 0, selAttempts: 0, selDoneGen: -1, selHist: [[1, parentMatch]],
      advance() {
        if (sim.done) return false;
        sim.step++;
        // --- 순수한 우연 ---
        if (p.chance) {
          const buf = new Array(L);
          for (let k = 0; k < p.chancePerStep; k++) {
            let m = 0;
            for (let j = 0; j < L; j++) { const v = rnd(); buf[j] = v; if (v === tgt[j]) m++; }
            if (m > sim.chanceBestMatch || sim.chanceBest.length === 0) { sim.chanceBestMatch = m; sim.chanceBest = buf.slice(); }
          }
          sim.chanceLast = buf.slice();
          sim.chanceAttempts += p.chancePerStep;
          sim.chanceHist.push([sim.chanceAttempts, sim.chanceBestMatch]);
        }
        // --- 누적 선택 ---
        if (sim.selMatch < L) {
          let best = parent, bm = parentMatch;
          for (let k = 0; k < p.offspring; k++) {
            const child = parent.slice();
            for (let j = 0; j < L; j++) if (rng() < p.mutation) child[j] = rnd();
            const m = matches(child);
            if (m >= bm) { bm = m; best = child; }
          }
          parent = best; parentMatch = bm; sim.selParent = parent; sim.selMatch = bm;
          sim.selGen++; sim.selAttempts += p.offspring; sim.selHist.push([sim.selAttempts, bm]);
          if (bm === L) sim.selDoneGen = sim.selGen;
        }
        if (sim.step >= p.maxSteps) sim.done = true;
        return true;
      },
      chanceLastString() { return sim.chanceLast.length ? strOf(sim.chanceLast) : ''.padEnd(L, ' '); },
      chanceString() { return sim.chanceBest.length ? strOf(sim.chanceBest) : ''.padEnd(L, '?'); },
      selString() { return strOf(sim.selParent); },
      targetIdx: tgt,
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 누적 선택만 끝까지 돌려 완성에 걸린 세대 수와 시도 횟수를 얻는다
  function runSelection(text, offspring, mutation, seed) {
    const s = create({ target: text, offspring, mutation, seed, chance: false, maxSteps: 1e9 });
    let guard = 0;
    while (s.selMatch < s.L && guard++ < 100000) s.advance();
    return { gens: s.selGen, attempts: s.selAttempts };
  }

  // 목표 문장의 앞 L글자(prefix)를 만드는 데 걸린 시도 횟수의 목록
  function selectionAttempts(text, L, offspring, mutation, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(runSelection(text.slice(0, L), offspring, mutation, 1000 + L * 31 + k).attempts);
    return out;
  }
  function selectionGens(text, offspring, mutation, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) out.push(runSelection(text, offspring, mutation, 2000 + k * 7).gens);
    return out;
  }

  // 순수한 우연으로 L글자 문장을 한 번에 맞출 확률의 역수 (기대 시도 횟수) = 27^L
  const log10Chance = (L) => L * Math.log10(27);
  const SEC_PER_YEAR = 365.25 * 24 * 3600, UNIVERSE_YEARS = 13.8e9;
  function chanceYears(L, perSecond) { return Math.pow(10, log10Chance(L) - Math.log10(perSecond) - Math.log10(SEC_PER_YEAR)); }

  return { ALPHABET, TARGETS, DEFAULTS, UNIVERSE_YEARS, create, runSelection, selectionAttempts, selectionGens, log10Chance, chanceYears };
});
