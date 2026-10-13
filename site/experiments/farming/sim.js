/*
 * 농경은 어떻게 퍼졌을까: 전진하는 파동(wave of advance) 모델
 * 이 프로젝트의 단순화된 구현이다 (추상적인 지도, 실제 대륙을 재현하지 않는다).
 * 아이디어: Fisher (1937) "The wave of advance of advantageous genes", Annals of Eugenics 7, 355-369;
 *           Ammerman & Cavalli-Sforza (1971), "Measuring the rate of spread of early farming in Europe", Man 6, 674-688.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 격자(셀 하나 = dx km). 각 셀의 농부 밀도 F (땅이 감당하는 최대치 = 1), 수렵채집민 밀도 H (처음에 어디나 h0 = 0.25).
 *  - 농부: 로지스틱 성장(율 r, 1/년) + 확산(계수 D, km²/년)   dF/dt = r F (1 - F) + D ∇²F + (토착민 흡수)
 *  - 수렵채집민은 움직이지 않는다. 농부가 있는 곳에서 비율 kappa·F 로 사라진다.
 *    사라진 양의 mix 만큼은 농부가 되고(흡수·동화), 나머지(1-mix)는 밀려나 사라진다(대체).
 *  - 이론값(Fisher-Kolmogorov): 흡수가 없을 때 전선 속도 c = 2·sqrt(r·D).
 *    흡수가 있으면 전선 앞에서 농부가 늘어나는 비율이 r + mix·kappa·h0 로 커지므로 c = 2·sqrt((r + mix·kappa·h0)·D).
 *  - G: 농부 가운데 '토착 수렵채집민 혈통'인 몫 (같은 규칙을 따르는 꼬리표 집단).
 *  - 지형: 해협(좁은 땅다리 하나를 빼고 바다), 산맥(성장·확산이 느린 띠).
 *  - 칸마다 땅의 기름짐이 조금씩 다르다(시드 난수). 같은 시드면 같은 결과.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Farming = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { r: 0.025, D: 10, mix: 0.5, barrier: 'none', patch: 0.25, seed: 1,
    nx: 100, ny: 60, dx: 10, dt: 0.5, kappa: 0.05, h0: 0.25, tmax: 2400, thr: 0.5,
    ox: 4, oy: 30, originR: 25 };
  const BAR = { x0: 50, x1: 54, gapA: 7, gapB: 19, mx0: 48, mx1: 60, mD: 0.25, mR: 0.5 }; // 해협: 열 50~53, 땅다리 행 7~18 / 산맥: 열 48~59

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const effRate = (p) => p.r + p.mix * p.kappa * p.h0;
  const speedBase = (p) => 2 * Math.sqrt(p.r * p.D);           // Fisher-Kolmogorov: 2 sqrt(rD)
  const speedEff = (p) => 2 * Math.sqrt(effRate(p) * p.D);       // 토착민 흡수를 반영한 값

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts), nx = p.nx, ny = p.ny, N = nx * ny, dx = p.dx;
    const rnd = mulberry32(p.seed * 7919 + 13);
    const land = new Uint8Array(N).fill(1), dm = new Float64Array(N).fill(1), rm = new Float64Array(N).fill(1);
    // 땅의 기름짐: 성긴 값 잡음을 부드럽게 이어서 (평균 1, 진폭 patch)
    if (p.patch > 0) {
      const gx = 11, gy = 7, g = []; for (let k = 0; k < gx * gy; k++) g.push(rnd() * 2 - 1);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const u = (i / (nx - 1)) * (gx - 1), v = (j / (ny - 1)) * (gy - 1), i0 = Math.min(gx - 2, Math.floor(u)), j0 = Math.min(gy - 2, Math.floor(v)), a = u - i0, b = v - j0;
        const val = g[j0 * gx + i0] * (1 - a) * (1 - b) + g[j0 * gx + i0 + 1] * a * (1 - b) + g[(j0 + 1) * gx + i0] * (1 - a) * b + g[(j0 + 1) * gx + i0 + 1] * a * b;
        rm[j * nx + i] = 1 + p.patch * val;
      }
    }
    if (p.barrier === 'sea') for (let j = 0; j < ny; j++) for (let i = BAR.x0; i < BAR.x1; i++) if (j < BAR.gapA || j >= BAR.gapB) { land[j * nx + i] = 0; }
    if (p.barrier === 'mountain') for (let j = 0; j < ny; j++) for (let i = BAR.mx0; i < BAR.mx1; i++) { dm[j * nx + i] = BAR.mD; rm[j * nx + i] *= BAR.mR; }

    let F = new Float64Array(N), H = new Float64Array(N), G = new Float64Array(N), F2 = new Float64Array(N), H2 = new Float64Array(N), G2 = new Float64Array(N);
    const T = new Float32Array(N).fill(Infinity), ox = (p.ox + 0.5) * dx, oy = (p.oy + 0.5) * dx;
    let landCount = 0;
    for (let k = 0; k < N; k++) if (land[k]) { landCount++; H[k] = p.h0; }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, d = Math.hypot((i + 0.5) * dx - ox, (j + 0.5) * dx - oy);
      if (land[k] && d <= p.originR) { F[k] = 1; H[k] = 0; T[k] = 0; }
    }
    const dist = new Float32Array(N); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) dist[j * nx + i] = Math.hypot((i + 0.5) * dx - ox, (j + 0.5) * dx - oy);

    const sim = { params: p, nx, ny, dx, land, dm, rm, T, dist, t: 0, landCount, ox, oy, assimilated: 0,
      hist: { t: [0], R: [p.originR], cover: [0], gShare: [0], hLeft: [1] }, reached: 0, Rmax: p.originR };
    for (let k = 0; k < N; k++) if (T[k] === 0) sim.reached++;
    Object.defineProperty(sim, 'F', { get: () => F }); Object.defineProperty(sim, 'H', { get: () => H }); Object.defineProperty(sim, 'G', { get: () => G });

    function step() {
      const dt = p.dt, inv = p.D / (dx * dx), r = p.r, kap = p.kappa, mix = p.mix;
      let ass = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i; if (!land[k]) continue;
        const f = F[k], h = H[k], g = G[k], dk = dm[k];
        let lf = 0, lg = 0;
        if (i > 0 && land[k - 1]) { const d = 2 * dk * dm[k - 1] / (dk + dm[k - 1]); lf += d * (F[k - 1] - f); lg += d * (G[k - 1] - g); }
        if (i < nx - 1 && land[k + 1]) { const d = 2 * dk * dm[k + 1] / (dk + dm[k + 1]); lf += d * (F[k + 1] - f); lg += d * (G[k + 1] - g); }
        if (j > 0 && land[k - nx]) { const d = 2 * dk * dm[k - nx] / (dk + dm[k - nx]); lf += d * (F[k - nx] - f); lg += d * (G[k - nx] - g); }
        if (j < ny - 1 && land[k + nx]) { const d = 2 * dk * dm[k + nx] / (dk + dm[k + nx]); lf += d * (F[k + nx] - f); lg += d * (G[k + nx] - g); }
        const growth = rm[k] * r * f * (1 - f), conv = kap * f * h * dt, frac = f > 1e-12 ? g / f : 0;
        let nf = f + dt * (growth + lf * inv) + mix * conv;
        let ng = g + dt * (growth * frac + lg * inv) + mix * conv;
        if (nf < 0) nf = 0; if (ng < 0) ng = 0; if (ng > nf) ng = nf;
        F2[k] = nf; G2[k] = ng; H2[k] = h - conv; ass += mix * conv;
        if (f < p.thr && nf >= p.thr && T[k] === Infinity) {
          T[k] = sim.t + dt * (p.thr - f) / (nf - f); sim.reached++;
          if (dist[k] > sim.Rmax) sim.Rmax = dist[k];
        }
      }
      let tmp = F; F = F2; F2 = tmp; tmp = G; G = G2; G2 = tmp; tmp = H; H = H2; H2 = tmp;
      sim.assimilated += ass; sim.t += dt;
    }
    sim.step = step;

    function record() {
      let sf = 0, sg = 0, sh = 0;
      for (let k = 0; k < N; k++) if (land[k]) { sf += F[k]; sg += G[k]; sh += H[k]; }
      const hs = sim.hist; hs.t.push(sim.t); hs.R.push(sim.Rmax); hs.cover.push(sim.reached / landCount);
      hs.gShare.push(sf > 0 ? sg / sf : 0); hs.hLeft.push(sh / (p.h0 * landCount));
      sim.farmers = sf; sim.tagged = sg;
    }
    sim.record = record;
    sim.done = () => sim.t >= p.tmax || sim.reached >= landCount * 0.999;
    // years 만큼 진행 (한 번 부를 때 기록 1개). 끝났으면 false
    sim.advance = function (years) {
      if (sim.done()) return false;
      const n = Math.max(1, Math.round((years || 5) / p.dt));
      for (let s = 0; s < n && !sim.done(); s++) step();
      record(); return true;
    };
    sim.run = function (years) { while (sim.advance(years || 5)); return sim; };

    // 측정한 전선 속도(km/년): R(t) 가 [lo, hi] km 사이에 있는 구간의 기울기 (최소제곱)
    sim.speed = function (lo, hi) {
      lo = lo == null ? 100 : lo; hi = hi == null ? 380 : hi;
      const hs = sim.hist; let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let i = 0; i < hs.t.length; i++) if (hs.R[i] >= lo && hs.R[i] <= hi) { n++; sx += hs.t[i]; sy += hs.R[i]; sxx += hs.t[i] * hs.t[i]; sxy += hs.t[i] * hs.R[i]; }
      if (n < 4 || hs.R[hs.R.length - 1] < lo + 60) return null;
      const den = n * sxx - sx * sx; return den > 0 ? (n * sxy - sx * sy) / den : null;
    };
    // 어느 줄(행)에서 열 구간 [c0, c1) 을 지나는 데 걸린 시간으로 구한 속도 (km/년)
    sim.rowSpeed = function (row, c0, c1) {
      const a = T[row * nx + c0], b = T[row * nx + c1];
      return isFinite(a) && isFinite(b) && b > a ? ((c1 - c0) * dx) / (b - a) : null;
    };
    record();
    return sim;
  }

  // 한 줄(1차원) 평면 파동으로 속도를 잰다 (성장률·확산 훑어보기용). 속도 km/년
  function speed1D(opts) {
    const p = Object.assign({}, DEFAULTS, opts, { nx: 170, ny: 1, patch: 0, barrier: 'none', oy: 0, ox: 0, originR: 12 });
    const s = create(p); let guard = 0;
    while (!s.done() && s.Rmax < 1560 && guard++ < 100000) s.advance(10);
    // 도착 시각 T 와 거리의 최소제곱 (400~1500 km)
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < s.nx; i++) { const x = (i + 0.5) * s.dx, t = s.T[i]; if (x >= 400 && x <= 1500 && isFinite(t)) { n++; sx += x; sy += t; sxx += x * x; sxy += x * t; } }
    if (n < 5) return null;
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); // 년/km
    return 1 / slope;
  }

  return { DEFAULTS, BAR, create, speed1D, speedBase, speedEff, effRate };
});
