// ① 국경을 사이에 둔 두 군사 기지 (3D): app.js가 window.ArmsState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 왼쪽 = A국(파랑), 오른쪽 = B국(주황). 가운데 모래색 띠 = 국경 완충 지대(철책·감시탑).
// - 연병장의 차량·미사일 발사대·전투기 1대 = 군비 1 (지금 군비만큼 늘어선다, 최대 200). 뒤에서부터 채워져 군비가 늘수록 줄이 국경 쪽으로 다가온다.
//   차량 3 : 발사대 1 : 전투기 1 비율로 섞어 놓을 뿐 종류에 따른 의미는 없다.
// - 한 줄 = 20대(차량 12·발사대 4·전투기 4). 연병장의 빨간 선 = 과열선 100 (군비 100이면 줄이 딱 이 선까지 온다). 지금 군비가 100 이상인 나라는 경보등이 돌고 붉은 파문이 퍼진다.
// - 금괴 더미 = 같은 군비를 예산으로 본 것(금괴 1개 = 군비 4).
// - 10년째 합의가 있으면 국경 한가운데 협상 천막(테이블·깃발)이 선다. 합의 뒤 군비가 줄면 앞줄부터 차량이 빠진다.
// - 뒤쪽 홀로그램 지도 = ③ 위상 평면과 같은 그림(가로 A, 세로 B, 0~200): 지나온 길, 지금 자리, 두 나라의 균형선.
// 한 걸음 전과 지금 사이를 이어 그려 부드럽게 보일 뿐 결과에는 영향이 없다. 레이더·깃발·파문 같은 움직임은 꾸밈이다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.ArmsState;
const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const tr = (s) => (window.I18N && window.I18N.t ? window.I18N.t(s) : s);

// ---------- 배치 (x: 서(A) ↔ 동(B), 국경 x = 0, z: 앞(+) ↔ 뒤(−)) ----------
const ROW0 = 12.5, ROWD = 1.0, NROW = 10;      // 줄 r의 자리 |x| = ROW0 − r·ROWD (뒤에서 앞으로)
const XHOT = ROW0 - 4.5 * ROWD;                 // 과열선 100: 5번째 줄과 6번째 줄 사이 (한 줄 = 20대)
const ZONES = [                                  // 종류별 칸: 열 수, 열의 z 자리
  { cols: 12, z: (c) => -13.5 + c * 1.1 },      // 0 차량(전차)
  { cols: 4, z: (c) => 0.4 + c * 1.45 },         // 1 미사일 발사대
  { cols: 4, z: (c) => 6.6 + c * 1.9 },          // 2 전투기
];
const VMAX = 200, GOLD = 4, NGOLD = 50;
const SIDE = [-1, 1];                            // A, B
const COL_A = '#2f6fed', COL_B = '#e8590c';
const CAMO = ['#5c7fb8', '#c27a45'];             // 장비 색(국기 색을 군용으로 탁하게)

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 여러 모양을 꼭짓점 색과 함께 한 모양으로 합친다 (parts: [geometry, '#색'])
function merge(parts) {
  const gs = parts.map(([g, c]) => {
    const n = g.index ? g.toNonIndexed() : g, col = new THREE.Color(c), cnt = n.attributes.position.count, ca = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
    return { p: n.attributes.position.array, nr: n.attributes.normal.array, c: ca };
  });
  let n = 0; gs.forEach((g) => { n += g.p.length; });
  const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n); let o = 0;
  gs.forEach((g) => { P.set(g.p, o); N.set(g.nr, o); C.set(g.c, o); o += g.p.length; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.computeBoundingSphere();
  return g;
}
const box = (w, h, d, x, y, z, rz = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
const cyl = (r1, r2, h, seg, x, y, z, axis) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); if (axis === 'x') g.rotateZ(-Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };

// 장비 모양 (모두 +x 쪽(앞)을 본다)
function tankGeo() {
  const W = '#ffffff', D = '#3a3d40', M = '#cfd3d6';
  return merge([
    [box(0.9, 0.2, 0.46, 0, 0.2, 0), W],                       // 차체
    [box(0.96, 0.15, 0.13, 0, 0.1, 0.235), D], [box(0.96, 0.15, 0.13, 0, 0.1, -0.235), D],   // 궤도
    [box(0.2, 0.12, 0.42, 0.44, 0.17, 0, -0.5), W],            // 앞 경사판
    [box(0.42, 0.15, 0.34, -0.06, 0.37, 0), W],                // 포탑
    [cyl(0.032, 0.032, 0.56, 6, 0.42, 0.38, 0, 'x'), M],       // 포신
    [box(0.1, 0.06, 0.1, -0.12, 0.47, 0.08), D],               // 해치
  ]);
}
function launcherGeo() {
  const W = '#ffffff', D = '#2f3236', G = '#9fb4c8', T = '#7f8790';
  const parts = [
    [box(0.3, 0.26, 0.42, 0.36, 0.25, 0), W],                  // 운전석
    [box(0.12, 0.1, 0.38, 0.47, 0.33, 0), G],                  // 앞유리
    [box(0.72, 0.1, 0.42, -0.14, 0.17, 0), W],                 // 짐칸
    [box(0.12, 0.2, 0.08, -0.36, 0.3, 0), D],                  // 받침대
  ];
  for (const z of [-0.09, 0.09]) {                             // 미사일 두 발 (앞으로 비스듬히 세움)
    const g = new THREE.CylinderGeometry(0.075, 0.075, 0.7, 10); g.rotateZ(-Math.PI / 2 + 0.55); g.translate(-0.12, 0.44, z); parts.push([g, T]);
    const h = new THREE.ConeGeometry(0.075, 0.16, 10); h.translate(0, 0.43, 0); h.rotateZ(-Math.PI / 2 + 0.55); h.translate(-0.12, 0.44, z); parts.push([h, '#ffffff']);
  }
  for (const x of [0.34, -0.06, -0.34]) for (const z of [-0.2, 0.2]) parts.push([cyl(0.075, 0.075, 0.07, 8, x, 0.08, z, 'z'), D]);   // 바퀴
  return merge(parts);
}
function jetGeo() {
  const W = '#ffffff', D = '#24303d', L = '#e2e6ea';
  const wing = new THREE.Shape(); wing.moveTo(0.18, 0); wing.lineTo(-0.2, 0.44); wing.lineTo(-0.3, 0.44); wing.lineTo(-0.22, 0); wing.lineTo(-0.3, -0.44); wing.lineTo(-0.2, -0.44); wing.closePath();
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.025, bevelEnabled: false }); wg.rotateX(Math.PI / 2); wg.translate(0, 0.17, 0);
  const tail = new THREE.Shape(); tail.moveTo(-0.24, 0); tail.lineTo(-0.42, 0.24); tail.lineTo(-0.47, 0.24); tail.lineTo(-0.44, 0); tail.closePath();
  const tg = new THREE.ExtrudeGeometry(tail, { depth: 0.02, bevelEnabled: false }); tg.translate(0, 0.17, -0.01);
  const ht = new THREE.Shape(); ht.moveTo(-0.32, 0); ht.lineTo(-0.44, 0.2); ht.lineTo(-0.48, 0.2); ht.lineTo(-0.47, 0); ht.lineTo(-0.48, -0.2); ht.lineTo(-0.44, -0.2); ht.closePath();
  const hg = new THREE.ExtrudeGeometry(ht, { depth: 0.015, bevelEnabled: false }); hg.rotateX(Math.PI / 2); hg.translate(0, 0.19, 0);
  return merge([
    [cyl(0.075, 0.06, 0.78, 10, -0.06, 0.18, 0, 'x'), W],      // 동체
    [cyl(0.0, 0.075, 0.22, 10, 0.44, 0.18, 0, 'x'), L],        // 기수
    [(() => { const g = new THREE.SphereGeometry(0.07, 10, 6); g.scale(1.9, 0.75, 0.8); g.translate(0.18, 0.24, 0); return g; })(), D],   // 조종석 유리
    [wg, W], [tg, W], [hg, W],
    [cyl(0.012, 0.012, 0.14, 4, 0.2, 0.08, 0, null), D], [cyl(0.012, 0.012, 0.14, 4, -0.18, 0.08, 0.12, null), D], [cyl(0.012, 0.012, 0.14, 4, -0.18, 0.08, -0.12, null), D],   // 바퀴 다리
  ]);
}

