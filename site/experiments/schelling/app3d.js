// ② 3D로 보기: 동네를 블록 도시로. 집 한 채 = 건물 상자 하나(파랑/주황), 높이 = 둘레 8칸 이웃 중 같은 집단 비율.
// 불만족한 집(같은 이웃 비율 < 원하는 비율)은 연한 색. 이사하면 원래 자리 건물은 내려앉고 새 자리에 건물이 올라온다.
// app.js의 window.SchellingState.sim()을 그대로 읽는다 (따로 시뮬레이션을 돌리지 않음 → ①과 항상 같은 상태).
import { THREE, create3D } from '../../lab3d.js';

const ST = window.SchellingState;
const canvas = document.getElementById('c-3d');
const v = ST && canvas ? create3D(canvas, { camera: [0, 10.5, 9.2], target: [0, 0, 0.3], autoRotateSpeed: 0.5, minDistance: 5, maxDistance: 30, background: '#f6f7fb' }) : null;

if (v) {
  const { scene } = v;
  // 휴대폰(정사각형 캔버스)에서는 도시가 양옆으로 잘리지 않게 카메라를 뒤로 뺀다
  const asp = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
  if (asp < 1.25) v.camera.position.multiplyScalar(1.22 / Math.max(0.8, asp));
  const W = 10;                 // 도시 한 변 길이 (격자 크기와 상관없이 같게)
  const HMAX = 0.95, HMIN = 0.06; // 같은 이웃 비율 0% → HMIN, 100% → HMIN + HMAX
  const MAXN = 60 * 60;

  // 땅 (빈 칸은 건물 없이 땅만 보인다)
  const ground = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.08, W + 0.3), new THREE.MeshStandardMaterial({ color: 0xdfe4ee, roughness: 1 }));
  ground.position.y = -0.04; scene.add(ground);

  // 건물 상자 (밑면이 y=0에 오도록)
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const houses = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.02 }), MAXN);
  houses.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(houses);

  const cssv = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d);
  const white = new THREE.Color(0xffffff);
  const cA = new THREE.Color(cssv('--ga', '#3b82f6')), cB = new THREE.Color(cssv('--gb', '#f59e42'));
  const cAp = cA.clone().lerp(white, 0.62), cBp = cB.clone().lerp(white, 0.62); // 불만족 = 연한 색

  let lastSim = null, lastRound = -1, size = 0;
  let prev = null;                 // 직전 격자 (이사 감지용)
  let cur = new Float32Array(MAXN), tgt = new Float32Array(MAXN);
  let kind = new Uint8Array(MAXN); // 지금 칠해 둔 색 (0 없음, 1 A, 2 B, 3 A 불만족, 4 B 불만족)
  let moving = true;
  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();

  // sim.js의 sameShare와 같은 계산 (이웃이 없으면 -1)
  function sameShare(grid, S, idx) {
    const me = grid[idx], x = idx % S, y = (idx - x) / S;
    let same = 0, total = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const g = grid[((y + dy + S) % S) * S + ((x + dx + S) % S)];
      if (g === 0) continue;
      total++; if (g === me) same++;
    }
    return total ? same / total : -1;
  }

  function sync(sim, snap) {
    const S = sim.size, grid = sim.grid, N = S * S, th = sim.params.threshold;
    if (S !== size) { size = S; snap = true; }
    for (let i = 0; i < N; i++) {
      const g = grid[i];
      if (!g) { // 빈 칸: 떠난 집은 원래 색 그대로 내려앉는다
        tgt[i] = 0; if (snap) { cur[i] = 0; kind[i] = 0; }
        continue;
      }
      const s = sameShare(grid, S, i);
      const unhappy = s >= 0 && s < th;
      const k = g + (unhappy ? 2 : 0);
      if (!snap && prev && prev[i] !== g) cur[i] = 0; // 새로 이사 온 집: 땅에서 올라온다
      kind[i] = k;
      tgt[i] = HMIN + HMAX * (s < 0 ? 0 : s);
      if (snap) cur[i] = tgt[i];
    }
    for (let i = N; i < MAXN; i++) { cur[i] = tgt[i] = 0; kind[i] = 0; }
    prev = Uint8Array.from(grid);
    moving = true;
  }

  function place() {
    const S = size, c = W / S, w = c * 0.8;
    for (let i = 0; i < MAXN; i++) {
      const h = cur[i];
      if (i >= S * S || h < 0.004) { m4.makeScale(0, 0, 0); houses.setMatrixAt(i, m4); continue; }
      const x = i % S, y = (i - x) / S;
      pos.set(-W / 2 + (x + 0.5) * c, 0, -W / 2 + (y + 0.5) * c);
      sc.set(w, h, w); m4.compose(pos, q, sc); houses.setMatrixAt(i, m4);
      const k = kind[i];
      houses.setColorAt(i, k === 1 ? cA : k === 2 ? cB : k === 3 ? cAp : cBp);
    }
    houses.instanceMatrix.needsUpdate = true; if (houses.instanceColor) houses.instanceColor.needsUpdate = true;
  }

  v.onFrame((dt) => {
    const sim = ST.sim(); if (!sim) return;
    if (sim !== lastSim) { sync(sim, true); lastSim = sim; lastRound = sim.round; }
    else if (sim.round !== lastRound) { sync(sim, false); lastRound = sim.round; }
    if (!moving) return;
    const a = 1 - Math.exp(-dt * 9);
    let busy = false;
    for (let i = 0; i < MAXN; i++) {
      const d = tgt[i] - cur[i];
      if (Math.abs(d) > 0.002) { cur[i] += d * a; busy = true; } else cur[i] = tgt[i];
    }
    place();
    moving = busy;
  });
  // 처음 한 번 바로 그린다 (캡처·썸네일용)
  const s0 = ST.sim(); if (s0) { sync(s0, true); lastSim = s0; lastRound = s0.round; place(); v.render(); }
}
