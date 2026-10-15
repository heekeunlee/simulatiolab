// ① 나라들의 평판 망 (3D): app.js가 window.RepState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 나라 = 구슬(인스턴스드 메시). 높이·밝기 = 다른 나라들이 그 나라에 가진 나쁜 기억이 적을수록 높고 밝게 (sim.stand = 1/(1+나쁜 기억의 합))
// - 선 = 소식을 주고받는 연결. 이번 라운드에 나쁜 소식이 실제로 건너간 연결은 주황으로 잠깐 빛난다
// - 약속을 어긴 순간: 그 나라 발밑에서 붉은 고리(파문)가 퍼지고, 당한 나라까지 붉은 선이 잠깐 이어진다
// 모양은 구슬과 고리 두 가지. 한 라운드 전과 지금 사이를 부드럽게 이어 그릴 뿐 결과에는 영향이 없다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.RepState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of the reputation network of countries');
  const small = (canvas.parentElement.clientWidth || 999) < 640;
  if (small) canvas.style.aspectRatio = '1 / 1';
  const v = create3D(canvas, { camera: small ? [0, 19, 25] : [0, 13.5, 22], target: [0, 1.4, 0], background: '#eef4fa', autoRotateSpeed: 0.45, minDistance: 8, maxDistance: 60, fov: 45 });
  if (v) init(v);
}

