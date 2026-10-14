// 산불 3D 보기: 2D 실험(app.js)이 window.WildfireState로 내보내는 두 숲(A=그냥 두기, B=작은 불 끄기)을 그대로 입체로 세운다.
// - 3D는 따로 계산하지 않는다. 재생·일시정지·처음부터·슬라이더는 위 2D 숲을 따라가고, 지금 도달한 단계만 그린다.
// - 나무 = 초록 원뿔 (키·색: 나무 나이, 2D 색과 같은 기준), 지금 타는 불 = 주황 기둥(2D의 불꽃 2단계),
//   바닥 = 칸 하나가 텍셀 하나인 판 (짙은 회색: 방금 탄 땅 → 시간이 지나며 밝은 흙색 빈 땅으로)
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const S = 20;            // 화면 단위: 숲 한 변 = 20
const MAXN = 160 * 160;  // 슬라이더 최대 크기 (160×160칸)

const FAR = canvas && (canvas.parentElement.clientWidth || 999) < 600 ? 1.3 : 1; // 휴대폰(정사각 화면)에서는 숲 전체가 들어오게 조금 멀리
const v = canvas && create3D(canvas, { camera: [0, 15.5 * FAR, 19 * FAR], target: [0, 0.4, 0.6], background: '#eef2f6', autoRotateSpeed: 0.5, minDistance: 8, maxDistance: 60, aspect: 0.62 });
if (v) {
  const { scene } = v;
  // 원뿔 하나 (밑면이 y=0)
  const cone = new THREE.ConeGeometry(0.5, 1, 7); cone.translate(0, 0.5, 0);
  const trees = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXN);
  const fire = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), MAXN);
  [trees, fire].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; scene.add(m); });

  // 바닥 판: 윗면에 칸 색 텍스처, 옆면은 흙색
  const SLAB = 0.5;
  let tex = null, texN = 0;
  const side = new THREE.MeshLambertMaterial({ color: 0x8a7458 });
  const topMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(S, SLAB, S), [side, side, topMat, side, side, side]);
  slab.position.y = -SLAB / 2; scene.add(slab);
  function ensureTex(n) {
    if (texN === n) return;
    if (tex) tex.dispose();
    tex = new THREE.DataTexture(new Uint8Array(n * n * 4), n, n, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; topMat.map = tex; topMat.needsUpdate = true; texN = n;
  }

  const SOIL = [205, 184, 146], ASH = [74, 74, 79];
  const col = new THREE.Color();
  function build(sim) {
    const n = sim.n, N = sim.N, c = S / n, T = sim.tree, G = sim.age, Bt = sim.burnt;
    ensureTex(n);
    const d = tex.image.data, tm = trees.instanceMatrix.array, fm = fire.instanceMatrix.array, tc = trees.instanceColor.array, fc = fire.instanceColor.array;
    let nt = 0, nf = 0;
    for (let i = 0; i < N; i++) {
      const x = i % n, y = (i - x) / n, px = (x + 0.5) * c - S / 2, pz = (y + 0.5) * c - S / 2;
      // 바닥 색 (격자의 y = 판 윗면의 z. BoxGeometry 윗면은 z=-S/2가 텍스처 위쪽(v=1)이라 행을 뒤집어 넣는다)
      let r = SOIL[0], g = SOIL[1], b = SOIL[2];
      const k = Bt[i];
      if (!T[i] && k) { const a = k <= 2 ? 0 : (k - 3) / 12; r = ASH[0] + (SOIL[0] - ASH[0]) * a * a; g = ASH[1] + (SOIL[1] - ASH[1]) * a * a; b = ASH[2] + (SOIL[2] - ASH[2]) * a * a; }
      const j = ((n - 1 - y) * n + x) * 4; d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
      if (T[i]) {
        const a = Math.min(1, G[i] / 160), h = c * (1.4 + 5.6 * a), w = c * (0.7 + 0.32 * a), o = nt * 16;
        tm.fill(0, o, o + 16); tm[o] = w; tm[o + 5] = h; tm[o + 10] = w; tm[o + 12] = px; tm[o + 14] = pz; tm[o + 15] = 1;
        col.setRGB((150 - 130 * a) / 255, (214 - 106 * a) / 255, (120 - 70 * a) / 255, THREE.SRGBColorSpace); // 2D와 같은 색: 어린 나무 연두 → 오래된 나무 짙은 초록
        tc[nt * 3] = col.r; tc[nt * 3 + 1] = col.g; tc[nt * 3 + 2] = col.b; nt++;
      } else if (k === 1 || k === 2) {
        const h = c * (k === 1 ? 9 : 5), w = c * 0.95, o = nf * 16;
        fm.fill(0, o, o + 16); fm[o] = w; fm[o + 5] = h; fm[o + 10] = w; fm[o + 12] = px; fm[o + 14] = pz; fm[o + 15] = 1;
        col.setRGB(1, k === 1 ? 0.62 : 0.42, k === 1 ? 0.16 : 0.1, THREE.SRGBColorSpace);
        fc[nf * 3] = col.r; fc[nf * 3 + 1] = col.g; fc[nf * 3 + 2] = col.b; nf++;
      }
    }
    trees.count = nt; fire.count = nf;
    trees.instanceMatrix.needsUpdate = true; trees.instanceColor.needsUpdate = true;
    fire.instanceMatrix.needsUpdate = true; fire.instanceColor.needsUpdate = true;
    tex.needsUpdate = true;
  }

  let lastSim = null, lastStep = -1;
  function sync() {
    const W = window.WildfireState; if (!W || !W.A || !W.B) return;
    const sim = $('wf3-forest').value === 'free' ? W.A : W.B;
    if (sim === lastSim && sim.step === lastStep) return;
    lastSim = sim; lastStep = sim.step; build(sim);
    const info = $('wf3-info'); if (info) info.textContent = `나무 ${Math.round(sim.density() * 100)}% · ${sim.step}단계`;
  }
  $('wf3-forest').addEventListener('change', () => { lastSim = null; sync(); v.render(); });
  v.onFrame(() => sync());
  sync();
  // 썸네일 촬영: 회전 없이 정해진 각도에서 바로 그린다 (화면 밖이라도)
  if (window.WildfireState && window.WildfireState.thumb) {
    v.controls.autoRotate = false; v.camera.position.set(0, 18 * FAR, 12.5 * FAR); v.controls.update();
    const shot = () => { sync(); v.controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
}
