/*
 * 점 몇 개면 그림이 보일까 (점묘·하프톤 흉내): 코드로 직접 그린 흑백 그림 위에, 어두운 곳일수록 점이 더 잘 찍히도록
 * 점을 하나씩 무작위로 뿌린다. 원래 그림과 점 그림을 똑같이 흐리게 만든 뒤(멀리서 보는 것처럼) 두 그림이 얼마나 닮았는지를
 * 상관계수로 잰다. 점묘화나 신문 인쇄의 하프톤을 아주 단순하게 흉내 낸 이 프로젝트의 모델이며, 사람의 눈이 실제로 얼굴을
 * 알아보는 과정을 잰 것이 아니다. 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * - 그림: G x G 칸의 어두움 값(0 = 흰 종이, 1 = 새까만 곳). '얼굴'과 '풍경' 두 가지를 수식으로 그린다(저작권 문제 없음).
 * - 점 찍기: 그림 안의 아무 곳이나 고른 뒤 그 칸의 어두움 확률로 받아들인다(거부 표본 추출). 받아들이면 반지름 size칸의 점을 찍는다.
 * - 잉크: 칸마다 점이 덮은 비율(4x4 하위 표본, 겹치면 1에서 멈춤).
 * - 닮은 정도: 원래 그림과 잉크를 같은 폭(blur, 가우스 표준편차, 칸)으로 흐리게 한 뒤의 피어슨 상관계수(음수는 0).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Halftone = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const G = 160;
  const DEFAULTS = { pic: 'face', count: 6000, size: 1, blur: 3, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 내장 그림 ----------
  const sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  // 타원 안쪽 정도(1 = 안, 0 = 밖, 경계는 부드럽게). soft: 경계 폭(정규화 반지름 기준)
  const ell = (u, v, cx, cy, rx, ry, soft) => { const q = Math.hypot((u - cx) / rx, (v - cy) / ry); return 1 - sstep(1 - (soft || 0.06), 1 + (soft || 0.06), q); };
  const over = (base, val, a) => base + (val - base) * a; // 위에 덧칠

  function facePx(u, v) {
    // 바탕: 위가 밝고 아래로 조금 어두워지는 벽
    let d = 0.03 + 0.07 * v + 0.04 * Math.hypot(u - 0.5, v - 0.45);
    // 어깨와 옷
    const sh = sstep(-0.01, 0.01, v - (0.80 + 0.5 * (u - 0.5) * (u - 0.5)));
    d = over(d, 0.78 - 0.1 * (u < 0.5 ? (0.5 - u) : 0), sh * ell(u, v, 0.5, 1.02, 0.46, 0.26, 0.05));
    // 목
    const neck = (1 - sstep(0.085, 0.10, Math.abs(u - 0.5))) * sstep(0.70, 0.72, v) * (1 - sstep(0.86, 0.88, v));
    d = over(d, 0.36 + 0.25 * sstep(0.70, 0.78, v), neck);
    // 머리카락(뒤쪽 큰 덩어리)
    d = over(d, 0.86, ell(u, v, 0.5, 0.40, 0.29, 0.31, 0.05));
    // 얼굴: 왼쪽에서 빛이 와서 오른쪽이 조금 어둡다
    const face = ell(u, v, 0.5, 0.49, 0.205, 0.265, 0.05);
    const skin = 0.12 + 0.22 * sstep(0.36, 0.68, u) + 0.06 * sstep(0.55, 0.74, v);
    d = over(d, skin, face);
    // 앞머리: 이마를 비스듬히 덮는다
    const fr = ell(u, v, 0.43, 0.24, 0.24, 0.11, 0.08) * (1 - sstep(-0.02, 0.02, v - (0.30 - 0.18 * (u - 0.5))));
    d = over(d, 0.88, fr);
    // 눈썹
    for (const s of [-1, 1]) {
      const cx = 0.5 + s * 0.085, bw = ell(u, v, cx, 0.395 - 0.012 * Math.cos((u - cx) * 30), 0.055, 0.011, 0.25);
      d = over(d, 0.82, bw);
      // 눈두덩 그늘 + 눈 + 눈동자
      d = over(d, Math.min(1, skin + 0.12), ell(u, v, cx, 0.448, 0.062, 0.03, 0.4) * face);
      d = over(d, 0.12, ell(u, v, cx, 0.452, 0.047, 0.019, 0.12));
      d = over(d, 0.95, ell(u, v, cx + 0.004, 0.452, 0.019, 0.019, 0.15));
    }
    // 코: 오른쪽 그늘과 콧구멍
    const nose = (1 - sstep(0.008, 0.02, Math.abs(u - (0.52 + 0.25 * (v - 0.48))))) * sstep(0.47, 0.50, v) * (1 - sstep(0.57, 0.585, v));
    d = over(d, 0.55, nose);
    d = over(d, 0.62, ell(u, v, 0.505, 0.588, 0.045, 0.014, 0.3));
    // 입
    d = over(d, 0.78, ell(u, v, 0.5, 0.66 - 3.0 * (u - 0.5) * (u - 0.5), 0.066, 0.011, 0.3));
    d = over(d, Math.min(1, skin + 0.12), ell(u, v, 0.5, 0.69, 0.04, 0.012, 0.4) * face);
    // 턱 아래 그늘
    d = over(d, 0.55, (1 - face) * neck * (1 - sstep(0.72, 0.78, v)));
    return Math.max(0, Math.min(0.97, d));
  }

  function landPx(u, v) {
    // 하늘: 위가 조금 짙고 지평선 쪽이 밝다
    let d = 0.32 - 0.26 * sstep(0.0, 0.55, v);
    // 해와 둘레의 빛
    const sr = Math.hypot(u - 0.70, v - 0.27);
    d = over(d, 0.0, 1 - sstep(0.07, 0.085, sr));
    d -= 0.06 * (1 - sstep(0.08, 0.22, sr)); d = Math.max(0, d);
    // 먼 산
    const far = 0.50 - 0.13 * Math.exp(-((u - 0.30) ** 2) / 0.02) - 0.08 * Math.exp(-((u - 0.82) ** 2) / 0.012) + 0.012 * Math.sin(u * 40);
    d = over(d, 0.42 + 0.1 * (v - far) * 3, sstep(-0.004, 0.004, v - far));
    // 가까운 산
    const near = 0.62 - 0.10 * Math.exp(-((u - 0.62) ** 2) / 0.03) + 0.015 * Math.sin(u * 23 + 1) + 0.008 * Math.sin(u * 71);
    d = over(d, 0.80, sstep(-0.004, 0.004, v - near));
    // 호수(물결 반사)
    const lake = sstep(0.70, 0.705, v);
    const ref = 0.22 + 0.10 * Math.sin(v * 160) * (1 - sstep(0, 0.25, Math.abs(u - 0.70))) + 0.15 * sstep(0.72, 1, v);
    d = over(d, ref, lake * (1 - sstep(0.18, 0.2, Math.abs(u - 0.70) - (v - 0.70) * 0.6)) );
    d = over(d, 0.5 + 0.2 * sstep(0.75, 1, v), lake * sstep(0.18, 0.2, Math.abs(u - 0.70) - (v - 0.70) * 0.6));
    // 왼쪽 앞의 나무(줄기 + 둥근 잎)
    d = over(d, 0.93, (1 - sstep(0.008, 0.014, Math.abs(u - 0.15))) * sstep(0.45, 0.47, v) * (1 - sstep(0.86, 0.88, v)));
    d = over(d, 0.90, Math.max(ell(u, v, 0.15, 0.38, 0.10, 0.12, 0.08), ell(u, v, 0.09, 0.47, 0.07, 0.07, 0.1), ell(u, v, 0.21, 0.46, 0.07, 0.07, 0.1)));
    return Math.max(0, Math.min(0.97, d));
  }

  const PICS = { face: facePx, land: landPx };
  const picCache = {};
  function picture(name) {
    if (picCache[name]) return picCache[name];
    const fn = PICS[name] || facePx, a = new Float32Array(G * G);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) a[y * G + x] = fn((x + 0.5) / G, (y + 0.5) / G);
    picCache[name] = a; return a;
  }

  // ---------- 흐리게(가우스, 가장자리는 가장 가까운 값) ----------
  const kerCache = {};
  function kernel(s) {
    if (kerCache[s]) return kerCache[s];
    const R = Math.max(1, Math.ceil(s * 3)), k = new Float32Array(2 * R + 1); let sum = 0;
    for (let i = -R; i <= R; i++) { k[i + R] = Math.exp(-(i * i) / (2 * s * s)); sum += k[i + R]; }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    return (kerCache[s] = { k, R });
  }
  function blur(src, s, out) {
    const { k, R } = kernel(s), tmp = new Float32Array(G * G); out = out || new Float32Array(G * G);
    for (let y = 0; y < G; y++) { const row = y * G; for (let x = 0; x < G; x++) { let a = 0; for (let i = -R; i <= R; i++) { const xx = x + i < 0 ? 0 : x + i >= G ? G - 1 : x + i; a += k[i + R] * src[row + xx]; } tmp[row + x] = a; } }
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { let a = 0; for (let i = -R; i <= R; i++) { const yy = y + i < 0 ? 0 : y + i >= G ? G - 1 : y + i; a += k[i + R] * tmp[yy * G + x]; } out[y * G + x] = a; }
    return out;
  }
  function corr(a, b) {
    const n = a.length; let sa = 0, sb = 0; for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
    const ma = sa / n, mb = sb / n; let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < n; i++) { const p = a[i] - ma, q = b[i] - mb; xy += p * q; xx += p * p; yy += q * q; }
    return xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
  }
  const blurOrigCache = {};
  function blurredPic(name, s) { const key = name + '|' + s; return blurOrigCache[key] || (blurOrigCache[key] = blur(picture(name), s)); }

  function create(opts) {
    const P = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32((P.seed * 2654435761 + 12345) >>> 0);
    const pic = picture(P.pic), ink = new Float32Array(G * G);
    const xs = new Float32Array(P.count), ys = new Float32Array(P.count);
    const sim = { params: P, G, pic, ink, xs, ys, n: 0, hist: [] , far: null };
    const r = P.size, r2 = r * r;
    function stamp(cx, cy) {
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(G - 1, Math.floor(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(G - 1, Math.floor(cy + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        let c = 0;
        for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) { const dx = x + (sx + 0.5) / 4 - cx, dy = y + (sy + 0.5) / 4 - cy; if (dx * dx + dy * dy <= r2) c++; }
        if (c) { const i = y * G + x; ink[i] = Math.min(1, ink[i] + c / 16); }
      }
    }
    // 점 k개를 더 찍는다
    sim.add = function (k) {
      for (let j = 0; j < k && sim.n < P.count; j++) {
        let x, y;
        for (;;) { x = rng() * G; y = rng() * G; if (rng() < pic[Math.floor(y) * G + Math.floor(x)]) break; }
        stamp(x, y); xs[sim.n] = x; ys[sim.n] = y; sim.n++;
      }
    };
    // 지금 점 그림의 닮은 정도를 재서 기록한다
    sim.measure = function () {
      sim.far = blur(ink, P.blur, sim.far);
      const c = Math.max(0, corr(blurredPic(P.pic, P.blur), sim.far));
      const last = sim.hist[sim.hist.length - 1];
      if (!last || last[0] !== sim.n) sim.hist.push([sim.n, c]);
      return c;
    };
    sim.sim = () => (sim.hist.length ? sim.hist[sim.hist.length - 1][1] : 0);
    sim.coverage = () => { let s = 0; for (let i = 0; i < G * G; i++) s += ink[i]; return s / (G * G); };
    sim.done = () => sim.n >= P.count;
    // 재생 한 단계에 찍는 점 수: 처음엔 하나씩, 점이 많아질수록 5%씩 (점 개수를 로그 눈금으로 보면 고르게 자란다)
    sim.stepSize = () => (sim.n < 20 ? 1 : Math.max(1, Math.round(sim.n * 0.05)));
    sim.step = function () { if (sim.done()) return false; sim.add(sim.stepSize()); sim.measure(); return true; };
    sim.run = function () { while (sim.step()); return sim; };
    // 닮은 정도가 처음으로 th 이상이 된 점 수 (기록 기준, 없으면 null)
    sim.reach = function (th) { for (const [n, c] of sim.hist) if (c >= th) return n; return null; };
    return sim;
  }

  return { G, DEFAULTS, create, picture, blur, blurredPic, corr, mulberry32 };
});
