// ① 신입 사다리 (3D): app.js가 window.AiJobsState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 층 셋: 아래 신입(초록) · 가운데 중간(파랑) · 위 숙련(보라). 블록 하나 = 그해 일한 사람 한 명(층 안에서 먼저 들어온 사람이 왼쪽)
// - 승급한 사람은 한 해 전 자리에서 새 층 자리로 옮겨 가는 모습을 이어 그린다(보간, 결과에는 영향 없음). 떠난 사람은 작아지며 사라진다
// - 층마다 회색 테두리 = 같은 해 'AI 없음' 쌍둥이의 인원(넓이), 뒤쪽 얇은 띠 = 지난 해들의 층 넓이(재생이 지난 해까지만)
// - 오른쪽 주황 상자 더미 = 밀린 숙련 일(상자 하나 = 3, 올림)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.AiJobsState;
const SKY = '#eef3fa';
const COL = [new THREE.Color('#22a06b'), new THREE.Color('#2f6fed'), new THREE.Color('#5b3cc4')];
const ROWS = 7, GAP = 0.21, CUBE = 0.165, FLOOR_Y = [0, 1.45, 2.9], X0 = -5.2;   // 층 안: 앞뒤 8줄, 왼쪽(X0)부터 채운다
const depthZ = (r) => (r - (ROWS - 1) / 2) * GAP;

