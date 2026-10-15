// ① 쌍둥이 판의 세 별 (3D): app.js가 window.TbState로 내보내는 같은 sim을 그대로 그린다(3D에서 따로 계산하지 않음).
// - 판 A = 진하고 큰 별 + 굵은 빛 꼬리, 판 B(별 1만 처음에 아주 조금 옮긴 판) = 흐린 별 + 가는 꼬리. 처음엔 겹쳐 보이다가 갈라진다.
// - 한 걸음 전과 지금 위치 사이를 이어 그린다(보간, 결과에는 영향 없음). 뒤의 작은 별들은 배경 장식이다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.TbState;
const SMALL = (window.innerWidth || 1000) < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (canvas && st0) {
  canvas.setAttribute('aria-label', '3D view of three stars and their twin');
  if ((canvas.parentElement.clientWidth || 999) < 640) canvas.style.aspectRatio = '1 / 1.05';
  const v = create3D(canvas, { camera: [0, 5.2, 6.4], target: [0, 0, 0], background: '#070b1f', dark: true, autoRotateSpeed: 0.35, minDistance: 1.5, maxDistance: 80, far: 1000, fov: 50 });
  if (v) init(v);
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

function init(v) {
  const { scene, camera, controls } = v;
  const COL = [new THREE.Color('#ffb547'), new THREE.Color('#5cc8ff'), new THREE.Color('#ff6fae')];
  const TRAIL = SMALL ? 350 : 700;   // 꼬리 길이 (걸음)
  // 배경 별 (장식)
  {
    const n = SMALL ? 500 : 1200, p = new Float32Array(n * 3), r = window.ThreeBody.mulberry32(5);
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = 300 + r() * 200; p[i * 3] = d * s * Math.cos(th); p[i * 3 + 1] = d * u; p[i * 3 + 2] = d * s * Math.sin(th); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb3ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false })));
  }
  // 바닥 격자 (깊이 감을 주는 옅은 원판 선)
  const grid = new THREE.PolarGridHelper(6, 12, 6, 64, 0x26315e, 0x1a2348); grid.position.y = -1.6; scene.add(grid);
  const tex = glowTexture();
  // 꼬리: 점들을 촘촘히 찍어 굵은 빛줄기처럼 (오래된 점일수록 흐리게)
  const trailMat = (size) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: size * Math.min(2, window.devicePixelRatio || 1) } },
    vertexShader: 'attribute vec3 color; attribute float alpha; varying vec3 vC; varying float vA; uniform float uSize; void main(){ vC = color; vA = alpha; gl_PointSize = uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC, vA * (1.0 - r * 3.0)); }',
  });
  function makeTrail(nb, size, amp) {
    const N = nb * TRAIL, g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), al = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
    const pts = new THREE.Points(g, trailMat(size)); pts.frustumCulled = false; scene.add(pts);
    return { pts, g, pos, col, al, nb, amp };
  }
  function makeStars(alpha, scale) {
    return [0, 1, 2].map((i) => {
      const grp = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: COL[i], transparent: alpha < 1, opacity: alpha }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: COL[i], transparent: true, opacity: 0.85 * alpha, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(5, 5, 1); grp.add(ball); grp.add(glow); grp.userData.s = scale; scene.add(grp); return grp;
    });
  }
  const starsA = makeStars(1, 1), starsB = makeStars(0.5, 0.8);
  const trA = makeTrail(3, 4.2, 0.95), trB = makeTrail(3, 2.4, 0.55);
  const rot = $('tb-rotate'), viewSel = $('tb-view');
  const autoOn = () => !rot || rot.value === 'on';
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = autoOn(); });
  const tgt = new THREE.Vector3(), cen = new THREE.Vector3();
  let simRef = null;

  function fill(tr, arr, nb, k, a, sys) {
    // arr: 걸음마다 위치 [k*nb*3 ...], 지금 걸음 k, 보간 비율 a
    let w = 0; const start = Math.max(0, k - TRAIL + 1);
    for (let b = 0; b < 3; b++) {
      const c = COL[b];
      for (let j = 0; j < TRAIL; j++) {
        const t = start + j, idx = w * 3;
        if (b >= nb || t > k) { tr.al[w] = 0; tr.pos[idx] = tr.pos[idx + 1] = tr.pos[idx + 2] = 0; w++; continue; }
        const o = (t * nb + b) * 3;
        let x = arr[o], y = arr[o + 1], z = arr[o + 2];
        if (t === k && k > 0) { const p = ((k - 1) * nb + b) * 3; x = arr[p] + (x - arr[p]) * a; y = arr[p + 1] + (y - arr[p + 1]) * a; z = arr[p + 2] + (z - arr[p + 2]) * a; }
        tr.pos[idx] = x; tr.pos[idx + 1] = z; tr.pos[idx + 2] = -y;   // 모델의 z(위아래)를 화면 y로
        const f = (t - start + 1) / (k - start + 1);
        tr.al[w] = tr.amp * (0.08 + 0.92 * f * f);
        tr.col[idx] = c.r; tr.col[idx + 1] = c.g; tr.col[idx + 2] = c.b; w++;
      }
    }
    tr.g.attributes.position.needsUpdate = true; tr.g.attributes.alpha.needsUpdate = true; tr.g.attributes.color.needsUpdate = true;
  }
  function place(stars, tr, nb, k, a, m, R) {
    for (let b = 0; b < 3; b++) {
      const s = stars[b]; if (b >= nb) { s.visible = false; continue; }
      s.visible = true; const w = (k * nb + b) * 3; let x = tr[w], y = tr[w + 1], z = tr[w + 2];
      if (k > 0) { const p = ((k - 1) * nb + b) * 3; x = tr[p] + (x - tr[p]) * a; y = tr[p + 1] + (y - tr[p + 1]) * a; z = tr[p + 2] + (z - tr[p + 2]) * a; }
      s.position.set(x, z, -y);
      const r = 0.07 * R * Math.cbrt(m[b]) * s.userData.s; s.children[0].scale.setScalar(r); s.children[1].scale.setScalar(r * 9);
    }
  }
  function update(dt) {
    const st = window.TbState; if (!st || !st.sim) return;
    const sim = st.sim, k = sim.t, two = viewSel && viewSel.value === 'two';
    if (sim !== simRef) {   // 새 판: 시작 거리에 맞춰 카메라 거리 조정
      simRef = sim; const d = camera.position.clone().sub(controls.target), want = 6.4 * sim.R;
      d.multiplyScalar(want / d.length()); controls.target.set(0, 0, 0); camera.position.copy(d);
      grid.scale.setScalar(sim.R); grid.position.y = -1.6 * sim.R;
    }
    const a = st.isPaused() || st.thumb ? 1 : Math.min(1, (performance.now() - st.lastStepAt) / 1000 / st.interval);
    const T = sim.trail, nb = two ? 2 : 3;
    const tA = two ? T.A2 : T.A, tB = two ? T.B2 : T.B, m = two ? sim.A2.m : sim.A.m;
    fill(trA, tA, nb, k, a); fill(trB, tB, nb, k, a);
    place(starsA, tA, nb, k, a, m, sim.R); place(starsB, tB, nb, k, a, m, sim.R);
    // 카메라: 튕겨 나간 별을 뺀 나머지(판 A)의 무게중심을 천천히 따라간다
    let cx = 0, cy = 0, cz = 0, M = 0; const esc = !two && sim.esc ? sim.esc.body : -1;
    for (let b = 0; b < nb; b++) { if (b === esc) continue; const w = (k * nb + b) * 3; cx += m[b] * tA[w]; cy += m[b] * tA[w + 1]; cz += m[b] * tA[w + 2]; M += m[b]; }
    tgt.set(cx / M, cz / M, -cy / M);
    const kk = st.thumb ? 1 : Math.min(1, dt * 0.8);
    cen.copy(controls.target).lerp(tgt, kk); camera.position.add(cen.clone().sub(controls.target)); controls.target.copy(cen);
    grid.position.x = 0; grid.position.z = 0;
  }
  if (viewSel) viewSel.addEventListener('change', () => update(1));
  v.onFrame((dt) => update(dt));
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(controls.target.x + 1.5, controls.target.y + 4.2, controls.target.z + 5.6);
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  } else controls.autoRotate = autoOn() && controls.autoRotate;
  window.Tb3D = { v, update };
}
