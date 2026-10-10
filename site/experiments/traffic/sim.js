/*
 * 유령 정체: 나겔-슈레켄베르크(Nagel & Schreckenberg, 1992) 교통 모델
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 고리 모양 한 차선 도로(길이 L칸, 한 칸은 약 7.5m, 한 단계는 약 1초)에서 모든 차가 동시에 다음 4규칙을 따른다
 *  1) 가속: 속도가 최고 속도보다 낮으면 1 올린다
 *  2) 감속: 앞차와의 빈 칸 수보다 속도가 크면 그 수로 줄인다 (추돌 방지)
 *  3) 무작위 감속: 확률 p로 속도를 1 줄인다 (잠깐 딴 데 보기, 불필요한 브레이크)
 *  4) 이동: 속도만큼 앞으로 간다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Traffic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { L: 300, density: 0.2, p: 0.25, vmax: 5, seed: 1 };
  const KMH_PER_CELL = 27; // 7.5m / 1s = 27km/h

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
    const rng = mulberry32(p.seed);
    const L = p.L, n = Math.max(1, Math.round(L * p.density));
    // 중복 없는 무작위 위치를 정렬 (고리에서 차의 앞뒤 순서는 끝까지 유지된다)
    const cells = Array.from({ length: L }, (_, i) => i);
    for (let i = L - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    const pos = Int32Array.from(cells.slice(0, n).sort((a, b) => a - b));
    const vel = new Int32Array(n);
    const rows = []; // 시공간 도표용: 각 단계의 도로 상태 (0 빈칸, 속도+1)
    const sim = {
      params: p, L, n, pos, vel, step: 0, rows, avgHistory: [], jamHistory: [],
      snapshot() { const r = new Uint8Array(L); for (let i = 0; i < n; i++) r[pos[i]] = vel[i] + 1; return r; },
      stats() {
        let s = 0, stopped = 0;
        for (let i = 0; i < n; i++) { s += vel[i]; if (vel[i] === 0) stopped++; }
        const v = s / n;
        return { avg: v, kmh: v * KMH_PER_CELL, stopped: stopped / n, flowPerHour: (n / L) * v * 3600 };
      },
      advance() {
        const nv = new Int32Array(n);
        for (let i = 0; i < n; i++) {
          const next = (i + 1) % n;
          const gap = n === 1 ? L - 1 : ((pos[next] - pos[i] - 1) % L + L) % L;
          let v = Math.min(vel[i] + 1, p.vmax);
          v = Math.min(v, gap);
          if (v > 0 && rng() < p.p) v--;
          nv[i] = v;
        }
        for (let i = 0; i < n; i++) { vel[i] = nv[i]; pos[i] = (pos[i] + nv[i]) % L; }
        sim.step++;
        const s = sim.stats(); sim.avgHistory.push(s.avg); sim.jamHistory.push(s.stopped);
        rows.push(sim.snapshot()); if (rows.length > 160) rows.shift();
        return true;
      },
    };
    rows.push(sim.snapshot());
    return sim;
  }

  // 충분히 돌려 안정된 뒤의 평균 속도/교통량/정체 비율
  function measure(opts, warm, steps, runs) {
    let v = 0, f = 0, j = 0;
    const R = runs || 1;
    for (let r = 0; r < R; r++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + r * 31 }));
      for (let t = 0; t < warm; t++) s.advance();
      let sv = 0, sf = 0, sj = 0;
      for (let t = 0; t < steps; t++) { s.advance(); const q = s.stats(); sv += q.avg; sf += q.flowPerHour; sj += q.stopped; }
      v += sv / steps; f += sf / steps; j += sj / steps;
    }
    return { avg: v / R, flow: f / R, jam: j / R };
  }

  return { DEFAULTS, KMH_PER_CELL, create, measure };
});
