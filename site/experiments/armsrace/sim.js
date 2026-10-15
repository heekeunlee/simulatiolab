// 군비 경쟁은 어디서 멈출까: 리처드슨(Richardson) 군비 경쟁 모델을 1년 단위 이산 시간으로. 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32).
// - 가상의 두 나라 A, B의 군비 x, y (지수, 처음 평균 10).
//   x' = x + kA·y − a·x + g + 잡음,   y' = y + kB·x − a·y + g + 잡음   (음수가 되면 0)
//   kA, kB = 상대 군비를 따라 늘리는 정도(반응), a = 자기 군비 부담에 지쳐 줄이는 정도(비용 부담), g = 서로에 대한 불만(음수면 호의).
// - 행렬 [[1−a, kA], [kB, 1−a]]의 고윳값은 1 − a ± √(kA·kB). 그래서 kA·kB < a·a 이면 한 수준에서 멈추고(안정), 크면 폭주한다.
//   (a, k가 이 범위(≤ 0.4)일 때 이산 시간에서도 연속 시간의 조건 k·k' < a·a' 와 같다.)
// - 멈추는 수준(이론): x* = g(a + kA)/(a² − kA·kB), y* = g(a + kB)/(a² − kA·kB).
// - 합의(선택): AGREE_YEAR(10년째)부터 둘 다 반응 절반 / A만 반응 절반 / A만 그해 군비를 한 번 절반으로.
// - 과열선 100: 어느 한쪽이 넘으면 '폭주'로 센다. 200을 넘으면 그래프 밖이라 그 판을 끝낸다. 모든 숫자는 이 모델의 예시.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArmsRace = factory();
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
  const C = { YEARS: 60, BASE: 10, HOT: 100, CAP: 200, NOISE: 1.5, AGREE_YEAR: 10, CUT: 0.5 };
  const DEFAULTS = { kA: 0.24, kB: 0.24, a: 0.15, g: 1, gap: 0, agree: 'none', seed: 1, noise: C.NOISE };

  // 이론: 안정 여부, 멈추는 수준, 커지는 빠르기(가장 큰 고윳값 − 1, 해마다 몇 %씩)
  function theory(kA, kB, a, g) {
    const det = a * a - kA * kB, stable = det > 0;
    const grow = Math.sqrt(Math.max(0, kA * kB)) - a;   // 음수면 줄어드는(멈추는) 쪽
    if (!stable) return { stable, grow, x: Infinity, y: Infinity };
    return { stable, grow, x: Math.max(0, g * (a + kA) / det), y: Math.max(0, g * (a + kB) / det) };
  }

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32(P.seed * 7919 + 101);
    const noise = () => (rnd() - 0.5) * 2 * P.noise;
    const S = {
      params: P, t: 0, x: C.BASE + P.gap / 2, y: Math.max(0, C.BASE - P.gap / 2), kA: P.kA, kB: P.kB,
      xs: [], ys: [], hot: -1, done: false, capped: false, agreed: false,
      theory() { return theory(S.kA, S.kB, P.a, P.g); },
      step() {
        if (S.done) return false;
        if (S.t === C.AGREE_YEAR && P.agree !== 'none' && !S.agreed) {
          S.agreed = true;
          if (P.agree === 'both') { S.kA *= C.CUT; S.kB *= C.CUT; }
          else if (P.agree === 'aonly') S.kA *= C.CUT;
          else if (P.agree === 'acut') S.x *= C.CUT;
        }
        const nx = S.x + S.kA * S.y - P.a * S.x + P.g + noise();
        const ny = S.y + S.kB * S.x - P.a * S.y + P.g + noise();
        S.x = Math.max(0, nx); S.y = Math.max(0, ny); S.t++;
        S.xs.push(S.x); S.ys.push(S.y);
        if (S.hot < 0 && Math.max(S.x, S.y) >= C.HOT) S.hot = S.t;
        if (Math.max(S.x, S.y) >= C.CAP) { S.capped = true; S.done = true; }
        if (S.t >= C.YEARS) S.done = true;
        return true;
      },
      // 마지막 10년 평균 합계 (멈춘 판의 '멈춘 수준')
      lastTotal() { const n = S.xs.length, k = Math.min(10, n); let s = 0; for (let i = n - k; i < n; i++) s += S.xs[i] + S.ys[i]; return k ? s / k : S.x + S.y; },
    };
    S.xs.push(S.x); S.ys.push(S.y);
    return S;
  }
  function run(opt) { const s = create(opt); while (s.step()); return { hot: s.hot, capped: s.capped, t: s.t, total: s.lastTotal(), x: s.x, y: s.y, xs: s.xs, ys: s.ys }; }
  // 같은 설정으로 n판(시드 1..n): 폭주(과열선 100을 넘은) 비율, 넘은 해의 중앙값, 멈춘 판의 마지막 10년 평균 합계
  function many(opt, n) {
    n = n || 100; let hot = 0; const yrs = [], tot = [];
    for (let s = 1; s <= n; s++) { const r = run(Object.assign({}, opt, { seed: s })); if (r.hot >= 0) { hot++; yrs.push(r.hot); } else tot.push(r.total); }
    yrs.sort((p, q) => p - q);
    return { hotRate: hot / n, medYear: yrs.length ? yrs[Math.floor(yrs.length / 2)] : null, calmTotal: tot.length ? tot.reduce((p, q) => p + q, 0) / tot.length : null, n };
  }
  // 반응 지도: kA, kB를 0..max로 바꿔 한 판씩 (시드 고정). 값 = 과열선을 넘은 해(−1 = 안 넘음), 멈춘 판은 마지막 합계
  function grid(opt, N, kmax) {
    const out = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const kA = kmax * i / N, kB = kmax * j / N, r = run(Object.assign({}, opt, { kA, kB, agree: 'none', seed: 1 }));
      out.push({ i, j, kA, kB, hot: r.hot, total: r.total });
    }
    return out;
  }
  return { create, run, many, grid, theory, DEFAULTS, C, mulberry32 };
});
