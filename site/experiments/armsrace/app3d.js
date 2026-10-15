// ① 두 나라의 군비 탑과 바닥의 위상 평면 (3D): app.js가 window.ArmsState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 뒤쪽: A(파랑)·B(주황)의 군비 탑. 블록 하나 = 군비 10, 높이 = 지금 군비. 빨간 반투명 판 = 과열선 100.
// - 바닥: 가로 = A의 군비, 앞뒤 = B의 군비(0~200). 옅은 빨강 = 과열 구역, 파랑·주황 선 = 각 나라가 더 늘리지도 줄이지도 않는 선, 검은 선 = 지나온 길, 공 = 지금.
// 한 걸음 전과 지금 사이를 이어 그려 부드럽게 보일 뿐 결과에는 영향이 없다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const st0 = window.ArmsState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of two arms towers and their path on the floor');
  const phone = (canvas.parentElement.clientWidth || 999) < 640;
  if (phone) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: phone ? [22, 24, 33] : [22, 20, 33], target: [8, 4.5, 6], background: '#f4f6fb', autoRotateSpeed: 0.35, minDistance: 12, maxDistance: 90, fov: 45 });
  if (v) init(v, phone);
}

function init(v, phone) {
  const { scene, camera, controls } = v;
  const S = 0.08, VM = 200, F = VM * S, ST = 0.11;   // 바닥: 군비 1 = 0.08 (한 변 0~200), 탑 높이: 군비 1 = 0.11
  const fx = (a) => Math.min(VM, Math.max(0, a)) * S, fz = (b) => F - Math.min(VM, Math.max(0, b)) * S;   // B는 뒤(−z)로 갈수록 크게: z = F − b·S
  const C_A = new THREE.Color('#2f6fed'), C_B = new THREE.Color('#e8590c'), C_HOTC = new THREE.Color('#dc2626');

  // 바닥 판 + 과열 구역 + 격자
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(F, F), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(F / 2, 0, F / 2); scene.add(floor);
  const hotMat = new THREE.MeshBasicMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.55, depthWrite: false });
  const H = 100 * S, HT = 100 * ST;   // 과열선 100: 바닥에서의 자리 / 탑에서의 높이
  const hot1 = new THREE.Mesh(new THREE.PlaneGeometry(F - H, F), hotMat); hot1.rotation.x = -Math.PI / 2; hot1.position.set(H + (F - H) / 2, 0.01, F / 2); scene.add(hot1);
  const hot2 = new THREE.Mesh(new THREE.PlaneGeometry(H, F - H), hotMat); hot2.rotation.x = -Math.PI / 2; hot2.position.set(H / 2, 0.01, (F - H) / 2); scene.add(hot2);
  { const pts = []; for (let k = 0; k <= VM; k += 40) { pts.push(new THREE.Vector3(fx(k), 0.02, 0), new THREE.Vector3(fx(k), 0.02, F), new THREE.Vector3(0, 0.02, fz(k)), new THREE.Vector3(F, 0.02, fz(k))); }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xcbd5e1 }))); }
  // 바닥 가장자리 축: A 축(앞쪽 가장자리, 파랑), B 축(왼쪽 가장자리, 주황)
  const edge = (p, q, col) => { const g = new THREE.BufferGeometry().setFromPoints([p, q]); scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col }))); };
  edge(new THREE.Vector3(0, 0.03, F), new THREE.Vector3(F, 0.03, F), 0x2f6fed);
  edge(new THREE.Vector3(0, 0.03, F), new THREE.Vector3(0, 0.03, 0), 0xe8590c);

  // 균형선 (각 나라가 더 늘리지도 줄이지도 않는 곳): 직선이라 두 점만 바꾼다
  const ncGeoA = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const ncGeoB = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  scene.add(new THREE.Line(ncGeoA, new THREE.LineBasicMaterial({ color: 0x2f6fed, transparent: true, opacity: 0.75 })));
  scene.add(new THREE.Line(ncGeoB, new THREE.LineBasicMaterial({ color: 0xe8590c, transparent: true, opacity: 0.75 })));
  function clipSeg(p, q) {   // 바닥(0~VM) 안으로 자른 선분 (Liang–Barsky)
    let t0 = 0, t1 = 1; const dx = q[0] - p[0], dy = q[1] - p[1];
    for (const [pp, qq] of [[-dx, p[0]], [dx, VM - p[0]], [-dy, p[1]], [dy, VM - p[1]]]) {
      if (pp === 0) { if (qq < 0) return null; continue; }
      const r = qq / pp; if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
  }
  function setNc(geo, seg) {
    const a = geo.attributes.position;
    if (!seg) { a.setXYZ(0, 0, -99, 0); a.setXYZ(1, 0, -99, 0); }
    else { a.setXYZ(0, fx(seg[0][0]), 0.06, fz(seg[0][1])); a.setXYZ(1, fx(seg[1][0]), 0.06, fz(seg[1][1])); }
    a.needsUpdate = true; geo.computeBoundingSphere();
  }

  // 지나온 길 (바닥 위 선) + 지금 공 + 공에서 두 축으로 내린 옅은 선
  const MAXT = 64, tpos = new Float32Array(MAXT * 3), tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  const trail = new THREE.Line(tgeo, new THREE.LineBasicMaterial({ color: 0x1f2937 })); trail.frustumCulled = false; scene.add(trail);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), new THREE.MeshLambertMaterial({ color: 0x1f2937 })); scene.add(ball);
  const guideGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  const guide = new THREE.LineSegments(guideGeo, new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.3, gapSize: 0.25 })); scene.add(guide);

  // 군비 탑: 바닥 뒤쪽에 나란히. 블록 하나 = 군비 10
  const BLK = 10 * ST, NB = VM / 10, TW = 2.6;
  const towerX = [F * 0.3, F * 0.7], towerZ = -2.6;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(TW, BLK * 0.88, TW), new THREE.MeshLambertMaterial({ color: 0xffffff }), NB * 2);
  blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(blocks);
  const base = new THREE.Mesh(new THREE.BoxGeometry(F, 0.12, 4.2), new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })); base.position.set(F / 2, -0.06, towerZ); scene.add(base);
  const hotPlane = new THREE.Mesh(new THREE.BoxGeometry(F, 0.05, 4.2), new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.22, depthWrite: false }));
  hotPlane.position.set(F / 2, HT, towerZ); scene.add(hotPlane);
  { const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(F, 0.05, 4.2)); const e = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xdc2626 })); e.position.copy(hotPlane.position); scene.add(e); }
  // 탑 아래 받침 색 띠 (어느 탑이 A/B인지)
  [C_A, C_B].forEach((c, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.6, 0.14, TW + 0.6), new THREE.MeshLambertMaterial({ color: c })); m.position.set(towerX[i], 0.02, towerZ); scene.add(m); });

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P3 = new THREE.Vector3(), SC = new THREE.Vector3(), col = new THREE.Color();
  function setTower(ti, val) {
    const full = Math.min(NB, val / 10);
    for (let k = 0; k < NB; k++) {
      const idx = ti * NB + k, f = Math.max(0, Math.min(1, full - k));
      if (f <= 0) { SC.set(0.0001, 0.0001, 0.0001); P3.set(towerX[ti], -5, towerZ); }
      else { SC.set(1, f, 1); P3.set(towerX[ti], k * BLK + (BLK * 0.88 * f) / 2 + 0.06, towerZ); }
      M4.compose(P3, Q, SC); blocks.setMatrixAt(idx, M4);
      col.copy(ti ? C_B : C_A); if (k >= 10) col.lerp(C_HOTC, 0.35 + 0.03 * (k - 10));
      blocks.setColorAt(idx, col);
    }
  }

  let lastSim = null, lastT = -1;
  function update() {
    const st = window.ArmsState; if (!st || !st.sim) return;
    const sim = st.sim, still = st.isPaused() || st.thumb || sim.done;
    const n = sim.xs.length - 1, a = still || n === 0 ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const px = n > 0 ? sim.xs[n - 1] + (sim.xs[n] - sim.xs[n - 1]) * a : sim.xs[0];
    const py = n > 0 ? sim.ys[n - 1] + (sim.ys[n] - sim.ys[n - 1]) * a : sim.ys[0];
    setTower(0, px); setTower(1, py);
    blocks.instanceMatrix.needsUpdate = true; if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
    ball.position.set(fx(px), 0.42, fz(py));
    ball.material.color.set(sim.hot >= 0 && sim.hot <= n ? 0xdc2626 : 0x1f2937);
    const gp = guideGeo.attributes.position;
    gp.setXYZ(0, fx(px), 0.05, fz(py)); gp.setXYZ(1, fx(px), 0.05, F); gp.setXYZ(2, fx(px), 0.05, fz(py)); gp.setXYZ(3, 0, 0.05, fz(py)); gp.needsUpdate = true; guide.computeLineDistances();
    if (sim !== lastSim || n !== lastT) {
      lastSim = sim; lastT = n;
      const m = Math.min(MAXT, n + 1);
      for (let i = 0; i < m; i++) { tpos[i * 3] = fx(sim.xs[i]); tpos[i * 3 + 1] = 0.08; tpos[i * 3 + 2] = fz(sim.ys[i]); }
      tgeo.setDrawRange(0, m); tgeo.attributes.position.needsUpdate = true;
      const nc = st.nullclines();
      setNc(ncGeoA, clipSeg([nc.g / nc.a, 0], [(nc.kA * VM + nc.g) / nc.a, VM]));   // x = (kA·y + g)/a
      setNc(ncGeoB, clipSeg([0, nc.g / nc.a], [VM, (nc.kB * VM + nc.g) / nc.a]));   // y = (kB·x + g)/a
    }
  }
  v.onFrame(() => update());
  update();
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(25, 22, 36); controls.target.set(8, 8, 4); controls.update();
    const shot = () => { update(); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Arms3D = { v, update };
}