function init(v, narrow) {
  const { scene, camera, controls } = v;
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const MAXP = 900, dummy = new THREE.Object3D(), col = new THREE.Color();
  // 바닥판
  const ground = new THREE.Mesh(new THREE.BoxGeometry(13, 0.12, 16), new THREE.MeshLambertMaterial({ color: 0xdde3ec }));
  ground.position.set(-0.6, -0.12, -5.2); scene.add(ground);
  // 사다리 기둥
  const railMat = new THREE.MeshLambertMaterial({ color: 0x9aa3b2 });
  [-0.95, 0.95].forEach((z) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.6, 0.07), railMat); r.position.set(X0 - 0.45, 1.75, z * 0.85); scene.add(r); });
  for (let k = 0; k < 9; k++) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.62), railMat); g.position.set(X0 - 0.45, 0.2 + k * 0.4, 0); scene.add(g); }
  // 사람 블록
  const people = new THREE.InstancedMesh(new THREE.BoxGeometry(CUBE, CUBE, CUBE), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXP);
  people.instanceMatrix.setUsage(THREE.DynamicDrawUsage); people.count = 0; scene.add(people);
  for (let i = 0; i < MAXP; i++) people.setColorAt(i, COL[0]);
  // AI 없음 쌍둥이 테두리(층마다 하나)
  const outlines = FLOOR_Y.map((y) => {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.32, ROWS * GAP + 0.12));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6b7484 }));
    l.position.y = y + 0.16; scene.add(l);
    // 테두리 아래 받침판(쌍둥이 넓이와 같이 늘고 준다)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, ROWS * GAP + 0.12), new THREE.MeshLambertMaterial({ color: 0xf8fafc }));
    plate.position.y = y - 0.035; scene.add(plate); l.userData.plate = plate;
    return l;
  });
  // 지난 해 띠
  const YEARS = 31, TRAIL_DZ = 0.42, TRAIL_Z0 = -(ROWS * GAP) / 2 - 0.45;
  const trail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 0.3), new THREE.MeshLambertMaterial({ color: 0xffffff }), YEARS * 3);
  trail.count = 0; scene.add(trail);
  for (let i = 0; i < YEARS * 3; i++) trail.setColorAt(i, COL[0]);
  // 밀린 일 상자
  const BOXMAX = 260, BOXW = 5, BOXD = 5, BS = 0.3;
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(BS * 0.92, BS * 0.92, BS * 0.92), new THREE.MeshLambertMaterial({ color: 0xe8893a }), BOXMAX);
  boxes.count = 0; scene.add(boxes);
  const BX0 = 2.6;

  const widthOf = (n) => Math.ceil(n / ROWS) * GAP;
  function layout(list) {   // id → [x, y, z, 단계]
    const mp = new Map(), cnt = [0, 0, 0];
    const by = [[], [], []]; list.forEach((p) => by[p.st].push(p));
    by.forEach((arr, st) => { arr.sort((a, b) => a.id - b.id); arr.forEach((p, k) => { mp.set(p.id, [X0 + Math.floor(k / ROWS) * GAP + GAP / 2, FLOOR_Y[st] + CUBE / 2 + 0.01, depthZ(k % ROWS), st]); cnt[st]++; }); });
    return { mp, cnt };
  }
  let simRef = null, lastT = -1, cur = null, prev = null;
  const rot = $('aj-rotate');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  const ease = (a) => a * a * (3 - 2 * a);

  function update() {
    const st = window.AiJobsState; if (!st || !st.sim) return;
    const sim = st.sim, fresh = sim !== simRef;
    if (fresh || sim.t !== lastT) { simRef = sim; lastT = sim.t; cur = layout(sim.worked); prev = fresh ? cur : layout(sim.prevWorked); }
    const a = st.isPaused() || st.thumb || fresh ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval / 0.8);
    const e = ease(a);
    let n = 0;
    // 올해 사람: 한 해 전 자리 → 올해 자리
    cur.mp.forEach((q, id) => {
      if (n >= MAXP) return;
      const p = prev.mp.get(id);
      let x = q[0], y = q[1], z = q[2], s = 1;
      if (p) { x = p[0] + (q[0] - p[0]) * e; z = p[2] + (q[2] - p[2]) * e; y = p[1] + (q[1] - p[1]) * e + (p[3] !== q[3] ? Math.sin(Math.PI * e) * 0.5 : 0); }
      else s = e;   // 새로 뽑힌 신입: 자라며 나타남
      dummy.position.set(x, y, z); dummy.scale.setScalar(Math.max(0.001, s)); dummy.updateMatrix();
      people.setMatrixAt(n, dummy.matrix);
      if (p && p[3] !== q[3]) col.copy(COL[p[3]]).lerp(COL[q[3]], e); else col.copy(COL[q[3]]);
      people.setColorAt(n, col); n++;
    });
    // 떠난 사람: 한 해 전 자리에서 작아지며 사라짐
    if (a < 1) prev.mp.forEach((p, id) => {
      if (n >= MAXP || cur.mp.has(id)) return;
      dummy.position.set(p[0], p[1] - 0.05 * e, p[2]); dummy.scale.setScalar(Math.max(0.001, 1 - e)); dummy.updateMatrix();
      people.setMatrixAt(n, dummy.matrix); people.setColorAt(n, COL[p[3]]); n++;
    });
    people.count = n; people.instanceMatrix.needsUpdate = true; if (people.instanceColor) people.instanceColor.needsUpdate = true;
    // 쌍둥이 테두리
    const H = sim.hist, t = sim.t, tw = [H.J0[t], H.M0[t], H.S0[t]];
    outlines.forEach((l, k) => { const w = Math.max(0.05, widthOf(tw[k])); l.scale.x = w; l.position.x = X0 + w / 2; l.userData.plate.scale.x = w + 0.1; l.userData.plate.position.x = X0 + w / 2; });
    // 지난 해 띠(앞이 올해 바로 전 해)
    let m = 0;
    for (let y = t - 1; y >= 0 && m < YEARS * 3; y--) {
      const z = TRAIL_Z0 - (t - 1 - y) * TRAIL_DZ, vals = [H.J[y], H.M[y], H.S[y]];
      for (let k = 0; k < 3; k++) {
        const w = Math.max(0.05, widthOf(vals[k]));
        dummy.position.set(X0 + w / 2, FLOOR_Y[k] + 0.05, z); dummy.scale.set(w, 1, 1); dummy.updateMatrix();
        trail.setMatrixAt(m, dummy.matrix); trail.setColorAt(m, col.copy(COL[k]).lerp(new THREE.Color('#ffffff'), 0.35 + Math.min(0.4, (t - 1 - y) * 0.015))); m++;
      }
    }
    trail.count = m; trail.instanceMatrix.needsUpdate = true; if (trail.instanceColor) trail.instanceColor.needsUpdate = true;
    // 밀린 일 상자 더미
    const bPrev = t > 0 ? H.B[t - 1] : 0, bNow = H.B[t], bv = bPrev + (bNow - bPrev) * e;
    const nb = Math.min(BOXMAX, Math.ceil(bv / 3 - 1e-9));
    for (let k = 0; k < nb; k++) {
      const layer = Math.floor(k / (BOXW * BOXD)), r = k % (BOXW * BOXD);
      dummy.position.set(BX0 + (r % BOXW) * BS, BS / 2 + layer * BS, 0.9 + Math.floor(r / BOXW) * BS); dummy.scale.setScalar(1);
      dummy.rotation.set(0, ((k * 37) % 7 - 3) * 0.03, 0); dummy.updateMatrix(); dummy.rotation.set(0, 0, 0);
      boxes.setMatrixAt(k, dummy.matrix);
    }
    boxes.count = nb; boxes.instanceMatrix.needsUpdate = true;
  }
  v.onFrame(() => update());
  if (narrow) { camera.position.set(6.5, 6.5, 11.5); controls.update(); }
  update();
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(6.2, 5.6, 8.6); controls.target.set(-0.6, 1.3, -1.0);
    const shot = () => { update(); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.AiJobs3D = { v, update, stats: () => ({ people: people.count, trail: trail.count, boxes: boxes.count }) };
}

if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D career ladder of an imaginary industry');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1';
  const v = create3D(canvas, { camera: [5, 5, 8.5], target: [-1.4, 1.5, -1.8], background: SKY, autoRotateSpeed: 0.3, minDistance: 5, maxDistance: 40, fov: 45 });
  if (v) init(v, narrow);
}
