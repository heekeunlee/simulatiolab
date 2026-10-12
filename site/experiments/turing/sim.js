/*
 * 얼룩말 무늬는 어떻게 생길까: 그레이-스콧(Gray-Scott) 반응-확산 모델
 * 영감: Turing (1952) "The chemical basis of morphogenesis", Pearson (1993) "Complex patterns in a simple system"
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조 (size x size 격자, 가장자리는 반대편과 이어짐)
 *  - 두 물질 u(먹이), v(무늬를 만드는 물질)이 있다. u는 계속 공급되고, v는 u를 먹고 늘어나며 서서히 사라진다
 *      du = Du * lap(u) - u*v*v + F * (1 - u)
 *      dv = Dv * lap(v) + u*v*v - (F + k) * v
 *    (Du = 0.16, Dv = 0.08, 한 단계 dt = 1, lap은 상하좌우 4칸으로 계산)
 *  - F(공급 속도)와 k(제거 속도) 두 숫자만 바꿔도 점, 줄무늬, 세포 분열, 산호 같은 전혀 다른 무늬가 생긴다
 *  - 처음엔 u=1, v=0이고, 12군데에 v를 조금 뿌려 놓는다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Turing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PRESETS = {
    spots:   { F: 0.035,  k: 0.065 },
    stripes: { F: 0.029,  k: 0.057 },
    mitosis: { F: 0.0367, k: 0.0649 },
    coral:   { F: 0.0545, k: 0.062 },
  };
  const DEFAULTS = { size: 96, F: 0.035, k: 0.065, Du: 0.16, Dv: 0.08, seed: 1, seeds: 12 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 211 + 5), S = p.size, N = S * S;
    let u = new Float32Array(N).fill(1), v = new Float32Array(N), u2 = new Float32Array(N), v2 = new Float32Array(N);

    function drop(cx, cy, r) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = (cx + dx + S) % S, y = (cy + dy + S) % S, i = y * S + x;
        u[i] = 0.5 + 0.02 * (rng() - 0.5); v[i] = 0.25 + 0.02 * (rng() - 0.5);
      }
    }
    for (let s = 0; s < p.seeds; s++) drop(Math.floor(rng() * S), Math.floor(rng() * S), 4 + Math.floor(rng() * 3));

    const sim = {
      params: p, size: S, iter: 0, history: [],
      get u() { return u; }, get v() { return v; },
      drop,
      // iters번 반응-확산을 진행
      advance(iters) {
        const n = iters || 40, F = p.F, K = p.k, Du = p.Du, Dv = p.Dv;
        for (let t = 0; t < n; t++) {
          for (let y = 0; y < S; y++) {
            const ym = ((y + S - 1) % S) * S, y0 = y * S, yp = ((y + 1) % S) * S;
            for (let x = 0; x < S; x++) {
              const xm = x === 0 ? S - 1 : x - 1, xp = x === S - 1 ? 0 : x + 1, i = y0 + x;
              const uc = u[i], vc = v[i], uvv = uc * vc * vc;
              const lu = u[y0 + xm] + u[y0 + xp] + u[ym + x] + u[yp + x] - 4 * uc;
              const lv = v[y0 + xm] + v[y0 + xp] + v[ym + x] + v[yp + x] - 4 * vc;
              u2[i] = uc + Du * lu - uvv + F * (1 - uc);
              v2[i] = vc + Dv * lv + uvv - (F + K) * vc;
            }
          }
          let tmp = u; u = u2; u2 = tmp; tmp = v; v = v2; v2 = tmp;
        }
        sim.iter += n;
        sim.history.push(sim.stats());
        return true;
      },
      stats() {
        let s = 0, ss = 0, area = 0, finite = true;
        for (let i = 0; i < N; i++) { const x = v[i]; if (!(x === x) || x > 10 || x < -1) finite = false; s += x; ss += x * x; if (x > 0.2) area++; }
        const m = s / N;
        return { vMean: m, contrast: Math.sqrt(Math.max(0, ss / N - m * m)), area: area / N, finite };
      },
    };
    sim.history.push(sim.stats());
    return sim;
  }

  // 지정한 횟수만큼 돌려 무늬가 자리 잡은 뒤의 통계
  function settle(opts, iters) {
    const s = create(opts); s.advance(iters); return s.stats();
  }

  return { PRESETS, DEFAULTS, create, settle };
});
