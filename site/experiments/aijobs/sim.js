// AI와 신입 사다리: 가상의 업계 하나에서 사람이 신입 → 중간 → 숙련으로 '일을 하면서' 올라가는 사다리 모델.
// 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32). 한 걸음 = 모델 속 1해(실제 연도와 연결하지 않음).
// - 해마다 일감이 생긴다: 단순한 일(신입이 하며 배우는 일), 중간 일(중간·숙련), 어려운 일(숙련만)
// - AI 대체율 s만큼 단순한 일을 AI가 하고, 회사는 그만큼 신입을 덜 뽑는다(보충 비율 b만큼은 미래를 위해 계속 뽑는다)
// - 신입의 경력은 실제로 맡은 단순한 일만큼 쌓인다(일감보다 신입이 많으면 남는 몫은 옆에서 보며 절반만 쌓임). AI가 가르치는 효과 e는 경력이 쌓이는 속도를 늘린다(설정)
// - 경력이 차면 해마다 일정 확률로 승급. 신입·중간은 해마다 일부가 업계를 떠나고, 숙련은 은퇴한다. 업계 밖에서 경력자를 데려올 수 없다
// - 처리 못 한 중간·어려운 일은 '밀린 일'로 다음 해로 넘어가고(해마다 30%는 포기), 숙련자가 모자랄수록 숙련자 임금이 오른다
// - 같은 시드로 'AI 없음' 쌍둥이 업계를 나란히 돌려 해마다 비용을 비교한다
// 모든 상수는 이 프로젝트가 정한 무차원 설정이며 실제 통계·기업이 아니다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiJobs = factory();
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
    H0: 36,                      // AI가 없을 때 해마다 뽑는 신입 수
    JEXP: 2, PJ: 0.5,            // 신입: 경력 2해가 차면 해마다 50% 확률로 중간이 된다
    MEXP: 7, PM: 0.35,           // 중간: 경력 7해가 차면 해마다 35% 확률로 숙련이 된다
    QJ: 0.1, QM: 0.06,           // 해마다 업계를 떠나는 비율: 신입 8%, 중간 4%
    DS: 124, DM: 116, DH: 150,    // 해마다 생기는 일감(사람-해): 단순한 일, 중간 일, 어려운 일
    WJ: 1.0, WM: 1.6, WS: 2.4,   // 1인당 한 해 인건비(신입=1)
    SIDE: 0.5,                   // 맡은 일이 모자란 신입은 옆에서 보며 그 빈 몫의 절반만큼 배운다
    AIC: 0.2,                    // AI가 단순한 일 1만큼을 하는 비용
    DROP: 0.3,                   // 밀린 일 가운데 해마다 포기하는 비율
    WAGE_EL: 0.8, WAGE_MAX: 2.5, // 숙련자 임금 지수 = (어려운 일 ÷ 숙련자 수)^0.8, 1~2.5
    BURN: 80,                    // 시작 전에 AI 없이 돌려 사다리를 자리 잡게 하는 해
  };
  const DEFAULTS = { seed: 1, s: 50, b: 0, e: 0, r: 10, pen: 2, years: 30 };

  function world(rng, opt) {
    // 사람: stage 0 신입, 1 중간, 2 숙련 / exp 경력(해)
    let ppl = opt.ppl ? opt.ppl.map((p) => ({ st: p.st, exp: p.exp, id: p.id })) : [];
    let nextId = opt.nextId || 1, B = opt.B || 0, hireCarry = opt.hireCarry || 0, worked = [], lastC = null;
    const W = { s: opt.s / 100, b: opt.b / 100, e: opt.e / 100, r: opt.r / 100, pen: opt.pen };
    function count() { let J = 0, M = 0, S = 0; for (const p of ppl) { if (p.st === 0) J++; else if (p.st === 1) M++; else S++; } return { J, M, S }; }
    function year() {
      // 해가 시작할 때 뽑기: AI가 맡은 몫만큼 덜 뽑고, 그중 보충 비율만큼은 미래를 위해 계속 뽑는다
      const want = C.H0 * ((1 - W.s) + W.s * W.b) + hireCarry, n = Math.floor(want);
      hireCarry = want - n;
      for (let k = 0; k < n; k++) ppl.push({ st: 0, exp: 0, id: nextId++ });
      const { J, M, S } = count();
      worked = ppl.map((p) => ({ st: p.st, id: p.id }));               // 올해 일한 사람(3D가 그린다)
      // 일 나누기
      const aiWork = W.s * C.DS, human = C.DS - aiWork;                  // 단순한 일 가운데 사람 몫
      const f = J > 0 ? Math.min(1, human / J) : 1;                      // 신입 한 명이 맡은 일(한 해 꽉 차면 1)
      const hardNeed = C.DH + B, doneH = Math.min(S, hardNeed), spare = S - doneH;
      const midShort = Math.max(0, C.DM - M - spare);
      const left = hardNeed - doneH + midShort;                          // 올해 못 한 숙련 일(밀린 일)
      const idx = S > 0 ? Math.min(C.WAGE_MAX, Math.max(1, Math.pow(C.DH / S, C.WAGE_EL))) : C.WAGE_MAX;
      const wages = J * C.WJ + M * C.WM + S * C.WS * idx;
      const cost = wages + aiWork * C.AIC + W.pen * left;
      const dropped = left * C.DROP; B = left - dropped;
      // 배우기·승급·떠나기
      const gain = (f + C.SIDE * (1 - f)) * (1 + W.e);
      const next = [];
      for (const p of ppl) {
        if (p.st === 0) {
          p.exp += gain;
          if (rng() < C.QJ) continue;
          if (p.exp >= C.JEXP && rng() < C.PJ) p.st = 1;
        } else if (p.st === 1) {
          p.exp += 1;
          if (rng() < C.QM) continue;
          if (p.exp >= C.MEXP && rng() < C.PM) p.st = 2;
        } else {
          p.exp += 1;
          if (rng() < W.r) continue;
        }
        next.push(p);
      }
      ppl = next;
      lastC = { J, M, S };
      return { J, M, S, f, left, B, dropped, idx, wages, cost, aiWork };
    }
    return { year, count, get ppl() { return ppl; }, get worked() { return worked; }, get lastC() { return lastC; }, get B() { return B; }, get nextId() { return nextId; }, get hireCarry() { return hireCarry; } };
  }

  function create(o) {
    const P = Object.assign({}, DEFAULTS, o);
    // 1) AI 없이 오래 돌려 자리 잡은 사다리(시드마다 다름)
    const rb = mulberry32(P.seed * 7919 + 13);
    const pre = world(rb, { s: 0, b: 0, e: 0, r: P.r, pen: P.pen });
    for (let k = 0; k < C.BURN; k++) pre.year();
    const start = { ppl: pre.ppl, nextId: pre.nextId, B: pre.B, hireCarry: pre.hireCarry };
    // 2) 같은 출발점에서 'AI 쓰는 업계'와 'AI 없음' 쌍둥이를 같은 난수 순서로 나란히 돌린다
    const A = world(mulberry32(P.seed * 104729 + 7), Object.assign({}, start, { s: P.s, b: P.b, e: P.e, r: P.r, pen: P.pen }));
    const Z = world(mulberry32(P.seed * 104729 + 7), Object.assign({}, start, { s: 0, b: 0, e: 0, r: P.r, pen: P.pen }));
    // 0해 = AI가 들어오기 직전 해(마지막으로 AI 없이 일한 해)의 사람 수
    const c0 = pre.lastC, w0 = pre.worked;
    const hist = { J: [c0.J], M: [c0.M], S: [c0.S], B: [pre.B], cost: [], cost0: [], idx: [], cum: [0], J0: [c0.J], M0: [c0.M], S0: [c0.S], B0: [pre.B] };
    const sim = {
      params: P, t: 0, done: false, hist, revYear: -1, evenYear: -1, firstSave: -1, wasAhead: false,
      worked: w0, prevWorked: w0,
      last: { J: c0.J, M: c0.M, S: c0.S, B: pre.B, cost: 0, cost0: 0, idx: 1 },
      step() {
        if (sim.done) return false;
        const a = A.year(), z = Z.year();
        sim.t++; sim.prevWorked = sim.worked; sim.worked = A.worked;
        hist.J.push(a.J); hist.M.push(a.M); hist.S.push(a.S); hist.B.push(a.B);
        hist.J0.push(z.J); hist.M0.push(z.M); hist.S0.push(z.S); hist.B0.push(z.B);
        hist.cost.push(a.cost); hist.cost0.push(z.cost); hist.idx.push(a.idx);
        hist.cum.push(hist.cum[hist.cum.length - 1] + (a.cost - z.cost));
        if (sim.firstSave < 0 && a.cost < z.cost) sim.firstSave = sim.t;
        // 역전: 3해 평균으로 AI 쓰는 쪽 비용이 AI 없음보다 1% 넘게 커진 첫 해(한 해의 들쭉날쭉함은 무시)
        const k = hist.cost.length;
        if (sim.revYear < 0 && sim.firstSave > 0 && k >= 3) { let d = 0, z0 = 0; for (let j = k - 3; j < k; j++) { d += hist.cost[j] - hist.cost0[j]; z0 += hist.cost0[j]; } if (d > 0.01 * z0) sim.revYear = sim.t; }
        if (hist.cum[sim.t] < -0.01 * z.cost) sim.wasAhead = true;     // 아낀 돈이 한 해 비용의 1%를 넘은 적이 있어야 '사라짐'을 잰다
        if (sim.evenYear < 0 && sim.wasAhead && hist.cum[sim.t] > 0) sim.evenYear = sim.t;
        sim.last = { J: a.J, M: a.M, S: a.S, B: a.B, cost: a.cost, cost0: z.cost, idx: a.idx, f: a.f, left: a.left, dropped: a.dropped };
        if (sim.t >= P.years) sim.done = true;
        return true;
      },
    };
    return sim;
  }

  // 집계용: 한 판을 끝까지 돌려 요약을 돌려준다
  function summary(o) {
    const s = create(o); while (s.step());
    const h = s.hist, n = h.cost.length, sum = (a) => a.reduce((x, y) => x + y, 0);
    const first5 = sum(h.cost.slice(0, 5)) / sum(h.cost0.slice(0, 5));
    const last5 = sum(h.cost.slice(n - 5)) / sum(h.cost0.slice(n - 5));
    return { s, rev: s.revYear, even: s.evenYear, save: s.firstSave, total: sum(h.cost) / sum(h.cost0), first5, last5,
      S: h.S[n], S0: h.S0[n], J: h.J[n], J0: h.J0[n], M: h.M[n], M0: h.M0[n], B: h.B[n], B0: h.B0[n], idx: h.idx[n - 1] };
  }
  return { create, summary, DEFAULTS, C, mulberry32 };
});
