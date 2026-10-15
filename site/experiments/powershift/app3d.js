// ① 100개의 평행 세계, 위험의 산맥 (3D): app.js가 window.PowershiftState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 바닥 지형: 가로 = 해(0~100년), 깊이 = 세계(100개), 높이·색 = 그 세계의 그 해 충돌 위험. 재생이 지난 해까지만 솟는다.
// - 진한 점 = 각 세계에서 추격국이 지키는 나라를 따라잡은 해(힘 비율 1), 빨간 핀 = 충돌이 난 곳(그 뒤로 그 세계는 회색으로 멈춤)
// - 뒤쪽 벽 = 첫 번째 세계의 두 나라 힘 몫(파랑: 지키는 나라, 주황: 추격국). 두 선이 엇갈리는 곳이 교차 시점
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const st0 = window.PowershiftState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of conflict risk across 100 parallel worlds over 100 years');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.0';
  const v = create3D(canvas, { camera: [21, 16, 24], target: [0, 2.6, -1], background: '#f4f6fb', autoRotateSpeed: 0.35, minDistance: 14, maxDistance: 120, fov: 45 });
  if (v) init(v);
}

function tr(s) { return window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s; }
function textSprite(text, color, size) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 44;
  g.font = `600 ${fs}px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = fs + 22;
  g.font = `600 ${fs}px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, 0, w, c.height); g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 12, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  const k = size || 1.1; s.scale.set((k * w) / c.height, k, 1); s.renderOrder = 10; return s;
}

