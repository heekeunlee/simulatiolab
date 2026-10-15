/*
 * 국경을 닫으면 이주 흐름은 어디로 갈까 (이 프로젝트의 단순화된 모델, 숫자는 모두 예시)
 * 가상의 땅: 출발 지역 → 도착 지역으로 가는 길 6개. 실제 나라·지역·국경·사건이 아니다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다 (UMD, 시드 난수 mulberry32).
 *
 * 길마다: 기본 부담(돈·시간·고생을 합친 점수) base, 사고 위험 risk(도중에 다치거나 길을 잃어 도착하지 못할 확률), 한 달에 무리 없이 지나는 수 cap
 * 한 달(한 걸음)마다
 *   - 떠나려는 사람 = 새로 나서는 사람(압력 p × 6명) + 지난달 되돌려 보내진 사람 중 다시 나서는 사람(60%)
 *   - 한 사람씩 길을 고른다(확률 선택, 로짓): 길 r의 체감 부담 G_r = base_r + (위험을 꺼리는 정도) × risk_r(%) + 붐빔 + 통제
 *       붐빔 = 15 × (지난달까지 본 그 길 이용자 / cap)^2   ← 사람들은 지난달 소식(평균)을 보고 고른다
 *       통제 = 35 × (막는 세기 s)   ← 막은 길만
 *     '이번엔 떠나지 않음'도 고를 수 있다: 부담 S = 20 + 0.6 × p (압력이 클수록 머무는 게 힘듦). 고를 확률 ∝ exp(−부담 / 6)
 *   - 막은 길을 고른 사람은 확률 0.85 × s로 되돌려 보내진다(다음 달 60%가 다시 나섬, 40%는 포기)
 *   - 통과한 사람은 그 길의 사고 위험 확률로 도착하지 못하고, 나머지는 도착한다
 *   - 통제 비용(점) = 100 × s(고정) + 되돌려 보낸 사람 1명당 1점
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Migration = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ROUTES = [
    { id: 'gate', ko: '정식 관문', en: 'Official crossing', base: 30, risk: 1, cap: 60 },
    { id: 'road', ko: '큰길', en: 'Main road', base: 34, risk: 3, cap: 140 },
    { id: 'river', ko: '강 건너기', en: 'River crossing', base: 40, risk: 8, cap: 90 },
    { id: 'mount', ko: '산길', en: 'Mountain trail', base: 46, risk: 14, cap: 70 },
    { id: 'desert', ko: '사막길', en: 'Desert track', base: 50, risk: 20, cap: 90 },
    { id: 'sea', ko: '바닷길', en: 'Sea crossing', base: 50, risk: 30, cap: 120 },
  ];
  const RISKY = 10;   // 사고 위험이 이 % 이상이면 '위험한 길'
  const DEFAULTS = { pressure: 60, block: 1, strength: 80, gatecap: 100, riskw: 100, months: 72, blockAt: 24, seed: 1 };
  const TAU = 6, CONG = 15, CTRL = 35, CATCH = 0.85, RETRY = 0.6, NEWPER = 6, EMA = 0.8;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32((P.seed * 2654435761) >>> 0);
    const R = ROUTES.length;
    const cap = ROUTES.map((r, i) => (i === 0 ? r.cap * P.gatecap / 100 : r.cap));
    const s = {
      params: P, t: 0, done: false, blocked: P.blockAt === 0, blockLog: [],
      perc: cap.map((c) => c * 0.6), retry: 0,
      // 달마다 기록 (길별 시도 수, 되돌려진 수, 사고, 도착, 위험한 길 비중, 통제 비용)
      flow: [], back: [], acc: [], arr: [], risky: [], cost: [], deciders: [], stay: [], cost_r: [], blockedAt: [],
      cap,
    };
    if (s.blocked) s.blockLog.push({ t: 0, on: true });
    function costs() {
      const st = P.strength / 100;
      return ROUTES.map((r, i) => {
        const load = s.perc[i] / cap[i];
        return r.base + (P.riskw / 100) * r.risk + CONG * load * load + (s.blocked && i === P.block ? CTRL * st : 0);
      });
    }
    s.costs = costs;
    s.stayCost = () => 20 + 0.6 * P.pressure;
    // 지금 체감 부담에서 각 선택지를 고를 확률 (마지막 = 떠나지 않음)
    s.probs = function () {
      const G = costs().concat([s.stayCost()]), mn = Math.min(...G);
      const e = G.map((g) => Math.exp(-(g - mn) / TAU)), z = e.reduce((a, b) => a + b, 0);
      return e.map((v) => v / z);
    };
    s.setBlock = function (on) { if (s.blocked === !!on) return; s.blocked = !!on; s.blockLog.push({ t: s.t, on: s.blocked }); };
    s.step = function () {
      if (s.done) return false;
      if (s.t === P.blockAt && P.blockAt > 0 && !s.blockLog.length) s.setBlock(true);
      const st = P.strength / 100, pr = s.probs(), cum = []; let a = 0; pr.forEach((v) => { a += v; cum.push(a); });
      const n = Math.round(NEWPER * P.pressure) + s.retry;
      const f = new Array(R).fill(0), back = new Array(R).fill(0), acc = new Array(R).fill(0), arr = new Array(R).fill(0);
      let stay = 0, nextRetry = 0;
      for (let k = 0; k < n; k++) {
        const u = rnd(); let c = 0; while (c < R && u > cum[c]) c++;
        if (c >= R) { stay++; continue; }
        f[c]++;
        if (s.blocked && c === P.block && rnd() < CATCH * st) { back[c]++; if (rnd() < RETRY) nextRetry++; continue; }
        if (rnd() < ROUTES[c].risk / 100) acc[c]++; else arr[c]++;
      }
      for (let i = 0; i < R; i++) s.perc[i] = EMA * s.perc[i] + (1 - EMA) * f[i];
      s.retry = nextRetry;
      const tot = f.reduce((x, y) => x + y, 0), rk = f.reduce((x, v, i) => x + (ROUTES[i].risk >= RISKY ? v : 0), 0);
      const nb = back.reduce((x, y) => x + y, 0);
      s.flow.push(f); s.back.push(nb); s.acc.push(acc.reduce((x, y) => x + y, 0)); s.arr.push(arr.reduce((x, y) => x + y, 0));
      s.risky.push(tot ? rk / tot : 0); s.cost.push(s.blocked ? 100 * st + nb : 0); s.deciders.push(n); s.stay.push(stay);
      s.blockedAt.push(s.blocked);
      s.t++; if (s.t >= P.months) s.done = true;
      return true;
    };
    s.run = function () { while (s.step()); return s; };
    // 구간 평균 (달 a 이상 b 미만)
    s.avg = function (a, b) {
      b = Math.min(b, s.t); const n = Math.max(1, b - a), sum = (arr) => arr.slice(a, b).reduce((x, y) => x + y, 0) / n;
      const fl = ROUTES.map((_, i) => s.flow.slice(a, b).reduce((x, f) => x + f[i], 0) / n), tot = fl.reduce((x, y) => x + y, 0);
      const rk = fl.reduce((x, v, i) => x + (ROUTES[i].risk >= RISKY ? v : 0), 0);
      return { flow: fl, tries: tot, risky: tot ? rk / tot : 0, arr: sum(s.arr), acc: sum(s.acc), back: sum(s.back), cost: sum(s.cost), deciders: sum(s.deciders) };
    };
    return s;
  }

  // 여러 판의 평균: 막기 전(12~23달)과 막은 뒤(48~71달)
  function sweep(opt, runs) {
    const keys = ['tries', 'risky', 'arr', 'acc', 'back', 'cost', 'deciders'], pre = {}, post = {}, flowPre = ROUTES.map(() => 0), flowPost = ROUTES.map(() => 0);
    keys.forEach((k) => { pre[k] = 0; post[k] = 0; });
    for (let r = 0; r < runs; r++) {
      const s = create(Object.assign({}, opt, { seed: (opt.seed || 1) * 1000 + r })).run(), M = s.params.months;
      const a = s.avg(12, 24), b = s.avg(M - 24, M);
      keys.forEach((k) => { pre[k] += a[k] / runs; post[k] += b[k] / runs; });
      a.flow.forEach((v, i) => { flowPre[i] += v / runs; }); b.flow.forEach((v, i) => { flowPost[i] += v / runs; });
    }
    pre.flow = flowPre; post.flow = flowPost;
    return { pre, post };
  }

  return { ROUTES, RISKY, DEFAULTS, create, sweep, mulberry32 };
});
