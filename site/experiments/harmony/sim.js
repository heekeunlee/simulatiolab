/*
 * 어떤 두 음은 왜 편하고 어떤 두 음은 왜 거슬릴까: 배음의 거칠기(맥놀이) 모델
 * 이 프로젝트의 단순화된 구현이다 (실제 음악 취향이나 문화 차이를 다루지 않는다).
 * 아이디어: Plomp & Levelt (1965), "Tonal consonance and critical bandwidth", J. Acoust. Soc. Am. 38;
 *           Sethares (1993), "Local consonance and the relationship between timbre and scale", J. Acoust. Soc. Am. 94.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 *  - 음 하나 = 기본 진동수 f 와 그 정수배(배음) f, 2f, 3f … Nf. k번째 배음의 세기는 0.88^(k-1) (음색 #1).
 *    다른 음색(#2 이후)은 시드 난수(mulberry32)로 배음 세기를 0.15~1 사이에서 뽑는다 (진동수는 그대로 정수배).
 *  - 두 사인파(진동수 x<y, 세기 a, b)가 부딪쳐 생기는 거칠기: min(a,b)·(e^{-3.5·s·(y-x)} − e^{-5.75·s·(y-x)}),
 *    s = 0.24 / (0.0207·x + 18.96)   (Plomp-Levelt 곡선을 Sethares가 맞춘 식)
 *  - 두 음의 거칠기 = 낮은 음의 배음 하나와 높은 음의 배음 하나로 만든 모든 짝의 합 (같은 음 안의 짝은 빼서 '두 음이 부딪쳐 생기는 몫'만 본다).
 *  - 화면의 거칠기 지수 = 같은 음색·배음 수에서 0~1200센트(한 옥타브) 가운데 가장 거친 곳을 100으로 둔 값.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Harmony = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { f0: 261.63, N: 6, seed: 1, target: 1200, step: 5 };
  const B1 = 3.5, B2 = 5.75, DSTAR = 0.24, S1 = 0.0207, S2 = 18.96;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 12개 반음 간격의 이름과 가까운 단순한 비
  const NAMES = [
    { c: 0, ko: '도-도 (같은 음)', short: '도', p: 1, q: 1 },
    { c: 100, ko: '도-도#', short: '도#', p: 16, q: 15 },
    { c: 200, ko: '도-레', short: '레', p: 9, q: 8 },
    { c: 300, ko: '도-미♭', short: '미♭', p: 6, q: 5 },
    { c: 400, ko: '도-미', short: '미', p: 5, q: 4 },
    { c: 500, ko: '도-파', short: '파', p: 4, q: 3 },
    { c: 600, ko: '도-파#', short: '파#', p: 45, q: 32 },
    { c: 700, ko: '도-솔', short: '솔', p: 3, q: 2 },
    { c: 800, ko: '도-라♭', short: '라♭', p: 8, q: 5 },
    { c: 900, ko: '도-라', short: '라', p: 5, q: 3 },
    { c: 1000, ko: '도-시♭', short: '시♭', p: 9, q: 5 },
    { c: 1100, ko: '도-시', short: '시', p: 15, q: 8 },
    { c: 1200, ko: '도-높은 도', short: '높은 도', p: 2, q: 1 },
  ];
  const cents = (r) => 1200 * Math.log2(r);
  const ratio = (c) => Math.pow(2, c / 1200);
  const nearest = (c) => NAMES[Math.max(0, Math.min(12, Math.round(c / 100)))];

  // 음색: 배음 세기 배열 (길이 N)
  function amps(N, seed) {
    const a = [];
    if ((seed || 1) === 1) { for (let k = 0; k < N; k++) a.push(Math.pow(0.88, k)); return a; }
    const rnd = mulberry32(seed * 2654435761 + 7);
    for (let k = 0; k < 10; k++) a.push(0.15 + 0.85 * rnd());
    a[0] = 1; // 기본음은 늘 가장 세게 (같은 음 높이로 들리게)
    return a.slice(0, N);
  }

  function pairRough(x, y, a, b) {
    if (y < x) { const t = x; x = y; y = t; }
    const s = DSTAR / (S1 * x + S2), d = y - x;
    return Math.min(a, b) * (Math.exp(-B1 * s * d) - Math.exp(-B2 * s * d));
  }

  // 두 음(f, f·r)의 거칠기 (두 음 사이의 짝만)
  function rough(r, N, seed, f0) {
    f0 = f0 || DEFAULTS.f0; const A = amps(N, seed); let D = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) D += pairRough(f0 * (i + 1), f0 * r * (j + 1), A[i], A[j]);
    return D;
  }

  // 0~1200센트를 1센트 간격으로 계산한 곡선. idx = 가장 거친 곳 = 100 으로 맞춘 지수
  const cache = {};
  function curve(N, seed, f0) {
    const key = [N, seed, f0 || DEFAULTS.f0].join('|'); if (cache[key]) return cache[key];
    const raw = new Float64Array(1201); let mx = 0;
    for (let c = 0; c <= 1200; c++) { raw[c] = rough(ratio(c), N, seed, f0); if (raw[c] > mx) mx = raw[c]; }
    const idx = new Float64Array(1201); for (let c = 0; c <= 1200; c++) idx[c] = (100 * raw[c]) / mx;
    return (cache[key] = { raw, idx, max: mx });
  }

  // 곡선의 '골'(편한 곳): 양옆 40센트 안에서 가장 낮고, 양옆 가장 높은 곳보다 3 이상 낮은 점. upto 센트까지만 본다
  function dips(cv, upto, opts) {
    const o = Object.assign({ win: 40, depth: 3 }, opts), idx = cv.idx, hi = upto == null ? 1200 : upto, out = [];
    for (let c = 0; c <= hi; c++) {
      let isMin = true, lmax = idx[c], rmax = idx[c];
      for (let d = 1; d <= o.win; d++) {
        if (c - d >= 0) { if (idx[c - d] < idx[c]) { isMin = false; break; } lmax = Math.max(lmax, idx[c - d]); }
        if (c + d <= 1200) { if (idx[c + d] < idx[c]) { isMin = false; break; } rmax = Math.max(rmax, idx[c + d]); }
      }
      if (!isMin) continue;
      if (c + o.win > hi && c < 1200) continue;   // 아직 오른쪽을 다 지나오지 않았으면 골인지 모른다
      const lft = c === 0 ? rmax : lmax, rgt = c === 1200 ? lmax : rmax;
      if (Math.min(lft, rgt) - idx[c] >= o.depth || c === 0) {
        if (out.length && c - out[out.length - 1].c <= o.win) continue;
        out.push({ c, v: idx[c], name: nearestRatio(c) });
      }
    }
    return out;
  }

  // 센트에 가장 가까운 단순한 비 (분모 8 이하) → {p,q,err(센트)}
  function nearestRatio(c, maxQ) {
    maxQ = maxQ || 8; let best = null;
    for (let q = 1; q <= maxQ; q++) for (let p = q; p <= 2 * q; p++) {
      if (gcd(p, q) !== 1) continue; const e = Math.abs(cents(p / q) - c);
      if (!best || e < best.err - 1e-9) best = { p, q, err: e };
    }
    return best;
  }
  function gcd(a, b) { while (b) { const t = b; b = a % b; a = t; } return a; }

  // 한 옥타브 안의 '편한 골' 수 (같은 음 = 0센트는 빼고 센다)
  const dipCount = (N, seed) => dips(curve(N, seed)).filter((d) => d.c > 0).length;

  // 재생: 센트를 step 씩 올려 target 까지. reached = 지금까지 올라온 곳, c = 지금 듣는(가리키는) 곳
  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const cv = curve(p.N, p.seed, p.f0);
    const sim = { params: p, curve: cv, c: 0, reached: 0, amps: amps(p.N, p.seed) };
    sim.done = () => sim.reached >= p.target;
    sim.advance = function () { if (sim.done()) return false; sim.reached = Math.min(p.target, sim.reached + p.step); sim.c = sim.reached; return true; };
    sim.jump = (c) => { sim.c = Math.max(0, Math.min(sim.reached, Math.round(c))); };
    sim.now = () => cv.idx[Math.round(sim.c)];
    sim.ratio = () => ratio(sim.c);
    return sim;
  }

  return { DEFAULTS, NAMES, create, curve, dips, dipCount, rough, amps, cents, ratio, nearest, nearestRatio, pairRough };
});
