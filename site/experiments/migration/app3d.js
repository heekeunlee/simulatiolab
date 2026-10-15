// ① 가상의 땅 위 여섯 갈래 길 (3D): app.js가 window.MigState로 내보내는 같은 sim을 그대로 보여 준다(3D에서 새로 계산하지 않음).
// - 바닥: 가상의 땅(산맥·경계를 이루는 강·사막·바다). 실제 지도가 아니다.
// - 길 = 땅을 따라 깔린 색 띠(색은 2D 그래프와 같은 길 색: 파랑 안전 → 빨강 위험). 강 건너기 길은 강 위에서 끊긴다(헤엄·배)
// - 점 = 이번 달 그 길을 나선 사람(점 하나 = 여러 명). 점의 수는 sim.flow의 지난달 값, 빠르기는 그 길의 지금 부담(sim.costs)에만 따른 보기용 움직임
// - 막은 길: 경계(강)에 붉은 벽이 막는 세기만큼 솟고, 되돌려 보내진 사람 몫의 점은 벽에서 분홍색으로 돌아간다
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.MigState;
const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);

// ---------- 가상의 땅 (x = 서→동, z = 북→남) ----------
const riverX = (z) => 1 + 1.2 * Math.sin(z * 0.35);
const coastZ = (x) => 11.2 + 1.0 * Math.sin(x * 0.22 + 0.6);
function ground(x, z) {   // [높이, 종류] 종류: 0 들판, 1 산, 2 사막, 3 바다, 4 강
  if (z > coastZ(x)) return [-0.4, 3];
  if (Math.abs(x - riverX(z)) < 0.85 && z > -15.5) return [-0.3, 4];
  const ridge = Math.exp(-((z + 13) ** 2) / 9) * (0.75 + 0.25 * Math.sin(x * 0.55) * Math.cos(x * 0.21 + 1));
  const mtn = 4.2 * ridge * (1 - 0.35 * Math.exp(-(x * x) / 30));
  if (mtn > 0.6) return [0.15 + mtn, 1];
  if (z > 5.2 && z < 10.4 && Math.abs(x) < 18) return [0.15 + 0.18 * (1 + Math.sin(x * 1.3 + z * 0.8)), 2];
  return [0.15 + mtn, 0];
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
function lut(pts, N = 260) {
  const cv = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const P = cv.getSpacedPoints(N - 1), X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N), A = new Float32Array(N), K = new Uint8Array(N);
  for (let i = 0; i < N; i++) { X[i] = P[i].x; Z[i] = P[i].z; const [h, k] = ground(X[i], Z[i]); Y[i] = Math.max(0.05, h) + 0.14; K[i] = k; }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); A[i] = Math.atan2(Z[b] - Z[a], X[b] - X[a]); }
  return { X, Y, Z, A, K, N };
}
function at(L, u, out) {
  const f = Math.max(0, Math.min(0.99999, u)) * (L.N - 1), i = f | 0, r = f - i;
  out[0] = L.X[i] + (L.X[i + 1] - L.X[i]) * r; out[1] = L.Y[i] + (L.Y[i + 1] - L.Y[i]) * r; out[2] = L.Z[i] + (L.Z[i + 1] - L.Z[i]) * r; out[3] = L.A[i];
  return out;
}
function ribbon(L, w, skip) {   // 땅 높이를 따라가는 띠. skip(i)가 참인 곳은 끊는다
  const pos = [], idx = []; let prev = -1;
  for (let i = 0; i < L.N; i++) {
    if (skip && skip(i)) { prev = -1; continue; }
    const a = L.A[i], nx = -Math.sin(a) * w / 2, nz = Math.cos(a) * w / 2, v = pos.length / 3;
    pos.push(L.X[i] + nx, L.Y[i], L.Z[i] + nz, L.X[i] - nx, L.Y[i], L.Z[i] - nz);
    if (prev >= 0) idx.push(prev, v, prev + 1, prev + 1, v, v + 1);
    prev = v;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}

if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of six routes across an imaginary land');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: narrow ? [0, 64, 42] : [4, 30, 34], target: [0, 0, narrow ? 1 : 1.5], background: '#eaf3fb', dark: false, autoRotate: false, autoRotateSpeed: 0.35, minDistance: 14, maxDistance: 110, fov: 45 });
  if (v) init(v, narrow);
}

