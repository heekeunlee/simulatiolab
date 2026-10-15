// ① 관측자 둘레의 별 하늘 (3D): app.js가 window.NightState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - '보이는 대로' 보기: 별을 관측자 둘레의 큰 공(하늘)에 방향만 살려 찍는다. 크기 = 보이는 밝기, 지금 하늘 한계보다 어두운 별은 안 그린다.
// - '실제 거리' 보기: 같은 별을 진짜 위치로 펼친다. 안 보이는 별까지 옅게 그려 '보이는 별이 얼마나 가까이 몰려 있는지' 보여 준다.
// - 색 2종: 보이는 별(흰빛) ↔ 안 보이는 별(옅은 남색). 모양은 점과 관측자 표시 둘뿐.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.NightState;
const SMALL = (window.innerWidth || 1000) < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
const SKY = 60, SCALE = SKY / 100, D_SKY = 7, D_SPACE = 175;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of the night sky around an observer');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [D_SKY * 0.75, D_SKY * 0.25, D_SKY * 0.6], target: [0, 0, 0], background: '#070b1c', dark: true, autoRotateSpeed: 0.35, minDistance: 1.5, maxDistance: 420, far: 3000, fov: 66 });
  if (v) init(v);
}

function init(v) {
  const { scene, camera, controls, renderer } = v;
  const MAXP = SMALL ? 30000 : 100000;   // 3D에 그리는 점 수 상한(안 보이는 별만 솎음, 보일 수 있는 별은 모두 그림). 계산은 그대로
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMix: { value: 0 }, uCur: { value: -9 }, uLim: { value: 6 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute vec3 aDome; attribute float aMag; uniform float uMix, uCur, uLim, uPx; varying float vA; varying vec3 vC;
      void main(){ vec3 p = mix(aDome, position, uMix);
        float on = 1.0 - smoothstep(uCur - 0.25, uCur, aMag);           // 지금 하늘 한계보다 밝은 별만 보임(경계에서 서서히)
        float s = clamp(2.0 + pow(max(0.0, uLim + 0.5 - aMag), 1.5) * 1.3, 2.4, 22.0);   // 보이는 밝기가 밝을수록 큰 점(밝은 별을 훨씬 크게)
        float sh = 1.4 * uMix;                                            // 안 보이는 별: 실제 거리 보기에서만 작게
        gl_PointSize = mix(sh, s, on) * uPx;
        float br = mix(0.4, 1.0, clamp((uLim + 0.5 - aMag) / 4.0, 0.0, 1.0));   // 어두운 별은 흐리게
        vA = mix(0.33 * uMix, br, on); vC = mix(vec3(0.36, 0.45, 0.72), vec3(1.0, 0.97, 0.88), on);
        if (gl_PointSize < 0.5) vA = 0.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5 || vA <= 0.0) discard;
      float a = vA * min(1.0, smoothstep(0.5, 0.0, r) * 0.6 + smoothstep(0.42, 0.22, r) * 0.9); gl_FragColor = vec4(vC * a, a); }`,
  });
  let pts = null, simRef = null, mixT = 0, mixNow = 0;
  // 지평선(가는 원)과 관측자(작은 공)
  const ringG = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, k) => new THREE.Vector3(Math.cos(k / 128 * Math.PI * 2) * SKY, 0, Math.sin(k / 128 * Math.PI * 2) * SKY)));
  const ring = new THREE.Line(ringG, new THREE.LineBasicMaterial({ color: 0x3d5a99, transparent: true, opacity: 0.55 })); scene.add(ring);
  const me = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0x4ade80 })); scene.add(me);

  function build(sim) {
    if (pts) { scene.remove(pts); pts.geometry.dispose(); }
    const keep = new Uint8Array(sim.N); for (let k = 0; k < sim.order.length; k++) keep[sim.order[k]] = 1;
    const extra = Math.max(0, MAXP - sim.order.length), rest = sim.N - sim.order.length, every = rest > extra ? rest / Math.max(1, extra) : 1;
    const idx = []; let acc = 0;
    for (let i = 0; i < sim.N; i++) { if (keep[i]) idx.push(i); else { acc += 1; if (acc >= every) { acc -= every; idx.push(i); } } }
    const n = idx.length, pos = new Float32Array(n * 3), dome = new Float32Array(n * 3), mag = new Float32Array(n);
    idx.forEach((i, k) => {
      const d = sim.d[i];
      pos[k * 3] = sim.x[i] * SCALE; pos[k * 3 + 1] = sim.y[i] * SCALE; pos[k * 3 + 2] = sim.z[i] * SCALE;
      dome[k * 3] = sim.x[i] / d * SKY; dome[k * 3 + 1] = sim.y[i] / d * SKY; dome[k * 3 + 2] = sim.z[i] / d * SKY;
      mag[k] = sim.m[i];
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aDome', new THREE.BufferAttribute(dome, 3)); g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY * 1.1);
    pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
    mat.uniforms.uLim.value = sim.lim;
  }

  const viewSel = $('ns-view'), rot = $('ns-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  let camGoal = null;
  function setView(first) {
    mixT = viewSel && viewSel.value === 'space' ? 1 : 0;
    camGoal = mixT ? D_SPACE : D_SKY;
    if (first) { mixNow = mixT; camera.position.setLength(camGoal); camGoal = null; }
  }
  if (viewSel) viewSel.addEventListener('change', () => setView(false));
  setView(true);

  const tmp = new THREE.Vector3();
  function update(dt) {
    const st = window.NightState; if (!st || !st.sim) return;
    const sim = st.sim;
    if (sim !== simRef) { simRef = sim; build(sim); }
    // 한 걸음 사이를 시간 비율만큼 이어 그린다(하늘이 부드럽게 어두워지게, 결과에는 영향 없음)
    const a = st.isPaused() || st.thumb || sim.done ? 0 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    mat.uniforms.uCur.value = Math.min(sim.lim, sim.cur + (sim.done ? 0 : a * 0.05));
    mixNow += (mixT - mixNow) * Math.min(1, dt * 3); if (Math.abs(mixT - mixNow) < 0.002) mixNow = mixT;
    mat.uniforms.uMix.value = mixNow;
    me.scale.setScalar(Math.max(0.001, mixNow)); me.visible = mixNow > 0.05;
    if (camGoal != null) {
      tmp.copy(camera.position).sub(controls.target); const L0 = tmp.length(), L1 = L0 + (camGoal - L0) * Math.min(1, dt * 3);
      camera.position.copy(controls.target).add(tmp.setLength(L1)); if (Math.abs(L1 - camGoal) < 0.5) camGoal = null;
    }
  }
  v.onFrame((dt) => update(dt));
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(4.2, 1.6, 5.2);
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.NightSky3D = { v, update, setView };
}
