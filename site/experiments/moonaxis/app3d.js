// ① 기울어진 지구와 흔들리는 자전축 (3D): app.js가 window.MoonState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 지구 표면 색 = 계절 띠: 해가 머리 위로 올 수 있는 띠(위도 ±기울기, 노랑), 백야·극야가 생기는 곳(위도 90−기울기 위, 흰 하늘색)
// - 흰 막대 = 지금 설정의 자전축, 회색 막대 = 비교 지구의 자전축, 빛나는 꼬리 = 축 끝이 지나온 길(세차), 주황 점선 = 궤도면에 수직인 방향
// - 해·달·지구 자전은 계절과 모양을 보여 주려는 장식(1년·한 달·하루를 몇 초로 줄여 돌림)이며 결과에는 영향이 없다
// 좌표: 시뮬레이션 (x, y, z: z = 궤도면 수직) → three.js (x, z, −y)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.MoonState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of the tilted Earth and its wobbling spin axis');
  const phone = (canvas.parentElement.clientWidth || 999) < 640;
  if (phone) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: phone ? [48, 30, 64] : [42, 26, 54], target: [0, 0, 0], background: '#0b1026', dark: true, autoRotateSpeed: 0.35, minDistance: 22, maxDistance: 220, far: 3000, fov: 45 });
  if (v) init(v, phone);
}

