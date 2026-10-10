/*
 * Talent vs Luck 모델 (Pluchino, Biondo, Rapisarda 2018)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙 (논문 2장)
 *  - 에이전트 N명은 201x201 토러스 위의 고정된 칸에 놓이고, 재능은 N(mT, sT)를 [0,1]로 잘라 사용
 *  - 행운/불운 이벤트 NE개가 매 스텝(6개월) 임의 방향으로 2칸씩 이동 (이벤트는 사라지지 않음)
 *  - 에이전트 반경 1칸 안에 이벤트가 있으면
 *      행운: rand < 재능 일 때 자본 x2
 *      불운: 재능과 무관하게 자본 /2
 *  - 한 스텝에 이벤트 여러 개와 겹치면 모두 순서대로 적용 (논문에 명시가 없어 택한 해석)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TalentLuck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = {
    n: 1000, meanT: 0.6, sdT: 0.1, c0: 10,
    events: 500, pLucky: 0.5, years: 40,
    seed: 1, world: 201, moveDist: 2, radius: 1,
  };

  // 로그 코드: 1 = 행운을 잡음, 2 = 행운이 왔지만 놓침, 3 = 불운
  const LUCKY_USED = 1, LUCKY_MISSED = 2, UNLUCKY = 3;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rng) {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed);
    const W = p.world, n = p.n, ne = p.events;
    const steps = Math.round(p.years * 2);

    const ax = new Float64Array(n), ay = new Float64Array(n);
    const talent = new Float64Array(n);
    const capital = new Float64Array(n).fill(p.c0);
    const nLucky = new Uint16Array(n), nUnlucky = new Uint16Array(n);
    const log = Array.from({ length: n }, () => []);
    const history = new Float64Array((steps + 1) * n).fill(p.c0);

    // 칸별 에이전트 목록 (연결 리스트)
    const head = new Int32Array(W * W).fill(-1), next = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      ax[i] = Math.floor(rng() * W);
      ay[i] = Math.floor(rng() * W);
      let t;
      do { t = p.meanT + p.sdT * gauss(rng); } while (t < 0 || t > 1);
      talent[i] = t;
      const cell = ay[i] * W + ax[i];
      next[i] = head[cell];
      head[cell] = i;
    }

    const ex = new Float64Array(ne), ey = new Float64Array(ne), lucky = new Uint8Array(ne);
    for (let k = 0; k < ne; k++) {
      ex[k] = rng() * W;
      ey[k] = rng() * W;
      lucky[k] = rng() < p.pLucky ? 1 : 0;
    }

    const r2 = p.radius * p.radius;
    const wrap = (v) => ((v % W) + W) % W;
    const tdist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, W - d); };

    const sim = {
      params: p, steps, step: 0, n, talent, capital, ax, ay, ex, ey, lucky,
      nLucky, nUnlucky, log, history,

      advance() {
        if (sim.step >= steps) return false;
        const t = ++sim.step;
        for (let k = 0; k < ne; k++) {
          const ang = rng() * 2 * Math.PI;
          ex[k] = wrap(ex[k] + p.moveDist * Math.cos(ang));
          ey[k] = wrap(ey[k] + p.moveDist * Math.sin(ang));
          const cx = Math.floor(ex[k]), cy = Math.floor(ey[k]);
          for (let dy = -1; dy <= 2; dy++) {
            for (let dx = -1; dx <= 2; dx++) {
              for (let i = head[wrap(cy + dy) * W + wrap(cx + dx)]; i !== -1; i = next[i]) {
                const ddx = tdist(ax[i], ex[k]), ddy = tdist(ay[i], ey[k]);
                if (ddx * ddx + ddy * ddy > r2) continue;
                if (lucky[k]) {
                  nLucky[i]++;
                  if (rng() < talent[i]) { capital[i] *= 2; log[i].push(t, LUCKY_USED); }
                  else log[i].push(t, LUCKY_MISSED);
                } else {
                  nUnlucky[i]++;
                  capital[i] /= 2;
                  log[i].push(t, UNLUCKY);
                }
              }
            }
          }
        }
        history.set(capital, t * n);
        return true;
      },

      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 현재 상태 요약 통계
  function stats(sim) {
    const { n, talent, capital } = sim;
    const c0 = sim.params.c0;
    const byCap = Array.from({ length: n }, (_, i) => i).sort((a, b) => capital[b] - capital[a]);
    const byTal = Array.from({ length: n }, (_, i) => i).sort((a, b) => talent[b] - talent[a]);
    let total = 0;
    for (let i = 0; i < n; i++) total += capital[i];
    const top20 = Math.round(n * 0.2);
    let top20sum = 0;
    for (let r = 0; r < top20; r++) top20sum += capital[byCap[r]];

    const talRank = new Int32Array(n);
    byTal.forEach((idx, r) => { talRank[idx] = r; });
    const topK = Math.min(10, n);
    const decile = Math.ceil(n * 0.1);
    let richInTopDecile = 0;
    for (let r = 0; r < topK; r++) if (talRank[byCap[r]] < decile) richInTopDecile++;

    let below = 0, sumT = 0;
    for (let i = 0; i < n; i++) { if (capital[i] < c0) below++; sumT += talent[i]; }

    return {
      richest: byCap[0], mostTalented: byTal[0], byCap, byTal,
      richestTalent: talent[byCap[0]], richestCapital: capital[byCap[0]],
      meanTalent: sumT / n,
      mostTalentedCapital: capital[byTal[0]], mostTalentedTalent: talent[byTal[0]],
      top20Share: top20sum / total,
      belowInitial: below / n,
      richInTopDecile, // 상위 10명 부자 중 재능 상위 10%에 드는 사람 수
      richestVsAvgTalentCapital: capital[byCap[0]] / (total / n),
    };
  }

  // 시드를 바꿔가며 여러 번 돌려 요약
  function batch(opts, runs, onEach) {
    const base = Object.assign({}, DEFAULTS, opts);
    const out = [];
    for (let k = 0; k < runs; k++) {
      const s = stats(create(Object.assign({}, base, { seed: base.seed + 1000 + k })).run());
      out.push({
        richestTalent: s.richestTalent, top20Share: s.top20Share,
        richInTopDecile: s.richInTopDecile, mostTalentedCapital: s.mostTalentedCapital,
        richestIsTopTalent: s.richest === s.mostTalented,
        maxTalent: s.mostTalentedTalent,
      });
      if (onEach) onEach(k + 1, runs);
    }
    return out;
  }

  return { DEFAULTS, LUCKY_USED, LUCKY_MISSED, UNLUCKY, create, stats, batch };
});
