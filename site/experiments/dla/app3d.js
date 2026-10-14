// 번개·산호(DLA) 3D 보기: 위 2D 덩어리를 그대로 가져와 입자마다 "붙은 순서"만큼 높이를 올려 시간 탑으로 쌓는다.
// 새로 계산하지 않는다. 2D(app.js)가 window.DLAState로 내보내는 sim(붙은 위치 xs, ys와 개수 n)을 그대로 읽고,
// 재생이 도달한 입자까지만 보여 준다(재생·일시정지·처음부터·슬라이더를 따라감).
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const CAM = [0, 6.2, 10.5], TGT = [0, 1.9, 0];
const v = canvas && create3D(canvas, { camera: CAM, target: TGT, background: '#0a0f1f', autoRotateSpeed: 0.7, minDistance: 3, maxDistance: 26, aspect: 0.62 });
if (v) {
  const $ = (id) => document.getElementById(id);
  const MAXN = 8000 + 2100;          // 입자 수 최대 8,000 + 고리 씨앗 칸
  const HW = 4.2, RW = 4.3;          // 탑 전체 높이(입자 수 슬라이더 끝까지 붙었을 때), 덩어리 반지름이 차지할 폭
  const PR = 0.85;                    // 구슬 반지름 (격자 칸 단위)
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  // 휴대폰처럼 세로로 긴 캔버스에서는 탑 양옆이 잘리지 않게 카메라를 조금 뒤로 뺀다
  const fit = (cam) => {
    const a = (canvas.clientWidth || 600) / Math.max(1, canvas.clientHeight || 370), k = a < 1.3 ? 1.5 : 1;
    v.camera.position.set(TGT[0] + (cam[0] - TGT[0]) * k, TGT[1] + (cam[1] - TGT[1]) * k, TGT[2] + (cam[2] - TGT[2]) * k); v.controls.update();
  };
  fit(CAM);

  const geo = new THREE.IcosahedronGeometry(1, 1);   // 둥근 구슬(면 80개): 입자가 많아도 가볍게
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  const beads = new THREE.InstancedMesh(geo, mat, MAXN);
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beads.count = 0;
  beads.setColorAt(0, col.set('#fff')); beads.frustumCulled = false; v.scene.add(beads);
  // 바닥: 짙은 원판 (구슬과 다른 모양은 이것 하나)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(RW * 1.12, 64), new THREE.MeshStandardMaterial({ color: '#131b33', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; v.scene.add(floor);
  // 지금 떠도는 입자 (흰 구슬)
  const live = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff' })); live.visible = false; v.scene.add(live);

  let simRef = null, shown = 0, sApplied = 0, s = 0, flat = 0, flatApplied = -1, nSeed = 0;
  const target = (S) => RW / Math.max(18, S.sim.rmax() + 4);   // 2D 화면처럼 덩어리 크기에 맞춰 넓어진다
  const seedCol = new THREE.Color('#e1e8fa');

  function place(i, gx, gy, h, c) {
    const S = window.DLAState, C = S.sim.C;
    dummy.position.set((gx - C) * s, h, (gy - C) * s);
    const r = PR * s; dummy.scale.set(r, r, r); dummy.updateMatrix();
    beads.setMatrixAt(i, dummy.matrix); if (c) beads.setColorAt(i, c);
  }
  const heightOf = (k, P) => ((k + 1) / P.count) * HW * (1 - flat);
  function colorOf(k, P, lut) { const c = lut[Math.min(255, Math.floor((k / P.count) * 255))]; return col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); }

  // from 번째 입자부터 sim.n까지 배치 (full이면 씨앗부터 전부 다시)
  function layout(full) {
    const S = window.DLAState, sim = S.sim, P = sim.params;
    if (full) {
      nSeed = sim.seedCells.length;
      sim.seedCells.forEach(([x, y], i) => place(i, x, y, 0, seedCol));
      shown = 0;
    }
    for (let k = shown; k < sim.n; k++) place(nSeed + k, sim.xs[k], sim.ys[k], heightOf(k, P), colorOf(k, P, S.lut));
    shown = sim.n; beads.count = nSeed + sim.n;
    beads.instanceMatrix.needsUpdate = true; if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
  }

  let lastInfo = '';
  function sync(dt = 0.016) {
    const a = Math.min(1, dt * 7);             // 프레임 수가 아니라 시간 기준으로 부드럽게
    const S = window.DLAState; if (!S || !S.sim) return;
    const sim = S.sim, tg = target(S), wantFlat = $('mode3d').value === 'flat' ? 1 : 0;
    let full = false;
    if (sim !== simRef) { simRef = sim; s = sApplied = tg; full = true; }       // 처음부터·슬라이더·다른 무작위: 새 덩어리
    else s += (tg - s) * a;
    if (S.thumb) { s = tg; flat = wantFlat; }
    else flat += (wantFlat - flat) * a;
    if (Math.abs(flat - wantFlat) < 0.002) flat = wantFlat;
    if (Math.abs(s - sApplied) / sApplied > 0.01 || flat !== flatApplied) { sApplied = s; flatApplied = flat; full = true; }
    else s = sApplied;
    if (full || sim.n !== shown) layout(full);
    const lv = S.thumb ? null : sim.live();
    if (lv) {
      live.visible = true; const r = PR * 1.6 * s;
      live.position.set((lv.x - sim.C) * s, heightOf(sim.n, sim.params), (lv.y - sim.C) * s); live.scale.set(r, r, r);
    } else live.visible = false;
    const info = `붙은 입자 ${sim.n.toLocaleString('en-US')}개 · 반지름 ${Math.round(sim.rmax())}칸`;
    if (info !== lastInfo) { lastInfo = info; $('info3d').textContent = info; }
  }
  $('mode3d').addEventListener('change', () => { sync(0); v.render(); });
  // 처음부터 자라기: 위 실험의 "처음부터"를 누른 것과 같다 (재생도 이어서)
  $('grow3d').addEventListener('click', () => {
    const r = $('restart'); if (r) r.click();
    const p = $('play'); if (p && /▶/.test(p.textContent)) p.click();
  });
  v.onFrame((dt) => sync(dt));
  sync();
  // 썸네일 촬영: 회전 없이 정해진 각도에서 바로 그린다
  if (window.DLAState && window.DLAState.thumb) {
    v.controls.autoRotate = false; fit([0, 7.4, 8.4]);
    const shot = () => { sync(); v.controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
}