function init(v, phone) {
  const { scene, camera, controls } = v;
  const MA = window.MoonAxis, R = 10;
  const toW = (x, y, z, out) => out.set(x, z, -y);
  // 별: 멀리 큰 공 위의 점들 (밝고 굵게)
  { const N = phone ? 700 : 1400, pos = new Float32Array(N * 3), rnd = MA.mulberry32(99);
    for (let i = 0; i < N; i++) { const u = rnd() * 2 - 1, a = rnd() * 2 * Math.PI, r = 700, s = Math.sqrt(1 - u * u); pos[i * 3] = r * s * Math.cos(a); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(a); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: phone ? 1.6 : 2, sizeAttenuation: false, transparent: true, opacity: 0.85 }))); }

  // 지구: 계절 띠를 그리는 셰이더 (위도는 지금 자전축 기준으로 계산)
  const U = { uAxis: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uEps: { value: 0.4 }, uSpin: { value: 0 }, uRef: { value: new THREE.Vector3(1, 0, 0) } };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize((modelMatrix * vec4(position,1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uAxis; uniform vec3 uSun; uniform float uEps; uniform float uSpin; uniform vec3 uRef; varying vec3 vN;
      // (band edges, meridians so the spin shows, equator line)
      void main(){ vec3 N = normalize(vN); float lat = asin(clamp(dot(N, uAxis), -1.0, 1.0)); float al = abs(lat);
        vec3 e1 = normalize(uRef - dot(uRef, uAxis) * uAxis), e2 = cross(uAxis, e1);
        float lon = atan(dot(N, e2), dot(N, e1)) + uSpin;
        vec3 mid = vec3(0.16, 0.45, 0.78), trop = vec3(0.98, 0.78, 0.22), pole = vec3(0.90, 0.95, 1.0);
        vec3 c = mid;
        if (al < uEps) c = trop; else if (al > 1.5708 - uEps) c = pole;
        float edge = min(abs(al - uEps), abs(al - (1.5708 - uEps)));
        c = mix(c * 0.55, c, smoothstep(0.0, 0.022, edge));
        float mer = abs(fract(lon / 0.5236 + 0.5) - 0.5); c *= mix(0.86, 1.0, smoothstep(0.0, 0.05, mer));
        float eq = abs(lat); c = mix(vec3(1.0), c, smoothstep(0.0, 0.012, eq));
        float d = dot(N, uSun); float light = 0.30 + 0.80 * smoothstep(-0.15, 0.35, d);
        gl_FragColor = vec4(c * light, 1.0); }`,
  }));
  scene.add(earth);
  // 축 막대 (지금 설정 = 흰색, 비교 = 회색) + 북쪽 끝 표시
  const rodGeo = new THREE.CylinderGeometry(0.32, 0.32, 2 * R + 14, 12);
  const rod = new THREE.Mesh(rodGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const rodT = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2 * R + 10, 8), new THREE.MeshBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.85 }));
  scene.add(rod, tip, rodT);
  // 궤도면에 수직인 방향 (주황 점선) + 궤도면 고리
  const nLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -(R + 12), 0), new THREE.Vector3(0, R + 12, 0)]);
  const nLine = new THREE.Line(nLineGeo, new THREE.LineDashedMaterial({ color: 0xff8a3d, dashSize: 1.2, gapSize: 0.9 })); nLine.computeLineDistances(); scene.add(nLine);
  const plane = new THREE.Group(); scene.add(plane);
  const ring = new THREE.Mesh(new THREE.RingGeometry(R + 13.5, R + 14.1, 96), new THREE.MeshBasicMaterial({ color: 0x8fa3c7, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
  ring.rotation.x = -Math.PI / 2; plane.add(ring);
  // 해(장식: 궤도면 위를 돌아 계절을 보여 줌)와 달(장식: 크기 = 달의 무게)
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
  plane.add(sun);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshLambertMaterial({ color: 0xd8dde6, emissive: 0x2a2f38 })); plane.add(moon);
  // 축 끝이 지나온 길 (빛나는 꼬리, 오래된 곳은 어둡게)
  const MAXT = 1100, tpos = new Float32Array(MAXT * 3), tcol = new Float32Array(MAXT * 3);
  const tgeo = new THREE.BufferGeometry(); tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); tgeo.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
  const trail = new THREE.Line(tgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })); trail.frustumCulled = false; scene.add(trail);
  const tgeo2 = new THREE.BufferGeometry(), tpos2 = new Float32Array(MAXT * 3); tgeo2.setAttribute('position', new THREE.BufferAttribute(tpos2, 3));
  const trail2 = new THREE.Line(tgeo2, new THREE.LineBasicMaterial({ color: 0x7c879a, transparent: true, opacity: 0.55 })); trail2.frustumCulled = false; scene.add(trail2);

  const Y = new THREE.Vector3(0, 1, 0), ax = new THREE.Vector3(), axT = new THREE.Vector3(), nW = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  const C_NEW = new THREE.Color('#7dd3fc'), C_OLD = new THREE.Color('#1e3a8a'), col = new THREE.Color();
  const rot = $('mo-rotate'); const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  const TL = 1.0 * R + 7;   // 꼬리 = 축 끝(북쪽) 자리
  let clock = 0;

  function axisOf(s, a, out) {   // 한 걸음 전과 지금 사이를 시간 비율 a만큼 이어 그린다 (보간, 결과에는 영향 없음)
    const p = s.prevS, c = s.s; toW(p[0] + (c[0] - p[0]) * a, p[1] + (c[1] - p[1]) * a, p[2] + (c[2] - p[2]) * a, out); return out.normalize();
  }
  function fillTrail(s, pos, geo, colors) {
    const sh = s.sh, n = Math.min(MAXT, sh.length / 3), off = sh.length / 3 - n;
    for (let i = 0; i < n; i++) {
      const j = (off + i) * 3; toW(sh[j], sh[j + 1], sh[j + 2], tmp).normalize().multiplyScalar(TL);
      pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
      if (colors) { col.copy(C_OLD).lerp(C_NEW, Math.pow(i / Math.max(1, n - 1), 1.6)); colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
    }
    geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = true; if (colors) geo.attributes.color.needsUpdate = true;
  }
  let lastT = -1, lastSim = null;
  function update(dt) {
    const st = window.MoonState; if (!st || !st.sim) return;
    const sim = st.sim, tw = st.twin, still = st.isPaused() || st.thumb;
    const a = still ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    if (!st.thumb) clock += dt;
    axisOf(sim, a, ax); axisOf(tw, a, axT);
    q.setFromUnitVectors(Y, ax); rod.quaternion.copy(q); tip.position.copy(ax).multiplyScalar(R + 7);
    rodT.quaternion.setFromUnitVectors(Y, axT);
    const nn = sim.normalAt(sim.t); toW(nn[0], nn[1], nn[2], nW).normalize();
    const qn = new THREE.Quaternion().setFromUnitVectors(Y, nW); nLine.quaternion.copy(qn); plane.quaternion.copy(qn);
    // 장식: 해는 6초에 한 바퀴(1년), 달은 2.4초에 한 바퀴, 지구는 1.5초에 한 바퀴 자전
    const ys = clock * 2 * Math.PI / 6, ym = clock * 2 * Math.PI / 2.4 + 1;
    sun.position.set(32 * Math.cos(ys), 0, 32 * Math.sin(ys));
    const mm = sim.params.moon; moon.visible = mm > 0.001;
    moon.scale.setScalar(2.7 * Math.cbrt(Math.max(0.001, mm))); moon.position.set(24 * Math.cos(ym), 0, 24 * Math.sin(ym));
    sun.updateMatrixWorld(); sun.getWorldPosition(tmp); U.uSun.value.copy(tmp).normalize();
    U.uAxis.value.copy(ax); U.uEps.value = Math.acos(Math.max(-1, Math.min(1, ax.dot(nW)))); U.uSpin.value = clock * 2 * Math.PI / 1.5;
    if (sim !== lastSim || sim.t !== lastT) { lastSim = sim; lastT = sim.t; fillTrail(sim, tpos, tgeo, tcol); fillTrail(tw, tpos2, tgeo2, null); }
  }
  v.onFrame((dt) => update(dt));
  update(0);
  if (st0.thumb) {
    controls.autoRotate = false; clock = 1.3;
    camera.position.set(28, 20, 36);
    const shot = () => { update(0); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Moon3D = { v, update };
}
