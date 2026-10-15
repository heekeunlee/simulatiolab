// ① 제재가 걸린 섬나라 바다 (3D): app.js가 window.SanctionsState로 내보내는 같은 sim을 그대로 그린다(3D에서 새로 계산하지 않음).
// - 섬 하나 = 가상의 나라 하나(sim.world의 위치·크기). 섬 위 도시의 빌딩 수·높이 = 나라 크기(경제 규모). 가운데 큰 섬 = 제재받는 나라
// - 화물선: 나라 → 가운데 섬으로 가는 배의 수 = 지금 달의 직접 무역(sim.flow), 주황 배 + 바다 위 점선 = 제3국을 거쳐 새는 무역(sim.relay)
//   회색 작은 배 = 다른 나라끼리의 무역(sim.world.links, 배경). 배의 움직임·배치는 보기용 표시일 뿐 새 계산이 아니다
// - 제재 참여국(sim.part): 항구에 푸른 깃발이 오르고 세관 차단기가 내려간다
// - 가운데 섬: 부두에 묶인 배 = 지금 들어오는 무역 전체(직접 + 경유), 불 꺼진 빌딩의 몫 = 경제 피해(sim.D), 광장의 군중 수·깃발 높이 = 결속 지수(sim.C)
// - 값이 바뀔 때는 화면에서만 부드럽게 잇는다(결과에는 영향 없음). 낮/밤·회전은 보기 설정
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const $ = (id) => document.getElementById(id);
const st0 = window.SanctionsState;
const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const S = 1.6;            // 시뮬레이션 거리 1 = 화면 1.6
const PH = 3.0;           // 결속 지수 100 = 깃대 높이 3
const SHIP_SPEED = 2.2;   // 화면 단위/초

const PAL = {
  day: { skyTop: '#5d9be0', skyHor: '#dbe9f5', fog: '#d6e5f2', sea: '#2f7fb4', floor: '#1d5f8a', hemiSky: '#e4f1ff', hemiGnd: '#6d7f5c', hemi: 1.0, sun: 2.4, sunCol: '#fff3df', em: 0.22, nav: false, ink: '#1f2937' },
  night: { skyTop: '#060d20', skyHor: '#22345a', fog: '#1b2a48', sea: '#1d4a78', floor: '#0a2238', hemiSky: '#8aa2d6', hemiGnd: '#1a2030', hemi: 0.5, sun: 0.7, sunCol: '#a9bfff', em: 1.7, nav: true, ink: '#e5e7eb' },
};

// ---------- 작은 도구 ----------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// 위치·법선·색이 있는 여러 모양을 한 모양으로 합친다
function merge(parts) {
  let n = 0; const gs = parts.map(([g, col]) => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return [q, new THREE.Color(col)]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cl = new Float32Array(n * 3); let o = 0;
  gs.forEach(([g, c]) => { const k = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (let i = 0; i < k; i++) cl.set([c.r, c.g, c.b], (o + i) * 3); o += k; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  return g;
}
const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
// 곡선(2차 베지어)을 표로: [x, z, 방향각]
function laneLUT(ax, az, cx, cz, bx, bz, N = 64) {
  const X = new Float32Array(N), Z = new Float32Array(N), A = new Float32Array(N); let len = 0;
  for (let i = 0; i < N; i++) { const s = i / (N - 1), u = 1 - s; X[i] = u * u * ax + 2 * u * s * cx + s * s * bx; Z[i] = u * u * az + 2 * u * s * cz + s * s * bz; if (i) len += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]); }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); A[i] = Math.atan2(Z[b] - Z[a], X[b] - X[a]); }
  return { X, Z, A, N, len };
}
function lutAt(L, u, out) { const f = clamp(u, 0, 0.99999) * (L.N - 1), i = f | 0, r = f - i; out[0] = L.X[i] + (L.X[i + 1] - L.X[i]) * r; out[1] = L.Z[i] + (L.Z[i + 1] - L.Z[i]) * r; out[2] = L.A[i]; return out; }

