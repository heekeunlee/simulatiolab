// ① 제재가 걸린 무역망 (3D): app.js가 window.SanctionsState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 나라 = 구슬(크기 = 나라 크기). 가운데 주황 = 제재받는 나라, 파랑 = 제재 참여국, 회색 = 참여 안 한 나라
// - 직접 무역 = 가운데로 이어진 회색 관(굵기 = 지금 달의 무역량), 제3국을 거쳐 새는 무역 = 위로 휜 주황 점선(굵기 = 새는 양)
// - 가운데 기둥 = 결속 지수(옅은 원판 = 평소 50, 진한 원판 = 문턱 30). 굵기 변화는 화면에서만 부드럽게 잇는다(결과에는 영향 없음)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.SanctionsState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of a sanctioned trade network');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: narrow ? [0, 21, 22] : [0, 14.5, 20.5], target: [0, 0.5, 1.6], background: '#eef4fb', autoRotateSpeed: 0.35, minDistance: 8, maxDistance: 60, fov: 45 });
  if (v) init(v);
}

function init(v) {
  const { scene, camera, controls } = v;
  const C_T = new THREE.Color('#ea580c'), C_P = new THREE.Color('#2f6fed'), C_Q = new THREE.Color('#9aa5b8');
  // 바다 같은 연한 바닥
  const ground = new THREE.Mesh(new THREE.CircleGeometry(13, 64), new THREE.MeshBasicMaterial({ color: 0xdbe8f6 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);

  const MAX = 64, up = new THREE.Vector3(0, 1, 0);
  const sphereG = new THREE.SphereGeometry(1, 24, 16), cylG = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
  const balls = new THREE.InstancedMesh(sphereG, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX); scene.add(balls);
  const pipes = new THREE.InstancedMesh(cylG, new THREE.MeshLambertMaterial({ color: 0xa3adbf }), MAX); scene.add(pipes);
  const SEG = 16;   // 점선 한 줄 = 짧은 관 8개
  const dashes = new THREE.InstancedMesh(cylG, new THREE.MeshLambertMaterial({ color: 0xf97316 }), MAX * SEG / 2); scene.add(dashes);
  const dots = new THREE.InstancedMesh(sphereG, new THREE.MeshLambertMaterial({ color: 0x64748b }), MAX * 2); scene.add(dots);
  [balls, pipes, dashes, dots].forEach((o) => { o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); o.frustumCulled = false; });
  const pillar = new THREE.Mesh(cylG, new THREE.MeshLambertMaterial({ color: 0xea580c, transparent: true, opacity: 0.85 })); scene.add(pillar);
  const disc50 = new THREE.Mesh(cylG, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })); scene.add(disc50);
  const disc30 = new THREE.Mesh(cylG, new THREE.MeshLambertMaterial({ color: 0x334155, transparent: true, opacity: 0.55 })); scene.add(disc30);
  const linkMat = new THREE.LineBasicMaterial({ color: 0x9aa5b8, transparent: true, opacity: 0.35 });
  let linkObj = null;

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const PH = 6;   // 결속 지수 100 = 기둥 높이 6
  function tube(mesh, i, from, to, r) {
    d.subVectors(to, from); const len = d.length();
    if (len < 1e-6 || r <= 0.001) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); return; }
    q.setFromUnitVectors(up, d.normalize()); p.addVectors(from, to).multiplyScalar(0.5); sc.set(r, len, r);
    m4.compose(p, q, sc); mesh.setMatrixAt(i, m4);
  }
  const R = (size, i) => (i === 0 ? 0.95 : 0.28 + 0.3 * Math.sqrt(size));
  let simRef = null, shownF = [], shownR = [], shownC = 50, phase = 0;
  const pos = (W, i) => new THREE.Vector3(W.x[i], R(W.size[i], i), W.y[i]);
  const arc = (W, k, s) => {   // 나라 k → 가운데, 위로 휜 곡선 위의 점 (s = 0..1)
    const A = pos(W, k), B = pos(W, 0), mid = A.clone().add(B).multiplyScalar(0.5); mid.y += 2.2 + 0.08 * A.distanceTo(B);
    const u = 1 - s; return new THREE.Vector3(u * u * A.x + 2 * u * s * mid.x + s * s * B.x, u * u * A.y + 2 * u * s * mid.y + s * s * B.y, u * u * A.z + 2 * u * s * mid.z + s * s * B.z);
  };

  function update(dt) {
    const st = window.SanctionsState; if (!st || !st.sim) return;
    const sim = st.sim, W = sim.world, n = W.n, started = sim.t >= sim.params.start;
    if (sim !== simRef) {
      simRef = sim; shownF = sim.flow.slice(); shownR = sim.relay.slice(); shownC = sim.C[sim.t];
      if (linkObj) scene.remove(linkObj);
      const pts = []; W.links.forEach(([i, j]) => { pts.push(W.x[i], 0.05, W.y[i], W.x[j], 0.05, W.y[j]); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      linkObj = new THREE.LineSegments(g, linkMat); scene.add(linkObj);
    }
    const k = st.thumb ? 1 : Math.min(1, dt * 4);
    for (let i = 0; i < n; i++) { shownF[i] += (sim.flow[i] - shownF[i]) * k; shownR[i] += (sim.relay[i] - shownR[i]) * k; }
    shownC += (sim.C[sim.t] - shownC) * k;
    if (!st.isPaused() && !st.thumb) phase = (phase + dt * 0.45) % 1;
    const center = pos(W, 0);
    for (let i = 0; i < n; i++) {
      const r = R(W.size[i], i); p.copy(pos(W, i)); sc.set(r, r, r); q.identity(); m4.compose(p, q, sc); balls.setMatrixAt(i, m4);
      balls.setColorAt(i, i === 0 ? C_T : started && sim.part[i] ? C_P : C_Q);
      if (i === 0) { tube(pipes, 0, center, center, 0); continue; }
      a.copy(pos(W, i)); a.y = 0.35; b.copy(center); b.y = 0.35;
      const rr = shownF[i] > 0.002 ? 0.025 + 0.36 * Math.sqrt(shownF[i]) : 0;
      tube(pipes, i, a, b, rr);
      for (let s = 0; s < 2; s++) {   // 물건이 가운데로 가는 작은 구슬
        const f = ((st.thumb ? 0.3 : phase) + s * 0.5) % 1; p.lerpVectors(a, b, f); const dr = rr > 0 ? rr * 1.7 + 0.04 : 0; sc.set(dr, dr, dr); m4.compose(p, q.identity(), sc); dots.setMatrixAt(i * 2 + s, m4);
      }
      const lr = shownR[i] > 0.002 ? 0.03 + 0.42 * Math.sqrt(shownR[i]) : 0;
      for (let s = 0; s < SEG / 2; s++) {
        const s0 = (s * 2 + (st.thumb ? 0 : phase * 2)) / SEG, s1 = s0 + 1 / SEG;
        tube(dashes, i * SEG / 2 + s, arc(W, i, Math.min(1, s0 % 1)), arc(W, i, Math.min(1, (s0 % 1) + 1 / SEG)), lr);
      }
    }
    balls.count = n; pipes.count = n; dots.count = n * 2; dashes.count = n * SEG / 2;
    [balls, pipes, dots, dashes].forEach((o) => { o.instanceMatrix.needsUpdate = true; });
    if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
    const hgt = Math.max(0.05, shownC / 100 * PH);
    pillar.scale.set(0.38, hgt, 0.38); pillar.position.set(0, 1.9 + hgt / 2, 0);
    disc50.scale.set(0.75, 0.04, 0.75); disc50.position.set(0, 1.9 + 0.5 * PH, 0);
    disc30.scale.set(0.75, 0.04, 0.75); disc30.position.set(0, 1.9 + 0.3 * PH, 0);
  }
  v.onFrame((dt) => update(dt));
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(3, 15, 13); controls.target.set(0, 0.8, 0);
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Sanctions3D = { v, update };
}
