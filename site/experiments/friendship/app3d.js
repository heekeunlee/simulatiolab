// 친구의 역설 — 3D 보기. 위 ① 관계망과 같은 관계망을 3차원 힘 방향 배치로 다시 놓는다.
// 점 크기·색 = 친구 수(파랑 → 보라 → 금빛), 친구가 많은 허브는 빛난다.
// 몇 초마다 무작위로 한 사람을 뽑아 그 사람의 친구들에게 선을 뻗고, "내 친구 수"와 "친구들의 평균"을 막대로 비교한다.
// "높이 = 친구 수"를 켜면 친구 수가 많을수록 위로 올라가, 뽑힌 사람의 선이 대부분 위로 뻗는 것이 보인다.
import { THREE, create3D } from '../../lab3d.js';

const THUMB = /[?&]thumb=1/.test(location.search);
const $ = (id) => document.getElementById(id);
const canvas = $('c-3d');
// 3D 보기는 두 칸 격자에서 한 줄 전체를 쓴다 (작은 칸에서는 입체 구조가 잘 안 보임)
if (canvas) { const sec = canvas.closest('section'); if (sec) sec.style.gridColumn = '1 / -1'; canvas.style.maxWidth = '980px'; canvas.style.margin = '0 auto'; const c = $('cmp3d'); if (c) { c.style.maxWidth = '640px'; } }
const v = canvas && create3D(canvas, { camera: [0, 3.5, 20], target: [0, 0, 0], dark: true, background: '#0d1322', autoRotateSpeed: 0.55, minDistance: 8, maxDistance: 60 });

