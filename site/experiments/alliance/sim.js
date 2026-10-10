/*
 * 한 발의 총성이 세계대전이 되려면: 동맹 연쇄 모델 (추상적인 장난감 모델)
 * 1914년의 "동맹의 사슬" 이야기에서 발상을 얻었지만 역사 분석이 아니며, 국가는 A, B, C ... 로 불리는 익명의 나라다.
 * 감염·연쇄(cascade) 모델에서 발상을 얻었다 (예: Watts 2002, "A simple model of global cascades on random networks", PNAS).
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 나라 n개. 두 나라가 "동맹"이면 한쪽이 전쟁에 들어갈 때 상대에게 도움을 요청할 수 있다 (서로 돕는 조약)
 *  - 동맹 구조(structure): random 무작위 / blocs 둘로 갈린 진영(진영 안에서 동맹, 진영 사이에 2개의 연결) / pairs 둘씩 묶인 동맹
 *  - 처음에 나라 한 곳(공격국, 쪽 A)이 다른 나라(방어국, 쪽 B)를 공격한다. blocs에서는 서로 다른 진영의 두 나라다
 *  - 한 라운드마다, 아직 전쟁에 들어가지 않은 나라는 전쟁 중인 동맹국마다 확률 commit(조약을 지킬 확률)로 "끌려 들어간다".
 *    같은 라운드에 양쪽에서 요청을 받으면 요청이 더 많은 쪽으로 가고, 같으면 무작위로 고른다
 *  - 한 라운드에 새로 들어가는 나라가 없으면 전쟁은 끝난다. 전쟁에 들어간 나라 수 = 전쟁의 크기
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Alliance = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 24, structure: 'random', allies: 3, commit: 0.7, seed: 1 };

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
    const rng = mulberry32(p.seed * 7919 + 13), n = p.n;
    const adj = Array.from({ length: n }, () => new Set());
    const link = (a, b) => { if (a !== b) { adj[a].add(b); adj[b].add(a); } };
    const bloc = (i) => (i < n / 2 ? 0 : 1);
    if (p.structure === 'pairs') {
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
      for (let i = 0; i + 1 < n; i += 2) link(order[i], order[i + 1]);
    } else if (p.structure === 'blocs') {
      const half = n / 2, pe = Math.min(1, p.allies / (half - 1));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (bloc(i) === bloc(j) && rng() < pe) link(i, j);
      for (let k = 0; k < 2; k++) link(Math.floor(rng() * half), half + Math.floor(rng() * half)); // 진영 사이의 연결 2개
    } else {
      const pe = Math.min(1, p.allies / (n - 1));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng() < pe) link(i, j);
    }
    // 첫 총성
    let a = Math.floor(rng() * n), b;
    if (p.structure === 'blocs') b = bloc(a) === 0 ? n / 2 + Math.floor(rng() * (n / 2)) : Math.floor(rng() * (n / 2));
    else { do { b = Math.floor(rng() * n); } while (b === a); }
    const side = new Int8Array(n); // 0 중립, 1 쪽 A, 2 쪽 B
    side[a] = 1; side[b] = 2;
    const sim = {
      params: p, n, adj, side, attacker: a, defender: b, round: 0, done: false,
      history: [{ a: 1, b: 1 }], joinedAt: new Int16Array(n).fill(-1),
      edges() { const e = []; for (let i = 0; i < n; i++) adj[i].forEach((j) => { if (i < j) e.push([i, j]); }); return e; },
      size() { let c = 0; for (let i = 0; i < n; i++) if (side[i]) c++; return c; },
      counts() { let ca = 0, cb = 0; for (let i = 0; i < n; i++) { if (side[i] === 1) ca++; else if (side[i] === 2) cb++; } return { a: ca, b: cb }; },
      advance() {
        if (sim.done) return false;
        const join = [];
        for (let i = 0; i < n; i++) {
          if (side[i]) continue;
          let va = 0, vb = 0;
          adj[i].forEach((j) => { if (side[j] && rng() < p.commit) { if (side[j] === 1) va++; else vb++; } });
          if (va || vb) join.push([i, va > vb ? 1 : vb > va ? 2 : (rng() < 0.5 ? 1 : 2)]);
        }
        join.forEach(([i, s]) => { side[i] = s; sim.joinedAt[i] = sim.round + 1; });
        sim.round++;
        sim.history.push(sim.counts());
        if (!join.length) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 같은 설정의 세계 여러 개에서 나온 전쟁 크기
  function sizes(opts, shots, seedBase) {
    const out = [];
    for (let k = 0; k < shots; k++) out.push(create(Object.assign({}, opts, { seed: (seedBase || 100) + k })).run().size());
    return out;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  // 점 그래프용: 묶음(groups)마다 shots번의 평균 전쟁 크기와 "세계대전급(절반 이상)" 비율
  function summarize(opts, groups, shots, seedBase) {
    const n = (opts && opts.n) || DEFAULTS.n, res = { size: [], world: [] };
    for (let g = 0; g < groups; g++) {
      const s = sizes(opts, shots, (seedBase || 100) + g * 1000);
      res.size.push(mean(s) / n); res.world.push(s.filter((x) => x >= n / 2).length / s.length);
    }
    return res;
  }

  return { DEFAULTS, create, sizes, summarize };
});
