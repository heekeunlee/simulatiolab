// ① 원탁 국제회의장 (3D): app.js가 window.RepState로 내보내는 같은 sim을 그대로 그린다(3D에서 새로 계산하지 않음).
// - 가상의 나라 24곳 = 원탁에 둘러앉은 대표단(책상·명패·깃발·대표 두 사람). 실제 나라·국기·회의장과는 관계없다(깃발은 코드로 만든 가상 무늬).
// - 대표단 자리의 높이와 명패·스탠드 불빛의 밝기 = sim.stand(= 1/(1+다른 나라들이 가진 나쁜 기억의 합)). 한 라운드 전과 지금 사이를 부드럽게 잇는다.
// - 이번 라운드의 짝(sim.lastRound.pairs): 둘 다 지킴 = 금빛 줄기가 양쪽에서 나와 가운데서 만남(악수 빛), 한쪽이 어김 = 붉은 줄기가 어긴 나라에서
//   상대에게 꽂힘 + 어긴 자리에서 붉은 파문·경고등, 거절 = 회색 줄기가 양쪽에서 나오다 중간에서 끊김.
// - 주황 불씨 = 이번 라운드에 나쁜 소식이 실제로 건너간 연결(sim.lastRound.gossip), 선물 상자 = 사과·보상이 켜졌을 때 지난 라운드에 어긴 나라가
//   이번 라운드에 물어 준 보상(sim.js 규칙 그대로). 모든 연출은 상태를 보여 주는 표시일 뿐 결과에 영향이 없다.
// - 외부 모델·텍스처 파일 없이 코드로 만든 지오메트리와 캔버스 텍스처만 쓴다. 휴대폰에서는 그림자를 끄고 관중석을 줄인다.
import { THREE, create3D } from '../../lab3d.js';

const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.RepState;
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWX';
const nm = (i) => `${LET[i] || i + 1}국`;

// ---------- 작은 도구 ----------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function merge(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; parts.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  parts.forEach((g) => {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += c;
  });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return m;
}
// 고리 모양 조각(부채꼴 띠) 기둥: 반지름 r0~r1, 각도 ±hw(라디안), 높이 y0~y1. 가운데가 +x 쪽
function sector(r0, r1, hw, y0, y1, bevel) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, -hw, hw, false); s.absarc(0, 0, r0, hw, -hw, true);
  const b = bevel || 0;
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, y1 - y0 - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + b, 0);
  return g;
}
const at = (g, x, y, z, ry, rz) => { if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
// 극좌표(반지름 r, 각도 a: +x에서 시작, 화면 위에서 볼 때 시계 반대)로 옮기기
const polar = (g, r, a, y, face) => { g.rotateY(-a + (face || 0)); g.translate(r * Math.cos(a), y, r * Math.sin(a)); return g; };
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const glowTex = () => canvasTex(64, 64, (x, w) => {
  const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.75)'); g.addColorStop(0.6, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, w);
});

// ---------- 레이아웃 ----------
const N = 24, DA = (Math.PI * 2) / N, HW = DA * 0.47;
const R_IN = 6.1, R_DESK = 7.3, R_PED = 9.65;          // 책상 안쪽·바깥쪽, 대표단 단상 바깥
const H0 = 0.12, H1 = 1.65;                             // 단상 높이: 믿음 0 → H0, 믿음 1 → H0+H1
const DESK_Y = 0.78;
const hOf = (s) => H0 + H1 * s;

