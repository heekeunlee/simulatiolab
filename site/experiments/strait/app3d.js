// ① 가상 지구본 위 바닷길 (3D): app.js가 window.StraitState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 지구본: 땅 높낮이(산·눈·해변)와 바다(얕은 곳 청록·깊은 곳 남색·잔물결·해안 파도)를 코드로 만든 가상의 배치(실제 대륙 아님).
//   해협 = 땅 덩어리 사이의 좁은 물길. 대기 테두리 빛, 옅은 구름층(보기용 장식).
// - 항구 = 작은 항만 도시(빌딩·크레인·컨테이너·방파제·등대). 기둥: 높이 = 수입 물가 지수 − 100, 색 = 막힌 길목을 쓰던 나라/안 쓰던 나라.
// - 바닷길: 물 위의 옅은 띠, 색 = 짐 ÷ 용량(파랑 → 빨강). 배: 지금 그 길에 실린 짐에 비례한 척수가 대권 곡선을 따라 항해(물결 자국).
//   걸리는 일수가 길수록 느리게 간다. 배 한 척 한 척은 보기용 표시이고 화물 하나하나의 계산이 아니다.
// - 막힌 길목: 빨간 부표 줄 + 경고등 + 퍼지는 빨간 물결. 길목 앞 줄(sim.Q)에 비례한 수의 배가 닻을 내리고 기다린다(배 밑 빨간 고리).
// - 낮/밤(st-time): 밤에는 도시 불빛·창·배 항해등·등대만 빛난다. 재생이 도달한 상태만 그린다(미리 보기 없음).
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.StraitState;
const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const R = 10, D2R = Math.PI / 180;

// ---------- 작은 수학 도구 ----------
const dirOf = (lat, lon, out = new THREE.Vector3()) => out.set(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, yi, zi), b = hash3(xi + 1, yi, zi), c = hash3(xi, yi + 1, zi), d = hash3(xi + 1, yi + 1, zi);
  const e = hash3(xi, yi, zi + 1), f = hash3(xi + 1, yi, zi + 1), g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return (y1 + (y2 - y1) * w) * 2 - 1;
}
function fbm(x, y, z, f, oct) { let s = 0, a = 0.5; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 7.1, y * f + i * 3.3, z * f + i * 5.7); f *= 2.03; a *= 0.5; } return s; }
function ridged(x, y, z, f, oct) { let s = 0, a = 0.5; for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise(x * f + 1.7 + i, y * f + 9.2, z * f + 4.1)); s += a * n * n; f *= 2.1; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- 모양 합치기(꼭짓점 색) ----------
function part(geo, rgb, m) { const g = geo.index ? geo.toNonIndexed() : geo; if (m) g.applyMatrix4(m); return { g, rgb }; }
function merge(parts) {
  let n = 0; parts.forEach((p) => { n += p.g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  parts.forEach((p) => {
    const c = p.g.attributes.position.count;
    pos.set(p.g.attributes.position.array, o * 3); nor.set(p.g.attributes.normal.array, o * 3);
    for (let k = 0; k < c; k++) col.set(p.rgb, (o + k) * 3);
    o += c;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const MT = (x, y, z, ry, rx) => { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, 0)); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); return m; };
const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };   // sRGB 색 → 선형 값(꼭짓점 색용)
const bx = (w, h, d, x, y, z, hex, ry) => part(new THREE.BoxGeometry(w, h, d), lin(hex), MT(x, y, z, ry));
const cy = (r0, r1, h, x, y, z, hex, seg) => part(new THREE.CylinderGeometry(r0, r1, h, seg || 10), lin(hex), MT(x, y, z));

// 배(앞 = +z, 위 = +y, 길이 1 기준): 선체(뱃머리가 좁아짐) + 컨테이너 줄 + 흰 선교 + 굴뚝
function shipGeometry() {
  const hull = new THREE.BoxGeometry(0.2, 0.09, 1, 1, 1, 2), p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); if (z > 0.4) p.setX(i, p.getX(i) * 0.12); if (y < 0) p.setX(i, p.getX(i) * 0.82); }
  hull.computeVertexNormals();
  const parts = [part(hull, lin('#8a2b22'), MT(0, 0.01, 0)), bx(0.205, 0.022, 0.86, 0, 0.065, -0.04, '#1f2937')];
  const CC = ['#e8890c', '#2f6fed', '#0f9d8a', '#c0392b', '#94a3b8', '#f2c14e'];
  for (let k = 0; k < 6; k++) parts.push(bx(0.17, 0.07 + (k % 2) * 0.02, 0.095, 0, 0.11 + (k % 2) * 0.01, 0.3 - k * 0.105, CC[k]));
  parts.push(bx(0.18, 0.13, 0.09, 0, 0.14, -0.39, '#f8fafc'), bx(0.2, 0.02, 0.05, 0, 0.21, -0.39, '#334155'), bx(0.05, 0.08, 0.04, 0, 0.2, -0.46, '#c0392b'));
  return merge(parts);
}

if (canvas && st0) {
  const css = document.createElement('style');
  css.textContent = `
.st3-wrap{position:relative;overflow:hidden;border-radius:14px;max-width:760px;margin:0 auto}
.st3-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 11.5px/1.25 ${FONT};color:#1f2937;background:rgba(255,255,255,.93);border:1px solid #d5dae1;border-radius:9px;padding:2px 7px;box-shadow:0 1px 4px rgba(15,23,42,.16);display:flex;align-items:center;gap:5px;will-change:transform}
.st3-lab i{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none}
.st3-lab b{font-size:12.5px;font-weight:800}
.st3-lab.port .n{font-weight:500;color:#4b5563;font-size:10.5px}
.st3-lab.blk{background:#d62828;border-color:#b91c1c;color:#fff}.st3-lab.blk i{background:#fff!important}
.st3-when{position:absolute;left:10px;top:10px;pointer-events:none;font:700 12px/1.3 ${FONT};color:#1f2937;background:rgba(255,255,255,.9);border:1px solid #d5dae1;border-radius:9px;padding:4px 9px;box-shadow:0 1px 4px rgba(15,23,42,.14);max-width:70%}
.st3-night .st3-lab,.st3-night .st3-when{background:rgba(18,25,40,.9);border-color:#3a4458;color:#e5e7eb}.st3-night .st3-lab.port .n{color:#9aa5b8}
.st3-night .st3-lab.blk{background:#c81e1e;color:#fff}
@media (max-width:640px){.st3-lab{font-size:10.5px;padding:1px 6px}.st3-lab b{font-size:11.5px}.st3-lab.port .n{display:none}.st3-when{font-size:11px;left:6px;top:6px;padding:3px 7px}}
`;
  document.head.appendChild(css);
  const wrap = document.createElement('div'); wrap.className = 'st3-wrap';
  canvas.parentNode.insertBefore(wrap, canvas); wrap.appendChild(canvas);
  canvas.setAttribute('aria-label', 'A 3D imaginary globe with port cities, ships on sea routes, a blocked strait and import price beacons');
  const phone = (wrap.parentElement.clientWidth || 999) < 640;
  if (phone) canvas.style.aspectRatio = '1 / 1.08';
  const v = create3D(canvas, { camera: [20, 14, 4], target: [0, 0, 0], background: '#dbe9f6', autoRotateSpeed: 0.3, minDistance: 12.5, maxDistance: 70, fov: 40, far: 1200 });
  if (v) init(v, phone, wrap);
}

