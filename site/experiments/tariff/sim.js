/*
 * 관세 보복: 두 나라가 관세를 주고받는 반복 게임 (이 프로젝트의 단순화된 모델, 숫자는 예시)
 * 죄수의 딜레마의 구조(혼자 올리면 단기 이득, 둘 다 올리면 둘 다 손해)를 0~50%의 연속 관세율에 올린 것.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 한 라운드(분기) 동안 나라 i의 이득 (관세가 둘 다 0이면 정확히 1)
 *   수출 이익      = 1 − 1.6 × (상대 관세)            ← 상대가 올리면 내 물건이 덜 팔린다 (관세 50%면 0.2)
 *   관세로 거둔 이익 = 2.2 × (내 관세) × (1 − 1.6 × 내 관세)   ← 들어오는 수입품에서 걷는 몫 (수입이 줄면 같이 준다)
 *   소비자·기업 부담 = 1.0 × (내 관세)                 ← 수입품 값이 올라 우리 쪽이 더 내는 돈
 *   → 상대가 0일 때 나만 20% 올리면 한 라운드 이득이 1.10 (단기 이득), 둘 다 20%면 각자 0.82 (둘 다 손해)
 *
 * 행동 규칙 (매 라운드, 두 나라 동시에)
 *   - 처음: 1라운드에 A국이 관세를 20%로 올린다(먼저 올린 쪽).
 *   - 우연한 충격: 나라마다 매 라운드 확률 shock로 국내 사정 때문에 관세를 10%p 올린다.
 *   - 보복: 상대가 지난 라운드에 관세를 올렸으면 내 관세를 (상대 관세 × retal)까지 따라 올린다(이미 그보다 높으면 그대로).
 *     retal = 1이면 똑같이 맞추고, 1보다 크면 더 세게 되갚아 서로 계속 올라가고, 1보다 작으면 덜 따라간다.
 *   - 협상: 매 라운드 확률 talk로 협상이 열린다. 그 라운드에 상대가 올리지 않았다면 '협상 신호'가 1 쌓인다.
 *     상대가 내리면 그것도 신호 1. 상대가 올리면 쌓인 신호는 0으로.
 *   - 신호가 patience개 이상 쌓이면 관세를 10%p 내리려 한다. 국내 압력(pressure)의 확률로 막혀 못 내린다(신호는 그대로).
 *     내리는 데 성공하면 신호를 0으로 되돌린다.
 *   - 관세는 0~50%로 자른다. 라운드 100번(25년).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tariff = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { retal: 1.0, patience: 3, pressure: 0.3, talk: 0.25, shock: 0.03, first: 0.2, rounds: 100, cap: 0.5, step: 0.1, seed: 1 };
  const K = 1.6, G = 2.2, B = 1.0;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const volume = (t) => 1 - K * t;                       // 관세 t가 붙은 쪽으로 가는 거래량 (0이면 1)
  const parts = (mine, theirs) => ({ exp: volume(theirs), rev: G * mine * volume(mine), burden: B * mine });
  const payoff = (mine, theirs) => { const p = parts(mine, theirs); return p.exp + p.rev - p.burden; };
  const clip = (v, cap) => Math.max(0, Math.min(cap, Math.round(v * 1000) / 1000));

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 7919 + 13);
    const t = [0, 0], sig = [0, 0], cum = [0, 0];
    const sim = {
      params: p, round: 0, done: false, t, sig, cum,
      tA: [0], tB: [0], cumA: [0], cumB: [0], base: [0], talkAt: [0],
      events: [],            // {round, who, kind:'first'|'shock'|'retal'|'down'|'blocked', from, to}
      firstDown: -1,          // 먼저 관세를 내린 나라 (0=A, 1=B), 아직 없으면 -1
      firstDownRound: -1,
      talks: 0,
      gainNow() { return [payoff(t[0], t[1]), payoff(t[1], t[0])]; },
      parts() { return [parts(t[0], t[1]), parts(t[1], t[0])]; },
      advance() {
        if (sim.done) return false;
        const r = ++sim.round, prev = [t[0], t[1]];
        const lastUp = [0, 1].map((i) => { const h = i ? sim.tB : sim.tA; return h.length >= 2 ? Math.max(0, h[h.length - 1] - h[h.length - 2]) : 0; });
        const lastDown = [0, 1].map((i) => { const h = i ? sim.tB : sim.tA; return h.length >= 2 ? Math.max(0, h[h.length - 2] - h[h.length - 1]) : 0; });
        const talk = rng() < p.talk; if (talk) sim.talks++; sim.talkAt.push(talk ? 1 : 0);
        const next = [t[0], t[1]];
        for (let i = 0; i < 2; i++) {
          const j = 1 - i;
          if (r === 1 && i === 0) { next[i] = p.first; sim.events.push({ round: r, who: i, kind: 'first', from: prev[i], to: next[i] }); continue; }
          if (lastUp[j] > 0) {   // 보복
            sig[i] = 0;
            const target = Math.min(p.cap, p.retal * prev[j]);
            if (target > prev[i] + 0.0005) { next[i] = target; sim.events.push({ round: r, who: i, kind: 'retal', from: prev[i], to: clip(next[i], p.cap) }); }
            continue;
          }
          if (lastDown[j] > 0) sig[i]++;
          if (talk) sig[i]++;
          if (prev[i] > 0 && sig[i] >= p.patience) {
            if (rng() < p.pressure) sim.events.push({ round: r, who: i, kind: 'blocked', from: prev[i], to: prev[i] });
            else { next[i] = prev[i] - p.step; sig[i] = 0; sim.events.push({ round: r, who: i, kind: 'down', from: prev[i], to: clip(next[i], p.cap) }); if (sim.firstDown < 0) { sim.firstDown = i; sim.firstDownRound = r; } }
          }
        }
        for (let i = 0; i < 2; i++) if (rng() < p.shock) { next[i] += p.step; sim.events.push({ round: r, who: i, kind: 'shock', from: prev[i], to: clip(next[i], p.cap) }); }
        t[0] = clip(next[0], p.cap); t[1] = clip(next[1], p.cap);
        cum[0] += payoff(t[0], t[1]); cum[1] += payoff(t[1], t[0]);
        sim.tA.push(t[0]); sim.tB.push(t[1]); sim.cumA.push(cum[0]); sim.cumB.push(cum[1]); sim.base.push(r);
        if (r >= p.rounds) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
      total() { return cum[0] + cum[1]; },
      ended() { return t[0] <= 0.1 + 1e-9 && t[1] <= 0.1 + 1e-9; },   // 갈등이 끝남: 두 나라 모두 10% 이하
      meanTariff() { const a = sim.tA, b = sim.tB; let s = 0; for (let k = 1; k < a.length; k++) s += a[k] + b[k]; return s / (2 * (a.length - 1)); },
    };
    return sim;
  }

  // 같은 설정, 다른 운으로 여러 판: 합계 이득(기준 대비 비율), 평균 관세율, 갈등이 끝난 판 비율
  function sweep(opts, runs) {
    const out = { total: [], tariff: [], ended: 0, a: [], b: [] };
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k })).run(), base = 2 * s.params.rounds;
      out.total.push(s.total() / base); out.tariff.push(s.meanTariff()); if (s.ended()) out.ended++;
      out.a.push(s.cum[0] / s.params.rounds); out.b.push(s.cum[1] / s.params.rounds);
    }
    out.ended /= runs;
    return out;
  }

  return { DEFAULTS, create, sweep, payoff, parts, volume };
});