function init(v) {
  const { scene, camera, controls } = v;
  scene.children.filter((o) => o.isLight).forEach((l) => { l.intensity = l.isHemisphereLight ? 1.3 : 1.0; });
  const R = 9, HMAX = 4.2, HMIN = 0.35;
  // 바닥: 연한 바다색 원판 (가상의 세계, 실제 지도 아님)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 2.2, 64), new THREE.MeshBasicMaterial({ color: 0xdbe8f4 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const rim = new THREE.Mesh(new THREE.RingGeometry(R + 2.1, R + 2.25, 96), new THREE.MeshBasicMaterial({ color: 0xb4c9de, side: THREE.DoubleSide }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.01; scene.add(rim);

  const MAXN = 40;
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a2a2a }), MAXN);
  balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(balls);
  const GOOD = new THREE.Color('#f5b301'), BAD = new THREE.Color('#4b5563'), col = new THREE.Color();
  for (let i = 0; i < MAXN; i++) balls.setColorAt(i, GOOD);
  // 연결선(나라 사이) + 받침선(땅에서 구슬까지)
  const linkMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  let links = null, linkPos = null, linkCol = null, stems = null, stemPos = null;
  const stemMat = new THREE.LineBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.7 });
  // 붉은 선: 어긴 나라 → 당한 나라
  const hitPos = new Float32Array(64 * 6), hitGeo = new THREE.BufferGeometry(); hitGeo.setAttribute('position', new THREE.BufferAttribute(hitPos, 3));
  const hitLines = new THREE.LineSegments(hitGeo, new THREE.LineBasicMaterial({ color: 0xe03131, transparent: true, opacity: 0.85 }));
  hitLines.frustumCulled = false; scene.add(hitLines);
  // 파문 고리 (최대 16개)
  const ringGeo = new THREE.RingGeometry(0.8, 1, 48); ringGeo.rotateX(-Math.PI / 2);
  const ripples = [];
  for (let k = 0; k < 16; k++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe03131, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); m.visible = false; m.position.y = 0.03; scene.add(m); ripples.push({ m, age: 9, life: 1.6 }); }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let simRef = null, seenT = -1, glow = null, hitAge = 9, nHit = 0;
  const XY = (sim, i) => [sim.net.pos[i][0] * R, sim.net.pos[i][1] * R];
  const height = (s) => HMIN + (HMAX - HMIN) * s;
  const rot = $('rp-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });

  function rebuild(sim) {
    [links, stems].forEach((o) => { if (o) { scene.remove(o); o.geometry.dispose(); } });
    const E = sim.net.edges;
    linkPos = new Float32Array(E.length * 6); linkCol = new Float32Array(E.length * 6);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(linkPos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
    links = new THREE.LineSegments(lg, linkMat); links.frustumCulled = false; scene.add(links);
    stemPos = new Float32Array(sim.n * 6);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stemPos, 3));
    stems = new THREE.LineSegments(sg, stemMat); stems.frustumCulled = false; scene.add(stems);
    glow = new Float32Array(E.length); seenT = -1;
    ripples.forEach((r) => { r.age = 9; r.m.visible = false; }); hitAge = 9; nHit = 0;
  }
  function startRipple(x, z) {
    let r = ripples.find((o) => o.age >= o.life) || ripples[0];
    r.age = 0; r.m.position.x = x; r.m.position.z = z; r.m.visible = true;
  }

  function update(dt) {
    const st = window.RepState; if (!st || !st.sim) return;
    const sim = st.sim, n = sim.n;
    if (sim !== simRef) { simRef = sim; rebuild(sim); }
    // 새 라운드: 소식이 건너간 연결은 빛나고, 어긴 나라에서 파문이 시작된다
    if (sim.t !== seenT) {
      const LR = sim.lastRound;
      if (LR && LR.t === sim.t && sim.t > 0) {
        const E = sim.net.edges, key = new Map(E.map(([a, b], k) => [a * 100 + b, k]));
        LR.gossip.forEach(([u, w, mv]) => { const k = key.get(Math.min(u, w) * 100 + Math.max(u, w)); if (k != null) glow[k] = Math.max(glow[k], Math.min(1, 0.4 + mv)); });
        nHit = 0;
        LR.breaks.forEach(({ i, j }) => {
          const [x1, z1] = XY(sim, i), [x2, z2] = XY(sim, j); startRipple(x1, z1);
          if (nHit < 64) { const o = nHit * 6; hitPos[o] = x1; hitPos[o + 1] = height(sim.stand[i]); hitPos[o + 2] = z1; hitPos[o + 3] = x2; hitPos[o + 4] = height(sim.stand[j]); hitPos[o + 5] = z2; nHit++; }
        });
        if (nHit) hitAge = 0;
        hitGeo.setDrawRange(0, nHit * 2); hitGeo.attributes.position.needsUpdate = true;
      }
      seenT = sim.t;
    }
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const S0 = sim.standPrev, S1 = sim.stand, hs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = S0[i] + (S1[i] - S0[i]) * a, [x, z] = XY(sim, i), y = height(s); hs[i] = y;
      p.set(x, y, z); sc.setScalar(0.75 + 0.5 * s); m4.compose(p, q, sc); balls.setMatrixAt(i, m4);
      col.copy(BAD).lerp(GOOD, Math.pow(s, 1.3)); balls.setColorAt(i, col);
      const o = i * 6; stemPos[o] = x; stemPos[o + 1] = 0.02; stemPos[o + 2] = z; stemPos[o + 3] = x; stemPos[o + 4] = y - 0.3; stemPos[o + 5] = z;
    }
    balls.count = n; balls.instanceMatrix.needsUpdate = true; if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
    stems.geometry.attributes.position.needsUpdate = true;
    const E = sim.net.edges, fade = st.isPaused() && !st.thumb ? 0 : dt * 1.4;
    for (let k = 0; k < E.length; k++) {
      const [u, w] = E[k], [x1, z1] = XY(sim, u), [x2, z2] = XY(sim, w), o = k * 6;
      linkPos[o] = x1; linkPos[o + 1] = hs[u]; linkPos[o + 2] = z1; linkPos[o + 3] = x2; linkPos[o + 4] = hs[w]; linkPos[o + 5] = z2;
      if (!st.thumb) glow[k] = Math.max(0, glow[k] - fade);
      const g = glow[k], r = 0.62 + (0.91 - 0.62) * g, gg = 0.7 + (0.35 - 0.7) * g, bb = 0.82 + (0.05 - 0.82) * g;
      linkCol[o] = linkCol[o + 3] = r; linkCol[o + 1] = linkCol[o + 4] = gg; linkCol[o + 2] = linkCol[o + 5] = bb;
    }
    links.geometry.attributes.position.needsUpdate = true; links.geometry.attributes.color.needsUpdate = true;
    // 파문·붉은 선
    const adv = st.thumb ? 0 : dt;
    ripples.forEach((r) => {
      if (r.age >= r.life) { r.m.visible = false; return; }
      if (st.thumb && r.age === 0) r.age = 0.55;
      r.age += adv; const t = Math.min(1, r.age / r.life);
      r.m.scale.setScalar(0.6 + 4.2 * t); r.m.material.opacity = 0.75 * (1 - t);
    });
    if (!st.thumb) hitAge += dt;
    hitLines.material.opacity = Math.max(0, 0.9 - hitAge / 1.4); hitLines.visible = hitLines.material.opacity > 0.02;
  }
  v.onFrame((dt) => update(dt));
  update(0.016);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(3, 17, 18); controls.target.set(0, 0.8, 0);
    const shot = () => { update(0); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Rep3D = { v, update };
}
