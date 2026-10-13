/*
 * 벤치 자리 앉기: 서로 모르는 사람이 한 명씩 와서, 이미 앉은 사람과 최소 g칸을 비우고 앉는 모델.
 * (1차원 무작위 순차 흡착, "Rényi 주차 문제"의 이산판과 같은 구조다. 이 프로젝트의 단순화된 구현이다.)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * - 벤치에는 n개의 자리가 한 줄로 있다. 자리 i에 앉을 수 있는 조건: 비어 있고, 앞뒤 g칸 안에 앉은 사람이 없다.
 * - 앉을 자리가 없으면 그 사람은 돌아간다(돌려보낸 사람).
 * - 규칙 4가지: random(앉을 수 있는 자리 중 무작위), farthest(앉은 사람에게서 가장 먼 자리),
 *   edge(끝자리가 되면 거기, 아니면 무작위), orderly(0번부터 g+1칸 간격으로 빽빽하게)
 * - 정돈했을 때의 최대 인원: ceil(n / (g+1))
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Seating = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const RULES = ['random', 'farthest', 'edge', 'orderly'];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const cap = (n, g) => Math.ceil(n / (g + 1));

  // 자리 i에 앉을 수 있는가
  function canSit(occ, n, g, i) {
    if (i < 0 || i >= n || occ[i]) return false;
    for (let j = Math.max(0, i - g); j <= Math.min(n - 1, i + g); j++) if (occ[j]) return false;
    return true;
  }
  function allowedList(occ, n, g) {
    const a = []; for (let i = 0; i < n; i++) if (canSit(occ, n, g, i)) a.push(i);
    return a;
  }
  function pickRandom(occ, n, g, rng) {
    const a = allowedList(occ, n, g);
    return a.length ? a[Math.floor(rng() * a.length)] : -1;
  }
  function pick(rule, occ, n, g, rng) {
    const a = allowedList(occ, n, g);
    if (!a.length) return -1;
    if (rule === 'orderly') return a[0];
    if (rule === 'edge') {
      const ends = a.filter((i) => i === 0 || i === n - 1);
      if (ends.length) return ends[Math.floor(rng() * ends.length)];
      return a[Math.floor(rng() * a.length)];
    }
    if (rule === 'farthest') {
      let best = -1, bd = -1, ties = [];
      a.forEach((i) => {
        let d = 1e9;
        for (let j = 0; j < n; j++) if (occ[j]) d = Math.min(d, Math.abs(i - j));
        if (d > bd) { bd = d; ties = [i]; } else if (d === bd) ties.push(i);
      });
      return ties[Math.floor(rng() * ties.length)];
    }
    return a[Math.floor(rng() * a.length)];
  }

  // 한 줄 전체가 더는 앉을 수 없을 때까지 채운다. 앉은 인원을 돌려준다.
  function fillAll(rule, n, g, rng) {
    const occ = new Uint8Array(n); let s = 0;
    for (;;) { const i = pick(rule, occ, n, g, rng); if (i < 0) break; occ[i] = 1; s++; }
    return s;
  }
  function meanFill(rule, n, g, runs, seed) {
    const rng = mulberry32(seed || 7); let t = 0, runsArr = [];
    for (let r = 0; r < runs; r++) { const v = fillAll(rule, n, g, rng); t += v; runsArr.push(v); }
    return { mean: t / runs, runs: runsArr };
  }

  // 정확한 기댓값: 길이 L인 빈 구간에 무작위로 채울 때 앉는 사람 수의 기댓값 f(L). L=0..nmax
  function exact(nmax, g) {
    const f = new Float64Array(nmax + 1);
    for (let L = 1; L <= nmax; L++) {
      let s = 0;
      for (let i = 1; i <= L; i++) s += f[Math.max(0, i - 1 - g)] + f[Math.max(0, L - i - g)];
      f[L] = 1 + s / L;
    }
    return f;
  }
  // 아주 긴 벤치의 앉는 비율(이론, 플로리 식): ∫ exp(-u - 2 Σ_{j=1..g} (1-e^{-ju})/j) du
  function theta(g) {
    let s = 0; const du = 1e-3;
    for (let u = du / 2; u < 40; u += du) {
      let e = -u; for (let j = 1; j <= g; j++) e -= (2 * (1 - Math.exp(-j * u))) / j;
      s += Math.exp(e) * du;
    }
    return s;
  }

  // 한 판: 규칙 4개를 같은 도착 순서로 나란히 돌린다 (각 줄은 자기 난수)
  const DEFAULTS = { n: 24, g: 2, arrivals: 20, seed: 1 };
  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rows = RULES.map((rule, k) => ({ rule, occ: new Uint8Array(p.n), order: [], seated: 0, turned: 0, last: -1, rng: mulberry32(p.seed * 7919 + k * 104729 + 13) }));
    const sim = { params: p, rows, t: 0, cap: cap(p.n, p.g) };
    sim.advance = () => {
      if (sim.t >= p.arrivals) return false;
      rows.forEach((r) => {
        const i = pick(r.rule, r.occ, p.n, p.g, r.rng);
        if (i < 0) { r.turned++; r.last = -1; } else { r.occ[i] = 1; r.order.push(i); r.seated++; r.last = i; }
      });
      sim.t++; return true;
    };
    sim.done = () => sim.t >= p.arrivals;
    sim.run = () => { while (sim.advance()); return sim; };
    return sim;
  }

  return { RULES, DEFAULTS, create, cap, canSit, allowedList, pickRandom, pick, fillAll, meanFill, exact, theta, mulberry32 };
});
