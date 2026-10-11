/*
 * 친구의 역설: 내 친구들은 왜 나보다 친구가 많을까 (Scott Feld 1991, "Why your friends have more friends than you do")
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다. 이 프로젝트의 단순화된 모델이며 실제 인맥 데이터가 아니다.
 *
 * 규칙
 *  - 사람 n명이 한 명씩 들어온다. 처음 m+1명은 서로 모두 친구. 이후 들어오는 사람은 기존 사람 m명과 친구가 된다 (m = 평균 친구 수 / 2)
 *  - 친구 고르기: 확률 hub로 "친구가 많은 사람일수록 더 잘 뽑히는" 방식(선호 연결), 나머지는 아무나 똑같은 확률
 *    hub = 0이면 아무나 균등하게, hub = 1이면 인기 있는 사람에게 몰리는 허브형 (바라바시-알버트 모델과 같은 규칙)
 *  - 수치: <k> = 한 사람의 평균 친구 수, m_i = i의 친구들이 가진 친구 수의 평균, 친구 목록을 이어 붙여 한 명을 뽑으면 평균 <k²>/<k>
 *  - 어떤 사람 i는 m_i > k_i(친구가 나보다 많다)인지 본다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Friendship = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 150, hub: 0.8, avg: 6, rounds: 300, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 친구 관계망 만들기. 반환: 사람마다 친구 번호 목록
  function network(p, rng) {
    const n = p.n, m = Math.max(1, Math.round(p.avg / 2));
    const adj = []; for (let i = 0; i < n; i++) adj.push([]);
    const stubs = []; // 친구 관계의 양 끝을 모두 적어 둔 목록: 아무 칸이나 뽑으면 친구 수에 비례해 뽑힌다
    const link = (a, b) => { adj[a].push(b); adj[b].push(a); stubs.push(a, b); };
    const core = Math.min(n, m + 1);
    for (let i = 0; i < core; i++) for (let j = 0; j < i; j++) link(i, j);
    for (let v = core; v < n; v++) {
      const chosen = [];
      let guard = 0;
      while (chosen.length < m && guard++ < 1000) {
        const u = rng() < p.hub ? stubs[Math.floor(rng() * stubs.length)] : Math.floor(rng() * v);
        if (chosen.indexOf(u) < 0) chosen.push(u);
      }
      chosen.forEach((u) => link(v, u));
    }
    return adj;
  }

  // 측정: 평균 친구 수, 친구들의 평균 친구 수 등
  function measure(adj) {
    const n = adj.length, deg = adj.map((a) => a.length);
    let sk = 0, sk2 = 0, maxD = 0;
    for (let i = 0; i < n; i++) { sk += deg[i]; sk2 += deg[i] * deg[i]; if (deg[i] > maxD) maxD = deg[i]; }
    const fr = new Float64Array(n); // fr[i] = i의 친구들이 가진 친구 수의 평균
    let sumFr = 0, fewer = 0, equal = 0, more = 0, sumDiff = 0;
    for (let i = 0; i < n; i++) {
      let s = 0; adj[i].forEach((j) => { s += deg[j]; });
      fr[i] = adj[i].length ? s / adj[i].length : 0;
      sumFr += fr[i]; sumDiff += fr[i] - deg[i];
      if (fr[i] > deg[i]) fewer++; else if (fr[i] === deg[i]) equal++; else more++;
    }
    return {
      n, deg, fr, maxDeg: maxD,
      meanDeg: sk / n,              // 한 사람의 평균 친구 수 <k>
      meanFriendDeg: sumFr / n,     // 사람마다 "친구들 평균"을 구해 다시 평균 낸 값
      listMean: sk2 / sk,           // 친구 목록을 이어 붙여 한 명을 뽑을 때의 평균 <k²>/<k>
      fewerShare: fewer / n,        // 친구가 나보다 평균적으로 더 많은 사람의 비율
      equalShare: equal / n, moreShare: more / n,
      meanGap: sumDiff / n,
    };
  }

  // 그림용 배치: 힘 방향 알고리즘(Fruchterman-Reingold). 이웃은 끌어당기고 모두는 밀어낸다. 0~1 사각형 안에 배치
  function layout(adj, seed, iters) {
    const n = adj.length, rng = mulberry32(seed * 977 + 13), x = new Float64Array(n), y = new Float64Array(n);
    for (let i = 0; i < n; i++) { x[i] = 0.5 + (rng() - 0.5) * 0.8; y[i] = 0.5 + (rng() - 0.5) * 0.8; }
    const k = 0.75 / Math.sqrt(n), dx = new Float64Array(n), dy = new Float64Array(n), T = iters || 200;
    for (let it = 0; it < T; it++) {
      dx.fill(0); dy.fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let ex = x[i] - x[j], ey = y[i] - y[j], d2 = ex * ex + ey * ey; if (d2 < 1e-6) { ex = 1e-3; ey = 0; d2 = 1e-6; }
        const f = (k * k) / d2; dx[i] += ex * f; dy[i] += ey * f; dx[j] -= ex * f; dy[j] -= ey * f;
      }
      for (let i = 0; i < n; i++) adj[i].forEach((j) => {
        if (j < i) return;
        const ex = x[i] - x[j], ey = y[i] - y[j], d = Math.sqrt(ex * ex + ey * ey) || 1e-6, f = d / k;
        dx[i] -= ex * f; dy[i] -= ey * f; dx[j] += ex * f; dy[j] += ey * f;
      });
      const temp = 0.08 * (1 - it / T) + 0.002;
      for (let i = 0; i < n; i++) {
        dx[i] += (0.5 - x[i]) * 0.3 * k * 0.5; dy[i] += (0.5 - y[i]) * 0.3 * k * 0.5; // 아주 약한 중심 쪽 당김
        const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1e-9, s = Math.min(d, temp) / d;
        x[i] += dx[i] * s; y[i] += dy[i] * s;
      }
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; // 화면을 꽉 채우도록 늘린다
    for (let i = 0; i < n; i++) { x0 = Math.min(x0, x[i]); x1 = Math.max(x1, x[i]); y0 = Math.min(y0, y[i]); y1 = Math.max(y1, y[i]); }
    for (let i = 0; i < n; i++) { x[i] = (x[i] - x0) / (x1 - x0 || 1); y[i] = (y[i] - y0) / (y1 - y0 || 1); }
    return { x, y };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts), rng = mulberry32(p.seed * 8191 + 3);
    const adj = network(p, rng), M = measure(adj), lay = layout(adj, p.seed, p.layoutIters), n = p.n;
    const sim = {
      params: p, adj, M, lay, round: 0, sumSelf: 0, sumFriend: 0, lastSelf: -1, lastFriend: -1, sampler: mulberry32(p.seed * 31 + 7),
      // 표본 한 번: 무작위로 한 사람을 고르고, 또 무작위로 고른 다른 사람이 말해 준 친구 한 명을 고른다
      advance() {
        if (sim.round >= p.rounds) return false;
        const s = sim.sampler, a = Math.floor(s() * n), b = Math.floor(s() * n), f = adj[b][Math.floor(s() * adj[b].length)];
        sim.lastSelf = a; sim.lastFriend = f; sim.sumSelf += M.deg[a]; sim.sumFriend += M.deg[f]; sim.round++;
        return true;
      },
      done() { return sim.round >= p.rounds; },
      selfMean() { return sim.round ? sim.sumSelf / sim.round : 0; },
      friendMean() { return sim.round ? sim.sumFriend / sim.round : 0; },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 여러 네트워크의 평균 (그림 없이 빠르게)
  function study(opts, nets, seedBase) {
    const p = Object.assign({}, DEFAULTS, opts), acc = { meanDeg: 0, meanFriendDeg: 0, listMean: 0, fewerShare: 0, equalShare: 0, moreShare: 0, maxDeg: 0 };
    const runs = [];
    for (let t = 0; t < nets; t++) {
      const M = measure(network(p, mulberry32(((seedBase || 5) * 1000 + t) * 8191 + 3)));
      Object.keys(acc).forEach((k) => { acc[k] += M[k] / nets; });
      runs.push(M);
    }
    acc.runs = runs; return acc;
  }

  // 처음 선택해 보여 줄 사람: 평균에 가까운 친구 수를 가진 사람 중 친구들 평균이 가장 높은 사람
  function typicalPerson(M) {
    const sorted = Array.from(M.deg).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    let best = -1;
    for (let i = 0; i < M.n; i++) if (M.deg[i] === med && (best < 0 || M.fr[i] > M.fr[best])) best = i;
    return best < 0 ? 0 : best;
  }

  return { DEFAULTS, mulberry32, network, measure, layout, create, study, typicalPerson };
});
