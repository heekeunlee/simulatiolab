/*
 * 모래더미 모델 (Bak-Tang-Wiesenfeld 모래더미의 이 프로젝트 구현). 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 * 격자 size x size. 한 번에 한 알을 한 칸에 떨어뜨리고(무작위 칸 또는 가운데 칸),
 * 알이 4개 이상 쌓인 칸은 무너져서 위·아래·왼쪽·오른쪽 이웃에게 한 알씩 나눠 준다(칸에서 4알이 줄어든다).
 * 이웃도 4알이 되면 이어서 무너진다(연쇄). 가장자리 밖으로 나간 알은 사라진다.
 * 눈사태의 크기 = 알 하나를 떨어뜨린 뒤 일어난 무너짐(칸이 4알을 나눠 준 횟수)의 총합. 무너진 칸이 없으면 0.
 * 무너지는 순서는 결과(최종 모양, 무너짐 횟수)에 영향을 주지 않는다(아벨 성질).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sandpile = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { size: 40, mode: 'random', seed: 1, burn: 3 }; // burn: 안정기로 보는 기준 = burn x size^2 번째 알 이후

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts), N = p.size, NN = N * N, rnd = mulberry32(p.seed * 7919 + N);
    const h = new Uint8Array(NN), stamp = new Int32Array(NN).fill(-1000000000), stack = new Int32Array(NN + 8);
    const sim = { params: p, N, h, stamp, t: 0, total: 0, sizes: [], means: [], cnt: [], burnAt: Math.ceil(p.burn * NN), lastSize: 0, lastSite: -1, lost: 0, maxSize: 0, nz: 0, post: 0 };
    sim.site = () => (p.mode === 'center' ? (N >> 1) * N + (N >> 1) : Math.floor(rnd() * NN));
    // 알 하나를 떨어뜨리고 눈사태 크기를 돌려준다
    sim.drop = (site) => {
      const i0 = site == null ? sim.site() : site;
      const tNow = sim.t;
      h[i0]++; sim.total++;
      let sp = 0, size = 0;
      if (h[i0] >= 4) stack[sp++] = i0;
      while (sp > 0) {
        const i = stack[--sp];
        const k = h[i] >> 2;
        if (!k) continue;
        h[i] -= 4 * k; size += k; stamp[i] = tNow;
        const x = i % N, y = (i - x) / N;
        // 이웃 네 칸. 밖으로 나가면 알이 사라진다
        if (x > 0) { if ((h[i - 1] += k) >= 4 && h[i - 1] - k < 4) stack[sp++] = i - 1; } else { sim.total -= k; sim.lost += k; }
        if (x < N - 1) { if ((h[i + 1] += k) >= 4 && h[i + 1] - k < 4) stack[sp++] = i + 1; } else { sim.total -= k; sim.lost += k; }
        if (y > 0) { if ((h[i - N] += k) >= 4 && h[i - N] - k < 4) stack[sp++] = i - N; } else { sim.total -= k; sim.lost += k; }
        if (y < N - 1) { if ((h[i + N] += k) >= 4 && h[i + N] - k < 4) stack[sp++] = i + N; } else { sim.total -= k; sim.lost += k; }
        if (h[i] >= 4) stack[sp++] = i; // (k알씩 한꺼번에 처리하므로 보통은 해당 없음)
      }
      sim.sizes.push(size); sim.means.push(sim.total / NN);
      sim.t++; sim.lastSize = size; sim.lastSite = i0;
      if (sim.t > sim.burnAt) { // 안정기 이후의 눈사태만 분포에 센다
        sim.post++;
        if (size === 0) sim.zero = (sim.zero || 0) + 1;
        else { sim.cnt[size] = (sim.cnt[size] || 0) + 1; sim.nz++; if (size > sim.maxSize) sim.maxSize = size; }
      }
      return size;
    };
    sim.advance = () => { sim.drop(); return true; };
    sim.zero = 0;
    sim.mean = () => sim.total / NN;
    sim.heightShares = () => { const c = [0, 0, 0, 0]; for (let i = 0; i < NN; i++) c[h[i]]++; return c.map((v) => v / NN); };
    // 안정기 이후 눈사태(0 제외)의 중앙값
    sim.median = () => {
      if (!sim.nz) return 0;
      let acc = 0; const half = sim.nz / 2;
      for (let s = 1; s <= sim.maxSize; s++) { acc += sim.cnt[s] || 0; if (acc >= half) return s; }
      return sim.maxSize;
    };
    // 로그 간격 묶음(약 1.5배씩 넓어짐)의 확률밀도와 최소제곱 기울기. 표본 수가 10 이상인 묶음만 맞춘다
    sim.dist = () => {
      const pts = []; if (sim.nz < 30) return { pts, slope: null, n: sim.nz };
      let lo = 1;
      while (lo <= sim.maxSize) {
        const hi = Math.max(lo + 1, Math.round(lo * 1.5)); // [lo, hi)
        let c = 0; for (let s = lo; s < hi && s <= sim.maxSize; s++) c += sim.cnt[s] || 0;
        if (c > 0) pts.push({ lo, hi, n: c, x: Math.sqrt(lo * (hi - 1 || lo)), y: c / (hi - lo) / sim.nz });
        lo = hi;
      }
      const use = pts.filter((q) => q.n >= 10 && q.lo >= 1);
      let slope = null, icpt = null;
      if (use.length >= 3) {
        const xs = use.map((q) => Math.log10(q.x)), ys = use.map((q) => Math.log10(q.y)), m = xs.length;
        const mx = xs.reduce((a, b) => a + b, 0) / m, my = ys.reduce((a, b) => a + b, 0) / m;
        let sxy = 0, sxx = 0; for (let i = 0; i < m; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
        slope = sxy / sxx; icpt = my - slope * mx;
      }
      return { pts, slope, icpt, n: sim.nz, used: use.length ? [use[0].x, use[use.length - 1].x] : null };
    };
    return sim;
  }

  return { DEFAULTS, create };
});