function init(v, narrow) {
  const { scene, camera, controls, renderer } = v;
  const pc = !narrow;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (pc) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  const lights = scene.children.filter((o) => o.isLight);
  const hemi = lights.find((o) => o.isHemisphereLight), sun = lights.find((o) => o.isDirectionalLight);
  sun.position.set(-16, 24, 12);
  if (pc) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 2; sc.far = 80; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  }
  scene.fog = new THREE.Fog(PAL.day.fog, 26, 78);

  // ---------- 하늘 (방향에 따른 그라데이션 돔) ----------
  const skyU = { top: { value: new THREE.Color(PAL.day.skyTop) }, hor: { value: new THREE.Color(PAL.day.skyHor) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vD; void main(){ float t = pow(clamp(vD.y * 1.6, 0.0, 1.0), 0.6); gl_FragColor = vec4(mix(hor, top, t), 1.0); }',
  }));
  sky.renderOrder = -100; scene.add(sky);

  // ---------- 바다: 깊은 바닥 + 반투명 물결 수면 (해 반사) ----------
  const floorMat = new THREE.MeshBasicMaterial({ color: PAL.day.floor });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), floorMat); floor.position.y = -0.42; scene.add(floor);
  const seaU = { uTime: { value: 0 } };
  const seaMat = new THREE.MeshStandardMaterial({ color: PAL.day.sea, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.74, depthWrite: false });
  seaMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = seaU.uTime;
    sh.vertexShader = 'uniform float uTime; varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed.y += 0.02 * (sin(position.x * 0.9 + uTime * 0.9) + sin(position.z * 1.1 - uTime * 0.7));\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uTime; varying vec3 vWP;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      { vec2 p = vWP.xz; float t = uTime;
        float gx = 0.10 * cos(p.x * 2.3 + t * 1.3) + 0.07 * cos((p.x + p.y) * 4.1 + t * 2.1) + 0.04 * cos((p.x * 0.7 - p.y) * 7.3 - t * 2.7);
        float gz = 0.10 * cos(p.y * 2.7 - t * 1.1) + 0.07 * cos((p.x + p.y) * 4.1 + t * 2.1) - 0.04 * cos((p.x * 0.7 - p.y) * 7.3 - t * 2.7) * 1.0;
        vec3 nW = normalize(vec3(-gx * 0.6, 1.0, -gz * 0.6));
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); }`);
  };
  const seaSeg = pc ? 160 : 80;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, seaSeg, seaSeg).rotateX(-Math.PI / 2), seaMat); sea.renderOrder = 5; scene.add(sea);

  // ---------- 창문 텍스처 (낮: 유리창 · 밤: 켜진 불빛) ----------
  function winTex(lit) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); const r = rng(lit ? 7 : 3);
    x.fillStyle = lit ? '#000' : '#eef1f4'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (lit) { const b = r(); x.fillStyle = b < 0.25 ? '#000' : b < 0.6 ? '#ffd28a' : '#ffe9bf'; }
      else x.fillStyle = (i + j) % 3 ? '#6f8297' : '#7d93a8';
      x.fillRect(4 + i * 15, 5 + j * 15, 9, 9);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const bldMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: winTex(false), emissive: 0xffffff, emissiveMap: winTex(true), emissiveIntensity: PAL.day.em, roughness: 0.55, metalness: 0.15 });
  bldMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec2 aRep; attribute float aLit; varying float vLit; varying float vUp;\n' + sh.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n vMapUv *= aRep; vEmissiveMapUv *= aRep; vLit = aLit; vUp = abs(normal.y);');
    sh.fragmentShader = 'varying float vLit; varying float vUp;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n if (vUp > 0.5) diffuseColor.rgb = vec3(0.74, 0.76, 0.79);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vLit * (1.0 - step(0.5, vUp));');
  };

  // ---------- 공용 모양 ----------
  const shipHullG = (() => {   // 선체: 위에서 보면 뾰족한 뱃머리, 아래로 깊이 0.09
    const s = new THREE.Shape(); s.moveTo(-0.19, -0.05); s.lineTo(0.12, -0.05); s.quadraticCurveTo(0.2, -0.03, 0.22, 0); s.quadraticCurveTo(0.2, 0.03, 0.12, 0.05); s.lineTo(-0.19, 0.05); s.lineTo(-0.19, -0.05);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, -0.03, 0); return g;
  })();
  const shipTopG = merge([   // 갑판 위: 컨테이너 줄 + 흰 선교 + 굴뚝
    [box(0.07, 0.035, 0.08, 0.1, 0.068, 0), '#d9534f'], [box(0.07, 0.035, 0.08, 0.02, 0.068, 0), '#3b82c4'], [box(0.07, 0.035, 0.08, -0.06, 0.068, 0), '#e0a526'],
    [box(0.07, 0.03, 0.08, 0.06, 0.1, 0), '#4c9a6a'], [box(0.07, 0.03, 0.08, -0.02, 0.1, 0), '#c8ccd2'],
    [box(0.05, 0.1, 0.085, -0.15, 0.1, 0), '#f6f7f9'], [box(0.02, 0.05, 0.02, -0.17, 0.17, 0), '#3a3f47'],
  ]);
  const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(128, 13); x.lineTo(128, 19); x.lineTo(0, 32); x.closePath(); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const wakeG = new THREE.PlaneGeometry(0.7, 0.2).rotateX(-Math.PI / 2).translate(-0.5, 0.012, 0);
  const personG = merge([[new THREE.CylinderGeometry(0.022, 0.03, 0.09, 6).translate(0, 0.045, 0), '#ffffff'], [new THREE.SphereGeometry(0.021, 6, 5).translate(0, 0.112, 0), '#ffffff']]);
  const treeG = merge([[new THREE.CylinderGeometry(0.012, 0.016, 0.06, 5).translate(0, 0.03, 0), '#7a5a3a'], [new THREE.ConeGeometry(0.06, 0.16, 6).translate(0, 0.13, 0), '#ffffff']]);
  const craneG = merge([
    [box(0.025, 0.42, 0.025, -0.06, 0.21, -0.06), '#e2a72e'], [box(0.025, 0.42, 0.025, 0.06, 0.21, -0.06), '#e2a72e'], [box(0.025, 0.42, 0.025, -0.06, 0.21, 0.06), '#e2a72e'], [box(0.025, 0.42, 0.025, 0.06, 0.21, 0.06), '#e2a72e'],
    [box(0.16, 0.04, 0.16, 0, 0.43, 0), '#d9961f'], [box(0.62, 0.035, 0.05, 0.2, 0.47, 0), '#e2a72e'], [box(0.05, 0.05, 0.05, -0.06, 0.5, 0), '#c0392b'],
  ]);
  const vcol = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.6, metalness: 0.1 }, o));

  const world = new THREE.Group(); scene.add(world);
  let G = null;   // 판(무역망)마다 다시 만드는 것들

  // ---------- 판마다: 섬·도시·항구·항로 ----------
  function build(sim) {
    if (G) { world.remove(G.group); G.group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
    const W = sim.world, n = W.n, P = sim.params, r = rng(P.seed * 7919 + 13);
    const group = new THREE.Group(); world.add(group);
    const cx = [], cz = [], R = [], ph = [];
    for (let i = 0; i < n; i++) { cx.push(W.x[i] * S); cz.push(W.y[i] * S); }
    for (let i = 0; i < n; i++) {
      let near = Infinity; for (let j = 0; j < n; j++) if (j !== i) near = Math.min(near, Math.hypot(cx[i] - cx[j], cz[i] - cz[j]) - (j === 0 ? 2.9 : 0));
      R.push(i === 0 ? 2.75 : clamp(Math.min(0.5 + 0.42 * Math.sqrt(W.size[i]), 0.5 * near), 0.22, 1.5));
      ph.push([r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28]);
    }
    const Hm = (i) => (i === 0 ? 0.42 : 0.12 + 0.2 * Math.sqrt(W.size[i]) * (0.7 + 0.6 * ((i * 37) % 10) / 10));
    const shore = (i, a) => R[i] * (1 + (i === 0 ? 0.08 : 0.13) * Math.sin(2 * a + ph[i][0]) + 0.08 * Math.sin(3 * a + ph[i][1]) + 0.05 * Math.sin(5 * a + ph[i][2]));
    const height = (i, rr, a) => {
      const t = rr / shore(i, a);
      if (t >= 1) return -0.4 * sstep(1, 1.35, t);
      let h = Hm(i) * Math.pow(1 - t * t, 0.6) * (0.85 + 0.15 * Math.sin(3 * a + ph[i][3] + rr * 2.2));
      if (i === 0) h = Math.max(h, Hm(0) * 0.82 * (1 - sstep(0.45, 0.7, t)));   // 가운데 섬: 넓고 평평한 도심
      return h + 0.015;
    };
    const hAt = (i, x, z) => height(i, Math.hypot(x - cx[i], z - cz[i]), Math.atan2(z - cz[i], x - cx[i]));
    const shoreP = (i, a, out = 0) => { const s = shore(i, a) + out; return [cx[i] + Math.cos(a) * s, cz[i] + Math.sin(a) * s]; };

    // 섬 지형 (모든 섬을 한 모양으로)
    const AN = pc ? 56 : 40, RN = 14, pos = [], col = [], idx = [];
    const cSand = new THREE.Color('#eadbb0'), cWet = new THREE.Color('#bfe3dc'), cDeep = new THREE.Color(PAL.day.floor), cG1 = new THREE.Color('#9cc46f'), cG2 = new THREE.Color('#5e8f4a'), cRock = new THREE.Color('#9a9585'), cFoam = new THREE.Color('#ffffff'), tc = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const base = pos.length / 3;
      pos.push(cx[i], height(i, 0, 0), cz[i]); tc.copy(i === 0 ? cG1 : cG2); col.push(tc.r, tc.g, tc.b);
      for (let k = 1; k <= RN; k++) for (let j = 0; j < AN; j++) {
        const a = j / AN * Math.PI * 2, t = 1.35 * Math.pow(k / RN, 0.8), rr = t * shore(i, a), h = height(i, rr, a);
        pos.push(cx[i] + Math.cos(a) * rr, h, cz[i] + Math.sin(a) * rr);
        const hn = h / Hm(i), nz = 0.06 * Math.sin(a * 7 + k * 3 + i);
        if (h < -0.015) tc.copy(cWet).lerp(cDeep, sstep(-0.04, -0.36, h));
        else if (h < 0.03) tc.copy(cFoam).lerp(cSand, sstep(0.0, 0.03, h));
        else if (hn < 0.22 + nz) tc.copy(cSand).lerp(cG1, sstep(0.12, 0.22 + nz, hn));
        else tc.copy(cG1).lerp(cG2, clamp(hn * 1.1 + nz, 0, 1)).lerp(cRock, i > 0 && Hm(i) > 0.42 ? sstep(0.8, 1, hn) * 0.6 : 0);
        col.push(tc.r, tc.g, tc.b);
      }
      for (let j = 0; j < AN; j++) idx.push(base, base + 1 + (j + 1) % AN, base + 1 + j);
      for (let k = 1; k < RN; k++) for (let j = 0; j < AN; j++) {
        const a0 = base + 1 + (k - 1) * AN + j, a1 = base + 1 + (k - 1) * AN + (j + 1) % AN, b0 = a0 + AN, b1 = a1 + AN;
        idx.push(a0, a1, b1, a0, b1, b0);
      }
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, vcol({ roughness: 0.92, metalness: 0 })); terrain.receiveShadow = pc; group.add(terrain);

    // 도시: 빌딩 수·높이 = 나라 크기. 가운데 섬은 광장을 둘러싼 도심
    const B = [], plazaR = 1.15;
    for (let i = 0; i < n; i++) {
      const cnt = i === 0 ? (pc ? 80 : 60) : Math.round(clamp(2 + 7 * W.size[i], 2, 30) * (pc ? 1 : 0.7)), hmax = i === 0 ? 1.9 : 0.18 + 0.42 * Math.sqrt(W.size[i]);
      const spots = [];
      for (let tries = 0; spots.length < cnt && tries < cnt * 30; tries++) {
        const a = r() * Math.PI * 2, t = i === 0 ? 0.42 + 0.33 * Math.sqrt(r()) : 0.62 * Math.sqrt(r());
        const rr = (i === 0 ? Math.max(plazaR + 0.25, t * shore(0, a)) : t * shore(i, a));
        const x = cx[i] + Math.cos(a) * rr, z = cz[i] + Math.sin(a) * rr, w = i === 0 ? 0.16 + r() * 0.16 : 0.1 + r() * 0.12;
        if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < (s[2] + w) * 0.62)) continue;
        const centerK = i === 0 ? 0.18 + 0.82 * sstep(plazaR + 0.2, 2.15, rr) * (1 - 0.4 * sstep(2.2, 2.7, rr)) : 1 - t * 0.9;   // 가운데 섬: 광장 둘레는 낮게, 그 뒤로 높은 빌딩
        spots.push([x, z, w, w * (0.7 + r() * 0.5), hmax * (0.25 + 0.75 * centerK) * (0.45 + 0.55 * r() * r() + 0.2 * r())]);
      }
      spots.forEach((s) => B.push([i, ...s]));
    }
    const nb = B.length, bgeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const aRep = new Float32Array(nb * 2), aLit = new Float32Array(nb).fill(1);
    bgeo.setAttribute('aRep', new THREE.InstancedBufferAttribute(aRep, 2)); bgeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(aLit, 1));
    const blds = new THREE.InstancedMesh(bgeo, bldMat, nb); blds.castShadow = pc; blds.receiveShadow = pc;
    const dm = new THREE.Object3D(), tcol = new THREE.Color(), FAC = ['#f4f1ea', '#e3e8ee', '#d8dee6', '#f1e6d6', '#cfd8e3', '#e9ecef', '#a9c1d9', '#c9b8a3'];
    const centerB = [];
    B.forEach(([i, x, z, w, d, h], k) => {
      const y = hAt(i, x, z) - 0.04; dm.position.set(x, y, z); dm.rotation.set(0, (k * 0.37) % 0.6 - 0.3 + Math.atan2(z - cz[i], x - cx[i]), 0); dm.scale.set(w, h + 0.04, d); dm.updateMatrix(); blds.setMatrixAt(k, dm.matrix);
      blds.setColorAt(k, tcol.set(FAC[k % FAC.length]));
      aRep[k * 2] = Math.max(1, Math.round(Math.max(w, d) / 0.11)) / 4; aRep[k * 2 + 1] = Math.max(1, Math.round(h / 0.1)) / 4;
      if (i === 0) centerB.push([k, r()]);
    });
    group.add(blds);
    // 불 꺼지는 순서(가운데 섬): 무작위 순위 → 피해 비율만큼 아래 순위부터 꺼진다
    centerB.sort((a, b) => a[1] - b[1]); centerB.forEach((c, j) => { c[1] = (j + 0.5) / centerB.length; });

    // 나무 (빌딩 없는 언덕)
    const T = [];
    for (let i = 1; i < n; i++) for (let k = 0; k < Math.round(5 + 9 * R[i]); k++) {
      const a = r() * 6.283, t = 0.35 + 0.5 * r(), rr = t * shore(i, a), x = cx[i] + Math.cos(a) * rr, z = cz[i] + Math.sin(a) * rr;
      if (B.some((b) => b[0] === i && Math.hypot(b[1] - x, b[2] - z) < 0.12)) continue;
      T.push([x, hAt(i, x, z) - 0.01, z, 0.7 + r() * 0.6]);
    }
    for (let k = 0; k < 40; k++) { const a = r() * 6.283, rr = (0.82 + 0.1 * r()) * shore(0, a), x = cx[0] + Math.cos(a) * rr, z = cz[0] + Math.sin(a) * rr; T.push([x, hAt(0, x, z) - 0.01, z, 0.8 + r() * 0.5]); }
    const trees = new THREE.InstancedMesh(treeG, vcol({ roughness: 0.9 }), T.length); trees.castShadow = pc;
    T.forEach(([x, y, z, s], k) => { dm.position.set(x, y, z); dm.rotation.set(0, k, 0); dm.scale.setScalar(s); dm.updateMatrix(); trees.setMatrixAt(k, dm.matrix); trees.setColorAt(k, tcol.setHSL(0.27 + 0.05 * ((k * 13) % 7) / 7, 0.45, 0.32 + 0.08 * ((k * 7) % 5) / 5)); });
    group.add(trees);

    // 광장 + 깃대 + 군중 (가운데 섬)
    const plazaY = hAt(0, cx[0], cz[0]);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(plazaR, plazaR + 0.05, 0.05, 48), new THREE.MeshStandardMaterial({ color: '#d9d2c3', roughness: 0.85 }));
    plaza.position.set(cx[0], plazaY, cz[0]); plaza.receiveShadow = pc; group.add(plaza);
    const pave = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b8ae9b', roughness: 0.9 }));
    pave.position.set(cx[0], plazaY + 0.027, cz[0]); group.add(pave);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, PH + 0.15, 10), new THREE.MeshStandardMaterial({ color: '#e6e8eb', roughness: 0.3, metalness: 0.7 }));
    pole.position.set(cx[0], plazaY + (PH + 0.15) / 2, cz[0]); pole.castShadow = pc; group.add(pole);
    const mark = (lv, color) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.25 })); m.position.set(cx[0], plazaY + lv / 100 * PH, cz[0]); group.add(m); return m; };
    mark(50, '#ffffff'); mark(30, '#dc2626');
    const MAXP = pc ? 340 : 190, people = [];
    for (let k = 0; k < MAXP * 3 && people.length < MAXP; k++) {
      const a = r() * 6.283, rr = 0.34 + (plazaR - 0.4) * Math.sqrt(r());
      const x = cx[0] + Math.cos(a) * rr, z = cz[0] + Math.sin(a) * rr;
      if (people.some((p) => Math.hypot(p[0] - x, p[1] - z) < 0.055)) continue;
      people.push([x, z, rr, a]);
    }
    people.sort((p, q) => p[2] - q[2]);
    const crowd = new THREE.InstancedMesh(personG, vcol({ roughness: 0.8 }), people.length); crowd.castShadow = pc;
    const CLOTH = ['#2f6fed', '#e2553f', '#f2b134', '#3d9a5b', '#f5f5f5', '#6b5ca5', '#333a44', '#ea580c'];
    people.forEach(([x, z, , a], k) => { dm.position.set(x, plazaY + 0.025, z); dm.rotation.set(0, -a + Math.PI / 2, 0); dm.scale.setScalar(1); dm.updateMatrix(); crowd.setMatrixAt(k, dm.matrix); crowd.setColorAt(k, tcol.set(CLOTH[k % CLOTH.length])); });
    crowd.count = 0; group.add(crowd);
    // 깃발 (천이 바람에 나부낌: 꼭짓점을 매 프레임 움직인다)
    const flagG = new THREE.PlaneGeometry(0.62, 0.38, 14, 4).translate(0.31, -0.19, 0), flagBase = flagG.attributes.position.array.slice();
    const flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.7, side: THREE.DoubleSide, emissive: '#ea580c', emissiveIntensity: 0.08 }));
    flag.castShadow = pc; group.add(flag);

    // 항구: 나라마다 가운데 쪽 해안에 부두 + 깃대 + (참여국이면) 차단기
    const port = [], piers = [], parts = [];
    for (let i = 1; i < n; i++) {
      const a = Math.atan2(cz[0] - cz[i], cx[0] - cx[i]), [sx, sz] = shoreP(i, a, -0.05), [ox, oz] = shoreP(i, a, 0.42);
      port[i] = { a, sx, sz, ox, oz };
      piers.push([sx + Math.cos(a) * 0.2, sz + Math.sin(a) * 0.2, a, 0.42, 0.07]);
    }
    // 가운데 섬 부두: 배를 묶는 자리 10곳(바다 쪽으로 뻗은 긴 부두) + 크레인
    const BERTH = 10, berths = [];
    for (let k = 0; k < BERTH; k++) {
      const a = (k + 0.5) / BERTH * Math.PI * 2 + 0.2, [sx, sz] = shoreP(0, a, -0.1);
      piers.push([sx + Math.cos(a) * 0.32, sz + Math.sin(a) * 0.32, a, 0.66, 0.11]);
      const px = -Math.sin(a), pz = Math.cos(a), bx = sx + Math.cos(a) * 0.42 + px * 0.13, bz = sz + Math.sin(a) * 0.42 + pz * 0.13;
      berths.push({ a, x: bx, z: bz, cx: sx + Math.cos(a) * 0.12 - px * 0.06, cz: sz + Math.sin(a) * 0.12 - pz * 0.06, cy: hAt(0, sx, sz) });
    }
    const pierMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), new THREE.MeshStandardMaterial({ color: '#b9b2a3', roughness: 0.85 }), piers.length); pierMesh.receiveShadow = pc; pierMesh.castShadow = pc;
    piers.forEach(([x, z, a, len, wd], k) => { dm.position.set(x, 0.02, z); dm.rotation.set(0, -a, 0); dm.scale.set(len, 1, wd); dm.updateMatrix(); pierMesh.setMatrixAt(k, dm.matrix); });
    group.add(pierMesh);
    const cranes = new THREE.InstancedMesh(craneG, vcol({ roughness: 0.5, metalness: 0.3 }), BERTH); cranes.castShadow = pc; group.add(cranes);

    // 참여국 깃대·깃발·차단기 (늘 만들어 두고 크기로 보이기/숨기기)
    const poleG = new THREE.CylinderGeometry(0.012, 0.016, 0.85, 6).translate(0, 0.425, 0);
    const pPole = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 0.6, roughness: 0.35 }), n);
    const pFlag = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.38, 0.24, 1, 1).translate(0.19, -0.12, 0), new THREE.MeshStandardMaterial({ color: '#2f6fed', roughness: 0.6, side: THREE.DoubleSide, emissive: '#2f6fed', emissiveIntensity: 0.25 }), n);
    const gateG = merge([[box(0.03, 0.09, 0.03, 0, 0.045, 0), '#4b5563'], [box(0.04, 0.05, 0.04, 0, 0.11, 0), '#4b5563']]);
    const pGate = new THREE.InstancedMesh(gateG, vcol(), n);
    const boomTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d'); for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#ffffff' : '#dc2626'; x.fillRect(k * 8, 0, 8, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const pBoom = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.018, 0.018).translate(0.1, 0, 0), new THREE.MeshStandardMaterial({ map: boomTex, roughness: 0.5, emissive: '#dc2626', emissiveIntensity: 0.15 }), n);
    const pRing = new THREE.InstancedMesh(new THREE.TorusGeometry(0.34, 0.025, 6, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2f6fed', emissive: '#2f6fed', emissiveIntensity: 0.6, roughness: 0.4 }), n);
    [pPole, pFlag, pGate, pBoom, pRing].forEach((m) => { m.castShadow = pc; group.add(m); });

    // 항로: 나라 → 가운데 섬 (다른 섬을 비켜 휘게), 새는 길은 반대쪽으로 크게 휜다
    const avoid = (ax, az, bx, bz, side, skip) => {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
      let off = side * (0.08 * L);
      for (let it = 0; it < 6; it++) {
        const ccx = mx + nx * off, ccz = mz + nz * off; let push = 0;
        for (let j = 1; j < n; j++) {
          if (skip.includes(j)) continue;
          for (let s = 0.15; s < 0.9; s += 0.05) {
            const u = 1 - s, x = u * u * ax + 2 * u * s * ccx + s * s * bx, z = u * u * az + 2 * u * s * ccz + s * s * bz, dd = Math.hypot(x - cx[j], z - cz[j]);
            if (dd < R[j] * 1.25 + 0.25) { const sd = ((x - cx[j]) * nx + (z - cz[j]) * nz) >= 0 ? 1 : -1; push += sd * (R[j] * 1.25 + 0.25 - dd) * 2.2; break; }
          }
        }
        if (!push) break; off += push;
      }
      return laneLUT(ax, az, mx + nx * off, mz + nz * off, bx, bz);
    };
    const lanes = [], relayL = [];
    for (let i = 1; i < n; i++) {
      const p = port[i], [ex, ez] = shoreP(0, p.a + Math.PI, 0.38), a2 = p.a + Math.PI + 0.12;
      lanes[i] = avoid(p.ox, p.oz, ex, ez, 1, [i]);
      const [fx, fz] = shoreP(0, a2, 0.42);
      relayL[i] = avoid(p.ox + Math.cos(p.a + 1.2) * 0.2, p.oz + Math.sin(p.a + 1.2) * 0.2, fx, fz, -2.4, [i]);
    }
    const bgL = W.links.map(([i, j, w]) => {
      const a = Math.atan2(cz[j] - cz[i], cx[j] - cx[i]), [ax, az] = shoreP(i, a, 0.3), [bx, bz] = shoreP(j, a + Math.PI, 0.3);
      return { L: avoid(ax, az, bx, bz, 0.5, [i, j]), w };
    });

    // 배 자리(슬롯): 직접 무역 · 새는 무역 · 배경 무역
    const NS = pc ? 120 : 75, slots = [];
    for (let i = 1; i < n; i++) {
      const k = Math.max(1, Math.ceil(Math.max(1, W.m[i] * NS))) + 1;
      for (let s = 0; s < k; s++) slots.push({ kind: 0, i, s, off: (s * 0.6180339 + i * 0.13) % 1, L: lanes[i] });
      const cap = P.leak * P.relayC * W.size[i] / W.sumOther, kr = Math.ceil(cap * NS) + 1;
      if (!sim.part[i]) for (let s = 0; s < kr; s++) slots.push({ kind: 1, i, s, off: (s * 0.6180339 + i * 0.29) % 1, L: relayL[i] });
    }
    bgL.forEach((b, k) => { const c = 1 + Math.round(b.w * 2); for (let s = 0; s < c; s++) slots.push({ kind: 2, i: k, s, off: (s / c + k * 0.17) % 1, L: b.L, rev: s % 2 === 1, w: b.w }); });
    const NSH = slots.length + BERTH;
    const hull = new THREE.InstancedMesh(shipHullG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.2 }), NSH);
    const top = new THREE.InstancedMesh(shipTopG, vcol({ roughness: 0.6 }), NSH);
    const wakes = new THREE.InstancedMesh(wakeG, new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: 0.9 }), NSH); wakes.renderOrder = 6;
    const nav = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff4c2' }), NSH); nav.visible = false;
    const HC = [new THREE.Color('#2b3a55'), new THREE.Color('#f97316'), new THREE.Color('#8a94a6')];
    for (let k = 0; k < NSH; k++) hull.setColorAt(k, k < slots.length ? (slots[k].kind === 0 ? (k % 3 ? HC[0] : tcol.set('#7a2e2e')) : HC[slots[k].kind]) : HC[0]);
    [hull, top].forEach((m) => { m.castShadow = pc; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; group.add(m); });
    [wakes, nav].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; group.add(m); });

    // 새는 길 점선 (바다 위 주황 점선)
    const DN = 26, dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.95, depthWrite: false }), (n - 1) * DN);
    dash.renderOrder = 7; dash.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dash.frustumCulled = false; group.add(dash);

    // 밤: 부두 가로등(빛나는 점)
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffd58a' }), piers.length);
    piers.forEach(([x, z, a, len], k) => { dm.position.set(x + Math.cos(a) * len * 0.5, 0.12, z + Math.sin(a) * len * 0.5); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.updateMatrix(); lamps.setMatrixAt(k, dm.matrix); });
    lamps.visible = false; group.add(lamps);

    G = { group, sim, W, n, cx, cz, R, port, lanes, relayL, slots, hull, top, wakes, nav, dash, DN, lamps, blds, aLit, centerB, crowd, flag, flagBase, plazaY, berths, cranes, pPole, pFlag, pGate, pBoom, pRing,
      NS, shownF: sim.flow.slice(), shownR: sim.relay.slice(), shownC: sim.C[sim.t], shownD: sim.t >= P.start ? sim.D[sim.t] : 0, shownPart: new Array(n).fill(sim.t >= P.start ? 1 : 0), shownP: 1,
      laneT: new Float32Array(n).fill(0), relayT: new Float32Array(n).fill(0), bgT: 0, topY: hAt(0, cx[0], cz[0]) + 1.6 };
    applyTime();
  }

  // ---------- 낮 / 밤 ----------
  const tSel = $('sn3-time'); let night = false;
  function applyTime() {
    night = !!tSel && tSel.value === 'night';
    const p = night ? PAL.night : PAL.day;
    skyU.top.value.set(p.skyTop); skyU.hor.value.set(p.skyHor); scene.fog.color.set(p.fog); scene.background = new THREE.Color(p.fog);
    seaMat.color.set(p.sea); floorMat.color.set(p.floor);
    hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGnd); hemi.intensity = p.hemi; sun.intensity = p.sun; sun.color.set(p.sunCol);
    bldMat.emissiveIntensity = p.em;
    if (G) { G.nav.visible = p.nav; G.lamps.visible = p.nav; }
    if (wrap) wrap.classList.toggle('sn3-night', night);
    if (st0.thumb) v.render();
  }
  if (tSel) tSel.addEventListener('change', applyTime);
  const rot = $('sn3-rotate');
  controls.autoRotate = !!rot && rot.value === 'on' && !st0.thumb;
  if (rot) rot.addEventListener('change', () => { controls.autoRotate = rot.value === 'on'; });
  controls.addEventListener('end', () => { setTimeout(() => { controls.autoRotate = !!rot && rot.value === 'on'; }, 4100); });

  // ---------- 이름표 (HTML) ----------
  const labels = [];
  const mkLabel = (cls, html) => { const d = document.createElement('div'); d.className = 'sn3-lab ' + cls; d.innerHTML = html; wrap.appendChild(d); const o = { d, txt: {} }; labels.push(o); return o; };
  const LT = mkLabel('node', '<b>제재받는 나라</b><span></span>');
  const LC = mkLabel('chip coh', '<i></i><span></span>');
  const LH = mkLabel('node hub', '<b>제3국 항구</b><span></span>');
  const LP = mkLabel('node part', '<b>제재 참여국</b><span>무역을 끊음</span>');
  const clock = document.createElement('div'); clock.className = 'sn3-time'; clock.innerHTML = '<b></b><span></span>'; wrap.appendChild(clock);
  const pv = new THREE.Vector3();
  function place(o, x, y, z, show, side) {
    if (!show) { if (o.d.style.display !== 'none') o.d.style.display = 'none'; return null; }
    pv.set(x, y, z).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight, sx = (pv.x + 1) / 2 * w, sy = (1 - pv.y) / 2 * h;
    const vis = pv.z < 1 && sx > 10 && sx < w - 10 && sy > 30 && sy < h + 10;
    if (!vis) { o.d.style.display = 'none'; return null; }
    o.d.style.display = '';
    if (o.dirty || !o.w) { o.w = o.d.offsetWidth; o.h = o.d.offsetHeight; o.dirty = false; }
    let L = side ? sx + 14 : sx - o.w / 2, T = side ? sy - o.h / 2 : sy - o.h;
    L = clamp(L, 4, w - o.w - 4); T = Math.max(4, T);
    o.d.style.transform = `translate(${L.toFixed(1)}px, ${T.toFixed(1)}px)`;
    return [L, T, L + o.w, T + o.h];
  }
  const hit = (a, b) => a && b && a[0] < b[2] + 4 && b[0] < a[2] + 4 && a[1] < b[3] + 3 && b[1] < a[3] + 3;
  function setT(o, sel, t) { if (o.txt[sel] !== t) { o.txt[sel] = t; o.d.querySelector(sel).textContent = t; o.dirty = true; } }

  // ---------- 매 프레임 ----------
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), tmp = [0, 0, 0], ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  let time = 0;
  function update(dt) {
    const st = window.SanctionsState; if (!st || !st.sim) return;
    const sim = st.sim, P = sim.params;
    if (!G || G.sim.world !== sim.world || G.sim.params.p !== P.p || G.sim.params.leak !== P.leak) build(sim);
    G.sim = sim;
    const { n, cx, cz, NS } = G, started = sim.t >= P.start, thumb = st.thumb;
    const k = thumb ? 1 : Math.min(1, dt * 3);
    for (let i = 0; i < n; i++) { G.shownF[i] += (sim.flow[i] - G.shownF[i]) * k; G.shownR[i] += (sim.relay[i] - G.shownR[i]) * k; G.shownPart[i] += ((started && sim.part[i] ? 1 : 0) - G.shownPart[i]) * Math.min(1, k * 1.5); }
    G.shownC += (sim.C[sim.t] - G.shownC) * k;
    G.shownD += ((started ? sim.D[sim.t] : 0) - G.shownD) * k;
    const moving = !thumb && !st.isPaused();
    time += dt; seaU.uTime.value = time;
    const go = moving ? dt : (thumb ? 0 : dt * 0.25);   // 멈춰 있을 때는 배가 아주 천천히(바다 분위기만)

    // 배
    let totIn = 0; for (let i = 1; i < n; i++) totIn += G.shownF[i] + G.shownR[i];
    for (let i = 1; i < n; i++) { G.laneT[i] += go * SHIP_SPEED / G.lanes[i].len; G.relayT[i] += go * SHIP_SPEED / G.relayL[i].len; }
    G.bgT += go * SHIP_SPEED * 0.8;
    const slots = G.slots;
    for (let k2 = 0; k2 < slots.length; k2++) {
      const sl = slots[k2], i = sl.i; let vis = 0, u = 0;
      if (sl.kind === 0) { const m = G.W.m[i], ships = (G.shownF[i] / m) * Math.max(1, m * NS); vis = clamp(ships - sl.s, 0, 1); u = (G.laneT[i] + sl.off) % 1; }
      else if (sl.kind === 1) { vis = clamp(G.shownR[i] * NS - sl.s, 0, 1); u = (G.relayT[i] + sl.off) % 1; }
      else { vis = 0.75; u = (G.bgT / sl.L.len + sl.off) % 1; if (sl.rev) u = 1 - u; }
      vis *= sstep(0, 0.07, u) * sstep(1, 0.93, u);
      if (vis < 0.02) { G.hull.setMatrixAt(k2, ZERO); G.top.setMatrixAt(k2, ZERO); G.wakes.setMatrixAt(k2, ZERO); G.nav.setMatrixAt(k2, ZERO); continue; }
      lutAt(sl.L, u, tmp); const ang = tmp[2] + (sl.rev ? Math.PI : 0), sz = (sl.kind === 2 ? 0.85 : 1.35) * vis;
      const bob = Math.sin(time * 2 + k2) * 0.008;
      e.set(Math.sin(time * 1.7 + k2 * 0.7) * 0.05, -ang, 0, 'YXZ'); q.setFromEuler(e); p3.set(tmp[0], bob, tmp[1]); s3.set(sz, sz, sz);
      m4.compose(p3, q, s3); G.hull.setMatrixAt(k2, m4); G.top.setMatrixAt(k2, m4);
      e.set(0, -ang, 0); q.setFromEuler(e); p3.y = 0; s3.set(sz, 1, sz * (moving ? 1 : 0.5)); m4.compose(p3, q, s3); G.wakes.setMatrixAt(k2, m4);
      p3.set(tmp[0] - Math.cos(ang) * 0.15 * sz, 0.2 * sz, tmp[1] - Math.sin(ang) * 0.15 * sz); s3.set(sz, sz, sz); m4.compose(p3, q.identity(), s3); G.nav.setMatrixAt(k2, m4);
    }
    // 가운데 섬 부두에 묶인 배: 지금 들어오는 무역(직접 + 경유)의 몫만큼
    const B = G.berths.length;
    for (let b = 0; b < B; b++) {
      const kk = slots.length + b, br = G.berths[b], vis = clamp(totIn * B - b, 0, 1);
      if (vis < 0.02) { G.hull.setMatrixAt(kk, ZERO); G.top.setMatrixAt(kk, ZERO); G.nav.setMatrixAt(kk, ZERO); }
      else {
        e.set(0, -br.a, 0); q.setFromEuler(e); p3.set(br.x, Math.sin(time * 1.3 + b) * 0.004, br.z); s3.set(vis * 1.3, vis * 1.3, vis * 1.3); m4.compose(p3, q, s3); G.hull.setMatrixAt(kk, m4); G.top.setMatrixAt(kk, m4);
        p3.y = 0.2; m4.compose(p3, q.identity(), s3); G.nav.setMatrixAt(kk, m4);
      }
      G.wakes.setMatrixAt(kk, ZERO);
      const busy = vis > 0.5, swing = busy ? Math.sin(time * 0.6 + b * 1.7) * 0.6 : 0;
      e.set(0, -br.a + Math.PI / 2 + swing, 0); q.setFromEuler(e); p3.set(br.cx, br.cy - 0.03, br.cz); s3.set(1, 1, 1); m4.compose(p3, q, s3); G.cranes.setMatrixAt(b, m4);
    }
    [G.hull, G.top, G.wakes, G.nav, G.cranes].forEach((m) => { m.instanceMatrix.needsUpdate = true; });

    // 새는 길 점선
    const DN = G.DN; let di = 0;
    for (let i = 1; i < n; i++) {
      const rr = G.shownR[i], wd = rr > 0.0015 ? 0.035 + 0.28 * Math.sqrt(rr) : 0;
      for (let s = 0; s < DN; s++, di++) {
        if (!wd) { G.dash.setMatrixAt(di, ZERO); continue; }
        const u = ((s + (G.relayT[i] * 3) % 1) / DN), u2 = u + 0.45 / DN;
        if (u2 > 0.97 || u < 0.03) { G.dash.setMatrixAt(di, ZERO); continue; }
        lutAt(G.relayL[i], (u + u2) / 2, tmp); const len = G.relayL[i].len * (u2 - u);
        e.set(0, -tmp[2], 0); q.setFromEuler(e); p3.set(tmp[0], 0.035, tmp[1]); s3.set(len, 1, wd); m4.compose(p3, q, s3); G.dash.setMatrixAt(di, m4);
      }
    }
    G.dash.instanceMatrix.needsUpdate = true;

    // 참여국: 깃발이 오르고 차단기가 내려간다
    for (let i = 0; i < n; i++) {
      if (i === 0) { [G.pPole, G.pFlag, G.pGate, G.pBoom, G.pRing].forEach((m) => m.setMatrixAt(0, ZERO)); continue; }
      const pp = G.port[i], f = G.shownPart[i], px = pp.sx + Math.cos(pp.a) * 0.06, pz = pp.sz + Math.sin(pp.a) * 0.06, py = 0.04;
      const nx = -Math.sin(pp.a), nz = Math.cos(pp.a);
      if (f < 0.02) { [G.pPole, G.pFlag, G.pGate, G.pBoom, G.pRing].forEach((m) => m.setMatrixAt(i, ZERO)); continue; }
      e.set(0, -pp.a, 0); q.setFromEuler(e);
      p3.set(px + nx * 0.1, py, pz + nz * 0.1); s3.set(1, f, 1); m4.compose(p3, q, s3); G.pPole.setMatrixAt(i, m4);
      p3.set(px + nx * 0.1, py + 0.85 * f, pz + nz * 0.1); e.set(0, -pp.a + Math.PI / 2 + Math.sin(time * 3 + i) * 0.15, 0); q.setFromEuler(e); s3.set(1, 1, 1); m4.compose(p3, q, s3); G.pFlag.setMatrixAt(i, m4);
      e.set(0, -pp.a + Math.PI / 2, 0); q.setFromEuler(e); p3.set(px - nx * 0.1, py, pz - nz * 0.1); m4.compose(p3, q, s3); G.pGate.setMatrixAt(i, m4);
      p3.set(pp.ox, 0.03 + Math.sin(time * 1.5 + i) * 0.006, pp.oz); q.identity(); s3.set(f, 1, f); m4.compose(p3, q, s3); G.pRing.setMatrixAt(i, m4); s3.set(1, 1, 1);
      e.set(0, -pp.a - Math.PI / 2, (1 - f) * 1.4, 'YXZ'); q.setFromEuler(e); p3.set(px - nx * 0.1, py + 0.11, pz - nz * 0.1); m4.compose(p3, q, s3); G.pBoom.setMatrixAt(i, m4);
    }
    [G.pPole, G.pFlag, G.pGate, G.pBoom, G.pRing].forEach((m) => { m.instanceMatrix.needsUpdate = true; });

    // 가운데 섬: 불 꺼진 빌딩 몫 = 경제 피해
    const D = G.shownD; let ch = false;
    for (const [bk, rank] of G.centerB) { const tgt = rank < D ? 0.04 : 1, cur = G.aLit[bk], nv = cur + (tgt - cur) * Math.min(1, thumb ? 1 : dt * 2.5); if (Math.abs(nv - cur) > 1e-3) { G.aLit[bk] = nv; ch = true; } }
    if (ch) G.blds.geometry.attributes.aLit.needsUpdate = true;
    // 군중 수 · 깃발 높이 = 결속 지수
    const C = clamp(G.shownC, 0, 100);
    G.crowd.count = Math.round(C / 100 * G.crowd.instanceMatrix.count);
    const fy = G.plazaY + Math.max(0.4, C / 100 * PH) ;
    G.flag.position.set(cx[0] + 0.02, fy, cz[0]); G.flag.rotation.y = -0.6 + Math.sin(time * 0.3) * 0.25;
    const fp = G.flag.geometry.attributes.position, fa = fp.array, base = G.flagBase;
    for (let j = 0; j < fa.length; j += 3) { const x = base[j]; fa[j + 2] = Math.sin(x * 9 - time * 5) * 0.045 * x / 0.62; }
    fp.needsUpdate = true; G.flag.geometry.computeVertexNormals();

    // 이름표
    setT(LT, 'span', started ? `경제 피해 ${Math.round(sim.D[sim.t] * 100)}% · 불 꺼진 빌딩` : '평소처럼 무역 중');
    const Cn = Math.round(sim.C[sim.t]);
    setT(LC, 'span', `결속 지수 ${Cn}`); LC.d.querySelector('i').style.background = Cn < 30 ? '#dc2626' : '#ea580c';
    const rT = place(LT, cx[0], G.plazaY + PH + 0.55, cz[0], true);
    const rC = place(LC, cx[0], G.plazaY + Math.max(0.4, C / 100 * PH) - 0.12, cz[0], true, 'side');
    const taken = [rT, rC, [0, 0, clock.offsetWidth + 12, clock.offsetHeight + 12]];
    // 새는 무역이 가장 많은 제3국 · 가장 큰 참여국: 다른 이름표와 겹치지 않는 후보를 고른다
    const pick = (o, list, y, show) => {
      for (const i of list) { const r = place(o, cx[i], y, cz[i], show); if (r && !taken.some((t) => hit(t, r))) { taken.push(r); return i; } }
      o.d.style.display = 'none'; return -1;
    };
    const hubs = []; for (let i = 1; i < n; i++) if (sim.relay[i] > 0.004) hubs.push(i);
    hubs.sort((a2, b2) => sim.relay[b2] - sim.relay[a2]);
    const hub = pick(LH, hubs.slice(0, 4), 0.75, started && hubs.length > 0, true);
    if (hub > 0) setT(LH, 'span', `경유해 들어가는 무역 ${Math.round(sim.relay[hub] * 100)}%`);
    const parts = []; for (let i = 1; i < n; i++) if (sim.part[i]) parts.push(i);
    parts.sort((a2, b2) => G.W.m[b2] - G.W.m[a2]);
    pick(LP, parts.slice(0, 5), 1.05, started && parts.length > 0);
    const tt = started ? `제재 ${sim.t - P.start}달째` : '제재 전', ts = started ? `참여국 ${sim.part.filter(Boolean).length}곳 / ${n - 1}곳` : `${P.start - sim.t}달 뒤 제재 시작`;
    if (clock._t !== tt) { clock._t = tt; clock.querySelector('b').textContent = tt; }
    if (clock._s !== ts) { clock._s = ts; clock.querySelector('span').textContent = ts; }
  }

  v.onFrame((dt) => update(dt));
  update(1);
  if (st0.thumb) {
    controls.autoRotate = false;
    camera.position.set(-3, 15, 19); controls.target.set(0, 0, 1.2);
    const shot = () => { update(1); controls.update(); v.render(); };
    shot(); setTimeout(shot, 300); setTimeout(shot, 1500);
  }
  window.Sanctions3D = { v, update };
}

// 캔버스를 감싸 이름표를 겹쳐 올릴 자리를 만든다(create3D보다 먼저: 크기 감시가 부모를 본다)
let wrap = null;
if (canvas && st0) {
  const css = document.createElement('style');
  css.textContent = `
