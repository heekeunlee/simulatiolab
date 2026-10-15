// 약속을 어긴 나라와 다시 협상할 수 있을까: 평판이 망을 타고 퍼지는 반복 협상(신뢰 게임) 모델.
// 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32). 모든 상수는 이 프로젝트가 정한 무차원 설정이다.
// - 가상의 나라 N개(기본 24)가 가까운 나라끼리 소식을 주고받는 망(연결)으로 이어져 있다(실제 나라·지도 아님).
// - 라운드마다 모든 나라가 무작위로 둘씩 짝지어 협상한다. 둘 다 지키면 각자 +1, 한쪽만 어기면 어긴 쪽 1+유혹, 당한 쪽 −1, 둘 다 어기면 0.
// - 나라 j가 나라 i에게 가진 '나쁜 기억' b[j][i] (0~1). 당한 나라는 1. 소식은 망의 연결을 따라 전파율 확률로 옆 나라에 전해지고(전해질 때 0.8배),
//   라운드마다 망각률만큼 옅어진다. 상대의 나쁜 기억이 0.5를 넘으면 협상을 거절하고, 0.25~0.5면 협상은 하되 안전장치 비용 0.3을 문다.
// - 어길지 말지: 유혹(유혹 크기 × 나라 성향 × 그때그때의 흔들림)에서 보상금을 뺀 것이, 나라들이 "최근에 어긴 나라들이 그 뒤 30라운드 동안
//   잃은 거래"를 보고 어림한 손해보다 크면 어긴다(모두가 같은 어림을 공유한다).
// - 사과·보상: 어긴 나라는 다음 라운드에 당한 나라에게 손해 2 × 보상 비율을 물어 주고, 그 사과는 모두가 보므로 모든 나라의 그 나라에 대한
//   나쁜 기억이 (1 − 0.5 × 보상 비율)배로 줄어든다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Reputation = factory();
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
    REFUSE: 0.5,      // 나쁜 기억이 이보다 크면 거절
    WARY: 0.25,       // 이보다 크면 안전장치 비용을 문다
    WARY_COST: 0.3,   // 안전장치 비용
    HOP: 0.8,         // 소식이 한 다리 건너갈 때 남는 세기
    WINDOW: 30,       // 어긴 뒤 손해를 지켜보는 라운드 수
    LEARN: 0.15,      // 손해 어림을 새 관찰 쪽으로 옮기는 비율
    COST0: 3.0,       // 처음 손해 어림
    FADE: 0.02,       // 아무도 안 어기면 '어기면 손해'라는 어림도 라운드마다 이만큼 옅어진다
    FLOOR: 1.0,       // 그래도 '어기면 거래 하나쯤은 잃는다'는 어림 아래로는 내려가지 않는다
    NEAR: 3,          // 망: 나라마다 가까운 3나라와 연결
    REMIND: 0.75,     // 이웃이 같은 일을 기억하면 덜 잊는 정도
  };
  const DEFAULTS = { n: 24, tempt: 150, spread: 50, forget: 3, apology: 0, rounds: 240, seed: 1 };

  function buildNet(n, rnd) {
    const pos = [];
    for (let i = 0; i < n; i++) { const r = Math.sqrt(0.08 + 0.92 * rnd()), a = rnd() * Math.PI * 2; pos.push([r * Math.cos(a), r * Math.sin(a)]); }
    const adj = Array.from({ length: n }, () => new Set()), d2 = (i, j) => (pos[i][0] - pos[j][0]) ** 2 + (pos[i][1] - pos[j][1]) ** 2;
    for (let i = 0; i < n; i++) {
      const o = [...Array(n).keys()].filter((j) => j !== i).sort((a, b) => d2(i, a) - d2(i, b));
      for (let k = 0; k < C.NEAR; k++) { adj[i].add(o[k]); adj[o[k]].add(i); }
    }
    // 끊긴 덩어리가 있으면 가장 가까운 두 나라를 잇는다
    for (;;) {
      const seen = new Array(n).fill(false), st = [0]; seen[0] = true;
      while (st.length) { const u = st.pop(); adj[u].forEach((v) => { if (!seen[v]) { seen[v] = true; st.push(v); } }); }
      if (seen.every(Boolean)) break;
      let best = null;
      for (let i = 0; i < n; i++) if (seen[i]) for (let j = 0; j < n; j++) if (!seen[j]) { const d = d2(i, j); if (!best || d < best[0]) best = [d, i, j]; }
      adj[best[1]].add(best[2]); adj[best[2]].add(best[1]);
    }
    const edges = [];
    for (let i = 0; i < n; i++) adj[i].forEach((j) => { if (i < j) edges.push([i, j]); });
    return { pos, adj: adj.map((s) => [...s]), edges };
  }

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32((P.seed * 2654435761) >>> 0 ^ 0x5eed);
    const n = P.n, G = P.tempt / 100, sp = P.spread / 100, fg = P.forget / 100, ap = P.apology / 100;
    const net = buildNet(n, rnd);
    const trait = Array.from({ length: n }, () => 0.6 + 0.8 * rnd());   // 나라마다 어기고 싶은 성향 (0.6~1.4)
    const b = new Float64Array(n * n);          // b[j*n+i]: j가 i에게 가진 나쁜 기억
    const S = {
      params: P, n, net, trait, b, t: 0, done: false, cost: C.COST0,
      score: new Float64Array(n), breaks: new Int32Array(n),
      hist: { deal: [], coop: [], brk: [], cost: [], rep: [] },
      events: [],            // {t, i, j, forced}
      watch: [],             // 어긴 뒤 손해 지켜보기 {i, t, loss}
      open: [],              // 회복 재기 {i, t, forced}
      recov: [],             // {i, t, dur, forced}
      lastRound: { pairs: [], gossip: [], breaks: [] },
      forceNext: -1, _forced: null, reBroke: false, owed: [],
    };
    S.rep = (i) => { let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += b[j * n + i]; return 1 - s / (n - 1); };
    S.refusers = (i) => { let c = 0; for (let j = 0; j < n; j++) if (j !== i && b[j * n + i] > C.REFUSE) c++; return c; };
    S.repAll = () => { const r = new Float64Array(n); for (let i = 0; i < n; i++) r[i] = S.rep(i); return r; };
    // 3D 높이·밝기용: 나라 i에 대해 다른 나라들이 가진 나쁜 기억의 합 B로 '믿음 정도' = 1/(1+B) (깨끗하면 1)
    S.standAll = () => { const r = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += b[j * n + i]; r[i] = 1 / (1 + s); } return r; };
    S.stand = S.standAll(); S.standPrev = S.stand;

    function step() {
      if (S.done) return false;
      S.standPrev = S.stand;
      const t = ++S.t, order = [...Array(n).keys()];
      for (let k = n - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [order[k], order[r]] = [order[r], order[k]]; }
      // 지난 라운드에 어긴 나라가 물어 주는 보상 + 공개 사과
      if (ap > 0) for (const o of S.owed) {
        const pay = 2 * ap; S.score[o.i] -= pay; S.score[o.j] += pay;
        for (let j = 0; j < n; j++) b[j * n + o.i] *= (1 - 0.5 * ap);
        for (const w of S.watch) if (w.i === o.i && w.t === o.t) w.loss += pay;
      }
      S.owed = [];
      let deals = 0, coop = 0, brk = 0;
      const pairs = [], breaks = [], lostBy = new Float64Array(n);
      const wantBreak = (i) => {
        if (S.forceNext === i) return true;
        const g = G * trait[i] * (0.5 + rnd()) - 2 * ap;
        return g > S.cost;
      };
      for (let k = 0; k + 1 < n; k += 2) {
        const i = order[k], j = order[k + 1], bij = b[i * n + j], bji = b[j * n + i];
        if (bij > C.REFUSE || bji > C.REFUSE) {
          pairs.push({ i, j, kind: 'refuse' });
          if (bij > C.REFUSE) lostBy[j] += 1;      // i가 j를 거절: j가 잃은 거래
          if (bji > C.REFUSE) lostBy[i] += 1;
          continue;
        }
        deals++;
        let ci = 0, cj = 0;
        if (bij > C.WARY) { ci -= C.WARY_COST; lostBy[j] += C.WARY_COST; }
        if (bji > C.WARY) { cj -= C.WARY_COST; lostBy[i] += C.WARY_COST; }
        const di = wantBreak(i), dj = wantBreak(j);
        if (S.forceNext === i || S.forceNext === j) S.forceNext = -1;
        if (!di && !dj) { ci += 1; cj += 1; coop++; }
        else if (di && dj) { /* 둘 다 어김: 0 */ }
        else { const x = di ? i : j, y = di ? j : i; if (x === i) { ci += 1 + G; cj -= 1; } else { cj += 1 + G; ci -= 1; } }
        S.score[i] += ci; S.score[j] += cj;
        for (const [x, y, d] of [[i, j, di], [j, i, dj]]) {
          if (!d) continue;
          brk++; S.breaks[x]++; b[y * n + x] = 1;   // 당한 나라는 똑똑히 기억한다
          const forced = S._forced === x;
          if (forced) S._forced = null;
          if (S.open.some((o) => o.i === x && o.forced)) S.reBroke = true;
          S.events.push({ t, i: x, j: y, forced }); breaks.push({ i: x, j: y });
          S.watch.push({ i: x, t, loss: 0 });
          S.open = S.open.filter((o) => o.i !== x);   // 다시 어기면 그 전 회복 재기는 끝(따로 세지 않음)
          S.open.push({ i: x, t, forced });
          if (ap > 0) S.owed.push({ i: x, j: y, t });
        }
        pairs.push({ i, j, kind: di || dj ? 'break' : 'keep' });
      }
      // 어긴 나라가 그 뒤 잃은 거래 쌓기
      for (const w of S.watch) if (w.t < t) w.loss += lostBy[w.i];
      const keepW = [];
      for (const w of S.watch) {
        if (t - w.t >= C.WINDOW) S.cost = (1 - C.LEARN) * S.cost + C.LEARN * w.loss;
        else keepW.push(w);
      }
      S.watch = keepW;
      S.cost = C.FLOOR + (S.cost - C.FLOOR) * (1 - C.FADE);
      // 소식 전파: 연결마다 전파율 확률로 서로의 나쁜 기억을 전한다 (0.8배로)
      const gossip = [], old = Float64Array.from(b), talked = Array.from({ length: n }, () => []);
      for (const [u, v] of net.edges) {
        if (rnd() >= sp) continue;
        talked[u].push(v); talked[v].push(u);
        let moved = 0;
        for (let i = 0; i < n; i++) {
          if (i !== u) { const x = C.HOP * old[v * n + i]; if (x > b[u * n + i]) { moved = Math.max(moved, x - b[u * n + i]); b[u * n + i] = x; } }
          if (i !== v) { const x = C.HOP * old[u * n + i]; if (x > b[v * n + i]) { moved = Math.max(moved, x - b[v * n + i]); b[v * n + i] = x; } }
        }
        if (moved > 0.05) gossip.push([u, v, moved]);
      }
      // 잊기: 라운드마다 망각률만큼 옅어진다. 단, 이번 라운드에 이야기를 나눈 이웃도 같은 일을 기억하고 있으면(서로 다시 떠올려 줌)
      // 덜 잊는다: 실제로 잊는 비율 = 망각률 × (1 − 0.75 × 그 일을 기억하는 대화 상대 수 / 이웃 수)
      for (let j = 0; j < n; j++) {
        const tk = talked[j], deg = net.adj[j].length;
        for (let i = 0; i < n; i++) {
          const k0 = j * n + i; if (b[k0] < 1e-4) { b[k0] = 0; continue; }
          let c = 0; for (const k of tk) if (b[k * n + i] > C.WARY) c++;
          b[k0] *= 1 - fg * (1 - C.REMIND * c / deg);
        }
      }
      // 회복: 아무도 거절하지 않게 되면 다시 협상할 수 있다
      const still = [];
      for (const o of S.open) { if (S.refusers(o.i) === 0) S.recov.push({ i: o.i, t: o.t, dur: t - o.t, forced: o.forced }); else still.push(o); }
      S.open = still;
      const pc = Math.floor(n / 2);
      S.hist.deal.push(deals / pc); S.hist.coop.push(coop / pc); S.hist.brk.push(brk); S.hist.cost.push(S.cost);
      let rs = 0; const ra = S.repAll(); for (let i = 0; i < n; i++) rs += ra[i]; S.hist.rep.push(rs / n);
      S.lastRound = { t, pairs, gossip, breaks };
      S.stand = S.standAll();
      if (t >= P.rounds) S.done = true;
      return true;
    }
    // 버튼: 평판이 가장 좋은 나라 하나가 다음 협상에서 약속을 깨게 한다
    function forceBreak() {
      if (S.done || S.forceNext >= 0) return -1;
      const r = S.repAll(); let best = 0;
      for (let i = 1; i < n; i++) if (r[i] > r[best] + 1e-9) best = i;
      S.forceNext = best; S._forced = best; return best;
    }
    S.step = step; S.forceBreak = forceBreak;
    return S;
  }

  // 집계: 한 판을 끝까지 돌려 요약 (from 라운드부터 평균)
  function summary(opt, from, forceAt) {
    const s = create(opt); from = from == null ? 50 : from;
    let fi = -1, peak = 0;
    while (s.step()) {
      if (forceAt && s.t === forceAt) fi = s.forceBreak();
      if (fi >= 0 && s.t > forceAt) { const r = s.refusers(fi); if (r > peak) peak = r; }
    }
    const fr = s.recov.find((r) => r.forced), fo = s.open.find((o) => o.forced);
    const H = s.hist, sl = (a) => a.slice(from), mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const durs = s.recov.map((r) => r.dur), unrec = s.open.filter((o) => s.params.rounds - o.t >= 60).length;
    return {
      deal: mean(sl(H.deal)), coop: mean(sl(H.coop)), brk: mean(sl(H.brk)), cost: s.cost,
      rec: durs.length ? mean(durs) : null, nRec: durs.length, unrec, events: s.events.length,
      forced: forceAt ? { i: fi, dur: fr ? fr.dur : null, open: !!fo, again: s.reBroke && !fr, peak } : null,
    };
  }
  return { create, summary, DEFAULTS, C, mulberry32, buildNet };
});
