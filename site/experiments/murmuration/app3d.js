// ① 저녁 하늘의 새 떼 (3D): app.js가 window.MurmState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 새 = 작은 쐐기(인스턴스드 메시), 나는 방향으로 기울임. 한 걸음 전 위치와 지금 위치 사이를 부드럽게 이어 그린다(보간, 결과에는 영향 없음)
// - 색 2종: 무리 중심 가까이(진한 색) ↔ 가장자리(파란색). 매 = 크고 다른 색의 쐐기 하나. 땅 위 옅은 점 = 떼의 그림자
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.MurmState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of a starling flock');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.05';   // 휴대폰에서는 조금 더 높게
  const v = create3D(canvas, { camera: [0, -4, 80], target: [0, 0, 0], background: '#1b2547', dark: true, autoRotateSpeed: 0.3, minDistance: 20, maxDistance: 260, far: 4000, fov: 50 });
  if (v) init(v);
}

function init(v) {
  const { scene, camera, controls, renderer } = v;
  const MM = window.Murmuration, C = MM.C, GROUND = -C.RY - 40;
  // 저녁 하늘: 위는 짙은 남색, 지평선은 노을빛 (큰 공 안쪽에 그라데이션)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y;
      vec3 top = vec3(0.12,0.17,0.36), mid = vec3(0.46,0.47,0.66), hor = vec3(0.97,0.66,0.42), low = vec3(0.10,0.09,0.11);
      vec3 c = y > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, y)) : y > -0.02 ? mix(hor, mid, smoothstep(-0.02, 0.18, y)) : mix(hor * 0.55, low, smoothstep(-0.02, -0.2, y));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -1; scene.add(sky);
  scene.children.filter((o) => o.isLight).forEach((l) => { l.intensity = l.isHemisphereLight ? 1.1 : 0.7; });
  // 땅 (멀리 어두운 들판)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshBasicMaterial({ color: 0x3b3442 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; scene.add(ground);

  // 새: 끝이 뾰족한 쐐기 (+z가 앞)
  const MAXN = 3000;
  const bg = new THREE.ConeGeometry(0.42, 1.7, 4); bg.rotateX(Math.PI / 2); bg.scale(1.35, 0.45, 1);   // 납작한 쐐기
  const birds = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXN);
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); birds.frustumCulled = false; scene.add(birds);
  const CORE = new THREE.Color('#10131f'), EDGE = new THREE.Color('#3f7cff'), col = new THREE.Color();
  for (let i = 0; i < MAXN; i++) birds.setColorAt(i, CORE);
  // 매: 크고 주황빛인 쐐기 하나
  const hg = new THREE.ConeGeometry(1.3, 5.2, 4); hg.rotateX(Math.PI / 2); hg.scale(1.6, 0.4, 1);
  const hawk = new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ color: 0xe8590c, emissive: 0x6b1d00 })); hawk.visible = false; scene.add(hawk);
  // 그림자: 땅 위 옅은 점
  const spos = new Float32Array(MAXN * 3), sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const shadow = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0x000000, size: 1.6, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.frustumCulled = false; scene.add(shadow);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), fwd = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3();
  const tgt = new THREE.Vector3(), cen = new THREE.Vector3();
  let simRef = null, colorTick = 0, fpsT = 0, fpsN = 0, slowSec = 0;
  const rot = $('mm-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });

  function update(dt) {
    const st = window.MurmState; if (!st || !st.sim) return;
    const sim = st.sim, n = sim.n;
    if (sim !== simRef) { simRef = sim; const c = sim.centroid(); cen.set(c[0], c[1], c[2]); camera.position.add(cen.clone().sub(controls.target)); controls.target.copy(cen); }
    // 한 걸음 전과 지금 사이를 시간 비율만큼 이어 그린다
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const { px, py, pz, ox, oy, oz, hx, hy, hz } = sim;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += px[i]; cy += py[i]; cz += pz[i]; }
    cx /= n; cy /= n; cz /= n;
    let md = 0; for (let i = 0; i < n; i++) md += Math.sqrt((px[i] - cx) ** 2 + (py[i] - cy) ** 2 + (pz[i] - cz) ** 2); md = md / n || 1;
    const recolor = (colorTick++ % 3) === 0;
    for (let i = 0; i < n; i++) {
      const x = ox[i] + (px[i] - ox[i]) * a, y = oy[i] + (py[i] - oy[i]) * a, z = oz[i] + (pz[i] - oz[i]) * a;
      p.set(x, y, z); dir.set(hx[i], hy[i], hz[i]); q.setFromUnitVectors(fwd, dir);
      m4.compose(p, q, s1); birds.setMatrixAt(i, m4);
      spos[i * 3] = x; spos[i * 3 + 1] = GROUND + 0.05; spos[i * 3 + 2] = z;
      if (recolor) { const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2), t = Math.min(1, Math.max(0, (d / md - 0.85) / 0.9)); col.copy(CORE).lerp(EDGE, t); birds.setColorAt(i, col); }
    }
    birds.count = n; birds.instanceMatrix.needsUpdate = true; if (recolor && birds.instanceColor) birds.instanceColor.needsUpdate = true;
    sgeo.setDrawRange(0, n); sgeo.attributes.position.needsUpdate = true;
    const H = sim.hawk;
    if (H) {
      hawk.visible = true;
      hawk.position.set(H.ox + (H.x - H.ox) * a, H.oy + (H.y - H.oy) * a, H.oz + (H.z - H.oz) * a);
      dir.set(H.hx, H.hy, H.hz); hawk.quaternion.setFromUnitVectors(fwd, dir);
    } else hawk.visible = false;
    // 카메라는 떼의 중심을 천천히 따라간다 (보는 각도는 그대로)
    tgt.set(cx, cy, cz); const k = st.thumb ? 1 : Math.min(1, dt * 1.5);
    cen.copy(controls.target).lerp(tgt, k); camera.position.add(cen.clone().sub(controls.target)); controls.target.copy(cen);
    // 너무 느리면(초당 24프레임 미만이 3초 넘게) 새 수를 줄인다
    if (!st.thumb && !st.isPaused()) {
      fpsT += dt; fpsN++;
      if (fpsT >= 1) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; slowSec = fps < 24 ? slowSec + 1 : 0; if (slowSec >= 3) { slowSec = 0; st.reduce('fps'); } }
    }
  }
  v.onFrame((dt) => update(dt));
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(controls.target.x + 16, controls.target.y - 2, controls.target.z + 52);
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Murm3D = { v, update };
}
