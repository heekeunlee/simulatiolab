// 환기: 문과 창문 배치에 따라 방 공기가 얼마나 빨리, 얼마나 구석구석 바뀌는가 (위에서 내려다본 2D 단순 모델, 무차원)
// - 바람 압력: 열린 곳마다 "그 벽이 바람을 마주 보는 정도"(코사인, +1 정면 ~ 0 나란함 ~ −1 등짐)만큼 밀거나 빨아낸다. (이 프로젝트의 단순한 규칙)
// - 방 안 흐름: 열린 곳의 압력 차로 생기는 비압축 2D 흐름(정상 퍼텐셜 흐름: 압력이 높은 틈에서 낮은 틈으로). 벽을 뚫지 않는다.
// - 탁한 공기(이산화탄소 같은 오염 지수 0~100): 흐름에 실려 이동(유한 체적 풍상 차분) + 섞임(확산). 방 안은 처음에 100, 열린 곳 바깥 공기는 0.
//   창가 섞임: 바람이 창가에서 들락거리며 섞는 효과는 이 흐름이 만들지 못하므로, 열린 곳 가까이일수록 크게 섞이는 항을 따로 넣었다(바람 세기에 비례).
// - 사람 한 명이 계속 숨을 내쉰다(정해진 자리 3×3칸에 걸음마다 조금씩 더해짐).
// 실제 건물·공기 단위가 아닌, 이 프로젝트의 단순화된 예시다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ventilation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 60, H = 40;                          // 방 안쪽 크기(칸)
  const NX = W + 2, NY = H + 2, N = NX * NY;     // 벽까지 포함한 격자
  const X0 = 1, Y0 = 1;                          // 방 안쪽 첫 칸
  const DIV = X0 + 20;                           // 방을 나누는 벽의 열 (왼쪽 20칸 | 오른쪽 39칸)
  const STEPS = 6000, SAMPLE = 20, UNIT = 100;   // 한 판 걸음 수, 기록 간격, 시간 1 = 100걸음 (모델 단위)
  const FLOW = 0.5;                              // 압력 차 1당 흐름의 세기(보통 바람 기준), 이 프로젝트의 설정
  const DIFF = 0.01, MIX = 0.2, MIXR = 5;        // 기본 섞임, 창가 섞임(보통 바람에서, 열린 곳에서 MIXR칸마다 e배씩 줄어듦)
  const BREATH = 0.12;                           // 사람이 내쉬는 양(걸음마다 3×3칸에 더하는 지수)
  const DEFAULTS = { count: 2, layout: 'opposite', gap: 6, wind: 3, dir: 'front', door: 'none', src: 'center', seed: 1 };

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // 창(열린 곳) 자리: [벽, 벽을 따라 위치 0~1]. L=왼쪽(바람이 정면으로 오는 벽), R=오른쪽, T=위, B=아래
  const LAYOUTS = {
    same: [['L', 0.22], ['L', 0.78], ['L', 0.5]],
    opposite: [['L', 0.5], ['R', 0.5], ['R', 0.15]],
    adjacent: [['L', 0.5], ['T', 0.78], ['B', 0.78]],
  };
  const NORMAL = { L: [-1, 0], R: [1, 0], T: [0, -1], B: [0, 1] };   // 벽의 바깥쪽 방향 (화면 아래가 +y)
  function openings(p) {
    const list = p.count <= 1 ? [['L', 0.5]] : LAYOUTS[p.layout].slice(0, Math.min(3, p.count));
    return list.map(([wall, f]) => ({ wall, f }));
  }
  function windVec(dir) { const s = Math.SQRT1_2; return dir === 'diag' ? [s, s] : dir === 'side' ? [0, 1] : [1, 0]; }
  // 벽이 바람을 마주 보는 정도: +1 정면으로 받음, 0 바람과 나란함, −1 등짐
  function facing(wall, wv) { const n = NORMAL[wall]; return -(n[0] * wv[0] + n[1] * wv[1]); }

  function personSpot(p) {
    const seed = p.seed || 1, rnd = mulberry32(seed * 7919 + 13);
    if (p.src === 'corner') {
      const C = [[W - 4, H - 4], [W - 4, 3], [3, H - 4], [DIV - X0 + 4, 3]];
      const c = C[(seed - 1) % 4];
      return [X0 + c[0], Y0 + c[1]];
    }
    // 방 한가운데 (나누는 벽이 있으면 벽 오른쪽 큰 방의 가운데). 첫 판은 정확히 가운데, 다음 판부터 조금씩 옮긴다
    const cx = p.door === 'none' ? W / 2 : (DIV - X0 + 1 + W) / 2, cy = H / 2;
    const j = seed === 1 ? [0, 0] : [Math.round((rnd() - 0.5) * 14), Math.round((rnd() - 0.5) * 12)];
    return [X0 + Math.round(cx) + j[0], Y0 + Math.round(cy) + j[1]];
  }

  function create(opt) {
    const p = Object.assign({}, DEFAULTS, opt || {});
    p.count = Math.max(1, Math.min(3, Math.round(p.count)));
    p.wind = Math.max(1, Math.min(5, Math.round(p.wind)));
    const wv = windVec(p.dir), U = p.wind / 3;    // 바람 세기 (보통 = 1)
    // 칸 종류: 1 방 안, 2 벽, 3 열린 곳(창 틈)
    const type = new Uint8Array(N).fill(2);
    for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) type[y * NX + x] = 1;
    if (p.door !== 'none') {
      for (let y = Y0; y < Y0 + H; y++) type[y * NX + DIV] = 2;
      if (p.door === 'open') for (let y = Y0 + H / 2 - 3; y < Y0 + H / 2 + 3; y++) type[y * NX + DIV] = 1;
    }
    const ops = openings(p), g = Math.max(2, Math.min(12, Math.round(p.gap)));
    const phi = new Float64Array(N);
    ops.forEach((o, k) => {
      const along = o.wall === 'L' || o.wall === 'R' ? H : W, c = Math.round(o.f * along);
      const a0 = Math.max(1, Math.min(along - g - 1, c - Math.floor(g / 2)));
      o.cells = []; o.k = k; o.a0 = a0; o.g = g; o.cp = facing(o.wall, wv);
      for (let a = a0; a < a0 + g; a++) {
        const x = o.wall === 'L' ? 0 : o.wall === 'R' ? NX - 1 : X0 + a, y = o.wall === 'T' ? 0 : o.wall === 'B' ? NY - 1 : Y0 + a;
        const i = y * NX + x; type[i] = 3; o.cells.push(i); phi[i] = o.cp;
      }
      // 그림용: 틈 가운데 좌표(칸 단위, 격자 왼쪽 위 = 0)
      if (o.wall === 'L' || o.wall === 'R') { o.x = o.wall === 'L' ? 0.5 : NX - 0.5; o.y = Y0 + a0 + g / 2; }
      else { o.y = o.wall === 'T' ? 0.5 : NY - 0.5; o.x = X0 + a0 + g / 2; }
    });
    const open = (i) => type[i] === 1 || type[i] === 3;
    const room = []; for (let i = 0; i < N; i++) if (type[i] === 1) room.push(i);
    const R = Int32Array.from(room);
    const nb = (i) => [i - 1, i + 1, i - NX, i + NX];
    // 열린 곳끼리(벽을 따라 옆 칸)는 서로 잇지 않는다: 열린 곳은 방 안 칸과만 이어진다
    const link = (i, j) => j >= 0 && j < N && open(i) && open(j) && !(type[i] === 3 && type[j] === 3);

    // 1) 정상 퍼텐셜 흐름: 방 안에서 ∇²φ = 0, 열린 곳은 φ = 바람 압력, 벽은 흐름이 뚫고 나가지 않음 (SOR 반복)
    const cpm = ops.reduce((a, o) => a + o.cp, 0) / ops.length;
    R.forEach((i) => { phi[i] = cpm; });
    const NBR = R.map(() => 0), nbList = [];
    for (let k = 0; k < R.length; k++) { const l = nb(R[k]).filter((j) => link(R[k], j)); nbList.push(l); }
    let iters = 0, res = 1;
    for (; iters < 20000 && res > 1e-9; iters++) {
      res = 0;
      for (let k = 0; k < R.length; k++) {
        const i = R[k], l = nbList[k]; if (!l.length) continue;
        let s = 0; for (let q = 0; q < l.length; q++) s += phi[l[q]];
        const nv = phi[i] + 1.9 * (s / l.length - phi[i]), d = Math.abs(nv - phi[i]); if (d > res) res = d; phi[i] = nv;
      }
    }
    // 면 흐름(칸 하나 = 부피 1): Fx[i] = i → i+1, Fy[i] = i → i+NX. 압력이 높은 쪽에서 낮은 쪽으로
    const K = FLOW * U;
    const Fx = new Float64Array(N), Fy = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (link(i, i + 1)) Fx[i] = K * (phi[i] - phi[i + 1]);
      if (link(i, i + NX)) Fy[i] = K * (phi[i] - phi[i + NX]);
    }
    // 칸 가운데 속도(그림·입자용, 칸/걸음)
    const ux = new Float32Array(N), uy = new Float32Array(N);
    for (let i = 0; i < N; i++) if (open(i)) {
      const xl = i > 0 ? Fx[i - 1] : 0, yu = i >= NX ? Fy[i - NX] : 0;
      ux[i] = type[i] === 3 ? Fx[i] + xl : 0.5 * (Fx[i] + xl); uy[i] = type[i] === 3 ? Fy[i] + yu : 0.5 * (Fy[i] + yu);
    }
    ops.forEach((o) => {   // 열린 곳마다 드나드는 양: + 들어옴, − 나감
      let q = 0;
      o.cells.forEach((i) => { if (link(i, i + 1)) q += Fx[i]; if (link(i, i - 1)) q -= Fx[i - 1]; if (link(i, i + NX)) q += Fy[i]; if (link(i, i - NX)) q -= Fy[i - NX]; });
      o.q = q;
    });
    const inflow = ops.reduce((a, o) => a + Math.max(0, o.q), 0);
    // 검증용: 방 안 칸마다 들어오고 나가는 흐름의 합(비압축이면 0)
    let divMax = 0;
    for (let k = 0; k < R.length; k++) { const i = R[k]; const dv = Fx[i] - Fx[i - 1] + Fy[i] - Fy[i - NX]; if (Math.abs(dv) > divMax) divMax = Math.abs(dv); }

    // 2) 섞임 지도: 기본 섞임 + 창가 섞임(열린 곳에서 직선 거리 d칸이면 MIX·바람·exp(−d/MIXR))
    const Dm = new Float64Array(N);
    const opAll = ops.flatMap((o) => o.cells);
    for (let i = 0; i < N; i++) {
      if (!open(i)) continue;
      const x = i % NX, y = (i - x) / NX; let d2 = 1e9;
      for (const j of opAll) { const ox = j % NX, oy = (j - ox) / NX, dd = (x - ox) * (x - ox) + (y - oy) * (y - oy); if (dd < d2) d2 = dd; }
      Dm[i] = DIFF + MIX * U * Math.exp(-Math.sqrt(d2) / MIXR);
    }
    // 면 목록 (방 안 칸끼리, 방 안–열린 곳): [a, b, a→b 흐름, 섞임]
    const faces = [];
    for (let i = 0; i < N; i++) {
      if (link(i, i + 1)) faces.push(i, i + 1, Fx[i], 0.5 * (Dm[i] + Dm[i + 1]));
      if (link(i, i + NX)) faces.push(i, i + NX, Fy[i], 0.5 * (Dm[i] + Dm[i + NX]));
    }
    const FA = Float64Array.from(faces), NF = FA.length / 4;
    // 안정 조건(한 칸에서 나가는 흐름 + 섞임 합 ≤ 0.9)을 넘지 않게 한 걸음을 잘게 나눈다
    const outSum = new Float64Array(N);
    for (let k = 0; k < NF; k++) { const a = FA[4 * k], b = FA[4 * k + 1], F = FA[4 * k + 2], D = FA[4 * k + 3]; outSum[a] += Math.max(0, F) + D; outSum[b] += Math.max(0, -F) + D; }
    let worst = 0; for (let k = 0; k < R.length; k++) worst = Math.max(worst, outSum[R[k]]);
    const SUB = Math.max(1, Math.ceil(worst / 0.9));

    let C = new Float64Array(N), C2 = new Float64Array(N);
    R.forEach((i) => { C[i] = 100; });
    const [px, py] = personSpot(p);
    const breathCells = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = (py + dy) * NX + px + dx; if (type[i] === 1) breathCells.push(i); }

    function advance() {
      for (let s = 0; s < SUB; s++) {
        C2.set(C);
        for (let k = 0; k < NF; k++) {
          const a = FA[4 * k], b = FA[4 * k + 1], F = FA[4 * k + 2] / SUB, D = FA[4 * k + 3] / SUB;
          const ca = C[a], cb = C[b];
          const flux = (F > 0 ? F * ca : F * cb) + D * (ca - cb);   // a → b 로 옮겨 가는 양
          C2[a] -= flux; C2[b] += flux;
        }
        for (let q = 0; q < breathCells.length; q++) C2[breathCells[q]] += BREATH / SUB;
        const t = C; C = C2; C2 = t;
        for (let q = 0; q < opAll.length; q++) C[opAll[q]] = 0;   // 열린 곳 = 바깥 공기
      }
    }

    const S = {
      params: p, W, H, NX, NY, X0, Y0, DIV, type, ops, person: [px, py], wind: wv, U, ux, uy, phi, inflow, divMax, iters, sub: SUB,
      t: 0, steps: STEPS, unit: UNIT, sample: SAMPLE,
      get C() { return C; },
      hist: [], histP: [], half: -1, done: false,
      mean() { let s = 0; for (let k = 0; k < R.length; k++) s += C[R[k]]; return s / R.length; },
      personAir() { let s = 0, n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const i = (py + dy) * NX + px + dx; if (type[i] === 1) { s += C[i]; n++; } } return n ? s / n : 0; },
      staleShare() { let n = 0; for (let k = 0; k < R.length; k++) if (C[R[k]] > 50) n++; return n / R.length; },
      record() { const m = S.mean(); S.hist.push(m); S.histP.push(S.personAir()); if (S.half < 0 && m <= 50) S.half = S.t; },
      step() {
        if (S.done) return false;
        advance(); S.t++;
        if (S.t % SAMPLE === 0) S.record();
        if (S.t >= STEPS) S.done = true;
        return true;
      },
      run() { while (!S.done) S.step(); return S; },
      halfTime() { return S.half < 0 ? null : S.half / UNIT; },
    };
    S.record();
    return S;
  }

  // 한 판을 끝까지 돌려 요약 (집계 비교용)
  function summary(opt) {
    const s = create(opt).run();
    return { half: s.halfTime(), stale: s.staleShare(), mean: s.mean(), person: s.personAir(), inflow: s.inflow };
  }

  return { create, summary, facing, windVec, DEFAULTS, STEPS, UNIT, SAMPLE, LAYOUTS, W, H, NX, NY, X0, Y0, DIV };
});
