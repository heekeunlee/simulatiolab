// 마트 계산대 줄 서기 모델: 한 줄 vs 여러 줄.  브라우저/Node 공용(UMD).
// 손님은 포아송으로 도착(간격 지수분포), 계산 시간은 평균 S분의 감마분포(들쭉날쭉함 cv). 계산 시간은 물건 수에 비례한다고 본다.
// 같은 손님 목록(도착 시각·물건 수)을 모든 줄 서기 방식에 똑같이 적용한다 (공통 난수).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Checkout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MEAN_SERVICE = 3;      // 손님 한 명 계산에 평균 3분
  const ITEMS_AVG = 10;        // 평균 물건 수 (계산 시간 평균과 같은 눈금)
  const STRATS = ['one', 'short', 'random', 'items'];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function gamma(shape, rnd) { // Marsaglia-Tsang
    if (shape < 1) { let u = rnd(); while (u === 0) u = rnd(); return gamma(shape + 1, rnd) * Math.pow(u, 1 / shape); }
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v; do { x = gauss(rnd); v = 1 + c * x; } while (v <= 0);
      v = v * v * v; const u = rnd();
      if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  // 손님 목록 만들기. P = { k, rho, cv }
  function gen(P, seed, N) {
    const rnd = mulberry32(seed * 7919 + 13), lam = (P.rho * P.k) / MEAN_SERVICE, cv = Math.max(0.05, P.cv);
    const shape = 1 / (cv * cv), scale = cv * cv;
    const arr = new Float64Array(N), svc = new Float64Array(N), items = new Int16Array(N), u = new Float64Array(N);
    let t = 0;
    for (let i = 0; i < N; i++) {
      t += -Math.log(1 - rnd()) / lam; arr[i] = t;
      const z = gamma(shape, rnd) * scale;                // 평균 1
      svc[i] = z * MEAN_SERVICE; items[i] = Math.max(1, Math.round(z * ITEMS_AVG)); u[i] = rnd();
    }
    return { arr, svc, items, u, N, k: P.k };
  }

  // 한 방식으로 줄을 세운다. 반환: start, end, line(계산대 번호), qline(서 있던 줄 번호, 한 줄이면 -1)
  function run(data, strat) {
    const { arr, svc, items, u, N, k } = data;
    const start = new Float64Array(N), end = new Float64Array(N), line = new Int16Array(N), qline = new Int16Array(N);
    if (strat === 'one') {
      const free = new Float64Array(k);
      for (let i = 0; i < N; i++) {
        let j = 0; for (let q = 1; q < k; q++) if (free[q] < free[j]) j = q;
        start[i] = Math.max(arr[i], free[j]); end[i] = start[i] + svc[i]; free[j] = end[i]; line[i] = j; qline[i] = -1;
      }
      return { start, end, line, qline };
    }
    const qs = [], head = new Int32Array(k), last = new Float64Array(k), pend = new Float64Array(k); // pend: 아직 계산 안 끝난 물건 수 합
    for (let j = 0; j < k; j++) qs.push([]);
    const cnt = new Float64Array(k), key = new Float64Array(k);
    for (let i = 0; i < N; i++) {
      const t = arr[i];
      for (let j = 0; j < k; j++) { // 이미 끝난 사람을 줄에서 뺀다
        const q = qs[j];
        while (head[j] < q.length && end[q[head[j]]] <= t) { pend[j] -= items[q[head[j]]]; head[j]++; }
        cnt[j] = q.length - head[j];
      }
      let pick;
      if (strat === 'random') pick = Math.min(k - 1, Math.floor(u[i] * k));
      else {
        let best = Infinity, ties = 0;
        for (let j = 0; j < k; j++) { key[j] = strat === 'short' ? cnt[j] : pend[j]; if (key[j] < best) best = key[j]; }
        for (let j = 0; j < k; j++) if (key[j] === best) ties++;
        let r = Math.min(ties - 1, Math.floor(u[i] * ties)); pick = 0;
        for (let j = 0; j < k; j++) if (key[j] === best) { if (r === 0) { pick = j; break; } r--; }
      }
      qs[pick].push(i); pend[pick] += items[i];
      start[i] = Math.max(t, last[pick]); end[i] = start[i] + svc[i]; last[pick] = end[i]; line[i] = pick; qline[i] = pick;
    }
    return { start, end, line, qline };
  }

  // 요약: 처음 10%는 가게가 비어 있던 시기라 뺀다.
  function summarize(data, res, warm) {
    const { arr, N } = data, from = Math.floor(N * (warm == null ? 0.1 : warm));
    const w = []; let over = 0, minAfter = Infinity;
    const ov = new Uint8Array(N);
    for (let i = N - 1; i >= 0; i--) { if (minAfter < res.start[i] - 1e-9) ov[i] = 1; if (res.start[i] < minAfter) minAfter = res.start[i]; }
    for (let i = from; i < N; i++) { w.push(res.start[i] - arr[i]); over += ov[i]; }
    const n = w.length, mean = w.reduce((a, b) => a + b, 0) / n, s = w.slice().sort((a, b) => a - b);
    const p = (q) => s[Math.min(n - 1, Math.floor(q * n))];
    return { mean, p90: p(0.9), p50: p(0.5), max: s[n - 1], overtaken: over / n, zero: w.filter((x) => x < 1e-9).length / n, waits: w };
  }

  // 같은 손님의 대기시간을 한 줄 방식과 짝지어 비교: 1분 넘게 더 기다린 비율 / 1분 넘게 덜 기다린 비율
  function paired(data, resA, resB, warm) {
    const from = Math.floor(data.N * (warm == null ? 0.1 : warm)); let worse = 0, better = 0, n = 0;
    for (let i = from; i < data.N; i++) {
      const d = (resB.start[i] - data.arr[i]) - (resA.start[i] - data.arr[i]); n++;
      if (d > 1) worse++; else if (d < -1) better++;
    }
    return { worse: worse / n, better: better / n };
  }

  // 계산대가 놀고 있는데 다른 곳에는 기다리는 손님이 있는 시간의 비율 (한 줄이면 늘 0)
  function idleWait(data, res, warm) {
    const N = data.N, from = Math.floor(N * (warm == null ? 0.1 : warm)), t0 = data.arr[from], t1 = data.arr[N - 1];
    const A = data.arr, S = Float64Array.from(res.start).sort(), E = Float64Array.from(res.end).sort();
    let ia = 0, is = 0, ie = 0, busy = 0, wait = 0, tl = t0, bad = 0;
    while (ia < N || is < N || ie < N) {
      const ta = ia < N ? A[ia] : Infinity, ts = is < N ? S[is] : Infinity, te = ie < N ? E[ie] : Infinity;
      let t, kind;
      if (te <= ts && te <= ta) { t = te; kind = 2; } else if (ts <= ta) { t = ts; kind = 1; } else { t = ta; kind = 0; }
      if (t > t1) break;
      const tc = Math.max(t, t0);
      if (busy < data.k && wait > 0 && tc > tl) bad += tc - tl;
      if (tc > tl) tl = tc;
      if (kind === 0) { ia++; wait++; } else if (kind === 1) { is++; wait--; busy++; } else { ie++; busy--; }
    }
    return bad / (t1 - t0);
  }

  // 이론값 (평균 계산 시간 S분, 도착은 포아송)
  function erlangC(c, rho) { // 손님이 도착했을 때 모든 계산대가 차 있어 기다릴 확률
    const a = rho * c; let B = 1;
    for (let n = 1; n <= c; n++) B = (a * B) / (n + a * B);
    return B / (1 - rho * (1 - B));
  }
  // 한 줄(M/M/c): 평균 = Erlang C, 계산 시간이 지수분포가 아니면 (1+cv²)/2를 곱한 앨런-쿤 근사
  function theoryOne(k, rho, cv) {
    const C = erlangC(k, rho), mu = 1 / MEAN_SERVICE, d = k * mu * (1 - rho); // cμ-λ
    const mean = (C / d) * ((1 + cv * cv) / 2);
    const p90 = C <= 0.1 ? 0 : Math.log(10 * C) / d; // 지수 계산 시간(cv=1)일 때만 정확
    return { mean, p90, pWait: C };
  }
  // 무작위로 줄 고르기: 계산대마다 M/G/1 (포아송을 쪼개도 포아송). 평균은 폴라체크-힌친 공식, 90%는 cv=1일 때만 정확
  function theoryRandom(k, rho, cv) {
    const mean = (rho * MEAN_SERVICE * (1 + cv * cv)) / (2 * (1 - rho));
    const p90 = rho <= 0.1 ? 0 : Math.log(10 * rho) / ((1 - rho) / MEAN_SERVICE);
    return { mean, p90 };
  }

  // 여러 방식을 같은 손님으로 돌려 요약
  function compare(P, seed, N, strats) {
    const data = gen(P, seed, N), out = {}, A = run(data, 'one');
    (strats || STRATS).forEach((s) => { const r = s === 'one' ? A : run(data, s); out[s] = summarize(data, r); out[s].pair = paired(data, A, r); out[s].idle = idleWait(data, r); });
    return out;
  }
  // 붐비는 정도를 훑는다. seeds개 평균
  function sweepPoint(P, rho, N, seeds) {
    const acc = {}; STRATS.forEach((s) => { acc[s] = { mean: 0, p90: 0 }; });
    for (let sd = 1; sd <= seeds; sd++) {
      const r = compare(Object.assign({}, P, { rho }), 100 + sd, N);
      STRATS.forEach((s) => { acc[s].mean += r[s].mean / seeds; acc[s].p90 += r[s].p90 / seeds; });
    }
    return Object.assign({ rho }, acc);
  }

  // 눈으로 보는 한 장면: 손님 목록을 만들고 두 방식(한 줄, 고른 방식)을 같은 손님으로 돌려 둔다
  function scene(P, seed, strat, horizon, warm) {
    const lam = (P.rho * P.k) / MEAN_SERVICE, N = Math.ceil(lam * (horizon + 60)) + 20;
    const data = gen(P, seed, N);
    // 손님이 이미 줄 서 있는 장면으로 시작하려면 앞의 warm분을 미리 돌려 둔 것으로 본다 (시간 0 = 화면 시작이 아니라 가게 문 연 시각)
    const A = run(data, 'one'), Bres = run(data, strat);
    // '나': 화면 시작(warm분) 뒤 처음 도착하는 손님 가운데, 두 방식에서 기다림이 모두 있는 첫 손님 (결과를 보고 고르지 않고 도착 순서로만)
    // '나': 화면이 시작되는 순간(warm분) 두 가게 모두에서 줄에 서 있는 손님 가운데 가장 최근에 도착한 사람 (그 순간의 상태만 보고 고른다. 이후 결과는 보지 않는다)
    let me = -1;
    for (let i = 0; i < N && data.arr[i] <= warm; i++) if (A.start[i] > warm && Bres.start[i] > warm) me = i;
    if (me < 0) { me = 0; while (me < N - 1 && data.arr[me] < warm + 4) me++; }
    return { data, A, B: Bres, strat, me, N, horizon, warm };
  }

  return { MEAN_SERVICE, ITEMS_AVG, STRATS, gen, run, summarize, paired, idleWait, compare, sweepPoint, scene, erlangC, theoryOne, theoryRandom, mulberry32 };
});
