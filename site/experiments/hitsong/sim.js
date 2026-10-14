/*
 * 히트곡과 평행 세계: 같은 곡 n개(기본 48곡)를 두고, 서로 독립인 세계 여러 개(기본 8개)에서 듣는 사람이 차례로 찾아온다.
 * Salganik, Dodds & Watts (2006, Science 311: 854–856)의 "인공 음악 시장" 실험에서 발상을 얻은 이 프로젝트의 단순화된 모델이다.
 * 그 실험의 재현이 아니며, 숫자는 이 프로젝트가 정한 예시 값이다.
 *
 * 규칙
 *  - 곡 k(0부터, 화면에서는 k+1번 곡)의 매력 p_k = 들어 본 사람이 마음에 들어 다운로드할 확률
 *      p_k = top − spread · ((k)/(n−1))^0.4      (top = 0.9, spread 기본 0.7 → 1번 곡 90%, 48번 곡 20%)
 *    곡 번호 = 실력(매력) 순위: 1번 곡이 가장 좋다. 위쪽 곡들 사이 차이가 더 크게 벌어지도록 0.4제곱을 쓴다
 *  - 듣는 사람 한 명은 곡 하나를 눌러 들어 보고, 확률 p_k로 다운로드한다(다운로드 수 = 인기)
 *      · 확률 s(남의 선택을 보는 정도)로 그 세계의 "다운로드 순위표"를 보고 고른다: r위 곡을 1/r에 비례해 누른다(1위는 2위보다 두 배 자주)
 *      · 나머지(1 − s)는 순위를 보지 않고 48곡 중 아무 곡이나 똑같은 확률로 누른다
 *    순위표는 다운로드 수 순서이고, 처음(모두 0)에는 세계마다 무작위 순서다. 동점이면 먼저 그 자리에 있던 곡이 위에 남는다
 *  - 세계마다 곡·규칙은 같고 난수만 다르다. 시드 난수(mulberry32)
 *  - 재생용으로 듣는 사람 N/steps명마다 모든 세계의 다운로드 수와 순위표를 기록한다
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Hitsong = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 48, worlds: 8, N: 10000, s: 0.6, spread: 0.7, top: 0.9, steps: 80, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const appeal = (P) => Array.from({ length: P.n }, (_, k) => P.top - P.spread * Math.pow(k / (P.n - 1), 0.4));
  // 순위표에서 r위(0부터)를 누를 누적 확률 (1/(r+1)에 비례)
  const zipfCum = (n) => { const z = new Float64Array(n); let a = 0; for (let r = 0; r < n; r++) { a += 1 / (r + 1); z[r] = a; } for (let r = 0; r < n; r++) z[r] /= a; return z; };

  // 지니 계수 (0 = 모든 곡이 똑같이 다운로드됨, 1에 가까울수록 한두 곡에 쏠림)
  function gini(c) {
    const a = Array.from(c).sort((x, y) => x - y), n = a.length; let s = 0, cum = 0;
    for (let i = 0; i < n; i++) { cum += a[i]; s += (i + 1) * a[i]; }
    return cum > 0 ? (2 * s) / (n * cum) - (n + 1) / n : 0;
  }

  // 세계 하나를 듣는 사람 N명까지 돌린다. onRec(기록 번호, 다운로드 수, 순위표)를 N/steps명마다 부른다
  function runWorld(P, rng, onRec) {
    const n = P.n, ap = appeal(P), zc = zipfCum(n), c = new Float64Array(n);
    const ord = new Int32Array(n), pos = new Int32Array(n);
    for (let k = 0; k < n; k++) ord[k] = k;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
    for (let i = 0; i < n; i++) pos[ord[i]] = i;
    if (onRec) onRec(0, c, ord);
    const S = P.steps; let rec = 1, next = P.N / S;
    for (let t = 1; t <= P.N; t++) {
      let k;
      if (rng() < P.s) { // 순위표를 보고 누른다 (이분 탐색)
        const u = rng(); let lo = 0, hi = n - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (zc[mid] < u) lo = mid + 1; else hi = mid; }
        k = ord[lo];
      } else k = Math.floor(rng() * n);
      if (rng() < ap[k]) {
        c[k]++;
        let p = pos[k];
        while (p > 0 && c[ord[p - 1]] < c[k]) { const o = ord[p - 1]; ord[p - 1] = k; ord[p] = o; pos[o] = p; p--; pos[k] = p; }
      }
      if (onRec && t >= next - 1e-9) { onRec(rec, c, ord); rec++; next = (P.N * rec) / S; }
    }
    return { c, ord };
  }

  // 여러 세계를 한꺼번에 끝까지 돌리고 재생용 기록을 남긴다. sim.step = 지금 보여 주는 기록 번호(0..steps)
  function create(p) {
    const P = Object.assign({}, DEFAULTS, p), n = P.n, W = P.worlds, S = P.steps;
    const hist = new Float64Array((S + 1) * W * n), ordH = new Int8Array((S + 1) * W * n);
    for (let w = 0; w < W; w++) {
      const rng = mulberry32((((P.seed >>> 0) * 1009 + (w + 1) * 7919) * 2654435761) >>> 0);
      runWorld(P, rng, (s, c, ord) => { hist.set(c, (s * W + w) * n); for (let i = 0; i < n; i++) ordH[(s * W + w) * n + i] = ord[i]; });
    }
    const sim = { P, n, W, S, ap: appeal(P), hist, ordH, step: 0 };
    sim.counts = (s, w) => hist.subarray((s * W + w) * n, (s * W + w + 1) * n);
    sim.chart = (s, w) => ordH.subarray((s * W + w) * n, (s * W + w + 1) * n); // 순위표: [1위 곡, 2위 곡, …]
    sim.listeners = (s) => Math.round((P.N * s) / S);
    sim.stats = (s) => statsAt(sim, s);
    let mx = 0; for (let i = S * W * n; i < hist.length; i++) if (hist[i] > mx) mx = hist[i];
    sim.maxCount = mx; // 전체 기간의 최대 다운로드 수(축 고정용: 다운로드 수는 줄지 않으므로 마지막 시점의 최대)
    sim.advance = () => (sim.step < S ? (sim.step++, true) : false);
    sim.done = () => sim.step >= S;
    sim.run = () => { sim.step = S; return sim; };
    return sim;
  }

  function statsAt(sim, s) {
    const W = sim.W, leaders = [], ginis = [], tops = [];
    let bestWins = 0;
    for (let w = 0; w < W; w++) {
      const c = sim.counts(s, w), L = sim.chart(s, w)[0]; leaders.push(L);
      if (L === 0) bestWins++;
      ginis.push(gini(c));
      let tot = 0; for (let k = 0; k < c.length; k++) tot += c[k];
      tops.push(tot ? c[L] / tot : 0);
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return { leaders, distinct: new Set(leaders).size, bestWins, gini: mean(ginis), topShare: mean(tops), meanLeaderRank: mean(leaders.map((k) => k + 1)), worstLeaderRank: Math.max(...leaders) + 1 };
  }

  // 집계: 설정 하나로 세계 reps개를 끝까지 돌려 평균을 낸다. 서로 다른 1등 곡 수는 worlds개씩 묶어 센다
  function aggregate(p, reps, seed) {
    const P = Object.assign({}, DEFAULTS, p), rng = mulberry32((seed || 7) >>> 0);
    let best = 0, g = 0, top = 0, lr = 0, worst = 0; const lead = [];
    for (let r = 0; r < reps; r++) {
      const { c, ord } = runWorld(P, rng), L = ord[0]; lead.push(L);
      if (L === 0) best++; g += gini(c); lr += L + 1; worst = Math.max(worst, L + 1);
      let tot = 0; for (let k = 0; k < c.length; k++) tot += c[k]; top += tot ? c[L] / tot : 0;
    }
    let dsum = 0, groups = 0;
    for (let i = 0; i + P.worlds <= lead.length; i += P.worlds) { dsum += new Set(lead.slice(i, i + P.worlds)).size; groups++; }
    return { bestWin: best / reps, gini: g / reps, topShare: top / reps, meanLeaderRank: lr / reps, worstLeaderRank: worst, distinct: groups ? dsum / groups : null };
  }

  return { DEFAULTS, mulberry32, appeal, zipfCum, gini, runWorld, create, statsAt, aggregate };
});
