// 지방 소멸의 악순환: 가상의 지도(25×25칸) 위 마을들의 되먹임 모델. 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32).
// 한가운데 3×3칸은 큰 도시(끌어당기는 곳), 나머지 616칸은 마을이다. 한 걸음 = 모델 안의 1'해'(실제 연도와 연결하지 않음).
// 마을마다 젊은층(Y)과 그 외(O) 두 묶음의 사람 수, 그리고 생활 시설(학교·병원·가게를 하나로 묶은 것) 하나가 있다.
// 되먹임: ① 생활 여건(내 시설·주변 시설·도시와 가까움)이 나쁠수록 젊은층이 더 떠난다(도시나 더 큰 이웃 마을로)
//         ② 인구가 시설 유지 문턱 아래로 2년 이어지면 시설이 문을 닫고 되살아나지 않는다
//         ③ 젊은층이 줄면 아기도 줄어든다(출생 영향)  ④ 주변 마을 시설이 닫히면 내 생활 여건도 나빠진다(옆으로 번짐)
// 모든 상수는 이 프로젝트가 정한 무차원 설정이며 실제 통계가 아니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Depop = factory();
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
    W: 25, CITY_R: 1,          // 지도 한 변 칸 수, 도시 반경(가운데 3×3칸)
    POP0: 100, POP_SD: 0.22, POP_MIN: 65,   // 마을 처음 인구(평균 근처, 로그 정규 흔들림, 가장 작은 마을도 65명)
    NEAR0: 0.35, NEAR_D: 8,    // 도시에 가까운 마을일수록 처음 인구가 조금 더 많다
    CITY0: 0.15,               // 도시 처음 인구 = 전체의 15%
    YSH: 0.57,                 // 처음 젊은층 비율 (출생·나이 듦·사망이 맞물려 마을 인구가 그대로 유지되는 비율)
    BIRTH: 0.03, AGE: 0.03, DEATH: 0.04,   // 출생(젊은층 1명당), 젊은층 → 그 외로 넘어감, 그 외의 사망 (1해당 비율)
    R0: 0.006, R1: 0.07,       // 젊은층 떠나는 비율 = 끌림 × (R0 + R1 × (1 − 생활 여건))
    OLD: 0.25,                 // 그 외 연령은 젊은층의 이만큼만 떠난다
    NOISE: 0.3,                // 해마다 마을마다 떠나는 비율의 흔들림(로그 정규 표준편차)
    W_OWN: 0.4, W_NB: 0.4, W_CITY: 0.2,    // 생활 여건 = 0.4×내 시설 + 0.4×가장 가까운 다른 시설의 가까움 + 0.2×도시와 가까움
    REACH: 4, NB_R: 2, CITY_NEAR: 7,       // 다른 시설이 이 칸 수 이상 멀면 도움이 0, 둘레 범위(칸, 집계용), 도시와 가까움이 0이 되는 거리(칸)
    TO_CITY: 0.6,              // 떠난 사람 중 도시로 가는 몫(나머지는 더 큰 이웃 마을로, 없으면 도시로)
    BELOW: 2,                  // 문턱 아래로 이 해 수만큼 이어지면 문을 닫는다
    ALIVE: 0.5,                // 남은 마을: 인구가 처음의 50% 이상
    RING: { near: 4, mid: 7.5, far: 11 },   // 지켜 주는 마을 자동 위치: 도시 중심에서의 거리(칸)
  };
  const DEFAULTS = { seed: 1, pull: 100, thr: 60, birth: 100, protect: 0, where: 'mid', years: 60 };

  function gauss(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  const W = C.W, N = W * W, CX = (W - 1) / 2;
  const isCity = new Uint8Array(N), dCity = new Float64Array(N), dCen = new Float64Array(N), ring = [];
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, dx = x - CX, dy = y - CX;
    isCity[i] = Math.abs(dx) <= C.CITY_R && Math.abs(dy) <= C.CITY_R ? 1 : 0;
    dCen[i] = Math.sqrt(dx * dx + dy * dy);
    dCity[i] = Math.max(0, Math.max(Math.abs(dx), Math.abs(dy)) - C.CITY_R);   // 도시 가장자리까지 칸 수
  }
  const VIL = []; for (let i = 0; i < N; i++) if (!isCity[i]) VIL.push(i);
  // 둘레 2칸(체비셰프) 이웃 목록, 바로 옆 8칸 목록
  const NB2 = [], NB1 = [];
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0, a = [], b = [];
    for (let dy = -C.NB_R; dy <= C.NB_R; dy++) for (let dx = -C.NB_R; dx <= C.NB_R; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
      a.push(yy * W + xx); if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) b.push(yy * W + xx);
    }
    NB2.push(a); NB1.push(b);
  }
  // 칸마다 1칸·2칸·3칸 떨어진 고리(체비셰프 거리)의 칸 목록: 가장 가까운 다른 시설 찾기용
  const RINGS = [];
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0, rs = [];
    for (let r = 1; r < C.REACH; r++) { const L = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue; L.push(yy * W + xx); } rs.push(L); }
    RINGS.push(rs);
  }

  // 지켜 주는 마을 자동 위치: 도시 중심에서 같은 거리, 같은 간격의 방향
  function protectCells(count, where) {
    const r = C.RING[where] || C.RING.mid, out = [];
    for (let j = 0; j < count; j++) {
      const th = Math.PI / 6 + (2 * Math.PI * j) / count;
      let x = Math.round(CX + r * Math.cos(th)), y = Math.round(CX + r * Math.sin(th));
      x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(W - 1, y));
      const i = y * W + x; if (!isCity[i] && out.indexOf(i) < 0) out.push(i);
    }
    return out;
  }

  function create(opt) {
    const p = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32((p.seed * 2654435761) >>> 0 || 1);
    const Y = new Float64Array(N), O = new Float64Array(N), P0 = new Float64Array(N), Y0 = new Float64Array(N);
    const open = new Uint8Array(N), prot = new Uint8Array(N), below = new Uint8Array(N), closedAt = new Int16Array(N).fill(-1);
    let vt = 0;
    for (const i of VIL) {
      const near = Math.max(0, 1 - dCity[i] / C.NEAR_D);
      const pop = Math.max(C.POP_MIN, C.POP0 * (1 + C.NEAR0 * near) * Math.exp(C.POP_SD * gauss(rnd) - C.POP_SD * C.POP_SD / 2));
      Y[i] = pop * C.YSH; O[i] = pop - Y[i]; vt += pop;
    }
    const cityTot = vt * C.CITY0 / (1 - C.CITY0), nCity = N - VIL.length;
    for (let i = 0; i < N; i++) {
      if (isCity[i]) { Y[i] = cityTot / nCity * C.YSH; O[i] = cityTot / nCity - Y[i]; }
      P0[i] = Y[i] + O[i]; Y0[i] = Y[i]; open[i] = 1;
    }
    const pc = protectCells(p.protect | 0, p.where); pc.forEach((i) => { prot[i] = 1; });
    const S = {
      params: p, C, W, N, isCity, dCity, dCen, VIL, t: 0, done: false,
      Y, O, P0, open, prot, closedAt, protectedCells: pc,
      prevPop: new Float64Array(N), pop: new Float64Array(N),
      firstYear: -1, firstCells: [], halfYear: -1,
      hist: { alive: [], closed: [], city: [], total: [] }, last: null, total0: 0,
    };
    for (let i = 0; i < N; i++) { S.pop[i] = P0[i]; S.prevPop[i] = P0[i]; S.total0 += P0[i]; }
    const pull = p.pull / 100, eb = p.birth / 100, thr = p.thr;
    const A = new Float64Array(N), inY = new Float64Array(N), inO = new Float64Array(N);

    // 생활 여건(0~1) = 0.4×내 시설 + 0.4×가장 가까운 다른 시설이 얼마나 가까운지(1칸 0.75, 2칸 0.5, 3칸 0.25, 4칸 이상 0) + 0.2×도시와 가까움
    function access(i) {
      if (isCity[i]) return 1;
      const nb = RINGS[i]; let d = C.REACH;
      for (let r = 0; r < nb.length && d === C.REACH; r++) { const L = nb[r]; for (let k = 0; k < L.length; k++) if (open[L[k]]) { d = r + 1; break; } }
      return C.W_OWN * open[i] + C.W_NB * (1 - d / C.REACH) + C.W_CITY * Math.max(0, 1 - dCity[i] / C.CITY_NEAR);
    }
    function measure() {
      let alive = 0, closed = 0, tot = 0, city = 0;
      for (let i = 0; i < N; i++) { const q = Y[i] + O[i]; tot += q; if (isCity[i]) city += q; }
      for (const i of VIL) { if (Y[i] + O[i] >= C.ALIVE * P0[i]) alive++; if (!open[i]) closed++; }
      return { t: S.t, alive, closed: (100 * closed) / VIL.length, nClosed: closed, city: (100 * city) / tot, total: (100 * tot) / S.total0, spread: spread() };
    }
    // 연쇄가 번진 거리: 처음 문 닫은 마을(들)과 문 닫은 마을끼리 바로 옆으로 이어진 무리 안에서, 처음 마을로부터 가장 먼 칸 수
    function spread() {
      if (S.firstYear < 0) return 0;
      const seen = new Uint8Array(N), q = [];
      S.firstCells.forEach((i) => { seen[i] = 1; q.push(i); });
      let best = 0;
      while (q.length) {
        const i = q.pop(), x = i % W, y = (i / W) | 0;
        let dmin = 1e9; for (const f of S.firstCells) { const dx = (f % W) - x, dy = ((f / W) | 0) - y; dmin = Math.min(dmin, Math.max(Math.abs(dx), Math.abs(dy))); }
        best = Math.max(best, dmin);
        const nb = NB1[i]; for (let k = 0; k < nb.length; k++) { const j = nb[k]; if (!seen[j] && !open[j] && !isCity[j]) { seen[j] = 1; q.push(j); } }
      }
      return best;
    }
    function record() {
      const m = measure(); S.last = m;
      S.hist.alive.push(m.alive); S.hist.closed.push(m.closed); S.hist.city.push(m.city); S.hist.total.push(m.total);
    }
    S.step = function () {
      if (S.done) return false;
      for (let i = 0; i < N; i++) { A[i] = access(i); inY[i] = 0; inO[i] = 0; S.prevPop[i] = Y[i] + O[i]; }
      // ① 떠남: 도시 60%, 나머지는 바로 옆 8칸 중 나보다 크고 시설이 열린 마을로(인구 × 생활 여건 비례), 없으면 도시로
      let toCityY = 0, toCityO = 0;
      for (const i of VIL) {
        const r = Math.min(0.5, pull * (C.R0 + C.R1 * (1 - A[i])) * Math.exp(C.NOISE * gauss(rnd) - C.NOISE * C.NOISE / 2));
        const ly = Y[i] * r, lo = O[i] * r * C.OLD;
        Y[i] -= ly; O[i] -= lo;
        const me = S.prevPop[i], nb = NB1[i]; let wsum = 0;
        for (let k = 0; k < nb.length; k++) { const j = nb[k]; if (!isCity[j] && open[j] && S.prevPop[j] > me) wsum += S.prevPop[j] * A[j]; }
        const share = wsum > 0 ? 1 - C.TO_CITY : 0;
        toCityY += ly * (1 - share); toCityO += lo * (1 - share);
        if (wsum > 0) for (let k = 0; k < nb.length; k++) { const j = nb[k]; if (!isCity[j] && open[j] && S.prevPop[j] > me) { const w = (S.prevPop[j] * A[j]) / wsum; inY[j] += ly * share * w; inO[j] += lo * share * w; } }
      }
      let cityPop = 0; for (let i = 0; i < N; i++) if (isCity[i]) cityPop += S.prevPop[i];
      for (let i = 0; i < N; i++) if (isCity[i]) { const w = S.prevPop[i] / cityPop; inY[i] += toCityY * w; inO[i] += toCityO * w; }
      // ③ 출생·나이 듦: 아기 = 출생률 × ((1 − 출생 영향) × 처음 젊은층 + 출생 영향 × 지금 젊은층)
      for (let i = 0; i < N; i++) {
        const y = Y[i] + inY[i], o = O[i] + inO[i];
        const births = C.BIRTH * ((1 - eb) * Y0[i] + eb * y), aging = C.AGE * y;
        Y[i] = Math.max(0, y + births - aging); O[i] = Math.max(0, o + aging - C.DEATH * o);
      }
      S.t++;
      // ② 시설: 인구가 문턱 아래로 2해 이어지면 문을 닫는다(지켜 주는 마을과 도시는 닫지 않음, 다시 열리지 않음)
      const newly = [];
      for (const i of VIL) {
        const q = Y[i] + O[i]; S.pop[i] = q;
        if (!open[i] || prot[i]) continue;
        if (q < thr) { below[i]++; if (below[i] >= C.BELOW) { open[i] = 0; closedAt[i] = S.t; newly.push(i); } } else below[i] = 0;
      }
      for (let i = 0; i < N; i++) if (isCity[i]) S.pop[i] = Y[i] + O[i];
      if (S.firstYear < 0 && newly.length) { S.firstYear = S.t; S.firstCells = newly; }
      record();
      if (S.halfYear < 0 && S.last.closed >= 50) S.halfYear = S.t;
      if (S.t >= p.years) S.done = true;
      return true;
    };
    record();
    return S;
  }

  // 집계용: 한 판을 끝까지 돌려 마지막 값을 돌려준다
  function summary(opt) {
    const s = create(opt); while (s.step());
    return { s, closed: s.last.closed, alive: s.last.alive, city: s.last.city, total: s.last.total, spread: s.last.spread,
      first: s.firstYear, half: s.halfYear >= 0 && s.firstYear >= 0 ? s.halfYear - s.firstYear : -1 };
  }
  // 지켜 준 마을 둘레(2칸 안, 지켜 준 곳·도시 제외) 마을 가운데 끝까지 시설이 남은 마을 수
  function heldAround(s, cells) {
    const set = new Set();
    cells.forEach((c) => NB2[c].forEach((j) => { if (!s.isCity[j] && cells.indexOf(j) < 0) set.add(j); }));
    let held = 0; set.forEach((j) => { held += s.open[j]; });
    return { held, of: set.size };
  }
  return { create, summary, heldAround, protectCells, DEFAULTS, C, mulberry32 };
});
