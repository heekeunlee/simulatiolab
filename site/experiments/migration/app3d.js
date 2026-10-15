// ① 가상의 땅 위 여섯 갈래 길 (3D, 사실적 보기): app.js가 window.MigState로 내보내는 같은 sim을 그대로 그린다(3D에서 새로 계산하지 않음).
// - 땅: 높이맵으로 만든 가상의 땅(눈 덮인 산맥·협곡을 흐르는 강·모래 언덕 사막·숲·밭·바닷가 파도). 실제 지도가 아니다.
// - 길: 지형을 따라 굽이치는 도로·오솔길(가장자리 색 = 2D 그래프와 같은 길 색, 파랑 안전 → 빨강 위험). 다리·흔들다리, 정식 관문엔 검문소와 차단기
// - 사람: 걷는 작은 인물(한 명 모양 = 여러 명). 길 위 인물 수 = sim.flow의 지난달 값, 걷는 빠르기는 그 길의 지금 부담(sim.costs)에만 따른 보기용
//   물길(강 건너기·바닷길)에서는 같은 사람이 작은 배를 탄다. 배는 보기용 모양일 뿐 계산과 상관없다
// - 막은 길: 강(경계) 앞에 콘크리트 벽과 감시탑이 막는 세기만큼 솟고, 되돌려 보내진 사람 몫은 벽에서 분홍 옷으로 되돌아 걷는다
// - 왼쪽 위 판: sim에 기록된 지난달 값(나선 사람·도착·사고·되돌려짐)을 그대로 옮긴 것
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.MigState;
const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
const WL = 0;   // 물 높이

