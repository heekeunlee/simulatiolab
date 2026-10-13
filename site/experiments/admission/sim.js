/*
 * 입소 배정: 아이 N명을 정원이 있는 기관 M곳에 나누는 네 가지 방식 비교 (이 프로젝트의 단순화된 모델)
 *  - 선착순 고르기: 접수한 순서대로 남은 곳 중 가장 원하는 곳을 고른다 (일찍 접수할 수 있는 집이 앞선다)
 *  - 추첨 순번 고르기 (무작위 순서 독재, Random Serial Dictatorship): 추첨 번호 순서대로 고른다
 *  - 보스턴 방식 (즉시 확정): 1지망부터 차례로 접수하고, 정원이 차면 그 자리는 바로 확정
 *  - 지연 수락 (Gale-Shapley 1962, 아이 제안 방식): 기관은 일단 임시로만 들고 있다가 더 우선순위 높은 아이가 오면 바꾼다
 * 참고: Gale & Shapley (1962), American Mathematical Monthly 69; Abdulkadiroglu & Sonmez (2003), American Economic Review 93(3).
 * 한국의 실제 입소 제도를 재현한 것이 아니다. 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Admission = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 200, m: 8, c: 0.6, rho: 0.5, ratio: 1.0, early: 0.25, seed: 1, mech: 'boston' };
  const MECHS = ['queue', 'rsd', 'boston', 'da'];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(rnd) { // Box-Muller
    let u = 0; while (u === 0) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  }

  // ---------- 설정 만들기 ----------
  function make(p0) {
    const p = Object.assign({}, DEFAULTS, p0), N = p.n, M = p.m, rnd = mulberry32(p.seed * 7919 + 13);
    // 정원: 전체 자리 = 아이 수 x 정원 비율을 기관에 고르게 나눈다
    const seats = Math.round(N * p.ratio), cap = new Int16Array(M);
    for (let j = 0; j < M; j++) cap[j] = Math.floor(seats / M) + (j < seats % M ? 1 : 0);
    let capMax = 0; for (let j = 0; j < M; j++) capMax = Math.max(capMax, cap[j]);
    // 기관 인기(모두가 비슷하게 느끼는 좋음)와 아이마다 다른 취향
    const q = new Float64Array(M); for (let j = 0; j < M; j++) q[j] = normal(rnd);
    const prefs = new Int8Array(N * M), trueRank = new Int8Array(N * M), U = new Float64Array(M);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < M; j++) U[j] = p.c * q[j] + (1 - p.c) * normal(rnd);
      const idx = Array.from({ length: M }, (_, j) => j).sort((a, b) => U[b] - U[a]);
      for (let k = 0; k < M; k++) { prefs[i * M + k] = idx[k]; trueRank[i * M + idx[k]] = k; }
    }
    // 우선순위: 추첨 번호 u(모든 기관 공통)와 기관마다 다른 순번 v를 rho 비율로 섞는다. 점수가 높을수록 우선
    const u = new Float64Array(N), score = new Float64Array(N * M), early = new Uint8Array(N), w = new Float64Array(N);
    for (let i = 0; i < N; i++) { u[i] = rnd(); w[i] = rnd(); }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) score[i * M + j] = (1 - p.rho) * u[i] + p.rho * rnd();
    const nEarly = Math.round(N * p.early), ids = Array.from({ length: N }, (_, i) => i).sort((a, b) => w[b] - w[a]);
    // 일찍 접수할 수 있는 집: 무작위로 고른 nEarly명
    const pick = Array.from({ length: N }, (_, i) => i); for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = pick[i]; pick[i] = pick[j]; pick[j] = t; }
    for (let k = 0; k < nEarly; k++) early[pick[k]] = 1;
    const queueOrder = Int16Array.from(ids.slice().sort((a, b) => (early[b] - early[a]) || (w[b] - w[a])));
    const rsdOrder = Int16Array.from(Array.from({ length: N }, (_, i) => i).sort((a, b) => u[b] - u[a]));
    // 1지망 지원자 수 (수요)
    const demand = new Int16Array(M); for (let i = 0; i < N; i++) demand[prefs[i * M]]++;
    const S = { p, N, M, cap, capMax, q, prefs, trueRank, u, score, early, nEarly, queueOrder, rsdOrder, demand,
      remBuf: new Int16Array(M), cntBuf: new Int16Array(M), buckBuf: new Int16Array(M * N), ptr: new Int8Array(N), heldBuf: new Int16Array(M * capMax), hn: new Int16Array(M), stack: new Int16Array(N + 1) };
    return S;
  }

  // ---------- 네 가지 방식 (rep: 아이가 적어 낸 지망 순서, N x M) ----------
  function runSerial(S, rep, order, assign) {
    const { N, M, cap, remBuf: rem } = S;
    assign.fill(-1); for (let j = 0; j < M; j++) rem[j] = cap[j];
    for (let t = 0; t < N; t++) {
      const i = order[t];
      for (let k = 0; k < M; k++) { const j = rep[i * M + k]; if (rem[j] > 0) { rem[j]--; assign[i] = j; break; } }
    }
  }
  function runBoston(S, rep, assign) {
    const { N, M, cap, score, remBuf: rem, cntBuf: cnt, buckBuf: buck } = S;
    assign.fill(-1); for (let j = 0; j < M; j++) rem[j] = cap[j];
    for (let k = 0; k < M; k++) {
      cnt.fill(0); let any = false;
      for (let i = 0; i < N; i++) if (assign[i] < 0) { const j = rep[i * M + k]; buck[j * N + cnt[j]++] = i; any = true; }
      if (!any) break;
      for (let j = 0; j < M; j++) {
        const c = cnt[j]; if (!c || !rem[j]) continue;
        if (c <= rem[j]) { for (let t = 0; t < c; t++) assign[buck[j * N + t]] = j; rem[j] -= c; }
        else {
          const arr = Array.from(buck.subarray(j * N, j * N + c)); arr.sort((a, b) => score[b * M + j] - score[a * M + j]);
          for (let t = 0; t < rem[j]; t++) assign[arr[t]] = j; rem[j] = 0;
        }
      }
    }
  }
  function runDA(S, rep, assign) {
    const { N, M, cap, score, ptr, heldBuf: held, hn, stack } = S, CM = S.capMax;
    ptr.fill(0); hn.fill(0); let sp = 0;
    for (let i = N - 1; i >= 0; i--) stack[sp++] = i;
    while (sp > 0) {
      const i = stack[--sp];
      if (ptr[i] >= M) continue;
      const j = rep[i * M + ptr[i]++];
      if (hn[j] < cap[j]) { held[j * CM + hn[j]++] = i; continue; }
      let wi = -1, ws = score[i * M + j], wc = i;
      for (let t = 0; t < hn[j]; t++) { const c = held[j * CM + t], s = score[c * M + j]; if (s < ws) { ws = s; wi = t; wc = c; } }
      if (wi >= 0) held[j * CM + wi] = i;
      stack[sp++] = wc;
    }
    assign.fill(-1);
    for (let j = 0; j < M; j++) for (let t = 0; t < hn[j]; t++) assign[held[j * CM + t]] = j;
  }
  function run(S, mech, rep, assign) {
    assign = assign || new Int8Array(S.N);
    if (mech === 'queue') runSerial(S, rep, S.queueOrder, assign);
    else if (mech === 'rsd') runSerial(S, rep, S.rsdOrder, assign);
    else if (mech === 'boston') runBoston(S, rep, assign);
    else runDA(S, rep, assign);
    return assign;
  }

  // ---------- 지표 ----------
  function metrics(S, assign) {
    const { N, M, cap, trueRank, score, early } = S;
    const dist = new Array(M + 1).fill(0), filled = new Int16Array(M), minSc = new Float64Array(M).fill(Infinity);
    let sumRank = 0, nAssigned = 0, eSum = 0, eN = 0, oSum = 0, oN = 0;
    for (let i = 0; i < N; i++) {
      const j = assign[i], r = j < 0 ? M : trueRank[i * M + j];
      dist[r]++;
      if (j >= 0) { sumRank += r + 1; nAssigned++; filled[j]++; if (score[i * M + j] < minSc[j]) minSc[j] = score[i * M + j]; }
      const pr = r + 1; // 미배정은 (M+1)지망으로 센다
      if (early[i]) { eSum += pr; eN++; } else { oSum += pr; oN++; }
    }
    // 억울한 아이: 내가 더 원하는 기관에 자리가 남았거나, 나보다 우선순위가 낮은 아이가 들어간 경우
    let envy = 0;
    for (let i = 0; i < N; i++) {
      const j0 = assign[i], r0 = j0 < 0 ? M : trueRank[i * M + j0];
      let e = false;
      for (let j = 0; j < M && !e; j++) {
        if (trueRank[i * M + j] >= r0) continue;
        if (filled[j] < cap[j] || minSc[j] < score[i * M + j]) e = true;
      }
      if (e) envy++;
    }
    return {
      N, dist, first: dist[0] / N, avgRank: nAssigned ? sumRank / nAssigned : NaN, unassigned: dist[M], envy: envy / N, envyN: envy,
      earlyAvg: eN ? eSum / eN : NaN, otherAvg: oN ? oSum / oN : NaN, gap: eN && oN ? oSum / oN - eSum / eN : 0,
    };
  }

  // ---------- 순위를 바꿔 적어서 얻는 이득 ----------
  // 한 아이만 지망 순서를 바꿔 적고 나머지는 솔직하게 적는다고 하자. 그 아이의 지망 하나를 다른 자리로 옮기는 모든 경우를 시험해
  // 솔직할 때보다 (진짜 선호 기준으로) 더 좋은 곳에 배정되는 경우가 하나라도 있으면 "이득을 본다"고 센다.
  // 다른 집들의 목록과 추첨 결과를 모두 안다고 가정한 상한이다.
  function manipChild(S, mech, i, rep, base, cur) { // 아이 한 명이 시험해 볼 수 있는 모든 이동을 해 본 결과
    const { M, trueRank, prefs } = S;
    const rk = (a) => (a[i] < 0 ? M : trueRank[i * M + a[i]]);
    const r0 = rk(base), orig = Array.from(prefs.subarray(i * M, i * M + M));
    let best = r0, bestList = null, bestMove = null, bestInst = -1, cand = 0;
    for (let a = 0; a < M; a++) {
      for (let b = 0; b < M; b++) {
        if (a === b) continue;
        const l = orig.slice(); const x = l.splice(a, 1)[0]; l.splice(b, 0, x);
        for (let k = 0; k < M; k++) rep[i * M + k] = l[k];
        run(S, mech, rep, cur); cand++;
        const r = rk(cur);
        if (r < best) { best = r; bestList = l; bestMove = { item: x, to: b }; bestInst = cur[i]; }
      }
    }
    for (let k = 0; k < M; k++) rep[i * M + k] = orig[k];
    return { child: i, truthRank: r0, lieRank: best, gain: r0 - best, list: bestList, move: bestMove, cand, truthAssign: base[i], lieAssign: bestInst };
  }
  function manip(S, mech, sample) {
    const { N, prefs } = S, rep = Int8Array.from(prefs), base = run(S, mech, rep, new Int8Array(N)), cur = new Int8Array(N);
    const nS = Math.min(sample || 60, N), res = { tested: nS, gain: 0, sumGain: 0, best: null, cand: 0 };
    for (let i = 0; i < nS; i++) {
      const r = manipChild(S, mech, i, rep, base, cur); res.cand += r.cand;
      if (r.gain > 0) { res.gain++; res.sumGain += r.gain; if (!res.best || r.gain > res.best.gain) res.best = r; }
    }
    res.share = res.gain / nS; res.avgGain = res.gain ? res.sumGain / res.gain : 0;
    return res;
  }
  function childTest(S, mech, i) { // 지정한 아이 한 명에 대해
    const rep = Int8Array.from(S.prefs), base = run(S, mech, rep, new Int8Array(S.N));
    return manipChild(S, mech, i, rep, base, new Int8Array(S.N));
  }

  // ---------- 애니메이션용 단계별 기록 ----------
  // frames: [{a: 배정 배열(복사), kind, n, tentative}]
  function trace(S, mech) {
    const { N, M, cap, score, prefs, queueOrder, rsdOrder } = S, frames = [], snap = (a, kind, n, tentative) => frames.push({ a: Int8Array.from(a), kind, n, tentative: !!tentative });
    const a = new Int8Array(N).fill(-1); snap(a, mech, 0, mech === 'da');
    if (mech === 'queue' || mech === 'rsd') {
      const order = mech === 'queue' ? queueOrder : rsdOrder, rem = Int16Array.from(cap), step = Math.max(1, Math.ceil(N / 60));
      for (let t = 0; t < N; t++) {
        const i = order[t];
        for (let k = 0; k < M; k++) { const j = prefs[i * M + k]; if (rem[j] > 0) { rem[j]--; a[i] = j; break; } }
        if ((t + 1) % step === 0 || t === N - 1) snap(a, mech, t + 1);
      }
    } else if (mech === 'boston') {
      const rem = Int16Array.from(cap);
      for (let k = 0; k < M; k++) {
        let any = false;
        for (let j = 0; j < M; j++) {
          const apps = []; for (let i = 0; i < N; i++) if (a[i] < 0 && prefs[i * M + k] === j) apps.push(i);
          if (!apps.length || !rem[j]) continue;
          apps.sort((x, y) => score[y * M + j] - score[x * M + j]);
          const take = Math.min(rem[j], apps.length); for (let t = 0; t < take; t++) a[apps[t]] = j; rem[j] -= take; any = true;
          snap(a, mech, k + 1);
        }
        if (!any && a.every((x) => x >= 0)) break;
      }
    } else {
      const ptr = new Int8Array(N), held = Array.from({ length: M }, () => []);
      for (let r = 1; r <= 60; r++) {
        const free = []; for (let i = 0; i < N; i++) if (a[i] < 0 && ptr[i] < M) free.push(i);
        if (!free.length) break;
        const props = Array.from({ length: M }, () => []);
        free.forEach((i) => { props[prefs[i * M + ptr[i]++]].push(i); });
        for (let j = 0; j < M; j++) {
          if (!props[j].length) continue;
          const all = held[j].concat(props[j]).sort((x, y) => score[y * M + j] - score[x * M + j]);
          held[j] = all.slice(0, cap[j]); all.slice(cap[j]).forEach((i) => { a[i] = -1; }); held[j].forEach((i) => { a[i] = j; });
        }
        snap(a, mech, r, true);
      }
      frames[frames.length - 1].tentative = false;
    }
    return frames;
  }

  // ---------- 한 번에 요약 ----------
  function compare(S) {
    const out = {};
    MECHS.forEach((m) => { const a = run(S, m, S.prefs, new Int8Array(S.N)); out[m] = Object.assign({ assign: a }, metrics(S, a)); });
    return out;
  }

  function create(p) {
    const S = make(p), frames = trace(S, S.p.mech);
    const sim = {
      S, params: S.p, frames, frame: 0, mech: S.p.mech,
      advance() { if (sim.frame < frames.length - 1) { sim.frame++; return true; } return false; },
      done() { return sim.frame >= frames.length - 1; },
      current() { return frames[sim.frame]; },
      finish() { sim.frame = frames.length - 1; },
      compare: () => compare(S),
      manip: (mech, sample) => manip(S, mech, sample),
      childTest: (mech, i) => childTest(S, mech, i),
    };
    return sim;
  }

  // 정직하게 적는 아이가 겪는 평균 (여러 시드)
  function sweepManip(base, key, values, mech, sample, seeds) {
    return values.map((v) => {
      let g = 0, nT = 0;
      for (let s = 1; s <= seeds; s++) { const S = make(Object.assign({}, base, { [key]: v, seed: base.seed * 100 + s })); const r = manip(S, mech, sample); g += r.gain; nT += r.tested; }
      return { x: v, share: g / nT };
    });
  }

  return { DEFAULTS, MECHS, make, run, metrics, manip, childTest, trace, compare, create, sweepManip };
});
