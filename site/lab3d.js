// 3D 실험 공용 도구 (three.js r160, site/vendor/three). ES 모듈.
//   import { THREE, create3D } from '../../lab3d.js';
//   const v = create3D(canvas, { camera: [x, y, z], target: [0, 0, 0], autoRotate: true, background: '#f6f7fb' });
//   v.scene.add(...); v.onFrame((dt, t) => { ... }); v.render();
// - 마우스 드래그로 회전, 휠·핀치로 확대, 화면 밖에 있으면 그리지 않음, '동작 줄이기' 설정이면 자동 회전 끔
// - WebGL을 못 쓰는 브라우저에서는 캔버스 자리에 안내 문구를 보여주고 null을 반환
import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';
export { THREE };

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

export function create3D(canvas, opt = {}) {
  if (!webglOK()) {
    const p = document.createElement('p'); p.className = 'small';
    p.textContent = '이 브라우저에서는 3D 보기를 쓸 수 없어요. (WebGL 미지원)';
    canvas.replaceWith(p); return null;
  }
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opt.background || '#f6f7fb');
  const camera = new THREE.PerspectiveCamera(opt.fov || 45, 1, 0.1, opt.far || 2000);
  camera.position.set(...(opt.camera || [0, 6, 12]));
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...(opt.target || [0, 0, 0]));
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.autoRotate = opt.autoRotate !== false && !reduce; controls.autoRotateSpeed = opt.autoRotateSpeed || 0.8;
  controls.enablePan = !!opt.pan;
  if (opt.minDistance) controls.minDistance = opt.minDistance;
  if (opt.maxDistance) controls.maxDistance = opt.maxDistance;
  // 사용자가 만지면 자동 회전을 잠시 멈춘다
  let idle; controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idle); });
  controls.addEventListener('end', () => { clearTimeout(idle); if (opt.autoRotate !== false && !reduce) idle = setTimeout(() => { controls.autoRotate = true; }, 4000); });
  // 기본 조명
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, opt.dark ? 0.6 : 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, opt.dark ? 0.6 : 1.2); sun.position.set(5, 10, 7); scene.add(sun);

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const h = canvas.clientHeight || Math.round(w * (opt.aspect || 0.62));
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas.parentElement);
  let visible = true;
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; }).observe(canvas);
  const frames = []; let last = performance.now();
  function loop(now) {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; // 첫 프레임의 rAF 시각이 생성 시각보다 이를 수 있어 음수를 막는다
    if (visible && !document.hidden) { frames.forEach((f) => f(dt, now / 1000)); controls.update(); renderer.render(scene, camera); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return { THREE, scene, camera, renderer, controls, onFrame: (f) => frames.push(f), render: () => renderer.render(scene, camera), resize };
}
