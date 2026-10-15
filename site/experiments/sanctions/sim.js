/*
 * 제재의 역설: 가상의 나라 30개가 무역하는 망에서 한 나라(가운데)를 제재한다. (이 프로젝트의 단순화된 모델, 숫자는 예시)
 * 실제 나라·사건·정책이 아니다. 브라우저와 Node.js 양쪽에서 같은 파일을 쓴다.
 *
 * 세계 (시드로 만든다)
 *   - 나라 0 = 제재받는 나라(크기 2, 가운데). 나머지 29개는 크기 exp(0.7·정규), 가운데에서 3~10 거리에 흩어진다.
 *   - 제재받는 나라가 나라 j에서 들여오는 몫 m_j ∝ 크기_j / (1 + (거리/6)²) (중력식), 합 = 1(= 원래 무역 100).
 *   - 참여 순서는 무작위. 참여율 p만큼 앞에서부터 참여국(P), 나머지는 비참여국(Q).
 * 달마다 (처음 3달은 평소, 3달째에 제재 시작, 그 뒤 48달)
 *   - 끊긴 무역 = Σ_{j∈P} m_j (참여국이 잃은 수출도 같은 양).
 *   - 비참여국 k는 끊긴 물건을 대신 들여와 넘겨 줄 수 있다(제3국 경유). 받아 줄 수 있는 양 = leak × 1.5 × 크기_k/Σ크기,
 *     자리 잡는 데 걸리는 시간 τ_k(2~10달): 지금 쓸 수 있는 양 = 위 × (1 − e^(−경과/τ_k)).
 *   - 샌 양 = min(끊긴 무역, Σ 쓸 수 있는 양). 새는 비율 = 샌 양 / 끊긴 무역.
 *   - 경제 피해 D = (끊긴 무역 − 샌 양) + 0.3 × 샌 양 (돌아오는 물건엔 웃돈 30%).
 *   - 결속 지수 C(0~100, 평소 50) = 50 + 40·rally·D·e^(−경과/10) − 25·hard·H + 잡음
 *       H = 지금까지 쌓인 피해(달마다 D/12 더함, '피해-년'), 잡음 n ← 0.9n + 정규(0, 2)
 *     → 피해가 크면 처음엔 '밖에서 때린다'며 뭉치고(결집 효과, 설정), 피해가 쌓이면 지지가 깎인다.
 *   - 대리 지표: 제재 뒤 C가 30 아래로 내려간 적이 있으면 '압력이 통한 판'으로 센다(목표 달성 그 자체가 아님).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sanctions = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 30, p: 0.5, leak: 0.5, rally: 0.5, hard: 0.5, months: 48, start: 3, markup: 0.3, relayC: 1.5, thresh: 30, base: 50, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = (r) => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // 세계 만들기 (참여율과 상관없이 시드로만 정해진다: 같은 시드면 같은 세계·같은 잡음)
  function world(seed, n) {
    const r = mulberry32((seed | 0) * 9973 + 7);
    const size = [2], x = [0], y = [0];
    for (let i = 1; i < n; i++) {
      size.push(Math.exp(0.7 * gauss(r)));
      const a = r() * 2 * Math.PI, d = 3 + 7 * Math.sqrt(r());
      x.push(d * Math.cos(a)); y.push(d * Math.sin(a));
    }
    const m = [0]; let sm = 0;
    for (let i = 1; i < n; i++) { const d = Math.hypot(x[i], y[i]); const w = size[i] / (1 + (d / 6) ** 2); m.push(w); sm += w; }
    for (let i = 1; i < n; i++) m[i] /= sm;
    const order = []; for (let i = 1; i < n; i++) order.push(i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const tau = [0]; for (let i = 1; i < n; i++) tau.push(2 + 8 * r());
    // 나머지 나라끼리의 무역(화면 배경용): 나라마다 가장 큰 상대 2곳
    const links = [], seen = {};
    for (let i = 1; i < n; i++) {
      const cand = [];
      for (let j = 1; j < n; j++) if (j !== i) cand.push([j, size[i] * size[j] / (1 + (Math.hypot(x[i] - x[j], y[i] - y[j]) / 4) ** 2)]);
      cand.sort((a, b) => b[1] - a[1]);
      cand.slice(0, 2).forEach(([j, w]) => { const k = Math.min(i, j) + '-' + Math.max(i, j); if (!seen[k]) { seen[k] = 1; links.push([i, j, w]); } });
    }
    const lmax = Math.max(...links.map((l) => l[2])); links.forEach((l) => { l[2] /= lmax; });
    const noise = []; for (let t = 0; t < 400; t++) noise.push(gauss(r));
    const sumOther = size.slice(1).reduce((a, b) => a + b, 0);
    return { n, size, x, y, m, order, tau, links, noise, sumOther };
  }

  const CACHE = new Map();   // 세계는 시드·나라 수로만 정해지므로 집계에서 다시 쓴다(결과는 같고 빠르기만 하다)
  function worldOf(seed, n) {
    const key = seed + ':' + n; let w = CACHE.get(key);
    if (!w) { if (CACHE.size > 400) CACHE.clear(); w = world(seed, n); CACHE.set(key, w); }
    return w;
  }

  function create(params) {
    const P = Object.assign({}, DEFAULTS, params || {});
    const W = worldOf(P.seed, P.n), n = P.n;
    const k = Math.round(P.p * (n - 1));
    const part = new Array(n).fill(false); W.order.slice(0, k).forEach((i) => { part[i] = true; });
    let lost = 0; for (let i = 1; i < n; i++) if (part[i]) lost += W.m[i];
    const cap = [0]; for (let i = 1; i < n; i++) cap.push(part[i] ? 0 : P.leak * P.relayC * W.size[i] / W.sumOther);
    const T = P.start + P.months;
    const s = {
      params: P, world: W, part, lost, T, t: 0, done: false,
      flow: W.m.slice(), relay: new Array(n).fill(0),   // 지금 달의 직접 무역 · 제3국 경유 무역(나라별)
      D: [0], leakRate: [0], C: [P.base], H: 0, noise: 0, hit: -1, minC: P.base, partLoss: [0], middle: [0],
    };
    s.state = function (t) {
      // 달 t의 무역 상태 (계산만, 기록은 advance에서)
      const flow = W.m.slice(), relay = new Array(n).fill(0);
      if (t < P.start) return { flow, relay, leaked: 0, D: 0, cut: 0 };
      const el = t - P.start + 1; let avail = 0;
      for (let i = 1; i < n; i++) { if (part[i]) flow[i] = 0; else { relay[i] = cap[i] * (1 - Math.exp(-el / W.tau[i])); avail += relay[i]; } }
      const leaked = Math.min(lost, avail), sc = avail > 0 ? leaked / avail : 0;
      for (let i = 1; i < n; i++) relay[i] *= sc;
      return { flow, relay, leaked, D: lost - leaked + P.markup * leaked, cut: lost };
    };
    s.advance = function () {
      if (s.done) return false;
      s.t++;
      const st = s.state(s.t); s.flow = st.flow; s.relay = st.relay;
      s.noise = 0.9 * s.noise + 2 * W.noise[s.t % W.noise.length];
      let C = P.base + s.noise;
      if (s.t >= P.start) {
        s.H += st.D / 12;
        const el = s.t - P.start;
        C += 40 * P.rally * st.D * Math.exp(-el / 10) - 25 * P.hard * s.H;
      }
      C = Math.max(0, Math.min(100, C));
      s.D.push(st.D); s.leakRate.push(st.cut > 0 ? st.leaked / st.cut : 0); s.C.push(C);
      s.partLoss.push(st.cut); s.middle.push(P.markup * st.leaked);
      if (s.t >= P.start) { s.minC = Math.min(s.minC, C); if (s.hit < 0 && C < P.thresh) s.hit = s.t; }
      if (s.t >= T) s.done = true;
      return true;
    };
    s.run = function () { while (s.advance()); return s; };
    // 제재 기간 평균
    s.avg = function (arr) { let a = 0, c = 0; for (let t = P.start; t <= s.t; t++) { a += arr[t]; c++; } return c ? a / c : 0; };
    s.peakC = function () { let v = -1; for (let t = P.start; t <= s.t; t++) v = Math.max(v, s.C[t]); return v; };
    s.earlyC = function () { let a = 0, c = 0; for (let t = P.start; t <= Math.min(s.t, P.start + 5); t++) { a += s.C[t]; c++; } return c ? a / c : P.base; };   // 제재 첫 6달 평균 결속
    return s;
  }

  // 같은 설정으로 runs판 (시드 seed, seed+1, …): 압력이 통한 판 비율, 평균 피해, 새는 비율, 참여국 손해, 결속 최고·최저
  function sweep(params, runs) {
    const o = { success: 0, damage: 0, leak: 0, partLoss: 0, ratio: 0, peak: 0, min: 0, endC: 0, hitAt: [] };
    const base = (params && params.seed) || 1;
    for (let r = 0; r < runs; r++) {
      const s = create(Object.assign({}, params, { seed: base + r })).run();
      if (s.hit >= 0) { o.success++; o.hitAt.push(s.hit - s.params.start); }
      const d = s.avg(s.D); o.damage += d; o.leak += s.avg(s.leakRate); o.partLoss += s.lost; o.ratio += s.lost > 0 ? d / s.lost : 0;
      o.peak += s.earlyC(); o.min += s.minC; o.endC += s.C[s.T];
    }
    ['success', 'damage', 'leak', 'partLoss', 'ratio', 'peak', 'min', 'endC'].forEach((k) => { o[k] /= runs; });
    return o;
  }

  // 참여율 문턱: 압력이 통한 판이 절반 이상이 되는 가장 낮은 참여율 (0.1 간격). 없으면 null
  function threshold(params, runs) {
    for (let p = 0; p <= 1.0001; p += 0.1) { const o = sweep(Object.assign({}, params, { p: Math.round(p * 10) / 10 }), runs); if (o.success >= 0.5) return Math.round(p * 10) / 10; }
    return null;
  }

  return { DEFAULTS, create, sweep, threshold, world, mulberry32 };
});
