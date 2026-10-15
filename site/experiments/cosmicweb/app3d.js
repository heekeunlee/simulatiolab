// ① 먼지가 거미줄이 되는 상자 (3D): app.js가 window.CosmicState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 먼지 알갱이 = 빛나는 점(THREE.Points). 한 걸음 전과 지금 위치 사이를 부드럽게 이어 그린다(보간, 결과에는 영향 없음)
// - 색 3종: 알갱이 자리의 밀도로 성긴 곳(푸른 보라) · 필라멘트(하늘빛 흰색) · 덩어리(금빛). 상자 테두리 = 주기 상자
// - 휴대폰은 알갱이 셋 중 하나만 그린다(계산은 같은 32,768개)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.CosmicState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of dust gathering into a cosmic web');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [30, 18, 44], target: [0, 0, 0], background: '#060a1c', dark: true, autoRotateSpeed: 0.35, minDistance: 14, maxDistance: 140, far: 1000, fov: 50 });
  if (v) init(v);
}

function init(v) {
  const { scene, camera, controls } = v;
  const CW = window.CosmicWeb, C = CW.C, LB = C.NG, HALF = LB / 2;
  const SMALL = (window.innerWidth || 1000) < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const STRIDE = SMALL ? 3 : 1, NMAX = Math.ceil(LB * LB * LB / STRIDE);
  // 둥근 빛 점 무늬
  const tc = document.createElement('canvas'); tc.width = tc.height = 64;
  { const g = tc.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const tex = new THREE.CanvasTexture(tc);
  const pos = new Float32Array(NMAX * 3), colr = new Float32Array(NMAX * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  const mat = new THREE.PointsMaterial({ size: SMALL ? 0.62 : 0.42, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, opacity: 0.9 });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  // 주기 상자 테두리
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(LB, LB, LB)), new THREE.LineBasicMaterial({ color: 0x6b7bb8, transparent: true, opacity: 0.45 }));
  scene.add(box);
  // 색: 밀도(평균 = 1)에 따라 성긴 곳 → 필라멘트 → 덩어리 (덩어리 기준 = 평균의 10배)
  const LOW = new THREE.Color('#4c5bd4'), MID = new THREE.Color('#bfe3ff'), HIGH = new THREE.Color('#ffc247'), col = new THREE.Color();
  const bright = SMALL ? 0.7 : 0.5;   // 겹쳐 더해지므로 점마다 어둡게 시작
  const rot = $('cw-rotate'); const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });

  function update() {
    const st = window.CosmicState; if (!st || !st.sim) return;
    const sim = st.sim, { px, py, pz, ox, oy, oz, dens } = sim, N = sim.n;
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    let j = 0;
    for (let i = 0; i < N; i += STRIDE, j++) {
      let dx = px[i] - ox[i], dy = py[i] - oy[i], dz = pz[i] - oz[i];
      if (dx > HALF) dx -= LB; else if (dx < -HALF) dx += LB; if (dy > HALF) dy -= LB; else if (dy < -HALF) dy += LB; if (dz > HALF) dz -= LB; else if (dz < -HALF) dz += LB;
      let x = ox[i] + dx * a, y = oy[i] + dy * a, z = oz[i] + dz * a;
      if (x < 0) x += LB; else if (x >= LB) x -= LB; if (y < 0) y += LB; else if (y >= LB) y -= LB; if (z < 0) z += LB; else if (z >= LB) z -= LB;
      pos[j * 3] = x - HALF; pos[j * 3 + 1] = z - HALF; pos[j * 3 + 2] = y - HALF;
      const d = dens[i];
      if (d < 1) col.copy(LOW).lerp(MID, Math.max(0, d) * 0.35);
      else if (d < C.DENSE) col.copy(LOW).lerp(MID, 0.35 + 0.65 * Math.log(d) / Math.log(C.DENSE));
      else col.copy(MID).lerp(HIGH, Math.min(1, 0.55 + Math.log(d / C.DENSE) / 2.5));
      const b = d < 1 ? bright * 0.85 : bright;
      colr[j * 3] = col.r * b; colr[j * 3 + 1] = col.g * b; colr[j * 3 + 2] = col.b * b;
    }
    geo.setDrawRange(0, j); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  v.onFrame(() => update());
  update();
  if (st0.thumb) {
    controls.autoRotate = false; camera.position.set(26, 14, 34);
    const shot = () => { update(); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Cosmic3D = { v, update };
}