function init(v) {
  const { scene, camera, controls } = v;
  const sim0 = st0.sim, YEARS = sim0.T, NW = sim0.worlds.length;
  const SX = 40, SZ = 24, HZ = 8.5, WALLZ = -SZ / 2 - 2.2, WALLH = 8;
  const X = (t) => (t / YEARS - 0.5) * SX, Z = (j) => (j / (NW - 1) - 0.5) * SZ;

  // 바닥 판
  const base = new THREE.Mesh(new THREE.BoxGeometry(SX + 1.2, 0.3, SZ + 1.2), new THREE.MeshLambertMaterial({ color: 0xdfe4ee }));
  base.position.y = -0.16; scene.add(base);

  // 위험 지형: 해 101점 × 세계 NW점
  const geo = new THREE.PlaneGeometry(SX, SZ, YEARS, NW - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, nV = pos.count, col = new Float32Array(nV * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  terrain.position.y = 0.02; scene.add(terrain);
  // PlaneGeometry 꼭짓점 순서: 행(깊이) 우선. rotateX(-90°) 뒤 행 0은 z = -SZ/2 쪽
  const idx = (i, j) => j * (YEARS + 1) + i;   // i = 해, j = 세계(행)

  const C_FUT = new THREE.Color('#eef1f6'), C_POST = new THREE.Color('#c3c8d2');
  const STOPS = [[0, '#d3e9d0'], [0.25, '#ffe066'], [0.55, '#ff922b'], [1, '#c92a2a']].map(([a, h]) => [a, new THREE.Color(h)]);
  const tmp = new THREE.Color();
  function heat(q) { for (let k = 1; k < STOPS.length; k++) if (q <= STOPS[k][0]) return tmp.copy(STOPS[k - 1][1]).lerp(STOPS[k][1], (q - STOPS[k - 1][0]) / (STOPS[k][0] - STOPS[k - 1][0])); return tmp.copy(STOPS[STOPS.length - 1][1]); }

  // 충돌 핀
  const pinHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshLambertMaterial({ color: 0xd6336c }), NW);
  const pinStem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), new THREE.MeshLambertMaterial({ color: 0x9c1c4a }), NW);
  [pinHead, pinStem].forEach((m) => { m.count = 0; m.frustumCulled = false; scene.add(m); });
  // 따라잡은 해를 이은 선
  const crossGeo = new THREE.BufferGeometry(), crossPos = new Float32Array(NW * 3);
  crossGeo.setAttribute('position', new THREE.BufferAttribute(crossPos, 3));
    const crossDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1f2937 }), NW);
  crossDots.count = 0; crossDots.frustumCulled = false; scene.add(crossDots);

  // 뒤쪽 벽: 첫 번째 세계의 힘 몫
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(SX + 1.2, WALLH + 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  wall.position.set(0, WALLH / 2, WALLZ - 0.05); scene.add(wall);
  const half = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-SX / 2, WALLH / 2, WALLZ), new THREE.Vector3(SX / 2, WALLH / 2, WALLZ)]), new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.6, gapSize: 0.4 }));
  half.computeLineDistances(); scene.add(half);
  const matD = new THREE.MeshLambertMaterial({ color: 0x2f6fed }), matC = new THREE.MeshLambertMaterial({ color: 0xe8590c });
  let tubeD = null, tubeC = null;
  function tubes(w0, t) {
    [tubeD, tubeC].forEach((m) => { if (m) { scene.remove(m); m.geometry.dispose(); } });
    tubeD = tubeC = null; if (t < 1) return;
    const pD = [], pC = [];
    for (let k = 0; k <= t; k++) { const s = w0.C_[k] / (w0.C_[k] + w0.D_[k]); pD.push(new THREE.Vector3(X(k), (1 - s) * WALLH, WALLZ)); pC.push(new THREE.Vector3(X(k), s * WALLH, WALLZ)); }
    const mk = (pts, mat) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(2, pts.length * 2), 0.16, 6, false), mat); scene.add(m); return m; };
    tubeD = mk(pD, matD); tubeC = mk(pC, matC);
  }

  // 축 글자 (번역은 dyn_powershift.py)
  const lab1 = textSprite(tr('해 (0 → 100년)'), '#374151', 1.3); lab1.position.set(0, 0.2, SZ / 2 + 2.2); scene.add(lab1);
  const lab2 = textSprite(tr('100개의 세계'), '#374151', 1.3); lab2.position.set(SX / 2 + 3.2, 0.2, 0); scene.add(lab2);
  const lab3 = textSprite(tr('첫 번째 세계의 힘 몫'), '#374151', 1.3); lab3.position.set(-SX / 2 + 8, WALLH + 1.1, WALLZ); scene.add(lab3);

  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  let lastKey = '';
  function update() {
    const st = window.PowershiftState; if (!st || !st.sim) return;
    const sim = st.sim, t = sim.t, key = sim.params.seed + '|' + JSON.stringify([sim.params.g, sim.params.d, sim.params.u, sim.params.reform]) + '|' + t;
    if (key === lastKey) return; lastKey = key;
    const HM = st.hmax;
    // 행 j(깊이 앞→뒤)에 세계를 놓는다: 첫 번째 세계는 맨 앞(z 큰 쪽)
    for (let j = 0; j < NW; j++) {
      const w = sim.worlds[NW - 1 - j];
      for (let i = 0; i <= YEARS; i++) {
        const k = idx(i, j); let y = 0, c;
        if (i > t) c = C_FUT;
        else {
          const hz = w.haz[Math.min(i, t - 1)];
          if (t === 0) c = C_FUT;
          else if (hz == null || (w.war >= 0 && i > w.war)) c = C_POST;
          else { const q = Math.min(1, hz / HM); y = q * HZ; c = heat(Math.sqrt(q)); }
        }
        pos.setY(k, y); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
    // 핀·교차선
    let np = 0, nc = 0;
    for (let j = 0; j < NW; j++) {
      const w = sim.worlds[NW - 1 - j], zz = (j / (NW - 1) - 0.5) * SZ;
      if (w.war >= 0 && w.war <= t) {
        const hz = w.haz[w.war - 1] || 0, y = Math.min(1, hz / HM) * HZ, top = y + 1.6;
        p3.set(X(w.war), top, zz); s3.set(1, 1, 1); m4.compose(p3, q4, s3); pinHead.setMatrixAt(np, m4);
        p3.set(X(w.war), (y + top) / 2, zz); s3.set(1, top - y, 1); m4.compose(p3, q4, s3); pinStem.setMatrixAt(np, m4); np++;
      }
      if (w.cross >= 0 && w.cross <= t) {
        const ii = Math.min(w.cross, YEARS), hz = w.war >= 0 && ii > w.war ? 0 : (w.haz[Math.min(ii, t - 1)] || 0), y = Math.min(1, hz / HM) * HZ + 0.12;
        crossPos[nc * 3] = X(ii); crossPos[nc * 3 + 1] = y; crossPos[nc * 3 + 2] = zz;
        p3.set(X(ii), y, zz); s3.set(1, 1, 1); m4.compose(p3, q4, s3); crossDots.setMatrixAt(nc, m4); nc++;
      }
    }
    pinHead.count = pinStem.count = np; pinHead.instanceMatrix.needsUpdate = pinStem.instanceMatrix.needsUpdate = true;
    crossDots.count = nc; crossDots.instanceMatrix.needsUpdate = true;
    crossGeo.setDrawRange(0, nc); crossGeo.attributes.position.needsUpdate = true;
    tubes(sim.worlds[0], t);
  }
  v.onFrame(() => update());
  update();
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(19, 15, 21);
    [lab1, lab2, lab3].forEach((s) => { s.visible = false; });
    const shot = () => { update(); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  const rot = document.getElementById('ps-rotate');
  if (rot) { const on = () => rot.value === 'on'; rot.addEventListener('change', () => { controls.autoRotate = on(); }); if (!st0.thumb) controls.autoRotate = on() && controls.autoRotate; }
  window.Powershift3D = { v, update };
}