.sn3-wrap{position:relative;overflow:hidden;border-radius:14px;max-width:760px;margin:0 auto}
.sn3-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 12px/1.25 ${FONT};color:#1f2937;background:rgba(255,255,255,.93);border:1px solid #d5dae1;border-radius:9px;padding:3px 8px;box-shadow:0 1px 4px rgba(15,23,42,.14);will-change:transform}
.sn3-lab.node{display:flex;flex-direction:column;align-items:center;padding:3px 9px}
.sn3-lab.node b{font-size:12.5px}.sn3-lab.node span{font-size:10.5px;font-weight:500;color:#6b7280}
.sn3-lab.hub b{color:#c2410c}.sn3-lab.part b{color:#1d4ed8}
.sn3-lab.chip{display:flex;align-items:center;gap:5px;font-size:11.5px;padding:2px 7px}
.sn3-lab.chip i{display:inline-block;width:9px;height:9px;border-radius:2px}
.sn3-time{position:absolute;left:10px;top:10px;padding:5px 10px;border-radius:10px;background:rgba(255,255,255,.9);border:1px solid #d5dae1;box-shadow:0 1px 5px rgba(15,23,42,.14);pointer-events:none;font-family:${FONT};display:flex;flex-direction:column}
.sn3-time b{font-size:14px;color:#111827}.sn3-time span{font-size:10.5px;color:#6b7280}
.sn3-night .sn3-lab,.sn3-night .sn3-time{background:rgba(22,29,44,.9);border-color:#3a4458;color:#e5e7eb}
.sn3-night .sn3-lab.node span,.sn3-night .sn3-time span{color:#9aa5b8}.sn3-night .sn3-time b{color:#f9fafb}
.sn3-night .sn3-lab.hub b{color:#fdba74}.sn3-night .sn3-lab.part b{color:#93b4ff}
@media (max-width:640px){.sn3-lab{font-size:10.5px}.sn3-lab.node{padding:2px 7px}.sn3-lab.node b{font-size:11.5px}.sn3-lab.node span{font-size:9.5px}.sn3-lab.chip{font-size:10.5px;padding:1px 6px}.sn3-time{left:6px;top:6px;padding:3px 8px}.sn3-time b{font-size:12.5px}.sn3-time span{font-size:9.5px}}
`;
  document.head.appendChild(css);
  wrap = document.createElement('div'); wrap.className = 'sn3-wrap';
  canvas.parentNode.insertBefore(wrap, canvas); wrap.appendChild(canvas);
  canvas.setAttribute('aria-label', '3D sea of imaginary island countries with cargo ships, a sanctioned island and its plaza');
  const narrow = (canvas.parentElement.clientWidth || 999) < 640;
  if (narrow) canvas.style.aspectRatio = '1 / 1.08';
  const v = create3D(canvas, { camera: narrow ? [-2, 19, 21] : [-3.5, 9, 20], target: narrow ? [0, 0, 0.8] : [0, 0.4, 1.6], background: PAL.day.fog, autoRotate: true, autoRotateSpeed: 0.3, minDistance: 5, maxDistance: 60, fov: narrow ? 46 : 42 });
  if (v) init(v, narrow);
}
