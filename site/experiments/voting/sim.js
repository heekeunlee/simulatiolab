/*
 * 투표 방식이 달라지면 당선자가 바뀔까: 투표 규칙 비교 (공간 투표 모델)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 유권자 voters명은 2차원 "정책 성향" 평면 위에 흩어져 있다 (가로축·세로축에 특별한 의미는 없다).
 *    polar가 클수록 두 무리로 갈라진 분포가 된다
 *  - 후보 k명은 같은 분포에서 무작위 위치를 얻는다
 *  - 유권자는 가까운 후보일수록 더 좋아한다 (거리 순으로 선호 순위를 매김)
 *  - 같은 표로 네 가지 방식을 계산한다
 *      단순다수: 1순위를 가장 많이 받은 후보
 *      결선투표: 과반 후보가 없으면 상위 2명이 맞붙어 더 선호하는 쪽
 *      선호투표(즉시결선): 1순위 최하위 후보를 하나씩 탈락시키며 표를 옮기고, 과반이 될 때까지 반복
 *      보르다: 순위별 점수(1등 k-1점 ... 꼴찌 0점) 합
 *  - 기준: 콩도르세 승자(다른 모든 후보와 1:1로 붙으면 이기는 후보. 없을 수도 있음)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Voting = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { voters: 1000, k: 4, polar: 0.6, seed: 1 };
  const SD = 0.6;
  const RULES = ['plurality', 'runoff', 'irv', 'borda'];

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
    const rng = mulberry32(p.seed * 4241 + 11);
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const d = p.polar * 1.2;
    const point = () => ({ x: (rng() < 0.5 ? -d : d) + SD * gauss(), y: SD * gauss() });
    const N = p.voters, K = p.k;
    const vs = Array.from({ length: N }, point), cs = Array.from({ length: K }, point);

    // 선호 순서(order)와 순위 위치(pos)
    const order = new Uint8Array(N * K), pos = new Uint8Array(N * K);
    const dist = new Float64Array(K);
    for (let v = 0; v < N; v++) {
      for (let c = 0; c < K; c++) dist[c] = (vs[v].x - cs[c].x) ** 2 + (vs[v].y - cs[c].y) ** 2;
      const idx = Array.from({ length: K }, (_, c) => c).sort((a, b) => dist[a] - dist[b]);
      idx.forEach((c, r) => { order[v * K + r] = c; pos[v * K + c] = r; });
    }

    // 살아 있는 후보(active) 중 각 유권자의 1순위 득표
    function tally(active) {
      const t = new Array(K).fill(0);
      for (let v = 0; v < N; v++) for (let r = 0; r < K; r++) { const c = order[v * K + r]; if (active[c]) { t[c]++; break; } }
      return t;
    }
    const argmax = (a, ok) => { let b = -1; a.forEach((x, i) => { if (ok(i) && (b < 0 || x > a[b])) b = i; }); return b; };
    const argmin = (a, ok) => { let b = -1; a.forEach((x, i) => { if (ok(i) && (b < 0 || x < a[b])) b = i; }); return b; };
    const allActive = () => new Array(K).fill(true);

    function headToHead(a, b) { let na = 0; for (let v = 0; v < N; v++) if (pos[v * K + a] < pos[v * K + b]) na++; return na; }

    const result = { params: p, voters: vs, cands: cs, first: [], tallies: {}, winners: {}, irvRounds: [] };
    result.first = (() => { const t = tally(allActive()); return t; })();

    // 단순다수
    result.tallies.plurality = result.first.map((x) => x / N);
    result.winners.plurality = argmax(result.first, () => true);

    // 결선투표
    {
      const t = result.first;
      const top = argmax(t, () => true);
      if (t[top] > N / 2) { result.winners.runoff = top; result.tallies.runoff = t.map((x) => x / N); }
      else {
        const second = argmax(t, (i) => i !== top);
        const na = headToHead(top, second);
        result.winners.runoff = na >= N - na ? top : second;
        const sh = new Array(K).fill(0); sh[top] = na / N; sh[second] = (N - na) / N;
        result.tallies.runoff = sh; result.runoffPair = [top, second];
      }
    }

    // 선호투표(즉시결선)
    {
      const active = allActive();
      let left = K;
      for (;;) {
        const t = tally(active);
        result.irvRounds.push(t.map((x, i) => (active[i] ? x / N : null)));
        const lead = argmax(t, (i) => active[i]);
        if (t[lead] > N / 2 || left === 1) { result.winners.irv = lead; result.tallies.irv = t.map((x, i) => (active[i] ? x / N : 0)); break; }
        const out = argmin(t, (i) => active[i]); active[out] = false; left--;
      }
    }

    // 보르다
    {
      const pts = new Array(K).fill(0);
      for (let v = 0; v < N; v++) for (let c = 0; c < K; c++) pts[c] += K - 1 - pos[v * K + c];
      const tot = pts.reduce((a, b) => a + b, 0) || 1;
      result.winners.borda = argmax(pts, () => true);
      result.tallies.borda = pts.map((x) => x / tot);
    }

    // 콩도르세 승자
    result.winners.condorcet = -1;
    for (let a = 0; a < K && result.winners.condorcet < 0; a++) {
      let beatsAll = true;
      for (let b = 0; b < K; b++) if (a !== b && headToHead(a, b) <= N / 2) { beatsAll = false; break; }
      if (beatsAll) result.winners.condorcet = a;
    }
    return result;
  }

  // 여러 번의 선거를 돌려 규칙별 통계를 얻는다
  function study(opts, elections, seedBase) {
    const r = { n: elections, withCondorcet: 0, hit: { plurality: 0, runoff: 0, irv: 0, borda: 0 }, pluralityNeIrv: 0, pluralityMajority: 0 };
    for (let e = 0; e < elections; e++) {
      const x = create(Object.assign({}, opts, { seed: (seedBase || 1000) + e }));
      if (x.winners.plurality !== x.winners.irv) r.pluralityNeIrv++;
      if (x.winners.condorcet >= 0) { r.withCondorcet++; RULES.forEach((k) => { if (x.winners[k] === x.winners.condorcet) r.hit[k]++; }); }
    }
    return r;
  }

  return { DEFAULTS, RULES, create, study };
});
