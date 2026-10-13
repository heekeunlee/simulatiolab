/*
 * 약한 유대의 힘: 와츠-스트로가츠 작은 세상 네트워크에서 소식이 퍼지는 모습
 * (Watts & Strogatz 1998, Nature 393 의 규칙을 따른 이 프로젝트의 단순화된 구현).
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 네트워크: 원 위에 사람 n명이 서 있고, 각자 양옆 가까운 k명(왼쪽 k/2, 오른쪽 k/2)과 이어진다 (촘촘한 친구 무리).
 * 다음 오른쪽 이웃과의 연결마다 확률 p로 그 끝을 무작위 먼 사람으로 바꾼다 (약한 연결).
 * 소식: 한 사람이 처음 안다. 매 단계 아는 사람이 아직 모르는 이웃마다 확률 q로 전해 준다 (이미 알면 더 전하지 않아도 같은 결과).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeakTies = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 200, k: 6, p: 0.02, q: 0.5, seed: 1, maxSteps: 1500 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 네트워크 만들기 ----------
  function buildGraph(n, k, p, rng) {
    const half = Math.floor(k / 2), adj = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < n; i++) for (let j = 1; j <= half; j++) { const t = (i + j) % n; adj[i].add(t); adj[t].add(i); }
    const weak = []; // 약한 연결 [a, b]
    const lattice = []; // 그대로 남은 가까운 연결 [a, b]
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= half; j++) {
        const t = (i + j) % n;
        if (rng() < p) {
          let w = -1;
          for (let tries = 0; tries < 50; tries++) { const c = Math.floor(rng() * n); if (c !== i && !adj[i].has(c)) { w = c; break; } }
          if (w >= 0) { adj[i].delete(t); adj[t].delete(i); adj[i].add(w); adj[w].add(i); weak.push([i, w]); continue; }
        }
        lattice.push([i, t]);
      }
    }
    return { n, k, adj: adj.map((s) => Array.from(s)), weak, lattice };
  }

  // 평균 최단 거리 (일부 출발점에서 너비 우선 탐색, 닿는 사람만 센다)
  function bfs(g, s, dist, queue) {
    dist.fill(-1); dist[s] = 0; let h = 0, t = 0; queue[t++] = s;
    while (h < t) { const u = queue[h++]; const du = dist[u] + 1; const a = g.adj[u]; for (let i = 0; i < a.length; i++) { const v = a[i]; if (dist[v] < 0) { dist[v] = du; queue[t++] = v; } } }
    return t; // 닿은 사람 수
  }
  function pathLength(g, rng, samples) {
    const n = g.n, dist = new Int32Array(n), queue = new Int32Array(n), m = Math.min(samples || 40, n);
    let sum = 0, cnt = 0;
    for (let i = 0; i < m; i++) {
      const s = m >= n ? i : Math.floor(rng() * n); bfs(g, s, dist, queue);
      for (let v = 0; v < n; v++) if (dist[v] > 0) { sum += dist[v]; cnt++; }
    }
    return cnt ? sum / cnt : 0;
  }

  // 친구의 친구도 서로 친구인 정도 (모든 사람의 평균)
  function clustering(g) {
    const n = g.n; let tot = 0, c = 0;
    const sets = g.adj.map((a) => new Set(a));
    for (let i = 0; i < n; i++) {
      const a = g.adj[i], d = a.length; if (d < 2) continue;
      let links = 0;
      for (let x = 0; x < d; x++) for (let y = x + 1; y < d; y++) if (sets[a[x]].has(a[y])) links++;
      tot += (2 * links) / (d * (d - 1)); c++;
    }
    return c ? tot / c : 0;
  }

  // ---------- 소식 퍼뜨리기 ----------
  function spread(g, q, rng, start) {
    const n = g.n, at = new Int32Array(n).fill(-1), via = new Int32Array(n).fill(-1);
    at[start] = 0; let frontier = [start], informed = 1, step = 0, active = [start];
    const sh = [1 / n];
    return {
      at, via, shares: sh,
      get informed() { return informed; }, get step() { return step; },
      advance() {
        if (informed >= n) return false;
        step++;
        const fresh = [];
        for (const u of active) for (const v of g.adj[u]) if (at[v] < 0 && rng() < q) { at[v] = step; via[v] = u; informed++; fresh.push(v); }
        // 아직 모르는 이웃이 남은 사람만 계속 시도한다
        const next = [];
        for (const u of active) { let open = false; for (const v of g.adj[u]) if (at[v] < 0) { open = true; break; } if (open) next.push(u); }
        for (const v of fresh) next.push(v);
        active = next; sh.push(informed / n);
        return true;
      },
      done() { return informed >= n || active.length === 0; },
    };
  }
  // 끝까지 돌려 (90%에 닿은 단계, 100%에 닿은 단계, 단계별 비율) 얻는다
  function runSpread(g, q, rng, maxSteps) {
    const sp = spread(g, q, rng, 0), cap = maxSteps || 1500;
    while (!sp.done() && sp.step < cap) sp.advance();
    const sh = sp.shares, i90 = sh.findIndex((v) => v >= 0.9), i100 = sh.findIndex((v) => v >= 1);
    return { t90: i90, t100: i100, shares: sh, reached: sh[sh.length - 1] };
  }

  // ---------- 여러 번 돌려 평균 ----------
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  function sub(seed, a, b) { return mulberry32((seed * 1000003 + a * 7919 + b * 104729) >>> 0); }
  function build(base, p, rep) { const P = Object.assign({}, DEFAULTS, base); return buildGraph(P.n, P.k, p, sub(P.seed, rep, 1)); }

  // 평균 걸린 단계 (p마다 그래프 reps개, 그래프마다 소식 1번)
  function t90Mean(base, p, reps) {
    const P = Object.assign({}, DEFAULTS, base), out = [];
    for (let r = 0; r < reps; r++) { const g = buildGraph(P.n, P.k, p, sub(P.seed, r, 11)); const s = runSpread(g, P.q, sub(P.seed, r, 12), P.maxSteps); if (s.t90 >= 0) out.push(s.t90); }
    return out.length ? mean(out) : NaN;
  }
  // 훑기: p마다 평균 거리, 묶임 정도, 90% 도달 단계 (모두 p=0의 값으로 나눈 비율도 함께)
  function sweep(base, ps, reps) {
    const P = Object.assign({}, DEFAULTS, base);
    const one = (p) => {
      const L = [], C = [], T = [];
      for (let r = 0; r < reps; r++) {
        const g = buildGraph(P.n, P.k, p, sub(P.seed, r, 21));
        L.push(pathLength(g, sub(P.seed, r, 22), 30)); C.push(clustering(g));
        const s = runSpread(g, P.q, sub(P.seed, r, 23), P.maxSteps); if (s.t90 >= 0) T.push(s.t90);
      }
      return { L: mean(L), C: mean(C), T: T.length ? mean(T) : NaN };
    };
    const z = one(0);
    return { zero: z, pts: ps.map((p) => { const v = one(p); return { x: p, L: v.L, C: v.C, T: v.T, Lr: v.L / z.L, Cr: v.C / z.C }; }) };
  }
  // 단계별 퍼진 비율의 평균 곡선
  function curve(base, p, reps, len) {
    const P = Object.assign({}, DEFAULTS, base), acc = new Float64Array(len);
    for (let r = 0; r < reps; r++) {
      const g = buildGraph(P.n, P.k, p, sub(P.seed, r, 31)); const s = runSpread(g, P.q, sub(P.seed, r, 32), len);
      for (let i = 0; i < len; i++) acc[i] += s.shares[Math.min(i, s.shares.length - 1)];
    }
    return Array.from(acc, (v) => v / reps);
  }

  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts), rng = mulberry32(P.seed * 7919 + 13);
    const g = buildGraph(P.n, P.k, P.p, rng), sp = spread(g, P.q, mulberry32(P.seed * 104729 + 5), P.start || 0);
    let t90 = -1;
    return {
      params: P, g, sp,
      get step() { return sp.step; }, get informed() { return sp.informed; },
      get t90() { return t90; },
      advance() { const mv = sp.advance(); if (t90 < 0 && sp.informed >= 0.9 * P.n) t90 = sp.step; return mv; },
      done() { return sp.done() || sp.step >= P.maxSteps; },
    };
  }

  return { DEFAULTS, mulberry32, buildGraph, pathLength, clustering, spread, runSpread, t90Mean, sweep, curve, create };
});
