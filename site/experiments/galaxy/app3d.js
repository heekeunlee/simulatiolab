// ① 두 은하가 만나는 밤하늘 (3D): app.js가 window.GalaxyState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 별 = 빛나는 작은 점(색 2종: 큰 은하 = 푸른 흰색, 작은 은하 = 노란빛), 은하 중심 = 크고 하얀 빛 두 개
// - 한 걸음 전과 지금 위치 사이를 시간 비율만큼 이어 그린다(보간, 결과에는 영향 없음)
// - 좌표: 시뮬레이션 (x, y, z) → 화면 (x, z, -y). 두 은하가 도는 면(x-y)이 바닥처럼 놓인다
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.GalaxyState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of two colliding galaxies');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.05';   // 휴대폰에서는 조금 더 높게
  const v = create3D(canvas, { camera: [0, 6.5, 8.5], target: [0, 0, 0], background: '#070b1d', dark: true, autoRotateSpeed: 0.35, minDistance: 2.5, maxDistance: 40, far: 500, fov: 50 });
  if (v) init(v);
}

function glowMaterial(size) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: size }, uScale: { value: 400 } },
    vertexShader: `attribute vec3 color; varying vec3 vC; uniform float uSize; uniform float uScale;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, uSize * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
      float a = smoothstep(1.0, 0.0, r); a = a * a * 0.9 + (r < 0.35 ? 0.35 : 0.0); gl_FragColor = vec4(vC * a, a); }`,
  });
}

function init(v) {
  const { scene, camera, controls, renderer } = v;
  const MAXN = 8000;
  const pos = new Float32Array(MAXN * 3), col = new Float32Array(MAXN * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starMat = glowMaterial(0.095);
  const stars = new THREE.Points(geo, starMat); stars.frustumCulled = false; scene.add(stars);
  const CA = new THREE.Color('#a9c8ff'), CB = new THREE.Color('#ffc861');
  // 은하 중심: 크고 하얀 빛 두 개
  const cpos = new Float32Array(6), ccol = new Float32Array([1, 1, 1, 1, 0.95, 0.85]);
  const cgeo = new THREE.BufferGeometry();
  cgeo.setAttribute('position', new THREE.BufferAttribute(cpos, 3).setUsage(THREE.DynamicDrawUsage));
  cgeo.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
  const coreMat = glowMaterial(0.7);
  const cores = new THREE.Points(cgeo, coreMat); cores.frustumCulled = false; scene.add(cores);

  let simRef = null, fpsT = 0, fpsN = 0, slowSec = 0;
  const rot = $('gx-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  const scale = () => { const h = renderer.domElement.height || 400; const s = h / (2 * Math.tan((camera.fov * Math.PI) / 360)); starMat.uniforms.uScale.value = s; coreMat.uniforms.uScale.value = s; };

  function update(dt) {
    const st = window.GalaxyState; if (!st || !st.sim) return;
    const sim = st.sim, n = sim.n;
    if (sim !== simRef) {   // 새 판: 별 색을 다시 칠한다
      simRef = sim;
      for (let i = 0; i < sim.px.length && i < MAXN; i++) { const c = sim.gal[i] === 0 ? CA : CB; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.attributes.color.needsUpdate = true;
    }
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const { px, py, pz, ox, oy, oz } = sim;
    for (let i = 0; i < n && i < MAXN; i++) {
      pos[i * 3] = ox[i] + (px[i] - ox[i]) * a;
      pos[i * 3 + 1] = oz[i] + (pz[i] - oz[i]) * a;
      pos[i * 3 + 2] = -(oy[i] + (py[i] - oy[i]) * a);
    }
    geo.setDrawRange(0, Math.min(n, MAXN)); geo.attributes.position.needsUpdate = true;
    for (let g = 0; g < 2; g++) {
      cpos[g * 3] = sim.ocx[g] + (sim.cx[g] - sim.ocx[g]) * a;
      cpos[g * 3 + 1] = sim.ocz[g] + (sim.cz[g] - sim.ocz[g]) * a;
      cpos[g * 3 + 2] = -(sim.ocy[g] + (sim.cy[g] - sim.ocy[g]) * a);
    }
    // 합쳐지면 중심 빛은 하나만 보인다(두 점이 겹침)
    cgeo.attributes.position.needsUpdate = true;
    scale();
    // 너무 느리면(초당 24프레임 미만이 3초 넘게) 별 수를 줄인다
    if (!st.thumb && !st.isPaused()) {
      fpsT += dt; fpsN++;
      if (fpsT >= 1) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; slowSec = fps < 24 ? slowSec + 1 : 0; if (slowSec >= 3) { slowSec = 0; st.reduce('fps'); } }
    }
  }
  v.onFrame((dt) => update(dt));
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(1.5, 8.5, 8.0);
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Galaxy3D = { v, update };
}
