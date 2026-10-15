// ① 동네 풍경 (3D): app.js가 window.DepopState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 마을 한 칸 = 작은 동네: 사는 집 수 = 인구 ÷ 20 반올림(최대 6채). 처음에 지은 집은 사람이 줄어도 허물지 않고 빈집(바랜 벽·어두운 지붕·살짝 기울어짐)으로 남는다.
//   사는 집은 창에 불빛(노란색), 집이 비어 갈수록 칸 바닥이 초록 → 누런 갈색으로 마른다.
// - 칸 가운데 큰 건물 = 생활 시설: 열림 = 흰 벽·파란 지붕·불 켜진 창 / 닫힘 = 회색 + 판자 X. 지켜 주는 마을 = 남색 깃발 + 투명한 둥근 막
// - 가운데 3×3 = 도시: 빌딩 높이 ∝ 도시 칸 인구, 도시 인구가 늘수록 켜진 창이 많아진다(보기용 연출)
// - 도로: 도시 양옆으로 지나는 큰길 4줄(도시에서 바깥으로 8갈래). 칸 사이 틈은 골목
// - 주황 점: 그해 인구가 줄어든 마을에서 길을 따라 도시 쪽으로 가는 방향 표시(점 수 ∝ 줄어든 인구, 개수 제한). 실제 이동 경로가 아니다
// - 낮/밤(dp-time): 밤에는 하늘·조명을 어둡게 하고 사는 집·시설·빌딩의 창만 빛난다(emissive, 조명 추가 없음)
// - 한 해 전과 지금 사이를 시간 비율만큼 이어 그린다(보간, 결과에는 영향 없음)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.DepopState;
const SKY_DAY = '#d8eaf8', SKY_NIGHT = '#0d1833';

// ---------- 모양 만들기: 여러 상자를 한 모양으로 합치고 꼭짓점마다 색·창 표시(aGlow)를 붙인다 ----------
function part(geo, rgb, glow, m) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m) g.applyMatrix4(m);
  return { g, rgb, glow };
}
function merge(parts) {
  let n = 0; parts.forEach((p) => { n += p.g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), glo = new Float32Array(n);
  let o = 0;
  parts.forEach((p) => {
    const c = p.g.attributes.position.count;
    pos.set(p.g.attributes.position.array, o * 3); nor.set(p.g.attributes.normal.array, o * 3);
    for (let k = 0; k < c; k++) { col[(o + k) * 3] = p.rgb[0]; col[(o + k) * 3 + 1] = p.rgb[1]; col[(o + k) * 3 + 2] = p.rgb[2]; glo[o + k] = p.glow || 0; }
    o += c;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(glo, 1));
  return g;
}
const M = (x, y, z, rz) => { const m = new THREE.Matrix4(); if (rz) m.makeRotationZ(rz); m.setPosition(x, y, z); return m; };
const box = (w, h, d, x, y, z, rgb, glow, rz) => part(new THREE.BoxGeometry(w, h, d), rgb, glow, M(x, y, z, rz));

// 창 불빛: 꼭짓점의 aGlow × 집마다의 iLit만큼 창 색을 스스로 빛나게(emissive) 더한다
function glowMaterial(winU) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWin = winU;
    sh.vertexShader = 'attribute float aGlow;\nattribute float iLit;\nattribute float iEmpty;\nvarying float vGlow;\nvarying float vEmpty;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = aGlow * iLit;\n  vEmpty = iEmpty;');
    sh.fragmentShader = 'uniform vec3 uWin;\nvarying float vGlow;\nvarying float vEmpty;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.66, 0.63, 0.6), vEmpty);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uWin * vGlow;');
  };
  mat.customProgramCacheKey = () => 'dp-glow';
  return mat;
}
// 빌딩 창: 옆면에 층·칸 무늬를 그리고, 켜진 창 비율(uLit)만큼 빛나게 한다(높을수록 창이 많아진다)
function towerMaterial(winU, litU) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWin = winU; sh.uniforms.uLit = litU;
    sh.vertexShader = 'varying vec3 vWP;\nvarying vec3 vON;\nvarying float vSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vec4 wp4 = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  wp4 = instanceMatrix * wp4;\n  vSeed = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 7.7;\n  #else\n  vSeed = 0.0;\n  #endif\n  vWP = (modelMatrix * wp4).xyz;\n  vON = normal;');
    sh.fragmentShader = 'uniform vec3 uWin;\nuniform float uLit;\nvarying vec3 vWP;\nvarying vec3 vON;\nvarying float vSeed;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float side = 1.0 - step(0.5, abs(vON.y));\n  float cc = abs(vON.x) > 0.5 ? vWP.z : vWP.x;\n  float fy = fract(vWP.y / 0.3), fc = fract(cc / 0.1);\n  float inW = side * step(0.3, fy) * step(fy, 0.78) * step(0.2, fc) * step(fc, 0.8) * step(0.4, vWP.y);\n  diffuseColor.rgb *= 1.0 - 0.35 * inW;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float hh = fract(sin(floor(vWP.y / 0.3) * 12.9898 + floor(cc / 0.1) * 78.233 + vSeed) * 43758.5453);\n  totalEmissiveRadiance += uWin * inW * step(hh, uLit);');
  };
  mat.customProgramCacheKey = () => 'dp-tower';
  return mat;
}

