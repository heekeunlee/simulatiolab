// 해바라기 3D 보기: 볼록한 꽃판 위의 씨앗(또는 솔방울 비늘)을 지금 고른 각도로 배열한다.
// 2D 시뮬레이션(app.js)이 window.SunflowerState로 내보내는 상태(각도, 씨앗 수, 자란 개수, 색 보기)를 따라간다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const v = canvas && create3D(canvas, { camera: [0, 11.5, 8.6], target: [0, -0.4, 0.9], background: '#f7f2e4', autoRotateSpeed: 0.6, minDistance: 4, maxDistance: 22, aspect: 0.62 });
if (v) {
  const $ = (id) => document.getElementById(id);
  const IDEAL = Math.sqrt(Math.PI), MAXN = 2000;
  const RH = 3, DOME = 0.75;                       // 꽃판 반지름, 볼록한 높이
  const PL = 5.8, PR = 1.8;                        // 솔방울 길이, 최대 반지름
  const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), col = new THREE.Color();

  // ---- 씨앗/비늘: 인스턴스 하나의 메시 ----
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 }), MAXN);
  seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); seeds.count = 0;
  seeds.setColorAt(0, col.set('#fff')); v.scene.add(seeds);

  // ---- 해바라기: 짙은 꽃판 + 녹색 받침 + 꽃잎 두 겹 ----
  const flower = new THREE.Group(); v.scene.add(flower);
  const domeH = (rho) => DOME * (1 - (rho * rho) / (RH * RH));
  {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const r = (RH * 1.09 * i) / 24; pts.push(new THREE.Vector2(r, domeH(Math.min(r, RH)) - 0.06)); }
    const disc = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 64), new THREE.MeshStandardMaterial({ color: '#3a230e', roughness: 0.95, side: THREE.DoubleSide }));
    flower.add(disc);
    const back = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; back.push(new THREE.Vector2(RH * 1.1 * Math.sin((t * Math.PI) / 2) + 0.01, -0.06 - 0.9 * (1 - Math.sin((t * Math.PI) / 2)))); }
    flower.add(new THREE.Mesh(new THREE.LatheGeometry(back, 48), new THREE.MeshStandardMaterial({ color: '#5d8a2f', roughness: 0.85, side: THREE.DoubleSide })));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 5, 16), new THREE.MeshStandardMaterial({ color: '#4f7a26', roughness: 0.8 }));
    stem.position.y = -3.3; flower.add(stem);
    const petalGeo = new THREE.SphereGeometry(1, 14, 8);
    [[34, 0, '#e9a00c', 1.0, -0.08], [34, 0.5, '#f8c62e', 0.92, 0.06]].forEach(([cnt, off, c, len, lift]) => {
      const m = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.18, roughness: 0.55, side: THREE.DoubleSide }), cnt);
      for (let i = 0; i < cnt; i++) {
        const t = ((i + off) / cnt) * Math.PI * 2, l = 1.3 * len * (0.92 + 0.16 * Math.abs(Math.sin(i * 2.3)));
        dummy.position.set(Math.cos(t) * (RH + l * 0.78), lift - 0.1, Math.sin(t) * (RH + l * 0.78));
        dummy.rotation.order = 'YZX'; dummy.rotation.set(0.12 * Math.sin(i * 1.7), -t, -0.18 + lift);
        dummy.scale.set(l, 0.045, 0.42); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
      }
      flower.add(m);
    });
  }

  // ---- 솔방울: 짙은 속심 ----
  const coneR = (t) => PR * Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * t)), 0.65) * (0.62 + 0.38 * t); // t=0 꼭대기, 1 밑동
  const coneY = (t) => PL * (0.5 - t);
  const cone = new THREE.Group(); v.scene.add(cone);
  {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector2(coneR(t) * 0.78 + 0.01, coneY(t))); }
    cone.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: '#2b1a0c', roughness: 1, side: THREE.DoubleSide })));
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.9 }));
    st.position.y = coneY(1) - 0.3; cone.add(st);
  }

  // ---- 색 ----
  function seedColor(k, n, mode, shape) {
    if (mode !== 'index') { const F = Number(mode); return col.setHSL((k % F) / F, 0.72, 0.52); }
    const t = k / n;
    if (shape === 'cone') return col.setHSL((24 + 6 * Math.sin(k * 0.7)) / 360, 0.58, 0.40 - 0.16 * Math.abs(0.5 - t) + 0.04 * Math.sin(k * 1.3));
    return col.setHSL((48 - 24 * t) / 360, 0.88, (62 - 28 * t) / 100);
  }

  // ---- 상태가 바뀌면 배치를 다시 계산 ----
  let key = '', placedKey = -1, nShown = 0;
  function layout(S, shape, mode) {
    const sim = S.sim, n = sim.n, a = (sim.params.angle * Math.PI) / 180;
    if (shape === 'flower') {
      const sc = RH / Math.sqrt(n), rad = Math.max(0.012, (S.size / 100) * 0.5 * IDEAL * sc);
      for (let k = 0; k < n; k++) {
        const x = sim.x[k] * sc, z = sim.y[k] * sc, rho = Math.hypot(x, z);
        nv.set((2 * DOME * x) / (RH * RH), 1, (2 * DOME * z) / (RH * RH)).normalize();
        dummy.position.set(x, domeH(Math.min(rho, RH)) + rad * 0.25, z);
        dummy.quaternion.setFromUnitVectors(up, nv); dummy.scale.set(rad, rad * 0.75, rad);
        dummy.updateMatrix(); seeds.setMatrixAt(k, dummy.matrix); seeds.setColorAt(k, seedColor(k, n, mode, shape));
      }
      nShown = n;
    } else {
      // 솔방울: 비늘 k를 꼭대기에서 밑동 쪽으로 같은 높이 간격, k×각도만큼 돌려 놓는다 (원통 위의 같은 규칙)
      const m = Math.max(60, Math.min(500, Math.round(n / 3))), dy = PL / m, sz = S.size / 80;
      for (let k = 0; k < m; k++) {
        const t = (k + 0.5) / m, r = coneR(t), th = k * a, y = coneY(t);
        const s = Math.sqrt(2 * Math.PI * r * dy) * 0.6 * sz;
        nv.set(Math.cos(th), 0.55, Math.sin(th)).normalize();
        dummy.position.set(Math.cos(th) * r, y, Math.sin(th) * r);
        dummy.quaternion.setFromUnitVectors(up, nv); dummy.scale.set(s, s * 0.55, s * 0.85);
        dummy.updateMatrix(); seeds.setMatrixAt(k, dummy.matrix); seeds.setColorAt(k, seedColor(k, m, mode, shape));
      }
      nShown = m;
    }
    seeds.instanceMatrix.needsUpdate = true; seeds.instanceColor.needsUpdate = true;
  }

  let lastShape = '';
  function sync(force) {
    const S = window.SunflowerState; if (!S || !S.sim) return;
    const shape = $('shape3d').value, cm = $('col3d').value, mode = cm === 'same' ? S.color : cm;
    const k = [S.sim.n, S.sim.params.angle, S.size, mode, shape].join('|');
    if (k !== key || force) { key = k; layout(S, shape, mode); placedKey = -1; }
    if (S.sim.placed !== placedKey) { placedKey = S.sim.placed; seeds.count = Math.min(nShown, Math.round((S.sim.placed / S.sim.n) * nShown)); }
    if (shape !== lastShape) {
      lastShape = shape; flower.visible = shape === 'flower'; cone.visible = shape === 'cone';
      if (shape === 'flower') { v.camera.position.set(0, 11.5, 8.6); v.controls.target.set(0, -0.4, 0.9); }
      else { v.camera.position.set(0, 2.4, 11.5); v.controls.target.set(0, 0, 0); }
      v.controls.update();
    }
    const info = $('info3d');
    if (info) info.textContent = shape === 'flower' ? `씨앗 ${seeds.count}/${nShown}개 · 각도 ${S.sim.params.angle.toFixed(3)}°` : `비늘 ${seeds.count}/${nShown}개 · 각도 ${S.sim.params.angle.toFixed(3)}°`;
  }
  ['shape3d', 'col3d'].forEach((id) => $(id).addEventListener('change', () => { sync(true); v.render(); }));
  // 처음부터 자라기: 위 실험을 다시 시작하면 3D도 함께 자란다
  $('grow3d').addEventListener('click', () => { const r = $('run'); if (r) r.click(); });
  v.onFrame(() => sync(false));
  sync(true);
  // 썸네일 촬영: 회전 없이 정해진 각도에서 바로 그린다 (화면 밖이라도)
  if (window.SunflowerState && window.SunflowerState.thumb) {
    v.controls.autoRotate = false; v.camera.position.set(0, 13.6, 5.0); v.controls.update();
    const shot = () => { sync(false); v.controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
}
