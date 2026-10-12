// ⑥ 3D 숲에서 보기: 2D와 같은 펄스 결합 규칙(sim.js)을 높이가 있는 숲(바닥 1x1, 높이 0.3)에서 돌린다.
// - 반딧불이는 자기 자리 근처에서 살짝 떠다닐 뿐, 이웃 관계는 처음 자리로 정해진다 (2D와 같은 방식)
// - "위상을 색으로"를 고르면 각 반딧불이의 시계(위상)를 색상환 색으로 칠한다: 같은 색 덩어리 = 박자가 맞은 무리
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const FF = window.Firefly;
const H3 = 0.3;           // 숲 높이 (바닥 한 변 대비) — tools/validate-firefly.js와 같은 값
const S = 20;             // 화면 단위: 바닥 한 변 = 20
const $ = (id) => document.getElementById(id);

if (canvas && FF) {
  canvas.setAttribute('aria-label', '3D forest view of fireflies');
  const sec = canvas.closest('section'); if (sec) sec.style.gridColumn = '1 / -1';   // 3D는 한 줄 전체 폭
  if ((canvas.parentElement.clientWidth || 999) < 600) canvas.style.aspectRatio = '1 / 0.85';   // 휴대폰에서는 조금 더 높게
  const v = create3D(canvas, { camera: [0, 16, 29], target: [0, 2.4, 0], background: '#050916', dark: true, autoRotateSpeed: 0.45, minDistance: 8, maxDistance: 60, aspect: 0.62 });
  if (v) init(v);
}

function init(v) {
  const { scene, renderer } = v;
  scene.fog = new THREE.FogExp2(0x050916, 0.016);
  // 기본 조명은 달빛처럼 약하게, 반딧불이가 한꺼번에 반짝이면 숲이 따뜻하게 밝아진다
  scene.children.filter((o) => o.isLight).forEach((l) => { l.intensity = 0.35; l.color.set(0x8fa3d9); });
  const warm = new THREE.HemisphereLight(0xffd970, 0x332200, 0); scene.add(warm);

  // 바닥과 나무 기둥 (난수 고정 → 항상 같은 숲)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(S * 0.95, 64), new THREE.MeshStandardMaterial({ color: 0x0c1424, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  let a = 12345; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  const TREES = 18, trunkH = 11;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.34, trunkH, 9), new THREE.MeshStandardMaterial({ color: 0x4a4336, roughness: 0.95 }), TREES);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let k = 0; k < TREES; k++) {
    const ang = rnd() * Math.PI * 2, rad = 2 + Math.sqrt(rnd()) * S * 0.6, s = 0.7 + rnd() * 0.8;
    sc.set(s, 1, s); m4.compose(new THREE.Vector3(Math.cos(ang) * rad, trunkH / 2, Math.sin(ang) * rad), q, sc); trunk.setMatrixAt(k, m4);
  }
  scene.add(trunk);

  // 반딧불이: 점(Points) + 부드러운 빛 무리 셰이더
  const N = 150;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), glw = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(glw, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: renderer.getPixelRatio() * 1 } },
    vertexShader: `attribute vec3 aColor; attribute float aGlow; uniform float uScale; varying vec3 vC; varying float vG;
      void main() { vC = aColor; vG = aGlow; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (40.0 + 100.0 * aGlow) * uScale * (10.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vG;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        float core = smoothstep(0.38, 0.0, d), halo = pow(1.0 - d, 2.0);
        float a = clamp(core * (0.75 + 0.25 * vG) + halo * (0.15 + 0.85 * vG), 0.0, 1.0);
        gl_FragColor = vec4(vC * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);

  // 0번 반딧불이가 볼 수 있는 범위 (옅은 구)
  const ring = new THREE.Group();
  ring.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.045, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
  ring.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0x9fb4ff, wireframe: true, transparent: true, opacity: 0.025, depthWrite: false, fog: false })));
  scene.add(ring);

  let sim = null, acc = 0, home = null, wob = null, lastText = 0;
  const colorMode = () => ($('ff3-color') ? $('ff3-color').value : 'glow');
  const speed = () => ($('ff3-speed') ? Number($('ff3-speed').value) : 50);
  function build(P) {
    sim = FF.create(Object.assign({}, P, { h3: H3, cycles: 1e6 }));
    home = new Float32Array(N * 3); wob = new Float32Array(N * 4);
    for (let i = 0; i < sim.n; i++) {
      home[i * 3] = (sim.x[i] - 0.5) * S; home[i * 3 + 1] = 0.8 + sim.z[i] * S; home[i * 3 + 2] = (sim.y[i] - 0.5) * S;
      for (let k = 0; k < 4; k++) wob[i * 4 + k] = rnd() * Math.PI * 2;
    }
    ring.scale.setScalar(sim.params.radius * S); acc = 0; lastText = 0;
  }
  const P0 = window.FireflyApp ? window.FireflyApp.params() : {};
  build(P0);
  window.addEventListener('firefly:build', (e) => build(e.detail));
  const rs = $('ff3-restart'); if (rs) rs.addEventListener('click', () => build(window.FireflyApp ? window.FireflyApp.params() : P0));

  // 확인용: window.Firefly3D.skip(k) 로 k단계 건너뛰기 (헤드리스 캡처에서 사용)
  const T3 = window.Firefly3D = { paused: false, skip: (k) => { for (let i = 0; i < k; i++) sim.advance(); }, sim: () => sim };
  const c = new THREE.Color();
  v.onFrame((dt, t) => {
    acc += dt * speed();
    let k = 0; if (T3.paused) acc = 0; while (acc >= 1 && k < 12) { acc -= 1; sim.advance(); k++; }
    if (acc > 1) acc = 0;
    const phaseMode = colorMode() === 'phase';
    let tot = 0;
    for (let i = 0; i < sim.n; i++) {
      const w = i * 4, h = i * 3, g = sim.glow[i];
      pos[h] = home[h] + 0.35 * Math.sin(t * 0.7 + wob[w]);
      pos[h + 1] = home[h + 1] + 0.25 * Math.sin(t * 0.9 + wob[w + 1]);
      pos[h + 2] = home[h + 2] + 0.35 * Math.sin(t * 0.6 + wob[w + 2]);
      glw[i] = g; tot += g;
      if (phaseMode) { c.setHSL(sim.phase[i], 0.9, 0.5 + 0.2 * g); col[h] = c.r; col[h + 1] = c.g; col[h + 2] = c.b; }
      else { col[h] = 0.3 + 0.7 * g; col[h + 1] = 0.36 + 0.56 * g; col[h + 2] = 0.2 + 0.2 * g; }
    }
    ring.position.set(pos[0], pos[1], pos[2]);
    geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aGlow.needsUpdate = true;
    warm.intensity = 2.2 * (tot / sim.n);
    mat.uniforms.uScale.value = renderer.getPixelRatio() * Math.min(1, (canvas.clientHeight || 560) / 560);   // 작은 화면(휴대폰)에서는 점도 작게
    if (t - lastText > 0.4) {
      lastText = t; const el = $('ff3-when');
      if (el) el.textContent = `${Math.floor(sim.step * sim.params.dt)}주기 · 동기화 r=${sim.sync().toFixed(2)}`;
    }
  });
}