function init(v, narrow) {
  const { scene, camera, controls } = v;
  const DP = window.Depop, W = DP.C.W, N = W * W, HALF = (W - 1) / 2;
  const wx = (i) => (i % W) - HALF, wz = (i) => ((i / W) | 0) - HALF;
  const TOP = 0.05;                               // 칸 바닥 윗면 높이
  const PER = 20, MAXH = 6;                       // 집 한 채 = 사람 20명(반올림), 칸마다 최대 6채
  const PPD = 8;                                  // 떠나는 사람 점 하나 ≈ 줄어든 사람 8명(보기용 축척)
  const DOTMAX = narrow ? 260 : 480;
  const lights = scene.children.filter((o) => o.isLight);
  const hemi = lights.find((o) => o.isHemisphereLight), sun = lights.find((o) => o.isDirectionalLight);
  const amb = new THREE.AmbientLight(0xffffff, 0.3); scene.add(amb);
  const winU = { value: new THREE.Color(1.0, 0.78, 0.3) }, litU = { value: 0.5 }, towerWinU = { value: new THREE.Color(1.0, 0.82, 0.4) };

  // 받침판(골목 색) + 큰길 4줄
  const plateMat = new THREE.MeshLambertMaterial({ color: 0xc9ccd2 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.3, W + 1.4), plateMat); plate.position.y = -0.15; scene.add(plate);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x6b7280 });
  const roadGeo = new THREE.BoxGeometry(0.22, 0.02, W + 0.6);
  [-1.5, 1.5].forEach((c) => {
    const a = new THREE.Mesh(roadGeo, roadMat); a.position.set(c, TOP + 0.012, 0); scene.add(a);
    const b = new THREE.Mesh(roadGeo, roadMat); b.rotation.y = Math.PI / 2; b.position.set(0, TOP + 0.012, c); scene.add(b);
  });

  // 칸 바닥(초록 → 누런 갈색, 도시는 회색)
  const tileGeo = new THREE.BoxGeometry(0.92, TOP, 0.92); tileGeo.translate(0, TOP / 2, 0);
  const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) { dummy.position.set(wx(i), 0, wz(i)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); tiles.setMatrixAt(i, dummy.matrix); }
  scene.add(tiles);
  const G_LIVE = new THREE.Color('#7dbd5f'), G_DRY = new THREE.Color('#cdb27a'), G_CITY = new THREE.Color('#a9aeb7');

  // 집: 벽 + 박공 없는 네모 지붕(뿔) + 창. 꼭짓점 색 × 집마다의 색(사는 집 크림 / 빈집 바랜 회색)
  const WALL = [1, 0.93, 0.8], ROOF = [0.82, 0.24, 0.15], WINC = [0.25, 0.24, 0.26];
  const roofGeo = new THREE.ConeGeometry(0.155, 0.12, 4); roofGeo.rotateY(Math.PI / 4);
  const houseGeo = merge([
    box(0.19, 0.15, 0.17, 0, 0.075, 0, WALL, 0.22),   // 벽도 아주 조금 빛나 밤에 사는 집이 따뜻하게 보인다
    part(roofGeo, ROOF, 0, M(0, 0.15 + 0.06, 0)),
    box(0.13, 0.07, 0.012, 0, 0.08, 0.087, WINC, 1), box(0.13, 0.07, 0.012, 0, 0.08, -0.087, WINC, 1),
    box(0.012, 0.07, 0.1, 0.097, 0.08, 0, WINC, 1), box(0.012, 0.07, 0.1, -0.097, 0.08, 0, WINC, 1),
  ]);
  const HN = (N - 9) * MAXH;
  const iLitH = new THREE.InstancedBufferAttribute(new Float32Array(HN), 1); iLitH.setUsage(THREE.DynamicDrawUsage); houseGeo.setAttribute('iLit', iLitH);
  const iEmpH = new THREE.InstancedBufferAttribute(new Float32Array(HN), 1); iEmpH.setUsage(THREE.DynamicDrawUsage); houseGeo.setAttribute('iEmpty', iEmpH);
  const houses = new THREE.InstancedMesh(houseGeo, glowMaterial(winU), HN);   // 빈집은 셰이더에서 색을 바랜 회색으로(iEmpty)
  houses.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(houses);
  // 칸 안 집 자리 6곳(시설을 둘러쌈), 집마다 고정된 작은 방향 흔들림
  const SLOT = [[-0.3, -0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3], [0, 0.31], [0, -0.31]];
  const yaw = new Float32Array(N * MAXH), tilt = new Float32Array(N * MAXH);
  let hs = 12345; const hrnd = () => { hs = (hs * 1103515245 + 12345) & 0x7fffffff; return hs / 0x7fffffff; };
  for (let k = 0; k < N * MAXH; k++) { yaw[k] = (hrnd() - 0.5) * 0.5 + (hrnd() < 0.5 ? 0 : Math.PI / 2); tilt[k] = hrnd() < 0.5 ? -1 : 1; }

  // 생활 시설: 열림(흰 벽·파란 지붕·창 불빛) / 닫힘(회색 + 판자 X)
  const facOpenGeo = merge([
    box(0.32, 0.2, 0.28, 0, 0.1, 0, [0.97, 0.97, 0.98]),
    box(0.37, 0.05, 0.33, 0, 0.225, 0, [0.16, 0.42, 0.88]),
    box(0.06, 0.06, 0.012, -0.09, 0.11, 0.142, WINC, 1), box(0.06, 0.06, 0.012, 0, 0.11, 0.142, WINC, 1), box(0.06, 0.06, 0.012, 0.09, 0.11, 0.142, WINC, 1),
    box(0.06, 0.06, 0.012, -0.09, 0.11, -0.142, WINC, 1), box(0.06, 0.06, 0.012, 0, 0.11, -0.142, WINC, 1), box(0.06, 0.06, 0.012, 0.09, 0.11, -0.142, WINC, 1),
  ]);
  const BRD = [0.85, 0.62, 0.34];   // 밝은 나무 판자
  const facShutGeo = merge([
    box(0.32, 0.18, 0.28, 0, 0.09, 0, [0.5, 0.5, 0.52]),
    box(0.37, 0.05, 0.33, 0, 0.205, 0, [0.26, 0.27, 0.3]),
    box(0.32, 0.045, 0.014, 0, 0.09, 0.145, BRD, 0, 0.5), box(0.32, 0.045, 0.014, 0, 0.09, 0.145, BRD, 0, -0.5),
    box(0.32, 0.045, 0.014, 0, 0.09, -0.145, BRD, 0, 0.5), box(0.32, 0.045, 0.014, 0, 0.09, -0.145, BRD, 0, -0.5),
    box(0.014, 0.045, 0.28, 0.165, 0.09, 0, BRD), box(0.014, 0.045, 0.28, -0.165, 0.09, 0, BRD),
  ]);
  const ones = (n) => new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1);
  facOpenGeo.setAttribute('iLit', ones(N)); facShutGeo.setAttribute('iLit', ones(N));
  const zeros = (n) => new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  facOpenGeo.setAttribute('iEmpty', zeros(N)); facShutGeo.setAttribute('iEmpty', zeros(N));
  const facOpen = new THREE.InstancedMesh(facOpenGeo, glowMaterial(winU), N), facShut = new THREE.InstancedMesh(facShutGeo, glowMaterial(winU), N);
  [facOpen, facShut].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; scene.add(m); });

  // 지켜 주는 마을: 남색 깃발 + 투명한 둥근 막
  const flagGeo = merge([box(0.045, 1.7, 0.045, 0.15, 0.85, 0.12, [0.62, 0.64, 0.68]), box(0.62, 0.4, 0.03, 0.47, 1.47, 0.12, [0.08, 0.16, 0.6])]);
  flagGeo.setAttribute('iLit', ones(16)); flagGeo.setAttribute('iEmpty', zeros(16));
  const flags = new THREE.InstancedMesh(flagGeo, glowMaterial(winU), 16); flags.count = 0; scene.add(flags);
  const domeGeo = new THREE.SphereGeometry(0.7, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const domes = new THREE.InstancedMesh(domeGeo, new THREE.MeshLambertMaterial({ color: 0x2f55d4, transparent: true, opacity: 0.42, depthWrite: false }), 16);
  domes.count = 0; domes.renderOrder = 2; scene.add(domes);

  // 도시: 칸마다 빌딩 4채(높이 ∝ 도시 칸 인구 × 빌딩마다 고정된 비율)
  const CITY = []; for (let i = 0; i < N; i++) if (st0.sim.isCity[i]) CITY.push(i);
  const towerGeo = new THREE.BoxGeometry(0.4, 1, 0.4); towerGeo.translate(0, 0.5, 0);
  const NT = CITY.length * 4;
  const towers = new THREE.InstancedMesh(towerGeo, towerMaterial(towerWinU, litU), NT);
  towers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(towers);
  const TPOS = [], TF = [], TCOL = new THREE.Color('#a7bbd3');
  CITY.forEach((i) => {
    const center = wx(i) === 0 && wz(i) === 0 ? 1.25 : 1;
    [[-0.22, -0.22], [0.22, 0.22], [0.22, -0.22], [-0.22, 0.22]].forEach(([dx, dz], k) => {
      TPOS.push([wx(i) + dx, wz(i) + dz, i]); TF.push(center * (0.7 + 0.45 * hrnd()) * (k === 0 ? 1.12 : 1));
    });
  });
  for (let k = 0; k < NT; k++) towers.setColorAt(k, TCOL.clone().offsetHSL(0, 0, (hrnd() - 0.5) * 0.08));

  // 떠나는 사람 점(방향 표시): 마을 → 가장 가까운 골목 → 큰길 → 도시 가장자리
  const dotGeo = new THREE.IcosahedronGeometry(0.075, 1);
  const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xff6a00 }), DOTMAX);
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.count = 0; dots.renderOrder = 3; scene.add(dots);
  const PATH = new Array(N), PLEN = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (st0.sim.isCity[i]) continue;
    const x = wx(i), z = wz(i), horiz = Math.abs(x) >= Math.abs(z);
    const a = horiz ? x : z, b = horiz ? z : x, sa = Math.sign(a) || 1, br = b >= 0 ? 1.5 : -1.5;
    const pts = [[a - sa * 0.5, b], [a - sa * 0.5, br], [sa * 1.5, br], [sa * 0.9, br * 0.6]];
    const P = pts.map(([p, q]) => (horiz ? [p, q] : [q, p]));
    const segs = []; let L = 0;
    for (let k = 1; k < P.length; k++) { const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); segs.push(l); L += l; }
    PATH[i] = { P, segs }; PLEN[i] = L;
  }
  const dCell = new Int32Array(DOTMAX), dT0 = new Float32Array(DOTMAX), dSp = new Float32Array(DOTMAX);
  let nDot = 0, clock = 0;
  const carry = new Float32Array(N);
  function spawn(sim, spread) {
    for (const i of sim.VIL) {
      const d = sim.prevPop[i] - sim.pop[i]; if (d <= 0) continue;
      carry[i] += d / PPD; let n = Math.floor(carry[i]); carry[i] -= n;
      while (n-- > 0 && nDot < DOTMAX) { dCell[nDot] = i; dT0[nDot] = clock + hrnd() * spread; dSp[nDot] = 6.5 + 2 * hrnd(); nDot++; }   // spread < 0: 이미 길을 가는 중(썸네일)
    }
  }
  function dotAt(k, out) {
    const i = dCell[k], s = (clock - dT0[k]) * dSp[k];
    if (s < 0) return 0;
    if (s >= PLEN[i]) return -1;
    const { P, segs } = PATH[i]; let r = s, q = 0;
    while (q < segs.length - 1 && r > segs[q]) { r -= segs[q]; q++; }
    const f = Math.min(1, r / segs[q]);
    out[0] = P[q][0] + (P[q + 1][0] - P[q][0]) * f; out[1] = P[q][1] + (P[q + 1][1] - P[q][1]) * f;
    return Math.max(0.25, Math.min(1, (PLEN[i] - s) / 1.2));   // 도시에 닿으며 작아진다
  }

  // 낮 / 밤
  const tSel = $('dp-time');
  let night = false;
  function applyTime() {
    night = !!tSel && tSel.value === 'night';
    scene.background = new THREE.Color(night ? SKY_NIGHT : SKY_DAY);
    if (hemi) { hemi.intensity = night ? 0.1 : 1.1; hemi.color.set(night ? 0x8fa6d8 : 0xffffff); }
    if (sun) { sun.intensity = night ? 0.14 : 1.2; sun.color.set(night ? 0x9fb4ff : 0xffffff); }
    amb.intensity = night ? 0.12 : 0.3; amb.color.set(night ? 0x5a6fa8 : 0xffffff);
    winU.value.setRGB(night ? 1.0 : 0.95, night ? 0.82 : 0.74, night ? 0.38 : 0.26);
    towerWinU.value.setRGB(night ? 1.0 : 0.85, night ? 0.85 : 0.8, night ? 0.45 : 0.55);
  }
  if (tSel) tSel.addEventListener('change', () => { applyTime(); if (st0.thumb) v.render(); });
  applyTime();

  const eT = new Float32Array(N * MAXH);   // 집 자리마다 0 = 사는 집, 1 = 빈집 (바뀔 때 천천히)
  const col = new THREE.Color(), xz = [0, 0];
  let simRef = null, lastT = -1;
  const rot = $('dp-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });

  function update(dt) {
    const st = window.DepopState; if (!st || !st.sim) return;
    const sim = st.sim;
    const fresh = sim !== simRef;
    if (fresh) { simRef = sim; lastT = sim.t; nDot = 0; carry.fill(0); if (st.thumb && sim.t > 0) spawn(sim, -2.6); }
    if (!st.isPaused() || st.thumb) clock += dt;
    if (sim.t !== lastT) { if (sim.t === lastT + 1) spawn(sim, Math.min(1.2, st.interval)); lastT = sim.t; }
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const k = fresh || st.thumb ? 1 : Math.min(1, dt * 3);
    // 마을: 집·시설·바닥
    let h = 0, fo = 0, fs = 0, fl = 0;
    for (let i = 0; i < N; i++) {
      const p = sim.prevPop[i] + (sim.pop[i] - sim.prevPop[i]) * a;
      if (sim.isCity[i]) { tiles.setColorAt(i, G_CITY); continue; }
      const built = Math.min(MAXH, Math.max(1, Math.round(sim.P0[i] / PER))), lived = Math.min(MAXH, Math.round(p / PER)), shown = Math.max(built, lived);
      let emp = 0;
      const x0 = wx(i), z0 = wz(i);
      for (let s = 0; s < shown; s++) {
        const q = i * MAXH + s;
        eT[q] += ((s < lived ? 0 : 1) - eT[q]) * k;
        const e = eT[q]; emp += e;
        dummy.position.set(x0 + SLOT[s][0], TOP, z0 + SLOT[s][1]);
        dummy.rotation.set(0.1 * e * tilt[q], yaw[q], 0.12 * e * tilt[q]);
        dummy.scale.set(1, 1 - 0.18 * e, 1); dummy.updateMatrix();
        houses.setMatrixAt(h, dummy.matrix);
        iEmpH.array[h] = e;
        iLitH.array[h] = e < 0.5 ? 1 - e : 0; h++;
      }
      tiles.setColorAt(i, col.copy(G_LIVE).lerp(G_DRY, emp / shown));
      dummy.position.set(x0, TOP, z0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      if (sim.open[i]) facOpen.setMatrixAt(fo++, dummy.matrix); else facShut.setMatrixAt(fs++, dummy.matrix);
      if (sim.prot[i] && fl < 16) {
        flags.setMatrixAt(fl, dummy.matrix);
        dummy.position.y = TOP; dummy.updateMatrix(); domes.setMatrixAt(fl, dummy.matrix); fl++;
      }
    }
    houses.count = h; houses.instanceMatrix.needsUpdate = true; iLitH.needsUpdate = true; iEmpH.needsUpdate = true;
    facOpen.count = fo; facShut.count = fs; facOpen.instanceMatrix.needsUpdate = true; facShut.instanceMatrix.needsUpdate = true;
    flags.count = fl; domes.count = fl; flags.instanceMatrix.needsUpdate = true; domes.instanceMatrix.needsUpdate = true;
    tiles.instanceColor.needsUpdate = true;
    // 도시 빌딩
    let cp = 0;
    for (let t = 0; t < NT; t++) {
      const [x, z, i] = TPOS[t], p = sim.prevPop[i] + (sim.pop[i] - sim.prevPop[i]) * a;
      if (t % 4 === 0) cp += p;
      dummy.position.set(x, TOP, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, Math.max(0.4, TF[t] * p / 900), 1); dummy.updateMatrix();
      towers.setMatrixAt(t, dummy.matrix);
    }
    towers.instanceMatrix.needsUpdate = true; if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
    litU.value = Math.min(0.97, 0.3 + cp / CITY.length / 8000);   // 도시 사람이 늘수록 켜진 창이 많아 보이게(연출)
    // 떠나는 사람 점
    let w = 0;
    for (let d = 0; d < nDot; d++) {
      const sc = dotAt(d, xz);
      if (sc < 0) continue;   // 도시에 닿음: 지운다
      if (w !== d) { dCell[w] = dCell[d]; dT0[w] = dT0[d]; dSp[w] = dSp[d]; }
      if (sc > 0) { dummy.position.set(xz[0], TOP + 0.09, xz[1]); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(sc); }
      else { dummy.position.set(0, -5, 0); dummy.scale.setScalar(0.001); }
      dummy.updateMatrix(); dots.setMatrixAt(w, dummy.matrix); w++;
    }
    nDot = w; dots.count = w; dots.instanceMatrix.needsUpdate = true;
  }
  v.onFrame((dt) => update(dt));
  if (narrow) { camera.position.set(16, 16, 21); controls.update(); }
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(11, 10, 14); controls.target.set(0, 2.2, 0);
    const shot = () => { update(0); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Depop3D = { v, update, stats: () => ({ houses: houses.count, facOpen: facOpen.count, facShut: facShut.count, towers: NT, dots: dots.count, tiles: N }) };
}

if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D landscape of villages and a city');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1';   // 휴대폰에서는 정사각형에 가깝게
  const v = create3D(canvas, { camera: [13, 12.5, 17], target: [0, 2.6, 0], background: SKY_DAY, autoRotateSpeed: 0.35, minDistance: 8, maxDistance: 70, fov: 45 });
  if (v) init(v, narrow);
}
