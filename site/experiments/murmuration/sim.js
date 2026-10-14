// 찌르레기 떼 군무: 3D 보이드(Reynolds 1987) 모델. 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32), 고정 dt(한 걸음).
// 새마다 세 규칙만 따른다: ① 붙기(이웃 무게중심 쪽으로) ② 맞추기(이웃과 방향 맞춤) ③ 피하기(너무 가까운 이웃에서 멀어짐).
// 리더도 전체 계획도 없다. 속도는 거의 일정하고 한 걸음에 돌 수 있는 각도는 제한된다. 매가 오면 ④ 도망가기가 더해진다.
// 이웃: 'topo' = 가장 가까운 k마리(위상 이웃), 'metric' = 일정 거리(RM) 안의 모두(거리 이웃). 이웃 검색은 공간 격자(칸 G)로 O(N)에 가깝게.
// 모든 상수는 이 프로젝트가 정한 무차원 설정이다(길이 단위 = 새 몸길이 정도, 시간 단위 = 한 걸음).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Murmuration = factory();
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
  const C0 = {
    RX: 70, RY: 30,          // 하늘(납작한 공) 가로·세로 반지름: 이 밖으로 나가면 안쪽으로 강하게 되돌린다
    R0: 22,                  // 처음에 새들이 흩어져 있는 공의 반지름
    HEAD0: 0.8,              // 처음 방향: 한쪽(+x)으로 살짝 치우친 제각각 방향 (처음 방향 맞음 약 40)
    V0: 0.35,                // 평소 속도 (한 걸음에 움직이는 거리)
    TURN: 0.11,              // 한 걸음 최대 회전각 (라디안)
    G: 3,                    // 격자 칸 크기(최소)
    RMAX: 24,                // 위상 이웃을 찾는 최대 거리 (시야 한계)
    RM: 2.9,                 // 거리 이웃 반경 (보통 밀도에서 이웃이 위상 이웃과 비슷한 수가 되게)
    DSEP: 1.6,               // 피하기가 작동하는 거리
    RCOH: 4,                 // 붙기 힘이 최대가 되는 거리
    KC: 0.09, KA: 0.22, KS: 0.55,   // 붙기·맞추기·피하기 기본 세기 (슬라이더 100%일 때)
    KR: 0.01, KB: 0.5,       // 하늘 가운데(잠자리) 쪽으로 약하게 끌리는 힘, 하늘 밖에서 되돌리는 힘
    NOISE: 0.2,              // 새마다 걸음마다 더해지는 작은 흔들림
    LINK: 3,                 // 덩어리: 이 거리 안이면 이어진 것으로 본다
    SAMPLE: 5,               // 지표 기록 간격 (걸음)
    HAWK_V: 0.62, HAWK_TURN: 0.05, FEAR: 12, KF: 0.8, DIVE: 260, LEAVE: 160,   // 매: 속도, 회전각, 새가 놀라는 거리, 도망 힘, 돌진·떠남 걸음
  };
  const DEFAULTS = { n: 1500, k: 7, mode: 'topo', coh: 100, ali: 100, sep: 100, seed: 1, steps: 2400 };

  // 하늘에 고르게 흩어졌을 때의 "중심에서 평균 거리" (뭉친 정도 0의 기준). 정해진 난수로 한 번 계산
  const C = C0;
  const REF = (function () {
    const r = mulberry32(777); let s = 0, n = 0;
    while (n < 40000) { const x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1; if (x * x + y * y + z * z > 1) continue; s += Math.sqrt((x * C.RX) ** 2 + (y * C.RY) ** 2 + (z * C.RX) ** 2); n++; }
    return s / n;
  })();

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const C = Object.assign({}, C0, P.c || {});   // (조정용) 상수 덮어쓰기
    const N = Math.max(2, Math.round(P.n)), K = Math.max(1, Math.min(30, Math.round(P.k)));
    const rnd = mulberry32((P.seed | 0) * 7919 + 13);
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
    const hx = new Float64Array(N), hy = new Float64Array(N), hz = new Float64Array(N), sp = new Float64Array(N);
    const ox = new Float64Array(N), oy = new Float64Array(N), oz = new Float64Array(N);   // 한 걸음 전 위치 (화면 보간용)
    const nhx = new Float64Array(N), nhy = new Float64Array(N), nhz = new Float64Array(N);
    const fear = new Float32Array(N);   // 매에게 놀란 정도 (그림용 + 속도)
    // 처음: 하늘 가운데 넓은 공 안에 제각각 방향으로 흩어져 있다
    for (let i = 0; i < N; i++) {
      let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
      px[i] = x * C.R0; py[i] = y * C.R0 * 0.6; pz[i] = z * C.R0;
      let a = C.HEAD0 + gauss(), b = gauss() * 0.5, c = gauss(); const l = Math.sqrt(a * a + b * b + c * c) || 1;
      hx[i] = a / l; hy[i] = b / l; hz[i] = c / l; sp[i] = C.V0;
    }
    // 격자
    // 격자: 매 걸음 새들이 있는 범위에 맞춰 다시 잡는다(한 축 최대 GMAX칸, 넘으면 칸을 키운다)
    const GMAX = 64, NCMAX = GMAX * GMAX * GMAX;
    let GX = 1, GY = 1, GZ = 1, NC = 1, GC = C.G, gx0 = 0, gy0 = 0, gz0 = 0;
    const cellStart = new Int32Array(NCMAX + 1), cellOf = new Int32Array(N), order = new Int32Array(N), cnt = new Int32Array(NCMAX);
    const cix = (v) => { const c = Math.floor((v - gx0) / GC); return c < 0 ? 0 : c >= GX ? GX - 1 : c; };
    const ciy = (v) => { const c = Math.floor((v - gy0) / GC); return c < 0 ? 0 : c >= GY ? GY - 1 : c; };
    const ciz = (v) => { const c = Math.floor((v - gz0) / GC); return c < 0 ? 0 : c >= GZ ? GZ - 1 : c; };
    function buildGrid() {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < S.n; i++) { const x = px[i], y = py[i], z = pz[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      GC = Math.max(C.G, (x1 - x0) / GMAX * 1.0001, (y1 - y0) / GMAX * 1.0001, (z1 - z0) / GMAX * 1.0001);
      gx0 = x0; gy0 = y0; gz0 = z0;
      GX = Math.min(GMAX, Math.floor((x1 - x0) / GC) + 1); GY = Math.min(GMAX, Math.floor((y1 - y0) / GC) + 1); GZ = Math.min(GMAX, Math.floor((z1 - z0) / GC) + 1); NC = GX * GY * GZ;
      for (let c = 0; c < NC; c++) cnt[c] = 0;
      for (let i = 0; i < S.n; i++) { const c = (cix(px[i]) * GY + ciy(py[i])) * GZ + ciz(pz[i]); cellOf[i] = c; cnt[c]++; }
      let s = 0; for (let c = 0; c < NC; c++) { cellStart[c] = s; s += cnt[c]; } cellStart[NC] = s;
      for (let c = 0; c < NC; c++) cnt[c] = 0;
      for (let i = 0; i < S.n; i++) { const c = cellOf[i]; order[cellStart[c] + cnt[c]++] = i; }
    }
    const KMAXBUF = 256;
    const nbI = new Int32Array(KMAXBUF), nbD = new Float64Array(KMAXBUF);
    // i의 이웃을 nbI/nbD(거리²)에 채우고 개수를 돌려준다
    function neighbors(i) {
      const x = px[i], y = py[i], z = pz[i];
      const cx = cix(x), cy = ciy(y), cz = ciz(z);
      let m = 0;
      if (S.params.mode === 'metric') {
        const R2 = C.RM * C.RM, s = Math.ceil(C.RM / GC);
        for (let dx = -s; dx <= s; dx++) { const a = cx + dx; if (a < 0 || a >= GX) continue;
          for (let dy = -s; dy <= s; dy++) { const b = cy + dy; if (b < 0 || b >= GY) continue;
            for (let dz = -s; dz <= s; dz++) { const c = cz + dz; if (c < 0 || c >= GZ) continue;
              const cell = (a * GY + b) * GZ + c;
              for (let q = cellStart[cell], e = cellStart[cell + 1]; q < e; q++) {
                const j = order[q]; if (j === i) continue;
                const ux = px[j] - x, uy = py[j] - y, uz = pz[j] - z, d2 = ux * ux + uy * uy + uz * uz;
                if (d2 < R2 && m < KMAXBUF) { nbI[m] = j; nbD[m] = d2; m++; }
              }
            } } }
        return m;
      }
      // 위상 이웃: 껍질을 한 겹씩 넓혀 가며 가장 가까운 K마리를 찾는다
      const smax = Math.ceil(C.RMAX / GC), R2max = C.RMAX * C.RMAX;
      for (let s = 0; s <= smax; s++) {
        for (let dx = -s; dx <= s; dx++) { const a = cx + dx; if (a < 0 || a >= GX) continue; const ex = dx === -s || dx === s;
          for (let dy = -s; dy <= s; dy++) { const b = cy + dy; if (b < 0 || b >= GY) continue; const ey = ex || dy === -s || dy === s;
            for (let dz = -s; dz <= s; dz++) {
              if (!ey && dz !== -s && dz !== s) { dz = s - 1; continue; }   // 껍질이 아닌 안쪽 칸은 건너뛴다
              const c = cz + dz; if (c < 0 || c >= GZ) continue;
              const cell = (a * GY + b) * GZ + c;
              for (let q = cellStart[cell], e = cellStart[cell + 1]; q < e; q++) {
                const j = order[q]; if (j === i) continue;
                const ux = px[j] - x, uy = py[j] - y, uz = pz[j] - z, d2 = ux * ux + uy * uy + uz * uz;
                if (d2 > R2max) continue;
                if (m < K) { let t = m++; while (t > 0 && nbD[t - 1] > d2) { nbD[t] = nbD[t - 1]; nbI[t] = nbI[t - 1]; t--; } nbD[t] = d2; nbI[t] = j; }
                else if (d2 < nbD[K - 1]) { let t = K - 1; while (t > 0 && nbD[t - 1] > d2) { nbD[t] = nbD[t - 1]; nbI[t] = nbI[t - 1]; t--; } nbD[t] = d2; nbI[t] = j; }
              }
            } } }
        const rs = s * GC; if (m >= K && nbD[K - 1] <= rs * rs) break;
      }
      return m;
    }

    const cosT = Math.cos(C.TURN), sinT = Math.sin(C.TURN), cosH = Math.cos(C.HAWK_TURN), sinH = Math.sin(C.HAWK_TURN);
    // 방향 (ax,ay,az)를 목표 (tx,ty,tz) 쪽으로 최대 회전각까지만 돌린다. 결과는 out[0..2]
    const out = [0, 0, 0];
    function turn(ax, ay, az, tx, ty, tz, cs, sn) {
      let l = Math.sqrt(tx * tx + ty * ty + tz * tz); if (l < 1e-12) { out[0] = ax; out[1] = ay; out[2] = az; return; }
      tx /= l; ty /= l; tz /= l;
      const d = ax * tx + ay * ty + az * tz;
      if (d >= cs) { out[0] = tx; out[1] = ty; out[2] = tz; return; }
      let qx = tx - ax * d, qy = ty - ay * d, qz = tz - az * d; l = Math.sqrt(qx * qx + qy * qy + qz * qz);
      if (l < 1e-9) { qx = -ay; qy = ax; qz = 0; l = Math.sqrt(qx * qx + qy * qy) || 1; }   // 정반대 방향이면 아무 옆쪽으로
      qx /= l; qy /= l; qz /= l;
      let rx = ax * cs + qx * sn, ry = ay * cs + qy * sn, rz = az * cs + qz * sn; l = Math.sqrt(rx * rx + ry * ry + rz * rz);
      out[0] = rx / l; out[1] = ry / l; out[2] = rz / l;
    }

    const S = {
      n: N, params: P, C, t: 0, done: false,
      px, py, pz, hx, hy, hz, sp, ox, oy, oz, fear,
      hawk: null, events: [], hist: { pol: [], coh: [], clu: [], big: [] }, last: null, recover: null, nbSum: 0, nbCount: 0,
    };
    const wc = () => (S.params.coh / 100) * C.KC, wa = () => (S.params.ali / 100) * C.KA, ws = () => (S.params.sep / 100) * C.KS;

    function step() {
      if (S.t >= P.steps) { S.done = true; return false; }
      const n = S.n; buildGrid();
      const Wc = wc(), Wa = wa(), Ws = ws(), H = S.hawk;
      let nbTot = 0;
      for (let i = 0; i < n; i++) {
        const m = neighbors(i); nbTot += m;
        const x = px[i], y = py[i], z = pz[i], ax = hx[i], ay = hy[i], az = hz[i];
        let sx = 0, sy = 0, sz = 0;
        if (m > 0) {
          let cx = 0, cy = 0, cz = 0, mx = 0, my = 0, mz = 0, qx = 0, qy = 0, qz = 0;
          for (let t = 0; t < m; t++) {
            const j = nbI[t]; cx += px[j]; cy += py[j]; cz += pz[j]; mx += hx[j]; my += hy[j]; mz += hz[j];
            const d2 = nbD[t];
            if (d2 < C.DSEP * C.DSEP && d2 > 1e-12) { const d = Math.sqrt(d2), w = (1 - d / C.DSEP) / d; qx += (x - px[j]) * w; qy += (y - py[j]) * w; qz += (z - pz[j]) * w; }
          }
          // ① 붙기: 이웃 무게중심 쪽으로 (거리 RCOH에서 최대)
          let gx = cx / m - x, gy = cy / m - y, gz = cz / m - z; const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
          if (gl > C.RCOH) { const f = C.RCOH / gl; gx *= f; gy *= f; gz *= f; }
          sx += Wc * gx / C.RCOH; sy += Wc * gy / C.RCOH; sz += Wc * gz / C.RCOH;
          // ② 맞추기: 이웃 평균 방향과의 차이만큼
          sx += Wa * (mx / m - ax); sy += Wa * (my / m - ay); sz += Wa * (mz / m - az);
          // ③ 피하기
          sx += Ws * qx; sy += Ws * qy; sz += Ws * qz;
        }
        // 하늘 경계: 납작한 공 밖으로 나가면 안쪽으로
        const e = Math.sqrt((x / C.RX) ** 2 + (y / C.RY) ** 2 + (z / C.RX) ** 2);
        // 둥지 쪽으로 약하게 끌림(멀수록 셈) + 하늘 밖이면 강하게 되돌림
        { const f = C.KR + (e > 1 ? C.KB * (e - 1) : 0); sx -= f * x / C.RX; sy -= f * y / C.RY; sz -= f * z / C.RX; }
        // ④ 매에게서 도망가기
        let fr = 0;
        if (H) {
          const ux = x - H.x, uy = y - H.y, uz = z - H.z, d = Math.sqrt(ux * ux + uy * uy + uz * uz);
          if (d < C.FEAR && d > 1e-9) { fr = 1 - d / C.FEAR; const f = C.KF * fr / d; sx += ux * f; sy += uy * f; sz += uz * f; }
        }
        fear[i] = Math.max(fr, fear[i] * 0.97);
        // 작은 흔들림 (완벽히 똑같은 움직임을 깨는 정도)
        sx += C.NOISE * (rnd() * 2 - 1); sy += C.NOISE * (rnd() * 2 - 1); sz += C.NOISE * (rnd() * 2 - 1);
        turn(ax, ay, az, ax + sx, ay + sy, az + sz, cosT, sinT);
        nhx[i] = out[0]; nhy[i] = out[1]; nhz[i] = out[2];
        sp[i] += (C.V0 * (1 + 0.6 * fear[i]) - sp[i]) * 0.15;
      }
      S.nbSum += nbTot / n; S.nbCount++;
      for (let i = 0; i < n; i++) {
        ox[i] = px[i]; oy[i] = py[i]; oz[i] = pz[i];
        hx[i] = nhx[i]; hy[i] = nhy[i]; hz[i] = nhz[i];
        px[i] += hx[i] * sp[i]; py[i] += hy[i] * sp[i]; pz[i] += hz[i] * sp[i];
      }
      if (H) moveHawk(H);
      S.t++;
      if (S.t % C.SAMPLE === 0) record();
      if (S.t >= P.steps) S.done = true;
      return true;
    }

    // ---------- 매 ----------
    function centroid() { let x = 0, y = 0, z = 0; for (let i = 0; i < S.n; i++) { x += px[i]; y += py[i]; z += pz[i]; } return [x / S.n, y / S.n, z / S.n]; }
    function sendHawk() {
      if (S.hawk || S.done) return false;
      const c = centroid(), a = rnd() * Math.PI * 2;
      const x = c[0] + Math.cos(a) * 55, z = c[2] + Math.sin(a) * 55, y = Math.min(C.RY * 1.2, c[1] + 22);
      const dx = c[0] - x, dy = c[1] - y, dz = c[2] - z, l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      S.hawk = { x, y, z, ox: x, oy: y, oz: z, hx: dx / l, hy: dy / l, hz: dz / l, phase: 'dive', age: 0, passed: false };
      const m = S.last || measure();
      S.events.push({ type: 'hawk', t: S.t });
      S.pre = { pol: m.pol, clu: m.clu }; S.recover = null; S.leaveT = null;
      return true;
    }
    function moveHawk(H) {
      H.ox = H.x; H.oy = H.y; H.oz = H.z; H.age++;
      if (H.phase === 'dive') {
        const c = centroid(), dx = c[0] - H.x, dy = c[1] - H.y, dz = c[2] - H.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 4) H.passed = true;
        if (!H.passed) { turn(H.hx, H.hy, H.hz, dx, dy, dz, cosH, sinH); H.hx = out[0]; H.hy = out[1]; H.hz = out[2]; }
        if (H.age >= C.DIVE || (H.passed && d > 30)) { H.phase = 'leave'; H.age = 0; S.leaveT = S.t; S.events.push({ type: 'leave', t: S.t }); }
      } else {
        turn(H.hx, H.hy, H.hz, H.hx, 0.6, H.hz, cosH, sinH); H.hx = out[0]; H.hy = out[1]; H.hz = out[2];
        if (H.age >= C.LEAVE) { S.hawk = null; return; }
      }
      H.x += H.hx * C.HAWK_V; H.y += H.hy * C.HAWK_V; H.z += H.hz * C.HAWK_V;
    }

    // ---------- 지표 ----------
    const parent = new Int32Array(N), size = new Int32Array(N);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    function measure() {
      const n = S.n; let sx = 0, sy = 0, sz = 0;
      for (let i = 0; i < n; i++) { sx += hx[i]; sy += hy[i]; sz += hz[i]; }
      const pol = (100 * Math.sqrt(sx * sx + sy * sy + sz * sz)) / n;   // ① 방향이 맞은 정도 0~100
      const c = centroid(); let md = 0;
      for (let i = 0; i < n; i++) md += Math.sqrt((px[i] - c[0]) ** 2 + (py[i] - c[1]) ** 2 + (pz[i] - c[2]) ** 2);
      md /= n;
      const coh = Math.max(0, 100 * (1 - md / REF));                      // ② 뭉친 정도 0~100 (하늘에 고르게 흩어짐 = 0)
      // ③ 덩어리 수: LINK 거리 안이면 이어진 것, 작은 무리는 세지 않음
      buildGrid();
      for (let i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
      const L2 = C.LINK * C.LINK;
      for (let i = 0; i < n; i++) {
        const x = px[i], y = py[i], z = pz[i], cx = cix(x), cy = ciy(y), cz = ciz(z);
        for (let dx = -1; dx <= 1; dx++) { const a = cx + dx; if (a < 0 || a >= GX) continue;
          for (let dy = -1; dy <= 1; dy++) { const b = cy + dy; if (b < 0 || b >= GY) continue;
            for (let dz = -1; dz <= 1; dz++) { const cc = cz + dz; if (cc < 0 || cc >= GZ) continue;
              const cell = (a * GY + b) * GZ + cc;
              for (let q = cellStart[cell], e = cellStart[cell + 1]; q < e; q++) {
                const j = order[q]; if (j <= i) continue;
                const ux = px[j] - x, uy = py[j] - y, uz = pz[j] - z;
                if (ux * ux + uy * uy + uz * uz < L2) { let ra = find(i), rb = find(j); if (ra !== rb) { if (size[ra] < size[rb]) { const t = ra; ra = rb; rb = t; } parent[rb] = ra; size[ra] += size[rb]; } }
              }
            } } }
      }
      const minSize = minCluster(n); let clu = 0, big = 0;
      for (let i = 0; i < n; i++) if (parent[i] === i) { if (size[i] >= minSize) clu++; if (size[i] > big) big = size[i]; }
      return { t: S.t, pol, coh, md, clu, big: big / n };
    }
    function record() {
      const m = measure(); S.last = m;
      S.hist.pol.push(m.pol); S.hist.coh.push(m.coh); S.hist.clu.push(m.clu); S.hist.big.push(m.big);
      if (S.leaveT != null && S.recover == null && S.pre) {
        if (m.clu <= Math.max(1, S.pre.clu) && m.pol >= S.pre.pol - 10) { S.recover = S.t - S.leaveT; S.events.push({ type: 'back', t: S.t }); }
      }
    }
    // 덩어리 밀도를 갑자기 바꾸기(검증용): 무리 중심을 지나는 수직면 한쪽의 새들을 중심에서 f배 멀리 옮긴다
    function spreadHalf(f) {
      const c = centroid(); let sx = 0, sz = 0; for (let i = 0; i < S.n; i++) { sx += hx[i]; sz += hz[i]; }
      const l = Math.sqrt(sx * sx + sz * sz) || 1, ux = -sz / l, uz = sx / l;   // 나는 방향에 수직인 수평 방향
      for (let i = 0; i < S.n; i++) {
        if ((px[i] - c[0]) * ux + (pz[i] - c[2]) * uz <= 0) continue;
        px[i] = c[0] + (px[i] - c[0]) * f; py[i] = c[1] + (py[i] - c[1]) * f; pz[i] = c[2] + (pz[i] - c[2]) * f;
        ox[i] = px[i]; oy[i] = py[i]; oz[i] = pz[i];
      }
    }
    // 새 수 줄이기 (휴대폰에서 너무 느릴 때). 앞쪽 새만 남긴다
    function shrink(n2) { S.n = Math.max(2, Math.min(S.n, Math.round(n2))); }
    S.step = step; S.measure = measure; S.sendHawk = sendHawk; S.spreadHalf = spreadHalf; S.shrink = shrink; S.centroid = centroid;
    S.avgNeighbors = () => (S.nbCount ? S.nbSum / S.nbCount : 0);
    S.last = measure(); S.hist.pol.push(S.last.pol); S.hist.coh.push(S.last.coh); S.hist.clu.push(S.last.clu); S.hist.big.push(S.last.big);
    return S;
  }
  function minCluster(n) { return Math.max(10, Math.ceil(n * 0.03)); }

  // 집계용: 한 판을 steps까지 돌려 마지막 구간(tail 걸음) 평균 지표를 돌려준다
  function summary(opt, tail) {
    const s = create(opt); tail = tail || 300;
    const acc = { pol: 0, coh: 0, clu: 0, big: 0, k: 0 };
    while (s.step()) {
      if (s.t % C.SAMPLE === 0 && s.t > s.params.steps - tail) { const m = s.last; acc.pol += m.pol; acc.coh += m.coh; acc.clu += m.clu; acc.big += m.big; acc.k++; }
    }
    return { pol: acc.pol / acc.k, coh: acc.coh / acc.k, clu: acc.clu / acc.k, big: acc.big / acc.k, nb: s.avgNeighbors() };
  }
  return { create, summary, DEFAULTS, C, REF, minCluster, mulberry32 };
});
