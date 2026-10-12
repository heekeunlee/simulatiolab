// ⑤ 3D로 보기: 맨 위는 지금의 고리 도로(차 = 상자), 그 아래로 지난 160초가 탑처럼 쌓인다 (아래 = 과거).
// 뒤로 물러나는 정체파는 붉은 나선, 따라가 보는 차는 반대로 감기는 검은 선으로 보인다. app.js의 window.TrafficView 상태를 그대로 쓴다.
import { THREE, create3D } from '../../lab3d.js';

const TV = window.TrafficView;
const canvas = document.getElementById('c-3d');
const v = TV && canvas ? create3D(canvas, { camera: [11, 5.5, 14], target: [0, -3.2, 0], autoRotateSpeed: 0.6, minDistance: 6, maxDistance: 40, background: '#f6f7fb' }) : null;

if (v) {
  const R = 5, H = 7, ROWS = 160, MAXN = 200;
  const { scene } = v;
  const tops = 0; // 도로 높이(맨 위)

  // 도로 고리
  const road = new THREE.Mesh(new THREE.RingGeometry(R - 0.32, R + 0.32, 160, 1), new THREE.MeshStandardMaterial({ color: 0xd9dfea, roughness: 0.9, side: THREE.DoubleSide }));
  road.rotation.x = -Math.PI / 2; road.position.y = tops - 0.01; scene.add(road);
  // 바닥 그림자 원판 (탑 밑)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R * 1.35, 64), new THREE.MeshBasicMaterial({ color: 0xe8ecf4 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -H - 0.02; scene.add(floor);

  // 시공간 탑: 가로 = 도로 위치(300칸), 세로 = 시간. DataTexture로 칠한다
  let texW = 300;
  let data = new Uint8Array(texW * ROWS * 4);
  let tex = new THREE.DataTexture(data, texW, ROWS, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const towerMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  // CylinderGeometry: x = r·sinθ, z = r·cosθ, u = θ/2π, v = 1(위) … 0(아래)
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 160, 1, true), towerMat);
  tower.position.y = tops - H / 2 - 0.02; scene.add(tower);
  // 시간 눈금 고리 (40초마다)
  const tickMat = new THREE.LineBasicMaterial({ color: 0xb4bdcf, transparent: true, opacity: 0.7 });
  const ticks = [];
  for (let k = 1; k <= 4; k++) {
    const pts = []; for (let a = 0; a <= 96; a++) { const t = (a / 96) * Math.PI * 2; pts.push(new THREE.Vector3((R + 0.04) * Math.sin(t), tops - (k * 40 / ROWS) * H, (R + 0.04) * Math.cos(t))); }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), tickMat); ticks.push(ln); scene.add(ln);
  }
  // 시간 축 막대
  const axisPts = [new THREE.Vector3(0, tops, 0), new THREE.Vector3(0, -H, 0)];
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(axisPts), new THREE.LineBasicMaterial({ color: 0xc7cedb })));

  // 차 상자 (InstancedMesh)
  const carGeo = new THREE.BoxGeometry(0.16, 0.16, 0.08); // x = 진행 방향 길이는 아래에서 비율로
  const cars = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), MAXN);
  cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(cars);
  // 따라가 보는 차: 검은 상자 + 위에 작은 기둥
  const me = new THREE.Group();
    const mePole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0x1b2233 }));
  const meTip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0x1b2233 }));
  me.add(mePole, meTip); scene.add(me);

  // 진행 방향 화살표 (도로 바깥쪽)
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x9aa4b8 });
  function dirAt(x) { const t = x * Math.PI * 2; return new THREE.Vector3(Math.cos(t), 0, -Math.sin(t)); } // u가 늘어나는 방향
  const arrows = [];
  for (let k = 0; k < 3; k++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 12), arrowMat);
    const u = k / 3 + 0.08, t = u * Math.PI * 2, r = R + 0.75;
    cone.position.set(r * Math.sin(t), tops + 0.02, r * Math.cos(t));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirAt(u));
    scene.add(cone); arrows.push(cone);
  }

  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const rgb = (s) => s.match(/\d+/g).map(Number);
  const cache = new Map();
  function vRGB(vel, vmax) { const k = vel * 10 + vmax; if (!cache.has(k)) cache.set(k, rgb(TV.vcolorRGB(vel, vmax))); return cache.get(k); }

  let lastSim = null, lastStep = -1;
  function paintTower(sim) {
    if (sim.L !== texW) { // 도로 길이가 바뀌면 텍스처를 새로
      texW = sim.L; data = new Uint8Array(texW * ROWS * 4); tex.dispose();
      tex = new THREE.DataTexture(data, texW, ROWS, THREE.RGBAFormat); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; towerMat.map = tex;
    }
    for (let o = 0; o < data.length; o += 4) { data[o] = 246; data[o + 1] = 247; data[o + 2] = 251; data[o + 3] = 255; }
    const rows = sim.rows, n = rows.length, vmax = sim.params.vmax;
    // 맨 위 텍스처 줄(ROWS-1) = 지금, 아래로 과거
    for (let k = 0; k < n; k++) {
      const row = rows[n - 1 - k], ty = ROWS - 1 - k, fade = (k / ROWS) * 0.4; // 오래될수록 배경색 쪽으로 흐리게
      // 빈 칸은 바로 앞차의 속도로 칠해 "속도의 지형"을 만든다 → 정체 띠가 끊기지 않는 붉은 나선으로 보인다
      // 각 칸의 '앞차' = 그 칸 이상에서 가장 가까운 차. 고리라서 맨 끝 칸들의 앞차는 0번 칸 근처의 첫 차
      let a2 = -1;
      for (let x = 0; x < texW && a2 < 0; x++) if (row[x]) a2 = row[x] - 1;
      let cur = a2;
      for (let x = texW - 1; x >= 0; x--) {
        const val = row[x], o = (ty * texW + x) * 4;
        if (val) cur = val - 1;
        data[o + 3] = 255;
        if (cur < 0) continue;
        const c = vRGB(cur, vmax), f2 = val ? fade : Math.min(1, fade + 0.32); // 차가 있는 칸은 진하게
        data[o] = c[0] + (246 - c[0]) * f2; data[o + 1] = c[1] + (247 - c[1]) * f2; data[o + 2] = c[2] + (251 - c[2]) * f2;
      }
    }
    // 따라가 보는 차의 궤적
    const tr = TV.trail ? TV.trail() : null;
    if (tr) {
      const off = tr.length - n;
      for (let k = 0; k < n; k++) {
        const x = tr[off + n - 1 - k]; if (x == null) continue;
        const ty = ROWS - 1 - k;
        for (let dx = 0; dx < 2; dx++) { const o = (ty * texW + ((x + dx) % texW)) * 4; data[o] = 27; data[o + 1] = 34; data[o + 2] = 51; data[o + 3] = 255; }
      }
    }
    tex.needsUpdate = true;
    // 쌓인 시간만큼만 탑을 보여 준다 (처음엔 얇은 띠, 160초가 지나면 끝까지)
    const fr = Math.max(1, n) / ROWS;
    tower.scale.y = fr; tower.position.y = tops - (H * fr) / 2 - 0.02;
    tex.repeat.set(1, fr); tex.offset.set(0, 1 - fr);
    ticks.forEach((t, k) => { t.visible = (k + 1) * 40 <= n; });
  }

  function place(sim, f) {
    const vmax = sim.params.vmax, len = Math.min(0.42, (2 * Math.PI * R / sim.L) * 0.85);
    for (let i = 0; i < MAXN; i++) {
      if (i >= sim.n) { m4.makeScale(0, 0, 0); cars.setMatrixAt(i, m4); continue; }
      const x = TV.carPos(i, f) / sim.L, t = x * Math.PI * 2;
      pv.set(R * Math.sin(t), tops + 0.11, R * Math.cos(t));
      q.setFromAxisAngle(up, t); // 로컬 x축을 진행 방향(cosθ, 0, -sinθ)으로
      sc.set(len / 0.16, i === 0 ? 1.5 : 1, i === 0 ? 4.4 : 3.6);
      m4.compose(pv, q, sc); cars.setMatrixAt(i, m4);
      const c = vRGB(sim.vel[i], vmax); col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); cars.setColorAt(i, col);
      if (i === 0) {
        me.position.copy(pv); me.quaternion.copy(q);
        mePole.position.y = 0.55; meTip.position.y = 1.0;
      }
    }
    cars.count = MAXN; cars.instanceMatrix.needsUpdate = true; if (cars.instanceColor) cars.instanceColor.needsUpdate = true;
  }

  v.onFrame(() => {
    const sim = TV.sim(); if (!sim) return;
    if (sim !== lastSim || sim.step !== lastStep) { paintTower(sim); lastSim = sim; lastStep = sim.step; }
    place(sim, TV.frac());
  });
  // 처음 한 번 바로 그린다 (캡처·썸네일용)
  const s0 = TV.sim(); if (s0) { paintTower(s0); place(s0, 1); v.render(); }
}
