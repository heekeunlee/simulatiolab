// ① 의견 지형 (3D): app.js가 window.FbState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 가로(왼쪽 A쪽 ~ 오른쪽 B쪽) = 의견, 땅 높이 = 그 의견 근처에 있는 사람 수(지금 의견들을 부드럽게 센 것), 앞뒤 = 자리 배치일 뿐 뜻 없음
// - 사람 = 작은 구슬 하나(의견 색: 보라·회색·청록), 지형 위에 올라앉는다. 한 걸음 전과 지금 사이를 이어 그린다(보간, 결과에는 영향 없음)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const st0 = window.FbState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D opinion landscape');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 0.78';   // 휴대폰에서는 조금 더 높게
  const small = (canvas.parentElement.clientWidth || 999) < 640;
  const v = create3D(canvas, { camera: small ? [0, 8.5, 18.5] : [0, 7.5, 15.5], target: [0, 2.2, 0.6], background: '#f4f7fb', autoRotateSpeed: 0.35, minDistance: 8, maxDistance: 45, fov: 45 });
  if (v) init(v);
}

function init(v) {
  const { scene, camera, controls } = v;
  const XS = 10, ZW = 4.6, ENV = 2.1, HS = 2.3, BW = 0.05;   // 의견 1 = 가로 10, 앞뒤 반폭, 앞뒤로 낮아지는 폭, 높이 배율, 세는 폭(의견 단위)
  const GX = 120, GZ = 40;                                  // 지형 칸 수
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  // 받침판 (밝은 회색)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(XS * 2 + 1.6, 0.16, ZW * 2 + 1.2), new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.95 }));
  plate.position.y = -0.09; scene.add(plate);
  // 앞쪽 가장자리 띠: 왼쪽 보라(A쪽) → 가운데 회색 → 오른쪽 청록(B쪽)
  const opColor = window.FbState.opColor;
  const strip = new THREE.PlaneGeometry(XS * 2, 0.5, 60, 1); strip.rotateX(-Math.PI / 2);
  { const p = strip.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = opColor(p.getX(i) / XS); c[i * 3] = k[0] / 255; c[i * 3 + 1] = k[1] / 255; c[i * 3 + 2] = k[2] / 255; } strip.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const stripM = new THREE.Mesh(strip, new THREE.MeshBasicMaterial({ vertexColors: true })); stripM.position.set(0, 0.005, ZW + 0.3); scene.add(stripM);
  // 가운데(0) 표시: 받침판 위 얇은 선
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, ZW * 2 + 0.6), new THREE.MeshBasicMaterial({ color: 0x94a3b8 })); mid.position.y = 0.01; scene.add(mid);

  // 지형: 가로 = 의견, 높이 = 사람 수
  const g = new THREE.PlaneGeometry(XS * 2, ZW * 2, GX, GZ); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3); g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const surf = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide, flatShading: false }));
  scene.add(surf);
  const dens = new Float32Array(GX + 1), envZ = new Float32Array(GZ + 1);
  for (let j = 0; j <= GZ; j++) { const z = -ZW + (j / GZ) * ZW * 2; envZ[j] = Math.exp(-(z * z) / (2 * ENV * ENV)); }
  // 꼭짓점 색: 의견 색을 하얗게 옅게(구슬이 잘 보이게)
  for (let i = 0; i < pos.count; i++) { const k = opColor(pos.getX(i) / XS); for (let c = 0; c < 3; c++) cols[i * 3 + c] = (k[c] / 255) * 0.75 + 0.2; }

  // 사람: 작은 구슬 (자리 앞뒤 z는 사람 번호로 정한 고정 배치, 뜻 없음)
  const MAXN = 1000, R = 0.13;
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(R, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }), MAXN);
  balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage); balls.frustumCulled = false; scene.add(balls);
  const pz = new Float32Array(MAXN);
  { let a = 12345; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    for (let i = 0; i < MAXN; i++) { let u = 0; for (let k = 0; k < 4; k++) u += rnd(); pz[i] = Math.max(-ZW + 0.4, Math.min(ZW - 0.4, (u - 2) * 2.3)); } }
  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  const cur = new Float64Array(MAXN);
  let simRef = null, lastT = -1, lastA = -1;

  // 지금 의견들을 부드럽게 세어 가로 칸마다 높이를 만든다 (그림용)
  function density(n) {
    dens.fill(0);
    const k2 = 1 / (2 * BW * BW), norm = 1 / (n * BW * Math.sqrt(2 * Math.PI)), w = Math.ceil((3 * BW) / (2 / GX));
    for (let i = 0; i < n; i++) {
      const xi = cur[i], c = Math.round(((xi + 1) / 2) * GX);
      for (let b = Math.max(0, c - w); b <= Math.min(GX, c + w); b++) { const xb = -1 + (b / GX) * 2, d = xb - xi; dens[b] += Math.exp(-d * d * k2); }
    }
    for (let b = 0; b <= GX; b++) dens[b] *= norm;
  }
  const heightAt = (x, z) => {   // x: 의견(−1~1), z: 앞뒤 자리
    const f = ((x + 1) / 2) * GX, b = Math.max(0, Math.min(GX - 1, Math.floor(f))), t = f - b;
    const d = dens[b] * (1 - t) + dens[b + 1] * t;
    return HS * d * Math.exp(-(z * z) / (2 * ENV * ENV));
  };

  function update() {
    const st = window.FbState; if (!st || !st.sim) return;
    const sim = st.sim, n = Math.min(MAXN, sim.n);
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    if (sim === simRef && sim.t === lastT && Math.abs(a - lastA) < 0.02) return;   // 바뀐 게 없으면 그대로
    simRef = sim; lastT = sim.t; lastA = a;
    const { x, ox } = sim;
    for (let i = 0; i < n; i++) cur[i] = ox[i] + (x[i] - ox[i]) * a;
    density(n);
    for (let j = 0, i = 0; j <= GZ; j++) for (let b = 0; b <= GX; b++, i++) pos.setY(i, HS * dens[b] * envZ[j]);
    pos.needsUpdate = true; g.computeVertexNormals();
    for (let i = 0; i < n; i++) {
      const xv = cur[i], z = pz[i];
      p.set(xv * XS, heightAt(xv, z) + R * 0.8, z); m4.compose(p, q, s1); balls.setMatrixAt(i, m4);
      const k = opColor(xv); col.setRGB(k[0] / 255, k[1] / 255, k[2] / 255, THREE.SRGBColorSpace); balls.setColorAt(i, col);
    }
    balls.count = n; balls.instanceMatrix.needsUpdate = true; if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
  }
  v.onFrame(() => update());
  update();
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(9, 15, 25); controls.target.set(0, 1.6, 0);   // 썸네일(가운데 정사각형)에 봉우리 셋이 다 들어오게
    const shot = () => { lastT = -1; update(); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Fb3D = { v, update };
}