// ---------- 잡음(시드 고정, 보기용 지형) ----------
function hash(i, j) { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}
function fbm(x, z, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let k = 0; k < o; k++) { s += a * vnoise(x * f + k * 17.3, z * f - k * 9.1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
function ridged(x, z, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let k = 0; k < o; k++) { const v = 1 - Math.abs(2 * vnoise(x * f + k * 31.7, z * f + k * 7.7) - 1); s += a * v * v; n += a; a *= 0.5; f *= 2.1; } return s / n; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- 가상의 땅 (x = 서→동, z = 북→남) ----------
const riverX = (z) => 1 + 1.2 * Math.sin(z * 0.35);
const coastZ = (x) => 11.2 + 1.0 * Math.sin(x * 0.22 + 0.6);
const riverW = (z) => 0.8 + Math.max(0, z - 4) * 0.05;
const X0 = -76, X1 = 76, Z0 = -62, Z1 = 34;
const desertW = (x, z) => sstep(4.4, 5.8, z) * (1 - sstep(9.8, 11.0, z)) * (1 - sstep(16, 20, Math.abs(x)));
function landH(x, z) {   // 강을 파기 전의 땅 높이
  let h = 0.45 + 0.4 * (fbm(x * 0.07, z * 0.07) - 0.5) + 0.14 * (fbm(x * 0.25 + 5, z * 0.25) - 0.5);
  const rg = Math.exp(-((z + 16) ** 2) / 14) * (0.75 + 0.25 * Math.sin(x * 0.55) * Math.cos(x * 0.21 + 1)) * (1 - 0.3 * Math.exp(-(x * x) / 30));
  h += rg * (2.6 + 5.0 * ridged(x * 0.11 + 3, z * 0.16));
  const fr = sstep(-19, -31, z);
  if (fr > 0) h += fr * (3.5 + 8.5 * ridged(x * 0.05 + 11, z * 0.07 + 2));
  const dw = desertW(x, z);
  if (dw > 0) { const d = 0.5 + 0.5 * Math.sin(x * 0.85 + z * 0.45 + 1.3 * Math.sin(z * 0.6 + x * 0.1)); h = lerp(h, 0.32 + 0.55 * d * d * d + 0.14 * fbm(x * 0.4, z * 0.4), dw); }
  const dc = coastZ(x) - z;
  if (dc > 0) { const s = sstep(0, 3.0, dc); h = h * s - 0.25 * (1 - s); } else h = Math.max(-3.2, -0.25 + dc * 0.28);
  const e = Math.min(x - X0, X1 - x, z - Z0);
  if (e < 10) h = -1.6 + (h + 1.6) * sstep(0, 10, e);
  return h;
}
function carveRiver(x, z, h) {   // 경계를 이루는 강: 산에서는 협곡, 들판에서는 낮은 둑
  if (z < -19.5) return h;
  const w = riverW(z), dr = Math.abs(x - riverX(z)), on = sstep(-19.5, -16.5, z);
  if (h > 0.4) { const sh = sstep(w + 4.5, w + 0.6, dr) * on; h = 0.4 + (h - 0.4) * (1 - 0.8 * sh); }
  const c = sstep(w + 0.9, w * 0.5, dr) * on;
  if (c > 0) h = lerp(h, Math.min(h, -0.55 + 0.25 * sstep(0, w, dr)), c);
  return h;
}
// 길 6개: 출발 지역(서) → 도착 지역(동). 같은 순서 = sim.ROUTES
const PATHS = [
  [[-24, -1], [-14, -6], [0, -7], [14, -6], [24, -1]],
  [[-24, 0], [-12, -2.6], [0, -2.6], [12, -2.6], [24, 0]],
  [[-24, 1], [-12, 2.6], [0, 2.6], [12, 2.6], [24, 1]],
  [[-24, -2], [-16, -10], [0, -13.2], [16, -10], [24, -2]],
  [[-24, 2], [-15, 6.2], [0, 8], [15, 6.2], [24, 2]],
  [[-24, 3], [-16, 11], [0, 15.5], [16, 11], [24, 3]],
];
const ROADW = [0.9, 1.15, 0.6, 0.5, 0.62, 0.62];             // 길 폭
const SURF = ['#5e636b', '#53585f', '#9b8262', '#948a7c', '#c8ad85', '#a58c6a'];   // 길 바닥: 아스팔트·흙·자갈·모래
const BRIDGED = [true, true, false, true, true, false];       // 강 위를 다리로 건너는 길 (강 건너기·바닷길은 배)
const NS = 300;

function mergeParts(parts) {   // [{g, color, leg, arm}] → 한 지오메트리(정점 색 + 팔다리 표시)
  let n = 0; const gs = parts.map((p) => { const g = p.g.index ? p.g.toNonIndexed() : p.g; n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), limb = new Float32Array(n * 2);
  let o = 0;
  gs.forEach((g, k) => {
    const c = new THREE.Color(parts[k].color), m = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < m; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; limb[(o + i) * 2] = parts[k].leg || 0; limb[(o + i) * 2 + 1] = parts[k].arm || 0; }
    o += m;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aLimb', new THREE.BufferAttribute(limb, 2));
  return g;
}
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

function init(v, narrow) {
  const { scene, camera, controls, renderer } = v;
  const MG = window.Migration, R = MG.ROUTES, COL = st0.colors, rnd = MG.mulberry32(11);
  const PC = !narrow;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  if (narrow) { renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1)); v.resize(); }
  if (PC) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  const hemi = scene.children.find((o) => o.isHemisphereLight), sun = scene.children.find((o) => o.isDirectionalLight);
  hemi.color.set('#dfeeff'); hemi.groundColor.set('#8a7a5c'); hemi.intensity = 0.55;
  sun.color.set('#fff1dc'); sun.intensity = 2.3; sun.position.set(-40, 46, 24);
  if (PC) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 40, bottom: -40, near: 5, far: 160 }); sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  }

  // ---------- 하늘·안개·주변광(하늘을 비추는 환경 지도) ----------
  const HOR = new THREE.Color('#d9e6ee'), TOP = new THREE.Color('#5d97d1');
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: TOP }, hor: { value: HOR }, sunD: { value: sun.position.clone().normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunD; varying vec3 vD; void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.5)); float s = max(dot(d, sunD), 0.0); c += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 2.0 + pow(s, 10.0) * 0.12); if (d.y < 0.0) c = hor; gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -10;
  {
    const ss = new THREE.Scene(); ss.add(new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(ss, 0).texture; pm.dispose();
  }
  scene.add(sky); scene.background = HOR.clone(); scene.fog = new THREE.Fog(HOR.clone(), 65, 200);

  // ---------- 길 표본 (곡선 위 점들) ----------
  const LUT = PATHS.map((p) => {
    const cv = new THREE.CatmullRomCurve3(p.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const P = cv.getSpacedPoints(NS - 1), L = { N: NS, X: new Float32Array(NS), Z: new Float32Array(NS), A: new Float32Array(NS), Y: new Float32Array(NS), raw: new Float32Array(NS), prof: new Float32Array(NS), W: new Uint8Array(NS), B: new Uint8Array(NS) };
    for (let i = 0; i < NS; i++) { L.X[i] = P[i].x; L.Z[i] = P[i].z; L.raw[i] = landH(L.X[i], L.Z[i]); L.W[i] = carveRiver(L.X[i], L.Z[i], L.raw[i]) < WL - 0.03 ? 1 : 0; }
    for (let i = 0; i < NS; i++) { const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1); L.A[i] = Math.atan2(L.Z[b] - L.Z[a], L.X[b] - L.X[a]); }
    for (let i = 0; i < NS; i++) {   // 길 높이 = 땅 높이를 부드럽게
      let s = 0, n = 0; for (let k = -12; k <= 12; k++) { const j = i + k; if (j < 0 || j >= NS || L.raw[j] < 0.05) continue; s += L.raw[j]; n++; }
      L.prof[i] = n ? Math.max(0.3, s / n) : 0.3;
    }
    return L;
  });
  LUT.forEach((L, r) => {   // 막는 벽 자리 = 강(경계, 바닷길은 바다)에 들어서기 직전의 땅
    let k = 0; for (let i = Math.round(NS * 0.2); i < NS * 0.8; i++) { if (L.W[i] || (BRIDGED[r] && carveRiver(L.X[i], L.Z[i], L.raw[i]) < L.prof[i] - 0.2)) { k = i; break; } }
    L.wallI = Math.max(2, k - 6); L.wallU = L.wallI / (NS - 1);
    let e = k; while (e < NS - 1 && (L.W[e] || carveRiver(L.X[e], L.Z[e], L.raw[e]) < L.prof[e] - 0.2)) e++;
    L.crossEnd = e;
  });

  // ---------- 땅 (높이 격자) ----------
  const GX = narrow ? 200 : 300, GZ = Math.round(GX * (Z1 - Z0) / (X1 - X0)), NV = (GX + 1) * (GZ + 1), DX = (X1 - X0) / GX, DZ = (Z1 - Z0) / GZ;
  const H = new Float32Array(NV), PD = new Float32Array(NV).fill(99), PP = new Float32Array(NV), PR = new Int8Array(NV).fill(-1);
  for (let j = 0; j <= GZ; j++) for (let i = 0; i <= GX; i++) H[j * (GX + 1) + i] = landH(X0 + i * DX, Z0 + j * DZ);
  LUT.forEach((L, r) => {   // 길 자리를 길 높이로 고르게 다듬는다
    for (let s = 0; s < NS; s++) {
      if (L.raw[s] < 0.05) continue;
      const cx = L.X[s], cz = L.Z[s], ci = Math.round((cx - X0) / DX), cj = Math.round((cz - Z0) / DZ), rr = 4;
      for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i > GX || j > GZ) continue;
        const id = j * (GX + 1) + i, d = Math.hypot(X0 + i * DX - cx, Z0 + j * DZ - cz);
        if (d < PD[id]) { PD[id] = d; PP[id] = L.prof[s]; PR[id] = r; }
      }
    }
  });
  for (let id = 0; id < NV; id++) if (PR[id] >= 0) { const w = 1 - sstep(ROADW[PR[id]] / 2 + 0.15, ROADW[PR[id]] / 2 + 1.4, PD[id]); H[id] = lerp(H[id], PP[id] - 0.03, w); }
  for (let j = 0; j <= GZ; j++) for (let i = 0; i <= GX; i++) { const id = j * (GX + 1) + i; H[id] = carveRiver(X0 + i * DX, Z0 + j * DZ, H[id]); }
  function hAt(x, z) {   // 격자 삼각형 그대로의 높이 (아래 그물과 같은 나눔)
    const fx = Math.min(GX - 1e-4, Math.max(0, (x - X0) / DX)), fz = Math.min(GZ - 1e-4, Math.max(0, (z - Z0) / DZ));
    const i = fx | 0, j = fz | 0, u = fx - i, w = fz - j, a = H[j * (GX + 1) + i], b = H[(j + 1) * (GX + 1) + i], c = H[(j + 1) * (GX + 1) + i + 1], d = H[j * (GX + 1) + i + 1];
    return u + w <= 1 ? a + (d - a) * u + (b - a) * w : c + (b - c) * (1 - u) + (d - c) * (1 - w);
  }
  const nearPath = (x, z) => { const i = Math.round((x - X0) / DX), j = Math.round((z - Z0) / DZ); return (i < 0 || j < 0 || i > GX || j > GZ) ? 99 : PD[j * (GX + 1) + i]; };
  {
    const pos = new Float32Array(NV * 3), idx = new (NV > 65535 ? Uint32Array : Uint16Array)(GX * GZ * 6);
    for (let j = 0; j <= GZ; j++) for (let i = 0; i <= GX; i++) { const id = j * (GX + 1) + i; pos[id * 3] = X0 + i * DX; pos[id * 3 + 1] = H[id]; pos[id * 3 + 2] = Z0 + j * DZ; }
    let o = 0;
    for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) { const a = j * (GX + 1) + i, b = a + GX + 1, c = b + 1, d = a + 1; idx[o++] = a; idx[o++] = b; idx[o++] = d; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const nor = g.attributes.normal.array, cols = new Float32Array(NV * 3), c = new THREE.Color(), t = new THREE.Color();
    const K = (h) => new THREE.Color(h);
    const GA = K('#7ea24c'), GB = K('#5d8a38'), DRY = K('#a8a560'), FOR = K('#4c7431'), SAND = K('#e0cc98'), DL = K('#ecd193'), DD = K('#c99f62'),
      ROCK = K('#8a8076'), ROCKD = K('#625b54'), SNOW = K('#f4f6f9'), MUD = K('#8d7f60'), UW = K('#b4a47c'), UWD = K('#5f7468'), DIRT = K('#a48a66'), F1 = K('#cdb75a'), F2 = K('#8fae48');
    for (let j = 0; j <= GZ; j++) for (let i = 0; i <= GX; i++) {
      const id = j * (GX + 1) + i, x = X0 + i * DX, z = Z0 + j * DZ, h = H[id], ny = nor[id * 3 + 1], n1 = fbm(x * 0.15, z * 0.15);
      c.copy(GA).lerp(GB, sstep(0.35, 0.7, n1)).lerp(DRY, 0.35 * sstep(0.55, 0.8, fbm(x * 0.05 + 9, z * 0.05)));
      if (fbm(x * 0.11 + 40, z * 0.11) > 0.56) c.lerp(FOR, 0.7);
      const fz = (Math.abs(x) > 17 && Math.abs(x) < 33 && Math.abs(z) < 7.5) ? (1 - sstep(5.5, 7.5, Math.abs(z))) * sstep(17, 19, Math.abs(x)) * (1 - sstep(31, 33, Math.abs(x))) : 0;
      if (fz > 0) { const band = Math.floor((x * 0.8 + z * 0.5) / 1.3 + Math.floor(z / 4) * 0.5), q = hash(band, Math.floor(z / 4)); c.lerp(q < 0.33 ? F1 : q < 0.66 ? F2 : DRY, 0.75 * fz); }
      const dw = desertW(x, z); if (dw > 0) c.lerp(t.copy(DD).lerp(DL, sstep(0.75, 0.98, ny) * 0.8 + 0.2 * n1), dw);
      const dc = coastZ(x) - z; if (dc < 3.4 && h < 0.6) c.lerp(SAND, sstep(3.4, 1.4, dc));
      const dr = Math.abs(x - riverX(z)); if (z > -17 && dr < riverW(z) + 1.2) c.lerp(MUD, 0.55 * sstep(riverW(z) + 1.2, riverW(z) + 0.4, dr));
      const rk = Math.min(1, sstep(0.86, 0.62, ny) + sstep(1.8, 3.4, h) * 0.65);
      if (rk > 0) c.lerp(t.copy(ROCK).lerp(ROCKD, n1), rk);
      const sn = sstep(4.1, 5.0, h + (n1 - 0.5) * 1.8) * sstep(0.42, 0.72, ny); if (sn > 0) c.lerp(SNOW, sn);
      if (h < WL + 0.02) c.copy(UW).lerp(UWD, sstep(0, 1.4, -h));
      if (PR[id] >= 0 && h > 0.02) c.lerp(DIRT, 0.75 * (1 - sstep(ROADW[PR[id]] / 2 + 0.05, ROADW[PR[id]] / 2 + 0.6, PD[id])));
      cols[id * 3] = c.r; cols[id * 3 + 1] = c.g; cols[id * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, envMapIntensity: 0.55 }));
    m.receiveShadow = PC; scene.add(m);
  }

  // ---------- 물(강·바다): 땅 높이로 얕은 곳은 옥빛·물보라, 잔물결 법선 ----------
  const U = { time: { value: 0 }, walk: { value: 0 } };
  {
    const hb = new Uint8Array(NV * 4);
    for (let id = 0; id < NV; id++) { const e = Math.round(Math.min(1, Math.max(0, (H[id] + 4) / 8)) * 255); hb[id * 4] = e; hb[id * 4 + 1] = e; hb[id * 4 + 2] = e; hb[id * 4 + 3] = 255; }
    const ht = new THREE.DataTexture(hb, GX + 1, GZ + 1, THREE.RGBAFormat); ht.magFilter = THREE.LinearFilter; ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
    const wm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.07, metalness: 0.05, transparent: true, envMapIntensity: 1.1, depthWrite: false });
    wm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time; sh.uniforms.uHt = { value: ht }; sh.uniforms.uB = { value: new THREE.Vector4(X0 - DX / 2, Z0 - DZ / 2, X1 - X0 + DX, Z1 - Z0 + DZ) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vW; uniform float uTime; uniform sampler2D uHt; uniform vec4 uB;
float wH(vec2 p){ return texture2D(uHt, (p - uB.xy) / uB.zw).r * 8.0 - 4.0; }
vec2 wG(vec2 p, float t){
  vec2 g = vec2(0.0), d;
  d = normalize(vec2(0.25, -1.0)); g += d * cos(dot(d, p) * 1.6 + t * 1.2) * 0.10;
  d = normalize(vec2(-0.8, -0.6)); g += d * cos(dot(d, p) * 2.9 + t * 1.8) * 0.09;
  d = normalize(vec2(0.9, -0.3)); g += d * cos(dot(d, p) * 5.3 + t * 2.5) * 0.07;
  d = normalize(vec2(-0.3, 0.95)); g += d * cos(dot(d, p) * 9.7 + t * 3.3) * 0.05;
  d = normalize(vec2(0.7, 0.7)); g += d * cos(dot(d, p) * 15.1 + t * 4.1) * 0.035;
  return g;
}`).replace('#include <color_fragment>', `#include <color_fragment>
  vec2 wp = vW.xz; float dep = max(0.0, -wH(wp));
  float rx = 1.0 + 1.2 * sin(wp.y * 0.35), cz = 11.2 + 1.0 * sin(wp.x * 0.22 + 0.6);
  float riv = smoothstep(3.2, 1.2, abs(wp.x - rx)) * smoothstep(cz - 0.5, cz - 2.5, wp.y);
  vec3 wc = mix(vec3(0.30, 0.66, 0.66), vec3(0.05, 0.26, 0.44), smoothstep(0.0, 2.4, dep));
  wc = mix(wc, vec3(0.26, 0.45, 0.42), riv * 0.75);
  float ph = dep * 13.0 - uTime * 1.4 + sin(wp.x * 0.7) * 1.5;
  float foam = (1.0 - smoothstep(0.0, 0.14, dep)) * 0.9 + smoothstep(0.82, 1.0, sin(ph)) * (1.0 - smoothstep(0.05, 0.55, dep)) * (1.0 - riv) * 0.6;
  foam += riv * smoothstep(0.93, 1.0, sin((wp.y - uTime * 1.3) * 5.0 + wp.x * 2.0 + sin(wp.y * 1.7) * 2.0)) * 0.25;
  foam = clamp(foam, 0.0, 1.0);
  diffuseColor.rgb = mix(wc, vec3(0.96, 0.98, 1.0), foam);
  diffuseColor.a = max(mix(0.5, 0.94, smoothstep(0.0, 0.9, dep)), foam * 0.95);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.85, foam);')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec2 gq = wG(wp + vec2(0.0, -uTime * 0.9 * riv), uTime) * (1.0 - foam * 0.7) * mix(1.0, 0.6, riv);
  normal = normalize((viewMatrix * vec4(normalize(vec3(-gq.x, 1.0, -gq.y)), 0.0)).xyz);`);
    };
    const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), wm); water.rotation.x = -Math.PI / 2; water.position.set(0, WL, 0); water.renderOrder = 1; scene.add(water);
  }

  // ---------- 길 (지형을 따르는 도로·오솔길, 가장자리 = 길 색) ----------
  LUT.forEach((L, r) => {
    for (let i = 0; i < NS; i++) {
      const hc = hAt(L.X[i], L.Z[i]);
      L.B[i] = BRIDGED[r] && hc < L.prof[i] - 0.15 ? 1 : 0;
      L.Y[i] = L.W[i] && !BRIDGED[r] ? WL : L.B[i] ? L.prof[i] + 0.13 : Math.max(hc, WL) + 0.05;
    }
    for (let i = 0; i < NS; i++) if (BRIDGED[r] && L.W[i]) L.B[i] = 1;
  });
  function ribbon(L, r, w0, w1, lift, skip) {   // 길 중심에서 w0~w1만큼 떨어진 띠(양쪽)
    const pos = [], idx = [];
    [-1, 1].forEach((sd) => {
      let prev = -1;
      for (let i = 0; i < NS; i++) {
        if (skip(i)) { prev = -1; continue; }
        const a = L.A[i], px = -Math.sin(a) * sd, pz = Math.cos(a) * sd, vi = pos.length / 3;
        const xa = L.X[i] + px * w0, za = L.Z[i] + pz * w0, xb = L.X[i] + px * w1, zb = L.Z[i] + pz * w1;
        const ya = L.B[i] ? L.Y[i] : Math.max(hAt(xa, za) + 0.05, L.Y[i] - 0.02), yb = L.B[i] ? L.Y[i] : Math.max(hAt(xb, zb) + 0.05, L.Y[i] - 0.02);
        pos.push(xa, ya + lift, za, xb, yb + lift, zb);
        if (prev >= 0) { if (sd < 0) idx.push(prev, vi, prev + 1, prev + 1, vi, vi + 1); else idx.push(prev, prev + 1, vi, prev + 1, vi + 1, vi); }
        prev = vi;
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const roadMats = [];
  LUT.forEach((L, r) => {
    const hw = ROADW[r] / 2, skip = (i) => !!(L.W[i] && !BRIDGED[r]);
    const surf = new THREE.Mesh(ribbon(L, r, 0, hw, 0, skip), new THREE.MeshStandardMaterial({ color: SURF[r], roughness: r < 2 ? 0.8 : 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    surf.receiveShadow = PC; scene.add(surf);
    const em = new THREE.MeshStandardMaterial({ color: COL[r], roughness: 0.6, emissive: COL[r], emissiveIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    roadMats.push(em);
    scene.add(new THREE.Mesh(ribbon(L, r, hw - 0.02, hw + 0.13, 0.012, skip), em));
    if (r === 1 || r === 0) {   // 포장도로 가운데 흰 점선
      const dash = new THREE.Mesh(ribbon(L, r, 0, 0.035, 0.01, (i) => (i % 6) > 2), new THREE.MeshStandardMaterial({ color: '#f1f1ea', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      scene.add(dash);
    }
  });

  // ---------- 다리·부표 ----------
  const dm = new THREE.Object3D(), m4 = new THREE.Matrix4();
  {
    const deckT = [], railT = [], pierT = [], buoyT = [];
    LUT.forEach((L, r) => {
      if (BRIDGED[r]) {
        for (let i = 1; i < NS; i++) {
          if (!L.B[i] && !L.B[i - 1]) continue;
          const x = (L.X[i] + L.X[i - 1]) / 2, z = (L.Z[i] + L.Z[i - 1]) / 2, y = (L.Y[i] + L.Y[i - 1]) / 2, len = Math.hypot(L.X[i] - L.X[i - 1], L.Z[i] - L.Z[i - 1]) * 1.08, a = L.A[i];
          deckT.push([x, y - 0.1, z, a, len, ROADW[r] + 0.3, r]);
          [-1, 1].forEach((sd) => railT.push([x - Math.sin(a) * sd * (ROADW[r] / 2 + 0.12), y + 0.1, z + Math.cos(a) * sd * (ROADW[r] / 2 + 0.12), a, len, r]));
          if (i % 7 === 0 && r !== 3) { const hb = hAt(x, z); if (hb < y - 0.4) pierT.push([x, (hb + y - 0.1) / 2 - 0.2, z, a, y - hb + 0.3]); }
        }
      } else {
        for (let i = 0; i < NS; i += 16) if (L.W[i]) [-1, 1].forEach((sd) => buoyT.push([L.X[i] - Math.sin(L.A[i]) * sd * 0.75, L.Z[i] + Math.cos(L.A[i]) * sd * 0.75, r]));
      }
    });
    const WOOD = new THREE.Color('#8a6a48'), CONC = new THREE.Color('#c7c3ba');
    const deck = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.14, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), deckT.length);
    deckT.forEach(([x, y, z, a, len, w, r], k) => { dm.position.set(x, y, z); dm.rotation.set(0, -a, 0); dm.scale.set(len, 1, w); dm.updateMatrix(); deck.setMatrixAt(k, dm.matrix); deck.setColorAt(k, r === 3 || r === 4 ? WOOD : CONC); });
    deck.castShadow = PC; deck.receiveShadow = PC; scene.add(deck);
    const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), railT.length);
    railT.forEach(([x, y, z, a, len, r], k) => { dm.position.set(x, y, z); dm.rotation.set(0, -a, 0); dm.scale.set(len, 1, 1); dm.updateMatrix(); rail.setMatrixAt(k, dm.matrix); rail.setColorAt(k, r === 3 || r === 4 ? WOOD : new THREE.Color('#9aa1a9')); });
    scene.add(rail);
    if (pierT.length) {
      const pier = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1, 0.8), new THREE.MeshStandardMaterial({ color: '#b5b0a6', roughness: 0.9 }), pierT.length);
      pierT.forEach(([x, y, z, a, h], k) => { dm.position.set(x, y, z); dm.rotation.set(0, -a, 0); dm.scale.set(1, h, 1); dm.updateMatrix(); pier.setMatrixAt(k, dm.matrix); });
      pier.castShadow = PC; scene.add(pier);
    }
    const buoy = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }), buoyT.length);
    buoyT.forEach(([x, z, r], k) => { dm.position.set(x, WL + 0.03, z); dm.rotation.set(0, 0, 0); dm.scale.set(1, 0.8, 1); dm.updateMatrix(); buoy.setMatrixAt(k, dm.matrix); buoy.setColorAt(k, new THREE.Color(k % 2 ? '#f97316' : '#f8fafc')); });
    scene.add(buoy);
  }

  // ---------- 나무·바위 ----------
  {
    const NT = narrow ? 700 : 1600, pine = [], leaf = [];
    for (let k = 0; k < NT * 14 && pine.length + leaf.length < NT; k++) {
      const x = X0 + 4 + rnd() * (X1 - X0 - 8), z = Z0 + 8 + rnd() * (Z1 - Z0 - 8), h = hAt(x, z);
      if (h < 0.28 || h > 3.6 || desertW(x, z) > 0.15 || coastZ(x) - z < 2.2 || nearPath(x, z) < 1.7) continue;
      if (Math.abs(x - riverX(z)) < riverW(z) + 0.7) continue;
      if ((Math.abs(x) > 24 && Math.abs(z) < 7.5) || (Math.abs(x) > 17 && Math.abs(x) < 33 && Math.abs(z) < 7)) continue;   // 마을·밭
      const dense = fbm(x * 0.11 + 40, z * 0.11) > 0.56, mtn = h > 1.3;
      if (!(dense ? rnd() < 0.9 : rnd() < (mtn ? 0.2 : 0.05))) continue;
      (mtn || rnd() < 0.3 ? pine : leaf).push([x, h, z, 0.75 + rnd() * 0.6, rnd()]);
    }
    const pg = mergeParts([{ g: new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5).translate(0, 0.2, 0), color: '#6b4f35' },
      { g: new THREE.ConeGeometry(0.42, 0.8, 7).translate(0, 0.65, 0), color: '#ffffff' }, { g: new THREE.ConeGeometry(0.27, 0.65, 7).translate(0, 1.1, 0), color: '#ffffff' }]);
    const lg = mergeParts([{ g: new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5).translate(0, 0.25, 0), color: '#6b4f35' },
      { g: new THREE.IcosahedronGeometry(0.42, 0).translate(0, 0.78, 0), color: '#ffffff' }, { g: new THREE.IcosahedronGeometry(0.3, 0).translate(0.18, 0.95, 0.12), color: '#ffffff' }]);
    [[pine, pg, ['#2f5a34', '#3c6b3a', '#29502f']], [leaf, lg, ['#5c8a3a', '#4f7d33', '#6f9840', '#7c9c3e']]].forEach(([arr, g, pal]) => {
      const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), arr.length);
      arr.forEach(([x, h, z, s, q], k) => { dm.position.set(x, h - 0.05, z); dm.rotation.set(0, q * 6.28, 0); dm.scale.set(s, s * (0.85 + q * 0.4), s); dm.updateMatrix(); m.setMatrixAt(k, dm.matrix); m.setColorAt(k, new THREE.Color(pal[Math.floor(q * pal.length)])); });
      m.castShadow = PC; m.receiveShadow = false; scene.add(m);
    });
    const rocks = [];
    for (let k = 0; k < 3000 && rocks.length < (narrow ? 120 : 260); k++) {
      const x = -40 + rnd() * 80, z = -20 + rnd() * 34, h = hAt(x, z), dw = desertW(x, z);
      if (h < 0.15 || nearPath(x, z) < 0.9 || !(dw > 0.5 || (h > 1.5 && h < 4))) continue;
      rocks.push([x, h, z, 0.12 + rnd() * 0.3, rnd(), dw > 0.5]);
    }
    const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }), rocks.length);
    rocks.forEach(([x, h, z, s, q, ds], k) => { dm.position.set(x, h, z); dm.rotation.set(q * 3, q * 7, q * 5); dm.scale.set(s, s * 0.6, s * 0.9); dm.updateMatrix(); rm.setMatrixAt(k, dm.matrix); rm.setColorAt(k, new THREE.Color(ds ? '#b8915e' : '#7d756c')); });
    rm.castShadow = PC; scene.add(rm);
  }

  // ---------- 마을(출발 지역)·도시(도착 지역) ----------
  {
    const walls = [], roofs = [], blds = [];
    for (let k = 0; k < 4000 && walls.length < (narrow ? 46 : 64); k++) {   // 서쪽 마을: 박공지붕 집
      const x = -33.5 + rnd() * 9.5, z = -6.5 + rnd() * 13, h = hAt(x, z);
      if (h < 0.2 || nearPath(x, z) < 1.0 || walls.some((w) => Math.hypot(w[0] - x, w[2] - z) < 1.25)) continue;
      walls.push([x, h, z, rnd() * 0.4 + (rnd() < 0.5 ? 0 : 1.57), 0.8 + rnd() * 0.35, rnd()]);
    }
    for (let k = 0; k < 4000 && blds.length < (narrow ? 50 : 72); k++) {   // 동쪽 도시: 창문 있는 건물
      const x = 25 + rnd() * 10, z = -7 + rnd() * 14, h = hAt(x, z);
      if (h < 0.2 || nearPath(x, z) < 1.0 || blds.some((b) => Math.hypot(b[0] - x, b[2] - z) < 1.35)) continue;
      const dc = Math.hypot(x - 30, z), tall = dc < 3.8 ? 1.6 + rnd() * 2.6 : 0.8 + rnd() * 1.2;
      blds.push([x, h, z, (rnd() < 0.5 ? 0 : 1.57) + (rnd() - 0.5) * 0.2, tall, 0.8 + rnd() * 0.45]);
    }
    const wallG = box(1, 0.7, 0.8, 0, 0.35, 0), roofG = new THREE.CylinderGeometry(0.58, 0.58, 1.15, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0.7 + 0.29, 0);
    const wM = new THREE.InstancedMesh(wallG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), walls.length);
    const rM = new THREE.InstancedMesh(roofG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }), walls.length);
    const WC = ['#f3ede1', '#ece3d2', '#f7f3ea', '#e4dccb'], RC = ['#b4533c', '#9c4632', '#6d6a68', '#7c4a32'];
    walls.forEach(([x, h, z, a, s, q], k) => { dm.position.set(x, h - 0.04, z); dm.rotation.set(0, a, 0); dm.scale.set(s, s, s); dm.updateMatrix(); wM.setMatrixAt(k, dm.matrix); rM.setMatrixAt(k, dm.matrix); wM.setColorAt(k, new THREE.Color(WC[Math.floor(q * 4)])); rM.setColorAt(k, new THREE.Color(RC[Math.floor(q * 3.99 * 7) % 4])); });
    wM.castShadow = rM.castShadow = PC; wM.receiveShadow = PC; scene.add(wM, rM);
    const facade = (floors) => {   // 캔버스로 그린 창문 면
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32 * floors; const x = cv.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, cv.height);
      for (let f = 0; f < floors; f++) for (let c = 0; c < 4; c++) { x.fillStyle = (f * 7 + c * 3) % 5 === 0 ? '#9fb3c4' : '#5f7486'; x.fillRect(6 + c * 14, 8 + f * 32, 9, 15); }
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
    };
    const roofMat = new THREE.MeshStandardMaterial({ color: '#8e9298', roughness: 0.9 });
    [[blds.filter((b) => b[4] < 1.6), 3, 1.2], [blds.filter((b) => b[4] >= 1.6), 9, 3.6]].forEach(([arr, fl, base]) => {
      if (!arr.length) return;
      const fm = new THREE.MeshStandardMaterial({ map: facade(fl), roughness: 0.75 });
      const m = new THREE.InstancedMesh(box(1, 1, 1, 0, 0.5, 0), [fm, fm, roofMat, roofMat, fm, fm], arr.length);
      const BC = ['#eef0f2', '#e6dfd3', '#dfe5ea', '#f1ebe0', '#d7dde3'];
      arr.forEach(([x, h, z, a, t, s], k) => { dm.position.set(x, h - 0.05, z); dm.rotation.set(0, a, 0); dm.scale.set(s, t * (base === 1.2 ? 1 : 1), s * 0.9); dm.updateMatrix(); m.setMatrixAt(k, dm.matrix); m.setColorAt(k, new THREE.Color(BC[k % 5])); });
      m.castShadow = PC; m.receiveShadow = PC; scene.add(m);
    });
  }

  // ---------- 정식 관문: 다리 건너 검문소·지붕·차단기·깃발 (가상의 깃발) ----------
  const flags = [], arms = [];
  {
    const L = LUT[0], k = Math.min(NS - 1, L.crossEnd + 5), x = L.X[k], z = L.Z[k], a = L.A[k], y = hAt(x, z), px = -Math.sin(a), pz = Math.cos(a);
    const G = new THREE.Group(); G.position.set(x, y, z); G.rotation.y = -a; scene.add(G);
    const white = new THREE.MeshStandardMaterial({ color: '#f4f5f6', roughness: 0.6 }), blue = new THREE.MeshStandardMaterial({ color: '#2b5c9e', roughness: 0.5 }), steel = new THREE.MeshStandardMaterial({ color: '#8d949c', roughness: 0.4, metalness: 0.6 });
    const add = (g, m, sh = true) => { const o = new THREE.Mesh(g, m); o.castShadow = PC && sh; o.receiveShadow = PC; G.add(o); return o; };
    add(box(1.6, 0.85, 1.0, 0.2, 0.42, 1.45), white); add(box(1.62, 0.12, 1.02, 0.2, 0.76, 1.45), blue);
    add(box(0.5, 0.08, 1.02, 0.2, 0.42, 0.94), new THREE.MeshStandardMaterial({ color: '#33475b', roughness: 0.2, metalness: 0.3 }));
    [[-0.5, -0.75], [-0.5, 0.75], [0.9, -0.75], [0.9, 0.75]].forEach(([ax, az]) => add(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8).translate(ax, 0.58, az), steel));
    add(box(1.8, 0.09, 1.95, 0.2, 1.18, 0), white); add(box(1.82, 0.07, 1.97, 0.2, 1.24, 0), blue);
    add(box(0.32, 0.55, 0.32, -0.75, 0.28, -0.75), white);   // 작은 초소
    const sc = document.createElement('canvas'); sc.width = 128; sc.height = 8; const sx = sc.getContext('2d');
    for (let i = 0; i < 8; i++) { sx.fillStyle = i % 2 ? '#ffffff' : '#d42a2a'; sx.fillRect(i * 16, 0, 16, 8); }
    const stripe = new THREE.CanvasTexture(sc); stripe.colorSpace = THREE.SRGBColorSpace;
    const arm = new THREE.Group(); arm.position.set(-0.75, 0.42, -0.62); G.add(arm);
    const armMesh = new THREE.Mesh(box(0.05, 0.05, 1.2, 0, 0, 0.6), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.5 })); arm.add(armMesh); arms.push(arm);
    const ft = document.createElement('canvas'); ft.width = 96; ft.height = 64; const fx = ft.getContext('2d');   // 가상의 깃발: 하늘색 바탕에 흰 물결
    fx.fillStyle = '#3a8fc9'; fx.fillRect(0, 0, 96, 64); fx.strokeStyle = '#ffffff'; fx.lineWidth = 7; fx.beginPath(); fx.moveTo(0, 38); fx.bezierCurveTo(30, 18, 60, 56, 96, 30); fx.stroke();
    const ftx = new THREE.CanvasTexture(ft); ftx.colorSpace = THREE.SRGBColorSpace;
    [[1.3, 1.1], [1.3, 1.8]].forEach(([fxp, fzp]) => {
      add(new THREE.CylinderGeometry(0.025, 0.03, 1.9, 6).translate(fxp, 0.95, fzp), steel);
      const fg = new THREE.PlaneGeometry(0.55, 0.36, 10, 2).translate(0.275, 0, 0);
      const f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: ftx, side: THREE.DoubleSide, roughness: 0.8 })); f.position.set(fxp, 1.68, fzp); f.rotation.y = Math.PI / 2 + 0.4; G.add(f);
      flags.push({ g: fg, base: fg.attributes.position.array.slice() });
    });
    void px; void pz;
  }

  // ---------- 막는 벽 + 감시탑 (막은 길만, 높이 = 막는 세기) ----------
  let wallObj = null, wallFor = -1;
  const concrete = new THREE.MeshStandardMaterial({ color: '#a9a49b', roughness: 0.92 }), dark = new THREE.MeshStandardMaterial({ color: '#3c3f44', roughness: 0.6, metalness: 0.4 });
  const redLamp = new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff1a10', emissiveIntensity: 1.5 });
  function buildWall(r) {
    if (wallObj) { scene.remove(wallObj.G); wallObj.G.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const L = LUT[r], k = L.wallI, cx = L.X[k], cz = L.Z[k], a = L.A[k], px = -Math.sin(a), pz = Math.cos(a), hw = ROADW[r] / 2 + 0.35;
    const G = new THREE.Group(); scene.add(G);
    const slots = []; for (let s = -3.1; s <= 3.11; s += 0.62) if (Math.abs(s) > hw) slots.push(s);
    const base = slots.map((s) => Math.max(hAt(cx + px * s, cz + pz * s), WL - 0.15) - 0.05);
    const panels = new THREE.InstancedMesh(box(0.36, 1, 0.6, 0, 0.5, 0), concrete, slots.length), wire = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).rotateX(Math.PI / 2), dark, slots.length);
    panels.castShadow = PC; panels.receiveShadow = PC; G.add(panels, wire);
    const towers = [-3.65, 3.65].map((s) => {
      const T = new THREE.Group(); T.position.set(cx + px * s, Math.max(hAt(cx + px * s, cz + pz * s), WL) - 0.05, cz + pz * s); T.rotation.y = -a; G.add(T);
      [[-0.22, -0.22], [-0.22, 0.22], [0.22, -0.22], [0.22, 0.22]].forEach(([lx, lz]) => { const o = new THREE.Mesh(box(0.07, 2.0, 0.07, lx, 1.0, lz), dark); o.castShadow = PC; T.add(o); });
      const cab = new THREE.Mesh(box(0.75, 0.5, 0.75, 0, 2.2, 0), concrete); cab.castShadow = PC; T.add(cab);
      T.add(new THREE.Mesh(box(0.77, 0.12, 0.77, 0, 2.25, 0), new THREE.MeshStandardMaterial({ color: '#2a3340', roughness: 0.2, metalness: 0.5 })));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.35, 4).rotateY(Math.PI / 4).translate(0, 2.62, 0), dark); roof.castShadow = PC; T.add(roof);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8).translate(0, 2.86, 0), redLamp); T.add(lamp);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.0, 16, 1, true).translate(0, -1.5, 0), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
      const bp = new THREE.Group(); bp.position.set(0, 2.2, 0); bp.add(beam); beam.rotation.x = 0; T.add(bp);
      return { T, bp, s };
    });
    const gate = new THREE.Group(); gate.position.set(cx, hAt(cx, cz), cz); gate.rotation.y = -a; G.add(gate);
    [-1, 1].forEach((sd) => gate.add(new THREE.Mesh(box(0.14, 0.7, 0.14, 0, 0.35, sd * hw), concrete)));
    const gbar = new THREE.Mesh(box(0.06, 0.06, hw * 2, 0, 0.55, 0), redLamp); gate.add(gbar);
    wallObj = { G, panels, wire, towers, slots, base, cx, cz, a, px, pz, gate }; wallFor = r;
  }
  function setWall(hh, time) {   // hh: 0~1
    const W = wallObj; if (!W) return;
    W.G.visible = hh > 0.01;
    if (!W.G.visible) return;
    const ph = 0.3 + 1.7 * hh;
    W.slots.forEach((s, k) => {
      dm.position.set(W.cx + W.px * s, W.base[k], W.cz + W.pz * s); dm.rotation.set(0, -W.a, 0); dm.scale.set(1, ph, 1); dm.updateMatrix(); W.panels.setMatrixAt(k, dm.matrix);
      dm.position.y = W.base[k] + ph + 0.03; dm.scale.set(1, 1, 1); dm.updateMatrix(); W.wire.setMatrixAt(k, dm.matrix);
    });
    W.panels.instanceMatrix.needsUpdate = true; W.wire.instanceMatrix.needsUpdate = true;
    const ts = 0.55 + 0.75 * hh;
    W.towers.forEach((o, j) => { o.T.scale.set(1, ts, 1); o.bp.rotation.set(0.65, time * 0.5 + j * 2.5, 0, 'YXZ'); });
    W.gate.scale.set(1, 0.6 + hh, 1);
    redLamp.emissiveIntensity = 0.6 + 1.6 * (0.5 + 0.5 * Math.sin(time * 5));
  }

  // ---------- 사람(걷는 인물)·배·물결 자국 ----------
  const MAXP = narrow ? 360 : 900, PER = narrow ? 4 : 2;   // 인물 하나 = PER명
  const PS = narrow ? 0.9 : 0.6;   // 사람 크기
  const bodyG = mergeParts([
    { g: box(0.13, 0.46, 0.12, 0, 0.23, -0.075), color: '#7d7d7d', leg: 1 }, { g: box(0.13, 0.46, 0.12, 0, 0.23, 0.075), color: '#7d7d7d', leg: -1 },
    { g: box(0.2, 0.4, 0.3, 0, 0.66, 0), color: '#ffffff' },
    { g: box(0.09, 0.36, 0.08, 0, 0.66, -0.195), color: '#e6e6e6', arm: 1 }, { g: box(0.09, 0.36, 0.08, 0, 0.66, 0.195), color: '#e6e6e6', arm: -1 },
    { g: box(0.13, 0.28, 0.24, -0.16, 0.68, 0), color: '#8f8f8f' },
  ]);
  const gait = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 2), 2); gait.setUsage(THREE.DynamicDrawUsage); bodyG.setAttribute('aGait', gait);
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWalk = U.walk;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aLimb; attribute vec2 aGait; uniform float uWalk;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  float sw = sin(uWalk * 9.0 + aGait.x) * aGait.y;
  if (aLimb.x != 0.0) transformed.x += sw * aLimb.x * clamp((0.46 - position.y) / 0.46, 0.0, 1.0) * 0.2;
  if (aLimb.y != 0.0) transformed.x -= sw * aLimb.y * clamp((0.84 - position.y) / 0.36, 0.0, 1.0) * 0.16;`);
  };
  const bodies = new THREE.InstancedMesh(bodyG, bodyMat, MAXP), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.105, 10, 8).translate(0, 0.97, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), MAXP);
  const boatG = (() => { const s = new THREE.Shape(); s.moveTo(-0.45, -0.17); s.lineTo(0.22, -0.2); s.quadraticCurveTo(0.5, -0.1, 0.55, 0); s.quadraticCurveTo(0.5, 0.1, 0.22, 0.2); s.lineTo(-0.45, 0.17); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.06, 0); })();
  const boats = new THREE.InstancedMesh(boatG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), MAXP);
  const wakeTex = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const x = cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.85)'); x.strokeStyle = gr; x.lineWidth = 6; x.beginPath(); x.moveTo(0, 6); x.lineTo(124, 32); x.lineTo(0, 58); x.stroke(); const tx = new THREE.CanvasTexture(cv); return tx; })();
  const wakes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 0.75).rotateX(-Math.PI / 2).translate(-0.85, 0, 0), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: 0.8 }), MAXP);
  [bodies, heads, boats, wakes].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); });
  bodies.castShadow = PC; heads.castShadow = PC; boats.castShadow = PC; wakes.renderOrder = 3;
  const CLOTH = ['#33415c', '#5a4632', '#6b5d4c', '#2f5d50', '#7a3e3e', '#4b5563', '#8a6d3b', '#3f4f3a', '#5b4b6b'].map((h) => new THREE.Color(h)), C_BACK = new THREE.Color('#e3348a');
  const SKIN = ['#e0b48f', '#c99470', '#a8734f', '#8a5a3c', '#edc7a5'].map((h) => new THREE.Color(h)), BOAT = [new THREE.Color('#9a7448'), new THREE.Color('#e8834a'), new THREE.Color('#6f7f8f')];
  for (let k = 0; k < MAXP; k++) { heads.setColorAt(k, SKIN[(k * 7) % 5]); bodies.setColorAt(k, CLOTH[(k * 5) % 9]); boats.setColorAt(k, BOAT[k % 3]); gait.array[k * 2] = (k * 2.399) % 6.28; gait.array[k * 2 + 1] = 1; }

  // ---------- 화면 위 이름표·판 (HTML) ----------
  const labs = [];
  const mk = (cls, html) => { const d = document.createElement('div'); d.className = 'm3-lab ' + cls; d.innerHTML = html; wrap.appendChild(d); const o = { d, t: '' }; labs.push(o); return o; };
  const town = [mk('node', `<b>${tr('출발 지역')}</b>`), mk('node', `<b>${tr('도착 지역')}</b>`)];
  const townAt = [[-28, 2.4, -5.5], [29, 4.4, -6]];
  const chips = R.map(() => mk('chip', '<i></i><span></span>'));
  chips.forEach((o, i) => { o.d.querySelector('i').style.background = COL[i]; });
  const LU = [0.76, 0.76, 0.76, 0.72, 0.72, 0.7];
  const wallChip = mk('chip wall', '<i style="background:#dc2626"></i><span></span>');
  const board = document.createElement('div'); board.className = 'm3-board'; board.innerHTML = '<b></b><div class="l1"></div><div class="l2"></div><div class="l3"></div>'; wrap.appendChild(board);
  const bB = board.querySelector('b'), bl = [board.querySelector('.l1'), board.querySelector('.l2'), board.querySelector('.l3')];
  const setT = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
  const pv = new THREE.Vector3();
  function place(o, x, y, z, show) {
    if (!show) { if (o.d.style.display !== 'none') o.d.style.display = 'none'; return; }
    pv.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, sx = (pv.x + 1) / 2 * w, sy = (1 - pv.y) / 2 * h;
    const vis = pv.z < 1 && sx > -30 && sx < w + 30 && sy > 0 && sy < h + 10;
    o.d.style.display = vis ? '' : 'none';
    const cx = Math.min(w - 44, Math.max(44, sx));
    if (vis) o.d.style.transform = `translate(${cx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
  }

  // ---------- 매 프레임 ----------
  const phase = R.map((_, i) => i * 0.137), tmp = [0, 0, 0, 0, 0, 0], q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sv = new THREE.Vector3(), pp = new THREE.Vector3();
  function at(L, u, out) {
    const f = Math.max(0, Math.min(0.99999, u)) * (L.N - 1), i = f | 0, r = f - i;
    out[0] = L.X[i] + (L.X[i + 1] - L.X[i]) * r; out[1] = L.Y[i] + (L.Y[i + 1] - L.Y[i]) * r; out[2] = L.Z[i] + (L.Z[i + 1] - L.Z[i]) * r; out[3] = L.A[i]; out[4] = L.W[r < 0.5 ? i : i + 1]; out[5] = L.B[i];
    return out;
  }
  let wallH = 0, simRef = null, rotOn = false, clock = 0, armT = 0;
  const rot = $('mg-rotate');
  if (rot) rot.addEventListener('change', () => { rotOn = rot.value === 'on'; controls.autoRotate = rotOn; });
  controls.addEventListener('end', () => { setTimeout(() => { controls.autoRotate = rotOn; }, 4100); });

  function update(dt) {
    const st = window.MigState; if (!st || !st.sim) return;
    const sim = st.sim, t = sim.t, P = sim.params;
    if (sim !== simRef) { simRef = sim; wallH = sim.blocked ? P.strength / 100 : 0; }
    if (wallFor !== P.block) buildWall(P.block);
    const run = !(st.isPaused() || st.thumb) ? dt * (Number(($('speed') || {}).value || 3) / 3) : 0;
    clock += st.thumb ? 0 : dt; U.time.value = st.thumb ? 3.0 : clock; U.walk.value += run;
    const G = sim.costs(), F = t ? sim.flow[t - 1] : R.map(() => 0), back = t ? sim.back[t - 1] : 0;
    const want = sim.blocked ? Math.max(0.08, P.strength / 100) : 0;
    wallH += (want - wallH) * (st.thumb ? 1 : Math.min(1, dt * 2.5));
    setWall(wallH, clock);
    // 관문 차단기: 사람이 지나가도록 천천히 오르내림(보기용), 깃발 펄럭임
    armT += run; arms.forEach((g) => { g.rotation.x = -(0.5 + 0.5 * Math.sin(armT * 1.3)) * 1.3; });
    flags.forEach(({ g, base }) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 3) { const xx = base[i]; p[i + 2] = base[i + 2] + Math.sin(xx * 9 - clock * 5) * 0.05 * (xx / 0.55); } g.attributes.position.needsUpdate = true; });
    let n = 0, nb = 0;
    for (let i = 0; i < R.length; i++) {
      const L = LUT[i], lap = 2 * (4 + G[i] / 9);   // 부담이 클수록 천천히(보기용)
      phase[i] = (phase[i] + run / lap) % 1;
      const np = Math.min(Math.round(F[i] / PER), MAXP - n), nback = i === P.block && sim.blockedAt[t - 1] ? Math.min(np, Math.round(back / PER)) : 0;
      for (let k = 0; k < np; k++) {
        const ph = (phase[i] + (k + 0.5) / np + (k % 3) * 0.004) % 1; let u = ph, isBack = false;
        if (k < nback) { const uw = L.wallU; u = ph < 0.5 ? ph * 2 * uw : (1 - ph) * 2 * uw; isBack = ph >= 0.5; }
        at(L, u, tmp);
        const off = ((k * 37) % 7 - 3) * ROADW[i] * 0.09, a = tmp[3], onBoat = tmp[4] && !BRIDGED[i];
        const x = tmp[0] - Math.sin(a) * off, z = tmp[2] + Math.cos(a) * off;
        q.setFromAxisAngle(up, -a + (isBack ? Math.PI : 0));
        const bob = onBoat ? Math.sin(clock * 2.2 + k) * 0.025 : Math.abs(Math.sin(U.walk.value * 9 + k * 2.399)) * 0.025 * (run > 0 ? 1 : 0);
        if (onBoat) {
          pp.set(x, WL + 0.03 + bob, z); sv.set(PS * 1.25, PS * 1.25, PS * 1.25); m4.compose(pp, q, sv); boats.setMatrixAt(nb, m4); wakes.setMatrixAt(nb, m4); nb++;
          pp.set(x, WL + 0.03 + bob, z); sv.set(PS, PS * 0.72, PS);
        } else { pp.set(x, tmp[1] - 0.02 + bob, z); sv.set(PS, PS, PS); }
        m4.compose(pp, q, sv); bodies.setMatrixAt(n, m4); heads.setMatrixAt(n, m4);
        bodies.setColorAt(n, isBack ? C_BACK : CLOTH[(k * 5 + i) % 9]);
        gait.array[n * 2 + 1] = onBoat ? 0 : 1;
        n++;
      }
      const name = R[i].ko, F0 = Math.round(F[i]);
      const txt = tr(narrow ? `${name} ${F0}명` : `${name} · 위험 ${R[i].risk}% · ${F0}명`);
      if (chips[i].t !== txt) { chips[i].t = txt; chips[i].d.querySelector('span').textContent = txt; }
    }
    bodies.count = heads.count = n; boats.count = wakes.count = nb;
    [bodies, heads, boats, wakes].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true; gait.needsUpdate = true;
    // 이름표·판
    const show = !st.thumb;
    town.forEach((o, j) => place(o, ...townAt[j], show));
    chips.forEach((o, i) => { const p = at(LUT[i], LU[i], tmp); place(o, p[0], p[1] + (narrow ? 0.9 : 0.7), p[2], show); });
    if (wallObj && wallH > 0.05) {
      const wt = tr(`벽 · 막는 세기 ${P.strength}%`); if (wallChip.t !== wt) { wallChip.t = wt; wallChip.d.querySelector('span').textContent = wt; }
      const tw = wallObj.towers[0], wy = tw.T.position.y + 3.0 * tw.T.scale.y; place(wallChip, tw.T.position.x, wy, tw.T.position.z, show);
    } else place(wallChip, 0, 0, 0, false);
    board.style.display = show ? '' : 'none';
    if (show) {
      setT(bB, tr(`${t}개월째`));
      const tot = F.reduce((x, y) => x + y, 0);
      setT(bl[0], t ? tr(`지난달 길을 나선 사람 ${Math.round(tot)}명`) : tr('아직 아무도 떠나지 않았어요'));
      setT(bl[1], t ? tr(`도착 ${sim.arr[t - 1]}명 · 사고 ${sim.acc[t - 1]}명`) : '');
      setT(bl[2], t && sim.blockedAt[t - 1] ? tr(`벽에서 되돌려 보냄 ${back}명`) : '');
    }
  }
  v.onFrame((dt) => update(dt));

  function home() {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 375, asp = w / h;
    if (st0.thumb) { camera.position.set(4, 25, 30); controls.target.set(0, 0, 1.5); }
    else if (asp < 1.2) { camera.position.set(3, 47, 39); controls.target.set(0, 0, -5); }
    else { camera.position.set(5, 23, 39); controls.target.set(0, 0, -5); }
    controls.update();
  }
  home();
  update(0.016);
  if (st0.thumb) {
    controls.autoRotate = false;
    const shot = () => { update(0.016); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Mig3D = { v, update, stats: () => ({ people: bodies.count, boats: boats.count, cap: MAXP, wall: +wallH.toFixed(2), wallFor, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }) };
}

// 캔버스를 감싸 이름표·판을 겹쳐 올릴 자리를 만든다(create3D보다 먼저: 크기 감시가 부모를 본다)
let wrap = null;
if (canvas && st0) {
  const css = document.createElement('style');
  css.textContent = `
.m3-wrap{position:relative;overflow:hidden;border-radius:14px}
.m3-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 12px/1.25 ${FONT};color:#1f2937;background:rgba(255,255,255,.93);border:1px solid #d5dae1;border-radius:9px;padding:3px 8px;box-shadow:0 1px 4px rgba(15,23,42,.16);will-change:transform}
.m3-lab.node{padding:3px 10px;font-size:12.5px}
.m3-lab.chip{display:flex;align-items:center;gap:5px;font-size:11.5px;padding:2px 8px}
.m3-lab.chip i{display:inline-block;width:9px;height:9px;border-radius:50%}
.m3-lab.wall{border-color:#f3b4b4;color:#991b1b}
.m3-board{position:absolute;left:10px;top:10px;pointer-events:none;font:500 11.5px/1.4 ${FONT};color:#374151;background:rgba(255,255,255,.9);border:1px solid #d5dae1;border-radius:11px;padding:6px 10px;box-shadow:0 1px 5px rgba(15,23,42,.14);min-width:150px}
.m3-board b{display:block;font-size:15px;font-weight:800;color:#111827}
.m3-board .l3{color:#be185d;font-weight:600}.m3-board div:empty{display:none}
@media (max-width:640px){.m3-lab{font-size:10.5px;padding:2px 6px}.m3-lab.chip{font-size:10px;padding:1px 6px;gap:4px}.m3-lab.chip i{width:7px;height:7px}.m3-lab.node{font-size:11px}.m3-board{left:6px;top:6px;padding:4px 7px;font-size:10px;min-width:0;border-radius:9px}.m3-board b{font-size:12.5px}.m3-board .l1{display:none}}
`;
  document.head.appendChild(css);
  wrap = document.createElement('div'); wrap.className = 'm3-wrap';
  canvas.parentNode.insertBefore(wrap, canvas); wrap.appendChild(canvas);
  canvas.setAttribute('aria-label', '3D landscape of six routes across an imaginary land, with walking people, bridges, a checkpoint and a wall');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1.08';
  const v = create3D(canvas, { camera: [6, 23, 37], target: [0, 0, 0.5], background: '#d9e6ee', autoRotate: false, autoRotateSpeed: 0.35, minDistance: 8, maxDistance: 120, fov: 42, far: 3000 });
  if (v) init(v, narrow);
}
