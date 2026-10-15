// ① 손절선 기둥 벽 (3D): app.js가 window.CrashState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 보유자 한 명 = 기둥 하나. 손절선이 가까운(높은) 사람부터 왼쪽에 세웠다. 기둥 꼭대기 높이 = 그 사람의 손절 가격.
// - 붉은 판 = 지금 가격. 판이 내려와 기둥 꼭대기에 닿으면 그 사람이 팔고, 기둥이 넘어진다(빨강 → 회색).
// - 파랑 = 빚 없는 사람, 주황 = 빚을 낸 사람(손절선이 더 가까움), 큰 짙은 상자 = 큰손 묶음, 뒤쪽에 떠 있는 초록 작은 상자 = 저가 매수자(매수 가격 높이, 가격이 닿으면 진해짐 = 삼).
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const st0 = window.CrashState;
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D wall of stop-loss pillars');
  const phone = (canvas.parentElement.clientWidth || 999) < 640;
  if (phone) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [-9, 8, 15], target: [0, 1.8, 0], background: '#f4f6fb', autoRotateSpeed: 0.35, minDistance: 6, maxDistance: 45 });
  if (v) init(v, phone);
}

function init(v, phone) {
  const { scene, camera, controls } = v;
  const ROWS = 25, SP = 0.2, H = 5, MAXN = 2000, MAXB = 1000;
  const COLS = MAXN / ROWS, WX = COLS * SP, WZ = ROWS * SP;
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(WX + 3, 0.12, WZ + 4.6), new THREE.MeshStandardMaterial({ color: 0xe3e7ef, roughness: 0.95 }));
  floor.position.set(0, -0.06, -0.6); scene.add(floor);

  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(-0.5, 0.5, 0);   // 오른쪽 아래 모서리가 원점: 그 모서리를 축으로 오른쪽(+x)으로 넘어진다(땅을 뚫지 않음)
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  const pillars = new THREE.InstancedMesh(geo, mat, MAXN); pillars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pillars.setColorAt(0, col.set('#fff')); pillars.instanceColor.setUsage(THREE.DynamicDrawUsage); pillars.frustumCulled = false; scene.add(pillars);
  const buyers = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAXB); buyers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buyers.setColorAt(0, col.set('#fff')); buyers.instanceColor.setUsage(THREE.DynamicDrawUsage); buyers.frustumCulled = false; scene.add(buyers);
  const whaleM = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })); scene.add(whaleM);

  // 가격 판 (반투명) + 앞 가장자리 선
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(WX + 2.4, WZ + 3.6), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  sheet.rotation.x = -Math.PI / 2; scene.add(sheet);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(WX + 2.4, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
  scene.add(edge);
  const startLine = new THREE.Mesh(new THREE.BoxGeometry(WX + 2.4, 0.025, 0.025), new THREE.MeshBasicMaterial({ color: 0x94a3b8 }));
  startLine.position.set(0, H, WZ / 2 + 1.2); scene.add(startLine);
  // 가격 이름표 (캔버스 글자 → 스프라이트)
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128;
  const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, depthTest: false, transparent: true })); label.scale.set(3.6, 0.9, 1); label.renderOrder = 5; scene.add(label);
  let labelText = '';
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  function setLabel(t) {
    if (t === labelText) return; labelText = t;
    const g = lc.getContext('2d'); g.clearRect(0, 0, 512, 128);
    g.font = '700 54px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const s = tr(t), w = Math.min(500, g.measureText(s).width + 44);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = '#dc2626'; g.lineWidth = 5;
    g.beginPath(); g.roundRect ? g.roundRect((512 - w) / 2, 18, w, 92, 46) : g.rect((512 - w) / 2, 18, w, 92); g.fill(); g.stroke();
    g.fillStyle = '#dc2626'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 256, 66);
    ltex.needsUpdate = true;
  }

  const BLUE = new THREE.Color('#3b82f6'), ORANGE = new THREE.Color('#f59e0b'), FALLING = new THREE.Color('#ef4444'), GONE = new THREE.Color('#b8bec9');
  const BUY0 = new THREE.Color('#bfe8cc'), BUY1 = new THREE.Color('#16a34a');
  let simRef = null, holders = [], fallT = null, PF = 0.84, shownX = 0, buyT = null, whaleT = 0;
  const Y = (p) => Math.max(0.04, ((p - PF) / (1 - PF)) * H);
  function rebuild(sim) {
    simRef = sim; holders = sim.order.filter((a) => !a.whale);
    fallT = new Float32Array(holders.length); buyT = new Float32Array(sim.border.length); whaleT = 0;
    PF = 1 - Math.max(0.16, Math.min(0.32, sim.worst()));
    pillars.count = holders.length; buyers.count = Math.min(MAXB, sim.border.length);
    shownX = sim.path[Math.min(sim.round, sim.path.length - 1)];
    whaleM.visible = !!sim.whale;
    home();
  }
  function home() {
    const asp = (canvas.clientWidth || 600) / (canvas.clientHeight || 375);
    if (asp < 1.3) { camera.position.set(-6, 11, 21); controls.target.set(0, 0.8, 0); }
    else { camera.position.set(-9, 7.5, 15); controls.target.set(0.6, 1.6, 0); }
    controls.update();
  }
  const ease = (t) => t * t * (3 - 2 * t);

  function update(dt) {
    const S = window.CrashState; if (!S || !S.sim) return;
    const sim = S.sim; if (sim !== simRef) rebuild(sim);
    const now = sim.round, thumb = S.thumb;
    const fallRate = dt / 0.6;
    for (let r = 0; r < holders.length; r++) {
      const a = holders[r];
      if (a.sold > 0 && a.sold <= now) fallT[r] = thumb ? 1 : Math.min(1, fallT[r] + fallRate); else fallT[r] = 0;
      const t = ease(fallT[r]), c = Math.floor(r / ROWS), row = r % ROWS;
      const hh = Y(Math.exp(a.line)), wdt = a.lev ? 0.17 : 0.13;
      dummy.position.set(c * SP - WX / 2 + wdt, 0, row * SP - WZ / 2 + 0.07);
      dummy.rotation.set(0, 0, -t * 1.45);
      dummy.scale.set(wdt, hh * (1 - 0.7 * t), wdt); dummy.updateMatrix();
      pillars.setMatrixAt(r, dummy.matrix);
      col.copy(a.lev ? ORANGE : BLUE);
      if (fallT[r] > 0) col.copy(fallT[r] < 1 ? FALLING : GONE);
      pillars.setColorAt(r, col);
    }
    pillars.instanceMatrix.needsUpdate = true; pillars.instanceColor.needsUpdate = true;
    // 저가 매수자: 벽 뒤 네 줄
    const nb = buyers.count, BR = 4, bcols = Math.ceil(nb / BR) || 1;
    for (let j = 0; j < nb; j++) {
      const b = sim.border[j], got = b.bought > 0 && b.bought <= now;
      buyT[j] = got ? (thumb ? 1 : Math.min(1, buyT[j] + dt / 0.4)) : 0;
      const c = Math.floor(j / BR), row = j % BR, hh = Y(Math.exp(b.line));
      const sz = 0.14 + 0.08 * buyT[j];   // 매수선 높이에 떠 있는 작은 받침 (가격이 닿으면 진해지고 조금 커짐 = 삼)
      dummy.position.set((c / bcols) * WX - WX / 2 + sz / 2, hh - sz / 2, -WZ / 2 - 0.5 - row * 0.24);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(sz, sz, sz); dummy.updateMatrix();
      buyers.setMatrixAt(j, dummy.matrix);
      buyers.setColorAt(j, col.copy(BUY0).lerp(BUY1, buyT[j]));
    }
    buyers.instanceMatrix.needsUpdate = true; if (nb) buyers.instanceColor.needsUpdate = true;
    // 큰손: 벽 앞에 큰 상자 하나 (손절선 순서 자리)
    if (sim.whale) {
      const w = sim.whale, rank = sim.order.indexOf(w), c = Math.min(COLS - 1, Math.floor(rank / ROWS));
      const sold = w.sold > 0 && w.sold <= now; whaleT = sold ? (thumb ? 1 : Math.min(1, whaleT + dt / 0.9)) : 0;
      const t = ease(whaleT), side = 0.45 + Math.sqrt(w.size / 2000) * 1.4, hh = Y(Math.exp(w.line));
      whaleM.position.set(c * SP - WX / 2 + side / 2, 0, WZ / 2 + 0.25 + side / 2);
      whaleM.rotation.set(0, 0, -t * 1.45); whaleM.scale.set(side, hh * (1 - 0.6 * t), side);
      whaleM.material.color.set(whaleT > 0 ? (whaleT < 1 ? '#ef4444' : '#8b93a1') : '#334155');
    }
    // 가격 판: 지금 가격으로 부드럽게 내려간다
    const target = sim.path[Math.min(now, sim.path.length - 1)];
    shownX = thumb ? target : shownX + (target - shownX) * Math.min(1, dt * 6);
    const py = Y(Math.exp(shownX));
    sheet.position.set(0, py, -0.6); edge.position.set(0, py, WZ / 2 + 1.2);
    const d = 1 - Math.exp(target);
    setLabel('가격 ' + (d > 0.0005 ? '−' : d < -0.0005 ? '+' : '') + Math.abs(d * 100).toFixed(1) + '%');
    label.position.set(-WX / 2 + 1.6, py + 0.75, WZ / 2 + 1.2);
  }

  v.onFrame((dt) => update(dt));
  update(0.016);
  const rot = document.getElementById('cr-rotate');
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = rot.value === 'on'; });
  if (window.CrashState && window.CrashState.thumb) {
    controls.autoRotate = false; label.visible = false; camera.position.set(-7.5, 6.5, 11.5); controls.target.set(-1.2, 1.6, 0); controls.update();
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
}
