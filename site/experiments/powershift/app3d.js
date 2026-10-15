// ① 해협을 사이에 둔 두 도시 국가 (3D): app.js가 window.PowershiftState로 내보내는 같은 sim을 그대로 그린다(3D에서 새로 계산하지 않음).
// - 왼쪽 도시(파란 지붕) = 지키는 나라, 오른쪽 도시(주황 지붕) = 추격국. 맨 앞 세계(worlds[0])의 그 해 힘(D_[t], C_[t])만큼
//   빌딩 수(도시 넓이)와 높이가 정해진다. 힘은 0.4 ~ 수십 배로 벌어지므로 로그 눈금으로 줄여 그린다(보기용 축척).
// - 가운데 섬의 저울: 두 접시 = 두 나라 힘 몫(C/(C+D)). 무거운 쪽이 내려간다. 0.5면 수평(따라잡는 때)
// - 섬을 두른 물 위 고리 = 맨 앞 세계의 올해 충돌 위험(haz[t-1]). 6%를 가득으로, 제곱근 눈금(낮은 위험도 보이게)
// - 뒤쪽 바다의 산맥 = 100개 세계의 해마다 위험(가로 = 해, 깊이 = 세계, 높이·색 = 위험). 재생이 지난 해까지만 물 위로 솟는다.
//   빨간 불빛 = 충돌이 난 곳, 금색 선 = 맨 앞 세계(앞의 두 도시)
// - 맨 앞 세계에 충돌이 나면(war ≤ t) 해협 위 섬광·파문, 그 뒤로 배가 사라지고 해안 경고등이 깜박인다
// - 질서 개편이 그 세계에서 일어나면(ratio가 개편 문턱에 닿은 다음 해, 충돌 전) 두 도시를 잇는 다리와 협정 아치가 세워진다
// - 배·물결·깃발·나무는 풍경(장식)일 뿐 숫자를 나타내지 않는다. 낮/밤(ps-time): 밤에는 창 불빛·가로등·뱃불만
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.PowershiftState;
const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const C_D = '#2f6fed', C_C = '#e8590c', C_WAR = '#d6336c';

// ---------- 배치 (x = 동서, z = 남북, 카메라는 +z 쪽) ----------
const CX = 19, CZ = -1.5, CR = 11.8;      // 두 도시 중심(±CX, CZ)과 반지름
const ISL = [0, 2.5];                     // 해협 가운데 섬
const LAND_Y = 0.55;                      // 도시 땅 높이
const MZ = -41, MDZ = 16, MDX = 68, MHZ = 13, MCAP = 0.03;   // 위험 산맥: 가운데 z, 깊이, 너비, 최대 높이(해마다 3%에서 자름)
const BRZ = 8.2;                          // 개편 다리 z
const PAL = {
  day: { top: '#5f9fdc', hor: '#e6eff5', bot: '#d4e3ec', fog: '#dde9f1', hemiS: '#e2efff', hemiG: '#8d8a72', hemiI: 0.9, sunC: '#fff1dc', sunI: 2.6, water: '#2b7aa3', env: 0.55 },
  night: { top: '#050a18', hor: '#1d2c4c', bot: '#0b1426', fog: '#121c34', hemiS: '#4a5f94', hemiG: '#1a1f2a', hemiI: 0.4, sunC: '#a9bbff', sunI: 0.75, water: '#123049', env: 0.3 },
};

// ---------- 지형 ----------
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.55 + noise(x * 2.1 + 5.2, z * 2.1 + 3.1) * 0.3 + noise(x * 4.3 + 9.7, z * 4.3 + 1.3) * 0.15;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const coastAt = (z, side) => 7.4 + 1.0 * Math.sin(z * 0.31 + side * 1.7) + 0.45 * Math.sin(z * 0.83 + side);
const cityD = (x, z) => Math.hypot(Math.abs(x) - CX, (z - CZ) * 1.05);
function height(x, z) {
  const side = x < 0 ? -1 : 1, ax = Math.abs(x), co = coastAt(z, side);
  let land = sstep(co - 0.6, co + 1.6, ax) * sstep(-31, -23, z) * sstep(29, 22, z);
  let h = -1.5 + land * (1.5 + LAND_Y);
  const away = sstep(CR + 1.2, CR + 7, cityD(x, z)) * sstep(co + 2, co + 6, ax);
  h += land * away * (Math.pow(fbm(x * 0.085, z * 0.085), 1.7) * 10.5 + 0.15 * (fbm(x * 0.5, z * 0.5) - 0.5));
  const di = Math.hypot(x - ISL[0], z - ISL[1]);
  h = Math.max(h, -1.5 + sstep(3.0, 2.1, di) * (1.5 + 0.8));
  return h;
}

