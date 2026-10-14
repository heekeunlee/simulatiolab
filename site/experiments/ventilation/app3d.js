// 환기 3D 보기: ①과 같은 방을 벽이 선 입체로 세우고, 바닥 위 공기가 탁할수록 높이 솟게 한 지형.
// 2D 화면(app.js)이 window.VentState로 내보내는 같은 sim과 같은 흐름 점을 그대로 읽는다(3D에서 따로 계산하지 않음).
// 높이·색 = 탁함(0~100, 사람 둘레처럼 100을 넘는 곳은 조금 더 높게), 파란 구슬 = 공기 흐름 점, 반투명 벽 + 창 자리는 뚫림.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const v = canvas && create3D(canvas, { camera: [0, 10.5, 10.5], target: [0, 0.2, 0.4], background: '#eef3f8', autoRotateSpeed: 0.45, minDistance: 5, maxDistance: 30 });
if (v) {
  const S = 0.2, WALLH = 2.0, HS = 1.2, BASE = 0.03;   // 칸 한 변, 벽 높이, 탁함 100의 높이, 바닥 두께
  const CLEAN = new THREE.Color('#e2f4ff'), STALE = new THREE.Color('#8c6846'), col = new THREE.Color();
  const dummy = new THREE.Object3D();
  v.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  let simRef = null, NX = 0, NY = 0, surf = null, pos = null, colors = null, disp = null, walls = null, person = null, windArrow = null, plate = null;
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 }), 300);
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.count = 0; v.scene.add(dots);

  const wx = (x) => (x + 0.5 - NX / 2) * S, wz = (y) => (y + 0.5 - NY / 2) * S;   // 2D 그림의 위쪽 줄이 화면 안쪽
  const height = (c) => BASE + HS * Math.min(1.3, Math.max(0, c) / 100);

  function clear(o) { if (o) { v.scene.remove(o); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); } }
  function rebuild(sim) {
    simRef = sim; NX = sim.NX; NY = sim.NY;
    [surf, walls, person, windArrow, plate].forEach(clear);
    // 받침판
    plate = new THREE.Mesh(new THREE.BoxGeometry(NX * S + 0.6, 0.12, NY * S + 0.6), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.95 }));
    plate.position.y = -0.06; v.scene.add(plate);
    // 탁함 지형: 칸 가운데마다 꼭짓점 하나
    const g = new THREE.PlaneGeometry((NX - 1) * S, (NY - 1) * S, NX - 1, NY - 1); g.rotateX(-Math.PI / 2);
    pos = g.attributes.position; colors = new Float32Array(pos.count * 3); g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    surf = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
    v.scene.add(surf);
    disp = new Float32Array(NX * NY); const C = sim.C; for (let i = 0; i < NX * NY; i++) disp[i] = valueAt(sim, i, C);
    // 벽: 벽 칸마다 반투명 상자(창 자리는 칸이 없어 뚫려 보인다)
    // 벽 칸을 가로·세로로 이어진 긴 상자로 묶는다
    const used = new Uint8Array(NX * NY), runs = [];
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      const i = y * NX + x; if (sim.type[i] !== 2 || used[i]) continue;
      let lx = 0; while (x + lx < NX && sim.type[i + lx] === 2 && !used[i + lx]) lx++;
      let ly = 0; while (y + ly < NY && sim.type[i + ly * NX] === 2 && !used[i + ly * NX]) ly++;
      if (lx >= ly) { for (let k = 0; k < lx; k++) used[i + k] = 1; runs.push([x, y, lx, 1]); }
      else { for (let k = 0; k < ly; k++) used[i + k * NX] = 1; runs.push([x, y, 1, ly]); }
    }
    walls = new THREE.InstancedMesh(new THREE.BoxGeometry(S, WALLH, S), new THREE.MeshStandardMaterial({ color: 0x475569, transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.6 }), runs.length);
    runs.forEach(([x, y, lx, ly], k) => { dummy.position.set(wx(x + (lx - 1) / 2), WALLH / 2, wz(y + (ly - 1) / 2)); dummy.scale.set(lx, 1, ly); dummy.updateMatrix(); walls.setMatrixAt(k, dummy.matrix); });
    walls.renderOrder = 2; v.scene.add(walls);
    // 숨 쉬는 사람 (몸통 + 머리)
    person = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 1.65, 14), mat); body.position.y = 0.82;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat); head.position.y = 1.9;
    person.add(body, head); person.position.set(wx(sim.person[0]), 0, wz(sim.person[1])); v.scene.add(person);
    // 바람 화살표 (방 바깥, 바람이 오는 쪽)
    windArrow = new THREE.Group();
    const am = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 12), am); shaft.rotation.z = -Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 16), am); tip.rotation.z = -Math.PI / 2; tip.position.x = 1.05;
    windArrow.add(shaft, tip);
    const [dx, dy] = sim.wind, R = Math.max(NX, NY) * S * 0.5 + 2.1;
    windArrow.position.set(-dx * R * (dy ? 0.8 : 1), 1.0, -dy * R * (dx ? 0.8 : 1.15));
    windArrow.rotation.y = -Math.atan2(dy, dx);
    v.scene.add(windArrow);
    home();
  }
  function valueAt(sim, i, C) {   // 벽 칸은 이웃한 공기 칸 값으로 (지형이 벽에서 튀지 않게)
    if (sim.type[i] !== 2) return C[i];
    const n = [i - 1, i + 1, i - NX, i + NX].find((j) => j >= 0 && j < NX * NY && sim.type[j] !== 2);
    return n == null ? 0 : C[n];
  }
  function home() {
    const asp = (canvas.clientWidth || 600) / (canvas.clientHeight || 375), d = asp < 1.3 ? 1.35 : 1;
    v.camera.position.set(0, 10.5 * d, 10.5 * d); v.controls.target.set(0, 0.2, 0.4); v.controls.update();
  }

  function update(dt) {
    const st = window.VentState; if (!st || !st.sim) return;
    const sim = st.sim; if (sim !== simRef) rebuild(sim);
    const C = sim.C, a = st.thumb ? 1 : Math.min(1, dt * 10);
    for (let i = 0; i < NX * NY; i++) {
      disp[i] += (valueAt(sim, i, C) - disp[i]) * a;
      pos.setY(i, height(disp[i]));
      const t = Math.min(1, Math.max(0, disp[i] / 100)); col.copy(CLEAN).lerp(STALE, t);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    pos.needsUpdate = true; surf.geometry.attributes.color.needsUpdate = true; surf.geometry.computeVertexNormals();
    // 흐름 점: 2D와 같은 점을 지형 위에 띄운다
    let n = 0;
    for (let k = 0; k < st.np && n < 300; k++) {
      const x = st.px[k], y = st.py[k], [u, w] = st.vel(x, y), s = Math.hypot(u, w); if (s < 0.004) continue;
      const ci = Math.min(NX - 1, Math.max(0, Math.floor(x))), cj = Math.min(NY - 1, Math.max(0, Math.floor(y)));
      dummy.position.set((x - NX / 2) * S, height(disp[cj * NX + ci]) + 0.09, (y - NY / 2) * S); dummy.scale.setScalar(0.055); dummy.updateMatrix();
      dots.setMatrixAt(n++, dummy.matrix);
    }
    dots.count = n; dots.instanceMatrix.needsUpdate = true;
  }

  v.onFrame((dt) => update(dt));
  update(1);
  if (window.VentState && window.VentState.thumb) {
    v.controls.autoRotate = false;
    const shot = () => { update(1); v.controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
}
