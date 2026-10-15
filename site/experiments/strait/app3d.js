// ① 가상 지구본 위 항로망 (3D): app.js가 window.StraitState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 바다·땅은 가상의 배치(둥근 땅 덩어리 몇 개를 겹친 것, 실제 대륙 아님). 해협 = 땅 덩어리 사이의 좁은 틈.
// - 바닷길: 곡선 관, 색 = 짐 ÷ 용량(파랑 → 빨강, 100%를 넘으면 빨강). 막힌 길목 = 빨간 고리 + 옅은 관.
// - 화물 점: 지금 그 길에 실린 짐에 비례한 개수, 걸리는 일수가 길수록 느리게 흐른다(보기용 표시).
// - 길목 앞 줄: 쌓인 줄(sim.Q)에 비례한 점 무리. 항구 기둥: 높이 = 수입 물가 지수 − 100, 색 = 막힌 길목을 쓰던 나라/안 쓰던 나라.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.StraitState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', 'A 3D imaginary globe with sea routes, cargo and import prices');
  const phone = (canvas.parentElement.clientWidth || 999) < 640;
  if (phone) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: phone ? [21, 15, 24] : [18, 13, 20], target: [0, 0, 0], background: '#eef4fa', autoRotateSpeed: 0.45, minDistance: 15, maxDistance: 80, fov: 45 });
  if (v) init(v, phone);
}