// ---------- 도구 ----------
function mergeColored(parts) { // parts: [geometry(비색인), '#색']
  parts = parts.map(([g, hex]) => [g.index ? g.toNonIndexed() : g, hex]);
  let n = 0; parts.forEach(([g]) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0; const c = new THREE.Color();
  parts.forEach(([g0, hex]) => {
    const g = g0; c.set(hex);
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < g.attributes.position.count; i++) col.set([c.r, c.g, c.b], (o + i) * 3);
    o += g.attributes.position.count;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const boxAt = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const STOPS = [[0, '#cfe8c9'], [0.25, '#ffe066'], [0.55, '#ff922b'], [1, '#c92a2a']].map(([a, h]) => [a, new THREE.Color(h)]);
function heat(q, out) { for (let k = 1; k < STOPS.length; k++) if (q <= STOPS[k][0]) return out.copy(STOPS[k - 1][1]).lerp(STOPS[k][1], (q - STOPS[k - 1][0]) / (STOPS[k][0] - STOPS[k - 1][0])); return out.copy(STOPS[STOPS.length - 1][1]); }
// 힘 → 도시 크기(0~1): 로그 눈금(힘 0.25 → 0, 16 → 1)
const level = (P) => Math.max(0.04, Math.min(1, Math.log(P / 0.25) / Math.log(64)));

// 빌딩 재질: 옆면에 층·칸 창 무늬(유리 반사), 밤에는 켜진 창만 빛난다
function towerMaterial(U) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.05 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vWP;\nvarying vec3 vON;\nvarying float vSeed;\nvarying float vTop;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vec4 wp4 = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  wp4 = instanceMatrix * wp4;\n  vSeed = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 7.7;\n  vTop = instanceMatrix[1].y + instanceMatrix[3].y;\n  #else\n  vSeed = 0.0; vTop = 1.0;\n  #endif\n  vWP = (modelMatrix * wp4).xyz;\n  vON = normal;');
    sh.fragmentShader = 'uniform vec3 uWin;\nuniform float uLit;\nuniform vec3 uGlass;\nvarying vec3 vWP;\nvarying vec3 vON;\nvarying float vSeed;\nvarying float vTop;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  float side = 1.0 - step(0.5, abs(vON.y));
  float cc = abs(vON.x) > 0.5 ? vWP.z : vWP.x;
  float fy = fract((vWP.y - 0.55) / 0.36), fc = fract(cc / 0.3);
  float inW = side * step(0.34, fy) * step(fy, 0.86) * step(0.09, fc) * step(fc, 0.91) * step(0.95, vWP.y) * step(vWP.y, vTop - 0.15);
  diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, inW * 0.55);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.14, inW);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.55, inW);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float hh = fract(sin(floor((vWP.y - 0.55) / 0.36) * 12.9898 + floor(cc / 0.3) * 78.233 + vSeed) * 43758.5453);\n  totalEmissiveRadiance += uWin * inW * step(hh, uLit);');
  };
  mat.customProgramCacheKey = () => 'ps-tower';
  return mat;
}
// 바다: 물결 노멀(햇빛 반짝임)
function waterMaterial(U) {
  const mat = new THREE.MeshStandardMaterial({ color: PAL.day.water, roughness: 0.16, metalness: 0.15, transparent: true, opacity: 0.86 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec2 wp = vWPos.xz; float tt = uTime;
  float nx = 0.05 * sin(wp.x * 1.3 + tt * 1.1) + 0.035 * sin(wp.x * 0.7 + wp.y * 1.9 - tt * 1.6) + 0.022 * sin((wp.x + wp.y) * 3.1 + tt * 2.3) + 0.012 * sin(wp.x * 6.3 - wp.y * 4.1 + tt * 3.1);
  float nz = 0.05 * cos(wp.y * 1.1 - tt * 0.9) + 0.035 * cos(wp.y * 2.3 - wp.x * 0.8 + tt * 1.3) + 0.022 * cos((wp.x - wp.y) * 3.7 - tt * 2.0) + 0.012 * cos(wp.y * 5.9 + wp.x * 3.3 - tt * 2.7);
  normal = normalize(normal + (viewMatrix * vec4(nx, 0.0, nz, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'ps-water';
  return mat;
}
function skyMaterial(p) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(p.top) }, hor: { value: new THREE.Color(p.hor) }, bot: { value: new THREE.Color(p.bot) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(hor, top, pow(min(1.0, h * 1.6), 0.7)) : mix(hor, bot, min(1.0, -h * 4.0)); gl_FragColor = vec4(c, 1.0); }',
  });
}
// 물 위 위험 고리: uFill(0~1)만큼 앞쪽에서 시계 방향으로 채운다
function gaugeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uFill: { value: 0 }, uCol: { value: new THREE.Color('#ffe066') }, uTrack: { value: new THREE.Color('#ffffff') }, uA: { value: 0.5 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uFill; uniform vec3 uCol; uniform vec3 uTrack; uniform float uA; varying vec2 vP;
      void main(){ float f = fract(atan(vP.x, vP.y) / 6.2831853 + 1.0); float on = step(f, uFill);
        float tick = step(0.94, fract(f * 20.0)) * (1.0 - on);
        vec3 c = mix(uTrack, uCol, on); c = mix(c, vec3(0.45, 0.5, 0.58), tick * 0.6);
        gl_FragColor = vec4(c, on > 0.5 ? 0.96 : uA); }`,
  });
}

function init(v, narrow) {
  const { scene, camera, controls, renderer } = v;
  const thumb = !!st0.thumb, PC = !narrow;
  const lights = scene.children.filter((o) => o.isLight);
  const hemi = lights.find((o) => o.isHemisphereLight), sun = lights.find((o) => o.isDirectionalLight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  sun.position.set(-34, 46, 30);
  if (PC) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 140; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  }
  const U = { uWin: { value: new THREE.Color(0, 0, 0) }, uLit: { value: 0.5 }, uGlass: { value: new THREE.Color('#86a6c4') }, uTime: { value: 0 } };
  const rnd = (() => { let s = 20261016; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  const dm = new THREE.Object3D(), tmpC = new THREE.Color();

  // ---------- 하늘·안개·환경 반사 ----------
  const skyGeo = new THREE.SphereGeometry(600, 32, 16);
  const sky = new THREE.Mesh(skyGeo, skyMaterial(PAL.day)); scene.add(sky);
  scene.background = null;
  scene.fog = new THREE.Fog(PAL.day.fog, 95, 300);
  const pm = new THREE.PMREMGenerator(renderer);
  const envOf = (p) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(skyGeo, skyMaterial(p))); return pm.fromScene(s, 0.02).texture; };
  const ENV = { day: envOf(PAL.day), night: envOf(PAL.night) };

  // ---------- 땅 (높이맵 + 색) ----------
  const GW = 200, GD = 150, gx = PC ? 200 : 130, gz = PC ? 150 : 100;
  const tg = new THREE.PlaneGeometry(GW, GD, gx, gz); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, -10);
  const tp = tg.attributes.position, tcol = new Float32Array(tp.count * 3);
  const CS = { deep: new THREE.Color('#2f6f8c'), shal: new THREE.Color('#8fc6bd'), sand: new THREE.Color('#e9dcb2'), grass: new THREE.Color('#9fc277'), grass2: new THREE.Color('#7fab5f'), hill: new THREE.Color('#6a9150'), rock: new THREE.Color('#a39b8a'), snow: new THREE.Color('#f4f4f2'), pave: new THREE.Color('#d9d5cc') };
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i), h = height(x, z); tp.setY(i, h);
    let c;
    if (h < -0.05) c = tmpC.copy(CS.shal).lerp(CS.deep, sstep(-0.05, -1.3, h));
    else if (h < 0.4) c = tmpC.copy(CS.sand);
    else {
      c = tmpC.copy(CS.grass).lerp(CS.grass2, fbm(x * 0.3, z * 0.3));
      if (h > 1.4) c.lerp(CS.hill, sstep(1.4, 3.5, h));
      if (h > 4.2) c.lerp(CS.rock, sstep(4.2, 6, h));
      if (h > 7.2) c.lerp(CS.snow, sstep(7.2, 8.2, h));
      const dc = cityD(x, z); if (dc < CR + 0.8) c.lerp(CS.pave, sstep(CR + 0.8, CR - 0.6, dc) * 0.85);
      const di = Math.hypot(x - ISL[0], z - ISL[1]); if (di < 2.4) c.copy(CS.pave);
    }
    tcol.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terrain.receiveShadow = true; scene.add(terrain);

  // ---------- 바다 ----------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(GW * 3, GD * 3), waterMaterial(U)); water.rotation.x = -Math.PI / 2; water.position.set(0, 0, -10);
  water.receiveShadow = PC; water.renderOrder = 1; scene.add(water);

  // ---------- 도시: 거리 + 빌딩 칸 ----------
  const B = 2.7, ST = 0.5, LOT = (B - ST) / 2;
  const NMAX = PC ? 260 : 170;
  function harborZone(x, z, side) { return Math.abs(z - (CZ + 1)) < 5.2 && side * x < coastAt(z, side) + 4.6; }
  function makeLots(side) {
    const cx = side * CX, lots = [], streets = [], lamps = [];
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
      const bx = cx + i * B, bz = CZ + j * B;
      const inC = (x, z) => Math.hypot(x - cx, (z - CZ) * 1.05) < CR && side * x > coastAt(z, side) + 1.3;
      if (inC(bx + B / 2, bz) && inC(bx + B / 2, bz + B)) streets.push([bx + B / 2, bz + B / 2, ST, B]);
      if (inC(bx, bz + B / 2) && inC(bx + B, bz + B / 2)) streets.push([bx + B / 2, bz + B / 2, B, ST]);
      if (inC(bx + B / 2, bz + B / 2)) lamps.push([bx + B / 2 + 0.3, bz + B / 2 + 0.3]);
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const x = bx + (a - 0.5) * (LOT + 0.05), z = bz + (b - 0.5) * (LOT + 0.05);
        const d = Math.hypot(x - cx, (z - CZ) * 1.05) / CR;
        if (d > 0.97 || side * x < coastAt(z, side) + 1.9 || harborZone(x, z, side)) continue;
        const k = rnd() < 0.18 ? 2 : 1;   // 가끔 한 칸에 두 채
        for (let q = 0; q < k; q++) {
          const w = (k === 2 ? 0.46 : 0.7 + rnd() * 0.3) * LOT, dd = (0.68 + rnd() * 0.3) * LOT;
          const ox = k === 2 ? (q ? 0.27 : -0.27) * LOT : (rnd() - 0.5) * (LOT - w) * 0.8;
          let hb = Math.pow(1 - d, 1.45) * (0.55 + 0.95 * rnd()) + 0.06 + rnd() * 0.08;
          if (d < 0.45 && rnd() < 0.08) hb *= 1.35;   // 랜드마크 타워
          lots.push({ x: x + ox, z: z + (rnd() - 0.5) * (LOT - dd) * 0.7, w, d: dd, pr: d + rnd() * 0.2, hb, tint: rnd(), crown: rnd() });
        }
      }
    }
    lots.sort((p, q) => p.pr - q.pr); lots.length = Math.min(lots.length, NMAX);
    return { side, lots, streets, lamps, cur: new Float32Array(lots.length), L: 0 };
  }
  const cities = [makeLots(-1), makeLots(1)];   // 0 = 지키는 나라(왼쪽), 1 = 추격국(오른쪽)
  const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.translate(0, 0.5, 0);
  const towerMat = towerMaterial(U);
  const crownGeo = new THREE.BoxGeometry(1, 1, 1); crownGeo.translate(0, 0.5, 0);
  const TINTS = [['#eef2f7', '#dfe7f0', '#cad7e6', '#f6f7f9', '#b8c8db'], ['#f6ede1', '#eedcc5', '#f4e4cf', '#e3c6a3', '#fbf5ec']];
  const CROWN = [['#4f86ee', '#3f6fd0', '#7aa3f3'], ['#f0843f', '#d9692b', '#f5a26c']];
  const streetMat = new THREE.MeshStandardMaterial({ color: '#7b8088', roughness: 0.9 });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffd28a' });
  const streetGeo = new THREE.PlaneGeometry(1, 1); streetGeo.rotateX(-Math.PI / 2);
  const lampGeo = new THREE.SphereGeometry(0.09, 6, 4);
  const lampMeshes = [];
  cities.forEach((cy, ci) => {
    const n = cy.lots.length;
    cy.mesh = new THREE.InstancedMesh(unitBox, towerMat, n);
    cy.crown = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1 }), n);
    [cy.mesh, cy.crown].forEach((m) => { m.castShadow = PC; m.receiveShadow = PC; m.count = 0; m.frustumCulled = false; scene.add(m); });
    cy.lots.forEach((l, k) => {
      cy.mesh.setColorAt(k, tmpC.set(TINTS[ci][Math.floor(l.tint * 5)]));
      cy.crown.setColorAt(k, tmpC.set(CROWN[ci][Math.floor(l.crown * 3)]));
    });
    const sm = new THREE.InstancedMesh(streetGeo, streetMat, cy.streets.length);
    cy.streets.forEach(([x, z, w, d], k) => { dm.position.set(x, LAND_Y + 0.015, z); dm.scale.set(w, 1, d); dm.updateMatrix(); sm.setMatrixAt(k, dm.matrix); });
    sm.receiveShadow = PC; scene.add(sm);
    const lm = new THREE.InstancedMesh(lampGeo, lampMat, cy.lamps.length);
    cy.lamps.forEach(([x, z], k) => { dm.position.set(x, LAND_Y + 0.35, z); dm.scale.set(1, 1, 1); dm.updateMatrix(); lm.setMatrixAt(k, dm.matrix); });
    lm.visible = false; scene.add(lm); lampMeshes.push(lm);
  });
  function layoutCity(cy, L, snap, dt) {
    const n = cy.lots.length, active = Math.round(n * (0.14 + 0.86 * L)), mult = 1 + 6.5 * L;
    let changed = false, shown = 0, nc = 0;
    const k = snap ? 1 : Math.min(1, dt * 2.2);
    for (let i = 0; i < n; i++) {
      const l = cy.lots[i], goal = i < active ? 0.32 + l.hb * mult : 0;
      const prev = cy.cur[i], h = prev + (goal - prev) * k;
      if (Math.abs(h - prev) > 1e-4 || snap) { cy.cur[i] = h; changed = true; }
    }
    if (!changed && !snap) return;
    for (let i = 0; i < n; i++) {
      const l = cy.lots[i], h = cy.cur[i];
      if (h < 0.03) continue;
      dm.position.set(l.x, LAND_Y, l.z); dm.scale.set(l.w, h, l.d); dm.updateMatrix(); cy.mesh.setMatrixAt(shown++, dm.matrix);
      cy.mesh.setColorAt(shown - 1, tmpC.set(TINTS[cy.side < 0 ? 0 : 1][Math.floor(l.tint * 5)]));
      const ch = 0.18 + h * 0.05;
      dm.position.set(l.x, LAND_Y + h, l.z); dm.scale.set(l.w * (h > 2.5 ? 0.62 : 1.02), h > 2.5 ? ch : 0.07, l.d * (h > 2.5 ? 0.62 : 1.02)); dm.updateMatrix();
      cy.crown.setMatrixAt(nc, dm.matrix); cy.crown.setColorAt(nc++, tmpC.set(CROWN[cy.side < 0 ? 0 : 1][Math.floor(l.crown * 3)]));
    }
    cy.mesh.count = shown; cy.crown.count = nc;
    cy.mesh.instanceMatrix.needsUpdate = cy.crown.instanceMatrix.needsUpdate = true;
    if (cy.mesh.instanceColor) cy.mesh.instanceColor.needsUpdate = true;
    if (cy.crown.instanceColor) cy.crown.instanceColor.needsUpdate = true;
    let top = 0; for (let i = 0; i < Math.min(n, 30); i++) top = Math.max(top, cy.cur[i]); cy.top = top;
  }

  // ---------- 항구: 부두 · 크레인 · 컨테이너 · 깃발 ----------
  const harborParts = [], cranes = [], containers = [];
  const flags = [];
  [-1, 1].forEach((side, ci) => {
    const hz = CZ + 1;
    for (let p = 0; p < 3; p++) {
      const z = hz - 3.2 + p * 3.2, co = coastAt(z, side);
      harborParts.push([boxAt(3.2, 0.35, 0.75, side * (co - 0.6), 0.32, z), '#c9c3b8']);
      cranes.push([side * (co + 0.9), z + 0.9, side, ci]);
    }
    const co = coastAt(hz, side);
    harborParts.push([boxAt(2.6, 0.62, 10.5, side * (co + 1.6), 0.3, hz), '#cfc9bf']);
    for (let k = 0; k < (PC ? 54 : 30); k++) {
      const x = side * (co + 2.2 + (k % 3) * 0.55), z = hz - 4.6 + Math.floor(k / 6) * 1.05 + ((k / 3 | 0) % 2) * 0.0, y = 0.6 + ((k / 3 | 0) % 2) * 0.32;
      containers.push([x, y, z]);
    }
    flags.push({ side, x: side * (coastAt(hz + 5.5, side) + 1.0), z: hz + 5.5, ci });
  });
  const harbor = new THREE.Mesh(mergeColored(harborParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  harbor.castShadow = harbor.receiveShadow = PC; scene.add(harbor);
  // 크레인(나라 색): 다리 4개 + 가로대 + 팔
  const craneGeo = (col) => mergeColored([
    [boxAt(0.12, 2.4, 0.12, -0.35, 1.2, -0.35), col], [boxAt(0.12, 2.4, 0.12, 0.35, 1.2, -0.35), col], [boxAt(0.12, 2.4, 0.12, -0.35, 1.2, 0.35), col], [boxAt(0.12, 2.4, 0.12, 0.35, 1.2, 0.35), col],
    [boxAt(0.9, 0.3, 0.9, 0, 2.5, 0), col], [boxAt(3.6, 0.16, 0.22, -1.4, 2.75, 0), col], [boxAt(0.5, 0.4, 0.5, 0.3, 2.85, 0), '#eceff3'], [boxAt(0.04, 1.1, 0.04, -2.6, 2.1, 0), '#333a44'],
  ]);
  [0, 1].forEach((ci) => {
    const list = cranes.filter((c) => c[3] === ci), m = new THREE.InstancedMesh(craneGeo(ci ? '#e8590c' : '#2f6fed'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }), list.length);
    list.forEach(([x, z, side], k) => { dm.position.set(x, LAND_Y - 0.05, z); dm.rotation.set(0, side < 0 ? Math.PI : 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); m.setMatrixAt(k, dm.matrix); });
    m.castShadow = PC; scene.add(m);
  });
  dm.rotation.set(0, 0, 0);
  const CONT = ['#c2410c', '#1d4ed8', '#15803d', '#a16207', '#7c3aed', '#be123c', '#0e7490', '#e5e7eb'];
  const cont = new THREE.InstancedMesh(boxAt(0.48, 0.3, 0.95, 0, 0.15, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), containers.length);
  containers.forEach(([x, y, z], k) => { dm.position.set(x, y, z); dm.updateMatrix(); cont.setMatrixAt(k, dm.matrix); cont.setColorAt(k, tmpC.set(CONT[Math.floor(rnd() * CONT.length)])); });
  cont.castShadow = PC; scene.add(cont);
  // 깃발: 무늬 없는 나라 색 천(실제 국기 아님)
  const poleMat = new THREE.MeshStandardMaterial({ color: '#d7dbe0', metalness: 0.6, roughness: 0.3 });
  flags.forEach((f) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), poleMat); pole.position.set(f.x, LAND_Y + 2.5, f.z); pole.castShadow = PC; scene.add(pole);
    const g = new THREE.PlaneGeometry(2.2, 1.3, 14, 6); g.translate(1.1, 0, 0);
    const cl = document.createElement('canvas'); cl.width = 128; cl.height = 76; const x = cl.getContext('2d');
    x.fillStyle = f.ci ? C_C : C_D; x.fillRect(0, 0, 128, 76); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, 30, 128, 16);
    const tex = new THREE.CanvasTexture(cl); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
    m.position.set(f.x, LAND_Y + 4.25, f.z); m.rotation.y = f.side < 0 ? Math.PI : 0; m.castShadow = PC; scene.add(m);
    f.mesh = m; f.base = Float32Array.from(g.attributes.position.array);
  });

  // ---------- 나무 ----------
  const TREES = [];
  for (let k = 0; k < 9000 && TREES.length < (PC ? 1100 : 420); k++) {
    const x = (rnd() - 0.5) * 120, z = -28 + rnd() * 52, h = height(x, z);
    if (h < 0.6 || h > 5.2 || cityD(x, z) < CR + 0.6 || Math.abs(x) < 9 || harborZone(x, z, x < 0 ? -1 : 1)) continue;
    if (fbm(x * 0.12 + 40, z * 0.12) < 0.42) continue;   // 숲 조각
    TREES.push([x, h, z, 0.7 + rnd() * 0.6, rnd()]);
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: '#6b4f3a', roughness: 0.9 }), TREES.length);
  const crownT = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), TREES.length);
  const TC = ['#5f8f45', '#4f7f3c', '#6f9d4d', '#3f6f36', '#7aa356'];
  TREES.forEach(([x, h, z, s, r], k) => {
    dm.position.set(x, h - 0.05, z); dm.rotation.set(0, r * 6, 0); dm.scale.set(s, s * (0.9 + r * 0.5), s); dm.updateMatrix();
    trunk.setMatrixAt(k, dm.matrix); crownT.setMatrixAt(k, dm.matrix); crownT.setColorAt(k, tmpC.set(TC[Math.floor(r * TC.length)]));
  });
  dm.rotation.set(0, 0, 0);
  [trunk, crownT].forEach((m) => { m.castShadow = PC; scene.add(m); });

  // ---------- 섬: 받침 + 저울 ----------
  const stone = new THREE.MeshStandardMaterial({ color: '#ebe6dc', roughness: 0.7 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e8c25a', metalness: 0.7, roughness: 0.32, envMapIntensity: 1.6 });
  const islY = height(ISL[0], ISL[1]);
  const scaleG = new THREE.Group(); scaleG.position.set(ISL[0], islY, ISL[1]); scene.add(scaleG);
  [[1.9, 2.05, 0.35], [1.45, 1.6, 0.35], [1.05, 1.15, 0.3]].reduce((y, [rt, rb, h]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 40), stone); m.position.y = y + h / 2; m.castShadow = m.receiveShadow = PC; scaleG.add(m); return y + h;
  }, 0);
  const PIV = 7.2, ARM = 3.9, CHAIN = 2.7;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, PIV - 1, 20), gold); col.position.y = 1 + (PIV - 1) / 2; col.castShadow = PC; scaleG.add(col);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), gold); fin.position.y = PIV + 0.45; scaleG.add(fin);
  const beam = new THREE.Group(); beam.position.y = PIV; scaleG.add(beam);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(ARM * 2 + 0.3, 0.2, 0.24), gold); bar.castShadow = PC; beam.add(bar);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.34, 20).rotateX(Math.PI / 2), gold); beam.add(hub);
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 10), gold); pointer.position.y = 0.75; beam.add(pointer);
  const pans = [-1, 1].map((sd, ci) => {
    const g = new THREE.Group(); scaleG.add(g);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.0, 0.24, 36), gold); pan.castShadow = PC; g.add(pan);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.05, 36), new THREE.MeshStandardMaterial({ color: ci ? C_C : C_D, roughness: 0.4, emissive: ci ? C_C : C_D, emissiveIntensity: 0.12 })); disc.position.y = 0.12; g.add(disc);
    // 접시 위 작은 빌딩 모형(나라 표시)
    [[0, 0.5, 0], [0.42, 0.32, 0.18], [-0.38, 0.38, -0.2], [0.05, 0.26, 0.48]].forEach(([x, h, z]) => { const b = new THREE.Mesh(boxAt(0.3, h * 1.6, 0.3, x, 0.15 + h * 0.8, z), new THREE.MeshStandardMaterial({ color: ci ? '#f6e7d4' : '#e6edf6', roughness: 0.6 })); b.castShadow = PC; g.add(b); });
    const chains = [];
    for (let a = 0; a < 3; a++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), gold); g.add(c); chains.push(c); }
    return { g, sd, chains };
  });
  let tilt = 0;
  function poseScale(rot) {
    beam.rotation.z = rot;
    pans.forEach((p) => {
      const ex = p.sd * ARM * Math.cos(rot), ey = PIV + p.sd * ARM * Math.sin(rot);
      p.g.position.set(ex, ey - CHAIN, 0);
      p.chains.forEach((c, a) => {
        const ang = a * 2.094, bx = Math.cos(ang) * 1.15, bz = Math.sin(ang) * 1.15;
        // 위 끝 (0, CHAIN) → 아래 끝 (bx, 0.1, bz)
        const dx = bx, dy = 0.1 - CHAIN, dz = bz, len = Math.hypot(dx, dy, dz);
        c.position.set(bx / 2, (CHAIN + 0.1) / 2, bz / 2); c.scale.set(1, len, 1);
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-dx, -dy, -dz).normalize());
      });
    });
  }
  poseScale(0);

  // ---------- 위험 고리 ----------
  const gaugeMat = gaugeMaterial();
  const ringG = new THREE.RingGeometry(3.25, 3.95, 96, 1); ringG.rotateX(-Math.PI / 2);
  const gauge = new THREE.Mesh(ringG, gaugeMat); gauge.position.set(ISL[0], 0.08, ISL[1]); gauge.renderOrder = 3; scene.add(gauge);
  const rimG = new THREE.RingGeometry(3.95, 4.05, 96, 1); rimG.rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(rimG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false })); rim.position.copy(gauge.position); rim.renderOrder = 3; scene.add(rim);

  // ---------- 위험 산맥 (100개 세계) ----------
  const sim0 = st0.sim, YEARS = sim0.T, NW = sim0.worlds.length, HM = st0.hmax || 0.06, HMM = MCAP;
  const mg = new THREE.PlaneGeometry(MDX, MDZ, YEARS, NW - 1); mg.rotateX(-Math.PI / 2); mg.translate(0, 0, MZ);
  const mp = mg.attributes.position, mcol = new Float32Array(mp.count * 3);
  mg.setAttribute('color', new THREE.BufferAttribute(mcol, 3));
  const mountMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
  const mountNight = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false });
  const mount = new THREE.Mesh(mg, mountMat); mount.castShadow = PC; mount.receiveShadow = PC; scene.add(mount);
  const MX = (t) => (t / YEARS - 0.5) * MDX, MZr = (j) => MZ + (j / (NW - 1) - 0.5) * MDZ;   // j = 행(뒤 → 앞)
  const C_POST = new THREE.Color('#b9bec7');
  const pinHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshStandardMaterial({ color: C_WAR, emissive: C_WAR, emissiveIntensity: 0.9 }), NW);
  const pinStem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), new THREE.MeshStandardMaterial({ color: '#9c1c4a' }), NW);
  [pinHead, pinStem].forEach((m) => { m.count = 0; m.frustumCulled = false; scene.add(m); });
  const frontPos = new Float32Array((YEARS + 1) * 3), frontGeo = new THREE.BufferGeometry();
  frontGeo.setAttribute('position', new THREE.BufferAttribute(frontPos, 3));
  const frontLine = new THREE.Line(frontGeo, new THREE.LineBasicMaterial({ color: '#c9a227' })); frontLine.frustumCulled = false; scene.add(frontLine);
  const idx = (i, j) => j * (YEARS + 1) + i;
  const q4 = new THREE.Quaternion(), m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  let mKey = '';
  function updateMount(sim) {
    const t = sim.t, key = sim.params.seed + '|' + JSON.stringify([sim.params.g, sim.params.d, sim.params.u, sim.params.reform]) + '|' + t;
    if (key === mKey) return; mKey = key;
    for (let j = 0; j < NW; j++) {
      const w = sim.worlds[NW - 1 - j];
      for (let i = 0; i <= YEARS; i++) {
        const k = idx(i, j); let y = -0.9, c = C_POST;
        if (i === t + 1 && t > 0) { const hz = w.haz[t - 1]; if (hz != null && !(w.war >= 0 && t > w.war)) { const q = Math.min(1, hz / HMM); y = 0.14 + q * MHZ * 0.3 - 0.5; c = heat(Math.sqrt(q), tmpC); } }   // 경계를 비스듬히(보기용, 지난 해 값만 씀)
        else if (i <= t && t > 0) {
          const hz = w.haz[Math.min(i, t - 1)];
          if (hz == null || (w.war >= 0 && i > w.war)) { y = 0.14; c = C_POST; }
          else { const q = Math.min(1, hz / HMM); y = 0.14 + q * MHZ; c = heat(Math.sqrt(q), tmpC); }
        }
        mp.setY(k, y); mcol[k * 3] = c.r; mcol[k * 3 + 1] = c.g; mcol[k * 3 + 2] = c.b;
        if (j === NW - 1) { frontPos[i * 3] = MX(i); frontPos[i * 3 + 1] = y + 0.05; frontPos[i * 3 + 2] = MZr(j) + 0.02; }
      }
    }
    mp.needsUpdate = true; mg.attributes.color.needsUpdate = true; mg.computeVertexNormals();
    frontGeo.attributes.position.needsUpdate = true; frontGeo.setDrawRange(0, t > 0 ? t + 1 : 0);
    let np = 0;
    for (let j = 0; j < NW; j++) {
      const w = sim.worlds[NW - 1 - j];
      if (w.war >= 0 && w.war <= t) {
        const hz = w.haz[w.war - 1] || 0, y = 0.14 + Math.min(1, hz / HMM) * MHZ, top = y + 1.3, zz = MZr(j);
        p3.set(MX(w.war), top, zz); s3.set(1, 1, 1); m4.compose(p3, q4, s3); pinHead.setMatrixAt(np, m4);
        p3.set(MX(w.war), (y + top) / 2, zz); s3.set(1, top - y, 1); m4.compose(p3, q4, s3); pinStem.setMatrixAt(np, m4); np++;
      }
    }
    pinHead.count = pinStem.count = np; pinHead.instanceMatrix.needsUpdate = pinStem.instanceMatrix.needsUpdate = true;
  }

  // ---------- 배 (풍경) ----------
  const shipGeo = (() => {
    const s = new THREE.Shape(); s.moveTo(-1.3, -0.34); s.lineTo(0.9, -0.34); s.quadraticCurveTo(1.45, -0.2, 1.6, 0); s.quadraticCurveTo(1.45, 0.2, 0.9, 0.34); s.lineTo(-1.3, 0.34); s.lineTo(-1.3, -0.34);
    const hull = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: false }); hull.rotateX(-Math.PI / 2); hull.translate(0, -0.12, 0); hull.computeVertexNormals();
    const parts = [[hull, '#8f2d2d'], [boxAt(2.6, 0.06, 0.62, 0.05, 0.25, 0), '#e5e7eb'], [boxAt(0.42, 0.5, 0.56, -1.0, 0.5, 0), '#f3f4f6'], [boxAt(0.46, 0.08, 0.6, -1.0, 0.78, 0), '#374151'], [boxAt(0.1, 0.36, 0.1, -1.12, 0.98, 0), '#1f2937']];
    const CC = ['#c2410c', '#1d4ed8', '#15803d', '#a16207', '#0e7490', '#be123c'];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) parts.push([boxAt(0.36, 0.22, 0.26, -0.45 + a * 0.4, 0.4, (b - 0.5) * 0.28), CC[(a * 2 + b) % CC.length]]);
    return mergeColored(parts);
  })();
  const NS = PC ? 9 : 5;
  const ships = new THREE.InstancedMesh(shipGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), NS);
  ships.castShadow = PC; ships.frustumCulled = false; scene.add(ships);
  const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.75)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(128, 11); x.lineTo(128, 21); x.lineTo(0, 32); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const wakeG = new THREE.PlaneGeometry(4.2, 1.5); wakeG.rotateX(-Math.PI / 2); wakeG.translate(-3.2, 0.04, 0);
  const wakes = new THREE.InstancedMesh(wakeG, new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false }), NS); wakes.renderOrder = 2; wakes.frustumCulled = false; scene.add(wakes);
  const shipLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4).translate(-1.12, 1.2, 0), new THREE.MeshBasicMaterial({ color: '#fff3c4' }), NS); shipLights.visible = false; shipLights.frustumCulled = false; scene.add(shipLights);
  const SHIP = []; for (let i = 0; i < NS; i++) { const dir = i % 2 ? 1 : -1; SHIP.push({ dir, x: dir * (4.9 + (i % 3) * 0.35) * -1, u: i / NS, sp: 0.016 + rnd() * 0.006 }); }
  let shipVis = 1;
  function updateShips(dt, moving, tsec) {
    const Z0 = -34, Z1 = 40;
    for (let i = 0; i < NS; i++) {
      const s = SHIP[i]; if (moving) s.u = (s.u + dt * s.sp) % 1;
      const z = s.dir > 0 ? Z0 + s.u * (Z1 - Z0) : Z1 - s.u * (Z1 - Z0);
      const fade = Math.min(1, s.u * 8, (1 - s.u) * 8) * shipVis, sc = Math.max(0.001, fade);
      dm.position.set(s.x, 0.05 + Math.sin(tsec * 1.3 + i) * 0.03, z); dm.rotation.set(Math.sin(tsec * 1.1 + i * 2) * 0.02, s.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0); dm.scale.set(sc, sc, sc); dm.updateMatrix();
      ships.setMatrixAt(i, dm.matrix); wakes.setMatrixAt(i, dm.matrix); shipLights.setMatrixAt(i, dm.matrix);
    }
    ships.instanceMatrix.needsUpdate = wakes.instanceMatrix.needsUpdate = shipLights.instanceMatrix.needsUpdate = true;
    dm.rotation.set(0, 0, 0);
  }

  // ---------- 충돌 연출: 섬광 · 파문 · 경고등 ----------
  const boom = new THREE.PointLight('#ff6b3d', 0, 70, 1.6); boom.position.set(0, 4, ISL[1]); scene.add(boom);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffd2a8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flash.position.set(0, 3, ISL[1]); flash.visible = false; scene.add(flash);
  const ripG = new THREE.RingGeometry(0.92, 1, 72); ripG.rotateX(-Math.PI / 2);
  const ripples = [0, 1, 2].map(() => { const m = new THREE.Mesh(ripG, new THREE.MeshBasicMaterial({ color: '#ff5a3c', transparent: true, opacity: 0, depthWrite: false })); m.position.set(0, 0.1, ISL[1]); m.renderOrder = 4; m.visible = false; scene.add(m); return m; });
  const BEAC = [];
  [-1, 1].forEach((side) => { for (let k = 0; k < 4; k++) { const z = -14 + k * 9.5; BEAC.push([side * (coastAt(z, side) - 0.2), z]); } });
  const beaconPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ color: '#4b5563' }), BEAC.length);
  const beaconLamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 12, 8).translate(0, 1.7, 0), new THREE.MeshBasicMaterial({ color: '#ff3b30' }), BEAC.length);
  BEAC.forEach(([x, z], k) => { dm.position.set(x, 0.1, z); dm.updateMatrix(); beaconPole.setMatrixAt(k, dm.matrix); beaconLamp.setMatrixAt(k, dm.matrix); });
  beaconPole.visible = beaconLamp.visible = false; scene.add(beaconPole); scene.add(beaconLamp);
  let flashT = -1;

  // ---------- 질서 개편: 다리 + 협정 아치 ----------
  const marble = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.45 });
  const bridge = new THREE.Group(); scene.add(bridge);
  const BL = coastAt(BRZ, 1) + 1.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BL * 2, 0.24, 1.3), marble); deck.position.y = 1.75; deck.castShadow = PC; bridge.add(deck);
  const rails = [-0.6, 0.6].map((z) => { const r = new THREE.Mesh(new THREE.BoxGeometry(BL * 2, 0.22, 0.07), marble); r.position.set(0, 1.98, z); bridge.add(r); return r; });
  for (let x = -BL + 1.2; x <= BL - 1.2; x += 2.4) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 2.6, 10), marble); p.position.set(x, 0.45, 0); p.castShadow = PC; bridge.add(p); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.2, 12, 40, Math.PI), marble); arch.position.set(0, 1.85, 0); arch.castShadow = PC; bridge.add(arch);
  const laurel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.11, 8, 28), new THREE.MeshStandardMaterial({ color: '#6c9a3c', roughness: 0.6 })); laurel.position.set(0, 4.35, 0); bridge.add(laurel);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), gold); knot.position.set(0, 3.8, 0); bridge.add(knot);
  bridge.position.set(0, 0, BRZ); bridge.visible = false;
  let bridgeAmt = 0;

  // ---------- HTML 이름표·해 표시 ----------
  const mk = (cls, html) => { const d = document.createElement('div'); d.className = 'ps3-lab ' + cls; d.innerHTML = html; wrap.appendChild(d); return { d }; };
  const LD = mk('node', `<b><i style="background:${C_D}"></i>지키는 나라</b><span></span>`);
  const LC = mk('node', `<b><i style="background:${C_C}"></i>추격하는 나라</b><span></span>`);
  const LS = mk('node', '<b></b><span></span>');
  const LG = mk('chip', '<i></i><span></span>');
  const LR = mk('chip', `<i style="background:#6c9a3c"></i><span></span>`);
  const yearBox = document.createElement('div'); yearBox.className = 'ps3-year'; yearBox.innerHTML = '<span></span><em><u></u></em><small></small>'; wrap.appendChild(yearBox);
  const pv = new THREE.Vector3();
  function place(o, x, y, z, show) {
    if (!show) { if (o.d.style.display !== 'none') o.d.style.display = 'none'; return; }
    pv.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, sx = (pv.x + 1) / 2 * w, sy = (1 - pv.y) / 2 * h;
    const vis = pv.z < 1 && sx > -30 && sx < w + 30 && sy < h + 10;
    o.d.style.display = vis ? '' : 'none';
    if (vis) {   // 위로 넘치면 화면 안(해 표시 아래)에, 옆으로 넘치면 가장자리 안에 붙인다
      const bw = o.d.offsetWidth || 90, x = Math.max(bw / 2 + 4, Math.min(w - bw / 2 - 4, sx)), bh = o.d.offsetHeight || 30, yb = yearBox.offsetWidth ? yearBox.offsetTop + yearBox.offsetHeight + 6 : 70, y = Math.max((x - bw / 2 < yearBox.offsetLeft + yearBox.offsetWidth + 6 ? yb : 6) + bh, sy);
      o.d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  const setT = (o, sel, key, t) => { if (o[key] !== t) { o[key] = t; o.d.querySelector(sel).textContent = t; } };
  const p1 = (x) => (x * 100 < 10 ? (Math.round(x * 1000) / 10).toFixed(1) : String(Math.round(x * 100)));

  // ---------- 낮/밤 ----------
  let night = false;
  function applyTime() {
    night = !!($('ps-time') && $('ps-time').value === 'night');
    const p = night ? PAL.night : PAL.day;
    sky.material.uniforms.top.value.set(p.top); sky.material.uniforms.hor.value.set(p.hor); sky.material.uniforms.bot.value.set(p.bot);
    scene.fog.color.set(p.fog); scene.environment = night ? ENV.night : ENV.day;
    hemi.color.set(p.hemiS); hemi.groundColor.set(p.hemiG); hemi.intensity = p.hemiI; sun.color.set(p.sunC); sun.intensity = p.sunI;
    water.material.color.set(p.water);
    U.uWin.value.set(night ? '#ffc56b' : '#000000').multiplyScalar(night ? 1.5 : 0); U.uLit.value = 0.5;
    U.uGlass.value.set(night ? '#1d2737' : '#86a6c4');
    [terrain, water, harbor].forEach((m) => { if (m.material.envMapIntensity !== undefined) m.material.envMapIntensity = p.env; });
    towerMat.envMapIntensity = night ? 0.25 : 0.9;
    lampMeshes.forEach((m) => { m.visible = night; }); shipLights.visible = night;
    mount.material = night ? mountNight : mountMat;
    wrap.classList.toggle('ps3-night', night);
  }

  // ---------- 매 프레임 ----------
  let simRef = null, dispS = 0.5, dispQ = 0, warSeen = false, lastT = -1;
  function reformYear(w, P, t) {
    if (!P.rAt) return -1;
    for (let k = 0; k < t; k++) if (w.ratio[k] >= P.rAt) return k + 1;
    return -1;
  }
  function update(dt, tsec) {
    const st = window.PowershiftState; if (!st || !st.sim) return;
    const sim = st.sim, t = sim.t, w0 = sim.worlds[0], P = sim.params;
    const fresh = sim !== simRef;
    if (fresh) { simRef = sim; warSeen = w0.war >= 0 && w0.war <= t; flashT = -1; }
    U.uTime.value = tsec;
    // 도시: 그 해의 힘
    const Dp = w0.D_[t], Cp = w0.C_[t], share = Cp / (Cp + Dp);
    const snap = fresh || thumb;
    layoutCity(cities[0], level(Dp), snap, dt);
    layoutCity(cities[1], level(Cp), snap, dt);
    // 저울
    const goalTilt = -Math.max(-0.4, Math.min(0.4, (share - 0.5) * 1.5));
    tilt = snap ? goalTilt : tilt + (goalTilt - tilt) * Math.min(1, dt * 3);
    poseScale(tilt);
    // 위험 고리
    const hz = w0.war < 0 && t > 0 ? w0.haz[t - 1] : null, warNow = w0.war >= 0 && w0.war <= t;
    const q = hz == null ? 0 : Math.sqrt(Math.min(1, hz / HM));
    dispQ = snap ? q : dispQ + (q - dispQ) * Math.min(1, dt * 4);
    gaugeMat.uniforms.uFill.value = warNow ? 1 : dispQ;
    if (warNow) gaugeMat.uniforms.uCol.value.set('#b0213f'); else heat(Math.max(0.02, dispQ), gaugeMat.uniforms.uCol.value);
    gaugeMat.uniforms.uA.value = night ? 0.22 : 0.45;
    // 산맥
    updateMount(sim);
    // 충돌
    if (warNow && !warSeen) { warSeen = true; if (!thumb) flashT = 0; }
    if (!warNow) warSeen = false;
    shipVis = warNow ? Math.max(0, shipVis - dt * 0.8) : Math.min(1, shipVis + dt * 0.8);
    if (snap) shipVis = warNow ? 0 : 1;
    const moving = !thumb && (!st.isPaused() || sim.done());
    updateShips(dt, moving || !thumb, tsec);
    ships.visible = wakes.visible = shipVis > 0.01;
    beaconPole.visible = beaconLamp.visible = warNow;
    if (warNow) beaconLamp.material.color.set((Math.sin(tsec * 5) > 0 || thumb) ? '#ff3b30' : '#5a1a1a');
    if (flashT >= 0) {
      flashT += dt; const f = flashT;
      flash.visible = f < 1.8; flash.scale.setScalar(1.5 + f * 8); flash.material.opacity = Math.max(0, 0.9 * (1 - f / 1.8));
      boom.intensity = Math.max(0, 260 * (1 - f / 1.5));
      ripples.forEach((r, k) => { const g = f - k * 0.35; r.visible = g > 0 && g < 3; if (r.visible) { r.scale.setScalar(1 + g * 7); r.material.opacity = 0.75 * (1 - g / 3); } });
      if (f > 4) { flashT = -1; flash.visible = false; boom.intensity = 0; ripples.forEach((r) => { r.visible = false; }); }
    } else if (warNow) {
      // 충돌 뒤: 해협에 잔잔한 붉은 파문이 계속
      const g = (tsec * 0.45) % 3; const r = ripples[0]; r.visible = true; r.scale.setScalar(4 + g * 4); r.material.opacity = 0.45 * (1 - g / 3);
      ripples[1].visible = ripples[2].visible = false; boom.intensity = night ? 40 : 0;
    } else { ripples.forEach((r) => { r.visible = false; }); boom.intensity = 0; flash.visible = false; }
    // 질서 개편
    const ry = reformYear(w0, P, t), reformed = ry > 0 && (w0.war < 0 || ry <= w0.war);
    const bGoal = reformed ? 1 : 0;
    bridgeAmt = snap ? bGoal : bridgeAmt + Math.sign(bGoal - bridgeAmt) * Math.min(Math.abs(bGoal - bridgeAmt), dt / 1.6);
    bridge.visible = bridgeAmt > 0.01;
    if (bridge.visible) { const e = bridgeAmt * bridgeAmt * (3 - 2 * bridgeAmt); bridge.scale.set(Math.max(0.01, e), 1, 1); arch.scale.set(1, Math.max(0.01, e), 1); laurel.visible = knot.visible = e > 0.95; }
    // 깃발
    flags.forEach((f, k) => {
      const a = f.mesh.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { const x0 = f.base[i * 3], y0 = f.base[i * 3 + 1]; a.setZ(i, Math.sin(x0 * 2.4 - tsec * 4 + k) * 0.12 * x0 / 2.2); a.setY(i, y0 + Math.sin(x0 * 1.7 - tsec * 3) * 0.03 * x0); }
      a.needsUpdate = true; f.mesh.geometry.computeVertexNormals();
    });
    // 이름표
    const show = !thumb;
    setT(LD, 'span', 'v', `힘 ${Dp.toFixed(2)}`); setT(LC, 'span', 'v', `힘 ${Cp.toFixed(2)}`);
    place(LD, -CX, LAND_Y + (cities[0].top || 1) + 1.2, CZ, show); place(LC, CX, LAND_Y + (cities[1].top || 1) + 1.2, CZ, show);
    setT(LS, 'b', 'v', `힘 비율 ${(Cp / Dp).toFixed(2)}`);
    setT(LS, 'span', 'w', w0.cross >= 0 && w0.cross <= t ? `${w0.cross}년째 따라잡음` : '1 = 힘이 같음');
    place(LS, ISL[0], islY + PIV + 1.4, ISL[1], show);
    const gtxt = warNow ? `${w0.war}년째 충돌` : `올해 위험 ${hz == null ? '0.0' : p1(hz)}%`;
    setT(LG, 'span', 'v', gtxt);
    const gc = warNow ? C_WAR : '#' + gaugeMat.uniforms.uCol.value.getHexString();
    if (LG.c !== gc) { LG.c = gc; LG.d.querySelector('i').style.background = gc; }
    LG.d.classList.toggle('war', warNow);
    place(LG, ISL[0], 0.2, ISL[1] + 5.4, show);
    setT(LR, 'span', 'v', reformed ? `${ry}년째 질서 개편` : '');
    place(LR, 0, 4.9, BRZ, show && reformed && bridgeAmt > 0.9);
    const yt = `${t}년 / ${sim.T}년`; if (yearBox.t !== yt) { yearBox.t = yt; yearBox.querySelector('span').textContent = yt; yearBox.querySelector('u').style.width = (t / sim.T * 100).toFixed(1) + '%'; }
    const ym = `뒤 산맥(100개 세계) 충돌 ${sim.wars}곳`; if (yearBox.m !== ym) { yearBox.m = ym; yearBox.querySelector('small').textContent = ym; }
    lastT = t;
  }

  function home() {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 375, asp = w / h;
    if (thumb) { camera.position.set(3, 33, 43); controls.target.set(0, 2.5, -6); }
    else if (asp < 1.3) { camera.position.set(4, 52, 66); controls.target.set(0, 2, -8); }
    else { camera.position.set(9, 25, 45); controls.target.set(0, 3.2, -6); }
    controls.update();
  }
  controls.maxPolarAngle = 1.42;
  home();
  applyTime();
  update(0.016, 0);
  v.onFrame((dt, tsec) => update(dt, tsec));
  const sel = $('ps-time'); if (sel) sel.addEventListener('change', applyTime);
  const rot = $('ps-rotate');
  if (rot) { const on = () => rot.value === 'on'; rot.addEventListener('change', () => { controls.autoRotate = on(); }); if (!thumb) controls.autoRotate = on() && controls.autoRotate; }
  if (thumb) {
    controls.autoRotate = false;
    const shot = () => { update(0, 1.0); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Powershift3D = { v, update, stats: () => ({ bLeader: cities[0].mesh.count, bRiser: cities[1].mesh.count, lots: cities.map((c) => c.lots.length), trees: TREES.length, ships: NS, tilt: +tilt.toFixed(3), fill: +gaugeMat.uniforms.uFill.value.toFixed(3), bridge: +bridgeAmt.toFixed(2), night, shadows: renderer.shadowMap.enabled }) };
}

// 캔버스를 감싸 이름표를 겹쳐 올릴 자리를 만든다(create3D보다 먼저: 크기 감시가 부모를 본다)
let wrap = null;
if (canvas && st0) {
  const css = document.createElement('style');
  css.textContent = `
.ps3-wrap{position:relative;overflow:hidden;border-radius:14px;max-width:760px;margin:0 auto}
.ps3-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 12px/1.25 ${FONT};color:#1f2937;background:rgba(255,255,255,.93);border:1px solid #d5dae1;border-radius:9px;padding:3px 8px;box-shadow:0 1px 4px rgba(15,23,42,.14);will-change:transform}
.ps3-lab.node{display:flex;flex-direction:column;align-items:center;padding:3px 9px}
.ps3-lab.node b{font-size:12.5px;display:flex;align-items:center;gap:5px}.ps3-lab.node span{font-size:10.5px;font-weight:500;color:#6b7280}
.ps3-lab i{display:inline-block;width:9px;height:9px;border-radius:50%}
.ps3-lab.chip{display:flex;align-items:center;gap:5px;font-size:11.5px;padding:2px 8px}
.ps3-lab.chip.war{color:#fff;background:${C_WAR};border-color:#a61e4d}.ps3-lab.chip.war i{background:#fff!important}
.ps3-year{position:absolute;left:10px;top:10px;pointer-events:none;font:700 13px/1.2 ${FONT};color:#111827;background:rgba(255,255,255,.9);border:1px solid #d5dae1;border-radius:10px;padding:5px 10px 6px;box-shadow:0 1px 4px rgba(15,23,42,.14)}
.ps3-year small{display:block;font-size:10.5px;font-weight:500;color:#6b7280;margin-top:4px}
.ps3-year em{display:block;width:96px;height:4px;border-radius:2px;background:#e5e7eb;margin-top:4px;overflow:hidden}.ps3-year u{display:block;height:100%;width:0;background:#d6336c}
.ps3-night .ps3-lab,.ps3-night .ps3-year{background:rgba(22,29,44,.9);border-color:#3a4458;color:#e5e7eb}
.ps3-night .ps3-lab.node span,.ps3-night .ps3-year small{color:#9aa5b8}.ps3-night .ps3-year em{background:#334155}
@media (max-width:640px){.ps3-lab{font-size:10.5px;padding:2px 6px}.ps3-lab.node{padding:2px 7px}.ps3-lab.node b{font-size:11px}.ps3-lab.node span{font-size:9.5px}.ps3-lab.chip{font-size:10.5px;padding:1px 6px}.ps3-year{font-size:11.5px;left:6px;top:6px;padding:4px 8px}.ps3-year small{font-size:9.5px}.ps3-year em{width:70px}}
`;
  document.head.appendChild(css);
  wrap = document.createElement('div'); wrap.className = 'ps3-wrap';
  canvas.parentNode.insertBefore(wrap, canvas); wrap.appendChild(canvas);
  canvas.setAttribute('aria-label', '3D view of two city-states across a strait, a balance of power and a ring showing the yearly risk of conflict');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [9, 25, 45], target: [0, 3.2, -6], background: PAL.day.hor, autoRotateSpeed: 0.3, minDistance: 14, maxDistance: 140, fov: 42, far: 1500 });
  if (v) init(v, narrow);
}
