// ① 지도 위 3D 도시: app.js가 window.BraessState로 내보내는 같은 sim을 그대로 보여 준다(3D에서 새로 계산하지 않음).
// - 바닥: 연한 지도 느낌의 평면(땅·골목 격자·공원·강), 낮은 건물은 인스턴스드 상자, 그림자는 바닥에 깐 옅은 판(조명 그림자 없음)
// - 도로 4개 + 지름길: 흰 도로 + 걸리는 시간 색 테두리(2D와 같은 heat 함수) + 연회색 바깥 테두리. 막히는 두 길은 조금 넓다
// - 지름길 = 강을 건너는 들리는 다리: sim.open만 읽어 상판이 1초 안팎으로 내려오거나 들린다
// - 차: 지금 라운드의 길 선택 비율(sim.counts)만큼 길에 나눠 놓고, 각 구간을 그 구간의 지금 시간(분)에 비례하는 시간 동안 지나간다.
//   차가 길을 바꾸는 것은 출발점(바퀴의 시작)과 A 교차로에서만(보기용 표시일 뿐 운전자 개개인의 경로 계산이 아님)
// - 노란 차: 판마다 고정된 운전자 한 명(sim.routeOf(follow))의 길을 다음 바퀴부터 따라간다
// - 시계(캔버스 밖 HTML 오버레이): 바늘 = sim.avgNow() (app.js가 계산한 지금 라운드의 평균)
// - 낮/밤(b3-time): 밤에는 바닥·도로가 어두워지고 차의 앞불·뒷불(빛나는 작은 판)만 보인다. 조명 추가 없음
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.BraessState;
const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

// ---------- 지도 배치 (월드 좌표: x = 동서, z = 남북, 화면 위쪽 = -z) ----------
const NODE = { S: [-12, 0], E: [12, 0], A: [0, -7], B: [0, 7] };
const RIVER_W = 2.0;
const RIVER = [[-70, 42], [-40, 25], [-13, 8.6], [-7, 5.4], [-3, 2.0], [0, 0], [3, -2.0], [7, -5.4], [13, -8.6], [23, -13.4], [40, -25], [70, -42]];
// 구간: 0 출발→A(막힘), 1 A→도착(고정), 2 출발→B(고정), 3 B→도착(막힘), 4 지름길 A→B
const LINKS = [
  { pts: [NODE.S, [-11.3, -3.2], [-8.6, -5.9], [-4.6, -7.0], NODE.A], w: 1.0, lanes: 3 },
  { pts: [NODE.A, [4.4, -6.8], [8.8, -5.2], [11.3, -2.8], NODE.E], w: 0.72, lanes: 2 },
  { pts: [NODE.S, [-11.2, 3.0], [-8.8, 5.6], [-4.6, 6.9], NODE.B], w: 0.72, lanes: 2 },
  { pts: [NODE.B, [4.6, 7.0], [8.6, 5.9], [11.3, 3.2], NODE.E], w: 1.0, lanes: 3 },
  { pts: [NODE.A, [0, -3.5], [0, 0], [0, 3.5], NODE.B], w: 0.72, lanes: 2, straight: true },
];
const ROUTES = [[0, 1], [2, 3], [0, 4, 3]]; // A 길, B 길, 지름길 경유
const BR = 1.6;           // 다리 상판 반 길이 (z = -BR ~ BR)
const TMIN = 6;           // 보기용 최소 시간(분): 0분 지름길도 건너는 모습이 보이게
const K = 0.14;           // 1분 = 0.14초로 보여 준다 (보기용 축척)
const Y = { grid: 0, park: 0, river: 0, deck: 0, road: 0.03, car: 0.03 };

// 낮/밤 색
const PAL = {
  day: { bg: '#eef1f4', ground: '#f2efe8', grid: '#ffffff', park: '#cfe6c3', river: '#a9d3f2', bank: '#c3dff2', casing: '#c6ccd4', core: '#ffffff', deck: '#b9c1cb', bld: '#ffffff', bldSide: 1, shadow: 0.1, plaza: '#ffffff', rimK: 1 },
  night: { bg: '#0c1322', ground: '#151c2b', grid: '#1d2536', park: '#17251f', river: '#10263d', bank: '#132b44', casing: '#252d3b', core: '#2c3443', deck: '#2a3240', bld: '#2a3343', bldSide: 1, shadow: 0.25, plaza: '#2c3443', rimK: 0.5 },
};

