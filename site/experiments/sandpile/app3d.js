// 모래더미 3D 보기: 칸마다 쌓인 모래알 수(0~3)를 기둥 높이로 세운 지형.
// 2D 화면(app.js)이 window.SandpileState로 내보내는 같은 sim을 그대로 읽는다(3D에서 따로 계산하지 않음).
// 색: 0~2알 = 모래색(높을수록 조금 진하게), 3알 = 빨강(한 알만 더 오면 무너짐), 방금 무너진 칸 = 하얗게 번쩍임.
// 흰 구슬 = 방금 떨어진 알. 한 알씩 떨어질 때(일시정지·한 알 버튼·느리게)는 구슬이 기둥 위로 떨어지는 모습이 보인다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const v = canvas && create3D(canvas, { camera: [0, 8.6, 9.8], target: [0, 0.3, 0.3], background: '#f3efe6', autoRotateSpeed: 0.5, minDistance: 4, maxDistance: 26 });
if (v) {
  const SIZE = 10, HU = 0.2, BASE = 0.04;      // 판의 한 변, 모래 한 알의 높이, 0알 칸의 바닥 두께
  const MAXN = 100 * 100;
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  v.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  // 받침판
  const plate = new THREE.Mesh(new THREE.BoxGeometry(SIZE + 0.4, 0.2, SIZE + 0.4), new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.95 }));
  plate.position.y = -0.1; v.scene.add(plate);

  // 기둥: 인스턴스 하나의 상자(바닥이 y=0)
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 }), MAXN);
  cols.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cols.count = 0;
  cols.setColorAt(0, col.set('#fff')); cols.instanceColor.setUsage(THREE.DynamicDrawUsage);
  v.scene.add(cols);

  // 방금 떨어진 알: 흰 구슬 하나
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.4 }));
  ball.visible = false; v.scene.add(ball);

  // 색(sRGB → three.js 선형 색)
  const SAND = [new THREE.Color('#ead2a2'), new THREE.Color('#d9b77e'), new THREE.Color('#c39758')];
  const RED = new THREE.Color('#e2384f'), WHITE = new THREE.Color('#ffffff');

  let simRef = null, N = 0, cell = 0, disp = null, lastT = -1, fall = 1, fallFrom = 0;
  function rebuild(sim) {
    simRef = sim; N = sim.N; cell = SIZE / N; cols.count = N * N;
    disp = new Float32Array(N * N); for (let i = 0; i < N * N; i++) disp[i] = sim.h[i];
    lastT = sim.t; fall = 1;
    home();
  }
  // 화면이 좁으면(휴대폰 정사각형) 판 전체가 들어오게 조금 멀리서 본다
  function home() {
    const asp = (canvas.clientWidth || 600) / (canvas.clientHeight || 375), d = asp < 1.3 ? 1.2 : 1;
    v.camera.position.set(0, 8.2 * d, 9.6 * d); v.controls.target.set(0, 0.2, 0.3); v.controls.update();
  }
  const cx = (i) => ((i % N) + 0.5) * cell - SIZE / 2;
  const cz = (i) => (Math.floor(i / N) + 0.5) * cell - SIZE / 2;   // 2D 그림의 위쪽 줄이 화면 안쪽
  const top = (hd) => BASE + hd * HU;

  function update(dt) {
    const S = window.SandpileState; if (!S || !S.sim) return;
    const sim = S.sim;
    if (sim !== simRef || sim.N !== N) rebuild(sim);
    const h = sim.h, st = sim.stamp, now = sim.t - 1, F = S.flashF(), paused = S.isPaused();
    const dtT = sim.t - lastT;
    // 기둥 높이는 지금 값으로 부드럽게 따라간다(무너진 칸이 낮아지는 모습). 썸네일은 바로 맞춘다
    const a = S.thumb ? 1 : Math.min(1, dt * 14), w = cell * 0.9;
    for (let i = 0; i < N * N; i++) {
      disp[i] += (h[i] - disp[i]) * a;
      dummy.position.set(cx(i), 0, cz(i)); dummy.scale.set(w, top(disp[i]), w); dummy.updateMatrix();
      cols.setMatrixAt(i, dummy.matrix);
      const age = now - st[i], k = age < F ? (1 - age / F) * (1 - age / F) : 0;
      col.copy(h[i] >= 3 ? RED : SAND[h[i]]);
      if (k > 0) col.lerp(WHITE, k);
      cols.setColorAt(i, col);
    }
    cols.instanceMatrix.needsUpdate = true; cols.instanceColor.needsUpdate = true;

    // 떨어지는 알: 한 알씩일 때만 위에서 떨어뜨리고, 빠르게 재생 중이면 마지막 자리 바로 위에 둔다
    const site = sim.lastSite;
    if (sim.t === 0 || site < 0) { ball.visible = false; lastT = sim.t; return; }
    const r = Math.max(0.09, cell * 0.55);
    if (dtT === 1 && (paused || F <= 6) && !S.thumb) { fall = 0; fallFrom = top(h[site]) + 2.2; }
    else if (dtT !== 0) fall = 1;
    lastT = sim.t;
    fall = Math.min(1, fall + dt / 0.35);
    const yEnd = top(disp[site]) + r, y = fallFrom + (yEnd - fallFrom) * fall * fall;
    ball.visible = true; ball.scale.setScalar(r);
    ball.position.set(cx(site), fall < 1 ? y : yEnd, cz(site));
  }

  v.onFrame((dt) => update(dt));
  update(1);
  if (window.SandpileState && window.SandpileState.thumb) {
    v.controls.autoRotate = false;
    const shot = () => { update(1); v.controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
}
