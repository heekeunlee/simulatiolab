/*
 * AI 화가 100명이 서로 따라 그리면: 모방과 독창성의 문화 전파 모델 (이 프로젝트의 설계)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다. (실제 이미지 생성 AI가 아니라 "모방 규칙"만 단순화한 모델이다)
 *
 * 구조
 *  - 화가 n명은 네 가지 숫자로 된 화풍을 가진다: 색조(0~1, 원형), 붓 크기, 복잡도, 각진 정도 (모두 0~1)
 *  - 화풍마다 "인기"가 있다. 라운드마다 인기는 0.8배로 줄고, 다른 화가가 따라 그리면 +1이 쌓인다
 *  - 라운드마다 모든 화가가 동시에 다음 중 하나를 한다
 *      확률 copy: 다른 화가 한 명을 골라 화풍을 절반쯤 따라간다. 고를 때 뽑힐 가중치는 (1-bias) + bias x (인기/평균 인기)^2 라서, bias가 클수록 인기 높은 화가에게 쏠린다
 *      나머지: 혁신. 화풍을 originality에 비례해 무작위로 바꾼다. 혁신가는 확률 reward로 "주목받아" 인기가 +1 쌓인다
 *  - 다양성 = 화가 쌍 사이 화풍 거리의 평균(최대 1로 정규화), 쏠림 = 가장 인기 있는 화풍과 가까운(거리 0.15 이내) 화가의 비율
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Painters = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 100, copy: 0.6, bias: 0.5, originality: 0.4, reward: 0.2, seed: 1, rounds: 120 };
  const D = 4, NEAR = 0.15;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const wrapHue = (h) => ((h % 1) + 1) % 1;
  function dist(a, b) {
    let dh = Math.abs(a[0] - b[0]); dh = Math.min(dh, 1 - dh) * 2; // 색조는 원형이라 가장 먼 거리가 0.5 -> 1로 맞춘다
    return Math.sqrt((dh * dh + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2) / D);
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed * 7717 + 3), n = p.n;
    const gauss = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
    const style = Array.from({ length: n }, () => [rng(), rng(), rng(), rng()]);
    const pop = new Float64Array(n).fill(1);
    const act = new Int8Array(n); // 이번 라운드 행동: 0 처음, 1 따라 그림, 2 혁신
    const sim = {
      params: p, n, style, pop, act, round: 0, done: false, history: [], lastTop: 0,
      metrics() {
        let s = 0, c = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { s += dist(style[i], style[j]); c++; }
        let top = 0; for (let i = 1; i < n; i++) if (pop[i] > pop[top]) top = i;
        let near = 0; for (let i = 0; i < n; i++) if (dist(style[i], style[top]) <= NEAR) near++;
        return { diversity: s / c, concentration: near / n, top };
      },
      advance() {
        if (sim.done) return false;
        const copies = new Float64Array(n), next = style.map((v) => v.slice());
        let mean = 0; for (let i = 0; i < n; i++) mean += pop[i]; mean /= n;
        const w = new Float64Array(n); let tw = 0;
        for (let j = 0; j < n; j++) { const r = pop[j] / mean; w[j] = (1 - p.bias) + p.bias * r * r; tw += w[j]; }
        for (let i = 0; i < n; i++) {
          if (rng() < p.copy) {
            let x = rng() * (tw - w[i]), j = 0;
            for (; j < n; j++) { if (j === i) continue; x -= w[j]; if (x <= 0) break; }
            if (j >= n) j = (i + 1) % n;
            const t = style[j]; const s = next[i];
            let dh = t[0] - style[i][0]; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
            s[0] = wrapHue(style[i][0] + 0.5 * dh + 0.01 * gauss());
            for (let d = 1; d < D; d++) s[d] = Math.min(1, Math.max(0, style[i][d] + 0.5 * (t[d] - style[i][d]) + 0.01 * gauss()));
            copies[j]++; act[i] = 1;
          } else {
            const s = next[i], sd = 0.3 * p.originality;
            s[0] = wrapHue(style[i][0] + sd * gauss());
            for (let d = 1; d < D; d++) s[d] = Math.min(1, Math.max(0, style[i][d] + sd * gauss()));
            if (rng() < p.reward) copies[i] += 1;
            act[i] = 2;
          }
        }
        for (let i = 0; i < n; i++) { style[i] = next[i]; pop[i] = 0.8 * pop[i] + copies[i]; if (pop[i] < 0.05) pop[i] = 0.05; }
        sim.round++;
        sim.history.push(sim.metrics());
        if (sim.round >= p.rounds) sim.done = true;
        return true;
      },
      run() { while (sim.advance()); return sim; },
    };
    sim.history.push(sim.metrics());
    return sim;
  }

  function final(opts, runs) {
    const out = [];
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k * 11 })).run();
      const h = s.history.slice(-20);
      out.push({ diversity: h.reduce((a, b) => a + b.diversity, 0) / h.length, concentration: h.reduce((a, b) => a + b.concentration, 0) / h.length });
    }
    return out;
  }

  return { DEFAULTS, create, final, dist };
});
