// 은하 충돌: 제한 N체 모델(Toomre & Toomre 1972 방식). 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32), 고정 dt.
// - 은하 중심 질량 둘(무거운 점, 부드럽게 만든 중력 = 플러머 소프트닝)이 서로 끌어당기며 움직인다.
// - 별 수천 개는 "시험 입자": 두 중심의 중력만 받고, 별끼리는 끌어당기지 않는다(그래서 별끼리 부딪혀도 결과가 바뀌지 않는다).
// - 두 중심이 겹칠 만큼 가까우면 서로의 상대 속도를 줄이는 간단한 제동(동역학적 마찰을 흉내 낸 이 프로젝트의 단순화)을 넣어 합쳐지게 한다.
// - 적분: 속도 베를레(kick-drift-kick, leapfrog). 단위는 무차원(G = 1, 큰 은하 질량 1, 큰 은하 원반 반지름 1).
// - 별끼리 "가까이 지나간" 쌍: 한 걸음 동안 두 별이 직선으로 움직인다고 보고 가장 가까웠던 거리를 재서, 정한 별 크기(처음 별 사이 간격의 1/10·1/100·1/1000)보다 가까웠던 쌍을 센다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Galaxy = factory();
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
  const C = {
    DT: 0.02,            // 한 걸음 시간
    SOFT: 0.2,           // 소프트닝(원반 반지름 대비): 중심 가까이 중력이 무한히 커지지 않게
    RIN: 0.2, ROUT: 1,   // 별이 놓이는 반지름 범위(원반 반지름 대비)
    THICK: 0.02,         // 원반 두께(위아래로 흩어진 정도)
    R0: 8,               // 처음 두 중심 사이 거리
    RF: 2.6, KF: 0.12,   // 제동이 작동하는 거리(두 은하가 겹칠 때)와 세기
    RMERGE: 0.15,        // 두 중심이 이보다 가까우면 "합쳐짐"
    TAILR: 2,            // 어느 중심에서도 이보다 멀면 "꼬리로 떨어져 나간 별"
    TURNS: 8,            // 한 판 길이(바깥 별이 도는 바퀴 수)
    SAMPLE: 10,          // 그래프 기록 간격(걸음)
    SIZES: [10, 100, 1000],   // 별 크기 = 처음 별 사이 간격의 1/10, 1/100, 1/1000
  };
  // 큰 은하 바깥(반지름 1) 별이 한 바퀴 도는 시간 = 이 모델의 시간 단위 "바퀴"
  const VOUT = Math.sqrt(1 / Math.pow(1 + C.SOFT * C.SOFT, 1.5));
  const TURN = 2 * Math.PI / VOUT;
  const DEFAULTS = { n: 6000, q: 50, rp: 100, tilt: 30, spin: 'pro', seed: 1, friction: true, turns: C.TURNS, count: true };

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32((P.seed | 0) * 7919 + 101);
    const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const q = Math.max(0.05, P.q / 100), rp = P.rp / 100, tilt = P.tilt * Math.PI / 180;
    // 두 은하: A(질량 1, 반지름 1), B(질량 q, 반지름 √q)
    const M = [1, q], RD = [1, Math.sqrt(q)], A = [C.SOFT, C.SOFT * Math.sqrt(q)];
    const AC2 = A[0] * A[0] + A[1] * A[1];   // 중심끼리 끄는 힘의 소프트닝
    const cx = [0, 0], cy = [0, 0], cz = [0, 0], cvx = [0, 0], cvy = [0, 0], cvz = [0, 0];
    // 처음 궤도: 포물선(멀리서 겨우 붙잡히지 않을 빠르기), 가장 가까워질 거리 rp, 공전면은 x-y면(위에서 보면 반시계)
    const mu = 1 + q, R0 = Math.max(C.R0, rp + 5);
    const nu = -Math.acos(2 * rp / R0 - 1), h = Math.sqrt(2 * mu * rp);
    const rx = R0 * Math.cos(nu), ry = R0 * Math.sin(nu);
    const vr = (mu / h) * Math.sin(nu), vt = h / R0;
    const rvx = vr * Math.cos(nu) - vt * Math.sin(nu), rvy = vr * Math.sin(nu) + vt * Math.cos(nu);
    // 무게중심에 놓는다 (B - A = r)
    cx[0] = -rx * q / mu; cy[0] = -ry * q / mu; cx[1] = rx / mu; cy[1] = ry / mu;
    cvx[0] = -rvx * q / mu; cvy[0] = -rvy * q / mu; cvx[1] = rvx / mu; cvy[1] = rvy / mu;
    // (검증용) solo: 큰 은하 하나만 가만히 둔다 — 별의 에너지가 지켜지는지 보려는 것
    if (P.solo) { M[1] = 0; cx[0] = cy[0] = cvx[0] = cvy[0] = 0; cx[1] = 1e6; cvx[1] = cvy[1] = 0; }

    // 별: 은하 질량에 비례해 나누되 작은 은하도 최소 20%
    const N = Math.max(20, Math.round(P.n));
    const NB = P.solo ? 0 : Math.round(N * Math.max(0.2, q / (1 + q))), NA = N - NB;
    const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
    const vx = new Float64Array(N), vy = new Float64Array(N), vz = new Float64Array(N);
    const ox = new Float64Array(N), oy = new Float64Array(N), oz = new Float64Array(N);
    const gal = new Uint8Array(N), r0 = new Float32Array(N);
    // 원반 방향: 공전과 같은 방향으로 도는 원반의 축은 +z, 반대면 -z. 그 축을 tilt만큼 기울인다(A는 x축, B는 y축을 중심으로)
    const spinSign = (g) => (P.spin === 'pro' ? 1 : P.spin === 'retro' ? -1 : g === 0 ? 1 : -1);
    function basis(g) {
      const s = spinSign(g), c = Math.cos(tilt), sn = Math.sin(tilt);
      // 축 n, 원반 안 두 방향 e1, e2 (e1 × e2 = n)
      let n, e1;
      if (g === 0) { n = [0, -sn * s, c * s]; e1 = [1, 0, 0]; }
      else { n = [sn * s, 0, c * s]; e1 = [0, 1, 0]; }
      const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
      return { n, e1, e2 };
    }
    const B = [basis(0), basis(1)];
    for (let i = 0; i < N; i++) {
      const g = i < NA ? 0 : 1, b = B[g];
      const r = RD[g] * (C.RIN + (C.ROUT - C.RIN) * rnd()), th = 2 * Math.PI * rnd(), zz = gauss() * C.THICK * RD[g];
      const c = Math.cos(th), s = Math.sin(th);
      const v = Math.sqrt(M[g] * r * r / Math.pow(r * r + A[g] * A[g], 1.5));
      for (let k = 0; k < 3; k++) {
        const pos = r * (c * b.e1[k] + s * b.e2[k]) + zz * b.n[k];
        const vel = v * (-s * b.e1[k] + c * b.e2[k]);
        if (k === 0) { px[i] = cx[g] + pos; vx[i] = cvx[g] + vel; }
        else if (k === 1) { py[i] = cy[g] + pos; vy[i] = cvy[g] + vel; }
        else { pz[i] = cz[g] + pos; vz[i] = cvz[g] + vel; }
      }
      gal[i] = g; r0[i] = r / RD[g];
    }
    ox.set(px); oy.set(py); oz.set(pz);

    const S = {
      params: P, C, n: N, NA, NB, M, RD, px, py, pz, vx, vy, vz, ox, oy, oz, gal, r0,
      cx, cy, cz, cvx, cvy, cvz, ocx: cx.slice(), ocy: cy.slice(), ocz: cz.slice(),
      t: 0, steps: Math.round(P.turns * TURN / C.DT), done: false, merged: null, minSep: Infinity, peri: [],
      hist: { sep: [], tail: [], tailA: [], tailB: [], close: [] },
      close: [0, 0, 0], s0: 0, sizes: [0, 0, 0],
    };

    // ---- 가속도 ----
    const ax = new Float64Array(N), ay = new Float64Array(N), az = new Float64Array(N);
    const cax = [0, 0], cay = [0, 0], caz = [0, 0];
    function accStars() {
      const x0 = cx[0], y0 = cy[0], z0 = cz[0], x1 = cx[1], y1 = cy[1], z1 = cz[1];
      const a0 = A[0] * A[0], a1 = A[1] * A[1], m0 = M[0], m1 = M[1];
      for (let i = 0; i < S.n; i++) {
        let dx = x0 - px[i], dy = y0 - py[i], dz = z0 - pz[i];
        let d2 = dx * dx + dy * dy + dz * dz + a0, f = m0 / (d2 * Math.sqrt(d2));
        let gx = dx * f, gy = dy * f, gz = dz * f;
        dx = x1 - px[i]; dy = y1 - py[i]; dz = z1 - pz[i];
        d2 = dx * dx + dy * dy + dz * dz + a1; f = m1 / (d2 * Math.sqrt(d2));
        ax[i] = gx + dx * f; ay[i] = gy + dy * f; az[i] = gz + dz * f;
      }
    }
    function accCores() {
      const dx = cx[1] - cx[0], dy = cy[1] - cy[0], dz = cz[1] - cz[0];
      const d2 = dx * dx + dy * dy + dz * dz + AC2, f = 1 / (d2 * Math.sqrt(d2));
      cax[0] = dx * f * M[1]; cay[0] = dy * f * M[1]; caz[0] = dz * f * M[1];
      cax[1] = -dx * f * M[0]; cay[1] = -dy * f * M[0]; caz[1] = -dz * f * M[0];
    }
    // 제동: 두 중심이 RF 안에서 겹치면 상대 속도를 줄인다(운동량은 그대로). 반걸음씩 나눠 준다
    function friction(h) {
      if (!P.friction) return;
      const dx = cx[1] - cx[0], dy = cy[1] - cy[0], dz = cz[1] - cz[0], r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const rf = (P.rf != null ? P.rf : C.RF) * (1 + Math.sqrt(q)) / 2;
      if (r >= rf) return;
      const k = Math.exp(-(P.kf != null ? P.kf : C.KF) * (1 - r / rf) * h * 2), mt = M[0] + M[1];
      for (const [vA, vB] of [[cvx, cvx], [cvy, cvy], [cvz, cvz]]) {
        const rel = vB[1] - vA[0], cm = (M[0] * vA[0] + M[1] * vB[1]) / mt, nr = rel * k;
        vA[0] = cm - nr * M[1] / mt; vB[1] = cm + nr * M[0] / mt;
      }
    }
    accStars(); accCores();

    // ---- 별끼리 가까이 지나간 쌍 세기 ----
    const pairSets = [new Set(), new Set(), new Set()];
    const HB = 1 << 15, HMASK = HB - 1;   // 칸 번호를 해시 통 HB개에 담는다(겹쳐도 확인할 쌍이 조금 늘 뿐 결과는 같다)
    const cellKey = (ix, iy, iz) => (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & HMASK);
    let eKey = new Int32Array(N * 4), eIdx = new Int32Array(N * 4), sIdx = new Int32Array(N * 4);
    const bStart = new Int32Array(HB + 1), bCnt = new Int32Array(HB);
    // 처음 별 사이 간격 s0: 가장 가까운 별까지 거리의 중앙값
    (function spacing() {
      const h0 = 0.05, map = new Map();
      for (let i = 0; i < N; i++) { const k = Math.floor(px[i] / h0) + ',' + Math.floor(py[i] / h0) + ',' + Math.floor(pz[i] / h0); let a = map.get(k); if (!a) map.set(k, a = []); a.push(i); }
      const nn = [];
      for (let i = 0; i < N; i++) {
        const ix = Math.floor(px[i] / h0), iy = Math.floor(py[i] / h0), iz = Math.floor(pz[i] / h0); let best = Infinity;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
          const L = map.get((ix + a) + ',' + (iy + b) + ',' + (iz + c)); if (!L) continue;
          for (const j of L) { if (j === i) continue; const d = (px[i] - px[j]) ** 2 + (py[i] - py[j]) ** 2 + (pz[i] - pz[j]) ** 2; if (d < best) best = d; }
        }
        if (best < Infinity) nn.push(Math.sqrt(best));
      }
      nn.sort((a, b) => a - b); S.s0 = nn.length ? nn[nn.length >> 1] : h0;
      S.sizes = C.SIZES.map((k) => S.s0 / k);
    })();
    function countClose() {
      const dmax = S.sizes[0], d2s = S.sizes.map((d) => d * d), n = S.n;
      const H = Math.max(S.s0 * 3, 0.01), half = dmax / 2;
      let m = 0;
      for (let i = 0; i < n; i++) {
        const ax0 = Math.floor((Math.min(ox[i], px[i]) - half) / H), ax1 = Math.floor((Math.max(ox[i], px[i]) + half) / H);
        const ay0 = Math.floor((Math.min(oy[i], py[i]) - half) / H), ay1 = Math.floor((Math.max(oy[i], py[i]) + half) / H);
        const az0 = Math.floor((Math.min(oz[i], pz[i]) - half) / H), az1 = Math.floor((Math.max(oz[i], pz[i]) + half) / H);
        for (let a = ax0; a <= ax1; a++) for (let b = ay0; b <= ay1; b++) for (let c = az0; c <= az1; c++) {
          if (m >= eKey.length) { const k2 = new Int32Array(eKey.length * 2), i2 = new Int32Array(eKey.length * 2); k2.set(eKey); i2.set(eIdx); eKey = k2; eIdx = i2; sIdx = new Int32Array(eKey.length); }
          eKey[m] = cellKey(a, b, c); eIdx[m++] = i;
        }
      }
      // 통별로 모으기(계수 정렬)
      bCnt.fill(0);
      for (let e = 0; e < m; e++) bCnt[eKey[e]]++;
      let acc = 0; for (let k = 0; k < HB; k++) { bStart[k] = acc; acc += bCnt[k]; } bStart[HB] = acc;
      bCnt.fill(0);
      for (let e = 0; e < m; e++) { const k = eKey[e]; sIdx[bStart[k] + bCnt[k]++] = eIdx[e]; }
      for (let k = 0; k < HB; k++) {
        const s = bStart[k], e = bStart[k + 1]; if (e - s < 2) continue;
        for (let u = s; u < e; u++) {
          const i = sIdx[u];
          for (let w = u + 1; w < e; w++) {
            const j = sIdx[w]; if (gal[j] === gal[i]) continue;   // 다른 은하에서 온 별끼리만 센다(같은 별이 해시가 겹친 칸에 또 들어간 경우도 여기서 빠진다)
            // 한 걸음 동안 상대 위치가 직선으로 바뀐다고 보고 가장 가까운 거리
            const r0x = ox[i] - ox[j], r0y = oy[i] - oy[j], r0z = oz[i] - oz[j];
            const dx = (px[i] - px[j]) - r0x, dy = (py[i] - py[j]) - r0y, dz = (pz[i] - pz[j]) - r0z;
            const dd = dx * dx + dy * dy + dz * dz;
            let tau = dd > 0 ? -(r0x * dx + r0y * dy + r0z * dz) / dd : 0; tau = tau < 0 ? 0 : tau > 1 ? 1 : tau;
            const qx = r0x + tau * dx, qy = r0y + tau * dy, qz = r0z + tau * dz, d2 = qx * qx + qy * qy + qz * qz;
            if (d2 < d2s[0]) {
              const a = i < j ? i : j, b2 = i < j ? j : i, pk = a * 65536 + b2;
              for (let q = 0; q < 3; q++) if (d2 < d2s[q]) pairSets[q].add(pk);
            }
          }
        }
      }
      for (let k = 0; k < 3; k++) S.close[k] = pairSets[k].size;
    }

    // ---- 지표 ----
    function sep() { return Math.sqrt((cx[1] - cx[0]) ** 2 + (cy[1] - cy[0]) ** 2 + (cz[1] - cz[0]) ** 2); }
    function tailFrac() {
      const T2 = C.TAILR * C.TAILR; let t = 0, ta = 0, tb = 0;
      for (let i = 0; i < S.n; i++) {
        const d0 = (px[i] - cx[0]) ** 2 + (py[i] - cy[0]) ** 2 + (pz[i] - cz[0]) ** 2, d1 = (px[i] - cx[1]) ** 2 + (py[i] - cy[1]) ** 2 + (pz[i] - cz[1]) ** 2;
        if (d0 > T2 && d1 > T2) { t++; if (gal[i] === 0) ta++; else tb++; }
      }
      const nb = Math.max(1, S.n - Math.min(S.n, S.NA));
      return { all: t / S.n, a: ta / Math.max(1, Math.min(S.n, S.NA)), b: tb / nb };
    }
    function record() {
      const s = sep(), tf = tailFrac();
      S.hist.sep.push(s); S.hist.tail.push(tf.all * 100); S.hist.tailA.push(tf.a * 100); S.hist.tailB.push(tf.b * 100); S.hist.close.push(S.close.slice());
      S.last = { sep: s, tail: tf.all * 100, tailA: tf.a * 100, tailB: tf.b * 100 };
    }
    let lastSep = sep(), prevSep = lastSep;
    function step() {
      if (S.done) return false;
      const h = C.DT, hh = h / 2;
      ox.set(px.subarray(0, S.n)); oy.set(py.subarray(0, S.n)); oz.set(pz.subarray(0, S.n));
      S.ocx = cx.slice(); S.ocy = cy.slice(); S.ocz = cz.slice();
      // kick (반걸음)
      for (let i = 0; i < S.n; i++) { vx[i] += ax[i] * hh; vy[i] += ay[i] * hh; vz[i] += az[i] * hh; }
      for (let g = 0; g < 2; g++) { cvx[g] += cax[g] * hh; cvy[g] += cay[g] * hh; cvz[g] += caz[g] * hh; }
      friction(hh);
      // drift
      for (let i = 0; i < S.n; i++) { px[i] += vx[i] * h; py[i] += vy[i] * h; pz[i] += vz[i] * h; }
      for (let g = 0; g < 2; g++) { cx[g] += cvx[g] * h; cy[g] += cvy[g] * h; cz[g] += cvz[g] * h; }
      accStars(); accCores();
      // kick (반걸음)
      for (let i = 0; i < S.n; i++) { vx[i] += ax[i] * hh; vy[i] += ay[i] * hh; vz[i] += az[i] * hh; }
      for (let g = 0; g < 2; g++) { cvx[g] += cax[g] * hh; cvy[g] += cay[g] * hh; cvz[g] += caz[g] * hh; }
      friction(hh);
      S.t++;
      if (P.count) countClose();
      const s = sep();
      if (s < S.minSep) S.minSep = s;
      if (lastSep < prevSep && lastSep <= s) S.peri.push({ t: S.t - 1, r: lastSep });   // 가장 가까웠던 때(근접 통과)
      prevSep = lastSep; lastSep = s;
      if (S.merged == null && s < C.RMERGE) S.merged = S.t;
      if (S.t % C.SAMPLE === 0) record();
      if (S.t >= S.steps) S.done = true;
      return !S.done;
    }
    // 에너지(검증용): 두 중심의 운동 + 위치 에너지
    function coreEnergy() {
      const k = 0.5 * M[0] * (cvx[0] ** 2 + cvy[0] ** 2 + cvz[0] ** 2) + 0.5 * M[1] * (cvx[1] ** 2 + cvy[1] ** 2 + cvz[1] ** 2);
      const d2 = (cx[1] - cx[0]) ** 2 + (cy[1] - cy[0]) ** 2 + (cz[1] - cz[0]) ** 2 + AC2;
      return k - M[0] * M[1] / Math.sqrt(d2);
    }
    // 별 하나의 에너지(두 중심의 퍼텐셜 안에서, 검증용)
    function starEnergy(i) {
      const k = 0.5 * (vx[i] ** 2 + vy[i] ** 2 + vz[i] ** 2); let u = 0;
      for (let g = 0; g < 2; g++) { const d2 = (px[i] - cx[g]) ** 2 + (py[i] - cy[g]) ** 2 + (pz[i] - cz[g]) ** 2 + A[g] * A[g]; u -= M[g] / Math.sqrt(d2); }
      return k + u;
    }
    function momentum() { return [M[0] * cvx[0] + M[1] * cvx[1], M[0] * cvy[0] + M[1] * cvy[1], M[0] * cvz[0] + M[1] * cvz[1]]; }
    function shrink(n2) { S.n = Math.max(20, Math.min(S.n, Math.round(n2))); }
    function timeTurns(t) { return t * C.DT / TURN; }
    S.step = step; S.sep = sep; S.coreEnergy = coreEnergy; S.starEnergy = starEnergy; S.momentum = momentum; S.shrink = shrink; S.turns = timeTurns;
    record();
    return S;
  }
  // 집계용: 한 판을 끝까지 돌려 요약
  function summary(opt) {
    const s = create(opt); let maxTail = 0;
    while (s.step()) { if (s.last.tail > maxTail) maxTail = s.last.tail; }
    const L = s.last;
    return { tail: L.tail, tailA: L.tailA, tailB: L.tailB, maxTail, merged: s.merged == null ? null : s.turns(s.merged), close: s.close.slice(), s0: s.s0, peri: s.peri.length ? s.peri[0].r : null, n: s.n };
  }
  return { create, summary, DEFAULTS, C, TURN, mulberry32 };
});