function init(v, narrow) {
  const { scene, camera, controls, renderer } = v;
  const R = rng(20261016);
  scene.children.filter((o) => o.isLight).forEach((l) => scene.remove(l));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const SHADOW = !narrow;
  if (narrow) { renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1)); v.resize(); }   // 휴대폰: 픽셀 수를 줄여 부드럽게
  if (SHADOW) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }

  // 하늘빛 배경(밝은 그라데이션) + 안개
  scene.background = canvasTex(8, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bcd3ee'); g.addColorStop(0.55, '#e4ecf6'); g.addColorStop(1, '#f3efe8'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0xe6ebf2, 36, 85);
  // 반사용 환경(코드로 만든 밝은 방): 대리석·금속이 은은하게 빛나도록
  {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    const sg = new THREE.SphereGeometry(40, 32, 16), cols = [], p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) / 40 + 1) / 2; const c = new THREE.Color('#8f8574').lerp(new THREE.Color('#eef3fb'), Math.pow(t, 0.7)); cols.push(c.r, c.g, c.b); }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pan = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.9, 3.6) });
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 22), pan); const a = k / 6 * Math.PI * 2; m.position.set(30 * Math.cos(a), 6, 30 * Math.sin(a)); m.lookAt(0, 6, 0); es.add(m); }
    const top = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) })); top.position.y = 36; top.rotation.x = Math.PI / 2; es.add(top);
    scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose();
  }
  // 빛: 반구광 + 따뜻한 해(그림자) + 반대편 보조광
  scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x9c8d77, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.3); sun.position.set(9, 21, 8); scene.add(sun);
  if (SHADOW) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 2; sc.far = 60;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  }
  const fill = new THREE.DirectionalLight(0xdbe6ff, 0.55); fill.position.set(-10, 8, -9); scene.add(fill);

  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0 }, o));
  const shadowOn = (m, cast, recv) => { if (SHADOW) { m.castShadow = !!cast; m.receiveShadow = !!recv; } return m; };

  // ---------- 회의장: 바닥·가운데 양탄자·계단 관중석·벽과 창 ----------
  const marble = canvasTex(1024, 1024, (x, w) => {
    const c = w / 2; x.fillStyle = '#ece6dc'; x.fillRect(0, 0, w, w);
    const rr = rng(7);
    for (let k = 0; k < 2600; k++) { const a = rr() * Math.PI * 2, r = rr() * c; x.fillStyle = `rgba(${150 + rr() * 60},${140 + rr() * 50},${120 + rr() * 50},${0.05 + rr() * 0.06})`; x.beginPath(); x.ellipse(c + r * Math.cos(a), c + r * Math.sin(a), 3 + rr() * 18, 1 + rr() * 3, rr() * 3, 0, 7); x.fill(); }
    // 바닥 무늬: 동심원 띠와 방사형 이음매
    [[0.66, 10, '#cdbfa8'], [0.70, 4, '#b79e78'], [0.97, 14, '#d3c6b1'], [0.995, 6, '#a88f6c']].forEach(([f, lw, col]) => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); x.arc(c, c, c * f, 0, 7); x.stroke(); });
    x.strokeStyle = 'rgba(160,140,110,.35)'; x.lineWidth = 2;
    for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; x.beginPath(); x.moveTo(c + Math.cos(a) * c * 0.70, c + Math.sin(a) * c * 0.70); x.lineTo(c + Math.cos(a) * c * 0.97, c + Math.sin(a) * c * 0.97); x.stroke(); }
  });
  const floor = shadowOn(new THREE.Mesh(new THREE.CircleGeometry(16.3, 128), std({ map: marble, roughness: 0.28, envMapIntensity: 0.9 })), false, true);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // 가운데 양탄자: 짙은 남색 + 금빛 고리 + 나라 수만큼의 작은 점(가상의 문장, 실제 기구 문장 아님)
  const rug = canvasTex(1024, 1024, (x, w) => {
    const c = w / 2; const g = x.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, '#2c4d86'); g.addColorStop(0.8, '#1f3765'); g.addColorStop(1, '#172a4f');
    x.fillStyle = g; x.beginPath(); x.arc(c, c, c, 0, 7); x.fill();
    x.strokeStyle = '#d9b45a'; x.lineWidth = 10; x.beginPath(); x.arc(c, c, c * 0.93, 0, 7); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.arc(c, c, c * 0.89, 0, 7); x.stroke();
    x.beginPath(); x.arc(c, c, c * 0.30, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(217,180,90,.5)'; x.lineWidth = 2;
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.beginPath(); x.moveTo(c + Math.cos(a) * c * 0.33, c + Math.sin(a) * c * 0.33); x.quadraticCurveTo(c + Math.cos(a + 0.2) * c * 0.6, c + Math.sin(a + 0.2) * c * 0.6, c + Math.cos(a) * c * 0.86, c + Math.sin(a) * c * 0.86); x.stroke(); }
    x.fillStyle = '#e6c46e';
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; x.beginPath(); x.arc(c + Math.cos(a) * c * 0.8, c + Math.sin(a) * c * 0.8, 9, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,.04)'; const rr = rng(3);
    for (let k = 0; k < 4000; k++) x.fillRect(rr() * w, rr() * w, 2, 2);
  });
  const carpet = shadowOn(new THREE.Mesh(new THREE.CircleGeometry(R_IN - 0.15, 96), std({ map: rug, roughness: 0.95 })), false, true);
  carpet.rotation.x = -Math.PI / 2; carpet.position.y = 0.012; scene.add(carpet);
  // 가짜 그늘(접지감): 단상·계단·벽 밑동이 바닥에 닿는 곳을 옅게 어둡게
  const ao = canvasTex(1024, 1024, (x, w) => {
    const c = w / 2, Rm = 16.3, f = (r) => r / Rm;
    const g = x.createRadialGradient(c, c, 0, c, c, c);
    [[0, 0], [f(5.2), 0], [f(R_IN - 0.1), 0.42], [f(R_PED + 0.05), 0.4], [f(R_PED + 0.9), 0], [f(10.6), 0], [f(11.15), 0.3], [f(11.3), 0], [f(15.2), 0], [f(16.25), 0.35], [1, 0.35]].forEach(([o, a]) => g.addColorStop(Math.min(1, o), `rgba(40,30,20,${a})`));
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  const aoM = new THREE.Mesh(new THREE.CircleGeometry(16.3, 96), new THREE.MeshBasicMaterial({ map: ao, transparent: true, depthWrite: false }));
  aoM.rotation.x = -Math.PI / 2; aoM.position.y = 0.02; aoM.renderOrder = 1; scene.add(aoM);
  // 계단식 관중석
  const tiers = [[11.2, 0.42], [12.5, 0.84], [13.8, 1.26]], TOUT = 15.1;
  {
    const pts = [new THREE.Vector2(11.2, 0)];
    tiers.forEach(([r, y], k) => { pts.push(new THREE.Vector2(r, y)); pts.push(new THREE.Vector2(k < 2 ? tiers[k + 1][0] : TOUT, y)); });
    pts.push(new THREE.Vector2(TOUT, 0));
    // 모서리를 날카롭게: 점을 둘씩 넣지 않고 조각마다 따로 만든다
    const segs = [];
    for (let k = 0; k + 1 < pts.length; k++) segs.push(new THREE.LatheGeometry([pts[k], pts[k + 1]], 128));
    const tg = merge(segs); tg.computeVertexNormals();
    const tierMesh = shadowOn(new THREE.Mesh(tg, std({ color: '#d9d0c2', roughness: 0.55, side: THREE.DoubleSide })), true, true); scene.add(tierMesh);
    // 단 가장자리 놋쇠 띠
    tiers.forEach(([r, y]) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 160), std({ color: '#b8925a', metalness: 0.8, roughness: 0.3 })); t.rotation.x = Math.PI / 2; t.position.y = y; scene.add(t); });
  }
  // 벽: 안쪽 면만 그려(BackSide) 카메라 쪽 벽은 비켜 준다 → 인형의 집처럼 안이 들여다보인다
  const WR = 16.25, WH = 5.4;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, WH, 128, 1, true), std({ color: '#efe9df', roughness: 0.8, side: THREE.BackSide }));
  wall.position.y = WH / 2; scene.add(wall);
  const cornice = new THREE.Mesh(new THREE.CylinderGeometry(WR - 0.25, WR - 0.25, 0.35, 128, 1, true), std({ color: '#c9b48e', roughness: 0.5, metalness: 0.3, side: THREE.BackSide }));
  cornice.position.y = WH - 0.2; scene.add(cornice);
  {
    // 큰 창(바깥 하늘빛)과 기둥 면: 안쪽을 보는 평면이라 카메라 쪽 것은 저절로 안 보인다
    const NW = 20, win = [], pil = [];
    for (let k = 0; k < NW; k++) {
      const a = (k + 0.5) / NW * Math.PI * 2;
      const w = new THREE.PlaneGeometry(2.2, 3.5); w.lookAt(new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a))); w.translate((WR - 0.04) * Math.cos(a), 2.75, (WR - 0.04) * Math.sin(a)); win.push(w);
      const mull = new THREE.PlaneGeometry(0.06, 3.5); mull.lookAt(new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a))); mull.translate((WR - 0.06) * Math.cos(a), 2.75, (WR - 0.06) * Math.sin(a)); pil.push(mull);
      const b2 = new THREE.PlaneGeometry(2.2, 0.06); b2.lookAt(new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a))); b2.translate((WR - 0.06) * Math.cos(a), 3.3, (WR - 0.06) * Math.sin(a)); pil.push(b2);
      const b = k / NW * Math.PI * 2, pg = new THREE.BoxGeometry(0.7, WH - 0.3, 0.35); pg.lookAt(new THREE.Vector3(-Math.cos(b), 0, -Math.sin(b))); pg.translate((WR - 0.2) * Math.cos(b), (WH - 0.3) / 2, (WR - 0.2) * Math.sin(b)); pil.push(pg);
    }
    const winTex = canvasTex(8, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfe4ff'); g.addColorStop(1, '#f4f8ff'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    scene.add(new THREE.Mesh(merge(win), new THREE.MeshBasicMaterial({ map: winTex, fog: false })));
    const pilM = new THREE.Mesh(merge(pil), std({ color: '#e2d8c8', roughness: 0.7 })); scene.add(pilM);
  }
  // 관중석 의자와 참관인(정적, 인스턴스드)
  const chairG = merge([at(new THREE.BoxGeometry(0.46, 0.08, 0.46), 0, 0.46, 0), at(new THREE.BoxGeometry(0.08, 0.55, 0.46), 0.22, 0.78, 0), at(new THREE.CylinderGeometry(0.04, 0.06, 0.42, 8), 0, 0.21, 0)]);
  const gallery = [];
  tiers.forEach(([r, y], k) => {
    const rr = r + 0.62, cnt = Math.floor((2 * Math.PI * rr) / (narrow ? 1.1 : 0.72));
    for (let j = 0; j < cnt; j++) {
      const a = (j + 0.5 * k) / cnt * Math.PI * 2, aisle = Math.min(...[0, 1, 2, 3, 4].map((q) => Math.abs(((a - q * Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI)));
      if (aisle < 0.07) continue;
      gallery.push([rr, a, y]);
    }
  });
  const NCH = N * 2 + gallery.length;
  const chairs = shadowOn(new THREE.InstancedMesh(chairG, std({ color: '#ffffff', roughness: 0.55 }), NCH), true, true);
  chairs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(chairs);
  // 사람(앉은 모습): 몸통 + 팔 / 머리 (색은 사람마다)
  const bodyG = merge([
    at(new THREE.CapsuleGeometry(0.19, 0.34, 3, 8), 0, 0.92, 0),
    at(new THREE.BoxGeometry(0.42, 0.14, 0.4), -0.12, 0.55, 0),                 // 허벅지
    at(new THREE.CapsuleGeometry(0.06, 0.4, 2, 5), -0.24, 0.9, 0.2, 0, Math.PI / 2 - 0.25),   // 앞으로 뻗은 팔
    at(new THREE.CapsuleGeometry(0.06, 0.4, 2, 5), -0.24, 0.9, -0.2, 0, Math.PI / 2 - 0.25),
  ]);
  const headG = merge([at(new THREE.SphereGeometry(0.13, 12, 9), -0.02, 1.36, 0), at(new THREE.SphereGeometry(0.135, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.2), 0.01, 1.39, 0)]);
  const audience = gallery.filter(() => R() < 0.33);
  const NP = N * 2 + audience.length;
  const bodies = shadowOn(new THREE.InstancedMesh(bodyG, std({ color: '#ffffff', roughness: 0.75 }), NP), true, false);
  const heads = shadowOn(new THREE.InstancedMesh(headG, std({ color: '#ffffff', roughness: 0.6 }), NP), true, false);
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage); heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bodies); scene.add(heads);
  const SUITS = ['#1f2a44', '#2b2f36', '#3a3f4b', '#24324f', '#4a3b33', '#5b5f6a', '#6b2f3a', '#2f4a3f', '#8a7a66'].map((c) => new THREE.Color(c));
  const SKIN = ['#f1c9a5', '#e0ac85', '#c68c63', '#9c6a46', '#6f4a33', '#f6d7bd'].map((c) => new THREE.Color(c));
  const HAIR = new THREE.Color('#2a211c');
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(1, 1, 1), yAx = new THREE.Vector3(0, 1, 0);
  const placeAt = (mesh, idx, x, y, z, rotY, s) => { q.setFromAxisAngle(yAx, rotY); pv.set(x, y, z); sv.setScalar(s || 1); m4.compose(pv, q, sv); mesh.setMatrixAt(idx, m4); };
  gallery.forEach(([r, a, y], k) => { placeAt(chairs, N * 2 + k, r * Math.cos(a), y, r * Math.sin(a), -a); chairs.setColorAt(N * 2 + k, new THREE.Color(k % 9 === 0 ? '#6d2b33' : '#7a2e36')); });
  audience.forEach(([r, a, y], k) => {
    const idx = N * 2 + k; placeAt(bodies, idx, r * Math.cos(a), y, r * Math.sin(a), -a, 0.95); placeAt(heads, idx, r * Math.cos(a), y, r * Math.sin(a), -a, 0.95);
    bodies.setColorAt(idx, SUITS[Math.floor(R() * SUITS.length)]); heads.setColorAt(idx, SKIN[Math.floor(R() * SKIN.length)]);
  });

  // ---------- 대표단 자리 (나라마다 같은 모양, 단상 높이만 다름) ----------
  // 지역 좌표: 자리 가운데가 +x 방향(원탁 가운데는 -x 쪽). 인스턴스 행렬 = 높이 올림 × 그 나라 각도로 돌림
  const woodTex = canvasTex(512, 512, (x, w) => {
    x.fillStyle = '#7a4a2c'; x.fillRect(0, 0, w, w); const rr = rng(11);
    for (let k = 0; k < 220; k++) { const y = rr() * w; x.strokeStyle = `rgba(${rr() < 0.5 ? '40,20,10' : '170,110,70'},${0.08 + rr() * 0.12})`; x.lineWidth = 1 + rr() * 3; x.beginPath(); x.moveTo(0, y); for (let s = 0; s <= 8; s++) x.lineTo(s * w / 8, y + Math.sin(s * 0.9 + k) * 4 * rr()); x.stroke(); }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(0.35, 0.35);
  const wood = std({ map: woodTex, roughness: 0.38, envMapIntensity: 0.8 });
  const deskG = merge([sector(R_IN, R_DESK, HW * 0.97, DESK_Y - 0.07, DESK_Y, 0.02), sector(R_IN, R_IN + 0.09, HW * 0.95, 0.05, DESK_Y - 0.07), sector(R_IN, R_DESK - 0.1, HW * 0.06, 0.05, DESK_Y - 0.07)]);
  const desks = shadowOn(new THREE.InstancedMesh(deskG, wood, N), true, true); desks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(desks);
  // 단상(대리석 기둥, 높이로 늘림) + 그 위 양탄자 덮개
  const pedG = sector(R_IN - 0.12, R_PED, HW, 0, 1);
  const peds = shadowOn(new THREE.InstancedMesh(pedG, std({ color: '#f1ece4', roughness: 0.32, envMapIntensity: 1.0 }), N), true, true); peds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(peds);
  const capG = merge([sector(R_IN - 0.1, R_PED - 0.06, HW * 0.985, -0.03, 0.012), sector(R_IN - 0.16, R_IN - 0.08, HW, -0.06, 0.02)]);
  const caps = shadowOn(new THREE.InstancedMesh(capG, std({ color: '#ffffff', roughness: 0.9 }), N), false, true); caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(caps);
  const trimG = sector(R_PED - 0.04, R_PED + 0.02, HW, -0.08, 0.0);
  const trims = new THREE.InstancedMesh(trimG, std({ color: '#c49a55', metalness: 0.85, roughness: 0.28 }), N); trims.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(trims);
  // 책상 위 소품: 서류·마이크·스탠드 몸체(금속)
  const paperG = merge([polar(new THREE.BoxGeometry(0.34, 0.012, 0.25), 6.75, 0.07, DESK_Y + 0.006), polar(new THREE.BoxGeometry(0.3, 0.02, 0.22), 6.88, 0.02, DESK_Y + 0.01, 0.3)]);
  const papers = new THREE.InstancedMesh(paperG, std({ color: '#fbfbf7', roughness: 0.9 }), N); papers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(papers);
  const micG = merge([
    polar(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 12), 6.62, 0.0, DESK_Y + 0.015),
    polar(at(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), 0, 0.17, 0, 0, 0.45), 6.62, 0.0, DESK_Y + 0.02),
    polar(new THREE.SphereGeometry(0.025, 8, 6), 6.53, 0.0, DESK_Y + 0.33),
    polar(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 12), 7.05, -0.095, DESK_Y + 0.01),
    polar(new THREE.CylinderGeometry(0.01, 0.01, 0.36, 6), 7.05, -0.095, DESK_Y + 0.19),
    polar(new THREE.CylinderGeometry(0.02, 0.035, 0.7, 8), 9.3, 0.0, 0.35),                          // 깃대 받침
    polar(new THREE.CylinderGeometry(0.018, 0.018, 2.75, 8), 9.3, 0.0, 1.38),                         // 깃대
    polar(new THREE.SphereGeometry(0.045, 10, 8), 9.3, 0.0, 2.78),
  ]);
  const mics = shadowOn(new THREE.InstancedMesh(micG, std({ color: '#c8ccd2', metalness: 0.9, roughness: 0.25 }), N), true, false); mics.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mics);
  // 스탠드 갓(불빛: 믿을수록 밝게)
  const shadeG = polar(new THREE.CylinderGeometry(0.06, 0.13, 0.12, 14, 1, true), 7.05, -0.095, DESK_Y + 0.4);
  const shades = new THREE.InstancedMesh(shadeG, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), N); shades.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(shades);
  const poolG = polar(new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2), 7.0, -0.095, DESK_Y + 0.004);
  const pools = new THREE.InstancedMesh(poolG, new THREE.MeshBasicMaterial({ color: 0xffffff, map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), N); pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(pools);
  const LAMP_ON = new THREE.Color('#ffd27a'), LAMP_OFF = new THREE.Color('#3c3a36'), POOL_ON = new THREE.Color('#ffcf6a'), POOL_OFF = new THREE.Color('#000000');

  // 나라마다 다른 것: 명패(글자), 가상 깃발, 경고등
  const PAL = ['#c0392b', '#1f6fb2', '#f2c14e', '#2e8b57', '#ffffff', '#1b1f2a', '#e67e22', '#6c3483', '#17a589', '#7fb3d5', '#a93226', '#f5f0e1'];
  const flagUni = { uTime: { value: 0 } };
  const deleg = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(); scene.add(g);
    // 명패: 앞면에 나라 이름. 빛(자체 발광) = 믿음 정도
    const plateTex = canvasTex(256, 88, (x, w, h) => {
      x.fillStyle = '#141a26'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c9a55a'; x.lineWidth = 4; x.strokeRect(5, 5, w - 10, h - 10);
      x.fillStyle = '#fff6df'; x.font = `800 54px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(nm(i), w / 2, h / 2 + 3);
    });
    const plateFace = new THREE.MeshStandardMaterial({ map: plateTex, emissiveMap: plateTex, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.4 });
    const plateBody = std({ color: '#141a26', roughness: 0.4, metalness: 0.2 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.9), [plateBody, plateFace, plateBody, plateBody, plateBody, plateBody]);
    plate.position.set(R_IN + 0.2, DESK_Y + 0.16, 0); plate.rotation.z = -0.22; g.add(plate);
    // 가상 깃발: 띠 2~3개 + 가운데 동그라미(나라 글자). 실제 국기를 본뜨지 않는다
    const fr = rng(101 + i * 17);
    const pick = () => PAL[Math.floor(fr() * PAL.length)];
    let c1 = pick(), c2 = pick(); while (c2 === c1) c2 = pick();
    let c3 = pick(); while (c3 === c1 || c3 === c2) c3 = pick();
    const kind = Math.floor(fr() * 3);
    const flagTex = canvasTex(192, 128, (x, w, h) => {
      if (kind === 0) { x.fillStyle = c1; x.fillRect(0, 0, w, h / 2); x.fillStyle = c2; x.fillRect(0, h / 2, w, h / 2); }
      else if (kind === 1) { [c1, c2, c3].forEach((c, k) => { x.fillStyle = c; x.fillRect(0, k * h / 3, w, h / 3 + 1); }); }
      else { x.fillStyle = c1; x.fillRect(0, 0, w, h); x.fillStyle = c2; x.beginPath(); x.moveTo(0, h); x.lineTo(w, 0); x.lineTo(w, h); x.fill(); }
      x.fillStyle = c3; x.beginPath(); x.arc(w * 0.36, h / 2, h * 0.24, 0, 7); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; x.stroke();
      x.fillStyle = (c3 === '#ffffff' || c3 === '#f2c14e' || c3 === '#f5f0e1' || c3 === '#7fb3d5') ? '#1b1f2a' : '#ffffff'; x.font = `800 34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(LET[i], w * 0.36, h / 2 + 2);
    });
    const fw = 0.92, fh = 0.6, fg = new THREE.PlaneGeometry(fw, fh, 14, 6); fg.translate(fw / 2, 0, 0); fg.rotateY(Math.PI / 2);
    const fm = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.85 });
    const ph = i * 1.7;
    fm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = flagUni.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float d = -position.z; transformed.x += sin(d * 6.5 - uTime * 3.2 + ${ph.toFixed(2)}) * 0.075 * d + sin(d * 11.0 - uTime * 5.0) * 0.012 * d; transformed.y -= d * d * 0.05;`);
    };
    const flag = shadowOn(new THREE.Mesh(fg, fm), true, false);
    flag.position.set(9.3, 2.42, 0.0); g.add(flag);
    // 경고등(약속을 어긴 직후 붉게 깜박) + 번짐
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    beacon.position.set(6.6, DESK_Y + 0.005, 0.32); g.add(beacon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff3b30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(beacon.position); halo.position.y += 0.08; halo.scale.setScalar(1.3); g.add(halo);
    beacon.visible = halo.visible = false;
    deleg.push({ g, plateFace, flag, beacon, halo, broke: -1e9 });
  }

  // ---------- 빛줄기(협상 짝), 파문, 소문 불씨, 선물 상자 ----------
  const beamVS = `varying float vU; varying vec3 vN; varying vec3 vV;
    void main(){ vU = uv.x; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`;
  const beamFS = `uniform vec3 uCol; uniform float uG; uniform float uA; uniform float uMode; uniform float uT; uniform float uHalo; uniform float uMax;
    varying float vU; varying vec3 vN; varying vec3 vV;
    void main(){
      float g = min(uG, uMax), vis, head;
      if (uMode < 0.5) { vis = (vU < g*0.5 || vU > 1.0 - g*0.5) ? 1.0 : 0.0; head = max(1.0 - abs(vU - g*0.5)*14.0, 1.0 - abs(vU - (1.0-g*0.5))*14.0); }
      else { vis = vU < g ? 1.0 : 0.0; head = 1.0 - abs(vU - g)*14.0; }
      if (vis < 0.5) discard;
      float fr = abs(dot(normalize(vN), normalize(vV)));
      float pl = 0.5 + 0.5*sin(vU*46.0 - uT*9.0);
      float a = uHalo > 0.5 ? pow(fr, 1.5) * 0.28 : 0.75 + 0.25*fr;
      vec3 c = uCol * (uHalo > 0.5 ? 1.0 : 0.95 + 0.25*pl) + vec3(1.0) * clamp(head, 0.0, 1.0) * 0.55 * (g < uMax ? 1.0 : 0.0);
      gl_FragColor = vec4(c, uA * a);
      #include <colorspace_fragment>
    }`;
  const C_KEEP = new THREE.Color('#ffc21a'), C_BRK = new THREE.Color('#ff2d2d'), C_REF = new THREE.Color('#9aa3ad');
  const beams = [];
  for (let k = 0; k < 16; k++) {
    const mk = (halo) => new THREE.ShaderMaterial({ vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, fog: false,
      uniforms: { uCol: { value: new THREE.Color() }, uG: { value: 0 }, uA: { value: 1 }, uMode: { value: 0 }, uT: { value: 0 }, uHalo: { value: halo ? 1 : 0 }, uMax: { value: 1 } } });
    const core = new THREE.Mesh(new THREE.BufferGeometry(), mk(false)), glow = new THREE.Mesh(new THREE.BufferGeometry(), mk(true));
    core.renderOrder = 5; glow.renderOrder = 4; core.frustumCulled = glow.frustumCulled = false; core.visible = glow.visible = false;
    scene.add(glow); scene.add(core);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    flash.visible = false; flash.renderOrder = 6; scene.add(flash);
    beams.push({ core, glow, flash, kind: '', mid: new THREE.Vector3() });
  }
  // 파문: 어긴 자리에서 책상 높이로 번지는 붉은 고리 (두 겹)
  const ringG = new THREE.RingGeometry(0.76, 1, 64); ringG.rotateX(-Math.PI / 2);
  const ripples = [];
  for (let k = 0; k < 20; k++) { const m = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xff2d2d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false })); m.visible = false; m.renderOrder = 3; scene.add(m); ripples.push({ m, born: -1e9, delay: 0 }); }
  // 소문 불씨: 점(머리 + 꼬리 3개)
  const NG = 64, GP = NG * 4;
  const gPos = new Float32Array(GP * 3), gCol = new Float32Array(GP * 4), gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 4));
  const sparks = new THREE.Points(gGeo, new THREE.PointsMaterial({ size: narrow ? 0.62 : 0.5, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, fog: false }));
  sparks.frustumCulled = false; sparks.renderOrder = 7; scene.add(sparks);
  const gossip = []; for (let k = 0; k < NG; k++) gossip.push({ on: false, born: -1e9, t0: 0, dur: 0 });
  const SPARK = new THREE.Color('#ff7a12');
  // 선물 상자(사과·보상)
  const giftG = new THREE.BoxGeometry(0.34, 0.26, 0.34), ribbonG = merge([new THREE.BoxGeometry(0.36, 0.28, 0.07), new THREE.BoxGeometry(0.07, 0.28, 0.36), at(new THREE.TorusGeometry(0.06, 0.02, 6, 12), 0, 0.16, 0)]);
  const gifts = new THREE.InstancedMesh(giftG, std({ color: '#e8f4ff', roughness: 0.5 }), 12), ribbons = new THREE.InstancedMesh(ribbonG, std({ color: '#e0457b', roughness: 0.4, metalness: 0.2 }), 12);
  gifts.count = ribbons.count = 0; gifts.frustumCulled = ribbons.frustumCulled = false; scene.add(gifts); scene.add(ribbons);
  let giftList = [];

  // ---------- 상태 따라가기 ----------
  let simRef = null, seenT = -1, seatA = new Float32Array(N), roundAt = 0, nInt = 0.2, prevBreaks = [];
  const hNow = new Float32Array(N);
  const seatPt = (i, r, y, out) => { const a = seatA[i]; out.set(r * Math.cos(a), y, r * Math.sin(a)); return out; };
  function rebuild(sim) {
    // 나라를 원래 망의 각도 순서대로 원탁에 앉힌다 → 소식을 주고받는 이웃이 대체로 옆자리
    const n = sim.n, ord = [...Array(n).keys()].sort((a, b) => Math.atan2(sim.net.pos[a][1], sim.net.pos[a][0]) - Math.atan2(sim.net.pos[b][1], sim.net.pos[b][0]));
    seatA = new Float32Array(n); ord.forEach((ci, k) => { seatA[ci] = -Math.PI / 2 + k * (Math.PI * 2 / n) + Math.PI / n; });
    const rr = rng(sim.params.seed * 31 + 5);
    for (let i = 0; i < n; i++) {
      [0, 1].forEach((j) => { bodies.setColorAt(i * 2 + j, SUITS[Math.floor(rr() * 6)]); heads.setColorAt(i * 2 + j, SKIN[Math.floor(rr() * SKIN.length)]); chairs.setColorAt(i * 2 + j, new THREE.Color('#3a2a22')); });
      caps.setColorAt(i, new THREE.Color(i % 2 ? '#7d2730' : '#6f2029'));
      deleg[i].broke = -1e9;
    }
    [bodies, heads, chairs, caps].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    seenT = -1; prevBreaks = []; giftList = [];
    gossip.forEach((p) => { p.on = false; }); ripples.forEach((r) => { r.born = -1e9; r.m.visible = false; });
    beams.forEach((b) => { b.core.visible = b.glow.visible = b.flash.visible = false; });
  }
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  function arc(i, j, H, lift, rA) {
    seatPt(i, rA || R_IN + 0.35, hOf(H[i]) + DESK_Y + 0.42, tmpA); seatPt(j, rA || R_IN + 0.35, hOf(H[j]) + DESK_Y + 0.42, tmpB);
    const d = tmpA.distanceTo(tmpB);
    tmpC.addVectors(tmpA, tmpB).multiplyScalar(0.5 * 0.85); tmpC.y = Math.max(tmpA.y, tmpB.y) + lift + 0.2 * d;
    return new THREE.QuadraticBezierCurve3(tmpA.clone(), tmpC.clone(), tmpB.clone());
  }
  function newRound(sim, st) {
    const LR = sim.lastRound, S1 = sim.stand;
    roundAt = st.lastStepAt; nInt = st.interval;
    const brk = new Map(); (LR.breaks || []).forEach(({ i, j }) => { brk.set(i, j); });
    // 짝마다 빛줄기
    let k = 0;
    (LR.pairs || []).forEach((pr) => {
      if (k >= beams.length) return;
      const b = beams[k++]; let i = pr.i, j = pr.j, mode = 0, col = C_KEEP, max = 1;
      if (pr.kind === 'break') {
        col = C_BRK;
        const bi = brk.has(i), bj = brk.has(j);
        if (bi && bj) mode = 0; else { mode = 1; if (bj) { const t = i; i = j; j = t; } }
      } else if (pr.kind === 'refuse') { col = C_REF; max = 0.62; }
      const cv = arc(i, j, S1, pr.kind === 'refuse' ? 0.5 : 0.9);
      [b.core, b.glow].forEach((m, h) => {
        m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(cv, 44, h ? (narrow ? 0.16 : 0.13) : (narrow ? 0.055 : 0.045), h ? 8 : 6, false);
        const u = m.material.uniforms; u.uCol.value.copy(col); u.uMode.value = mode; u.uMax.value = max; u.uG.value = 0; m.visible = true;
      });
      b.kind = pr.kind; cv.getPoint(0.5, b.mid); b.flash.visible = false;
    });
    for (; k < beams.length; k++) { const b = beams[k]; b.core.visible = b.glow.visible = b.flash.visible = false; b.kind = ''; }
    // 약속을 어긴 자리: 파문 두 겹 + 경고등
    (LR.breaks || []).forEach(({ i }) => {
      deleg[i].broke = roundAt;
      [0, 0.35].forEach((dl) => { const r = ripples.find((o) => (performance.now() - o.born) / 1000 > 2.2 + o.delay) || ripples[0]; r.born = roundAt; r.delay = dl; r.i = i; });
    });
    // 나쁜 소식이 건너간 연결: 불씨가 옆 나라로 건너간다
    // (불씨는 라운드가 바뀌어도 날던 길을 끝까지 간다: 빈 자리에만 새로 띄운다)
    const nowMs = performance.now(), iv = Math.max(0.1, nInt), dur = Math.max(0.35, iv * 0.6);
    (LR.gossip || []).forEach(([u, w, mv]) => {
      const p = gossip.find((o) => !o.on || (nowMs - o.born) / 1000 > o.t0 + o.dur + 0.2); if (!p) return;
      p.on = true; p.born = roundAt; p.cv = arc(u, w, S1, 0.35, R_IN + 0.9); p.t0 = (0.3 + 0.25 * ((u * 7 + w * 3) % 10) / 10) * iv; p.dur = dur; p.amp = Math.min(1, 0.45 + mv);
    });
    // 사과·보상: 지난 라운드에 어긴 나라가 이번 라운드에 당한 나라에게 물어 준다(sim.js 규칙)
    giftList = [];
    if (sim.params.apology > 0) prevBreaks.slice(0, 12).forEach(({ i, j }) => { giftList.push(arc(i, j, S1, 1.1, R_IN + 0.6)); });
    prevBreaks = (LR.breaks || []).slice();
  }

  // ---------- 화면 위 이름표(HTML) ----------
  const labels = [];
  const mkLab = (cls) => { const d = document.createElement('div'); d.className = 'rp3-lab ' + cls; d.innerHTML = '<i></i><span></span>'; d.style.display = 'none'; wrap.appendChild(d); const o = { d, txt: '', sp: d.querySelector('span') }; labels.push(o); return o; };
  const brkLabs = [mkLab('brk'), mkLab('brk'), mkLab('brk')], fLab = mkLab('forced'), topLab = mkLab('top');
  const panel = document.createElement('div'); panel.className = 'rp3-panel'; panel.innerHTML = '<div class="cap">협상 회의</div><div class="val"></div>'; wrap.appendChild(panel);
  const pval = panel.querySelector('.val');
  const setTxt = (o, t) => { if (o.txt !== t) { o.txt = t; o.sp.textContent = t; } };
  const pp = new THREE.Vector3();
  function place(o, i, y, show, H) {
    if (!show) { o.d.style.display = 'none'; o.vis = false; return; }
    seatPt(i, R_PED - 0.6, hOf(H[i]) + y, pp).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, sx = (pp.x + 1) / 2 * w, sy = (1 - pp.y) / 2 * h;
    o.vis = pp.z < 1 && sx > 30 && sx < w - 30 && sy > 24 && sy < h - 4;
    o.d.style.display = o.vis ? '' : 'none'; o.sx = sx; o.sy = sy;
    if (o.vis) o.d.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
  }
  function declutter() {
    // 겹치는 이름표는 뒤에 온 것을 숨긴다(휴대폰에서 글자 겹침 방지)
    const shown = [];
    labels.forEach((o) => {
      if (!o.vis) return;
      const w = o.d.offsetWidth || 70, h = o.d.offsetHeight || 20, r = [o.sx - w / 2, o.sy - h, o.sx + w / 2, o.sy];
      if (shown.some((s) => r[0] < s[2] + 4 && r[2] > s[0] - 4 && r[1] < s[3] + 2 && r[3] > s[1] - 2)) { o.d.style.display = 'none'; return; }
      shown.push(r);
    });
  }

  // ---------- 매 프레임 ----------
  const rot = $('rp-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const colT = new THREE.Color();
  function update(dt, tSec) {
    const st = window.RepState; if (!st || !st.sim) return;
    const sim = st.sim, n = sim.n;
    if (sim !== simRef) { simRef = sim; rebuild(sim); }
    if (sim.t !== seenT) { if (sim.t > 0 && sim.lastRound && sim.lastRound.t === sim.t) newRound(sim, st); else { prevBreaks = []; beams.forEach((b) => { b.core.visible = b.glow.visible = b.flash.visible = false; }); gossip.forEach((p) => { p.on = false; }); giftList = []; } seenT = sim.t; }
    const now = st.thumb ? st.lastStepAt + st.interval * 1000 * 0.72 : performance.now();
    const el = (now - roundAt) / 1000, iv = Math.max(0.1, nInt);
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const S0 = sim.standPrev, S1 = sim.stand, T = tSec || 0;
    flagUni.uTime.value = T;
    // 대표단 자리
    for (let i = 0; i < n; i++) {
      const s = S0[i] + (S1[i] - S0[i]) * ease(a), h = hOf(s); hNow[i] = s;
      const ang = seatA[i], ry = -ang;
      q.setFromAxisAngle(yAx, ry);
      pv.set(0, 0, 0); sv.set(1, h, 1); m4.compose(pv, q, sv); peds.setMatrixAt(i, m4);
      pv.set(0, h, 0); sv.set(1, 1, 1); m4.compose(pv, q, sv);
      [desks, caps, trims, papers, mics, shades, pools].forEach((m) => m.setMatrixAt(i, m4));
      // 대표 두 사람과 의자(책상 뒤, 가운데를 보며 앉음)
      [[7.95, 0.045], [8.85, -0.07]].forEach(([r, da], j) => {
        const aa = ang + da, x = r * Math.cos(aa), z = r * Math.sin(aa);
        placeAt(chairs, i * 2 + j, x, h, z, -aa);
        const bob = st.thumb ? 0 : Math.sin(T * 1.3 + i * 2.1 + j) * 0.012;
        placeAt(bodies, i * 2 + j, x, h + bob, z, -aa); placeAt(heads, i * 2 + j, x, h + bob, z, -aa + Math.sin(T * 0.5 + i) * 0.25);
      });
      const D = deleg[i]; D.g.position.set(0, h, 0); D.g.rotation.y = ry;
      D.plateFace.emissiveIntensity = 0.06 + 1.5 * Math.pow(s, 1.4);
      colT.copy(LAMP_OFF).lerp(LAMP_ON, Math.pow(s, 1.2)); shades.setColorAt(i, colT);
      colT.copy(POOL_OFF).lerp(POOL_ON, Math.pow(s, 1.6) * 0.8); pools.setColorAt(i, colT);
      const ba = (now - D.broke) / 1000, on = ba >= 0 && ba < 2.6;
      D.beacon.visible = D.halo.visible = on;
      if (on) { const pul = 0.55 + 0.45 * Math.abs(Math.sin(ba * 6)); D.halo.material.opacity = pul; D.halo.scale.setScalar(1.0 + 0.9 * pul); }
    }
    [peds, desks, caps, trims, papers, mics, shades, pools, chairs, bodies, heads].forEach((m) => { m.count = m === chairs ? NCH : m === bodies || m === heads ? NP : n; m.instanceMatrix.needsUpdate = true; });
    if (shades.instanceColor) shades.instanceColor.needsUpdate = true; if (pools.instanceColor) pools.instanceColor.needsUpdate = true;
    // 빛줄기: 양쪽 자리에서 자라 나와 가운데서 만난다(악수). 회색은 중간에서 끊김
    const g = ease(el / (iv * 0.45));
    beams.forEach((b) => {
      if (!b.kind) return;
      [b.core, b.glow].forEach((m) => { const u = m.material.uniforms; u.uG.value = g; u.uT.value = T; u.uA.value = 1; });
      if (b.kind === 'keep') {
        const f = (el - iv * 0.45) / Math.max(0.25, iv * 0.6);
        b.flash.visible = f > 0 && f < 1; if (b.flash.visible) { const k = Math.sin(f * Math.PI); b.flash.position.copy(b.mid); b.flash.scale.setScalar(0.3 + 1.1 * k); b.flash.material.opacity = 0.9 * k; }
        if (st.thumb) { b.flash.visible = true; b.flash.position.copy(b.mid); b.flash.scale.setScalar(0.9); b.flash.material.opacity = 0.7; }
      } else if (b.kind === 'break') {
        const f = (el - iv * 0.45) / 0.5;
        b.flash.visible = f > 0 && f < 1; if (b.flash.visible) { b.flash.material.color.set(0xff5544); const cv = b.core.geometry.parameters.path; cv.getPoint(1, b.flash.position); b.flash.scale.setScalar(0.4 + 1.2 * Math.sin(f * Math.PI)); b.flash.material.opacity = Math.sin(f * Math.PI); }
      }
      if (b.kind === 'keep') b.flash.material.color.set(0xffe08a);
    });
    // 파문
    ripples.forEach((r) => {
      let age = (now - r.born) / 1000 - r.delay; if (st.thumb && age >= -0.4 && age < 2) age = Math.max(age, 0.5 - r.delay * 0.8);
      const life = 1.9;
      if (age < 0 || age > life || r.i == null) { r.m.visible = false; return; }
      const t = age / life, i = r.i; r.m.visible = true;
      seatPt(i, 7.2, hOf(hNow[i]) + DESK_Y + 0.08, r.m.position);
      r.m.scale.setScalar(0.5 + 6.5 * t); r.m.material.opacity = 0.95 * (1 - t) * (1 - t);
    });
    // 소문 불씨
    let gi = 0;
    gossip.forEach((p) => {
      if (!p.on) return;
      const u = ((now - p.born) / 1000 - p.t0) / p.dur;
      if (u < 0 || u > 1.15) return;
      for (let k = 0; k < 4; k++) {
        const uu = Math.max(0, Math.min(1, u - k * 0.055)); p.cv.getPoint(uu, pp);
        const o = gi * 3; gPos[o] = pp.x; gPos[o + 1] = pp.y; gPos[o + 2] = pp.z;
        const al = (k === 0 ? 1 : 0.55 / k) * p.amp * (u > 1 ? Math.max(0, 1 - (u - 1) / 0.15) : 1);
        const c4 = gi * 4; gCol[c4] = SPARK.r * (k ? 1 : 1.4); gCol[c4 + 1] = SPARK.g * (k ? 1 : 1.4); gCol[c4 + 2] = SPARK.b; gCol[c4 + 3] = al;
        gi++;
      }
    });
    gGeo.setDrawRange(0, gi); gGeo.attributes.position.needsUpdate = true; gGeo.attributes.color.needsUpdate = true;
    // 선물 상자
    let gc = 0;
    giftList.forEach((cv) => {
      const u = st.thumb ? 0.5 : (el - iv * 0.1) / Math.max(0.4, iv * 0.8);
      if (u < 0 || u > 1) return;
      cv.getPoint(u, pp); q.setFromAxisAngle(yAx, u * 6); sv.setScalar(Math.min(1, Math.sin(u * Math.PI) * 3)); m4.compose(pp, q, sv);
      gifts.setMatrixAt(gc, m4); ribbons.setMatrixAt(gc, m4); gc++;
    });
    gifts.count = ribbons.count = gc; gifts.instanceMatrix.needsUpdate = ribbons.instanceMatrix.needsUpdate = true;
    // 이름표
    const maxB = narrow ? 2 : 3, fo = st.forced && st.forced();
    const fresh = [];
    for (let i = 0; i < n; i++) { const ba = (now - deleg[i].broke) / 1000; if (ba >= 0 && ba < 2.6 && !(fo && fo.i === i)) fresh.push([ba, i]); }
    fresh.sort((x, y) => x[0] - y[0]);
    brkLabs.forEach((o, k) => {
      const b = k < maxB ? fresh[k] : null, show = !!b;
      if (show) setTxt(o, `${nm(b[1])} 약속 깸`);
      place(o, show ? b[1] : 0, 2.25, show, hNow);
    });
    const recovered = fo && sim.recov.some((r) => r.forced);
    const fShow = !!fo && !recovered && !sim.done;
    if (fShow) setTxt(fLab, fo.t ? `${nm(fo.i)} · 일부러 약속을 깬 나라` : `${nm(fo.i)} · 다음 협상에서 약속을 깨요`);
    place(fLab, fShow ? fo.i : 0, 2.6, fShow, hNow);
    let best = 0; for (let i = 1; i < n; i++) if (S1[i] > S1[best]) best = i;
    const tShow = !narrow && sim.t > 0 && !(fShow && fo.i === best);
    if (tShow) setTxt(topLab, `${nm(best)} · 가장 믿음직한 나라`);
    place(topLab, best, 2.6, tShow, hNow);
    declutter();
    const pv2 = `${sim.t} / ${sim.params.rounds}라운드`; if (pval.textContent !== pv2) pval.textContent = pv2;
  }
  let lastFrameAt = performance.now();
  v.onFrame((dt, t) => { lastFrameAt = performance.now(); update(dt, t); });
  update(0.016, 0);
  // 안전장치: 공용 create3D의 '화면에 보이는지' 감시가 빠른 스크롤에서 어긋나 그리기가 멈춘 채로 남는 경우가 있어,
  // 이 캔버스가 실제로 보이는데 0.5초 넘게 프레임이 없으면 여기서 대신 그린다(평소에는 아무것도 하지 않음)
  let seen = true, lastOwn = performance.now();
  new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; }).observe(canvas);
  (function own(now) {
    if (seen && !document.hidden && now - lastFrameAt > 500) { update(Math.min(0.1, (now - lastOwn) / 1000), now / 1000); controls.update(); v.render(); }
    lastOwn = now; requestAnimationFrame(own);
  })(performance.now());
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(narrow ? 2 : 4.5, narrow ? 17 : 12.5, narrow ? 21 : 18.5); controls.target.set(0, 1.2, 0);
    const shot = () => { update(0, 1.2); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Rep3D = { v, update, stats: () => ({ seats: N, gallery: gallery.length, audience: audience.length, shadow: SHADOW, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }) };
}

// 캔버스를 감싸 이름표를 겹쳐 올릴 자리를 만든다(create3D보다 먼저: 크기 감시가 부모를 본다)
let wrap = null;
if (canvas && st0) {
  const css = document.createElement('style');
  css.textContent = `
.rp3-wrap{position:relative;overflow:hidden;border-radius:14px}
.rp3-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;display:flex;align-items:center;gap:5px;font:600 11.5px/1.25 ${FONT};color:#1f2937;background:rgba(255,255,255,.93);border:1px solid #d5dae1;border-radius:9px;padding:2px 8px;box-shadow:0 1px 4px rgba(15,23,42,.14);will-change:transform}
.rp3-lab i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e03131}
.rp3-lab.forced i{background:#111827}.rp3-lab.top i{background:#f5b301}
.rp3-panel{position:absolute;right:10px;top:10px;padding:5px 10px 6px;border-radius:12px;background:rgba(255,255,255,.9);border:1px solid #d5dae1;box-shadow:0 1px 5px rgba(15,23,42,.14);text-align:center;pointer-events:none;font-family:${FONT}}
.rp3-panel .cap{font-size:10.5px;color:#6b7280;line-height:1.2}
.rp3-panel .val{font-size:15px;font-weight:800;color:#111827;line-height:1.25}
@media (max-width:640px){.rp3-panel{right:6px;top:6px;padding:3px 7px 4px}.rp3-panel .cap{font-size:9.5px}.rp3-panel .val{font-size:12.5px}.rp3-lab{font-size:10.5px;padding:1px 6px}}
`;
  document.head.appendChild(css);
  wrap = document.createElement('div'); wrap.className = 'rp3-wrap';
  canvas.parentNode.insertBefore(wrap, canvas); wrap.appendChild(canvas);
  canvas.setAttribute('aria-label', '3D view of a round-table conference hall where 24 imaginary delegations negotiate');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1';
  const v = create3D(canvas, { camera: narrow ? [0, 18.5, 22.5] : [0, 12.5, 21], target: [0, 1.2, 0], background: '#e6ebf2', autoRotateSpeed: 0.35, minDistance: 8, maxDistance: 55, fov: 42, far: 300 });
  if (v) init(v, narrow);
}
