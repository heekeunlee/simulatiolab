/*
 * 물감을 마구 뿌리면 폴록이 될까: 붓(점)이 걷는 자취를 그리고, 박스 세기(box-counting)로 그 그림의 복잡도(프랙탈 차원)를 잰다.
 * 배경: Taylor, Micolich, Jonas (1999), "Fractal analysis of Pollock's drip paintings", Nature 399: 422 은 폴록의 그림에서
 * 프랙탈 성격을 보고했고, 이에 대한 반론도 있다(예: Jones-Smith & Mathur 2006, Nature 444: E9–E10).
 * 이 파일은 폴록의 그림이나 그 연구를 재현하지 않는다. 이 프로젝트가 정한 단순한 "붓 걷기" 규칙과 숫자를 쓴다.
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 붓 걷기: 캔버스(G x G 칸) 위에서 붓 끝이 한 걸음(STEP 칸)씩 나아간다. 걸음마다 방향이 정규분포(표준편차 = turn 라디안)만큼 틀어진다.
 *   벽에 닿으면 튕겨 나온다. 한 획(stroke 걸음)을 다 그으면 붓을 들어 캔버스의 아무 곳으로 옮겨 새 획을 시작한다(색·굵기도 새로).
 *   물감 양 = 모든 획의 걸음 수 합(amount 걸음).
 * 비교용 그리기 방식:
 *   'ruler' 자로 그은 직선: 무작위 위치·방향에서 같은 길이의 직선을 긋는다(벽에 닿으면 거기서 끝).
 *   'dots'  무작위 점: 같은 물감 양만큼 점(붓 한 번 찍기)을 캔버스 전체에 고르게 무작위로 찍는다.
 * 박스 세기: 칸 크기 s = 1, 2, 4, …, G 로 캔버스를 나눠 물감이 묻은 칸의 수 N(s)을 센다.
 *   N(s) ∝ s^(-D) 라면 D가 프랙탈 차원(반듯한 선 1, 빈틈없이 꽉 찬 면 2). s = FIT 범위의 로그-로그 기울기로 잰다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pollock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const G = 512, LV = 10, STEP = 2;           // 격자 크기(칸), 칸 크기 단계 수(1..512), 한 걸음 길이(칸)
  const FIT = [4, 8, 16, 32, 64];            // 기울기를 잴 칸 크기 (가장 작은 칸은 붓 굵기, 가장 큰 칸은 캔버스 가장자리 영향이 커서 뺀다)
  const DEFAULTS = { turn: 0.12, stroke: 300, amount: 15000, mode: 'brush', seed: 1 };
  const COLORS = ['#1b1b1f', '#f4f1e8', '#c8962e', '#7d7f86', '#1b1b1f', '#a8432f']; // 검정이 두 번: 자주 나온다

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 최소제곱 기울기: log N(s) 대 log(1/s)
  function slope(counts) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
    FIT.forEach((s) => { const l = Math.round(Math.log2(s)), c = counts[l]; if (c > 0) { const x = -Math.log10(s), y = Math.log10(c); sx += x; sy += y; sxx += x * x; sxy += x * y; n++; } });
    if (n < 3) return { D: NaN, icpt: NaN };
    const D = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return { D, icpt: (sy - D * sx) / n };
  }

  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32((P.seed * 2654435761 + 977) >>> 0);
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const ink = new Uint8Array(G * G);
    const boxes = [], counts = new Float64Array(LV);
    for (let l = 0; l < LV; l++) boxes.push(new Uint8Array((G >> l) * (G >> l)));
    const sim = { params: P, G, STEP, used: 0, strokes: [], counts, boxes, hist: [], ink };
    // 칸 하나에 물감을 묻힌다 (처음 묻는 칸이면 모든 크기의 박스 수를 갱신)
    function set(x, y) {
      if (x < 0 || y < 0 || x >= G || y >= G) return;
      const i = y * G + x; if (ink[i]) return; ink[i] = 1;
      for (let l = 0; l < LV; l++) { const w = G >> l, j = (y >> l) * w + (x >> l); if (!boxes[l][j]) { boxes[l][j] = 1; counts[l]++; } }
    }
    function stamp(cx, cy, wd) { // 굵기 wd(칸)의 붓 끝 한 번
      if (wd <= 1) { set(Math.floor(cx), Math.floor(cy)); return; }
      const r = wd / 2, x0 = Math.floor(cx - r), x1 = Math.floor(cx + r), y0 = Math.floor(cy - r), y1 = Math.floor(cy + r);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) set(x, y); }
    }
    function seg(ax, ay, bx, by, wd) {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let k = 1; k <= n; k++) stamp(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, wd);
    }
    const pickW = () => { const u = rng(); return u < 0.45 ? 1 : u < 0.8 ? 2 : u < 0.95 ? 3 : 5; };
    let cur = null; // 지금 긋는 획: { pts:[x,y,...], color, w, left, th, x, y }
    function newStroke() {
      const s = { color: COLORS[(rng() * COLORS.length) | 0], w: pickW(), pts: [], left: P.stroke, x: rng() * G, y: rng() * G, th: rng() * 2 * Math.PI };
      if (P.mode === 'dots') { s.left = 1; s.w = Math.max(2, s.w); }
      s.pts.push(s.x, s.y); sim.strokes.push(s); cur = s;
      if (P.mode === 'dots') { stamp(s.x, s.y, s.w); }
      return s;
    }
    // 한 걸음 (물감 1단위). 끝났으면 false
    function step() {
      if (sim.used >= P.amount) return false;
      if (!cur || cur.left <= 0 || cur.dead) newStroke();
      const s = cur;
      sim.used++; s.left--;
      if (P.mode === 'dots') { return true; }
      if (P.mode === 'brush') s.th += P.turn * gauss();
      let nx = s.x + STEP * Math.cos(s.th), ny = s.y + STEP * Math.sin(s.th);
      if (P.mode === 'ruler') {
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) { s.dead = true; return true; } // 자로 그은 선은 캔버스 끝에서 멈춘다
      } else {
        if (nx < 0) { nx = -nx; s.th = Math.PI - s.th; } else if (nx >= G) { nx = 2 * G - nx - 0.01; s.th = Math.PI - s.th; }
        if (ny < 0) { ny = -ny; s.th = -s.th; } else if (ny >= G) { ny = 2 * G - ny - 0.01; s.th = -s.th; }
      }
      seg(s.x, s.y, nx, ny, s.w); s.x = nx; s.y = ny; s.pts.push(nx, ny);
      return true;
    }
    sim.done = () => sim.used >= P.amount;
    sim.measure = () => slope(counts);
    sim.D = () => slope(counts).D;
    sim.cover = () => counts[0] / (G * G);
    const HN = 60; // 기록 간격: 물감 양을 60등분
    function record() { sim.hist.push({ used: sim.used, D: sim.D(), cover: sim.cover() }); }
    sim.advance = function (k) {
      let moved = false;
      for (let i = 0; i < k; i++) {
        if (!step()) break; moved = true;
        if (sim.used % Math.max(1, Math.round(P.amount / HN)) === 0 || sim.used === P.amount) record();
      }
      return moved;
    };
    sim.run = function () { while (sim.advance(5000)); return sim; };
    return sim;
  }

  return { G, LV, STEP, FIT, DEFAULTS, COLORS, create, slope, mulberry32 };
});
