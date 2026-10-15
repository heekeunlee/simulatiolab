// ① 가상의 은하에서 켜졌다 꺼지는 문명 (3D): app.js가 window.DrakeState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 은하의 별 = 배경 장식(나선 팔 모양 점, 계산에 쓰지 않음). 문명 = 밝은 금색 점(갓 생기면 잠깐 크게 빛남)
// - 신호 = 문명이 생긴 때부터 빛의 속도로 퍼지는 고리(반지름 = 지난 햇수 광년). 주인이 사라져도 고리는 계속 퍼진다(회색)
// - 좌표: 1 = 1,000광년. 은하 원반은 가로(x, z), 두께는 위아래(y)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.DrakeState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of civilizations appearing and fading in a model galaxy');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [0, 52, 78], target: [0, 0, 0], background: '#060a1c', dark: true, autoRotateSpeed: 0.25, minDistance: 15, maxDistance: 260, far: 3000, fov: 50 });
  if (v) init(v);
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}

function init(v) {
  const { scene, camera, controls } = v;
  const DK = window.Drake, G = DK.G, K = 1 / 1000, small = st0.small;
  const tex = dotTexture();
  // 배경 별: 지수 원반 + 나선 팔 두 개 (장식)
  const NS = small ? 7000 : 18000, sp = new Float32Array(NS * 3), sc = new Float32Array(NS * 3), rnd = DK.mulberry32(77);
  const warm = new THREE.Color('#ffe2a8'), blue = new THREE.Color('#9fbaff'), col = new THREE.Color();
  for (let i = 0; i < NS; i++) {
    let r; do { r = -G.H * Math.log((rnd() || 1e-9) * (rnd() || 1e-9)); } while (r > G.R);
    const arm = rnd() < 0.65, base = arm ? (rnd() < 0.5 ? 0 : Math.PI) + Math.log(r / 2500 + 1) * 2.2 : rnd() * Math.PI * 2;
    const a = base + (arm ? (rnd() - 0.5) * 0.55 : 0);
    const z = (rnd() - 0.5) * 2 * (G.Z * 1.6) * (1 + 3 * Math.exp(-r / 4000));
    sp[i * 3] = r * Math.cos(a) * K; sp[i * 3 + 1] = z * K; sp[i * 3 + 2] = r * Math.sin(a) * K;
    col.copy(warm).lerp(blue, Math.min(1, r / 30000)); const b = 0.35 + 0.4 * rnd();
    sc[i * 3] = col.r * b; sc[i * 3 + 1] = col.g * b; sc[i * 3 + 2] = col.b * b;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: small ? 0.55 : 0.45, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd9a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.scale.set(16, 9, 1); scene.add(core);

  // 문명 점: 크기·색을 점마다 다르게 (갓 생긴 문명은 크게)
  const MAXC = 3200, cp = new Float32Array(MAXC * 3), cc = new Float32Array(MAXC * 3), cs = new Float32Array(MAXC);
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); cg.setAttribute('size', new THREE.BufferAttribute(cs, 1));
  const cmat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 300 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.a, t.a); }',
  });
  const civPts = new THREE.Points(cg, cmat); civPts.frustumCulled = false; scene.add(civPts);
  const GOLD = new THREE.Color('#ffd43b'), FLASH = new THREE.Color('#fff7d6');

  // 신호 고리: 반지름 1짜리 얇은 고리를 늘려 쓴다
  const MAXR = small ? 60 : 90;
  const ringMesh = (inner) => {
    const g = new THREE.RingGeometry(inner, 1, 128); g.rotateX(-Math.PI / 2);
    const r = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), MAXR);
    r.instanceMatrix.setUsage(THREE.DynamicDrawUsage); r.frustumCulled = false; r.count = 0; scene.add(r); return r;
  };
  const ringsA = ringMesh(0.955), ringsD = ringMesh(0.994);   // 살아 있는 문명의 신호는 굵게, 주인이 사라진 신호는 가늘고 옅게
  const ALIVE_R = new THREE.Color('#3be3ff'), DEAD_R = new THREE.Color('#8a8fa8');
  for (let i = 0; i < MAXR; i++) { ringsA.setColorAt(i, ALIVE_R); ringsD.setColorAt(i, DEAD_R); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s3 = new THREE.Vector3();

  const rot = $('dk-rotate'), autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });

  function update() {
    const st = window.DrakeState; if (!st || !st.sim) return;
    const sim = st.sim;
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const t = sim.t - sim.dt * (1 - a);   // 한 걸음 전과 지금 사이 (보간, 결과에는 영향 없음)
    const flash = Math.max(sim.dt * 3, sim.T / 100);   // 아주 짧게 사는 문명도 눈에 보이게 잠깐 남겨 그린다(그림만, 숫자에는 안 들어감)
    let n = 0; const ringList = [];
    for (const c of sim.civs) {
      if (c.b > t) continue;
      const age = t - c.b, aliveNow = c.e > t, gone = t - c.e;
      if (age < G.RING) ringList.push(c);
      if (n >= MAXC) continue;
      let size = 0, b = 0, colr = GOLD;
      if (aliveNow) { size = age < flash ? 2.6 + 3.2 * (1 - age / flash) : 2.4; b = 1; colr = age < flash * 0.6 ? FLASH : GOLD; }
      else if (gone < flash) { size = 2.2; b = 0.8 * (1 - gone / flash); }
      if (b <= 0) continue;
      cp[n * 3] = c.x * K; cp[n * 3 + 1] = c.z * K; cp[n * 3 + 2] = c.y * K;
      cc[n * 3] = colr.r * b; cc[n * 3 + 1] = colr.g * b; cc[n * 3 + 2] = colr.b * b; cs[n] = size * (small ? 1.6 : 1.3); n++;
    }
    cg.setDrawRange(0, n); cg.attributes.position.needsUpdate = true; cg.attributes.color.needsUpdate = true; cg.attributes.size.needsUpdate = true;
    ringList.sort((x, y) => y.b - x.b);
    let ka = 0, kd = 0;
    for (let i = 0; i < ringList.length && (ka < MAXR || kd < MAXR); i++) {
      const c = ringList[i], r = Math.max(0.05, (t - c.b) * K), alive = c.e > t, R = alive ? ringsA : ringsD;
      if (alive ? ka >= MAXR : kd >= MAXR) continue;
      const j = alive ? ka++ : kd++;
      p.set(c.x * K, c.z * K, c.y * K); s3.set(r, 1, r); m4.compose(p, q, s3); R.setMatrixAt(j, m4);
      const fade = 1 - (t - c.b) / G.RING;   // 멀리 퍼질수록 옅게
      col.copy(alive ? ALIVE_R : DEAD_R).multiplyScalar(alive ? 0.6 + 0.4 * fade : 0.3 * fade * fade); R.setColorAt(j, col);
    }
    [[ringsA, ka], [ringsD, kd]].forEach(([R, k]) => { R.count = k; R.instanceMatrix.needsUpdate = true; if (R.instanceColor) R.instanceColor.needsUpdate = true; });
  }
  v.onFrame(() => update());
  update();
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(0, 46, 58);
    const shot = () => { update(); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Drake3D = { v, update };
}
