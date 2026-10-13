/*
 * 랭턴의 개미: 규칙 두 줄짜리 개미가 만 걸음쯤 뒤 갑자기 '고속도로'를 내는 격자 모델
 * (Langton 1986, "Studying artificial life with cellular automata", Physica D 22). 이 프로젝트의 단순화된 구현이다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 규칙: 흰 칸이면 오른쪽으로 90도 돌고, 칸을 검게 바꾸고, 한 칸 앞으로. 검은 칸이면 왼쪽으로 90도 돌고, 칸을 희게 바꾸고, 한 칸 앞으로.
 * 개미가 여럿이면 한 걸음마다 개미들이 차례로 한 번씩 움직인다.
 * 고속도로 판정: 개미의 자리·방향이 104걸음마다 같은 대각선 방향으로 (2,2)칸씩 옮겨 가며 되풀이되는 것이 세 번 이어질 때.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ant = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const G = 2048, C0 = 1024, PERIOD = 104, RING = 256;
  const DEFAULTS = { ants: 1, noise: false, dens: 0.15, side: 21, maxSteps: 60000, seed: 1, sample: 20 };
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]; // 0 위, 1 오른쪽, 2 아래, 3 왼쪽
  const STARTS = [[0, 0, 0], [8, 0, 2], [0, -8, 1], [-8, 8, 3]]; // 개미 시작 자리·방향

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts || {});
    const g = new Uint8Array(G * G); // 비트 0: 검음, 비트 1: 개미가 지나간 적 있음
    const rnd = mulberry32(P.seed * 7919 + 13);
    let black = 0;
    if (P.noise) {
      const h = (P.side - 1) / 2;
      for (let y = -h; y <= h; y++) for (let x = -h; x <= h; x++) if (rnd() < P.dens) { g[(C0 + y) * G + C0 + x] = 1; black++; }
    }
    const A = [];
    for (let k = 0; k < P.ants; k++) {
      const s = STARTS[k]; A.push({ x: C0 + s[0], y: C0 + s[1], d: s[2], rx: new Int16Array(RING), ry: new Int16Array(RING), rd: new Int8Array(RING), run: 0, dx: 0, dy: 0 });
    }
    const sim = {
      params: P, grid: g, G, C0, ants: A, steps: 0, black, onset: null, onsetAnt: -1, edge: false,
      minX: C0, maxX: C0, minY: C0, maxY: C0,
      hist: { t: [], black: [], dist: [] },
      done() { return this.edge || this.steps >= P.maxSteps; },
      dist() { let s = 0; for (const a of A) s += Math.hypot(a.x - C0, a.y - C0); return s / A.length; },
      step() {
        if (this.done()) return false;
        const t = this.steps;
        for (let k = 0; k < A.length; k++) {
          const a = A[k], i = a.y * G + a.x, c = g[i];
          a.d = (c & 1) ? (a.d + 3) & 3 : (a.d + 1) & 3;
          g[i] = (c ^ 1) | 2; black += (c & 1) ? -1 : 1;
          a.x += DX[a.d]; a.y += DY[a.d];
          if (a.x < 2 || a.y < 2 || a.x > G - 3 || a.y > G - 3) { this.edge = true; }
          if (a.x < this.minX) this.minX = a.x; if (a.x > this.maxX) this.maxX = a.x;
          if (a.y < this.minY) this.minY = a.y; if (a.y > this.maxY) this.maxY = a.y;
          // 고속도로 판정: 자리·방향이 104걸음마다 (±2,±2)씩 되풀이되는지
          const j = t & (RING - 1), j1 = (t - PERIOD) & (RING - 1), j2 = (t - 2 * PERIOD) & (RING - 1);
          a.rx[j] = a.x; a.ry[j] = a.y; a.rd[j] = a.d;
          if (t >= 2 * PERIOD) {
            const dx = a.x - a.rx[j1], dy = a.y - a.ry[j1];
            const ok = a.d === a.rd[j1] && a.rd[j1] === a.rd[j2] && Math.abs(dx) === 2 && Math.abs(dy) === 2 && dx === a.rx[j1] - a.rx[j2] && dy === a.ry[j1] - a.ry[j2];
            if (ok) { a.run++; if (a.run === 1.5 * PERIOD && this.onset === null) { this.onset = t - a.run + 1 - 2 * PERIOD; this.onsetAnt = k; } } else a.run = 0;
          }
        }
        this.steps = t + 1; this.black = black;
        if (this.steps % P.sample === 0) { this.hist.t.push(this.steps); this.hist.black.push(black); this.hist.dist.push(this.dist()); }
        return true;
      },
      advance(n) { let k = 0; while (k < n && this.step()) k++; return k; },
      highway() { return this.onset !== null && A[this.onsetAnt].run >= 1.5 * PERIOD; },
    };
    return sim;
  }

  return { create, G, C0, PERIOD, DX, DY };
});
