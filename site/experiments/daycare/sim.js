/*
 * 어린이집 감기: 반(교실) 안에서 퍼지는 감기 같은 호흡기 감염의 단순한 시뮬레이션
 * (Kermack & McKendrick 1927의 구획 모델 SIR을 반 단위 접촉망 + 잠복기(E) + 면역 쌓임으로 확장한 이 프로젝트의 설계).
 * 병원균을 특정하지 않는 추상적인 질병이며, 실제 감염 통계가 아니다. 브라우저와 Node.js 양쪽에서 같은 파일을 쓴다.
 *
 * 아이: 감수성(S) -> 잠복(E) -> 감염력 있음(I) -> 회복 후 한동안 면역 -> 다시 감수성(S)
 *  - 하루가 한 걸음. 월~금에는 같은 반 아이끼리 만나고(토·일은 반 접촉 없음), 반 사이의 접촉은 없다
 *  - 같은 반에 그날 등원한 감염력 있는 아이가 A명이면, 감수성 아이가 걸릴 확률 = 1 - (1 - 쌍당 전파확률)^A
 *    쌍당 전파확률 = 접촉 강도 x 0.01 x (1 - 전파 감소) x 계절 (반이 클수록 만나는 쌍이 많아져 R0가 (반 크기 - 1)에 비례)
 *  - 감염력 있는 첫날은 증상 전이라 모두 등원한다. 둘째 날부터는 '아프면 쉬는' 아이(비율 stay)는 집에 있다
 *  - 반 밖(집·동네)에서 들어오는 감염은 단순한 항 하나: 하루 eps + home x (전체 아이 중 감염력 있는 아이 비율)
 *  - 회복하면 imm일 동안 완전 면역, 이후에도 걸릴 때마다 면역이 쌓여 걸릴 확률이 1/(1 + acc x 지금까지 걸린 횟수)로 낮아진다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Daycare = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = {
    size: 20, classes: 8, contact: 5, stay: 0.3, hyg: 0, imm: 30, days: 365, seed: 1,
    tauUnit: 0.01, idays: 5, lat: 2, season: 0.25, weekend: true, eps: 0.0015, home: 0.2, acc: 0.3, init: -1, preDays: 1,
  };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const tauOf = (p) => p.contact * p.tauUnit * (1 - p.hyg);

  // ---------- 이론값 (균질 혼합 SIR) ----------
  // 한 아이가 감염력 있는 동안 등원하는 평균 날수 = preDays + (idays - preDays) x (1 - stay)
  function attendDays(p) { p = Object.assign({}, DEFAULTS, p); return p.preDays + (p.idays - p.preDays) * (1 - p.stay); }
  function r0(p) { p = Object.assign({}, DEFAULTS, p); return tauOf(p) * (p.size - 1) * attendDays(p); }
  // 최종 크기: z = 1 - exp(-R0 z) 의 양의 해 (처음에 전부 감수성일 때, 면역이 영영 안 풀리는 단일 유행)
  function finalSize(R0) {
    if (R0 <= 1) return 0;
    let z = 0.9; for (let i = 0; i < 200; i++) z = 1 - Math.exp(-R0 * z);
    return z;
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 7919 + 13), S = p.size, K = p.classes, N = S * K;
    const st = new Uint8Array(N), imm = new Int16Array(N), kday = new Int16Array(N), stayer = new Uint8Array(N), cnt = new Uint8Array(N), absd = new Uint16Array(N);
    const pastN = new Uint8Array(N), A = new Int32Array(K);
    const sim = { params: p, N, S, K, day: 0, st, imm, stayer, kday, cnt, sick: [], home: [], newInf: [], totalInf: 0, totalAbs: 0, attended: [] };
    // 첫날: 반마다 막 아프기 시작한 아이 한 명 (init >= 0 이면 전체에서 그 수만큼)
    if (p.init >= 0) { for (let k = 0; k < p.init; k++) { st[k] = 2; stayer[k] = rng() < p.stay ? 1 : 0; } }
    else for (let c = 0; c < K; c++) { if (rng() < 0.6) { const i = c * S + Math.floor(rng() * S); st[i] = 2; stayer[i] = rng() < p.stay ? 1 : 0; } }
    const g = 1 / p.idays, sigma = 1 / p.lat, tau = tauOf(p), lg = Math.log(1 - tau);
    sim.tau = tau;
    sim.isWeekend = (d) => p.weekend && d % 7 >= 5;
    sim.advance = function () {
      if (sim.day >= p.days) return false;
      const d = sim.day, wk = sim.isWeekend(d);
      A.fill(0); let nI = 0, nHome = 0, nE = 0;
      for (let i = 0; i < N; i++) {
        if (st[i] === 2) {
          nI++;
          const attend = !wk && (kday[i] < p.preDays || !stayer[i]);
          if (attend) A[(i / S) | 0]++; else if (!wk && stayer[i]) { nHome++; absd[i]++; sim.totalAbs++; }
        } else if (st[i] === 1) nE++;
      }
      const f = 1 + p.season * Math.cos((2 * Math.PI * (d - 300)) / 365);
      const lgE = Math.log(1 - Math.min(0.95, tau * f));
      const ext = 1 - p.eps - p.home * (nI / N);
      let ni = 0;
      for (let i = 0; i < N; i++) {
        const s = st[i];
        if (s === 0) {
          if (imm[i] > 0) { imm[i]--; continue; }
          const a = A[(i / S) | 0], sus = 1 / (1 + p.acc * pastN[i]);
          const pr = sus * (1 - Math.exp(lgE * a) * ext);
          if (rng() < pr) { st[i] = 1; cnt[i]++; ni++; }
        } else if (s === 1) {
          if (rng() < sigma) { st[i] = 2; kday[i] = 0; stayer[i] = rng() < p.stay ? 1 : 0; }
        } else {
          if (rng() < g) { st[i] = 0; imm[i] = Math.round(p.imm * (0.6 + 0.8 * rng())); pastN[i]++; }
          else kday[i]++;
        }
      }
      sim.totalInf += ni; sim.newInf.push(ni); sim.sick.push(nI); sim.home.push(nHome);
      sim.day++;
      return true;
    };
    sim.done = () => sim.day >= p.days;
    sim.run = () => { while (sim.advance()); return sim; };
    sim.meanInf = () => sim.totalInf / N;
    sim.meanAbs = () => sim.totalAbs / N;
    // 주별 평균 (아픈 아이 비율, 집에서 쉬는 아이 비율)
    sim.weekly = function () {
      const W = Math.ceil(sim.sick.length / 7), a = [], h = [];
      for (let w = 0; w < W; w++) {
        let s = 0, hh = 0, c = 0; for (let d = w * 7; d < Math.min(sim.sick.length, w * 7 + 7); d++) { s += sim.sick[d]; hh += sim.home[d]; c++; }
        a.push(s / c / N); h.push(hh / c / N);
      }
      return { sick: a, home: h };
    };
    sim.peakWeek = function () { const w = sim.weekly().sick; let b = 0; w.forEach((v, i) => { if (v > w[b]) b = i; }); return b + 1; };
    sim.dist = function (maxK) { const o = new Array(maxK + 1).fill(0); for (let i = 0; i < N; i++) o[Math.min(maxK, cnt[i])]++; return o.map((v) => v / N); };
    // 해마다 아이가 몇 번 걸렸나 (시간 순서): 지금까지 걸린 횟수별로 몇 번째 감염이 언제 일어났는지는 저장하지 않고 요약만
    sim.counts = () => { let S0 = 0, E0 = 0, I0 = 0, R0_ = 0; for (let i = 0; i < N; i++) { if (st[i] === 0) { if (imm[i] > 0) R0_++; else S0++; } else if (st[i] === 1) E0++; else I0++; } return { S: S0, E: E0, I: I0, R: R0_ }; };
    return sim;
  }

  // 여러 시드 평균 요약
  function summarize(base, seeds) {
    let inf = 0, ab = 0, pk = 0; const wk = [];
    for (let s = 1; s <= seeds; s++) {
      const m = create(Object.assign({}, base, { seed: s })).run();
      inf += m.meanInf(); ab += m.meanAbs(); pk += m.peakWeek();
      m.weekly().sick.forEach((v, i) => { wk[i] = (wk[i] || 0) + v / seeds; });
    }
    return { inf: inf / seeds, abs: ab / seeds, peak: pk / seeds, weekly: wk };
  }
  return { DEFAULTS, create, r0, finalSize, summarize, attendDays };
});
