// ② 3D로 보기: 동네 900곳(30x30)을 막대 하나씩으로 세운다. 막대 높이 = 그 동네의 가격지수, 색 = 2D 지도와 같은 "소득 기준선 대비" 색.
// 2D(app.js)가 window.ApartmentState로 넘기는 sim 객체를 그대로 읽는다. 3D는 시뮬레이션을 따로 돌리지 않으므로
// 재생·일시정지·처음부터·슬라이더를 2D와 똑같이 따라가고, 재생이 도달한 분기까지만 보여 준다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const v = canvas && create3D(canvas, { camera: [12, 21, 39], target: [0, 1, 0], background: '#f6f7fb', autoRotateSpeed: 0.5, minDistance: 14, maxDistance: 80, aspect: 0.62 });

if (v) {
  // 휴대폰처럼 좁은 화면에서는 판 전체가 들어오게 조금 더 물러난다
  if ((canvas.clientWidth || 999) < 600) { v.camera.position.multiplyScalar(1.12); v.controls.update(); }
  const $ = (id) => document.getElementById(id);
  const S = 30, N = S * S, HS = 0.03;               // 가격지수 100 → 높이 3 (한 칸 = 1)
  const half = S / 2;

  // 2D 지도(app.js)와 같은 색 눈금
  const STOPS = [[0.9, [199, 224, 250]], [1.0, [255, 244, 204]], [1.3, [245, 158, 66]], [1.7, [214, 49, 59]], [2.4, [122, 16, 32]]];
  const col = new THREE.Color();
  function heat(r) {
    let c = STOPS[STOPS.length - 1][1];
    if (r <= STOPS[0][0]) c = STOPS[0][1];
    else for (let i = 1; i < STOPS.length; i++) if (r <= STOPS[i][0]) { const [r0, c0] = STOPS[i - 1], [r1, c1] = STOPS[i], u = (r - r0) / (r1 - r0); c = c0.map((x, k) => x + (c1[k] - x) * u); break; }
    return col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
  }

  // 바닥판
  const base = new THREE.Mesh(new THREE.BoxGeometry(S + 1, 0.3, S + 1), new THREE.MeshStandardMaterial({ color: 0xdfe4ee, roughness: 1 }));
  base.position.y = -0.15; v.scene.add(base);

  // 막대 900개 (인스턴스 하나)
  const geo = new THREE.BoxGeometry(0.96, 1, 0.96); geo.translate(0, 0.5, 0);
  const bars = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 }), N);
  bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) bars.setColorAt(i, col.set('#fff'));
  v.scene.add(bars);

  // 소득 기준선 높이의 옅은 판
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(S + 1, S + 1), new THREE.MeshBasicMaterial({ color: 0x5a6e96, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
  plane.rotation.x = -Math.PI / 2; v.scene.add(plane);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(S + 1, S + 1)), new THREE.LineBasicMaterial({ color: 0x3c5078, transparent: true, opacity: 0.55 }));
  edge.rotation.x = -Math.PI / 2; v.scene.add(edge);

  // 모서리 기둥: 가격지수 눈금 100·200·300·400
  const px = -half - 2.5, pz = -half - 2.5, TOP = 400;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7a849a });
  const seg = [new THREE.Vector3(px, 0, pz), new THREE.Vector3(px, TOP * HS, pz)];
  for (let t = 100; t <= TOP; t += 100) seg.push(new THREE.Vector3(px - 0.5, t * HS, pz), new THREE.Vector3(px + 0.5, t * HS, pz));
  v.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), lineMat));
  function label(text, y) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d'); g.font = 'bold 40px -apple-system, sans-serif'; g.fillStyle = '#4a5468'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 34);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthWrite: false }));
    const big = (canvas.clientWidth || 999) < 600 ? 1.5 : 1; sp.scale.set(2.4 * big, 1.2 * big, 1); sp.position.set(px - 1.7, y, pz); v.scene.add(sp);
  }
  for (let t = 100; t <= TOP; t += 100) label(String(t), t * HS);

  // 상태 따라가기: 높이는 지금 분기의 값으로 부드럽게 다가간다 (미래 값은 쓰지 않음)
  const shown = new Float32Array(N).fill(100);
  let ver = -1, stepSeen = -1, settling = false, lastText = '';
  function sync(dt, snap) {
    const A = window.ApartmentState; if (!A || !A.sim) return;
    const sim = A.sim;
    if (A.ver !== ver) { ver = A.ver; snap = true; stepSeen = -1; }
    const changed = sim.step !== stepSeen;
    if (!changed && !settling && !snap) return;
    stepSeen = sim.step;
    const anchor = 100 * sim.income, k = snap ? 1 : 1 - Math.exp(-dt * 14);
    let moving = false;
    for (let i = 0; i < N; i++) {
      const target = sim.price[i], d = target - shown[i];
      shown[i] += d * k; if (Math.abs(d) > 0.3) moving = true;
      dummy.position.set((i % S) - half + 0.5, 0, Math.floor(i / S) - half + 0.5);
      dummy.scale.set(1, Math.max(0.02, shown[i] * HS), 1); dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix); bars.setColorAt(i, heat(shown[i] / anchor));
    }
    settling = moving && !snap;
    bars.instanceMatrix.needsUpdate = true; bars.instanceColor.needsUpdate = true;
    plane.position.y = edge.position.y = anchor * HS;
    const H = sim.history, s = H[H.length - 1];
    const txt = `${sim.step}분기째 · 평균 가격지수 ${s.mean.toFixed(0)}`;   // 2D 지도 아래 문구와 같은 값
    if (txt !== lastText) { lastText = txt; const el = $('when3d'); if (el) el.textContent = txt; }
  }
  v.onFrame((dt) => sync(dt, false));
  sync(0, true);

  // 썸네일 촬영: 회전 없이 정해진 각도에서 바로 그린다
  if (window.ApartmentState && window.ApartmentState.thumb) {
    v.controls.autoRotate = false; v.camera.position.set(9, 26, 34); v.controls.update();
    const shot = () => { sync(0, true); v.controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
}
