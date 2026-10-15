// ① 소행성 밀기 (3D): app.js가 window.AstState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// 두 가지 크기로 본다: 태양계 전체(태양·지구 궤도·소행성 궤도, 미는 순간의 화살표) ↔ 지구 곁 확대(지구 반지름 = 1, 실제 비율).
// 자동 보기에서는 지구에 다가가 재생이 느려지면 지구 곁 확대로 바뀐다. 두 길(밀기 전 / 민 뒤)은 태양계 크기에서는 겹쳐 보인다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.AstState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of an asteroid being nudged off course');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [2, 30, 40], target: [0, 0, 0], background: '#060a1c', dark: true, autoRotateSpeed: 0.35, minDistance: 3, maxDistance: 400, far: 6000, fov: 45 });
  if (v) init(v);
}

function init(v) {
  const { scene, camera, controls } = v;
  const AS = window.Asteroid, C = AS.C, SMALL = (window.innerWidth || 1000) < 760;
  const AU = 10;   // 태양계 보기: 지구 궤도 반지름 = 10
  scene.children.filter((o) => o.isLight).forEach((l) => { l.intensity = l.isHemisphereLight ? 0.55 : 0.3; });
  const sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 0); scene.add(sunLight);

  // ---------- 별 하늘 (두 보기 공통, 카메라를 따라다닌다) ----------
  const sky = new THREE.Group(); scene.add(sky);
  const rnd = AS.mulberry32(99);
  function starLayer(n, size, op) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u); a.set([1800 * r * Math.cos(th), 1800 * u, 1800 * r * Math.sin(th)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: false, transparent: true, opacity: op, depthWrite: false }));
    pts.frustumCulled = false; sky.add(pts);
  }
  starLayer(SMALL ? 500 : 1400, 1.4, 0.75); starLayer(SMALL ? 60 : 140, 2.6, 0.95);

  // 빛나는 원 (스프라이트용 텍스처)
  function glowTex(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  const glow = (rgb, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(rgb), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(s, s, 1); return sp; };
  const tube = (pts, r, color, closed, op) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, !!closed), Math.max(8, pts.length), r, 6, !!closed),
    new THREE.MeshBasicMaterial({ color, transparent: op != null, opacity: op == null ? 1 : op, depthWrite: op == null }));

  // ---------- 태양계 보기 ----------
  const solar = new THREE.Group(); scene.add(solar);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffd34d })); solar.add(sun); solar.add(glow('255,200,80', 6));
  const eo = []; for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; eo.push(new THREE.Vector3(AU * Math.cos(a), 0, -AU * Math.sin(a))); }
  solar.add(tube(eo, 0.07, 0x5fb3ff, true));
  const earthS = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshLambertMaterial({ color: 0x3b82f6, emissive: 0x0b2a66 })); solar.add(earthS);
  const earthGlow = glow('120,180,255', 2.2); solar.add(earthGlow);
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const astS = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0xff8a3d, emissive: 0x7a2a00 })); astS.scale.setScalar(0.36); solar.add(astS);
  const astGlow = glow('255,150,70', 1.4); solar.add(astGlow);
  let astOrbit = null, trailS = null, arrow = null, pulse = null;
  // 모델 좌표(x, y, z: z는 궤도면 밖) → 화면 좌표(x, 위=y). 지구 궤도면을 바닥으로 눕힌다
  const toS = (p) => new THREE.Vector3(p[0] * AU, p[2] * AU, -p[1] * AU);

  // ---------- 지구 곁 확대 보기 (지구 반지름 = 1, 지구 중심이 원점) ----------
  const near = new THREE.Group(); near.visible = false; scene.add(near);
  const earthN = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhongMaterial({ color: 0x2f6fed, emissive: 0x0a1f4d, shininess: 18 })); near.add(earthN);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.06, 48, 32), new THREE.MeshBasicMaterial({ color: 0x8ec5ff, transparent: true, opacity: 0.22, side: THREE.BackSide, depthWrite: false })); near.add(atm);
  const safeZone = new THREE.Mesh(new THREE.SphereGeometry(C.SAFE, 48, 24), new THREE.MeshBasicMaterial({ color: 0x40c057, transparent: true, opacity: 0.09, depthWrite: false })); near.add(safeZone);
  const safeRing = new THREE.Mesh(new THREE.TorusGeometry(C.SAFE, 0.018, 6, 96), new THREE.MeshBasicMaterial({ color: 0x69db7c })); near.add(safeRing);
  const astN = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0xff8a3d, emissive: 0x7a2a00 })); near.add(astN);
  const ghostN = new THREE.Mesh(rockGeo, new THREE.MeshBasicMaterial({ color: 0xdfe6f2, transparent: true, opacity: 0.55, depthWrite: false })); near.add(ghostN);
  const impact = glow('255,80,80', 1.2); impact.visible = false; near.add(impact);
  const closest = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe066 })); closest.visible = false; near.add(closest);
  let trailN = null, trailG = null, missLine = null;

  let simRef = null, mode = 'sun', nearFrame = null, tick = 0;
  const sel = $('as-view'), rot = $('as-rotate');
  const want = () => (sel ? sel.value : 'auto');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  if (sel) sel.addEventListener('change', () => { mode = ''; update(0); });

  function setMode(m, sim) {
    if (m === mode) return; mode = m;
    solar.visible = m === 'sun'; near.visible = m === 'earth';
    if (m === 'sun') {
      controls.minDistance = 4; controls.maxDistance = 400; controls.target.set(0, 0, 0);
      if (SMALL) camera.position.set(2, 38, 54); else camera.position.set(2, 30, 40); sunLight.position.set(0, 0, 0);
    } else {
      const f = frameFor(sim), R = sim.view;
      controls.minDistance = 2.2; controls.maxDistance = R * 12; controls.target.set(0, 0, 0);
      camera.position.copy(f.cam);
    }
    camera.near = m === 'sun' ? 0.1 : 0.05; camera.updateProjectionMatrix(); controls.update();
  }
  // 지구 곁 화면의 방향: 소행성이 지나가는 직선과 지구 중심이 모두 보이게 그 평면에 수직인 쪽에서 본다
  function frameFor(sim) {
    if (nearFrame && nearFrame.sim === sim) return nearFrame;
    const rel = (t, pushed) => { const a = sim.ast(t, pushed), e = sim.earth(t); return new THREE.Vector3((a[0] - e[0]) / C.RE, (a[2] - e[2]) / C.RE, -(a[1] - e[1]) / C.RE); };
    const pm = rel(sim.tMiss, true), dv = rel(sim.tMiss + sim.passTime * 0.1, true).sub(rel(sim.tMiss - sim.passTime * 0.1, true)).normalize();
    let side = pm.clone().sub(dv.clone().multiplyScalar(pm.dot(dv)));
    if (side.length() < 1e-6) side = new THREE.Vector3(0, 1, 0).cross(dv);
    side.normalize();
    const nrm = dv.clone().cross(side).normalize(), R = sim.view;
    const cam = nrm.clone().multiplyScalar(R * 2.25).add(side.clone().multiplyScalar(R * 0.55)).add(dv.clone().multiplyScalar(-R * 0.35));
    // 태양 빛: 지구에서 태양 쪽
    const e = sim.earth(sim.tMiss), sunDir = new THREE.Vector3(-e[0], -e[2], e[1]).normalize();
    nearFrame = { sim, rel, cam, sunDir, pm };
    return nearFrame;
  }

  function rebuildSolar(sim) {
    if (astOrbit) { solar.remove(astOrbit); astOrbit.geometry.dispose(); }
    const P = sim.period(), n = 220, pts = [];
    for (let i = 0; i < n; i++) pts.push(toS(sim.ast(C.T - P + (P * i) / n, false)));
    astOrbit = tube(pts, 0.05, 0xe9ecef, true, 0.6); solar.add(astOrbit);
    if (arrow) { solar.remove(arrow); arrow = null; }
    const pv = sim.pushVec(), at = toS(sim.ast(sim.tPush, false)), dir = new THREE.Vector3(pv[0], pv[2], -pv[1]).normalize();
    arrow = new THREE.ArrowHelper(dir, at, 4, 0xffe066, 1.3, 0.75); arrow.visible = false; solar.add(arrow);
    if (!pulse) { pulse = glow('255,230,110', 3); solar.add(pulse); }
    pulse.position.copy(at); pulse.visible = false;
    nearFrame = null;
  }
  const setTube = (old, grp, pts, r, color, op) => { if (old) { grp.remove(old); old.geometry.dispose(); } if (pts.length < 2) return null; const m = tube(pts, r, color, false, op); grp.add(m); return m; };

  function update(dt) {
    const st = window.AstState; if (!st || !st.sim) return;
    const sim = st.sim, t = sim.t;
    if (sim !== simRef) { simRef = sim; rebuildSolar(sim); mode = ''; }
    const w = want(), m = w === 'auto' ? (sim.slow || t > C.T ? 'earth' : 'sun') : w;
    setMode(m, sim);
    tick++;
    if (m === 'sun') {
      const e = sim.earth(t); earthS.position.copy(toS(e)); earthGlow.position.copy(earthS.position);
      const a = toS(sim.ast(t, true)); astS.position.copy(a); astGlow.position.copy(a); astS.rotation.x += dt * 0.8; astS.rotation.y += dt * 0.5;
      const pushed = t >= sim.tPush; arrow.visible = pushed;
      const since = t - sim.tPush; pulse.visible = pushed && since < 0.25; if (pulse.visible) { const s = 3 + since * 14; pulse.scale.set(s, s, 1); pulse.material.opacity = 1 - since / 0.25; }
      if (tick % 3 === 0 || dt === 0) {   // 꼬리: 지난 0.35년
        const pts = [], t0 = Math.max(sim.t0, t - 0.35); for (let i = 0; i <= 50; i++) pts.push(toS(sim.ast(t0 + ((t - t0) * i) / 50, true)));
        trailS = setTube(trailS, solar, t - t0 > 1e-4 ? pts : [], 0.09, 0xff922b, 0.9);
      }
    } else {
      const f = frameFor(sim), R = sim.view, rs = Math.max(0.09, R * 0.022);
      sunLight.position.copy(f.sunDir.clone().multiplyScalar(R * 50));
      astN.scale.setScalar(rs); ghostN.scale.setScalar(rs * 0.95);
      const tIn = sim.tMiss - sim.passTime * 2.2, a = f.rel(t, true), g = f.rel(t, false);
      astN.position.copy(a); astN.visible = t > tIn; astN.rotation.x += dt; astN.rotation.y += dt * 0.6;
      // 지구 겉면에 닿으면 멈추고 그 자리가 빛난다: 원래 길(흰색)은 늘 닿고, 민 길(주황)은 지구 반지름 1개 안으로 오면 닿는다
      const path = (pushed) => { const out = []; let hit = null; if (t > tIn) { const n = 70; for (let i = 0; i <= n; i++) { const q = f.rel(tIn + ((t - tIn) * i) / n, pushed); if (q.length() <= 1) { hit = q; break; } out.push(q); } } return { out, hit }; };
      const PA = path(true), PG = path(false);
      ghostN.visible = t > tIn && !PG.hit; ghostN.position.copy(g);
      if (PA.hit) astN.visible = false;
      const hp = PA.hit || PG.hit; impact.visible = !!hp;
      if (hp) { impact.position.copy(hp.clone().normalize().multiplyScalar(1.03)); const s = 1.3 + 0.25 * Math.sin(performance.now() / 180); impact.scale.set(s, s, 1); }
      if (tick % 2 === 0 || dt === 0) {
        trailN = setTube(trailN, near, PA.out, Math.max(0.03, R * 0.006), 0xff922b);
        trailG = setTube(trailG, near, PG.out, Math.max(0.025, R * 0.005), 0xdfe6f2, 0.5);
      }
      const passed = sim.passed(); closest.visible = passed;
      if (passed) {
        closest.position.copy(f.pm); closest.scale.setScalar(rs * 0.55);
        if (!missLine || missLine.userData.sim !== sim) { if (missLine) { near.remove(missLine); missLine.geometry.dispose(); } missLine = f.pm.length() > 0.05 ? tube([new THREE.Vector3(0, 0, 0), f.pm.clone()], Math.max(0.02, R * 0.004), 0xffe066) : null; if (missLine) { missLine.userData.sim = sim; near.add(missLine); } }
        if (missLine) missLine.visible = true;
      } else if (missLine) missLine.visible = false;
      earthN.rotation.y += dt * 0.05;
    }
    sky.position.copy(camera.position);
  }
  v.onFrame((dt) => update(dt));
  update(0);
  if (st0.thumb) {
    controls.autoRotate = false;
    const shot = () => { update(0); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Ast3D = { v, update, mode: () => mode };
}