if (v) {
  const { scene } = v;
  if (canvas.clientWidth < 520) v.camera.position.set(0, 3, 17); // 휴대폰: 조금 더 가까이
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const HOLD = 4.6, GROW = 0.8;             // 한 사람을 보여 주는 시간(초), 선이 뻗는 시간
  const C0 = new THREE.Color('#3b82f6'), C1 = new THREE.Color('#a855f7'), C2 = new THREE.Color('#ffb020');
  const SEL = new THREE.Color('#ff4d6d'), GOLD = new THREE.Color('#ffd166');
  const EDGE = new THREE.Color('#26375f'), EDGE_DIM = new THREE.Color('#0e1424');
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), tmpC = new THREE.Color();

  function rng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // 3차원 힘 방향 배치 (Fruchterman-Reingold): 이웃은 끌어당기고 모두는 밀어낸다
  function layout3d(adj, seed) {
    const n = adj.length, r = rng(seed * 131 + 7), P = new Float64Array(n * 3), D = new Float64Array(n * 3);
    for (let i = 0; i < n * 3; i++) P[i] = (r() - 0.5) * 2;
    const k = 2.2 / Math.cbrt(n), T = 220;
    for (let it = 0; it < T; it++) {
      D.fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let ex = P[3 * i] - P[3 * j], ey = P[3 * i + 1] - P[3 * j + 1], ez = P[3 * i + 2] - P[3 * j + 2], d2 = ex * ex + ey * ey + ez * ez;
        if (d2 < 1e-6) { ex = 1e-3; d2 = 1e-6; }
        const f = (k * k) / d2;
        D[3 * i] += ex * f; D[3 * i + 1] += ey * f; D[3 * i + 2] += ez * f; D[3 * j] -= ex * f; D[3 * j + 1] -= ey * f; D[3 * j + 2] -= ez * f;
      }
      for (let i = 0; i < n; i++) for (const j of adj[i]) {
        if (j < i) continue;
        const ex = P[3 * i] - P[3 * j], ey = P[3 * i + 1] - P[3 * j + 1], ez = P[3 * i + 2] - P[3 * j + 2], f = Math.sqrt(ex * ex + ey * ey + ez * ez) / k;
        D[3 * i] -= ex * f; D[3 * i + 1] -= ey * f; D[3 * i + 2] -= ez * f; D[3 * j] += ex * f; D[3 * j + 1] += ey * f; D[3 * j + 2] += ez * f;
      }
      const temp = 0.12 * (1 - it / T) + 0.003;
      for (let i = 0; i < n; i++) {
        for (let a = 0; a < 3; a++) D[3 * i + a] -= P[3 * i + a] * 0.06 * k; // 약한 중심 당김
        const d = Math.hypot(D[3 * i], D[3 * i + 1], D[3 * i + 2]) || 1e-9, s = Math.min(d, temp) / d;
        for (let a = 0; a < 3; a++) P[3 * i + a] += D[3 * i + a] * s;
      }
    }
    // 반지름이 약 10이 되도록 맞춘다 (바깥 몇 명 때문에 줄어들지 않게 95% 지점 기준)
    const rs = []; for (let i = 0; i < n; i++) rs.push(Math.hypot(P[3 * i], P[3 * i + 1], P[3 * i + 2]));
    rs.sort((a, b) => a - b); const sc = 9.5 / (rs[Math.floor(n * 0.95)] || 1);
    for (let i = 0; i < n * 3; i++) P[i] *= sc;
    return P;
  }

  function glowTex(ring) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    if (ring) { x.strokeStyle = '#fff'; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 54, 0, 7); x.stroke(); }
    else { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const GLOW = glowTex(false), RING = glowTex(true);

  let G = null; // 지금 그리는 관계망
  let lift = false, clock = 0, pickAt = -1e9, cur = -1, tally = { n: 0, up: 0 }, manual = false;
  const liftBtn = $('lift3d'), nextBtn = $('next3d');

  function clear() {
    if (!G) return;
    [G.nodes, G.lines, G.tubes, G.disc].concat(G.glows).concat([G.ring]).forEach((o) => { scene.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  function build() {
    const S = window.FriendshipView && window.FriendshipView.sim; if (!S) return;
    clear();
    const adj = S.adj, M = S.M, n = M.n, L3 = layout3d(adj, S.params.seed);
    const lmin = Math.log(Math.max(1, Math.min(...M.deg))), lmax = Math.log(M.maxDeg), ht = (i) => (Math.log(M.deg[i]) - lmin) / (lmax - lmin || 1);
    const rad = (i) => 0.12 + 0.075 * Math.sqrt(M.deg[i]);
    const base = [], A = new Float64Array(n * 3), B = new Float64Array(n * 3), P = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = ht(i), c = t < 0.5 ? C0.clone().lerp(C1, t * 2) : C1.clone().lerp(C2, (t - 0.5) * 2); base.push(c);
      A[3 * i] = L3[3 * i]; A[3 * i + 1] = L3[3 * i + 1]; A[3 * i + 2] = L3[3 * i + 2];             // 입체 배치
      B[3 * i] = L3[3 * i] * 0.85; B[3 * i + 1] = -5.5 + 12.5 * t; B[3 * i + 2] = L3[3 * i + 2] * 0.85;   // 높이 = 친구 수
    }
    P.set(lift ? B : A);
    const nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 }), n);
    for (let i = 0; i < n; i++) nodes.setColorAt(i, base[i]);
    scene.add(nodes);
    const edges = []; for (let i = 0; i < n; i++) for (const j of adj[i]) if (j > i) edges.push(i, j);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edges.length * 3), 3)); lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(edges.length * 3), 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(lines);
    // 뽑힌 사람의 친구 관계는 굵은 관(원기둥)으로
    const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 7, 1, true), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.95 }), Math.max(1, M.maxDeg));
    tubes.count = 0; scene.add(tubes);
    // 허브(친구 수 상위 약 8%)는 빛나게
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => M.deg[b] - M.deg[a]), hubs = order.slice(0, Math.max(3, Math.min(30, Math.round(n * 0.08))));
    const glows = hubs.map((i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: C2, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.62 })); s.userData.i = i; scene.add(s); return s; });
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: RING, color: SEL, transparent: true, depthWrite: false, depthTest: false })); ring.visible = false; scene.add(ring);
    // 높이 보기에서 뽑힌 사람의 높이를 보여 주는 얇은 판
    const disc = new THREE.Mesh(new THREE.CircleGeometry(11.5, 64), new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; scene.add(disc);
    G = { S, M, n, adj, A, B, P, base, rad, nodes, lines, tubes, glows, ring, disc, edges, hubs, isF: new Uint8Array(n) };
    tally = { n: 0, up: 0 }; cur = -1; pickAt = -1e9;
    place(); colorize(0);
    pick(window.FriendshipView.sel >= 0 ? window.FriendshipView.sel : 0);
    if (THUMB) { clock = pickAt + GROW + 0.1; frame(0); }
  }

  function place() {
    const { P, n, nodes, lines, edges, glows, rad } = G;
    for (let i = 0; i < n; i++) {
      const s = rad(i) * (i === cur ? 1.25 : G.isF[i] ? 1.12 : 1);
      tmpM.compose(tmpP.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]), tmpQ.identity(), tmpS.set(s, s, s)); nodes.setMatrixAt(i, tmpM);
    }
    nodes.instanceMatrix.needsUpdate = true;
    const pa = lines.geometry.attributes.position.array;
    for (let e = 0; e < edges.length; e++) { const i = edges[e]; pa[3 * e] = P[3 * i]; pa[3 * e + 1] = P[3 * i + 1]; pa[3 * e + 2] = P[3 * i + 2]; }
    lines.geometry.attributes.position.needsUpdate = true; lines.geometry.computeBoundingSphere();
    glows.forEach((g) => { const i = g.userData.i; g.position.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]); });
  }

  // 선택 상태에 맞게 색을 칠한다 (k: 0이면 선택 없음, 1이면 완전히 강조)
  function colorize(k) {
    const { n, nodes, lines, edges, base, isF } = G, act = cur >= 0 ? k : 0;
    for (let i = 0; i < n; i++) {
      const on = i === cur || isF[i];
      tmpC.copy(i === cur ? SEL : base[i]); if (!on) tmpC.multiplyScalar(1 - (THUMB ? 0.4 : 0.72) * act);
      nodes.setColorAt(i, tmpC);
    }
    nodes.instanceColor.needsUpdate = true;
    const ca = lines.geometry.attributes.color.array;
    tmpC.copy(EDGE).lerp(EDGE_DIM, act);
    for (let e = 0; e < edges.length; e++) { ca[3 * e] = tmpC.r; ca[3 * e + 1] = tmpC.g; ca[3 * e + 2] = tmpC.b; }
    lines.geometry.attributes.color.needsUpdate = true;
    G.glows.forEach((g) => { const i = g.userData.i; g.material.opacity = (i === cur || isF[i] || !act) ? 0.62 : 0.62 - 0.45 * act; });
  }

  function tubesAt(g) {
    const { P, adj, tubes } = G; if (cur < 0) { tubes.count = 0; return; }
    const a = new THREE.Vector3(P[3 * cur], P[3 * cur + 1], P[3 * cur + 2]), b = new THREE.Vector3(), d = new THREE.Vector3();
    adj[cur].forEach((j, k) => {
      b.set(P[3 * j], P[3 * j + 1], P[3 * j + 2]); d.subVectors(b, a); const len = d.length() * g;
      tmpQ.setFromUnitVectors(UP, d.clone().normalize());
      tmpP.copy(a).addScaledVector(d, g / 2);
      tmpM.compose(tmpP, tmpQ, tmpS.set(0.075, Math.max(1e-3, len), 0.075)); tubes.setMatrixAt(k, tmpM);
    });
    tubes.count = adj[cur].length; tubes.instanceMatrix.needsUpdate = true;
  }

  function pick(i) {
    G.isF.fill(0); cur = i; G.adj[i].forEach((j) => { G.isF[j] = 1; }); pickAt = clock;
    const M = G.M, up = G.adj[i].filter((j) => M.deg[j] > M.deg[i]).length;
    tally.n++; if (M.fr[i] > M.deg[i]) tally.up++;
    caption(i, up);
  }

  function caption(i, up) {
    const M = G.M, d = M.deg[i], f = M.fr[i], top = Math.max(d, f) * 1.08, bar = (val, col) => `<div style="flex:1 1 140px;height:12px;border-radius:6px;background:var(--line,#e6e9f0);overflow:hidden"><div style="width:${(100 * val / top).toFixed(1)}%;height:100%;background:${col};border-radius:6px;transition:width .6s"></div></div>`;
    const row = (txt, val, col) => `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;margin:4px 0"><span style="flex:1 1 230px;font-size:13px">${txt}</span>${bar(val, col)}</div>`;
    const more = f > d;
    $('cmp3d').innerHTML =
      row(`뽑힌 사람의 친구 수 · ${d}명`, d, '#ff4d6d') +
      row(`그 친구들의 평균 친구 수 · ${f.toFixed(1)}명`, f, '#e0a100') +
      `<div style="font-size:13px;margin-top:6px;font-weight:600;color:${more ? 'var(--unlucky)' : 'var(--lucky)'}">${more ? `친구 ${d}명 중 ${up}명이 이 사람보다 친구가 많아요` : `이 사람은 친구들보다 친구가 많은 드문 경우예요 (친구 ${d}명 중 ${up}명만 더 많음)`}</div>` +
      (lift ? `<div class="small" style="margin-top:2px;color:var(--muted)">높이: 위로 갈수록 친구가 많은 사람 · 옅은 빨간 판 = 뽑힌 사람의 높이</div>` : '') +
      `<div class="small" style="margin-top:2px;color:var(--muted)">${`지금까지 ${tally.n}명을 뽑았고 그중 ${tally.up}명(${Math.round(100 * tally.up / tally.n)}%)이 친구들이 더 많았어요`}</div>`;
  }

  function frame(dt) {
    dt = Math.max(0, dt || 0); // lab3d.js의 첫 프레임 dt가 음수일 수 있어 막는다
    if (!G) return;
    clock += dt;
    if (!THUMB && !manual && clock - pickAt > HOLD) {
      // 무작위로 한 사람을 뽑는다 (가끔은 허브도 뽑힌다: 균등 추출)
      pick(Math.floor(Math.random() * G.n));
    }
    if (manual && clock - pickAt > HOLD * 2.5) manual = false;
    const e = clock - pickAt, g = Math.min(1, Math.max(0, (e - 0.25) / GROW)), ease = g * g * (3 - 2 * g);
    // 배치 전환 (입체 ↔ 높이)
    const T = lift ? G.B : G.A, P = G.P, kk = THUMB ? 1 : 1 - Math.exp(-dt * 3.2); let moving = false;
    for (let i = 0; i < P.length; i++) { const dd = T[i] - P[i]; if (Math.abs(dd) > 1e-3) { P[i] += dd * kk; moving = true; } }
    if (moving || e < GROW + 0.5) place();
    colorize(Math.min(1, e / 0.35));
    tubesAt(ease);
    const r = G.ring; r.visible = cur >= 0;
    if (cur >= 0) { const s = (G.rad(cur) * 3 + 0.9) * (1 + 0.08 * Math.sin(clock * 5)); r.position.set(P[3 * cur], P[3 * cur + 1], P[3 * cur + 2]); r.scale.set(s, s, 1); }
    G.disc.position.y = cur >= 0 ? P[3 * cur + 1] : 0;
    G.disc.material.opacity += ((lift && cur >= 0 ? 0.09 : 0) - G.disc.material.opacity) * Math.min(1, dt * 4 + (THUMB ? 1 : 0));
    G.glows.forEach((s) => { const i = s.userData.i, z = G.rad(i) * (4.2 + 0.35 * Math.sin(clock * 2 + i)); s.scale.set(z, z, 1); });
  }
  v.onFrame(frame);

  function setLift(on) {
    lift = on; if (G && cur >= 0) caption(cur, G.adj[cur].filter((j) => G.M.deg[j] > G.M.deg[cur]).length);
    if (liftBtn) liftBtn.textContent = lift ? '입체 배치로 돌아가기' : '높이 = 친구 수로 보기';
  }
  if (liftBtn) liftBtn.addEventListener('click', () => setLift(!lift));
  if (nextBtn) nextBtn.addEventListener('click', () => { if (G) { manual = false; pick(Math.floor(Math.random() * G.n)); } });
  setLift(false);
  window.addEventListener('friendship-built', build);
  // ① 그림에서 사람을 누르면 3D에서도 그 사람을 보여 준다 (잠시 무작위 추출을 멈춤)
  window.addEventListener('friendship-select', () => { if (G && window.FriendshipView.sel >= 0) { manual = true; pick(window.FriendshipView.sel); } });
  if (window.FriendshipView) build();
  if (THUMB) canvas.scrollIntoView({ block: 'center' }); // 화면 밖이면 lab3d가 그리지 않으므로 썸네일 촬영 때는 보이게
}
