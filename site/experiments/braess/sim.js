/*
 * 브라에스의 역설: 새 도로를 뚫었더니 모두의 출근 시간이 늘어나는 교통망 모델
 * (Braess 1968, "Über ein Paradoxon aus der Verkehrsplanung", Unternehmensforschung 12). 이 프로젝트의 단순화된 구현이다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 도로망: 출발 -> A -> 도착, 출발 -> B -> 도착, 그리고 A -> B로 가는 지름길(선택)
 *  - 출발->A, B->도착: 막히는 길. 이 길을 쓰는 운전자가 x명이면 걸리는 시간 = x * sens / 1000 분
 *  - A->도착, 출발->B: 늘 fixed(45)분 걸리는 길 (다리, 우회로 등)
 *  - 지름길 A->B: 지름길 비용 cost 분 (막히지 않음)
 * 길은 세 가지: A 길(출발->A->도착), B 길(출발->B->도착), 지름길 경유(출발->A->B->도착)
 * 운전자 n명은 저마다 "지금 내가 옮겨 간다면 걸릴 시간"이 더 짧은 길이 있으면 옮긴다 (최선 응답).
 * 매 라운드 각 운전자가 확률 revise로 길을 다시 고르고, 한 명씩 차례로 옮기므로 결국 아무도 혼자 옮겨서 이득을 볼 수 없는 균형(내시 균형)에 닿는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Braess = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 4000, cost: 0, sens: 10, fixed: 45, plan: 'open', rounds: 180, switchAt: 50, revise: 0.08, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const slope = (p) => p.sens / 1000; // 운전자 1명이 늘 때마다 막히는 길에서 늘어나는 시간(분)

  // ---------- 이론값 (운전자를 연속된 양으로 본 균형) ----------
  // 대칭 구조라 A 길과 B 길의 이용자 수가 같다. 지름길을 열었을 때의 균형:
  //  a*n + cost <= fixed 이면 모두 지름길 경유 (시간 2*a*n + cost)
  //  그 위로 a*n < 2*(fixed - cost) 이면 일부만 지름길을 쓰고, 세 길의 시간이 모두 같아져 fixed*2 - cost
  //  그보다 붐비면 아무도 지름길을 쓰지 않아 닫힌 길과 같다
  function equilibrium(p, open) {
    const a = slope(p), n = p.n, F = p.fixed, c = p.cost;
    const closedTime = F + (a * n) / 2;
    if (!open || c >= F) return { time: closedTime, shares: [0.5, 0.5, 0], open: false };
    if (a * n + c <= F) return { time: 2 * a * n + c, shares: [0, 0, 1], open: true };
    if (a * n < 2 * (F - c)) {
      const L = (F - c) / a; // 막히는 두 길 각각에 몰린 인원
      const f = n - L; // A 길, B 길 이용자 각각
      return { time: 2 * F - c, shares: [f / n, f / n, (n - 2 * f) / n], open: true };
    }
    return { time: closedTime, shares: [0.5, 0.5, 0], open: true };
  }

  // 사회 최적: 길 배분을 중앙에서 정할 수 있을 때 평균 시간의 최솟값 (대칭 배분만 훑는다. 막히는 길은 볼록이라 충분하다)
  function optimum(p, open) {
    const a = slope(p), n = p.n, F = p.fixed, c = p.cost;
    const avg = (f) => { // A 길, B 길 각 f명, 지름길 n-2f명
      const L = n - f; // 막히는 길 하나의 부하
      return (2 * f * (a * L + F) + (n - 2 * f) * (2 * a * L + c)) / n;
    };
    const top = Math.floor(n / 2);
    let best = Infinity, bf = 0;
    const lo = open ? 0 : top; // 닫혀 있으면 f = n/2 (지름길 없음)
    for (let f = lo; f <= top; f++) { const v = avg(f); if (v < best) { best = v; bf = f; } }
    return { time: best, shortcutShare: (n - 2 * bf) / n };
  }

  // 한 설정의 요약: 지름길 없을 때 균형, 있을 때 균형, 사회 최적, 무정부 가격
  function summary(p) {
    p = Object.assign({}, DEFAULTS, p);
    const closed = equilibrium(p, false), open = equilibrium(p, true), opt = optimum(p, true);
    return { closed: closed.time, open: open.time, opt: opt.time, poa: open.time / opt.time, change: open.time - closed.time, openShares: open.shares };
  }

  // ---------- 운전자 시뮬레이션 ----------
  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 7919 + 11), a = slope(p), n = p.n, F = p.fixed, c = p.cost;
    const route = new Int8Array(n), cnt = [0, 0, 0];
    let open = p.plan === 'close'; // 'open' = 닫힌 길로 시작해 중간에 연다, 'close' = 열린 길로 시작해 중간에 막는다
    for (let i = 0; i < n; i++) { const r = Math.floor(rng() * (open ? 3 : 2)); route[i] = r; cnt[r]++; }
    const sim = {
      params: p, round: 0, open, changes: [], pending: true,
      avg: [], shares: [], times: [], flags: [], moved: [],
    };
    const loads = () => [cnt[0] + cnt[2], cnt[1] + cnt[2]]; // [출발->A, B->도착]
    const cost = (r, LA, LB) => (r === 0 ? a * (LA + 1) + F : r === 1 ? F + a * (LB + 1) : a * (LA + 1) + c + a * (LB + 1));
    function routeTimes() {
      const [LA, LB] = loads();
      return [a * LA + F, F + a * LB, a * LA + c + a * LB];
    }
    function record(moved) {
      const t = routeTimes(); let s = 0;
      for (let r = 0; r < 3; r++) s += cnt[r] * t[r];
      sim.avg.push(s / n); sim.shares.push([cnt[0] / n, cnt[1] / n, cnt[2] / n]); sim.times.push(t); sim.flags.push(sim.open); sim.moved.push(moved);
    }
    sim.setOpen = function (v) {
      if (v === sim.open) return;
      sim.open = v; sim.pending = false; sim.changes.push({ round: sim.round, open: v });
      if (!v) { // 길을 막으면 지름길 이용자는 A 길, B 길로 반반 갈라진다
        for (let i = 0; i < n; i++) if (route[i] === 2) { const r = rng() < 0.5 ? 0 : 1; route[i] = r; cnt[2]--; cnt[r]++; }
      }
    };
    sim.toggle = function () { sim.setOpen(!sim.open); };
    sim.counts = () => cnt.slice();
    sim.routeTimes = routeTimes;
    sim.avgNow = () => { const t = routeTimes(); let s = 0; for (let r = 0; r < 3; r++) s += cnt[r] * t[r]; return s / n; };
    sim.advance = function () {
      if (sim.round >= p.rounds) return false;
      if (sim.round === 0) record(0);
      if (sim.pending && sim.round === p.switchAt) { sim.setOpen(p.plan !== 'close'); sim.pending = false; }
      const R = sim.open ? 3 : 2; let moved = 0;
      for (let i = 0; i < n; i++) {
        if (rng() >= p.revise) continue;
        const r = route[i];
        cnt[r]--;
        const [LA, LB] = loads();
        const cur = cost(r, LA, LB); // 나를 뺀 상태에서 현재 길을 다시 고른다면
        let best = r, bv = cur;
        for (let q = 0; q < R; q++) {
          if (q === r) continue;
          const v = cost(q, LA, LB);
          if (v < bv - 1e-9) { best = q; bv = v; } // 확실히 더 빠를 때만 옮긴다
        }
        cnt[best]++; route[i] = best; if (best !== r) moved++;
      }
      sim.round++; record(moved);
      return true;
    };
    sim.done = () => sim.round >= p.rounds;
    sim.run = () => { while (sim.advance()); return sim; };
    return sim;
  }

  // 지름길 비용·운전자 수를 바꿔 가며 훑는 곡선 (이론 균형 기준)
  function curveN(base, ns) { return ns.map((n) => { const s = summary(Object.assign({}, base, { n })); return { x: n, closed: s.closed, open: s.open, opt: s.opt, poa: s.poa }; }); }
  function curveC(base, cs) { return cs.map((cost) => { const s = summary(Object.assign({}, base, { cost })); return { x: cost, closed: s.closed, open: s.open, opt: s.opt, poa: s.poa }; }); }

  return { DEFAULTS, create, equilibrium, optimum, summary, curveN, curveC };
});