function init(v, phone) {
  const { scene, camera, controls } = v;
  const SM = window.Strait, R = 10, D2R = Math.PI / 180;
  const dirOf = (lat, lon, out = new THREE.Vector3()) => out.set(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));
  const C_USE = new THREE.Color('#e8890c'), C_FAR = new THREE.Color('#7c4dff'), C_LO = new THREE.Color('#3b82f6'), C_MID = new THREE.Color('#f59e0b'), C_HI = new THREE.Color('#d62828');

  // ---------- 지구본: 가상의 땅 (둥근 덩어리를 겹치고 가장자리를 물결로) ----------
  const LAND = [[33, 0, 13], [-14, 0, 17], [12, 120, 12], [-28, 120, 15], [12, -120, 12], [-28, -120, 15], [42, 180, 10], [44, 98, 9], [44, -98, 9], [-48, 40, 11], [-48, -40, 11], [-84, 0, 12], [-56, 180, 7]];
  const caps = LAND.map(([la, lo, r]) => { const d = dirOf(la, lo); return new THREE.Vector4(d.x, d.y, d.z, r * D2R); });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uCaps: { value: caps } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec4 uCaps[${caps.length}]; varying vec3 vN;
      void main(){ vec3 N = normalize(vN); float best = -1.0;
        for (int i = 0; i < ${caps.length}; i++) { float a = acos(clamp(dot(N, uCaps[i].xyz), -1.0, 1.0)); best = max(best, 1.0 - a / uCaps[i].w); }
        float wob = 0.10 * sin(N.x * 23.0 + N.y * 11.0) * sin(N.z * 19.0 - N.y * 7.0) + 0.05 * sin(N.y * 41.0 + N.z * 29.0);
        float land = best + wob;
        vec3 sea = mix(vec3(0.62, 0.82, 0.93), vec3(0.72, 0.88, 0.96), smoothstep(-0.9, 0.0, land));
        vec3 ground = mix(vec3(0.93, 0.89, 0.78), vec3(0.86, 0.90, 0.76), smoothstep(0.1, 0.6, land));
        vec3 c = land > 0.0 ? ground : sea;
        c = mix(c, vec3(0.55, 0.62, 0.66), 0.55 * (1.0 - smoothstep(0.0, 0.035, abs(land))));
        float grid = max(1.0 - smoothstep(0.0, 0.012, abs(fract(atan(N.z, N.x) / 0.5236 + 0.5) - 0.5)), 1.0 - smoothstep(0.0, 0.012, abs(fract(asin(N.y) / 0.5236 + 0.5) - 0.5)));
        c = mix(c, vec3(1.0), 0.18 * grid);
        float l = 0.78 + 0.28 * max(0.0, dot(N, normalize(vec3(0.5, 0.8, 0.6))));
        gl_FragColor = vec4(c * l, 1.0); }`,
  }));
  scene.add(globe);

  // ---------- 그래프 좌표 ----------
  const sim0 = window.StraitState.sim;
  const PORTS = SM.PORTS, SEAS = SM.SEAS, ROUTES = SM.ROUTES, NP = PORTS.length;
  const nodeDir = (i) => (i < NP ? dirOf(PORTS[i].lat, PORTS[i].lon) : dirOf(SEAS[i - NP].hub[0], SEAS[i - NP].hub[1]));
  // 구면 위 a → b 를 따라가는 점들 (중간에 들러 가는 점 via), 높이는 가운데가 조금 솟게
  function arcPts(dirs, lift, N) {
    const seg = [], lens = []; let tot = 0;
    for (let i = 1; i < dirs.length; i++) { const a = dirs[i - 1].angleTo(dirs[i]); lens.push(a); tot += a; }
    const out = [];
    for (let k = 0; k < N; k++) {
      let s = (k / (N - 1)) * tot, j = 0; while (j < lens.length - 1 && s > lens[j]) { s -= lens[j]; j++; }
      const a = dirs[j], b = dirs[j + 1], th = lens[j], f = th > 1e-6 ? s / th : 0;
      const p = new THREE.Vector3().copy(a).multiplyScalar(Math.sin((1 - f) * th)).addScaledVector(b, Math.sin(f * th)).divideScalar(Math.sin(th) || 1).normalize();
      out.push(p.multiplyScalar(R + 0.08 + lift * Math.sin(Math.PI * k / (N - 1))));
    }
    return { pts: out, len: tot };
  }
  const E = sim0.E, NPTS = 64;
  const edges = E.map((e, k) => {
    const isRoute = e.route >= 0, r = isRoute ? ROUTES[e.route] : null;
    const dirs = [nodeDir(e.u)].concat(r ? r.via.map(([la, lo]) => dirOf(la, lo)) : [], [nodeDir(e.v)]);
    const { pts, len } = arcPts(dirs, isRoute ? 0.25 + 0.9 * (dirs[0].angleTo(dirs[dirs.length - 1]) / Math.PI) : 0.12, NPTS);
    const curve = new THREE.CatmullRomCurve3(pts);
    const mat = new THREE.MeshBasicMaterial({ color: isRoute ? 0x3b82f6 : 0x7aa2d6, transparent: true, opacity: isRoute ? 0.95 : 0.75 });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, isRoute ? 96 : 24, isRoute ? (phone ? 0.11 : 0.09) : 0.045, 8, false), mat);
    scene.add(mesh);
    return { k, pts, len, mesh, mat, isRoute, phase: [Math.random(), Math.random()] };
  });
  // 막힌 길목 고리
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd62828 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.13, 10, 40), ringMat); ring.visible = false; scene.add(ring);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.16), ringMat), cross2 = cross.clone(); cross2.rotation.z = Math.PI / 2; ring.add(cross, cross2);
  // 길목마다 줄이 서는 자리: 해협은 지나는 점, 우회로는 길 가운데
  const qSpot = ROUTES.map((r, ri) => { const ed = edges[sim0.RE[ri]]; return ed.pts[Math.floor(NPTS / 2)].clone(); });

  // ---------- 항구 기둥 ----------
  const pillars = PORTS.map((p, i) => {
    const d = nodeDir(i), g = new THREE.CylinderGeometry(0.22, 0.22, 1, 14); g.translate(0, 0.5, 0);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xe8890c }));
    m.position.copy(d).multiplyScalar(R + 0.02); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); scene.add(m);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    base.position.copy(d).multiplyScalar(R + 0.03); base.quaternion.copy(m.quaternion); scene.add(base);
    return m;
  });

  // ---------- 화물 점 · 줄 점 (인스턴스드) ----------
  const MAXD = phone ? 520 : 1000, DPU = phone ? 0.22 : 0.34;
  const dotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(phone ? 0.15 : 0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1f2a44 }), MAXD);
  dotMesh.frustumCulled = false; scene.add(dotMesh);
  const MAXQ = phone ? 260 : 420;
  const qMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(phone ? 0.16 : 0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xb91c1c }), MAXQ);
  qMesh.frustumCulled = false; scene.add(qMesh);
  const M4 = new THREE.Matrix4(), P3 = new THREE.Vector3(), Tn = new THREE.Vector3(), Bn = new THREE.Vector3(), Nn = new THREE.Vector3(), tmpC = new THREE.Color();
  function heat(x, out) { if (x <= 0.8) return out.copy(C_LO); if (x <= 1) return out.copy(C_LO).lerp(C_MID, (x - 0.8) / 0.2); return out.copy(C_MID).lerp(C_HI, Math.min(1, (x - 1) / 0.3)); }
  function ptAt(ed, u, lift, out) {
    const f = Math.max(0, Math.min(0.99999, u)) * (NPTS - 1), i = f | 0, r = f - i;
    out.copy(ed.pts[i]).lerp(ed.pts[i + 1], r); if (lift) out.multiplyScalar(1 + lift / R); return out;
  }

  const rot = $('st-rotate'); const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  let lastSim = null, lastT = -1;
  function restyle(sim) {
    edges.forEach((ed) => {
      if (!ed.isRoute) return;
      const ri = E[ed.k].route, blk = sim.blocked && ri === sim.blockedRoute;
      if (blk) { ed.mat.color.set(0xd62828); ed.mat.opacity = 0.28; }
      else { heat(sim.flow[ed.k] / E[ed.k].cap, ed.mat.color); ed.mat.opacity = 0.95; }
    });
    ring.visible = sim.blocked && sim.blockedRoute >= 0;
    if (ring.visible) {
      const r = ROUTES[sim.blockedRoute], d = r.via.length ? dirOf(r.via[0][0], r.via[0][1]) : qSpot[sim.blockedRoute].clone().normalize();
      ring.position.copy(d).multiplyScalar(R + 0.55); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    }
    PORTS.forEach((p, i) => {
      const hgt = Math.max(0.15, 0.15 + (sim.idx[i] - 100) * 0.11);
      pillars[i].scale.set(1, Math.min(9, hgt), 1);
      pillars[i].material.color.copy(sim.uses[i] ? C_USE : C_FAR);
    });
    // 줄: 길목 앞에 해바라기 씨처럼 둥글게 쌓는다
    let q = 0;
    ROUTES.forEach((r, ri) => {
      const n = Math.min(80, Math.round(sim.routeQ(ri) / 2.5)); if (!n) return;
      const c = qSpot[ri]; Nn.copy(c).normalize(); Tn.set(0, 1, 0).cross(Nn).normalize(); Bn.copy(Nn).cross(Tn);
      for (let j = 0; j < n && q < MAXQ; j++, q++) {
        const rr = 0.28 * Math.sqrt(j + 0.5), a = j * 2.39996;
        P3.copy(c).addScaledVector(Tn, rr * Math.cos(a)).addScaledVector(Bn, rr * Math.sin(a)).addScaledVector(Nn, 0.25 + 0.05 * (j % 3));
        M4.makeTranslation(P3.x, P3.y, P3.z); qMesh.setMatrixAt(q, M4);
      }
    });
    qMesh.count = q; qMesh.instanceMatrix.needsUpdate = true;
  }
  function update(dt) {
    const st = window.StraitState; if (!st || !st.sim) return;
    const sim = st.sim, still = st.isPaused() || st.thumb;
    if (sim !== lastSim || sim.t !== lastT) { lastSim = sim; lastT = sim.t; restyle(sim); }
    // 화물 점: 지금 길마다 실린 짐(방향별)에 비례한 개수, 걸리는 일수가 길수록 느리게
    let n = 0;
    for (const ed of edges) {
      const k = ed.k, cst = sim.cost[k];
      if (!isFinite(cst)) continue;
      const rate = (still ? 0 : dt) * 2.2 / Math.max(2, cst);
      for (let dir = 0; dir < 2; dir++) {
        ed.phase[dir] = (ed.phase[dir] + rate) % 1;
        const cnt = Math.round(sim.dirF[k * 2 + dir] * DPU * (ed.isRoute ? 1 : 0.8));
        for (let j = 0; j < cnt && n < MAXD; j++, n++) {
          let u = (j / cnt + ed.phase[dir]) % 1; if (dir === 1) u = 1 - u;
          ptAt(ed, u, ed.isRoute ? (dir ? 0.16 : 0.02) : 0.05, P3);
          M4.makeTranslation(P3.x, P3.y, P3.z); dotMesh.setMatrixAt(n, M4);
        }
      }
    }
    dotMesh.count = n; dotMesh.instanceMatrix.needsUpdate = true;
  }
  v.onFrame((dt) => update(dt));
  update(0);
  if (st0.thumb) {
    controls.autoRotate = false;
    const d = dirOf(28, -10).multiplyScalar(phone ? 30 : 30); camera.position.copy(d);
    const shot = () => { update(0.016); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Strait3D = { v, update };
}
