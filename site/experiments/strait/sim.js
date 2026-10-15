// 길목 하나가 막히면: 가상 지구본의 항로망 + 혼잡(BPR꼴) + 길목 앞 줄(대기) + 조금씩 길을 바꾸는 화물. 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32).
// - 항구 14곳(가상 바다 넷: 노을·새벽·별·얼음 바다), 바다 가운데 모이는 곳(허브) 4곳, 바다 사이 바닷길 5개(해협 셋 + 얼음 바다 우회로 둘).
// - 항구 둘 사이마다 1주에 일정량(세계마다 0.7~1.3배)의 화물이 오간다. 화물은 "지금 가장 빨리 가는 길"을 고르되, 한 주에 30%만 길을 바꾼다.
// - 바닷길 시간 = 기본 일수 × (1 + 0.15 × (짐 / 용량)^4) + 줄 서서 기다리는 일수(= 줄 / 용량 × 7). 짐이 용량을 넘으면 넘친 만큼 줄이 쌓인다.
// - 막힌 길목은 지날 수 없다(그 길을 쓰던 화물은 바로 다른 길로). 다시 열리면 화물은 조금씩 돌아오고, 쌓인 줄은 남는 용량만큼 줄어든다.
// - 수입 물가 지수(평소 = 100): 수입품 값 = 물건값 80% + 운송비 20%(이 모델의 설정), 운송비는 걸리는 일수에 비례.
// 시간 단위 = 1주. 모든 숫자는 이 모델의 예시이며 실제 해협·항로·물가가 아니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Strait = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const C = {
    SWITCH: 0.3,        // 한 주에 길을 바꾸는 화물 비율
    BPR_A: 0.15, BPR_B: 4,
    SHARE: 0.2,         // 수입품 값에서 운송비 몫(평소)
    WARM: 60,           // 시작 전 길이 자리 잡도록 미리 돌리는 주
    START: 4,           // 몇 주째에 막히나
    WEEKS: 80,
    PORT_DAYS: 3,       // 항구 ↔ 바다 가운데
  };
  // 바다(지역): 0 노을(서), 1 새벽(동), 2 별(남, 지구 반대편), 3 얼음(북)
  const SEAS = [
    { name: '노을 바다', hub: [22, -60], ports: [[15, -15], [12, 18], [-14, 8], [-6, -22]] },
    { name: '새벽 바다', hub: [22, 60], ports: [[15, 15], [12, -18], [-14, -8], [-6, 22]] },
    { name: '별 바다', hub: [-25, 180], ports: [[15, -15], [16, 14], [-14, 10], [-10, -18]] },
    { name: '얼음 바다', hub: [60, 0], ports: [[8, -24], [8, 24]] },
  ];
  // 바닷길: 허브 a ↔ 허브 b, 기본 일수, 용량(1주 화물), 지나는 점(그림용 위도·경도)
  const ROUTES = [
    { id: 'A', name: '가람 해협', a: 0, b: 1, days: 14, cap: 60, via: [[12, 0]], strait: true },
    { id: 'B', name: '누리 해협', a: 1, b: 2, days: 14, cap: 50, via: [[-6, 120]], strait: true },
    { id: 'C', name: '다솜 해협', a: 2, b: 0, days: 14, cap: 50, via: [[-6, -120]], strait: true },
    { id: 'N1', name: '우회로 서쪽', a: 0, b: 3, days: 9, cap: 30, via: [], detour: true },
    { id: 'N2', name: '우회로 동쪽', a: 3, b: 1, days: 9, cap: 30, via: [], detour: true },
  ];
  const DEFAULTS = { which: 'A', dur: 10, cap: 1, detour: 1, seed: 1 };

  // 그래프: 노드 0..13 항구, 14..17 허브
  const PORTS = [];
  SEAS.forEach((s, si) => s.ports.forEach((o, k) => PORTS.push({ sea: si, k, name: `${s.name} ${k + 1}항`, lat: s.hub[0] + o[0], lon: s.hub[1] + o[1] })));
  const NP = PORTS.length, HUB0 = NP;

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32(P.seed * 9973 + 7);
    // 간선
    const E = [];
    PORTS.forEach((p, i) => E.push({ u: i, v: HUB0 + p.sea, t0: C.PORT_DAYS, cap: Infinity, route: -1 }));
    ROUTES.forEach((r, ri) => E.push({ u: HUB0 + r.a, v: HUB0 + r.b, t0: r.days * (r.detour ? P.detour : 1), cap: r.cap * P.cap, route: ri }));
    const NN = NP + SEAS.length, adj = Array.from({ length: NN }, () => []);
    E.forEach((e, k) => { adj[e.u].push([e.v, k]); adj[e.v].push([e.u, k]); });
    const blockedRoute = ROUTES.findIndex((r) => r.id === P.which);
    // 화물: 항구 둘 사이(양방향 각각)
    const OD = [];
    for (let o = 0; o < NP; o++) for (let d = 0; d < NP; d++) if (o !== d) OD.push({ o, d, q: 0.7 + 0.6 * rnd(), paths: [] });
    const flow = new Float64Array(E.length), dirF = new Float64Array(E.length * 2), Q = new Float64Array(E.length), cost = new Float64Array(E.length);
    let blocked = false;
    function edgeCost(k) {
      const e = E[k];
      if (blocked && blockedRoute >= 0 && e.route === blockedRoute) return Infinity;
      if (e.cap === Infinity) return e.t0;
      const x = flow[k] / e.cap;
      return e.t0 * (1 + C.BPR_A * Math.pow(x, C.BPR_B)) + 7 * Q[k] / e.cap;
    }
    function costs() { for (let k = 0; k < E.length; k++) cost[k] = edgeCost(k); }
    // 한 출발지에서 모든 곳까지 가장 빠른 길 (작은 그래프라 단순 다익스트라)
    function tree(src) {
      const dist = new Float64Array(NN).fill(Infinity), pe = new Int32Array(NN).fill(-1), done = new Uint8Array(NN);
      dist[src] = 0;
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < NN; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
        if (u < 0) break; done[u] = 1;
        // 항구는 지나가는 곳이 아님 (출발지 제외)
        if (u < NP && u !== src) continue;
        for (const [w, k] of adj[u]) { const nd = dist[u] + cost[k]; if (nd < dist[w] - 1e-12) { dist[w] = nd; pe[w] = k; } }
      }
      return { dist, pe };
    }
    function pathTo(tr, src, d) {
      const es = [], dirs = []; let x = d;
      while (x !== src) { const k = tr.pe[x]; if (k < 0) return null; const e = E[k]; const from = e.u === x ? e.v : e.u; es.push(k); dirs.push(e.u === from ? 0 : 1); x = from; }
      es.reverse(); dirs.reverse(); return { es, dirs, key: es.join(',') };
    }
    const pathCost = (p) => { let s = 0; for (const k of p.es) s += cost[k]; return s; };
    function load() {
      flow.fill(0); dirF.fill(0);
      for (const od of OD) for (const p of od.paths) for (let j = 0; j < p.es.length; j++) { flow[p.es[j]] += p.f; dirF[p.es[j] * 2 + p.dirs[j]] += p.f; }
    }
    // 한 주: 비용을 보고 일부가 가장 빠른 길로 옮긴다 → 짐 → 줄 → 비용
    function assign(share) {
      costs();
      const trees = []; for (let o = 0; o < NP; o++) trees.push(tree(o));
      for (const od of OD) {
        const bp = pathTo(trees[od.o], od.o, od.d);
        let tgt = od.paths.find((p) => p.key === bp.key);
        if (!tgt) { tgt = Object.assign(bp, { f: 0 }); od.paths.push(tgt); }
        let moved = 0;
        for (const p of od.paths) {
          if (p === tgt) continue;
          const forced = blocked && blockedRoute >= 0 && p.es.some((k) => E[k].route === blockedRoute);
          const m = forced ? p.f : p.f * share; p.f -= m; moved += m;
        }
        tgt.f += moved;
        if (od.paths.length > 1) od.paths = od.paths.filter((p) => p.f > 1e-9 || p === tgt);
      }
      load();
      for (let k = 0; k < E.length; k++) {
        const e = E[k]; if (e.cap === Infinity) continue;
        if (blocked && blockedRoute >= 0 && e.route === blockedRoute) { Q[k] = 0; continue; }
        Q[k] = Math.max(0, Q[k] + flow[k] - e.cap);
      }
      costs();
    }
    function importCost() {   // 항구별 수입 화물의 평균 걸리는 일수
      const num = new Float64Array(NP), den = new Float64Array(NP);
      for (const od of OD) for (const p of od.paths) { if (p.f <= 0) continue; num[od.d] += p.f * pathCost(p); den[od.d] += p.f; }
      return Array.from(num, (v, i) => v / den[i]);
    }
    // 처음: 막힘 없이 미리 돌려 자리 잡기
    for (const od of OD) od.paths = [];
    costs();
    { const trees = []; for (let o = 0; o < NP; o++) trees.push(tree(o)); for (const od of OD) { const bp = pathTo(trees[od.o], od.o, od.d); od.paths.push(Object.assign(bp, { f: od.q })); } }
    load();
    for (let w = 0; w < C.WARM; w++) assign(C.SWITCH);
    const base = importCost();
    // 막힌 길목을 평소에 지나던 수입 화물이 있는 항구 = '쓰던 나라', 나머지 = '먼 나라'
    const uses = new Uint8Array(NP);
    for (const od of OD) for (const p of od.paths) if (blockedRoute >= 0 && p.f > 1e-6 && p.es.some((k) => E[k].route === blockedRoute)) uses[od.d] = 1;
    const RE = ROUTES.map((r, ri) => E.findIndex((e) => e.route === ri));
    const S = {
      params: P, E, OD, PORTS, ROUTES, RE, flow, dirF, Q, cost, base, uses, t: 0, done: false,
      blockedRoute, blocked: false, reopenAt: C.START + P.dur,
      idx: base.map(() => 100), hist: [], loadHist: [], qHist: [],
      peak: 100, peakFar: 100, peakUse: 100, peakPort: -1, peakFarPort: -1, maxLoad: 0, recoverAt: null,
      step() {
        if (S.done) return false;
        S.t += 1;
        blocked = S.t >= C.START && S.t < S.reopenAt; S.blocked = blocked;
        assign(C.SWITCH);
        const ic = importCost();
        S.idx = ic.map((v, i) => 100 * (1 - C.SHARE + C.SHARE * v / base[i]));
        let m = 0, mi = 0, mf = 100, mfi = -1, mu = 100, sf = 0, nf = 0, su = 0, nu = 0;
        S.idx.forEach((v, i) => { if (v > m) { m = v; mi = i; } if (uses[i]) { su += v; nu++; if (v > mu) mu = v; } else { sf += v; nf++; if (v > mf) { mf = v; mfi = i; } } });
        if (m > S.peak) { S.peak = m; S.peakPort = mi; }
        if (mf > S.peakFar) { S.peakFar = mf; S.peakFarPort = mfi; }
        if (mu > S.peakUse) S.peakUse = mu;
        const loads = RE.map((k) => (E[k].route === blockedRoute && blocked ? 0 : flow[k] / E[k].cap));
        loads.forEach((x, ri) => { if (ri !== blockedRoute && x > S.maxLoad) S.maxLoad = x; });
        S.hist.push({ t: S.t, blocked, useAvg: nu ? su / nu : 100, farAvg: nf ? sf / nf : 100, max: m, farMax: mf, idx: S.idx.slice() });
        S.loadHist.push(loads); S.qHist.push(RE.map((k) => Q[k]));
        if (S.recoverAt == null && S.t >= S.reopenAt && m <= 100.5) S.recoverAt = S.t;
        if (S.t >= C.WEEKS) S.done = true;
        return true;
      },
      routeLoad(ri) { const k = RE[ri]; return blocked && ri === blockedRoute ? 0 : flow[k] / E[k].cap; },
      routeQ(ri) { return Q[RE[ri]]; },
    };
    return S;
  }
  // 집계용: 끝까지
  function run(opt) {
    const s = create(opt); while (s.step());
    return { peak: s.peak, peakFar: s.peakFar, peakUse: s.peakUse, maxLoad: s.maxLoad, recover: s.recoverAt == null ? null : s.recoverAt - s.reopenAt, s };
  }
  return { create, run, DEFAULTS, C, SEAS, ROUTES, PORTS, mulberry32 };
});
