/*
 * 비서 문제(최적 멈춤 문제): 후보 n명을 무작위 순서로 한 명씩 만나고, 각자 지금까지 본 사람들과만 비교할 수 있으며,
 * 한 번 지나친 사람은 되돌릴 수 없다. 이 프로젝트의 단순화된 구현이다.
 * 전략: 처음 r명은 모두 거절(기준 잡기), 그 뒤 "지금까지 본 모두보다 나은" 첫 후보를 고른다. 끝까지 없으면 마지막 후보를 받는다.
 * 순위 1이 가장 좋은 후보. 정확한 값은 닫힌 식으로 계산하고, 시뮬레이션은 시드 난수(mulberry32)를 쓴다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Secretary = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 이항계수 표 (n <= 100이면 double로 충분)
  const BIN = [[1]];
  function binom(n, k) {
    while (BIN.length <= n) { const m = BIN.length, row = [1]; for (let j = 1; j < m; j++) row.push(BIN[m - 1][j - 1] + BIN[m - 1][j]); row.push(1); BIN.push(row); }
    return k < 0 || k > n ? 0 : BIN[n][k];
  }

  const clampR = (n, r) => Math.max(0, Math.min(n - 1, Math.round(r)));
  const cutToR = (n, cutPct) => clampR(n, (n * cutPct) / 100);

  // 컷오프 r일 때 "고른 사람의 전체 순위"가 k일 정확한 확률 (k = 1..n). 인덱스 k-1.
  //  i번째(i > r)에서 멈출 확률 = r / (i(i-1)),  그때 그 사람의 전체 순위가 k일 확률 = C(n-k, i-1) / C(n, i)
  //  끝까지 못 고르면(최고가 앞 r명 안에 있을 때, 확률 r/n) 마지막 사람을 받고, 그 순위는 2..n 중 균등
  function rankDist(n, r) {
    const d = new Array(n).fill(0);
    if (r <= 0) { d.fill(1 / n); return d; }
    for (let i = r + 1; i <= n; i++) {
      const pStop = r / (i * (i - 1)), den = binom(n, i);
      for (let k = 1; k <= n - i + 1; k++) d[k - 1] += pStop * binom(n - k, i - 1) / den;
    }
    for (let k = 2; k <= n; k++) d[k - 1] += (r / n) / (n - 1);
    return d;
  }
  // 최고를 고를 확률 (닫힌 식): r=0이면 1/n, 아니면 (r/n) * sum_{j=r}^{n-1} 1/j
  function pBest(n, r) {
    if (r <= 0) return 1 / n;
    let s = 0; for (let j = r; j <= n - 1; j++) s += 1 / j;
    return (r / n) * s;
  }
  function pTop(n, r, goal) { const d = rankDist(n, r); let s = 0; for (let k = 0; k < Math.min(goal, n); k++) s += d[k]; return s; }
  // 모든 r에 대한 곡선: [{ r, x(=r/n*100), p, passed, settled }]
  function curve(n, goal) {
    const out = [];
    for (let r = 0; r < n; r++) {
      const p = goal === 1 ? pBest(n, r) : pTop(n, r, goal), best = pBest(n, r);
      const passed = r / n, settled = Math.max(0, 1 - best - passed);
      out.push({ r, x: (r / n) * 100, p, best, passed, settled });
    }
    return out;
  }
  function optimum(n, goal) {
    const c = curve(n, goal); let b = c[0];
    c.forEach((d) => { if (d.p > b.p + 1e-12) b = d; });
    return { r: b.r, p: b.p, x: b.x };
  }

  // 한 판: order[i] = i번째로 만나는 후보의 순위(1이 최고). 반환 { pick(인덱스), forced }
  function choose(order, r) {
    const n = order.length; let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (i >= r && order[i] < best) return { pick: i, forced: false };
      if (order[i] < best) best = order[i];
    }
    return { pick: n - 1, forced: true };
  }
  function shuffled(n, rng) {
    const a = []; for (let k = 1; k <= n; k++) a.push(k);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // 같은 설정을 T번 돌려 고른 순위의 횟수표 (인덱스 k-1)
  function trialRanks(n, r, T, seed) {
    const rng = mulberry32(seed >>> 0), cnt = new Array(n).fill(0);
    for (let t = 0; t < T; t++) { const o = shuffled(n, rng); cnt[o[choose(o, r).pick] - 1]++; }
    return cnt;
  }
  // 컷오프를 훑는 시뮬레이션 점: 각 r에서 T번 돌려 "상위 goal명을 고른 비율"
  function simCurve(n, goal, T, seed, step) {
    const out = [];
    for (let r = 0; r < n; r += step || 1) {
      const cnt = trialRanks(n, r, T, seed + r * 7919);
      let s = 0; for (let k = 0; k < Math.min(goal, n); k++) s += cnt[k];
      out.push({ r, x: (r / n) * 100, p: s / T });
    }
    return out;
  }

  // 한 판을 한 명씩 보여 주는 상태. 점수는 순위를 100점 만점으로 환산한 값(높을수록 좋음).
  function create(p) {
    const n = p.n, goal = p.goal || 1, r = cutToR(n, p.cut), rng = mulberry32((p.seed || 1) * 2654435761 >>> 0);
    const order = shuffled(n, rng), score = order.map((k) => Math.round((100 * (n - k + 1)) / n));
    const bestIdx = order.indexOf(1);
    const s = { n, goal, r, order, score, bestIdx, t: 0, leader: -1, leaderRank: Infinity, picked: -1, forced: false, revealAll: false, done: false };
    s.advance = function () {
      if (s.done) return false;
      if (s.picked >= 0) { s.revealAll = true; s.done = true; return true; }
      const i = s.t++;
      if (i >= r && order[i] < s.leaderRank) { s.picked = i; }
      if (order[i] < s.leaderRank) { s.leaderRank = order[i]; s.leader = i; }
      if (s.picked < 0 && s.t === n) { s.picked = n - 1; s.forced = true; }
      return true;
    };
    s.run = function () { while (s.advance()); return s; };
    s.pickRank = () => (s.picked >= 0 ? order[s.picked] : 0);
    s.success = () => s.picked >= 0 && order[s.picked] <= goal;
    // 실패 이유: 'passed' 최고를 관찰 구간에서 지나쳐 보냈다 / 'settled' 최고가 오기 전에 다른 사람에게 멈췄다
    s.kind = () => (s.picked < 0 ? '' : order[s.picked] === 1 ? 'best' : s.success() ? 'good' : bestIdx < r ? 'passed' : 'settled');
    return s;
  }

  return { mulberry32, binom, cutToR, rankDist, pBest, pTop, curve, optimum, choose, shuffled, trialRanks, simCurve, create };
});
