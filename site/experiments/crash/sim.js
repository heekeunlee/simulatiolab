/*
 * 손절 연쇄 폭락: 문턱 연쇄 + 가격 충격 (이 프로젝트의 단순화된 모델, 숫자는 모두 예시)
 * 가상의 시장 하루. 브라우저와 Node.js 양쪽에서 같은 파일을 쓴다(UMD, 시드 난수 mulberry32).
 *
 * 사람
 *   - 보유자 N명(기본 2,000): 각자 "손절선"이 있다. 장 시작 가격보다 d% 내려가면 가진 것을 모두 판다.
 *     d ~ 정규분포(평균 CENTER=6%, 퍼짐 s). s가 작으면 손절선이 한곳에 몰리고(촘촘), 크면 퍼진다.
 *   - 그중 빚을 낸 사람(비율 lev): 가진 양이 2배(LEV_SIZE)이고, 손절선이 절반 거리(LEV_NEAR)라 더 일찍 강제로 판다(청산).
 *   - 큰손(비중 whale): 한 방향으로 같이 움직이는 묶음 하나. 시장 전체 보유량의 whale만큼을 갖고, 손절선 하나(같은 분포에서 뽑음)를 넘으면 한꺼번에 판다.
 *   - 저가 매수자(보유자 수 × dip 명): 가격이 u% 내려가면 1씩 산다(u ~ 고른 분포 1~9%). 한 사람이 한 번만.
 * 가격 (로그 가격 x = ln(P / 시작 가격))
 *   - 장 시작 직후 외부 충격으로 x = ln(1 − shock).
 *   - 라운드마다: 지금 가격이 손절선 이하인 사람이 모두 팔고, 매수선 이하인 저가 매수자가 산다.
 *     x ← x − impact × (판 양 − 산 양) / N + 작은 흔들림(표준편차 NOISE). (빚 없는 보유자 N명이 모두 1씩 팔면 로그 가격이 impact만큼 내려감)
 *   - 라운드 ROUNDS(40)번이 하루. 하루 끝 가격을 기록한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Crash = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SPREADS = [0.004, 0.008, 0.015, 0.025, 0.04];   // 손절선이 퍼진 정도 1~5 (표준편차)
  const IMPACTS = [0.025, 0.04, 0.055, 0.075, 0.10];   // 시장이 얇은 정도 1~5 (빚 없는 보유자 N명이 모두 1씩 팔면 로그 가격이 이만큼 내려감)
  const C = { N: 2000, CENTER: 0.06, LEV_SIZE: 2, LEV_NEAR: 0.5, NOISE: 0.001, ROUNDS: 40, BUY_MIN: 0.01, BUY_MAX: 0.09, BIG: 0.07, MIN_D: 0.002 };
  const DEFAULTS = { shock: 2, spread: 3, lev: 20, impact: 3, whale: 10, dip: 10, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }

  function create(p0) {
    const p = Object.assign({}, DEFAULTS, p0 || {});
    const rnd = mulberry32((p.seed * 2654435761) >>> 0 || 1);
    const s = SPREADS[Math.max(0, Math.min(4, p.spread - 1))], lam = IMPACTS[Math.max(0, Math.min(4, p.impact - 1))];
    const N = C.N, lev = p.lev / 100, wFrac = p.whale / 100, M = Math.round(N * p.dip / 100);
    // 보유자 (마지막 한 명은 큰손 묶음)
    const people = [];
    let held = 0;
    for (let i = 0; i < N; i++) {
      const L = rnd() < lev;
      let d = Math.max(C.MIN_D, C.CENTER + s * gauss(rnd));
      if (L) d = Math.max(C.MIN_D, d * C.LEV_NEAR);
      const size = L ? C.LEV_SIZE : 1; held += size;
      people.push({ d, line: Math.log(1 - d), size, lev: L, whale: false, sold: -1 });
    }
    const dW = Math.max(C.MIN_D, C.CENTER + s * gauss(rnd));
    let whale = null;
    if (wFrac > 0) {
      const W = held * wFrac / (1 - wFrac);
      whale = { d: dW, line: Math.log(1 - dW), size: W, lev: false, whale: true, sold: -1 }; held += W;
    }
    const buyers = [];
    for (let j = 0; j < M; j++) { const u = C.BUY_MIN + (C.BUY_MAX - C.BUY_MIN) * rnd(); buyers.push({ u, line: Math.log(1 - u), bought: -1 }); }
    // 손절선이 높은(가까운) 순서로 정렬: 가격이 내려가면 앞에서부터 차례로 걸린다
    const order = people.slice(); if (whale) order.push(whale);
    order.sort((a, b) => b.line - a.line);
    const border = buyers.slice().sort((a, b) => b.line - a.line);
    const noise = []; for (let r = 0; r <= C.ROUNDS; r++) noise.push(C.NOISE * gauss(rnd));

    const S = {
      params: p, lam, spreadSD: s, people, whale, buyers, order, border, held, M,
      x: Math.log(1 - p.shock / 100), round: 0, done: false,
      path: [0], sold: [0], bought: [0], ptr: 0, bptr: 0,
      soldPeople: 0, soldLev: 0, soldSize: 0, chainRounds: 0, lastSaleRound: 0, minX: 0, whaleRound: -1,
      advance() {
        if (S.done) return false;
        const r = ++S.round;
        let sell = 0, buy = 0;
        while (S.ptr < order.length && order[S.ptr].line >= S.x) {
          const a = order[S.ptr++]; a.sold = r; sell += a.size; S.soldSize += a.size;
          if (a.whale) S.whaleRound = r; else { S.soldPeople++; if (a.lev) S.soldLev++; }
        }
        while (S.bptr < border.length && border[S.bptr].line >= S.x) { border[S.bptr++].bought = r; buy += 1; }
        if (sell > 0) { S.chainRounds++; S.lastSaleRound = r; }
        if (r === 1) S.path[0] = S.x;   // 0번째 점 = 충격 직후 가격
        S.x += -lam * (sell - buy) / N + noise[r];
        S.minX = Math.min(S.minX, S.x);
        S.path.push(S.x); S.sold.push(sell); S.bought.push(buy);
        if (r >= C.ROUNDS) S.done = true;
        return true;
      },
      run() { while (S.advance()); return S; },
      drop() { return 1 - Math.exp(S.x); },            // 지금(하루 끝이면 하루) 낙폭, 시작 가격 대비
      price() { return Math.exp(S.x); },
      soldShare() { return S.soldPeople / N; },
      levCount() { return people.reduce((n, a) => n + (a.lev ? 1 : 0), 0); },
      // 그래프 축용: 모두가 팔고 아무도 안 샀을 때의 낙폭(최악의 경우). 결과를 미리 알려 주지 않는 고정 범위
      worst() { return 1 - Math.exp(S.path[0] - lam * (held) / N - 0.01); },
    };
    S.path[0] = S.x;
    return S;
  }

  // 같은 설정으로 runs판 (시드 seed0, seed0+1, ...): 하루 낙폭 목록
  function sweep(p, runs, seed0) {
    const drops = [], chains = [], sold = [];
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, p, { seed: (seed0 || 1) + k })).run();
      drops.push(s.drop()); chains.push(s.chainRounds); sold.push(s.soldShare());
    }
    const big = drops.filter((d) => d >= C.BIG).length / runs;
    return { drops, chains, sold, big };
  }
  return { create, sweep, DEFAULTS, C, SPREADS, IMPACTS };
});
