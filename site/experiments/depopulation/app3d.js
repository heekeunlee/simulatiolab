// ① 가상의 지도 (3D): app.js가 window.DepopState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 마을 한 칸 = 기둥 하나(인스턴스드 메시). 높이 = 인구의 제곱근(도시 기둥이 너무 높아 마을이 안 보이지 않게)
// - 색 3종: 시설 있는 마을(초록) / 시설 닫힌 마을(회색) / 도시(주황). 지켜 주는 마을 = 기둥 위 남색 뿔(두 번째 모양)
// - 한 해 전과 지금 사이의 높이를 시간 비율만큼 이어 그린다(보간, 결과에는 영향 없음). 문을 닫으면 색이 천천히 회색으로 바뀐다
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.DepopState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D map of villages and a city');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1';   // 휴대폰에서는 정사각형에 가깝게
  const v = create3D(canvas, { camera: [19, 27, 30], target: [0, 3.5, 0], background: '#eaf2fb', autoRotateSpeed: 0.35, minDistance: 12, maxDistance: 70, fov: 45 });
  if (v) init(v, narrow);
}

function init(v, narrow) {
  const { scene, camera, controls } = v;
  const DP = window.Depop, W = DP.C.W, N = W * W, HS = 2.2;   // 인구 100명 마을 기둥 높이 = 2.2
  const hOf = (p) => 0.08 + HS * Math.sqrt(Math.max(0, p) / 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  // 받침판(밝은 땅)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.3, W + 1.2), new THREE.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.95 }));
  plate.position.y = -0.15; scene.add(plate);
  // 기둥: 밑면이 y=0
  const g = new THREE.BoxGeometry(0.84, 1, 0.84); g.translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), N);
  cols.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(cols);
  const GREEN = new THREE.Color('#2fa35c'), GRAY = new THREE.Color('#9aa3ae'), ORANGE = new THREE.Color('#f08c2e'), col = new THREE.Color();
  // 지켜 주는 마을 표시: 기둥 위 남색 뿔
  const cone = new THREE.ConeGeometry(0.55, 1.6, 16); cone.translate(0, 0.8, 0);
  const flags = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 }), 16);
  flags.instanceMatrix.setUsage(THREE.DynamicDrawUsage); flags.count = 0; scene.add(flags);

  const dummy = new THREE.Object3D(), wx = (i) => (i % W) - (W - 1) / 2, wz = (i) => ((i / W) | 0) - (W - 1) / 2;
  const mixT = new Float32Array(N);   // 0 = 초록, 1 = 회색 (닫힐 때 천천히)
  let simRef = null;
  const rot = $('dp-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });

  function update(dt) {
    const st = window.DepopState; if (!st || !st.sim) return;
    const sim = st.sim;
    if (sim !== simRef) { simRef = sim; for (let i = 0; i < N; i++) mixT[i] = sim.open[i] ? 0 : 1; }
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const k = st.thumb ? 1 : Math.min(1, dt * 2.5);
    let f = 0;
    for (let i = 0; i < N; i++) {
      const p = sim.prevPop[i] + (sim.pop[i] - sim.prevPop[i]) * a, h = hOf(p);
      dummy.position.set(wx(i), 0, wz(i)); dummy.scale.set(1, h, 1); dummy.updateMatrix(); cols.setMatrixAt(i, dummy.matrix);
      if (sim.isCity[i]) col.copy(ORANGE);
      else { mixT[i] += ((sim.open[i] ? 0 : 1) - mixT[i]) * k; col.copy(GREEN).lerp(GRAY, mixT[i]); }
      cols.setColorAt(i, col);
      if (sim.prot[i] && f < 16) { dummy.position.set(wx(i), h + 0.05, wz(i)); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); flags.setMatrixAt(f++, dummy.matrix); }
    }
    flags.count = f; flags.instanceMatrix.needsUpdate = true;
    cols.instanceMatrix.needsUpdate = true; if (cols.instanceColor) cols.instanceColor.needsUpdate = true;
  }
  v.onFrame((dt) => update(dt));
  if (narrow) { camera.position.set(20, 29, 33); controls.update(); }
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(20, 25, 27); controls.target.set(0, 4, 0);
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Depop3D = { v, update };
}
