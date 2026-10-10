/*
 * 유행은 왜 돌고 돌까: 모방과 차별화의 순환 (게오르크 짐멜 "유행", 1904 / 소스타인 베블런 "유한계급론", 1899에서 발상을 얻은 stylized 모델)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 스타일은 색상환 위의 각도(0~360도)로 나타낸다.
 *  - 사람 n명 중 share 비율은 "트렌드세터", 나머지는 "대중(추종자)"이다. 처음에는 모두 비슷한 스타일(한 "시즌의 유행") 주위에 모여 있다
 *  - 대중: 한 라운드마다 가장 가까운 트렌드세터의 스타일 쪽으로 최대 alpha도 움직인다 (모방)
 *  - 트렌드세터: 자기 주변(±window도)에 대중이 몰려 있을수록 달아난다. 달아나는 속도는 beta도 x (몰린 정도, 최대 1).
 *    "새로움에는 방향이 있다"는 가정으로, 달아나는 방향은 항상 색상환의 +방향 한 쪽이다 (차별화)
 *  - 모든 사람에게 jitter도 크기의 무작위 흔들림이 있다
 * 측정: 대중의 평균 스타일(원형 평균)이 한 바퀴 도는 속도, 다양성 = 1 - (모든 사람 스타일의 평균 벡터 길이)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fashion = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 200, share: 0.15, alpha: 2, beta: 2, jitter: 1, window: 30, saturation: 3, rounds: 600, seed: 1 };
  const BINS = 72;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const wrap180 = (d) => ((d + 180) % 360 + 360) % 360 - 180;
  const wrap360 = (d) => ((d % 360) + 360) % 360;

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 71 + 3);
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const n = p.n, nl = Math.max(1, Math.round(n * p.share)), nf = n - nl;
    const hue = new Float64Array(n);
    for (let i = 0; i < n; i++) hue[i] = wrap360(gauss() * 25);
    const radial = Float64Array.from({ length: n }, () => rng() - 0.5);   // 화면에서 점이 겹치지 않게 하는 고정 값

    function followerMean() {
      let c = 0, s = 0;
      for (let i = nl; i < n; i++) { const a = hue[i] * Math.PI / 180; c += Math.cos(a); s += Math.sin(a); }
      return { angle: Math.atan2(s, c) * 180 / Math.PI, R: Math.hypot(c, s) / nf };
    }
    function leaderMean() {
      let c = 0, s = 0;
      for (let i = 0; i < nl; i++) { const a = hue[i] * Math.PI / 180; c += Math.cos(a); s += Math.sin(a); }
      return Math.atan2(s, c) * 180 / Math.PI;
    }
    function allDiversity() {
      let c = 0, s = 0;
      for (let i = 0; i < n; i++) { const a = hue[i] * Math.PI / 180; c += Math.cos(a); s += Math.sin(a); }
      return 1 - Math.hypot(c, s) / n;
    }
    const first = followerMean();
    const sim = {
      params: p, n, nLeaders: nl, hue, radial, round: 0, done: false,
      unwrapped: 0, prevAngle: first.angle, history: [], strip: [], gapHist: [],
      binsNow() {
        const b = new Uint16Array(BINS);
        for (let i = 0; i < n; i++) b[Math.min(BINS - 1, Math.floor(hue[i] / (360 / BINS)))]++;
        return b;
      },
      followerMean, diversity: allDiversity,
      gap() { return wrap180(leaderMean() - followerMean().angle); },     // 트렌드세터가 대중보다 앞선 정도(도)
      advance() {
        if (sim.done) return false;
        const nh = Float64Array.from(hue);
        for (let i = nl; i < n; i++) {                                    // 대중: 가장 가까운 트렌드세터를 따라 한다
          let bj = 0, bd = Infinity;
          for (let j = 0; j < nl; j++) { const d = Math.abs(wrap180(hue[j] - hue[i])); if (d < bd) { bd = d; bj = j; } }
          const d = wrap180(hue[bj] - hue[i]);
          nh[i] = hue[i] + Math.sign(d) * Math.min(p.alpha, Math.abs(d)) + p.jitter * gauss();
        }
        const expected = nf * 2 * p.window / 360;                         // 대중이 고르게 퍼져 있을 때 기대되는 주변 인원
        for (let j = 0; j < nl; j++) {                                    // 트렌드세터: 주변이 붐빌수록 새로움 쪽으로 달아난다
          let cnt = 0;
          for (let i = nl; i < n; i++) if (Math.abs(wrap180(hue[i] - hue[j])) <= p.window) cnt++;
          nh[j] = hue[j] + p.beta * Math.min(1, cnt / expected / p.saturation) + p.jitter * 0.3 * gauss();
        }
        for (let i = 0; i < n; i++) hue[i] = wrap360(nh[i]);
        sim.round++;
        const m = followerMean(); sim.unwrapped += wrap180(m.angle - sim.prevAngle); sim.prevAngle = m.angle;
        sim.history.push(allDiversity()); sim.strip.push(sim.binsNow()); sim.gapHist.push(sim.gap());
        if (sim.round >= p.rounds) sim.done = true;
        return true;
      },
      // 대중의 평균 스타일이 100라운드당 몇 바퀴 도는지 (+면 색상환 +방향)
      rotation() { return sim.round ? (sim.unwrapped / 360 / sim.round) * 100 : 0; },
      run() { while (sim.advance()); return sim; },
    };
    sim.history.push(allDiversity()); sim.strip.push(sim.binsNow()); sim.gapHist.push(sim.gap());
    return sim;
  }

  // 같은 설정으로 여러 번 돌려 회전 속도(바퀴/100라운드)와 마지막 구간 다양성을 얻는다
  function measure(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 13 })).run();
      const h = s.history.slice(-100);
      out.push({ rotation: s.rotation(), diversity: h.reduce((a, b) => a + b, 0) / h.length });
    }
    return out;
  }

  return { DEFAULTS, BINS, create, measure, wrap180 };
});
