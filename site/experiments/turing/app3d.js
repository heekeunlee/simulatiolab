// 3D로 보기: v 농도를 높이로 세운 지형. 2D 화면(app.js)과 같은 시뮬레이션 상태(window.TuringLab)를 그대로 쓴다.
import { THREE, create3D } from '../../lab3d.js';

const canvas = document.getElementById('c-3d');
const TL = window.TuringLab;
const v3 = canvas && TL ? create3D(canvas, { camera: [0, 7.4, 11.2], target: [0, 0, 0.4], autoRotateSpeed: 0.6, minDistance: 5, maxDistance: 22, background: '#f6f7fb' }) : null;

if (v3) {
  const SIZE = 10, HEIGHT = 0.75;   // 판의 한 변, v = VMAX 일 때의 높이
  let S = 0, geo = null, mesh = null, lastRev = -1, lastSim = null;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04, side: THREE.DoubleSide });

  v3.scene.add(new THREE.AmbientLight(0xffffff, 0.55));   // 낮은 곳(밝은 바탕)이 회색으로 가라앉지 않게
  // 받침대: 지형이 떠 있지 않게 아래에 얇은 판
  const base = new THREE.Mesh(new THREE.BoxGeometry(SIZE + 0.3, 0.25, SIZE + 0.3), new THREE.MeshStandardMaterial({ color: 0xe3e6ef, roughness: 0.9 }));
  base.position.y = -0.14; v3.scene.add(base);

  // 2D와 같은 색표(sRGB)를 three.js가 쓰는 선형 색으로 바꿔 둔다
  const LIN = new Float32Array(256 * 3), tmp = new THREE.Color();
  for (let q = 0; q < 256; q++) { tmp.setRGB(TL.LUT[q * 3] / 255, TL.LUT[q * 3 + 1] / 255, TL.LUT[q * 3 + 2] / 255, THREE.SRGBColorSpace); LIN[q * 3] = tmp.r; LIN[q * 3 + 1] = tmp.g; LIN[q * 3 + 2] = tmp.b; }

  function build(size) {
    S = size;
    if (mesh) { v3.scene.remove(mesh); geo.dispose(); }
    geo = new THREE.PlaneGeometry(SIZE, SIZE, S - 1, S - 1);
    geo.rotateX(-Math.PI / 2);   // 2D 그림의 위쪽(0번째 줄)이 화면 안쪽으로
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(S * S * 3), 3));
    mesh = new THREE.Mesh(geo, mat); v3.scene.add(mesh);
  }

  function update() {
    const sim = TL.sim; if (!sim) return;
    if (sim.size !== S) build(sim.size);
    const v = sim.v, pos = geo.attributes.position.array, col = geo.attributes.color.array, VM = TL.VMAX;
    for (let i = 0; i < S * S; i++) {
      const t = Math.max(0, Math.min(1, v[i] / VM)), q = Math.round(t * 255) * 3;
      pos[i * 3 + 1] = t * HEIGHT;
      col[i * 3] = LIN[q]; col[i * 3 + 1] = LIN[q + 1]; col[i * 3 + 2] = LIN[q + 2];
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals();
  }

  v3.onFrame(() => {
    if (TL.rev !== lastRev || TL.sim !== lastSim) { lastRev = TL.rev; lastSim = TL.sim; update(); }
  });
  update(); v3.render();
}
