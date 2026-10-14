/*
 * 란체스터의 법칙: 두 군대가 서로 병력을 깎아 먹는 단순한 수학 모델 (이 프로젝트의 단순화된 구현).
 * F. W. Lanchester, Aircraft in Warfare (1916)에서 소개된 두 가지 법칙을 따른다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 병사는 점으로, 질(quality)은 병사 한 명의 명중률이다. 두 군대 이름은 추상적인 파랑(a)과 빨강(b)이다.
 *  - 제곱 법칙(square): 멀리서 겨누어 쏜다. 누구나 상대 아무에게나 쏠 수 있어 병력이 많을수록 손실도 빨리 준다.
 *      dA/dt = -β·B,  dB/dt = -α·A   =>  α·A² - β·B² 가 변하지 않는다 (전투력 = 질 × 병력²)
 *  - 선형 법칙(linear): 일대일로 맞붙는다. 동시에 싸우는 쌍은 min(A, B)쌍뿐이다.
 *      dA/dt = -β·min(A,B),  dB/dt = -α·min(A,B)   =>  α·A - β·B 가 변하지 않는다 (전투력 = 질 × 병력)
 * 질 비율 q = α/β 이고, 싸움의 빠르기가 같도록 α = rate·√q, β = rate/√q 로 둔다.
 * 나뉘어 싸우기(split): 한쪽 군대가 반씩 둘로 나뉘어 도착하는 경우. 두 번째 반은 첫 반이 모두 쓰러진 뒤에야 전선에 들어온다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Lanchester = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEFAULTS = { a: 200, b: 100, q: 1, law: 'square', split: 'none', seed: 1, rate: 0.012 };

  function mulberry32(s) {
    let t = s >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 선형 법칙은 맞붙는 쌍이 적어 느리게 끝나므로 쌍마다의 기본 명중률을 5배로 둔다 (법칙의 결과 병력 수에는 영향이 없다)
const rates = (q, rate, law) => { const r = rate * (law === 'linear' ? 5 : 1); return { pa: r * Math.sqrt(q), pb: r / Math.sqrt(q) }; };

  // ---------- 이론값 (연속 근사) ----------
  // 한 번의 싸움: 병력 x(질 α) 대 y(질 β). 법칙에 따라 보존되는 양으로 남는 병력을 구한다
  function fight(law, x, y, al, be) {
    if (law === 'linear') {
      const s = al * x - be * y;
      return s > 0 ? [s / al, 0] : s < 0 ? [0, -s / be] : [0, 0];
    }
    const s = al * x * x - be * y * y;
    return s > 0 ? [Math.sqrt(s / al), 0] : s < 0 ? [0, Math.sqrt(-s / be)] : [0, 0];
  }
  // 최종 결과. split이 'a'면 파랑이 반씩 나뉘어 차례로 들어오고, 'b'면 빨강이 그렇다. {winner:'a'|'b'|null, aLeft, bLeft}
  function outcome(law, a, b, q, split) {
    const al = Math.sqrt(q), be = 1 / Math.sqrt(q);
    let ga = split === 'a' ? [a / 2, a / 2] : [a], gb = split === 'b' ? [b / 2, b / 2] : [b];
    let ia = 0, ib = 0, xa = ga[0], xb = gb[0];
    while (xa > 0 && xb > 0) {
      const r = fight(law, xa, xb, al, be); xa = r[0]; xb = r[1];
      if (xa <= 0 && ia + 1 < ga.length) { ia++; xa = ga[ia]; }
      if (xb <= 0 && ib + 1 < gb.length) { ib++; xb = gb[ib]; }
    }
    // 이긴 쪽에 남은 병력 = 싸우던 무리 + 아직 들어오지 않은 뒤 무리
    const restA = ga.slice(ia + 1).reduce((s, v) => s + v, 0), restB = gb.slice(ib + 1).reduce((s, v) => s + v, 0);
    const aLeft = xa > 0 ? xa + restA : 0, bLeft = xb > 0 ? xb + restB : 0;
    const winner = aLeft > 1e-9 ? 'a' : bLeft > 1e-9 ? 'b' : null;
    return { winner, aLeft, bLeft };
  }
  // 전투력: 제곱 법칙은 질 × 병력², 선형 법칙은 질 × 병력
  function strength(law, n, quality) { return quality * (law === 'linear' ? n : n * n); }
  // 파랑의 전투력 ÷ 빨강의 전투력 (처음 상태, 한곳에 모였을 때)
  function strengthRatio(law, a, b, q) { return strength(law, a, Math.sqrt(q)) / strength(law, b, 1 / Math.sqrt(q)); }

  // ---------- 한 번의 전투 (병사 하나하나) ----------
  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts);
    const rnd = mulberry32(P.seed * 7919 + 17);
    const R = rates(P.q, P.rate, P.law);
    // 한쪽 군대: 병사마다 살았는지(alive), 어느 무리인지(grp)
    function army(n, splitted) {
      const g0 = splitted ? Math.floor(n / 2) : n;
      const grp = new Uint8Array(n), alive = new Uint8Array(n).fill(1);
      for (let i = g0; i < n; i++) grp[i] = 1;
      return { n, grp, alive, active: 0, groups: splitted ? 2 : 1, g0, activeIdx: [] };
    }
    const S = [army(P.a, P.split === 'a'), army(P.b, P.split === 'b')];
    const sim = { params: P, armies: S, step: 0, hist: [], events: [], pairs: [], over: false };
    function refresh(s) { // 지금 전선에서 싸우는 살아 있는 병사 목록
      s.activeIdx = [];
      for (let i = 0; i < s.n; i++) if (s.alive[i] && s.grp[i] === s.active) s.activeIdx.push(i);
      if (!s.activeIdx.length && s.active + 1 < s.groups) { // 첫 무리가 모두 쓰러져 뒤 무리가 들어온다
        s.active++;
        for (let i = 0; i < s.n; i++) if (s.alive[i] && s.grp[i] === s.active) s.activeIdx.push(i);
      }
    }
    const total = (s) => { let c = 0; for (let i = 0; i < s.n; i++) c += s.alive[i]; return c; };
    function record() {
      sim.hist.push({ a: total(S[0]), b: total(S[1]), ea: S[0].activeIdx.length, eb: S[1].activeIdx.length });
    }
    function binom(n, p) { let k = 0; for (let i = 0; i < n; i++) if (rnd() < p) k++; return k; }
    function pick(list, k) { // list에서 서로 다른 k개를 무작위로 (list를 섞어 앞 k개)
      const out = [], L = list.slice();
      for (let i = 0; i < k && i < L.length; i++) { const j = i + Math.floor(rnd() * (L.length - i)); const t = L[i]; L[i] = L[j]; L[j] = t; out.push(L[i]); }
      return out;
    }
    refresh(S[0]); refresh(S[1]); record();
    sim.isOver = () => total(S[0]) === 0 || total(S[1]) === 0 || sim.step >= 3000;
    sim.advance = function () {
      if (sim.over) return false;
      const A = S[0].activeIdx, B = S[1].activeIdx, a = A.length, b = B.length;
      const shooters = P.law === 'linear' ? Math.min(a, b) : null;
      const kb = Math.min(b, binom(P.law === 'linear' ? shooters : a, R.pa)); // 파랑이 쓰러뜨리는 빨강 수
      const ka = Math.min(a, binom(P.law === 'linear' ? shooters : b, R.pb));
      sim.events = []; sim.pairs = [];
      const deadB = pick(B, kb), deadA = pick(A, ka);
      deadB.forEach((i) => { S[1].alive[i] = 0; sim.events.push([0, A[Math.floor(rnd() * a)], 1, i]); });
      deadA.forEach((i) => { S[0].alive[i] = 0; sim.events.push([1, B[Math.floor(rnd() * b)], 0, i]); });
      if (P.law === 'linear') for (let k = 0; k < shooters; k++) sim.pairs.push([A[k], B[k]]);
      refresh(S[0]); refresh(S[1]); sim.step++; record();
      if (sim.isOver()) sim.over = true;
      return true;
    };
    sim.done = () => sim.over;
    sim.counts = () => [total(S[0]), total(S[1])];
    sim.run = function () { while (!sim.over) sim.advance(); return sim; };
    sim.result = function () {
      const c = sim.counts();
      return { winner: c[0] > 0 && c[1] === 0 ? 'a' : c[1] > 0 && c[0] === 0 ? 'b' : null, aLeft: c[0], bLeft: c[1] };
    };
    return sim;
  }

  // 같은 규칙을 평균값(연속)으로 풀어 본 기대 곡선 (나뉘지 않는 경우). 반환: [{a,b}]
  function meanField(opts, steps) {
    const P = Object.assign({}, DEFAULTS, opts), R = rates(P.q, P.rate, P.law);
    let a = P.a, b = P.b; const out = [{ a, b }];
    for (let t = 0; t < steps; t++) {
      const sa = P.law === 'linear' ? Math.min(a, b) : a, sb = P.law === 'linear' ? Math.min(a, b) : b;
      const na = Math.max(0, a - R.pb * sb), nb = Math.max(0, b - R.pa * sa);
      a = na; b = nb; out.push({ a, b });
    }
    return out;
  }

  return { DEFAULTS, create, outcome, fight, strength, strengthRatio, meanField, rates };
});
