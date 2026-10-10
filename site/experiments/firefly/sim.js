/*
 * 반딧불이 동시 점멸: 펄스 결합 진동자 (Mirollo & Strogatz 1990, Peskin 1975의 발상)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 반딧불이 n마리가 1x1 평면에 흩어져 있고, 저마다 "위상"(0~1)을 가진다. 위상은 시간에 비례해 커지다가 1이 되면 반짝이고 0으로 돌아간다
 *  - 반딧불이마다 반짝이는 속도가 조금씩 다르다 (평균 1, 퍼짐 spread)
 *  - 가까운 반딧불이(반경 radius 이내)의 반짝임을 보면, 자기 위상을 coupling만큼 앞당긴다. 그 바람에 1을 넘으면 바로 따라 반짝인다
 *  - 동기화 정도 r = 위상을 원 위의 점으로 놓았을 때 평균 벡터의 길이 (0이면 제각각, 1이면 완전히 동시)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Firefly = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 150, coupling: 0.03, radius: 0.4, spread: 0.08, seed: 1, dt: 0.02, cycles: 60 };

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
    const rng = mulberry32(p.seed * 31 + 7), n = p.n;
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const x = new Float64Array(n), y = new Float64Array(n), phase = new Float64Array(n), omega = new Float64Array(n), glow = new Float64Array(n);
    for (let i = 0; i < n; i++) { x[i] = rng(); y[i] = rng(); phase[i] = rng(); omega[i] = Math.max(0.5, 1 + p.spread * gauss()); }
    const nb = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j], dy = y[i] - y[j];
      if (dx * dx + dy * dy <= p.radius * p.radius) { nb[i].push(j); nb[j].push(i); }
    }
    const sim = {
      params: p, n, x, y, phase, omega, glow, step: 0, flashes: 0, history: [], flashHist: [],
      maxSteps: Math.round(p.cycles / p.dt),
      sync() {
        let c = 0, s = 0;
        for (let i = 0; i < n; i++) { const a = 2 * Math.PI * phase[i]; c += Math.cos(a); s += Math.sin(a); }
        return Math.sqrt(c * c + s * s) / n;
      },
      advance() {
        if (sim.step >= sim.maxSteps) return false;
        const flashed = new Uint8Array(n), queue = [];
        for (let i = 0; i < n; i++) { glow[i] = Math.max(0, glow[i] - 0.1); phase[i] += p.dt * omega[i]; if (phase[i] >= 1) { flashed[i] = 2; queue.push(i); } }
        let count = 0;
        while (queue.length) {
          const i = queue.pop(); phase[i] = 0; flashed[i] = 1; glow[i] = 1; count++;
          for (const j of nb[i]) {
            if (flashed[j]) continue;
            phase[j] += p.coupling;
            if (phase[j] >= 1) { flashed[j] = 2; queue.push(j); }
          }
        }
        sim.step++; sim.flashes += count; sim.flashHist.push(count);
        if (sim.step % 5 === 0) sim.history.push(sim.sync());
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    return sim;
  }

  // 충분히 돌린 뒤 마지막 구간의 평균 동기화 정도
  function finalSync(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 13, cycles: opts.cycles || 40 })).run();
      const h = s.history.slice(-Math.max(10, Math.floor(s.history.length / 5)));
      out.push(h.reduce((a, b) => a + b, 0) / h.length);
    }
    return out;
  }

  return { DEFAULTS, create, finalSync };
});