// 캔버스 무늬
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

function init(v, phone) {
  const { scene, camera, controls, renderer } = v;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (phone) { renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1)); v.resize(); }
  const SHADOW = !phone && !st0.thumb;
  renderer.shadowMap.enabled = SHADOW; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const lights = scene.children.filter((o) => o.isLight);
  const hemi = lights.find((o) => o.isHemisphereLight), sun = lights.find((o) => o.isDirectionalLight);
  hemi.color.set('#dfeeff'); hemi.groundColor.set('#6f7a52');
  sun.color.set('#fff1dc'); sun.position.set(-38, 62, 34);
  if (SHADOW) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 34; sc.bottom = -34; sc.near = 10; sc.far = 170; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  }
  scene.add(sun.target);
  const stdList = [];
  const std = (color, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.0 }, o)); stdList.push(m); return m; };
  const add = (geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast && SHADOW; m.receiveShadow = recv && SHADOW; scene.add(m); return m; };

  // ---------- 하늘 (낮/밤 섞기) + 안개 ----------
  const skyU = { uNight: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uNight; varying vec3 vP; void main(){ float y = vP.y;
      vec3 dTop = vec3(0.30,0.56,0.90), dMid = vec3(0.58,0.77,0.95), dHor = vec3(0.89,0.93,0.96);
      vec3 nTop = vec3(0.02,0.04,0.10), nMid = vec3(0.05,0.08,0.17), nHor = vec3(0.13,0.16,0.26);
      vec3 top = mix(dTop, nTop, uNight), mid = mix(dMid, nMid, uNight), hor = mix(dHor, nHor, uNight);
      vec3 c = y > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, y)) : mix(hor, mid, smoothstep(-0.02, 0.12, y));
      float st = step(0.9975, fract(sin(dot(floor(vP.xz * 260.0), vec2(12.9898, 78.233))) * 43758.5453)) * smoothstep(0.1, 0.4, y) * uNight;
      gl_FragColor = vec4(c + st * 0.8, 1.0); }`,
  }));
  sky.renderOrder = -1; scene.add(sky);
  // 반사용 주변 빛(금속·유리가 하늘을 비추게): 같은 하늘 + 풀색 땅을 한 번 구워 쓴다
  {
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), sky.material.clone()));
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(49, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6f7f55' })); gnd.position.y = -2; es.add(gnd);
    const sunS = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) })); sunS.position.set(-26, 34, 22); es.add(sunS);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
  }
  const FOG_D = new THREE.Color('#e3eaf0'), FOG_N = new THREE.Color('#141a2b');
  scene.fog = new THREE.Fog(FOG_D.clone(), 110, 430);

  // ---------- 땅: 가운데 평지 + 멀리 산 (꼭짓점 색) ----------
  {
    const G = 420, SEG = phone ? 120 : 180, g = new THREE.PlaneGeometry(G, G, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const grass = new THREE.Color('#7b9653'), grass2 = new THREE.Color('#62803f'), dry = new THREE.Color('#a49c68'), rock = new THREE.Color('#8b8a7e'), snow = new THREE.Color('#f3f5f7');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x * 0.8, z);
      const n = fbm(x * 0.035 + 7, z * 0.035 - 3), m = smooth(60, 125, r), h = m * (Math.pow(fbm(x * 0.02 + 1.3, z * 0.02 + 9), 1.35) * 78 + n * 7);
      p.setY(i, h - 0.02);
      c.copy(grass).lerp(grass2, smooth(0.35, 0.7, n)).lerp(dry, smooth(0.62, 0.85, fbm(x * 0.07, z * 0.07)) * 0.6);
      if (h > 9) c.lerp(rock, smooth(9, 20, h));
      if (h > 24) c.lerp(snow, smooth(24, 30, h));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    add(g, std('#ffffff', { vertexColors: true, roughness: 0.95 }), 0, 0, 0, false, true);
  }
  // 국경 완충 지대(모래색 띠) + 국경 표지
  const sandTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#d9c9a3'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '120,100,70' : '255,250,235'},${Math.random() * 0.18})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [2, 24]);
  add(new THREE.PlaneGeometry(6, 64).rotateX(-Math.PI / 2), std('#ffffff', { map: sandTex, roughness: 1 }), 0, 0.012, -2, false, true);

  // ---------- 기지 ----------
  const padTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#c8c6bf'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '90,90,90' : '255,255,255'},${Math.random() * 0.08})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(80,80,80,0.35)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h);
  }, [10, 9]);
  const padMat = std('#ffffff', { map: padTex, roughness: 0.92 });
  const asphalt = std('#4a4d52', { roughness: 0.9 });
  const runTex = canvasTex(128, 1024, (x, w, h) => {
    x.fillStyle = '#3f4247'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = '#f2f2ee'; x.fillRect(6, 0, 5, h); x.fillRect(w - 11, 0, 5, h);
    for (let y = 20; y < h - 120; y += 64) x.fillRect(w / 2 - 3, y, 6, 34);
    for (let k = 0; k < 6; k++) { x.fillRect(18 + k * 16, 20, 9, 70); x.fillRect(18 + k * 16, h - 90, 9, 70); }
  });
  const metal = std('#c4c9ce', { roughness: 0.5, metalness: 0.45 });
  const dark = std('#2b2f35', { roughness: 0.8 });
  const white = std('#f1efe9', { roughness: 0.8 });
  const roofMat = std('#7d8a8f', { roughness: 0.7, metalness: 0.2 });
  const glass = std('#28435a', { roughness: 0.15, metalness: 0.6, emissive: new THREE.Color('#ffd27a'), emissiveIntensity: 0 });
  const winTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#e8e4da'; x.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) { x.fillStyle = '#3d4b5a'; x.fillRect(10 + c * 24.5, 16 + r * 38, 14, 20); } });
  const winEm = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) { if (hash(r * 7 + 1, c * 3 + 2) < 0.72) { x.fillStyle = '#ffd690'; x.fillRect(10 + c * 24.5, 16 + r * 38, 14, 20); } } });
  const bldSide = std('#ffffff', { map: winTex, emissiveMap: winEm, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 0.8 });
  const bldMats = [bldSide, bldSide, roofMat, roofMat, bldSide, bldSide];
  const aoMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
  const ao = (w, d, x, z, o) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), o ? aoMat.clone() : aoMat); if (o) m.material.opacity = o; m.position.set(x, 0.03, z); scene.add(m); return m; };

  const glowTex = canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const beacons = [], ripples = [], flags = [], radars = [], poolsN = [], baseAnchors = [];
  const flagTex = SIDE.map((s, i) => canvasTex(128, 84, (x, w, h) => {
    x.fillStyle = i ? COL_B : COL_A; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    if (i) { x.beginPath(); x.moveTo(w * 0.36, h * 0.24); x.lineTo(w * 0.66, h * 0.5); x.lineTo(w * 0.36, h * 0.76); x.closePath(); x.fill(); }
    else { x.beginPath(); x.arc(w / 2, h / 2, h * 0.24, 0, 7); x.fill(); x.fillStyle = COL_A; x.beginPath(); x.arc(w / 2, h / 2, h * 0.12, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(0, h * 0.88, w, h * 0.06);
  }));
  function flag(i, x, y, z, size = 1) {
    add(cyl(0.05, 0.06, y + 0.2, 8, x, (y + 0.2) / 2, z), metal);
    const g = new THREE.PlaneGeometry(1.3 * size, 0.85 * size, 12, 4); g.translate(0.65 * size, 0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: flagTex[i], side: THREE.DoubleSide, roughness: 0.75 }));
    m.position.set(x + 0.05, y - 0.35 * size, z); m.castShadow = SHADOW; scene.add(m);
    const base = Float32Array.from(g.attributes.position.array);
    flags.push({ m, base, size, ph: x * 0.3 + z });
    return m;
  }
  function beacon(x, y, z, i) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#5a1d1d', toneMapped: false }));
    core.position.set(x, y, z); scene.add(core);
    const cg = new THREE.ConeGeometry(0.55, 2.4, 16, 1, true); cg.translate(0, -1.2, 0); cg.rotateZ(Math.PI / 2);
    const beam = new THREE.Group(); beam.position.set(x, y, z);
    const bm = new THREE.MeshBasicMaterial({ color: '#ff2a1f', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const b1 = new THREE.Mesh(cg, bm), b2 = new THREE.Mesh(cg, bm); b2.rotation.y = Math.PI; beam.add(b1, b2); scene.add(beam);
    beacons.push({ core, beam, bm, i });
  }

  const golds = [], hotGlows = [];
  SIDE.forEach((s, i) => {
    const X = (ax) => s * ax;
    // 연병장 + 과열선
    add(new THREE.BoxGeometry(10.6, 0.1, 27.9), padMat, X(8.15), 0.05, -0.6, false, true);
    ao(11.6, 28.9, X(8.15), -0.6, 0.12);
    const hot = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 27.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e11d2a', toneMapped: false, transparent: true, opacity: 0.9 }));
    hot.position.set(X(XHOT), 0.112, -0.6); scene.add(hot);
    const hotGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 27.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false }));
    hotGlow.position.set(X(XHOT), 0.114, -0.6); scene.add(hotGlow); hotGlows.push(hotGlow);
    // 줄 표시 (옅은 흰 선)
    // 활주로·유도로·도로
    const run = add(new THREE.PlaneGeometry(3.4, 46).rotateX(-Math.PI / 2), std('#ffffff', { map: runTex, roughness: 0.88 }), X(17.5), 0.02, -2, false, true);
    add(new THREE.PlaneGeometry(2.8, 2.4).rotateX(-Math.PI / 2), asphalt, X(14.6), 0.018, 6, false, true);
    add(new THREE.PlaneGeometry(2.8, 2.4).rotateX(-Math.PI / 2), asphalt, X(14.6), 0.018, -6, false, true);
    add(new THREE.PlaneGeometry(3.4, 2.4).rotateX(-Math.PI / 2), asphalt, X(20.9), 0.018, -8.2, false, true);
    // 활주로 등 (밤에 빛남)
    const rl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff4c2', toneMapped: false }), 48);
    for (let k = 0; k < 24; k++) for (let e = 0; e < 2; e++) { const o = new THREE.Object3D(); o.position.set(X(17.5) + (e ? 1.85 : -1.85), 0.08, -24.5 + k * 1.95); o.updateMatrix(); rl.setMatrixAt(k * 2 + e, o.matrix); }
    scene.add(rl); poolsN.push(rl);
    // 격납고 3동 (반원통, 문은 활주로 쪽)
    for (const z of [-21, -14.6, -8.2]) {
      const hx = X(23.6);
      const shell = new THREE.CylinderGeometry(2.5, 2.5, 5.2, 24, 1, true, 0, Math.PI); shell.rotateZ(Math.PI / 2); shell.rotateY(0);
      const hm = add(shell, std('#b9bfc4', { roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide }), hx, 0, z);
      const back = new THREE.CircleGeometry(2.5, 24, 0, Math.PI); back.rotateY(Math.PI / 2);
      const bk = add(back, std('#9aa1a7', { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.6 }), hx + s * 2.6, 0, z);
      const door = new THREE.CircleGeometry(2.45, 24, 0, Math.PI); door.rotateY(Math.PI / 2);
      add(door, std('#1f2328', { side: THREE.DoubleSide }), hx - s * 2.58, 0, z, false, false);
      ao(5.6, 5.8, hx, z, 0.25);
      hm.rotation.y = 0; bk.rotation.y = 0;
    }
    // 본부 건물 + 깃발 + 경보등
    const hq = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 4), bldMats); hq.position.set(X(23.5), 1.3, 5); hq.castShadow = hq.receiveShadow = SHADOW; scene.add(hq);
    add(new THREE.BoxGeometry(6.3, 0.18, 4.3), roofMat, X(23.5), 2.69, 5);
    ao(7, 5, X(23.5), 5, 0.28);
    beacon(X(21.7), 3.0, 3.6, i); beacon(X(25.3), 3.0, 3.6, i);
    flag(i, X(20.3), 4.2, 8.2, 1.25);
    // 막사 4동 (세모 지붕)
    for (let k = 0; k < 4; k++) {
      const bx = X(25), bz = 10.5 + k * 2.6;
      add(new THREE.BoxGeometry(5, 1.1, 1.8), white, bx, 0.55, bz);
      const rf = new THREE.CylinderGeometry(1.15, 1.15, 5.2, 3); rf.rotateZ(Math.PI / 2); rf.scale(1, 0.5, 1);
      add(rf, std('#5f6e5a', { roughness: 0.8 }), bx, 1.35, bz);
      ao(5.6, 2.4, bx, bz, 0.25);
    }
    // 관제탑 + 경보등
    add(cyl(0.55, 0.75, 5.4, 12, X(13.2), 2.7, -19), white);
    add(cyl(1.25, 1.0, 1.1, 12, X(13.2), 5.95, -19), glass);
    add(cyl(1.45, 1.45, 0.16, 12, X(13.2), 6.58, -19), roofMat);
    ao(2.6, 2.6, X(13.2), -19, 0.3);
    beacon(X(13.2), 6.85, -19, i);
    // 레이더 (도는 접시)
    { const g = new THREE.Group(); g.position.set(X(27.8), 0, -3);
      const ped = new THREE.Mesh(cyl(0.25, 0.4, 2.2, 10, 0, 1.1, 0), white); ped.castShadow = SHADOW; g.add(ped);
      const dish = new THREE.Mesh((() => { const d = new THREE.SphereGeometry(1.3, 20, 10, 0, Math.PI * 2, 0, 0.75); d.rotateX(Math.PI / 2); d.scale(1, 0.75, 1); return d; })(), std('#e9ecef', { side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 }));
      dish.position.set(0, 2.6, 0); dish.castShadow = SHADOW; const hold = new THREE.Group(); hold.add(dish); hold.position.y = 0; g.add(hold); scene.add(g); radars.push(hold); }
    // 연료 탱크
    for (let k = 0; k < 3; k++) { add(cyl(0.95, 0.95, 1.7, 18, X(28), 0.85, -14 + k * 2.2), white); ao(2.2, 2.2, X(28), -14 + k * 2.2, 0.25); }
    // 조명탑 (밤에 연병장을 비춤)
    for (const [lx, lz] of [[3.4, -15], [3.4, 13.8], [13.6, -15], [13.6, 13.8]]) {
      add(cyl(0.06, 0.08, 4.6, 6, X(lx), 2.3, lz), metal);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: '#d7dbe0', toneMapped: false })); head.position.set(X(lx), 4.65, lz); scene.add(head); poolsN.push(head);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: '#ffe2a8', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      pool.position.set(X(lx) + (lx < 8 ? s : -s) * 1.6, 0.13, lz + (lz > 0 ? -2.4 : 2.4)); scene.add(pool); pool.userData.pool = true; poolsN.push(pool);
    }
    // 경보 파문 (본부 앞 바닥)
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      m.position.set(X(8.2), 0.15, -0.6); scene.add(m); ripples.push({ m, i, ph: k * 0.5 });
    }
    // 금괴 더미 (받침 + 금괴 50개)
    const gx = X(8.2), gz = 16.6;
    add(new THREE.BoxGeometry(3.6, 0.16, 2.3), std('#8a6a43', { roughness: 0.9 }), gx, 0.08, gz);
    ao(4.2, 2.9, gx, gz, 0.3);
    const gm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.2, 0.3), std('#ffcf3f', { metalness: 0.8, roughness: 0.32, emissive: new THREE.Color('#6b4a00'), emissiveIntensity: 0.55 }), NGOLD);
    gm.castShadow = SHADOW; gm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(gm);
    const gpos = [];
    [[6, 4], [5, 3], [4, 2], [3, 1]].forEach(([nx, nz], L) => { for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) gpos.push([gx + (a - (nx - 1) / 2) * 0.55, 0.26 + L * 0.21, gz + (b - (nz - 1) / 2) * 0.48]); });
    golds.push({ gm, gpos });
    baseAnchors.push([X(phone ? 10.5 : 8), 1.6, -15.6]);
    // 감시탑 (국경 가까이)
    for (const tz of [-14, -30]) {
      const tx = X(2.1);
      for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) add(box(0.09, 3.2, 0.09, tx + dx, 1.6, tz + dz), dark);
      add(new THREE.BoxGeometry(1.3, 0.9, 1.3), std(i ? '#b08a62' : '#7b8fa8', { roughness: 0.8 }), tx, 3.6, tz);
      add(new THREE.ConeGeometry(1.15, 0.6, 4).rotateY(Math.PI / 4), roofMat, tx, 4.35, tz);
      ao(1.6, 1.6, tx, tz, 0.3);
    }
  });

  // 국경 철책 (가운데 협상 천막 자리만 비움)
  {
    const zs = []; for (let z = -31; z <= 27; z += 1.3) if (Math.abs(z) > 4.4) zs.push(z);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), dark, zs.length);
    zs.forEach((z, k) => { const o = new THREE.Object3D(); o.position.set(0, 0.7, z); o.updateMatrix(); posts.setMatrixAt(k, o.matrix); });
    posts.castShadow = SHADOW; scene.add(posts);
    const wire = std('#7c838b', { metalness: 0.6, roughness: 0.5 });
    for (const [z0, z1] of [[-31, -4.4], [4.4, 27]]) for (const y of [0.45, 0.85, 1.25]) add(new THREE.BoxGeometry(0.025, 0.025, z1 - z0), wire, 0, y, (z0 + z1) / 2, false, false);
  }

  // 나무 (기지 밖)
  {
    const N = phone ? 260 : 520, trunk = new THREE.InstancedMesh(cyl(0.08, 0.11, 0.8, 5, 0, 0.4, 0), std('#6b4f35'), N);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(0.7, 1.9, 7).translate(0, 1.6, 0), std('#ffffff', { roughness: 0.9 }), N);
    const o = new THREE.Object3D(), c = new THREE.Color(); let k = 0, tries = 0;
    while (k < N && tries < 20000) {
      tries++;
      const x = (Math.random() - 0.5) * 150, z = -60 + Math.random() * 95;
      if (Math.abs(x) < 31 && z > -33 && z < 27) continue;
      if (Math.hypot(x * 0.8, z) > 70) continue;
      if (fbm(x * 0.06 + 3, z * 0.06) < 0.42) continue;
      const sc = 0.75 + Math.random() * 0.7; o.position.set(x, 0, z); o.rotation.y = Math.random() * 6; o.scale.set(sc, sc * (0.85 + Math.random() * 0.4), sc); o.updateMatrix();
      trunk.setMatrixAt(k, o.matrix); crown.setMatrixAt(k, o.matrix);
      crown.setColorAt(k, c.setHSL(0.27 + Math.random() * 0.06, 0.38 + Math.random() * 0.15, 0.24 + Math.random() * 0.1)); k++;
    }
    trunk.count = crown.count = k; crown.castShadow = trunk.castShadow = SHADOW; scene.add(trunk, crown);
  }

  // ---------- 장비 (연병장, 1대 = 군비 1) ----------
  const geos = [tankGeo(), launcherGeo(), jetGeo()];
  const uMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.25 });
  const PER = [120, 40, 40];
  const umesh = geos.map((g, t) => { const m = new THREE.InstancedMesh(g, uMat, PER[t] * 2); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = SHADOW; m.frustumCulled = false; scene.add(m); return m; });
  const blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 400);
  blob.instanceMatrix.setUsage(THREE.DynamicDrawUsage); blob.frustumCulled = false; scene.add(blob);
  const BLOB = [[1.05, 0.62], [0.95, 0.6], [0.9, 0.95]];
  // 장비 k(0부터)의 종류·자리: k를 5개씩 묶어 차량 3, 발사대 1, 전투기 1
  const slot = [];
  for (let k = 0; k < VMAX; k++) {
    const g = Math.floor(k / 5), r5 = k % 5, t = r5 < 3 ? 0 : r5 === 3 ? 1 : 2, j = t === 0 ? g * 3 + r5 : g;
    const Z = ZONES[t], row = Math.floor(j / Z.cols), cc = j % Z.cols;
    slot.push({ t, j, ax: ROW0 - row * ROWD, z: Z.z(cc) + (t === 0 ? 0 : 0), jit: (hash(k, 3) - 0.5) * 0.06 });
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), tc = new THREE.Color();
  const QS = [new THREE.Quaternion().setFromAxisAngle(UP, 0), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI)];
  for (let i = 0; i < 2; i++) for (let t = 0; t < 3; t++) for (let j = 0; j < PER[t]; j++) umesh[t].setColorAt(i * PER[t] + j, tc.set(CAMO[i]).offsetHSL(0, 0, (hash(j, t + i * 5) - 0.5) * 0.05));
  umesh.forEach((m) => { m.instanceColor.needsUpdate = true; });
  function setUnits(i, val) {
    const s = SIDE[i], cnt = Math.max(0, Math.min(VMAX, val));
    for (let k = 0; k < VMAX; k++) {
      const sl = slot[k], idx = i * PER[sl.t] + sl.j, f = Math.max(0, Math.min(1, cnt - k)), bi = i * VMAX + k;
      if (f <= 0.001) { S3.set(0, 0, 0); P3.set(0, -50, 0); M4.compose(P3, Q, S3); umesh[sl.t].setMatrixAt(idx, M4); blob.setMatrixAt(bi, M4); continue; }
      const e = f * f * (3 - 2 * f), back = (1 - e) * 1.6;   // 나타날 때: 뒤쪽에서 미끄러져 들어오며 커진다
      P3.set(s * (sl.ax + back) + sl.jit, 0.1, sl.z); S3.set(e, e, e);
      M4.compose(P3, QS[i], S3); umesh[sl.t].setMatrixAt(idx, M4);
      const [bw, bd] = BLOB[sl.t]; P3.y = 0.115; S3.set(bw * e, 1, bd * e); M4.compose(P3, Q, S3); blob.setMatrixAt(bi, M4);
    }
  }
  function setGold(i, val) {
    const { gm, gpos } = golds[i], n = Math.max(0, Math.min(VMAX, val)) / GOLD;
    for (let k = 0; k < NGOLD; k++) {
      const f = Math.max(0, Math.min(1, n - k)), [x, y, z] = gpos[k];
      if (f <= 0.001) { S3.set(0, 0, 0); P3.set(0, -50, 0); } else { S3.set(1, f, 1); P3.set(x, y - (1 - f) * 0.1, z); }
      M4.compose(P3, Q, S3); gm.setMatrixAt(k, M4);
    }
    gm.instanceMatrix.needsUpdate = true;
  }

  // ---------- 협상 천막 (10년째 합의) ----------
  const tent = new THREE.Group(); tent.position.set(0, 0, 0); scene.add(tent);
  const tentFlags = [];
  {
    const tm = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = SHADOW; o.receiveShadow = SHADOW; tent.add(o); return o; };
    tm(new THREE.BoxGeometry(5.2, 0.16, 4.6), std('#e7e2d6'), 0, 0.08, 0);
    const carpet = tm(new THREE.PlaneGeometry(3.8, 1.6).rotateX(-Math.PI / 2), std('#2e7d4f', { roughness: 1 }), 0, 0.17, 0);
    carpet.castShadow = false;
    tm(new THREE.BoxGeometry(3.0, 0.08, 1.0), std('#f7f5ef', { roughness: 0.6 }), 0, 0.86, 0);   // 테이블 상판(흰 천)
    tm(new THREE.BoxGeometry(2.9, 0.68, 0.9), std('#2e7d4f', { roughness: 0.95 }), 0, 0.5, 0);
    for (const sx of [-1, 1]) for (const k of [-0.6, 0, 0.6]) { tm(new THREE.BoxGeometry(0.42, 0.5, 0.42), std(sx < 0 ? '#3b5d99' : '#a8582a'), sx * 1.85, 0.42, k); tm(new THREE.BoxGeometry(0.1, 0.6, 0.42), std(sx < 0 ? '#3b5d99' : '#a8582a'), sx * 2.07, 0.9, k); }
    for (const sx of [-1, 1]) { tm(new THREE.BoxGeometry(0.22, 0.14, 0.14), std(sx < 0 ? COL_A : COL_B), sx * 1.1, 0.97, 0); }   // 명패
    const posts = [[-2.4, -2.1], [2.4, -2.1], [-2.4, 2.1], [2.4, 2.1]];
    posts.forEach(([x, z]) => tm(cyl(0.06, 0.06, 2.6, 6, x, 1.3, z), white));
    const roof = new THREE.ConeGeometry(3.7, 1.5, 4, 1, true); roof.rotateY(Math.PI / 4); roof.scale(1.0, 1, 0.88);
    tm(roof, std('#fbfaf6', { side: THREE.DoubleSide, roughness: 0.9 }), 0, 3.35, 0);
    // 두 나라 깃발 (작게)
    SIDE.forEach((s, i) => {
      tm(cyl(0.035, 0.035, 2.4, 6, s * 2.9, 1.2, 1.9), metal);
      const g = new THREE.PlaneGeometry(0.85, 0.55, 8, 3); g.translate(s * 0.425, 0, 0);
      const fm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: flagTex[i], side: THREE.DoubleSide, roughness: 0.8 }));
      fm.position.set(s * 2.9, 2.1, 1.9); tent.add(fm); tentFlags.push(fm);
      flags.push({ m: fm, base: Float32Array.from(g.attributes.position.array), size: 0.65, ph: i * 2 });
    });
  }
  tent.scale.setScalar(0.0001); tent.visible = false;
  let tentAmt = 0;

  // ---------- 홀로그램 지도 (③ 위상 평면과 같은 그림) ----------
  const HC = document.createElement('canvas'); HC.width = HC.height = phone ? 384 : 512;
  const hctx = HC.getContext('2d'), htex = new THREE.CanvasTexture(HC); htex.colorSpace = THREE.SRGBColorSpace;
  const holo = new THREE.Group(); holo.position.set(0, 0, -23); scene.add(holo);
  {
    const base = new THREE.Mesh(cyl(1.5, 1.8, 0.5, 24, 0, 0.25, 0), dark); base.castShadow = SHADOW; holo.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5ee7ff', toneMapped: false })); ring.position.y = 0.52; holo.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 1.3, 3.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#5ee7ff', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    beam.position.y = 2.3; holo.add(beam);
  }
  const HS = 8.2;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(HS, HS), new THREE.MeshBasicMaterial({ map: htex, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  panel.position.y = 4.1 + HS / 2; holo.add(panel);
  let holoKey = '', holoAt = 0;
  function drawHolo(sim, n, px, py) {
    const W = HC.width, x = hctx, m = W * 0.13, pw = W - m * 1.6, ox = m, oy = W - m;
    const X = (a) => ox + Math.min(VMAX, Math.max(0, a)) / VMAX * pw, Y = (b) => oy - Math.min(VMAX, Math.max(0, b)) / VMAX * pw;
    x.clearRect(0, 0, W, W);
    x.fillStyle = 'rgba(6,30,48,0.78)'; x.strokeStyle = 'rgba(94,231,255,0.9)'; x.lineWidth = W * 0.006;
    x.beginPath(); x.roundRect ? x.roundRect(2, 2, W - 4, W - 4, W * 0.04) : x.rect(2, 2, W - 4, W - 4); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,70,70,0.22)'; x.fillRect(X(100), Y(VMAX), X(VMAX) - X(100), pw); x.fillRect(X(0), Y(VMAX), X(100) - X(0), Y(100) - Y(VMAX));
    x.strokeStyle = 'rgba(94,231,255,0.18)'; x.lineWidth = 1;
    for (let k = 0; k <= VMAX; k += 25) { x.beginPath(); x.moveTo(X(k), Y(0)); x.lineTo(X(k), Y(VMAX)); x.moveTo(X(0), Y(k)); x.lineTo(X(VMAX), Y(k)); x.stroke(); }
    x.strokeStyle = 'rgba(255,90,90,0.9)'; x.setLineDash([W * 0.012, W * 0.01]); x.lineWidth = W * 0.004;
    x.beginPath(); x.moveTo(X(100), Y(0)); x.lineTo(X(100), Y(VMAX)); x.moveTo(X(0), Y(100)); x.lineTo(X(VMAX), Y(100)); x.stroke(); x.setLineDash([]);
    // 균형선 (app.js의 nullclines: 지금 쓰는 반응 계수)
    const nc = st0.nullclines ? window.ArmsState.nullclines() : null;
    if (nc && nc.a > 0) {
      x.lineWidth = W * 0.007; x.save(); x.beginPath(); x.rect(X(0), Y(VMAX), pw, pw); x.clip();
      x.strokeStyle = '#7fb0ff'; x.beginPath(); x.moveTo(X(nc.g / nc.a), Y(0)); x.lineTo(X((nc.kA * VMAX + nc.g) / nc.a), Y(VMAX)); x.stroke();
      x.strokeStyle = '#ffab70'; x.beginPath(); x.moveTo(X(0), Y(nc.g / nc.a)); x.lineTo(X(VMAX), Y((nc.kB * VMAX + nc.g) / nc.a)); x.stroke();
      x.restore();
    }
    // 지나온 길 + 지금 자리
    x.strokeStyle = 'rgba(230,252,255,0.95)'; x.lineWidth = W * 0.008; x.lineJoin = 'round'; x.beginPath();
    for (let k = 0; k <= n; k++) { const a = X(sim.xs[k]), b = Y(sim.ys[k]); if (k) x.lineTo(a, b); else x.moveTo(a, b); }
    x.lineTo(X(px), Y(py)); x.stroke();
    const hotNow = Math.max(px, py) >= 100;
    x.fillStyle = hotNow ? '#ff4d4d' : '#ffffff'; x.shadowColor = hotNow ? '#ff4d4d' : '#5ee7ff'; x.shadowBlur = W * 0.04;
    x.beginPath(); x.arc(X(px), Y(py), W * 0.022, 0, 7); x.fill(); x.shadowBlur = 0;
    // 글자
    x.fillStyle = '#bff6ff'; x.font = `700 ${Math.round(W * 0.05)}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillText(tr('A의 군비') + ' →', ox + pw / 2, oy + W * 0.035);
    x.save(); x.translate(ox - W * 0.075, oy - pw / 2); x.rotate(-Math.PI / 2); x.fillText(tr('B의 군비') + ' →', 0, -W * 0.02); x.restore();
    x.font = `600 ${Math.round(W * 0.038)}px ${FONT}`; x.textAlign = 'left'; x.fillStyle = 'rgba(255,170,170,0.95)';
    x.fillText(tr('과열 구역 (100 이상)'), X(104), Y(VMAX) + W * 0.02);
    x.textAlign = 'right'; x.fillStyle = 'rgba(191,246,255,0.8)'; x.textBaseline = 'alphabetic';
    x.fillText('200', X(VMAX), oy + W * 0.09);
    htex.needsUpdate = true;
  }

  // ---------- 낮 / 밤 · 회전 ----------
  const tSel = $('ar3-time'); let night = false;
  function applyTime() {
    night = !!tSel && tSel.value === 'night';
    skyU.uNight.value = night ? 1 : 0;
    scene.fog.color.copy(night ? FOG_N : FOG_D);
    hemi.intensity = night ? 0.12 : 0.55; hemi.color.set(night ? '#7f95c8' : '#dfeeff');
    sun.intensity = night ? 0.28 : 2.3;
    stdList.forEach((m) => { m.envMapIntensity = night ? 0.12 : 1; }); uMat.envMapIntensity = night ? 0.12 : 1; sun.color.set(night ? '#9fb3e6' : '#fff1dc');
    bldSide.emissiveIntensity = night ? 1.2 : 0; glass.emissiveIntensity = night ? 1.4 : 0;
    poolsN.forEach((o) => { if (o.userData.pool) o.material.opacity = night ? 0.42 : 0; else o.material.color.set(night ? '#fff1c9' : '#d7dbe0'); });
    renderer.toneMappingExposure = night ? 1.25 : 1.05;
    wrap.classList.toggle('ar3-night', night);
    if (st0.thumb) v.render();
  }
  if (tSel) tSel.addEventListener('change', applyTime);
  const rot = $('ar3-rotate');
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = rot.value === 'on'; });

  // ---------- 이름표 (HTML) ----------
  const mkLabel = (cls, html) => { const d = document.createElement('div'); d.className = 'ar3-lab ' + cls; d.innerHTML = html; wrap.appendChild(d); return { d, text: '' }; };
  const LBASE = SIDE.map((s, i) => mkLabel('base', `<i style="background:${i ? COL_B : COL_A}"></i><b>${i ? 'B국' : 'A국'}</b><span></span>`));
  const LHOT = mkLabel('hot', '과열선 100');
  const LDEAL = mkLabel('deal', '<b>10년째 합의</b><span></span>');
  const yearBox = document.createElement('div'); yearBox.className = 'ar3-year'; wrap.appendChild(yearBox);
  const pv = new THREE.Vector3();
  function place(o, x, y, z, show) {
    if (!show) { if (o.d.style.display !== 'none') o.d.style.display = 'none'; return; }
    pv.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, sx = (pv.x + 1) / 2 * w, sy = (1 - pv.y) / 2 * h;
    const vis = pv.z < 1 && sx > 20 && sx < w - 20 && sy > 14 && sy < h + 10;
    o.d.style.display = vis ? '' : 'none';
    if (vis) o.d.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
  }
  const setSpan = (o, t) => { if (o.text !== t) { o.text = t; o.d.querySelector('span').textContent = t; } };
  const AGREE_NAME = { both: '둘 다 반응 절반', aonly: 'A만 반응 절반', acut: 'A만 군비 한 번 절반' };

  // ---------- 매 프레임 ----------
  let lastKey = '', clock = 0;
  function update(dt) {
    const st = window.ArmsState; if (!st || !st.sim) return;
    const sim = st.sim, still = st.isPaused() || st.thumb || sim.done;
    const n = sim.xs.length - 1, a = still || n === 0 ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const px = n > 0 ? sim.xs[n - 1] + (sim.xs[n] - sim.xs[n - 1]) * a : sim.xs[0];
    const py = n > 0 ? sim.ys[n - 1] + (sim.ys[n] - sim.ys[n - 1]) * a : sim.ys[0];
    const vals = [px, py];
    const key = px.toFixed(3) + ',' + py.toFixed(3);
    if (key !== lastKey) { lastKey = key; setUnits(0, px); setUnits(1, py); umesh.forEach((m) => { m.instanceMatrix.needsUpdate = true; }); blob.instanceMatrix.needsUpdate = true; setGold(0, px); setGold(1, py); }
    clock += st.thumb ? 0 : dt;
    const T = st.thumb ? 0.35 : clock;
    // 경보: 지금 군비가 과열선 100 이상인 나라
    const hot = vals.map((x) => x >= st.hot);
    beacons.forEach((b) => {
      const on = hot[b.i];
      b.core.material.color.set(on ? (Math.sin(T * 9) > -0.2 ? '#ff2a2a' : '#7a1010') : '#5a1d1d');
      b.beam.visible = on; b.bm.opacity = on ? (night ? 0.4 : 0.3) : 0; b.beam.rotation.y = T * 4.2 + b.i;
    });
    ripples.forEach((r) => {
      const on = hot[r.i], u = ((T * 0.6 + r.ph) % 1);
      r.m.visible = on; if (on) { const sc = 1 + u * 6.5; r.m.scale.set(sc, 1, sc); r.m.material.opacity = (1 - u) * 0.7; }
    });
    hotGlows.forEach((g, i) => { g.material.opacity = hot[i] ? 0.25 + 0.2 * Math.sin(T * 6) : 0; });
    // 합의 천막: 합의가 실제로 이뤄진 뒤에만 (재생이 10년째에 닿은 뒤)
    const deal = sim.agreed && sim.params.agree !== 'none';
    const goal = deal ? 1 : 0;
    tentAmt = st.thumb ? goal : tentAmt + Math.sign(goal - tentAmt) * Math.min(Math.abs(goal - tentAmt), dt / 0.8);
    tent.visible = tentAmt > 0.002;
    if (tent.visible) { const e = tentAmt * tentAmt * (3 - 2 * tentAmt) * 1.25; tent.scale.set(e, e, e); }
    tentFlags[1].visible = sim.params.agree === 'both';
    // 깃발 펄럭임 · 레이더
    flags.forEach((f) => {
      if (f.m.parent === tent && !tent.visible) return;
      const p = f.m.geometry.attributes.position, b = f.base;
      for (let k = 0; k < p.count; k++) { const x0 = b[k * 3], d = Math.abs(x0) / (1.3 * f.size); p.setZ(k, Math.sin(x0 * 4.2 / f.size - T * 5 + f.ph) * 0.12 * f.size * d); }
      p.needsUpdate = true; f.m.geometry.computeVertexNormals();
    });
    radars.forEach((r, i) => { r.rotation.y = T * (i ? -0.9 : 0.9); });
    // 홀로그램: 카메라 쪽으로 (세로축만), 내용은 걸음이 바뀌거나 점이 움직일 때
    const ang = Math.atan2(camera.position.x - holo.position.x, camera.position.z - holo.position.z);
    holo.rotation.y = ang;
    const now = performance.now(), hk = n + ':' + px.toFixed(1) + ':' + py.toFixed(1) + ':' + sim.kA + ':' + sim.kB + ':' + sim.params.g;
    if (hk !== holoKey && (now - holoAt > (phone ? 110 : 60) || still)) { holoKey = hk; holoAt = now; drawHolo(sim, n, px, py); }
    panel.material.opacity = 0.88 + 0.06 * Math.sin(T * 13);
    // 이름표
    const show = !st.thumb;
    LBASE.forEach((o, i) => {
      const [x, y, z] = baseAnchors[i];
      setSpan(o, tr(`군비 ${Math.round(vals[i])}`));
      o.d.classList.toggle('on', hot[i]);
      place(o, x, y, z, show);
    });
    place(LHOT, -XHOT, 0.2, 13.8, show && !phone);
    if (deal) setSpan(LDEAL, tr(AGREE_NAME[sim.params.agree] || ''));
    place(LDEAL, 0, 5.4, 0, show && tentAmt > 0.6);
    const yt = tr(`${sim.t}년째 / ${window.ArmsRace ? window.ArmsRace.C.YEARS : 60}년`);
    if (yearBox.textContent !== yt) yearBox.textContent = yt;
  }

  v.onFrame((dt) => update(dt));
  function home() {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 375, asp = w / h;
    if (st0.thumb) { camera.position.set(0, 17, 31); controls.target.set(0, 0, -3); }
    else if (asp < 1.3) { camera.position.set(0, 30, 46); controls.target.set(0, 0, -3); }
    else { camera.position.set(0, 17, 33); controls.target.set(0, 0, -3); }
    controls.update();
  }
  home();
  applyTime();
  update(0.016);
  if (st0.thumb) {
    controls.autoRotate = false;
    const shot = () => { update(0); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Arms3D = {
    v, update,
    stats: () => ({ units: umesh.map((m) => m.count), shadow: SHADOW, phone, night, tent: +tentAmt.toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  };
}

// 캔버스를 감싸 이름표를 겹쳐 올릴 자리를 만든다(create3D보다 먼저: 크기 감시가 부모를 본다)
let wrap = null;
if (canvas && st0) {
  const css = document.createElement('style');
  css.textContent = `
.ar3-wrap{position:relative;overflow:hidden;border-radius:14px}
.ar3-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 12px/1.25 ${FONT};color:#1f2937;background:rgba(255,255,255,.93);border:1px solid #d5dae1;border-radius:9px;padding:3px 8px;box-shadow:0 1px 4px rgba(15,23,42,.16);will-change:transform;display:flex;align-items:center;gap:5px}
.ar3-lab i{display:inline-block;width:9px;height:9px;border-radius:50%}
.ar3-lab span{font-variant-numeric:tabular-nums}
.ar3-lab.base.on{background:#dc2626;border-color:#b91c1c;color:#fff}
.ar3-lab.base.on i{box-shadow:0 0 0 2px #fff}
.ar3-lab.hot{color:#b91c1c;font-size:11px;padding:2px 7px}
.ar3-lab.deal{flex-direction:column;gap:0;padding:3px 9px;border-color:#86c59b}
.ar3-lab.deal b{font-size:11px;color:#2e7d4f}.ar3-lab.deal span{font-size:12px}
.ar3-year{position:absolute;left:10px;top:10px;pointer-events:none;font:700 12.5px/1 ${FONT};color:#1f2937;background:rgba(255,255,255,.9);border:1px solid #d5dae1;border-radius:9px;padding:5px 9px;font-variant-numeric:tabular-nums}
.ar3-night .ar3-lab:not(.on),.ar3-night .ar3-year{background:rgba(22,29,44,.9);border-color:#3a4458;color:#e5e7eb}
.ar3-night .ar3-lab.hot{color:#fca5a5}.ar3-night .ar3-lab.deal b{color:#86efac}
@media (max-width:640px){.ar3-lab{font-size:11px;padding:2px 6px}.ar3-year{font-size:11px;padding:4px 7px;left:6px;top:6px}}
`;
  document.head.appendChild(css);
  wrap = document.createElement('div'); wrap.className = 'ar3-wrap';
  canvas.parentNode.insertBefore(wrap, canvas); wrap.appendChild(canvas);
  canvas.setAttribute('aria-label', '3D view of two military bases facing each other across a border');
  const phone = (canvas.parentElement.clientWidth || 999) < 640;
  if (phone) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [-8, 25, 38], target: [0, 0, -2], background: '#e3eaf0', autoRotate: false, autoRotateSpeed: 0.3, minDistance: 14, maxDistance: 110, fov: 50, far: 1500 });
  if (v) init(v, phone);
}