function init(v, narrow) {
  const { scene, camera, controls } = v;
  const MG = window.Migration, R = MG.ROUTES, COL = st0.colors;
  const sun = scene.children.find((o) => o.isDirectionalLight); if (sun) sun.position.set(-8, 16, 10);

  // ---------- 땅 ----------
  const GW = 84, GD = 52, SX = 168, SZ = 104;
  const g = new THREE.PlaneGeometry(GW, GD, SX, SZ); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const PAL = [new THREE.Color('#d5e8bd'), new THREE.Color('#b8ab90'), new THREE.Color('#f1deae'), new THREE.Color('#8ec9ea'), new THREE.Color('#7fbfe6')], SNOW = new THREE.Color('#f7f7f4');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), [hgt, k] = ground(x, z);
    pos.setY(i, hgt); c.copy(PAL[k]); if (k === 1) c.lerp(SNOW, Math.min(1, Math.max(0, (hgt - 2.6) / 1.6)));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD), new THREE.MeshBasicMaterial({ color: '#9fd3ef', transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.02; scene.add(water);

  // 마을: 출발 지역(서), 도착 지역(동) 작은 집들
  const houses = [], rnd = MG.mulberry32(7);
  [[-29.5, -24.8], [24.8, 29.5]].forEach(([x0, x1]) => { for (let k = 0; k < 26; k++) houses.push([x0 + rnd() * (x1 - x0), -4.8 + rnd() * 9.6, 0.5 + rnd() * 0.7]); });
  const hm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1, 0.9), new THREE.MeshLambertMaterial({ color: '#ffffff' }), houses.length);
  const dm = new THREE.Object3D();
  houses.forEach(([x, z, h], k) => { dm.position.set(x, 0.15 + h / 2, z); dm.scale.set(1, h, 1); dm.updateMatrix(); hm.setMatrixAt(k, dm.matrix); hm.setColorAt(k, new THREE.Color(x < 0 ? '#f3efe6' : '#e9eef6')); });
  scene.add(hm);

  // ---------- 이름표 (캔버스 글자 → 스프라이트) ----------
  function makeLabel(scale) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
    sp.scale.set(scale * 5.33, scale, 1); sp.renderOrder = 10; scene.add(sp);
    let last = '';
    sp.userData.set = (text, color) => {
      text = tr(text); if (text + color === last) return; last = text + color;
      const x = cv.getContext('2d'); x.clearRect(0, 0, 512, 96);
      x.font = '700 40px ' + FONT; const w = Math.min(500, x.measureText(text).width + 36);
      x.fillStyle = 'rgba(255,255,255,.93)'; x.beginPath(); x.roundRect(256 - w / 2, 14, w, 68, 34); x.fill();
      x.lineWidth = 4; x.strokeStyle = color; x.stroke();
      x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 49, 470); tx.needsUpdate = true;
    };
    return sp;
  }
  const town = [makeLabel(narrow ? 2.8 : 1.9), makeLabel(narrow ? 2.8 : 1.9)];
  town[0].position.set(-27, 3.2, -6.6); town[0].userData.set('출발 지역', '#334155');
  town[1].position.set(27, 3.2, -6.6); town[1].userData.set('도착 지역', '#334155');

  // ---------- 길 ----------
  const LUT = PATHS.map((p) => lut(p));
  const white = new THREE.Color('#ffffff');
  LUT.forEach((L, i) => {
    const col = new THREE.Color(COL[i]).lerp(white, 0.15);
    const skip = i === 2 ? (k) => L.K[k] === 4 : null;   // 강 건너기: 강 위에서 끊김
    const m = new THREE.Mesh(ribbon(L, narrow ? 0.95 : 0.7, skip), new THREE.MeshBasicMaterial({ color: col, transparent: i === 5, opacity: i === 5 ? 0.7 : 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.renderOrder = 2; scene.add(m);
  });
  // 정식 관문: 강 위의 문(기둥 둘 + 지붕)
  {
    const p = at(LUT[0], 0.5, []), a = p[3], nx = -Math.sin(a), nz = Math.cos(a), mat = new THREE.MeshLambertMaterial({ color: '#94a3b8' });
    [-1, 1].forEach((s) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 0.35), mat); b.position.set(p[0] + nx * s * 0.75, p[1] + 0.8, p[2] + nz * s * 0.75); scene.add(b); });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.0), mat); top.position.set(p[0], p[1] + 1.7, p[2]); top.rotation.y = -a; scene.add(top);
  }
  const labels = R.map(() => makeLabel(narrow ? 2.6 : 2.0));
  const LU = [0.76, 0.76, 0.76, 0.7, 0.72, 0.7];
  labels.forEach((sp, i) => { const p = at(LUT[i], LU[i], []); sp.position.set(p[0], p[1] + (narrow ? 2.2 : 1.6), p[2]); });

  // 막는 벽: 길마다 하나(막은 길만 보임). 높이 = 막는 세기
  const walls = LUT.map((L) => {
    const p = at(L, 0.5, []), m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 3.0), new THREE.MeshLambertMaterial({ color: '#dc2626', emissive: '#4a0b0b' }));
    m.position.set(p[0], p[1], p[2]); m.rotation.y = -p[3]; m.scale.y = 0.001; m.visible = false; m.userData.base = p[1]; scene.add(m); return m;
  });

  // ---------- 사람 점 ----------
  const MAXP = narrow ? 360 : 900, PER = narrow ? 4 : 2;   // 점 하나 = PER명
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(narrow ? 0.32 : 0.22, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffffff' }), MAXP);
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.frustumCulled = false; dots.renderOrder = 4; scene.add(dots);
  const C_GO = new THREE.Color('#1e293b'), C_BACK = new THREE.Color('#db2777');
  for (let k = 0; k < MAXP; k++) dots.setColorAt(k, C_GO);
  const phase = R.map((_, i) => i * 0.137), tmp = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
  let wallH = 0, simRef = null, rotOn = false;
  const rot = $('mg-rotate');
  if (rot) rot.addEventListener('change', () => { rotOn = rot.value === 'on'; controls.autoRotate = rotOn; });
  controls.addEventListener('end', () => { setTimeout(() => { controls.autoRotate = rotOn; }, 4100); });

  function update(dt) {
    const st = window.MigState; if (!st || !st.sim) return;
    const sim = st.sim, t = sim.t, P = sim.params;
    if (sim !== simRef) { simRef = sim; wallH = sim.blocked ? P.strength / 100 : 0; }
    const run = !(st.isPaused() || st.thumb) ? dt * (Number(($('speed') || {}).value || 3) / 3) : 0;
    const G = sim.costs(), F = t ? sim.flow[t - 1] : R.map(() => 0), back = t ? sim.back[t - 1] : 0;
    // 벽: 막은 길에서 막는 세기만큼 솟는다 (부드럽게)
    const want = sim.blocked ? Math.max(0.08, P.strength / 100) : 0;
    wallH += (want - wallH) * (st.thumb ? 1 : Math.min(1, dt * 3));
    walls.forEach((w, i) => { const on = i === P.block && wallH > 0.01; w.visible = on; if (on) { w.scale.y = wallH * 3.2; w.position.y = w.userData.base + wallH * 1.6; } });
    let n = 0;
    for (let i = 0; i < R.length; i++) {
      const lap = 4 + G[i] / 9;   // 부담이 클수록 천천히(보기용)
      phase[i] = (phase[i] + run / lap) % 1;
      const np = Math.min(Math.round(F[i] / PER), MAXP - n), nb = i === P.block && sim.blockedAt[t - 1] ? Math.min(np, Math.round(back / PER)) : 0;
      for (let k = 0; k < np; k++) {
        let ph = (phase[i] + (k + 0.5) / np + (k % 3) * 0.004) % 1, u = ph, isBack = false;
        if (k < nb) { u = ph < 0.5 ? ph : 1 - ph; isBack = ph >= 0.5; }
        at(LUT[i], u, tmp);
        const off = ((k * 37) % 7 - 3) * 0.07, a = tmp[3];
        pv.set(tmp[0] - Math.sin(a) * off, tmp[1] + 0.2, tmp[2] + Math.cos(a) * off);
        m4.compose(pv, q, s1); dots.setMatrixAt(n, m4); dots.setColorAt(n, isBack ? C_BACK : C_GO); n++;
      }
      const name = R[i].ko;
      labels[i].userData.set(narrow ? `${name} ${Math.round(F[i])}명` : `${name} · 위험 ${R[i].risk}% · ${Math.round(F[i])}명`, COL[i]);
    }
    dots.count = n; dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
  }
  v.onFrame((dt) => update(dt));
  update(0.016);
  if (st0.thumb) {
    controls.autoRotate = false; labels.concat(town).forEach((sp) => { sp.visible = false; });   // 썸네일엔 글자 대신 모양만
    camera.position.set(2, 30, 27); controls.target.set(0, 0, 2.5);
    const shot = () => { update(0.016); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Mig3D = { v, update };
}