// ---------- 곡선 도구 ----------
function curveLUT(pts, straight, N = 240) {
  const v3 = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const cv = straight ? new THREE.LineCurve3(v3[0], v3[v3.length - 1]) : new THREE.CatmullRomCurve3(v3, false, 'centripetal');
  const P = cv.getSpacedPoints(N - 1);
  const X = new Float32Array(N), Z = new Float32Array(N), A = new Float32Array(N);
  let len = 0;
  for (let i = 0; i < N; i++) {
    X[i] = P[i].x; Z[i] = P[i].z;
    if (i) len += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
  }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); A[i] = Math.atan2(Z[b] - Z[a], X[b] - X[a]); }
  return { X, Z, A, N, len };
}
function at(L, u, out) { // u: 0..1 → [x, z, 방향각]
  const f = Math.max(0, Math.min(0.99999, u)) * (L.N - 1), i = f | 0, r = f - i;
  out[0] = L.X[i] + (L.X[i + 1] - L.X[i]) * r; out[1] = L.Z[i] + (L.Z[i + 1] - L.Z[i]) * r; out[2] = L.A[i];
  return out;
}
// 리본(평면 띠) 만들기: 곡선을 따라 폭 w, 높이 y. from~to 범위만
function ribbon(L, w, y, from = 0, to = 1) {
  const i0 = Math.round(from * (L.N - 1)), i1 = Math.round(to * (L.N - 1)), n = i1 - i0 + 1;
  const pos = new Float32Array(n * 6), idx = [];
  for (let k = 0; k < n; k++) {
    const i = i0 + k, a = L.A[i], nx = -Math.sin(a) * w / 2, nz = Math.cos(a) * w / 2;
    pos.set([L.X[i] + nx, y, L.Z[i] + nz, L.X[i] - nx, y, L.Z[i] - nz], k * 6);
    if (k) { const p = (k - 1) * 2; idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const distToPoly = (x, z, P) => {
  let best = Infinity;
  for (let i = 1; i < P.length; i++) {
    const [ax, az] = P[i - 1], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
};

// 꼭짓점이 겹치지 않는 여러 상자를 한 모양으로 합친다
function mergeBoxes(list) {
  const geos = list.map(([w, h, d, x, y, z]) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); return g; });
  let n = 0; geos.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  geos.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

function init(v, narrow) {
  const { scene, camera, controls } = v;
  const lights = scene.children.filter((o) => o.isLight);
  const hemi = lights.find((o) => o.isHemisphereLight), sun = lights.find((o) => o.isDirectionalLight);
  if (sun) sun.position.set(-6, 14, 9);
  const CAP = narrow ? 350 : 900;
  const flat = (color, order, opts = {}) => new THREE.MeshBasicMaterial(Object.assign({ color, depthWrite: false, depthTest: false, side: THREE.DoubleSide }, opts));
  const addFlat = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; scene.add(m); return m; };
  const mats = {};

  // ---------- 바닥: 땅 · 골목 격자 · 공원 · 강 ----------
  const GW = 130, GD = 90;   // 멀리까지 땅이 보이게 넉넉히
  const ground = new THREE.PlaneGeometry(GW, GD); ground.rotateX(-Math.PI / 2);
  mats.ground = flat(PAL.day.ground); addFlat(ground, mats.ground, -20);
  // 골목: 2칸마다 흰 선(아주 옅게 보이는 지도 격자)
  const gridG = new THREE.PlaneGeometry(1, 1); gridG.rotateX(-Math.PI / 2);
  const lines = [];
  for (let x = -63.8; x <= 64; x += 2.2) lines.push([x, 0, 0.09, GD]);
  for (let z = -44; z <= 44; z += 2.2) lines.push([0, z, GW, 0.09]);
  mats.grid = flat(PAL.day.grid);
  const grid = new THREE.InstancedMesh(gridG, mats.grid, lines.length);
  const dm = new THREE.Object3D();
  lines.forEach(([x, z, sx, sz], k) => { dm.position.set(x, 0, z); dm.scale.set(sx, 1, sz); dm.updateMatrix(); grid.setMatrixAt(k, dm.matrix); });
  grid.renderOrder = -19; scene.add(grid);
  // 공원: 모서리가 둥근 네모
  const PARKS = [[-5.0, -2.7, 4.2, 2.4], [5.2, 2.9, 4.0, 2.2], [-17, -8.5, 5, 3.4], [16.5, 8.8, 5.4, 3], [17, -9.5, 4, 2.6], [-16.5, 9.6, 4.4, 2.4]];
  mats.park = flat(PAL.day.park);
  PARKS.forEach(([cx, cz, w, d]) => {
    const r = 0.7, s = new THREE.Shape(), x0 = cx - w / 2, z0 = cz - d / 2;
    s.moveTo(x0 + r, z0); s.lineTo(x0 + w - r, z0); s.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r); s.lineTo(x0 + w, z0 + d - r); s.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d);
    s.lineTo(x0 + r, z0 + d); s.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r); s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
    const g = new THREE.ShapeGeometry(s, 6); g.rotateX(Math.PI / 2);
    addFlat(g, mats.park, -18);
  });
  // 강: 연한 하늘색 띠 + 더 옅은 강가
  const riverL = curveLUT(RIVER, false, 300);
  mats.bank = flat(PAL.day.bank); mats.river = flat(PAL.day.river);
  addFlat(ribbon(riverL, RIVER_W + 0.5, 0), mats.bank, -17);
  addFlat(ribbon(riverL, RIVER_W, 0), mats.river, -16);

  // ---------- 도로 ----------
  const LUT = LINKS.map((l) => curveLUT(l.pts, l.straight));
  mats.casing = flat(PAL.day.casing); mats.core = flat(PAL.day.core); mats.deck = flat(PAL.day.deck);
  const rimMats = LINKS.map(() => flat('#1fa463'));
  const bu = BR / LUT[4].len + 0.5;   // 지름길의 다리 구간 (u 기준) 끝
  LINKS.forEach((l, k) => {
    const L = LUT[k];
    // 고정 길이 강을 건너는 곳: 넓은 회색 상판(늘 놓인 다리)
    if (k === 1 || k === 2) {
      let i0 = -1, i1 = -1;
      for (let i = 0; i < L.N; i++) if (distToPoly(L.X[i], L.Z[i], RIVER) < RIVER_W / 2 + 0.35) { if (i0 < 0) i0 = i; i1 = i; }
      if (i0 >= 0) addFlat(ribbon(L, l.w + 0.75, 0, i0 / (L.N - 1), i1 / (L.N - 1)), mats.deck, -12);
    }
    const parts = k === 4 ? [[0, 0.5 - BR / L.len - 0.02], [0.5 + BR / L.len + 0.02, 1]] : [[0, 1]];
    parts.forEach(([a, b]) => {
      addFlat(ribbon(L, l.w + 0.56, 0, a, b), mats.casing, -11);
      addFlat(ribbon(L, l.w + 0.4, 0, a, b), rimMats[k], -10);
      addFlat(ribbon(L, l.w, 0, a, b), mats.core, -9);
    });
  });
  // 교차로 광장(A, B)과 출발·도착 둥근 판
  mats.plaza = flat(PAL.day.plaza);
  const ring = new THREE.RingGeometry(0.95, 1.18, 40); ring.rotateX(-Math.PI / 2);
  const disk = new THREE.CircleGeometry(0.98, 40); disk.rotateX(-Math.PI / 2);
  Object.values(NODE).forEach(([x, z]) => {
    const r = addFlat(ring.clone().translate(x, 0, z), mats.casing, -8);
    const d = addFlat(disk.clone().translate(x, 0, z), mats.plaza, -7);
  });

  // ---------- 건물 (낮은 흰 상자) + 바닥 그림자 ----------
  const rnd = (() => { let s = 20261015; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  const nearRoad = (x, z, pad) => LUT.some((L, k) => { for (let i = 0; i < L.N; i += 3) if (Math.hypot(L.X[i] - x, L.Z[i] - z) < LINKS[k].w / 2 + pad) return true; return false; });
  const inPark = (x, z, pad) => PARKS.some(([cx, cz, w, d]) => Math.abs(x - cx) < w / 2 + pad && Math.abs(z - cz) < d / 2 + pad);
  const nearNode = (x, z, r) => Object.values(NODE).some(([nx, nz]) => Math.hypot(nx - x, nz - z) < r);
  const BLD = [], BMAX = narrow ? 80 : 140;
  for (let gx = -21; gx <= 21 && BLD.length < 400; gx += 2.2) for (let gz = -13.4; gz <= 13.4; gz += 2.2) {
    const cx = gx + 1.1, cz = gz + 1.1, k = rnd() < 0.5 ? 1 : 2;
    for (let q = 0; q < k; q++) {
      const w = 0.6 + rnd() * 0.8, d = 0.6 + rnd() * 0.7, x = cx + (k === 2 ? (q ? 0.45 : -0.45) : (rnd() - 0.5) * 0.4), z = cz + (rnd() - 0.5) * 0.5, h = 0.18 + rnd() * rnd() * 1.1;
      if (Math.abs(x) > 21.5 || Math.abs(z) > 14) continue;
      if (nearRoad(x, z, Math.max(w, d) / 2 + 0.35) || inPark(x, z, 0.4) || nearNode(x, z, 3.4) || distToPoly(x, z, RIVER) < RIVER_W / 2 + 0.3 + Math.max(w, d) / 2) continue;
      BLD.push([x, z, w * (k === 2 ? 0.7 : 1), d, h]);
    }
  }
  // 가운데(도로 근처)에 가까운 건물부터 남긴다 (휴대폰은 더 적게)
  BLD.sort((a, b) => Math.hypot(a[0] * 0.8, a[1]) - Math.hypot(b[0] * 0.8, b[1]));
  BLD.length = Math.min(BLD.length, BMAX);
  const boxG = new THREE.BoxGeometry(1, 1, 1); boxG.translate(0, 0.5, 0);
  mats.bld = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const blds = new THREE.InstancedMesh(boxG, mats.bld, BLD.length);
  const shG = new THREE.PlaneGeometry(1, 1); shG.rotateX(-Math.PI / 2);
  mats.shadow = flat('#3b4250', -6, { transparent: true, opacity: PAL.day.shadow });
  const shadows = new THREE.InstancedMesh(shG, mats.shadow, BLD.length); shadows.renderOrder = -6;
  const bcol = new THREE.Color();
  BLD.forEach(([x, z, w, d, h], k) => {
    dm.position.set(x, 0, z); dm.rotation.set(0, 0, 0); dm.scale.set(w, h, d); dm.updateMatrix(); blds.setMatrixAt(k, dm.matrix);
    dm.position.set(x + h * 0.35, 0, z + h * 0.3); dm.scale.set(w + h * 0.25, 1, d + h * 0.2); dm.updateMatrix(); shadows.setMatrixAt(k, dm.matrix);
    const t = 0.88 + rnd() * 0.12; blds.setColorAt(k, bcol.setRGB(t, t, t * 1.01));
  });
  scene.add(shadows); scene.add(blds);
  // 출발: 집 몇 채(지붕 있는 작은 집), 도착: 사무 빌딩 몇 채
  const HOUSES = [[-13.9, -1.3], [-14.1, 0.5], [-13.5, 2.0], [-15.3, -0.4], [-15.0, 1.6], [-13.3, -2.7], [-15.4, -2.0], [-14.2, 3.1]];
  const houseG = new THREE.BoxGeometry(0.62, 0.36, 0.5); houseG.translate(0, 0.18, 0);
  const roofG = new THREE.ConeGeometry(0.5, 0.32, 4); roofG.rotateY(Math.PI / 4); roofG.translate(0, 0.52, 0);
  mats.house = new THREE.MeshLambertMaterial({ color: 0xfffaf2 }); mats.roof = new THREE.MeshLambertMaterial({ color: 0xe0875a });
  const houses = new THREE.InstancedMesh(houseG, mats.house, HOUSES.length), roofs = new THREE.InstancedMesh(roofG, mats.roof, HOUSES.length);
  const hsh = new THREE.InstancedMesh(shG, mats.shadow, HOUSES.length + 6); hsh.renderOrder = -6;
  HOUSES.forEach(([x, z], k) => {
    dm.position.set(x, 0, z); dm.rotation.set(0, (k % 3) * 0.25, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); houses.setMatrixAt(k, dm.matrix); roofs.setMatrixAt(k, dm.matrix);
    dm.position.set(x + 0.22, 0, z + 0.2); dm.scale.set(0.8, 1, 0.7); dm.updateMatrix(); hsh.setMatrixAt(k, dm.matrix);
  });
  scene.add(houses, roofs);
  const OFFICES = [[13.9, -1.1, 1.0, 2.6], [14.0, 1.0, 0.9, 1.9], [15.3, -0.1, 1.1, 3.2], [13.5, 2.6, 0.8, 1.3], [15.1, 2.1, 0.9, 1.6], [13.7, -2.9, 0.9, 1.5]];
  mats.office = new THREE.MeshLambertMaterial({ color: 0xd3deea });
  const offices = new THREE.InstancedMesh(boxG, mats.office, OFFICES.length);
  OFFICES.forEach(([x, z, s, h], k) => {
    dm.position.set(x, 0, z); dm.rotation.set(0, 0, 0); dm.scale.set(s, h, s); dm.updateMatrix(); offices.setMatrixAt(k, dm.matrix);
    dm.position.set(x + h * 0.3, 0, z + h * 0.25); dm.scale.set(s + h * 0.25, 1, s + h * 0.2); dm.updateMatrix(); hsh.setMatrixAt(HOUSES.length + k, dm.matrix);
  });
  scene.add(offices, hsh);
  // 교차로 표지(A, B): 작은 신호등 기둥
  mats.pole = new THREE.MeshLambertMaterial({ color: 0x6b7280 });
  const poleG = mergeBoxes([[0.08, 0.9, 0.08, 0, 0.45, 0], [0.18, 0.32, 0.12, 0, 0.95, 0]]);
  [NODE.A, NODE.B].forEach(([x, z]) => { const p = new THREE.Mesh(poleG, mats.pole); p.position.set(x + 1.15, 0, z + (z < 0 ? -0.6 : 0.6)); scene.add(p); });

  // ---------- 들리는 다리 (지름길) ----------
  mats.leaf = new THREE.MeshLambertMaterial({ color: 0x9aa4b2 });
  mats.leafEnd = new THREE.MeshLambertMaterial({ color: 0xe5484d });
  mats.leafTop = new THREE.MeshLambertMaterial({ color: 0xf4f6f8 });
  mats.tower = new THREE.MeshLambertMaterial({ color: 0xd9dde3 });
  mats.towerCap = new THREE.MeshLambertMaterial({ color: 0xc8553d });
  mats.boom = new THREE.MeshLambertMaterial({ color: 0xe5484d });
  const DW = 1.3; // 상판 폭
  const leafG = mergeBoxes([[DW, 0.1, BR, 0, 0.05, BR / 2]]);
  const stripeG = mergeBoxes([[DW * 0.86, 0.012, BR - 0.1, 0, 0.106, BR / 2]]);
  const endG = mergeBoxes([[DW, 0.14, 0.12, 0, 0.07, BR - 0.06]]);   // 상판 끝의 빨간 띠(들렸을 때 잘 보이게)
  const leaves = [-1, 1].map((sd) => { // sd = -1: A 쪽(북), +1: B 쪽(남)
    const g = new THREE.Group(); g.position.set(0, 0.1, sd * BR);
    const m = new THREE.Mesh(leafG, mats.leaf), s = new THREE.Mesh(stripeG, mats.leafTop), e = new THREE.Mesh(endG, mats.leafEnd);
    const inner = new THREE.Group(); inner.add(m, s, e); inner.rotation.y = sd < 0 ? 0 : Math.PI; // 상판이 가운데(z = 0)를 향하게
    g.add(inner); scene.add(g); return { g, sd };
  });
  // 다리 탑(양쪽 강가)과 차단봉
  const towerG = mergeBoxes([[0.26, 0.9, 0.26, 0, 0.45, 0]]), capG = mergeBoxes([[0.32, 0.16, 0.32, 0, 0.98, 0]]);
  [-1, 1].forEach((sd) => [-1, 1].forEach((sx) => {
    const t = new THREE.Mesh(towerG, mats.tower), c = new THREE.Mesh(capG, mats.towerCap);
    t.position.set(sx * (DW / 2 + 0.2), 0, sd * (BR + 0.12)); c.position.copy(t.position); scene.add(t, c);
  }));
  const boomG = mergeBoxes([[DW + 0.1, 0.07, 0.07, (DW + 0.1) / 2, 0, 0]]);
  const booms = [-1, 1].map((sd) => {
    const g = new THREE.Group(); g.position.set(-DW / 2 - 0.2, 0.45, sd * (BR + 0.5));
    g.add(new THREE.Mesh(boomG, mats.boom)); scene.add(g); return g;
  });
  // 닫혔을 때 보이는 반투명 점선 (다리가 이어질 자리)
  const dashG = new THREE.PlaneGeometry(0.16, 0.34); dashG.rotateX(-Math.PI / 2);
  mats.dash = new THREE.MeshBasicMaterial({ color: 0x5b6b80, transparent: true, opacity: 0.5, depthWrite: false });
  const dashes = new THREE.InstancedMesh(dashG, mats.dash, 5);
  for (let k = 0; k < 5; k++) { dm.position.set(0, 0.02, -BR + 0.3 + k * ((2 * BR - 0.6) / 4)); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); dashes.setMatrixAt(k, dm.matrix); }
  dashes.renderOrder = -5; scene.add(dashes);

  // ---------- 차 ----------
  const carG = mergeBoxes([[0.32, 0.11, 0.17, 0, 0.075, 0], [0.17, 0.08, 0.14, -0.02, 0.17, 0]]);
  mats.car = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cars = new THREE.InstancedMesh(carG, mats.car, CAP);
  cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cars.count = 0; scene.add(cars);
  const CARCOL = ['#ffffff', '#e9ecf0', '#c9ced6', '#8b94a3', '#4b5563', '#5b7fb8', '#a7b4c7', '#d8dde4'];
  const CARCOL_N = ['#3a4252', '#343b49', '#2e3542', '#3d4656', '#2b313d', '#343e52', '#394150', '#323947'];
  const dayCol = new THREE.Color(), tmpC = new THREE.Color();
  for (let i = 0; i < CAP; i++) cars.setColorAt(i, dayCol.set(CARCOL[i % CARCOL.length]));
  // 밤: 앞불(밝은 작은 판 두 개) + 앞쪽 빛 웅덩이 + 뒷불
  const headG = mergeBoxes([[0.03, 0.04, 0.045, 0.165, 0.09, -0.05], [0.03, 0.04, 0.045, 0.165, 0.09, 0.05]]);
  const tailG = mergeBoxes([[0.03, 0.035, 0.13, -0.165, 0.09, 0]]);
  const poolG = new THREE.PlaneGeometry(0.55, 0.2); poolG.rotateX(-Math.PI / 2); poolG.translate(0.45, 0.012, 0);
  mats.head = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  mats.tail = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  mats.pool = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
  const heads = new THREE.InstancedMesh(headG, mats.head, CAP + 1), tails = new THREE.InstancedMesh(tailG, mats.tail, CAP + 1), pools = new THREE.InstancedMesh(poolG, mats.pool, CAP + 1);
  [heads, tails, pools].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.visible = false; scene.add(m); });
  pools.renderOrder = 2;
  // 노란 차 + 위에 뜬 표지
  mats.yellow = new THREE.MeshLambertMaterial({ color: 0xffc400, emissive: 0x332200 });
  const yCar = new THREE.Mesh(carG, mats.yellow); yCar.scale.setScalar(1.55); scene.add(yCar);
  mats.pin = new THREE.MeshBasicMaterial({ color: 0xffb300 });
  const pin = new THREE.Group();
  const pinCone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 16), mats.pin); pinCone.rotation.x = Math.PI; pinCone.position.y = 0.18;
  const pinBall = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mats.pin); pinBall.position.y = 0.46;
  const pinDot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); pinDot.position.set(0, 0.46, 0); pinDot.scale.set(1, 1, 1);
  pin.add(pinCone, pinBall, pinDot); if (narrow) pin.scale.setScalar(1.5); scene.add(pin);

  // 차 상태: 길 r, 구간 순번 k, 구간 안 진행 u(0~1)
  let Ncar = 0;
  const cR = new Int8Array(CAP), cK = new Int8Array(CAP), cU = new Float32Array(CAP), cLane = new Int8Array(CAP), cJit = new Float32Array(CAP);
  const yc = { r: 0, k: 0, u: 0 };
  const routeCnt = [0, 0, 0], target = [0, 0, 0];
  let simRef = null, openAmt = 0, frozenOpen = null, yR = 0;
  const xz = [0, 0, 0];
  const linkT = (t) => Math.max(TMIN, t) * K; // 구간을 지나는 데 보여 주는 시간(초)

  function targets(sim) {
    const cn = sim.counts(), n = sim.params.n;
    let s = 0; for (let r = 0; r < 3; r++) { target[r] = Math.round((cn[r] / n) * Ncar); s += target[r]; }
    let big = 0; for (let r = 1; r < 3; r++) if (target[r] > target[big]) big = r;
    target[big] += Ncar - s; // 반올림 차이는 가장 많은 길에
  }
  function pickRoute(r, allowShort) { // 비율보다 많은 길의 차를 모자란 길로
    if (routeCnt[r] <= target[r] && (allowShort || r !== 2)) return r;
    let best = r, gap = 0;
    for (let q = 0; q < 3; q++) { if (q === 2 && !allowShort) continue; const g = target[q] - routeCnt[q]; if (g > gap) { gap = g; best = q; } }
    if (best === r && r === 2 && !allowShort) best = 0;
    return best;
  }
  function setRoute(i, q) { routeCnt[cR[i]]--; cR[i] = q; routeCnt[q]++; }
  function rebuild(sim) {
    simRef = sim;
    Ncar = Math.min(CAP, Math.max(30, Math.round(sim.params.n / 8)));
    targets(sim);
    const T = st0.linkTimes(); routeCnt.fill(0);
    let i = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < target[r]; c++, i++) {
      cR[i] = r; routeCnt[r]++;
      // 지금 걸리는 시간 기준으로 바퀴 안의 고른 위치에 흩어 놓는다(길게 걸리는 구간에 더 많이)
      const segs = ROUTES[r], tt = segs.map((s) => linkT(T[s])), tot = tt.reduce((a, b) => a + b, 0);
      let ph = ((c + 0.5) / Math.max(1, target[r]) + rnd() * 0.02) % 1 * tot, k = 0;
      while (k < segs.length - 1 && ph > tt[k]) { ph -= tt[k]; k++; }
      cK[i] = k; cU[i] = Math.min(0.999, ph / tt[k]);
    }
    for (let j = 0; j < Ncar; j++) { cLane[j] = j % 3; cJit[j] = (rnd() - 0.5) * 0.05; }
    cars.count = Ncar;
    yR = sim.routeOf(st0.follow); yc.r = yR; yc.k = 0; yc.u = 0.35;
    openAmt = sim.open ? 1 : 0;
  }

  // ---------- 낮 / 밤 ----------
  const tSel = $('b3-time'); let night = false;
  function applyTime() {
    night = !!tSel && tSel.value === 'night';
    const P = night ? PAL.night : PAL.day;
    scene.background = new THREE.Color(P.bg);
    ['ground', 'grid', 'park', 'river', 'bank', 'casing', 'core', 'deck', 'plaza'].forEach((k) => mats[k].color.set(P[k]));
    mats.shadow.opacity = P.shadow;
    mats.bld.color.set(P.bld); mats.house.color.set(night ? 0x2f3646 : 0xfffaf2); mats.roof.color.set(night ? 0x3a3236 : 0xe0875a);
    mats.office.color.set(night ? 0x2b3546 : 0xd3deea);
    mats.leaf.color.set(night ? 0x3a4352 : 0x9aa4b2); mats.leafTop.color.set(night ? 0x3d4554 : 0xf4f6f8);
    mats.tower.color.set(night ? 0x3a4250 : 0xd9dde3);
    if (hemi) { hemi.intensity = night ? 0.25 : 1.05; hemi.color.set(night ? 0x8fa6d8 : 0xffffff); }
    if (sun) sun.intensity = night ? 0.15 : 1.1;
    for (let i = 0; i < CAP; i++) cars.setColorAt(i, tmpC.set((night ? CARCOL_N : CARCOL)[i % CARCOL.length]));
    cars.instanceColor.needsUpdate = true;
    [heads, tails, pools].forEach((m) => { m.visible = night; });
    mats.yellow.emissive.set(night ? 0xb07800 : 0x332200);
    wrap.classList.toggle('b3-night', night); if (typeof clock !== 'undefined') clock._dirty = true;
    if (st0.thumb) v.render();
  }
  if (tSel) tSel.addEventListener('change', applyTime);
  const rot = $('b3-rotate');
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = rot.value === 'on'; });

  // ---------- 화면 위 이름표와 시계 (HTML, 3D 밖) ----------
  const labels = [];
  const mkLabel = (cls, html) => { const d = document.createElement('div'); d.className = 'b3-lab ' + cls; d.innerHTML = html; wrap.appendChild(d); const o = { d, text: '' }; labels.push(o); return o; };
  const LS = mkLabel('node', '<b>출발</b><span>우리 동네</span>'), LE = mkLabel('node', '<b>도착</b><span>회사 거리</span>');
  const LA = mkLabel('node small', '<b>A</b>'), LB = mkLabel('node small', '<b>B</b>');
  const chips = LINKS.map(() => mkLabel('chip', '<i></i><span></span>'));
  const NX = narrow ? 13.4 : 14.4;   // 휴대폰에서는 이름표가 화면 끝에서 잘리지 않게 안쪽으로
  const anchors = [[-NX, 1.3, 0.3], [NX, 3.4, 0.4], [0, 1.25, -7], [0, 1.25, 7]]; // [x, y, z]: 동네·빌딩 위
  // 길 이름표 자리: 곡선 가운데에서 바깥쪽으로 조금
  const chipAt = LUT.map((L, k) => { const p = at(L, k === 4 ? 0.27 : 0.5, [0, 0, 0]); const out = k === 4 ? [1.25, 0] : [p[0] * 0.06, p[1] * 0.12]; return [p[0] + out[0], p[1] + out[1]]; });
  const clock = document.createElement('div'); clock.className = 'b3-clock';
  clock.innerHTML = '<canvas width="200" height="200"></canvas><div class="cap">평균 출근 시간</div><div class="val"></div>';
  wrap.appendChild(clock);
  const cc = clock.querySelector('canvas'), cctx = cc.getContext('2d'), cval = clock.querySelector('.val');
  let handV = null, lastHandDrawn = -1, lastVal = '';
  function drawClock(val) {
    if (Math.abs(val - lastHandDrawn) < 0.02 && lastHandDrawn >= 0 && !clock._dirty) return;
    lastHandDrawn = val; clock._dirty = false;
    const S = 200, c = S / 2, R = 88, x = cctx;
    x.clearRect(0, 0, S, S);
    x.fillStyle = night ? '#1b2333' : '#ffffff'; x.strokeStyle = night ? '#4b5568' : '#cfd5dd'; x.lineWidth = 5;
    x.beginPath(); x.arc(c, c, R, 0, Math.PI * 2); x.fill(); x.stroke();
    const ang = (m) => -Math.PI / 2 + (m / 120) * Math.PI * 2;
    // 지나온 시간 부채꼴(0분부터 바늘까지)
    x.fillStyle = night ? 'rgba(120,160,255,0.2)' : 'rgba(47,111,237,0.13)';
    x.beginPath(); x.moveTo(c, c); x.arc(c, c, R - 6, ang(0), ang(Math.min(119.9, val))); x.closePath(); x.fill();
    for (let m = 0; m < 120; m += 5) {
      const a = ang(m), big = m % 30 === 0, r0 = big ? R - 18 : m % 10 === 0 ? R - 12 : R - 8;
      x.strokeStyle = night ? '#8792a6' : '#5b6474'; x.lineWidth = big ? 5 : 2.5;
      x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a) * (R - 3), c + Math.sin(a) * (R - 3)); x.stroke();
    }
    x.fillStyle = night ? '#c9d1de' : '#374151'; x.font = '700 24px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    [[0, '0'], [30, '30'], [60, '60'], [90, '90']].forEach(([m, s]) => { const a = ang(m); x.fillText(s, c + Math.cos(a) * (R - 36), c + Math.sin(a) * (R - 36)); });
    const a = ang(val);
    x.strokeStyle = night ? '#ffffff' : '#111827'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(c - Math.cos(a) * 10, c - Math.sin(a) * 10); x.lineTo(c + Math.cos(a) * (R - 16), c + Math.sin(a) * (R - 16)); x.stroke();
    x.fillStyle = '#e5484d'; x.beginPath(); x.arc(c, c, 9, 0, Math.PI * 2); x.fill();
  }
  const pv = new THREE.Vector3();
  function place(o, x, y, z, show) {
    if (!show) { if (o.d.style.display !== 'none') o.d.style.display = 'none'; return; }
    pv.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, sx = (pv.x + 1) / 2 * w, sy = (1 - pv.y) / 2 * h;
    const vis = pv.z < 1 && sx > -40 && sx < w + 40 && sy > 0 && sy < h + 20;
    o.d.style.display = vis ? '' : 'none';
    if (vis) o.d.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
  }
  function setText(o, sel, t) { if (o[sel] !== t) { o[sel] = t; o.d.querySelector('span').textContent = t; } }

  // ---------- 매 프레임 ----------
  function carPos(r, k, u, lane, jit, out) {
    const s = ROUTES[r][k], L = LUT[s], l = LINKS[s];
    at(L, u, out);
    const ln = Math.min(lane, l.lanes - 1), off = (ln - (l.lanes - 1) / 2) * (l.w / l.lanes) * 0.92 + jit;
    const a = out[2]; out[0] += -Math.sin(a) * off; out[1] += Math.cos(a) * off;
    let y = Y.car;
    if (s === 4) { const zz = Math.abs(out[1]); y = zz < BR ? 0.2 * openAmt + 0.03 : zz < BR + 0.5 ? 0.03 + 0.17 * openAmt * (1 - (zz - BR) / 0.5) : Y.car; }
    return y;
  }
  const ym = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3();
  let bob = 0;
  function update(dt) {
    const st = window.BraessState; if (!st || !st.sim) return;
    const sim = st.sim;
    if (sim !== simRef) rebuild(sim);
    targets(sim);
    const T = st.linkTimes(), open = sim.open;
    // 지름길이 닫히면: A에서 지름길로 들어가려던 차는 A 길로. 다리 위 차는 마저 건넌 뒤 상판이 들린다
    let onBridge = 0;
    if (!open) for (let i = 0; i < Ncar; i++) if (cR[i] === 2 && cK[i] === 0) setRoute(i, 0);
    for (let i = 0; i < Ncar; i++) if (cR[i] === 2 && cK[i] === 1) onBridge++;
    if (!open && yc.r === 2 && yc.k === 0) yc.r = 0;
    if (!open && yc.r === 2 && yc.k === 1) onBridge++;
    const goal = open ? 1 : onBridge ? openAmt : 0;
    openAmt += Math.sign(goal - openAmt) * Math.min(Math.abs(goal - openAmt), (st.thumb ? 1 : dt) / 0.9);
    const ease = openAmt * openAmt * (3 - 2 * openAmt);
    leaves.forEach(({ g, sd }) => { g.rotation.x = sd * (1 - ease) * 1.25; });
    booms.forEach((g) => { g.rotation.z = ease * 1.35; });
    dashes.visible = ease < 0.98;
    mats.dash.opacity = 0.5 * (1 - ease);
    // 길 테두리 색 = 지금 걸리는 시간 (2D와 같은 heat 함수). 닫힌 지름길은 회색
    const k = night ? PAL.night.rimK : 1;
    rimMats.forEach((m, s) => {
      if (s === 4 && !open) m.color.set(night ? '#3a4250' : '#b7bec8');
      else { m.color.set(st.heat(T[s])); if (k !== 1) m.color.multiplyScalar(k); }
    });
    // 차 움직이기: 일시정지면 멈춤, 끝나면(균형) 계속 달린다
    const moving = !st.thumb && (!st.isPaused() || sim.done());
    const step = moving ? dt : 0;
    for (let i = 0; i < Ncar; i++) {
      let r = cR[i];
      cU[i] += step / linkT(T[ROUTES[r][cK[i]]]);
      while (cU[i] >= 1) {
        cU[i] -= 1; cK[i]++;
        if (cK[i] >= ROUTES[r].length) { cK[i] = 0; setRoute(i, pickRoute(r, open)); r = cR[i]; } // 새 바퀴: 비율에 맞게 길을 다시
        else if (cK[i] === 1 && (r === 0 || r === 2)) { // A 교차로: A 길 ↔ 지름길 경유
          const nr = pickRoute(r, open);
          if (nr === 0 || nr === 2) { setRoute(i, nr); r = nr; }
        }
        cU[i] = Math.min(cU[i], 0.999);
      }
    }
    // 노란 차: 바퀴가 끝나면 그 운전자가 지금 고른 길로
    yc.u += step / linkT(T[ROUTES[yc.r][yc.k]]);
    while (yc.u >= 1) { yc.u -= 1; yc.k++; if (yc.k >= ROUTES[yc.r].length) { yc.k = 0; yc.r = sim.routeOf(st.follow); if (yc.r === 2 && !open) yc.r = 0; } }
    // 그리기
    for (let i = 0; i < Ncar; i++) {
      const y = carPos(cR[i], cK[i], cU[i], cLane[i], cJit[i], xz) + (i % 5) * 0.003;
      q.setFromAxisAngle(up, -xz[2]); pp.set(xz[0], y, xz[1]); ym.compose(pp, q, sc);
      cars.setMatrixAt(i, ym);
      if (night) { heads.setMatrixAt(i, ym); tails.setMatrixAt(i, ym); pools.setMatrixAt(i, ym); }
    }
    cars.instanceMatrix.needsUpdate = true;
    const yy = carPos(yc.r, yc.k, yc.u, 1, 0, xz);
    yCar.position.set(xz[0], yy, xz[1]); yCar.rotation.set(0, -xz[2], 0);
    bob += step * 3;
    pin.position.set(xz[0], yy + 0.45 + Math.sin(bob) * 0.06, xz[1]);
    if (night) {
      q.setFromAxisAngle(up, -xz[2]); pp.set(xz[0], yy, xz[1]); ym.compose(pp, q, new THREE.Vector3(1.55, 1.55, 1.55));
      heads.setMatrixAt(Ncar, ym); tails.setMatrixAt(Ncar, ym); pools.setMatrixAt(Ncar, ym);
      [heads, tails, pools].forEach((m) => { m.count = Ncar + 1; m.instanceMatrix.needsUpdate = true; });
    }
    // 이름표
    const showLab = !st.thumb;
    [LS, LE, LA, LB].forEach((o, j) => { const [x, y, z] = anchors[j]; place(o, x, y, z, showLab); });
    chips.forEach((o, s) => {
      const tt = Math.round(T[s]);
      const txt = s === 4 ? (open ? `지름길 ${tt}분` : '다리 들림') : `${tt}분`;
      setText(o, 'text', txt);
      const col = s === 4 && !open ? '#9aa3ad' : st.heat(T[s]);
      if (o.col !== col) { o.col = col; o.d.querySelector('i').style.background = col; }
      place(o, chipAt[s][0], 0.35, chipAt[s][1], showLab);
    });
    // 시계: app.js가 계산한 지금 라운드의 평균
    const avg = sim.avgNow();
    handV = handV == null || st.thumb ? avg : handV + (avg - handV) * Math.min(1, dt * 4);
    drawClock(handV);
    const vt = `${avg.toFixed(1)}분`; if (vt !== lastVal) { lastVal = vt; cval.textContent = vt; }
  }

  v.onFrame((dt) => update(dt));
  function home() {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 375, asp = w / h;
    if (st0.thumb) { camera.position.set(0, 25, 17); controls.target.set(0, 0, 0.6); }
    else if (asp < 1.3) { camera.position.set(0, 34, 26); controls.target.set(0, 0, 1.0); }
    else { camera.position.set(0, 24, 19.5); controls.target.set(0, 0, 0.9); }
    controls.update();
  }
  home();
  applyTime();
  update(0.016);
  if (st0.thumb) {
    controls.autoRotate = false;
    const shot = () => { update(0); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Braess3D = { v, stats: () => ({ cars: cars.count, cap: CAP, buildings: BLD.length, open: openAmt, night, yellow: [yc.r, yc.k, +yc.u.toFixed(2)], routeCnt: routeCnt.slice(), target: target.slice() }) };
}

// 캔버스를 감싸 이름표·시계를 겹쳐 올릴 자리를 만든다(create3D보다 먼저: 크기 감시가 부모를 본다)
let wrap = null;
if (canvas && st0) {
  const css = document.createElement('style');
  css.textContent = `
.b3-wrap{position:relative;overflow:hidden;border-radius:14px;max-width:760px;margin:0 auto}
.b3-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 12px/1.25 ${FONT};color:#1f2937;background:rgba(255,255,255,.93);border:1px solid #d5dae1;border-radius:9px;padding:3px 8px;box-shadow:0 1px 4px rgba(15,23,42,.14);will-change:transform}
.b3-lab.node{display:flex;flex-direction:column;align-items:center;padding:3px 9px}
.b3-lab.node b{font-size:13px}.b3-lab.node span{font-size:10.5px;font-weight:500;color:#6b7280}
.b3-lab.node.small{padding:2px 9px;border-radius:50%}
.b3-lab.chip{display:flex;align-items:center;gap:5px;font-size:11.5px;padding:2px 7px}
.b3-lab.chip i{display:inline-block;width:9px;height:9px;border-radius:50%}
.b3-clock{position:absolute;right:10px;top:10px;width:96px;padding:6px 6px 5px;border-radius:12px;background:rgba(255,255,255,.9);border:1px solid #d5dae1;box-shadow:0 1px 5px rgba(15,23,42,.14);text-align:center;pointer-events:none;font-family:${FONT}}
.b3-clock canvas{width:84px;height:84px;display:block;margin:0 auto}
.b3-clock .cap{font-size:10.5px;color:#6b7280;margin-top:2px;line-height:1.2}
.b3-clock .val{font-size:15px;font-weight:800;color:#111827;line-height:1.2}
.b3-night .b3-lab,.b3-night .b3-clock{background:rgba(22,29,44,.9);border-color:#3a4458;color:#e5e7eb}
.b3-night .b3-lab.node span,.b3-night .b3-clock .cap{color:#9aa5b8}.b3-night .b3-clock .val{color:#f9fafb}
@media (max-width:640px){.b3-clock{width:62px;right:6px;top:6px;padding:4px 3px 3px;border-radius:10px}.b3-clock canvas{width:50px;height:50px}.b3-clock .cap{font-size:9px}.b3-clock .val{font-size:12px}.b3-lab.node{padding:2px 7px}.b3-lab.node span{font-size:9.5px}.b3-lab{font-size:11px}.b3-lab.chip{font-size:10.5px;padding:1px 6px}.b3-lab.node b{font-size:12px}}
`;
  document.head.appendChild(css);
  wrap = document.createElement('div'); wrap.className = 'b3-wrap';
  canvas.parentNode.insertBefore(wrap, canvas); wrap.appendChild(canvas);
  canvas.setAttribute('aria-label', '3D city map of the road network with cars and a lift bridge');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '10 / 9';   // 휴대폰에서는 덜 납작하게
  const v = create3D(canvas, { camera: [0, 21, 17.5], target: [0, 0, 0.9], background: PAL.day.bg, autoRotate: false, autoRotateSpeed: 0.35, minDistance: 9, maxDistance: 60, fov: 40 });
  if (v) init(v, narrow);
}
