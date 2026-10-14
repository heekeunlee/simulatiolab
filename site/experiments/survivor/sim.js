/*
 * 생존자 편향: 돌아온 비행기의 총탄 자국 (에이브러햄 월드 일화를 단순화한 이 프로젝트의 모델)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙
 *  - 비행기 윗면 그림 하나를 다섯 부위(엔진, 조종석, 동체, 날개, 꼬리)로 나눈다. 부위의 넓이는 그림에서 직접 계산한다
 *  - 출격 한 번마다 총탄이 평균 hits개(푸아송) 맞고, 각 총탄은 비행기 위 무작위 한 점에 떨어진다 (넓은 부위가 더 많이 맞는다)
 *  - 부위 s에 맞은 총탄 하나가 비행기를 추락시킬 확률은 LETHAL[s] (엔진 값은 슬라이더, 나머지는 고정)
 *  - 추락하지 않은 비행기만 돌아와 검사를 받는다: 돌아온 비행기의 구멍만 보인다
 *  - 장갑을 댄 부위에 맞은 총탄은 armor 확률로 막힌다. 같은 총탄·같은 운으로 장갑 유무만 비교한다(짝지은 비교)
 *  - 이론값: 출격당 생존 확률 = exp(-hits × Σ 넓이비율[s] × 치명률[s] × (장갑이면 1-armor))
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Survivor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NAMES = ['엔진', '조종석', '동체', '날개', '꼬리'];
  const DEFAULTS = { n: 2000, eng: 0.5, budget: 2, hits: 3, armor: 0.7, seed: 1 };
  const LETHAL = [0.5, 0.4, 0.05, 0.03, 0.05]; // 엔진은 eng로 바뀐다

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 비행기 그림 (0~1 정사각형, 위쪽이 기수). 화면의 도형과 같은 식을 쓴다
  const ENG = [[0.27, 0.40], [0.73, 0.40]], ENG_RX = 0.06, ENG_RY = 0.10;
  const COCK = [0.5, 0.17], COCK_RX = 0.075, COCK_RY = 0.085;
  const FUS = { x0: 0.44, x1: 0.56, y0: 0.10, y1: 0.78 };
  const TAIL = { x0: 0.30, x1: 0.70, y0: 0.78, y1: 0.90 };
  function wingPoly(side) { // side = 1 오른쪽, -1 왼쪽
    const c = 0.5, p = (d, y) => [c + side * d, y];
    return [p(0.06, 0.30), p(0.46, 0.44), p(0.46, 0.61), p(0.06, 0.47)];
  }
  function sectionAt(x, y) {
    for (const [cx, cy] of ENG) if (((x - cx) / ENG_RX) ** 2 + ((y - cy) / ENG_RY) ** 2 <= 1) return 0;
    if (((x - COCK[0]) / COCK_RX) ** 2 + ((y - COCK[1]) / COCK_RY) ** 2 <= 1) return 1;
    if (x >= TAIL.x0 && x <= TAIL.x1 && y >= TAIL.y0 && y <= TAIL.y1) return 4;
    if (x >= FUS.x0 && x <= FUS.x1 && y >= FUS.y0 && y < FUS.y1) return 2;
    const d = Math.abs(x - 0.5);
    if (d >= 0.06 && d <= 0.46) { const top = 0.30 + 0.35 * (d - 0.06); if (y >= top && y <= top + 0.17) return 3; }
    return -1;
  }
  // 부위별 넓이 비율 (격자로 계산)
  const AREA = (function () {
    const G = 400, c = [0, 0, 0, 0, 0]; let tot = 0;
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const s = sectionAt((i + 0.5) / G, (j + 0.5) / G); if (s >= 0) { c[s]++; tot++; } }
    return c.map((v) => v / tot);
  })();

  const lethality = (eng) => LETHAL.map((v, i) => (i === 0 ? eng : v));
  const poisson = (rng, lam) => { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; };
  const combos = (k) => { const out = []; (function rec(s, cur) { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = s; i < 5; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); } })(0, []); return out; };

  // 이론 생존 확률 (장갑 집합 arm: 부위 번호 배열)
  function theory(p, arm) {
    const L = lethality(p.eng); let sum = 0;
    for (let s = 0; s < 5; s++) sum += AREA[s] * L[s] * (arm.indexOf(s) >= 0 ? 1 - p.armor : 1);
    return Math.exp(-p.hits * sum);
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts), rng = mulberry32(p.seed * 7919 + 11), L = lethality(p.eng);
    const N = p.n, start = new Int32Array(N + 1), hs = [], hx = [], hy = [], hu = [], hv = [];
    const down = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      start[i] = hs.length;
      const k = poisson(rng, p.hits);
      for (let q = 0; q < k; q++) {
        let x, y, s;
        do { x = rng(); y = rng(); s = sectionAt(x, y); } while (s < 0);
        const u = rng(), v = rng();
        hs.push(s); hx.push(x); hy.push(y); hu.push(u); hv.push(v);
        if (u < L[s]) down[i] = 1;
      }
    }
    start[N] = hs.length;

    const sim = {
      params: p, L, area: AREA, round: 0, returned: 0, lost: 0,
      holesRet: [0, 0, 0, 0, 0], holesAll: [0, 0, 0, 0, 0],
      hits: { s: hs, x: hx, y: hy, start, down },
      advance() {
        if (sim.round >= N) return false;
        const i = sim.round++;
        if (down[i]) sim.lost++; else sim.returned++;
        for (let q = start[i]; q < start[i + 1]; q++) { sim.holesAll[hs[q]]++; if (!down[i]) sim.holesRet[hs[q]]++; }
        return true;
      },
      done() { return sim.round >= N; },
      run() { while (sim.advance()); return sim; },
      // 전체 출격 기준 결과 (애니메이션 진행과 무관)
      totals(upTo) {
        const M = upTo == null ? N : Math.min(N, upTo);
        const all = [0, 0, 0, 0, 0], ret = [0, 0, 0, 0, 0]; let r = 0;
        for (let i = 0; i < M; i++) { if (!down[i]) r++; for (let q = start[i]; q < start[i + 1]; q++) { all[hs[q]]++; if (!down[i]) ret[hs[q]]++; } }
        return { all, ret, returned: r };
      },
      // 장갑을 댄 부위 arm에서의 생존율 (같은 총탄, 같은 운)
      survival(arm, upTo) {
        const M = upTo == null ? N : Math.min(N, upTo);
        const a = [0, 0, 0, 0, 0]; arm.forEach((s) => { a[s] = 1; });
        let ok = 0;
        for (let i = 0; i < M; i++) {
          let dead = false;
          for (let q = start[i]; q < start[i + 1]; q++) { const s = hs[q]; if (hu[q] < L[s] && !(a[s] && hv[q] < p.armor)) { dead = true; break; } }
          if (!dead) ok++;
        }
        return M ? ok / M : 0;
      },
      // 직관: 구멍이 가장 많은 부위, 월드: 넓이 대비 구멍이 가장 적은 부위, 최선: 모든 조합 중 이론 생존율이 가장 높은 조합
      picks(k, upTo) {
        const t = sim.totals(upTo), idx = [0, 1, 2, 3, 4];
        const intuitive = idx.slice().sort((a, b) => t.ret[b] - t.ret[a] || a - b).slice(0, k).sort();
        const wald = idx.slice().sort((a, b) => t.ret[a] / AREA[a] - t.ret[b] / AREA[b] || a - b).slice(0, k).sort();
        let best = null, bv = -1; combos(k).forEach((c) => { const v = theory(p, c); if (v > bv) { bv = v; best = c; } });
        return { intuitive, wald, best };
      },
    };
    return sim;
  }

  // 모양을 그리지 않는 빠른 결과 (스윕과 검증용)
  function study(opts) {
    const sim = create(opts), p = sim.params, pk = sim.picks(p.budget), t = sim.totals();
    return {
      none: sim.survival([]), intuitive: sim.survival(pk.intuitive), wald: sim.survival(pk.wald), best: sim.survival(pk.best),
      picks: pk, returnedShare: t.returned / p.n,
      visible: t.all.map((v, i) => (v ? t.ret[i] / v : 0)),
      theory: { none: theory(p, []), intuitive: theory(p, pk.intuitive), wald: theory(p, pk.wald), best: theory(p, pk.best) },
    };
  }

  return { NAMES, DEFAULTS, LETHAL, AREA, lethality, theory, create, study, combos, sectionAt, wingPoly, ENG, ENG_RX, ENG_RY, COCK, COCK_RX, COCK_RY, FUS, TAIL };
});