function init(v, phone, wrap) {
  const t0 = performance.now();
  const { scene, camera, controls, renderer } = v;
  const SM = window.Strait, PORTS = SM.PORTS, SEAS = SM.SEAS, ROUTES = SM.ROUTES, NP = PORTS.length;
  const sim0 = window.StraitState.sim, E = sim0.E;
  const thumb = !!st0.thumb;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  const SHADOW = !phone;
  const lights = scene.children.filter((o) => o.isLight);
  const hemi = lights.find((o) => o.isHemisphereLight), sun = lights.find((o) => o.isDirectionalLight);
  hemi.color.set(0xeaf3ff); hemi.groundColor.set(0x51607a); hemi.intensity = 0.9;
  sun.color.set(0xfff4e2); sun.intensity = 2.3;
  if (SHADOW) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 10; sc.far = 60;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.015;
  }

  // ---------- 하늘(배경 그라데이션)·별 ----------
  function gradTex(stops) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); stops.forEach(([p, col]) => g.addColorStop(p, col)); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const SKY = { day: gradTex([[0, '#8fb9e6'], [0.55, '#d3e5f5'], [1, '#f4f7fb']]), night: gradTex([[0, '#02050d'], [0.6, '#08122a'], [1, '#111d3a']]) };
  scene.background = SKY.day;
  const starG = new THREE.BufferGeometry(), sp = new Float32Array(1600 * 3);
  for (let i = 0; i < 1600; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); sp.set([s * Math.cos(a) * 600, u * 600, s * Math.sin(a) * 600], i * 3); }
  starG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xdfe8ff, size: phone ? 1.6 : 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  stars.visible = false; scene.add(stars);
  scene.fog = new THREE.Fog(0xcfe0f2, 30, 80);

  // ---------- 그래프 좌표와 바닷길 ----------
  const nodeDir = (i) => (i < NP ? dirOf(PORTS[i].lat, PORTS[i].lon) : dirOf(SEAS[i - NP].hub[0], SEAS[i - NP].hub[1]));
  function slerpPath(dirs, N) {
    const lens = []; let tot = 0;
    for (let i = 1; i < dirs.length; i++) { const a = dirs[i - 1].angleTo(dirs[i]); lens.push(a); tot += a; }
    const out = [];
    for (let k = 0; k < N; k++) {
      let s = (k / (N - 1)) * tot, j = 0; while (j < lens.length - 1 && s > lens[j]) { s -= lens[j]; j++; }
      const a = dirs[j], b = dirs[j + 1], th = lens[j], f = th > 1e-6 ? s / th : 0;
      out.push(new THREE.Vector3().copy(a).multiplyScalar(Math.sin((1 - f) * th)).addScaledVector(b, Math.sin(f * th)).divideScalar(Math.sin(th) || 1).normalize());
    }
    return { pts: out, len: tot };
  }
  const edges = E.map((e, k) => {
    const isRoute = e.route >= 0, r = isRoute ? ROUTES[e.route] : null;
    const dirs = [nodeDir(e.u)].concat(r ? r.via.map(([la, lo]) => dirOf(la, lo)) : [], [nodeDir(e.v)]);
    const N = isRoute ? 160 : 40, { pts, len } = slerpPath(dirs, N);
    // 진행 방향(접선)과 오른쪽
    const tan = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)]; return b.clone().sub(a).addScaledVector(p, -b.clone().sub(a).dot(p)).normalize(); });
    const side = pts.map((p, i) => new THREE.Vector3().crossVectors(tan[i], p).normalize());
    return { k, e, isRoute, ri: e.route, pts, tan, side, N, len };
  });

  // ---------- 땅 모양 (가상의 배치) ----------
  // 둥근 땅 덩어리 몇 개 + 잡음 해안선. 항구 뒤쪽엔 작은 항만 땅을 붙이고, 배가 다니는 물길은 항상 바다로 남긴다.
  const LAND = [[34, 0, 17], [-12, 0, 19], [14, 120, 12], [-28, 120, 15], [14, -120, 12], [-28, -120, 15], [42, 180, 11], [46, 98, 10], [46, -98, 10], [-50, 40, 12], [-50, -40, 12], [-84, 0, 13], [-58, 180, 8]];
  const caps = LAND.map(([la, lo, r]) => [dirOf(la, lo), r * D2R]);
  const portF = PORTS.map((p, i) => {   // 항구의 지역 좌표: n 위, t 바다 가운데(허브) 쪽, b 옆
    const n = nodeDir(i), hub = nodeDir(NP + p.sea), t = hub.clone().addScaledVector(n, -hub.dot(n)).normalize(), b = new THREE.Vector3().crossVectors(t, n).normalize();
    return { n, t, b };
  });
  const cityCaps = portF.map(({ n, t }) => [n.clone().multiplyScalar(Math.cos(6.5 * D2R)).addScaledVector(t, -Math.sin(6.5 * D2R)).normalize(), 6.2 * D2R]);
  const lane = []; // 물길 표본: [x, y, z, 반폭(라디안)]
  edges.forEach((ed) => { const step = Math.max(1, Math.round((ed.N - 1) / (ed.len / (1.1 * D2R)))); for (let i = 0; i < ed.N; i += step) lane.push([ed.pts[i].x, ed.pts[i].y, ed.pts[i].z, (ed.isRoute ? 2.1 : 1.15) * D2R]); });
  const portDirs = portF.map((f) => f.n);
  function terrain(x, y, z) {
    let best = -9;
    for (const [c, r] of caps) { const d = Math.max(-1, Math.min(1, c.x * x + c.y * y + c.z * z)); best = Math.max(best, 1 - Math.acos(d) / r); }
    for (const [c, r] of cityCaps) { const d = Math.max(-1, Math.min(1, c.x * x + c.y * y + c.z * z)); best = Math.max(best, 0.45 * (1 - Math.acos(d) / r)); }
    let e = best + 0.85 * fbm(x + 0.35 * fbm(x, y, z, 3.1, 2), y, z, 1.9, 5) + 0.12 * fbm(x, y, z, 11, 3);
    let md = -2, w = 0;
    for (let i = 0; i < lane.length; i++) { const L = lane[i], d = L[0] * x + L[1] * y + L[2] * z; if (d > md) { md = d; w = L[3]; } }
    const a = Math.acos(Math.min(1, md));
    e = Math.min(e, -0.1 + (a - w) * (0.6 / w));
    // 높이: 산줄기(ridged) × 땅 안쪽 정도, 항구 근처는 평평
    let h = 0;
    if (e > 0) {
      const rg = ridged(x, y, z, 4.2, 4);
      h = 0.012 + 0.07 * smooth(0, 0.5, e) + 0.5 * smooth(0.12, 0.95, e) * Math.pow(rg, 2.4);
      let flat = 0; for (const pd of portDirs) { const d = pd.x * x + pd.y * y + pd.z * z; flat = Math.max(flat, smooth(Math.cos(10 * D2R), Math.cos(4 * D2R), d)); }
      h = h + (0.022 - h) * flat;
    }
    return [e, h];
  }

  // ---------- 지구본 (땅 + 바다를 한 껍질로) ----------
  const SW = phone ? 288 : 448, SH = phone ? 144 : 224;
  const gGeo = new THREE.SphereGeometry(1, SW, SH), gp = gGeo.attributes.position, nv = gp.count;
  const aE = new Float32Array(nv), aH = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i), [e, h] = terrain(x, y, z);
    aE[i] = e; aH[i] = h; const s = R + h; gp.setXYZ(i, x * s, y * s, z * s);
  }
  gGeo.setAttribute('aElev', new THREE.BufferAttribute(aE, 1)); gGeo.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  gGeo.computeVertexNormals();
  { // 이음매(경도 180°)의 법선을 맞추고, 바다는 곧은 법선
    const nr = gGeo.attributes.normal;
    for (let r = 0; r <= SH; r++) { const a = r * (SW + 1), b = a + SW; const x = (nr.getX(a) + nr.getX(b)) / 2, y = (nr.getY(a) + nr.getY(b)) / 2, z = (nr.getZ(a) + nr.getZ(b)) / 2; nr.setXYZ(a, x, y, z); nr.setXYZ(b, x, y, z); }
    for (let i = 0; i < nv; i++) if (aE[i] < -0.02) { const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i), l = Math.hypot(x, y, z); nr.setXYZ(i, x / l, y / l, z / l); }
    nr.needsUpdate = true;
  }
  const U = { uTime: { value: 0 }, uNight: { value: 0 }, uPorts: { value: portDirs } };
  const NOISE_GLSL = `
    float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
    float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }`;
  const gMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  gMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aElev;\nattribute float aH;\nvarying float vElev;\nvarying float vH;\nvarying vec3 vObj;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vElev = aElev; vH = aH; vObj = position;');
    sh.fragmentShader = `uniform float uTime;\nuniform float uNight;\nuniform vec3 uPorts[${NP}];\nvarying float vElev;\nvarying float vH;\nvarying vec3 vObj;\n${NOISE_GLSL}\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 N0 = normalize(vObj);
  float n1 = vn(N0 * 34.0), n2 = vn(N0 * 140.0), n3 = vn(N0 * 9.0);
  float e = vElev, hh = vH;
  float isLand = smoothstep(-0.003, 0.003, e);
  vec3 sea = mix(vec3(0.03, 0.17, 0.38), vec3(0.06, 0.30, 0.52), smoothstep(-1.6, -0.5, e));
  sea = mix(sea, vec3(0.16, 0.58, 0.66), smoothstep(-0.36, -0.02, e));
  float lat = abs(N0.y);
  vec3 grass = mix(vec3(0.30, 0.52, 0.22), vec3(0.20, 0.40, 0.17), n1);
  vec3 dry = mix(vec3(0.70, 0.62, 0.40), vec3(0.62, 0.55, 0.36), n2);
  vec3 land = mix(grass, dry, smoothstep(0.45, 0.75, n3 + (1.0 - smoothstep(0.1, 0.45, lat)) * 0.25));
  land = mix(land, vec3(0.47, 0.42, 0.36), smoothstep(0.07, 0.17, hh + n1 * 0.03));
  land = mix(land, vec3(0.96, 0.97, 0.99), smoothstep(0.22, 0.27, hh + n2 * 0.025));
  land = mix(land, vec3(0.94, 0.96, 0.99), smoothstep(0.83, 0.9, lat + n1 * 0.04));
  land = mix(vec3(0.90, 0.83, 0.62), land, smoothstep(0.012, 0.05, e + n2 * 0.015));
  vec3 col = mix(sea, land, isLand);
  col = mix(col, vec3(0.86, 0.92, 0.97), smoothstep(0.962, 0.985, lat + n1 * 0.02) * (1.0 - isLand));
  float foam = (1.0 - isLand) * smoothstep(-0.07, -0.004, e) * (0.5 + 0.5 * sin(uTime * 1.7 + n1 * 14.0 + e * 120.0));
  col = mix(col, vec3(0.94, 0.97, 1.0), foam * 0.6);
  col *= 0.9 + 0.2 * n2 * isLand;
  diffuseColor.rgb = pow(col, vec3(2.2));`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.2, 0.92, isLand);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (isLand < 0.5) { vec3 q = vObj * 4.0; float t = uTime * 0.35;
    vec3 rp = vec3(vn(q + vec3(t, 0.0, 0.0)), vn(q * 1.1 + vec3(5.2, t, 1.3)), vn(q * 0.9 + vec3(2.1, 7.7, t))) - 0.5;
    rp += 0.5 * (vec3(vn(q * 3.1 - vec3(t, 0.0, 0.0)), vn(q * 2.9 + vec3(1.0, -t, 4.0)), vn(q * 3.3 + vec3(9.0, 2.0, -t))) - 0.5);
    normal = normalize(normal + mat3(viewMatrix) * rp * 0.16); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (uNight > 0.0) { float cl = 0.0;
    for (int i = 0; i < ${NP}; i++) { float d = 1.0 - dot(N0, uPorts[i]); cl += smoothstep(0.016, 0.0, d); }
    float speck = smoothstep(0.5, 0.8, vn(N0 * 300.0));
    float towns = smoothstep(0.78, 0.9, vn(N0 * 60.0)) * (1.0 - smoothstep(0.08, 0.3, e)) * (1.0 - smoothstep(0.75, 0.85, lat));
    totalEmissiveRadiance += uNight * isLand * vec3(1.0, 0.7, 0.32) * (min(cl, 1.0) * (0.15 + 1.1 * speck) + towns * speck * 0.9); }`);
  };
  gMat.customProgramCacheKey = () => 'st3-globe';
  const globe = new THREE.Mesh(gGeo, gMat); globe.receiveShadow = SHADOW; scene.add(globe);
  const T = (x, y, z) => terrain(x, y, z);   // 놓을 자리 높이 묻기

  // ---------- 대기(테두리 빛) ----------
  const ATM = { day: new THREE.Color(0x8fc3ff), night: new THREE.Color(0x3c6fd8) };
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uC: { value: ATM.day.clone() }, uK: { value: 1 } }, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uK; varying vec3 vN; varying vec3 vV; void main(){ float d = -dot(vN, vV); float a = smoothstep(0.0, 0.5, d); a = pow(a, 1.6) * 0.85 * uK; gl_FragColor = vec4(uC, a); }',
  }));
  scene.add(halo);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uC: { value: ATM.day.clone() }, uK: { value: 1 } }, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uK; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - max(0.0, dot(vN, vV)); gl_FragColor = vec4(uC, pow(f, 3.2) * 0.75 * uK); }',
  }));
  scene.add(rim);

  // ---------- 구름층 (보기용 장식) ----------
  const clouds = (() => {
    const W = phone ? 512 : 768, H = W / 2, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for (let py = 0; py < H; py++) {
      const th = Math.PI * (py + 0.5) / H, sy = Math.cos(th), sr = Math.sin(th);
      for (let px = 0; px < W; px++) {
        const ph = 2 * Math.PI * (px + 0.5) / W, nx = -Math.cos(ph) * sr, nz = Math.sin(ph) * sr;
        const f = fbm(nx * 1.0 + 3, sy * 2.2, nz * 1.0, 2.2, 5) + 0.12 * fbm(nx, sy, nz, 9, 2);
        const a = smooth(0.12, 0.42, f) * (1 - 0.6 * smooth(0.85, 1, Math.abs(sy)));
        const o = (py * W + px) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(a * 255);
      }
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(R + 0.55, 96, 64), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.55, roughness: 1, color: 0xffffff }));
    scene.add(m); return m;
  })();

  // ---------- 지역 좌표에 물건 놓기 ----------
  const M4 = new THREE.Matrix4(), P3 = new THREE.Vector3(), Q4 = new THREE.Quaternion(), S3 = new THREE.Vector3(), Xa = new THREE.Vector3(), Ya = new THREE.Vector3(), Za = new THREE.Vector3();
  const tmpC = new THREE.Color(), RM = new THREE.Matrix4();
  // f: {n,t,b}, (x, z) = 옆·앞 거리(월드 단위), ry = 지역 회전, lift = 땅 위 높이. 반환: 땅 높이 정보
  function local(f, x, z, ry, sx, sy, sz, lift, out) {
    P3.copy(f.n).multiplyScalar(R).addScaledVector(f.b, x).addScaledVector(f.t, z).normalize();
    const [e, h] = T(P3.x, P3.y, P3.z);
    Ya.copy(P3); Za.copy(f.t).addScaledVector(Ya, -f.t.dot(Ya)).normalize(); Xa.crossVectors(Ya, Za);
    if (ry) { const c = Math.cos(ry), s = Math.sin(ry); const zx = Za.x * c + Xa.x * s, zy = Za.y * c + Xa.y * s, zz = Za.z * c + Xa.z * s; Xa.set(Xa.x * c - Za.x * s, Xa.y * c - Za.y * s, Xa.z * c - Za.z * s); Za.set(zx, zy, zz); }
    RM.makeBasis(Xa, Ya, Za); Q4.setFromRotationMatrix(RM);
    const pos = P3.clone().multiplyScalar(R + Math.max(0, h) + (lift || 0));
    out.compose(pos, Q4, S3.set(sx, sy, sz));
    return [e, h, pos];
  }
  const shadowy = (m) => { m.castShadow = SHADOW; m.receiveShadow = SHADOW; return m; };

  // ---------- 항만 도시 ----------
  function facadeTex(lit) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = lit ? '#000' : '#ffffff'; x.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 12; r++) for (let k = 0; k < 4; k++) {
      const on = hash3(r, k, 3) > 0.42;
      x.fillStyle = lit ? (on ? (hash3(r, k, 9) > 0.5 ? '#ffd27a' : '#ffe8b0') : '#000') : '#8aa3bd';
      x.fillRect(5 + k * 15, 6 + r * 10, 9, 6);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const bSide = new THREE.MeshStandardMaterial({ map: facadeTex(false), emissiveMap: facadeTex(true), emissive: 0x000000, roughness: 0.55, metalness: 0.1 });
  const bRoof = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.85 });
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const PER_B = phone ? 30 : 64, PER_C = phone ? 14 : 30;
  const bld = shadowy(new THREE.InstancedMesh(bGeo, [bSide, bSide, bRoof, bRoof, bSide, bSide], NP * PER_B));
  const cGeo = new THREE.BoxGeometry(1, 1, 1); cGeo.translate(0, 0.5, 0);
  const cont = shadowy(new THREE.InstancedMesh(cGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), NP * PER_C));
  const concrete = shadowy(new THREE.InstancedMesh(cGeo, new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.9 }), NP * 9));
  const craneGeo = merge([
    bx(0.022, 0.26, 0.022, -0.04, 0.13, -0.03, '#d9480f'), bx(0.022, 0.26, 0.022, 0.04, 0.13, -0.03, '#d9480f'),
    bx(0.022, 0.26, 0.022, -0.04, 0.13, 0.05, '#d9480f'), bx(0.022, 0.26, 0.022, 0.04, 0.13, 0.05, '#d9480f'),
    bx(0.045, 0.025, 0.44, 0, 0.27, 0.13, '#e8590c'), bx(0.06, 0.045, 0.06, 0, 0.3, -0.04, '#f1f3f5'), bx(0.04, 0.03, 0.04, 0, 0.245, 0.27, '#343a40'), bx(0.006, 0.06, 0.006, 0, 0.225, 0.27, '#343a40'),
  ]);
  const cranes = shadowy(new THREE.InstancedMesh(craneGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), NP * 3));
  const lhGeo = merge([cy(0.03, 0.04, 0.14, 0, 0.07, 0, '#ffffff', 12), cy(0.031, 0.031, 0.03, 0, 0.1, 0, '#d62828', 12), cy(0.022, 0.022, 0.04, 0, 0.16, 0, '#fff5d6', 12), cy(0.03, 0.0, 0.03, 0, 0.195, 0, '#d62828', 12)]);
  const lhouse = shadowy(new THREE.InstancedMesh(lhGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), NP));
  const CONT_COL = ['#e8890c', '#2f6fed', '#0f9d8a', '#c0392b', '#7c4dff', '#f2c14e', '#94a3b8', '#1f6f50'];
  const cityInfo = [];
  let nb = 0, nc = 0, nq = 0;
  portF.forEach((f, i) => {
    // 바닷가 찾기: 항구에서 육지 쪽(-t)으로
    let dc = 0.1; for (; dc < 2.2; dc += 0.03) { P3.copy(f.n).multiplyScalar(R).addScaledVector(f.t, -dc).normalize(); if (T(P3.x, P3.y, P3.z)[0] > 0.004) break; }
    const zq = -dc - 0.02, rnd = THREE.MathUtils.seededRandom; THREE.MathUtils.seededRandom(1000 + i);
    // 부두(긴 콘크리트) + 방파제
    local(f, 0, zq + 0.03, 0, 1.0, 0.03, 0.16, -0.012, M4); concrete.setMatrixAt(nq++, M4);
    const arc = []; for (let k = 0; k < 7; k++) { const a = (12 + k * 7) * D2R; arc.push([0.62 * Math.cos(a), zq + 0.62 * Math.sin(a)]); }
    for (let k = 0; k < 6; k++) { const [x0, z0] = arc[k], [x1, z1] = arc[k + 1], L = Math.hypot(x1 - x0, z1 - z0); local(f, (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), 0.045, 0.035, L + 0.01, -0.02, M4); concrete.setMatrixAt(nq++, M4); }
    const end = arc[6]; local(f, end[0], end[1], 0, 1, 1, 1, -0.005, M4); lhouse.setMatrixAt(i, M4);
    for (let k = 0; k < 3; k++) { local(f, -0.3 + k * 0.3, zq + 0.02, 0, 1, 1, 1, 0, M4); cranes.setMatrixAt(i * 3 + k, M4); }
    // 컨테이너 마당
    for (let k = 0; k < PER_C; k++) {
      const col = k % 10, row = (k / 10) | 0, x = -0.45 + col * 0.1, z = zq - 0.1 - row * 0.065;
      const lev = 1 + ((hash3(i, k, 1) * 3) | 0);
      local(f, x, z, 0, 0.075, 0.032 * lev, 0.05, -0.004, M4); cont.setMatrixAt(nc, M4); cont.setColorAt(nc++, tmpC.set(CONT_COL[(hash3(i, k, 2) * 8) | 0]));
    }
    // 빌딩: 부두 뒤 바둑판 거리(길은 비움), 가운데가 높은 빌딩, 가장자리는 낮은 집
    const cz = zq - 0.78, G = 0.1, BCOL = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#f5e6c8', '#e7d3c0'], GLASS = ['#a9c8ea', '#bcd4ee', '#8fb3dc'];
    const cells = [];
    for (let gx = -7; gx <= 7; gx++) for (let gz = 0; gz < 11; gz++) {
      if (gx % 4 === 0 || gz % 4 === 3) continue;   // 거리
      const x = gx * G + (rnd() - 0.5) * 0.012, z = zq - 0.3 - gz * G;
      const dd = Math.hypot(x / 0.7, (z - cz) / 0.5) + (rnd() - 0.5) * 0.25;
      if (dd > 1) continue;
      P3.copy(f.n).multiplyScalar(R).addScaledVector(f.b, x).addScaledVector(f.t, z).normalize();
      if (T(P3.x, P3.y, P3.z)[0] < 0.03) continue;
      cells.push([dd, x, z]);
    }
    cells.sort((a, b) => a[0] - b[0]);
    for (const [dd, x, z] of cells.slice(0, PER_B)) {
      const core = dd < 0.45, tall = core ? 0.18 + 0.45 * (1 - dd / 0.45) * (0.4 + 0.6 * rnd()) : 0.035 + 0.09 * rnd() * (1 - dd);
      const w = core ? 0.05 + rnd() * 0.025 : 0.06 + rnd() * 0.02;
      local(f, x, z, 0, w, tall, w * (0.85 + rnd() * 0.3), -0.006, M4); bld.setMatrixAt(nb, M4);
      bld.setColorAt(nb++, tmpC.set(core && rnd() < 0.65 ? GLASS[(rnd() * 3) | 0] : BCOL[(rnd() * 5) | 0]));
    }
    // 기둥 자리(도시 가운데, 부두 뒤)
    const [, h, pos] = local(f, 0.0, zq - 0.4, 0, 1, 1, 1, 0, M4);
    cityInfo.push({ f, dc, pos, h, beaconPos: pos.clone(), quay: zq });
  });
  bld.count = nb; cont.count = nc; concrete.count = nq;
  [bld, cont, concrete, cranes, lhouse].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); });

  // ---------- 바닷길 띠 ----------
  const C_LO = new THREE.Color('#3b82f6'), C_MID = new THREE.Color('#f59e0b'), C_HI = new THREE.Color('#e11d1d'), C_USE = new THREE.Color('#ff9a1f'), C_FAR = new THREE.Color('#8b5cff');
  function heat(x, out) { if (x <= 0.8) return out.copy(C_LO); if (x <= 1) return out.copy(C_LO).lerp(C_MID, (x - 0.8) / 0.2); return out.copy(C_MID).lerp(C_HI, Math.min(1, (x - 1) / 0.3)); }
  function ribbon(ed, w, lift) {
    const pos = new Float32Array(ed.N * 2 * 3), uv = new Float32Array(ed.N * 2 * 2), idx = [];
    for (let i = 0; i < ed.N; i++) {
      const p = ed.pts[i], s = ed.side[i];
      for (let j = 0; j < 2; j++) { const o = (j ? 1 : -1) * w; P3.copy(p).multiplyScalar(R + lift).addScaledVector(s, o); pos.set([P3.x, P3.y, P3.z], (i * 2 + j) * 3); uv.set([j, i / (ed.N - 1)], (i * 2 + j) * 2); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  const bandTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 4; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,.85)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 4); return new THREE.CanvasTexture(c); })();
  edges.forEach((ed) => {
    const mat = new THREE.MeshBasicMaterial({ map: bandTex, color: ed.isRoute ? C_LO : 0xffffff, transparent: true, opacity: ed.isRoute ? 0.5 : 0.22, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
    ed.mat = mat; ed.col = mat.color.clone();
    const m = new THREE.Mesh(ribbon(ed, ed.isRoute ? (phone ? 0.2 : 0.16) : 0.05, 0.006), mat); m.renderOrder = 1; scene.add(m);
  });

  // ---------- 배 ----------
  const SHIP_L = phone ? 0.5 : 0.42, MAXS = phone ? 420 : 900;
  const DPU_R = phone ? 0.9 : 1.35, DPU_P = phone ? 0.22 : 0.33;
  const sGeo = shipGeometry();
  const sMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const ships = shadowy(new THREE.InstancedMesh(sGeo, sMat, MAXS)); ships.receiveShadow = false; ships.frustumCulled = false; scene.add(ships);
  const wakeTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
    for (let y = 0; y < 256; y++) { const f = y / 255, half = 4 + f * 26, a = Math.pow(1 - f, 1.6) * 0.95;
      const g = x.createLinearGradient(32 - half, 0, 32 + half, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.2, `rgba(255,255,255,${a})`); g.addColorStop(0.5, `rgba(255,255,255,${a * 0.35})`); g.addColorStop(0.8, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(32 - half, y, half * 2, 1); }
    return new THREE.CanvasTexture(c);
  })();
  const wGeo = new THREE.PlaneGeometry(0.42, 1.7); wGeo.rotateX(Math.PI / 2); wGeo.translate(0, 0.012, -1.3);   // 배 뒤로 길게
  const wakes = new THREE.InstancedMesh(wGeo, new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }), MAXS);
  wakes.frustumCulled = false; wakes.renderOrder = 2; scene.add(wakes);
  const navGeo = merge([part(new THREE.SphereGeometry(0.035, 6, 4), [1, 0.95, 0.75], MT(0, 0.26, -0.39)), part(new THREE.SphereGeometry(0.03, 6, 4), [1, 0.15, 0.1], MT(-0.11, 0.08, 0.2)), part(new THREE.SphereGeometry(0.03, 6, 4), [0.1, 1, 0.3], MT(0.11, 0.08, 0.2))]);
  const navs = new THREE.InstancedMesh(navGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }), MAXS + 200);
  navs.frustumCulled = false; navs.visible = false; scene.add(navs);

  // 길(방향)마다 배 목록: u = 0..1 진행, s = 크기(나타나기/사라지기)
  const lanes = []; edges.forEach((ed) => { for (let d = 0; d < 2; d++) lanes.push({ ed, d, ships: [] }); });
  const laneOff = (ed) => (ed.isRoute ? (phone ? 0.085 : 0.07) : 0.05);
  function edgePoint(ed, u, off, outP, outT, outS) {
    const f = Math.max(0, Math.min(0.99999, u)) * (ed.N - 1), i = f | 0, r = f - i;
    outP.copy(ed.pts[i]).lerp(ed.pts[i + 1], r).normalize();
    outT.copy(ed.tan[i]).lerp(ed.tan[i + 1], r).normalize(); outS.copy(ed.side[i]).lerp(ed.side[i + 1], r).normalize();
    outP.multiplyScalar(R + 0.004).addScaledVector(outS, off);
  }
  const tP = new THREE.Vector3(), tT = new THREE.Vector3(), tS = new THREE.Vector3();
  function shipMatrix(p, fwd, sc, out) {
    Ya.copy(p).normalize(); Za.copy(fwd).addScaledVector(Ya, -fwd.dot(Ya)).normalize(); Xa.crossVectors(Ya, Za);
    RM.makeBasis(Xa, Ya, Za); Q4.setFromRotationMatrix(RM); out.compose(p, Q4, S3.set(sc, sc, sc));
  }

  // ---------- 줄 서서 기다리는 배(닻) ----------
  const MAXQR = phone ? 55 : 85;
  const anchor = ROUTES.map((r, ri) => {
    const ed = edges[sim0.RE[ri]], spots = [];
    const centers = [];
    if (r.via.length) {   // 해협 양쪽 입구 앞 바다
      const vd = dirOf(r.via[0][0], r.via[0][1]); let vi = 0, best = -2; ed.pts.forEach((p, i) => { const d = p.dot(vd); if (d > best) { best = d; vi = i; } });
      const step = Math.round((ed.N - 1) * (7.5 * D2R) / ed.len);
      centers.push(Math.max(2, vi - step), Math.min(ed.N - 3, vi + step));
    } else centers.push(Math.round(ed.N * 0.5));
    const cands = centers.map((ci) => {
      const c = ed.pts[ci], t = ed.tan[ci], s = ed.side[ci], out = [];
      for (let j = 0; out.length < MAXQR && j < 600; j++) {
        const rr = (phone ? 0.3 : 0.26) * Math.sqrt(j + 0.5), a = j * 2.39996;
        P3.copy(c).multiplyScalar(R).addScaledVector(t, rr * Math.cos(a) * 0.8).addScaledVector(s, rr * Math.sin(a) * 1.3).normalize();
        if (T(P3.x, P3.y, P3.z)[0] > -0.12) continue;
        const p = P3.clone().multiplyScalar(R + 0.004), fwd = t.clone().multiplyScalar(Math.cos(0.5 + Math.sin(j) * 0.25)).addScaledVector(s, Math.sin(0.5 + Math.sin(j) * 0.25));
        out.push({ p, fwd, s: 0 });
      }
      return out;
    });
    for (let j = 0; spots.length < MAXQR; j++) { let any = false; cands.forEach((cs) => { if (j < cs.length && spots.length < MAXQR) { spots.push(cs[j]); any = true; } }); if (!any) break; }
    return { spots, center: ed.pts[centers[0]] };
  });
  const NQ = ROUTES.length * MAXQR;
  const qShips = shadowy(new THREE.InstancedMesh(sGeo, sMat, NQ)); qShips.receiveShadow = false; qShips.frustumCulled = false; scene.add(qShips);
  const ringGeo = new THREE.RingGeometry(0.5, 0.58, 28); ringGeo.rotateX(-Math.PI / 2); ringGeo.translate(0, 0.01, 0);
  const qRings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe11d1d, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }), NQ);
  qRings.frustumCulled = false; qRings.renderOrder = 3; scene.add(qRings);

  // ---------- 막힌 길목: 부표 줄·경고등·퍼지는 물결 ----------
  const buoyGeo = merge([cy(0.028, 0.04, 0.06, 0, 0.0, 0, '#d62828', 10), cy(0.022, 0.028, 0.05, 0, 0.055, 0, '#ffffff', 10), cy(0.018, 0.022, 0.04, 0, 0.1, 0, '#d62828', 10)]);
  const barriers = ROUTES.map((r, ri) => {
    if (!r.via.length) return null;
    const ed = edges[sim0.RE[ri]], vd = dirOf(r.via[0][0], r.via[0][1]); let vi = 0, best = -2; ed.pts.forEach((p, i) => { const d = p.dot(vd); if (d > best) { best = d; vi = i; } });
    const f = { n: ed.pts[vi].clone(), t: ed.tan[vi].clone(), b: ed.side[vi].clone() };
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const NB = 9, half = 0.42;
    const bm = shadowy(new THREE.InstancedMesh(buoyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), NB));
    const pts = [];
    for (let k = 0; k < NB; k++) { const x = -half + (2 * half * k) / (NB - 1); const [, , pos] = local(f, x, 0, 0, 1.3, 1.3, 1.3, 0.0, M4); bm.setMatrixAt(k, M4); pts.push(pos.clone().normalize().multiplyScalar(R + 0.03)); }
    g.add(bm);
    const boom = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 6, false), new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0x442200, roughness: 0.4 }));
    g.add(boom);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false, fog: false });
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), lampMat, NB);
    for (let k = 0; k < NB; k++) { const x = -half + (2 * half * k) / (NB - 1); local(f, x, 0, 0, 1, 1, 1, 0.17, M4); lamps.setMatrixAt(k, M4); }
    g.add(lamps);
    // 멀리서도 보이는 빨간 빛기둥 + 물결 고리 둘
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.16, 1.9, 16, 1, true); beamGeo.translate(0, 0.95, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
    const beam = new THREE.Mesh(beamGeo, beamMat); local(f, 0, 0, 0, 1, 1, 1, 0, M4); beam.applyMatrix4(M4); g.add(beam);
    const ripples = [0, 0.5].map((ph) => {
      const rg = new THREE.RingGeometry(0.9, 1, 64); rg.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -5 }));
      const base = new THREE.Matrix4(); local(f, 0, 0, 0, 1, 1, 1, 0.012, base); m.matrixAutoUpdate = false; g.add(m);
      return { m, base, ph };
    });
    return { g, f, ri, pts, lampMat, beamMat, ripples, s: 0, pos: ed.pts[vi].clone().multiplyScalar(R) };
  });

  // ---------- 물가 기둥 (빛나는 기둥) ----------
  const bcGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 18, 1, true); bcGeo.translate(0, 0.5, 0);
  const glGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 18, 1, true); glGeo.translate(0, 0.5, 0);
  const beacons = cityInfo.map((ci, i) => {
    const g = new THREE.Group(); local(ci.f, 0, ci.quay - 0.4, 0, 1, 1, 1, 0, M4); g.applyMatrix4(M4); scene.add(g);
    const core = new THREE.Mesh(bcGeo, new THREE.MeshBasicMaterial({ color: C_FAR, transparent: true, opacity: 0.92, toneMapped: false, depthWrite: false }));
    const glow = new THREE.Mesh(glGeo, new THREE.MeshBasicMaterial({ color: C_FAR, transparent: true, opacity: 0.22, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C_FAR, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    pad.position.y = 0.01; core.renderOrder = glow.renderOrder = 4;
    g.add(core, glow, cap, pad); g.updateMatrixWorld(true);
    return { g, core, glow, cap, pad, h: 0.06, top: new THREE.Vector3() };
  });

  // ---------- 밤 불빛 번짐(스프라이트) ----------
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(0.3, 'rgba(255,180,90,.45)'); g.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const cityGlows = cityInfo.map((ci) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, fog: false })); s.position.copy(ci.pos).multiplyScalar(1 + 0.08 / R); s.scale.set(1.8, 1.8, 1); s.visible = false; scene.add(s); return s; });
  const lhLamps = cityInfo.map((ci) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff, fog: false })); const e = new THREE.Matrix4(); lhouse.getMatrixAt(cityInfo.indexOf(ci), e); s.position.setFromMatrixPosition(e).multiplyScalar(1 + 0.2 / R); s.scale.set(0.35, 0.35, 1); s.visible = false; scene.add(s); return s; });

  // ---------- HTML 이름표 ----------
  const mk = (cls, html) => { const d = document.createElement('div'); d.className = 'st3-lab ' + cls; d.innerHTML = html; d.style.display = 'none'; wrap.appendChild(d); return { d, i: d.querySelector('i'), b: d.querySelector('b'), n: d.querySelector('.n'), txt: '', col: '', w: 0, h: 0 }; };
  const rLabs = ROUTES.map((r, ri) => { const o = mk('route', '<i></i><span class="n"></span><b></b>'); o.n.textContent = r.name; const ed = edges[sim0.RE[ri]]; o.anchor = r.via.length ? dirOf(r.via[0][0], r.via[0][1]).multiplyScalar(R + 0.15) : ed.pts[Math.round(ed.N * 0.5)].clone().multiplyScalar(R + 0.15); return o; });
  const pLabs = PORTS.map((p) => { const o = mk('port', '<i></i><span class="n"></span><b></b>'); o.n.textContent = p.name; return o; });
  const when = document.createElement('div'); when.className = 'st3-when'; wrap.appendChild(when);
  const pv = new THREE.Vector3(), camN = new THREE.Vector3();
  const boxes = [];
  function placeLab(o, p, show, pri) {
    if (!show) { if (o.d.style.display !== 'none') o.d.style.display = 'none'; return; }
    pv.copy(p).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, sx = (pv.x + 1) / 2 * w, sy = (1 - pv.y) / 2 * h;
    let vis = pv.z < 1 && sx > 20 && sx < w - 20 && sy > 22 && sy < h - 4;
    if (vis) {
      if (!o.w) { o.d.style.display = ''; o.w = o.d.offsetWidth || 60; o.h = o.d.offsetHeight || 18; }
      const bx0 = sx - o.w / 2, by0 = sy - o.h - 4;
      for (const q of boxes) if (bx0 < q[2] && bx0 + o.w > q[0] && by0 < q[3] && by0 + o.h > q[1]) { vis = false; break; }
      if (vis) boxes.push([bx0 - 2, by0 - 2, bx0 + o.w + 2, by0 + o.h + 2]);
    }
    o.d.style.display = vis ? '' : 'none';
    if (vis) o.d.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - 4).toFixed(1)}px) translate(-50%, -100%)`;
  }
  const setTxt = (o, t) => { if (o.txt !== t) { o.txt = t; o.b.textContent = t; o.w = 0; } };
  const setCol = (o, c) => { if (o.col !== c) { o.col = c; o.i.style.background = c; } };
  const frontFacing = (p, m) => p.dot(camN) > R * (m || 0.2);

  // ---------- 낮/밤 ----------
  const tSel = $('st-time'); let night = false;
  function applyTime() {
    night = !!tSel && tSel.value === 'night';
    U.uNight.value = night ? 1 : 0;
    scene.background = night ? SKY.night : SKY.day; stars.visible = night;
    scene.fog.color.set(night ? 0x0a1328 : 0xcfe0f2);
    hemi.intensity = night ? 0.12 : 0.9; hemi.color.set(night ? 0x8fa6d8 : 0xeaf3ff);
    sun.intensity = night ? 0.35 : 2.3; sun.color.set(night ? 0x9db4ff : 0xfff4e2);
    [halo, rim].forEach((m) => { m.material.uniforms.uC.value.copy(night ? ATM.night : ATM.day); m.material.uniforms.uK.value = night ? 0.8 : 1; });
    clouds.material.opacity = night ? 0.18 : 0.55;
    bSide.emissive.set(night ? 0xffc46b : 0x000000); bSide.emissiveIntensity = night ? 1.6 : 0;
    navs.visible = night; cityGlows.forEach((s) => { s.visible = night; }); lhLamps.forEach((s) => { s.visible = night; });
    edges.forEach((ed) => { ed.mat.opacity = ed.isRoute ? (night ? 0.7 : 0.5) : (night ? 0.3 : 0.22); });
    wakes.material.opacity = night ? 0.25 : 0.55;
    wrap.classList.toggle('st3-night', night);
    if (thumb) render1();
  }
  if (tSel) tSel.addEventListener('change', applyTime);
  const rot = $('st-rotate'); const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });

  // ---------- 카메라: 막힌 길목이 잘 보이는 비스듬한 시점, 길목을 바꾸면 그쪽으로 천천히 ----------
  const DIST = phone ? 40 : 34;
  const viewDir = (ri) => { const r = ROUTES[ri]; if (!r || !r.via.length) return dirOf(30, -12); const [la, lo] = r.via[0]; return dirOf(la + 20, lo - 14); };
  let fly = null, userTouch = false;
  controls.addEventListener('start', () => { userTouch = true; fly = null; });
  function home(ri, instant) {
    const d = viewDir(ri);
    if (instant) { camera.position.copy(d).multiplyScalar(thumb ? 31 : DIST); controls.update(); return; }
    fly = { from: camera.position.clone().normalize(), to: d, dist: camera.position.length(), t: 0 };
  }

  // ---------- 상태 따라가기 ----------
  let lastSim = null, lastT = -1, lastBlk = -9;
  const tgtH = new Float32Array(NP).fill(0.06);
  function restyle(sim) {
    edges.forEach((ed) => {
      if (!ed.isRoute) return;
      const blk = sim.blocked && ed.ri === sim.blockedRoute;
      if (blk) ed.col.set(0xe11d1d); else heat(sim.flow[ed.k] / E[ed.k].cap, ed.col);
      ed.blk = blk;
    });
    PORTS.forEach((p, i) => { tgtH[i] = Math.min(7.5, 0.06 + Math.max(0, sim.idx[i] - 100) * 0.11); });
  }
  function laneTarget(sim, L) {
    const k = L.ed.k; if (!isFinite(sim.cost[k])) return 0;
    return Math.min(140, Math.round(sim.dirF[k * 2 + L.d] * (L.ed.isRoute ? DPU_R : DPU_P)));
  }
  function seedLanes(sim) { lanes.forEach((L) => { const n = laneTarget(sim, L); L.ships = []; for (let j = 0; j < n; j++) L.ships.push({ u: (j + 0.5 * Math.random()) / n, s: 1, die: false }); }); }
  let tm = 0;
  function update(dt) {
    const st = window.StraitState; if (!st || !st.sim) return;
    const sim = st.sim, still = st.isPaused() || thumb, step = still ? 0 : dt;
    tm += dt; U.uTime.value = tm;
    if (sim !== lastSim) { const fresh = !!lastSim && sim.blockedRoute !== lastBlk; lastSim = sim; lastT = -1; seedLanes(sim); anchor.forEach((a) => a.spots.forEach((s) => { s.s = 0; })); if (fresh && lastBlk !== -9 && !userTouch) home(sim.blockedRoute, false); lastBlk = sim.blockedRoute; }
    if (sim.t !== lastT) { lastT = sim.t; restyle(sim); }
    camN.copy(camera.position).normalize();
    // 해가 카메라 뒤 위쪽에서 비추게(보이는 쪽이 늘 낮)
    Xa.crossVectors(new THREE.Vector3(0, 1, 0), camN).normalize(); Ya.crossVectors(camN, Xa);
    sun.position.copy(camN).multiplyScalar(0.78).addScaledVector(Xa, -0.42).addScaledVector(Ya, 0.46).normalize().multiplyScalar(30);
    const cd = camera.position.length(); scene.fog.near = cd - R * 0.5; scene.fog.far = cd + R * 3.2;
    clouds.rotation.y += dt * 0.006;
    // 바닷길 색: 부드럽게 따라가기
    const kk = thumb ? 1 : Math.min(1, dt * 3);
    const zf = Math.max(0.3, Math.min(1, (cd - 13) / 14));   // 가까이 다가가면 띠를 옅게(배가 잘 보이게)
    edges.forEach((ed) => {
      if (ed.isRoute) { ed.mat.color.lerp(ed.col, kk); const base = (night ? 0.75 : 0.6) * zf; ed.mat.opacity += ((ed.blk ? (0.3 + 0.2 * Math.sin(tm * 5)) * zf : base) - ed.mat.opacity) * kk; }
      else ed.mat.opacity = (night ? 0.3 : 0.25) * zf;
    });
    // 배 움직이기
    let n = 0, nn = 0;
    const grow = thumb ? 1 : dt / 0.6, zk = Math.max(1, Math.min(1.45, cd / 24));   // 멀리서 볼 땐 배를 조금 크게
    for (const L of lanes) {
      const ed = L.ed, tgt = laneTarget(sim, L), cst = sim.cost[ed.k];
      const rate = isFinite(cst) ? step * 1.3 / Math.max(2, cst) : 0;
      let alive = 0; for (const s of L.ships) if (!s.die) alive++;
      if (alive > tgt) { let m = alive - tgt; for (let j = L.ships.length - 1; j >= 0 && m > 0; j -= 1 + ((j * 7) % 3)) if (!L.ships[j].die) { L.ships[j].die = true; m--; } }
      else if (alive < tgt) {
        for (let m = Math.min(3, tgt - alive); m > 0; m--) {
          const us = L.ships.map((s) => s.u).sort((a, b) => a - b); let gu = Math.random(), gap = 0;
          for (let j = 0; j < us.length; j++) { const a = us[j], b = j + 1 < us.length ? us[j + 1] : us[0] + 1; if (b - a > gap) { gap = b - a; gu = (a + gap / 2) % 1; } }
          L.ships.push({ u: gu, s: thumb ? 1 : 0, die: false });
        }
      }
      const off = laneOff(ed);
      for (let j = L.ships.length - 1; j >= 0; j--) {
        const s = L.ships[j];
        s.u = (s.u + rate) % 1;
        s.s = s.die ? s.s - grow : Math.min(1, s.s + grow);
        if (s.die && s.s <= 0) { L.ships.splice(j, 1); continue; }
        if (n >= MAXS) continue;
        // 항구 가까이에선 작게(부두에 닿는 느낌), 끝에서 끝으로 넘어갈 때 잠깐 사라짐
        const uu = L.d ? 1 - s.u : s.u, endF = Math.min(1, Math.min(s.u, 1 - s.u) / 0.035);
        edgePoint(ed, uu, L.d ? -off : off, tP, tT, tS);
        if (L.d) tT.negate();
        if (!frontFacing(tP, -0.05)) continue;
        const sc = SHIP_L * zk * s.s * endF;
        if (sc < 0.01) continue;
        shipMatrix(tP, tT, sc, M4);
        ships.setMatrixAt(n, M4); wakes.setMatrixAt(n, M4); n++;
        if (night && nn < MAXS + 200) navs.setMatrixAt(nn++, M4);
      }
    }
    ships.count = n; wakes.count = n; ships.instanceMatrix.needsUpdate = true; wakes.instanceMatrix.needsUpdate = true;
    // 닻 내린 배: 줄(sim.Q)에 비례
    let q = 0;
    ROUTES.forEach((r, ri) => {
      const want = Math.min(anchor[ri].spots.length, Math.round(sim.routeQ(ri) / 3));
      anchor[ri].spots.forEach((s, j) => {
        s.s = j < want ? Math.min(1, s.s + grow) : Math.max(0, s.s - grow);
        if (s.s <= 0.01) return;
        const bob = Math.sin(tm * 1.3 + j) * 0.004;
        tP.copy(s.p).multiplyScalar(1 + bob / R);
        shipMatrix(tP, s.fwd, SHIP_L * zk * s.s, M4);
        qShips.setMatrixAt(q, M4); qRings.setMatrixAt(q, M4); q++;
        if (night && nn < MAXS + 200) navs.setMatrixAt(nn++, M4);
      });
    });
    qShips.count = q; qRings.count = q; qShips.instanceMatrix.needsUpdate = true; qRings.instanceMatrix.needsUpdate = true;
    qRings.material.opacity = 0.6 + 0.25 * Math.sin(tm * 3);
    navs.count = nn; navs.instanceMatrix.needsUpdate = true;
    // 막힌 길목
    barriers.forEach((B) => {
      if (!B) return;
      const on = sim.blocked && sim.blockedRoute === B.ri;
      B.s += ((on ? 1 : 0) - B.s) * (thumb ? 1 : Math.min(1, dt * 3));
      B.g.visible = B.s > 0.02;
      if (!B.g.visible) return;
      const blink = 0.5 + 0.5 * Math.sin(tm * 6);
      B.lampMat.color.setRGB(1, 0.12 + 0.3 * blink, 0.12);
      B.beamMat.opacity = (0.3 + 0.25 * blink) * B.s;
      B.ripples.forEach((rp) => {
        const ph = (tm * 0.45 + rp.ph) % 1, sc = (0.35 + ph * 1.6) * B.s;
        rp.m.matrix.copy(rp.base).multiply(new THREE.Matrix4().makeScale(sc, 1, sc)); rp.m.material.opacity = 0.65 * (1 - ph) * B.s;
      });
    });
    // 물가 기둥
    beacons.forEach((bc, i) => {
      bc.h += (tgtH[i] - bc.h) * (thumb ? 1 : Math.min(1, dt * 3));
      const c = sim.uses[i] ? C_USE : C_FAR;
      bc.core.material.color.copy(c); bc.glow.material.color.copy(c); bc.pad.material.color.copy(c);
      bc.core.scale.set(1, bc.h, 1); bc.glow.scale.set(1, bc.h, 1); bc.cap.position.y = bc.h;
      bc.cap.material.color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.55);
      bc.glow.material.opacity = 0.1 + 0.05 * Math.sin(tm * 2 + i);
      bc.top.set(0, bc.h + 0.15, 0).applyMatrix4(bc.g.matrixWorld);
    });
    // 이름표
    boxes.length = 0;
    const showLab = !thumb;
    rLabs.forEach((o, ri) => {
      const blk = sim.blocked && ri === sim.blockedRoute;
      o.d.classList.toggle('blk', blk);
      setTxt(o, blk ? '막힘' : `${Math.round(sim.routeLoad(ri) * 100)}%`);
      setCol(o, '#' + heat(sim.routeLoad(ri), tmpC).getHexString());
      placeLab(o, o.anchor, showLab && frontFacing(o.anchor, 0.3));
    });
    const ord = PORTS.map((p, i) => i).sort((a, b) => sim.idx[b] - sim.idx[a]);
    for (const i of ord) {
      const o = pLabs[i];
      setTxt(o, `${Math.round(sim.idx[i])}`); setCol(o, sim.uses[i] ? '#e8890c' : '#7c4dff');
      placeLab(o, beacons[i].top, showLab && frontFacing(cityInfo[i].pos, 0.35));
    }
    const wt = ($('when') && $('when').textContent) || ''; if (when.textContent !== wt) when.textContent = wt;
    when.style.display = showLab && wt ? '' : 'none';
    // 카메라 이동
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.8); const e = fly.t * fly.t * (3 - 2 * fly.t);
      const d = fly.from.clone().lerp(fly.to, e).normalize(); camera.position.copy(d).multiplyScalar(fly.dist);
      if (fly.t >= 1) fly = null;
    }
  }
  const buildMs = performance.now() - t0;
  function render1() { update(0.016); controls.update(); v.render(); }
  v.onFrame((dt) => update(dt));
  home(sim0.blockedRoute, true);
  lastBlk = sim0.blockedRoute;
  applyTime();
  update(0);
  if (thumb) {
    controls.autoRotate = false;
    render1(); setTimeout(render1, 300); setTimeout(render1, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Strait3D = { v, update, stats: () => ({ buildMs: Math.round(buildMs), ships: ships.count, queue: qShips.count, buildings: bld.count, verts: nv, night, info: renderer.info.render }) };
}
