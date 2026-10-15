// 우주 거미줄: 입자-격자(PM) 중력 장난감 모델. 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32), 고정 dt.
// 한 변 32칸인 주기 상자(오른쪽으로 나가면 왼쪽으로 들어옴) 안에 먼지 알갱이 32×32×32 = 32,768개가 거의 고르게 놓인다.
// 처음 요철: 가우스 무작위 장(요철의 결 = 파장별 세기 P(k) ∝ k^n)으로 젤도비치 근사처럼 알갱이를 살짝 옮기고, 자라는 쪽 속도를 준다.
// 중력: 알갱이를 격자에 나눠 담고(CIC) 푸아송 방정식 ∇²φ = G·δ 를 FFT로 풀어 힘을 구한다(공동 좌표, 상자는 고정).
// 팽창은 "서로 멀어지게 하는 브레이크" 하나로만 단순화했다: dv/dt = −∇φ − H·v (H = 팽창 속도).
// 적분: 끌림을 앞뒤로 나눈 kick-drift-kick 립프로그(H = 0이면 심플렉틱). 모든 상수는 이 프로젝트의 무차원 설정이다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CosmicWeb = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const C = {
    NG: 32,                 // 격자 한 변 칸 수 = 상자 한 변 길이 (알갱이 사이 평균 간격 = 1)
    G: 1,                   // 중력 세기 (∇²φ = G·δ)
    H0: 1,                  // 팽창 속도 100%일 때의 브레이크 세기
    DT: 0.04,               // 한 걸음 시간
    KC: 0.5,                // 처음 요철에서 격자 크기 잔물결을 지우는 거름 (k/π 기준)
    GRAIN: { big: -2.5, mix: -1.5, small: 0 },   // 요철의 결: 큰 물결 위주 / 섞임 / 잔물결 위주 (P(k) ∝ k^n 의 n)
    VOID: 0.2,              // 빈 공간: 2×2×2칸을 묶은 덩이의 밀도가 평균의 이 배보다 낮으면
    DENSE: 10,              // 덩어리: 칸 밀도가 평균의 이 배를 넘는 칸들이 이어진 무리
    MINC: 20,               // 이만큼 이상 알갱이가 모인 무리만 덩어리로 센다
    SAMPLE: 5,              // 지표 기록 간격 (걸음)
  };
  const DEFAULTS = { amp: 2, grain: 'mix', expand: 100, seed: 1, steps: 240 };

  // ---------- 3D FFT (n = 32, 제자리, 실수부/허수부 배열) ----------
  function makeFFT(n) {
    const lg = Math.log2(n), rev = new Int32Array(n), cs = new Float64Array(n / 2), sn = new Float64Array(n / 2);
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < lg; b++) r |= ((i >> b) & 1) << (lg - 1 - b); rev[i] = r; }
    for (let i = 0; i < n / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / n); sn[i] = Math.sin(2 * Math.PI * i / n); }
    const br = new Float64Array(n), bi = new Float64Array(n);
    function fft1(sign) {   // br, bi 위에서
      for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = br[i]; br[i] = br[j]; br[j] = t; t = bi[i]; bi[i] = bi[j]; bi[j] = t; } }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let s = 0; s < n; s += size) for (let k = 0; k < half; k++) {
          const wr = cs[k * step], wi = sign * sn[k * step], a = s + k, b = a + half;
          const tr = br[b] * wr - bi[b] * wi, ti = br[b] * wi + bi[b] * wr;
          br[b] = br[a] - tr; bi[b] = bi[a] - ti; br[a] += tr; bi[a] += ti;
        }
      }
    }
    // sign = -1 정변환, +1 역변환(1/n³ 포함)
    return function fft3(re, im, sign) {
      const n2 = n * n;
      for (let axis = 0; axis < 3; axis++) {
        const stride = axis === 0 ? n2 : axis === 1 ? n : 1;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          const base = axis === 0 ? a * n + b : axis === 1 ? a * n2 + b : a * n2 + b * n;
          for (let i = 0; i < n; i++) { br[i] = re[base + i * stride]; bi[i] = im[base + i * stride]; }
          fft1(sign);
          for (let i = 0; i < n; i++) { re[base + i * stride] = br[i]; im[base + i * stride] = bi[i]; }
        }
      }
      if (sign > 0) { const f = 1 / (n2 * n); for (let i = 0; i < re.length; i++) { re[i] *= f; im[i] *= f; } }
    };
  }

  function create(opt) {
    const P = Object.assign({}, DEFAULTS, opt || {});
    const NG = C.NG, NG2 = NG * NG, NC = NG2 * NG, L = NG, N = NC;
    const fft3 = makeFFT(NG);
    const rnd = mulberry32((P.seed | 0) * 7919 + 101);
    const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    const H = (P.expand / 100) * C.H0, nIdx = C.GRAIN[P.grain] != null ? C.GRAIN[P.grain] : C.GRAIN.mix;
    const S_LIN = (-H + Math.sqrt(H * H + 4 * C.G)) / 2;   // 작은 요철이 자라는 빠르기(선형 이론): δ ∝ e^(s·t)
    const kv = new Float64Array(NG); for (let i = 0; i < NG; i++) kv[i] = 2 * Math.PI * (i <= NG / 2 ? i : i - NG) / NG;
    const re = new Float64Array(NC), im = new Float64Array(NC);
    // 처음 요철: 흰 잡음 → 파장별 세기 곱하기 → 밀도 δ, 그리고 δ = −∇·ψ 인 옮김 ψ
    for (let c = 0; c < NC; c++) { re[c] = gauss(); im[c] = 0; }
    fft3(re, im, -1);
    const kc = C.KC * Math.PI;
    for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let d = 0; d < NG; d++) {
      const c = (a * NG + b) * NG + d, k2 = kv[a] * kv[a] + kv[b] * kv[b] + kv[d] * kv[d];
      const f = k2 === 0 ? 0 : Math.pow(k2, nIdx / 4) * Math.exp(-k2 / (kc * kc) / 2);
      re[c] *= f; im[c] *= f;
    }
    const dk = [new Float64Array(re), new Float64Array(im)];
    const psi = [];
    for (let ax = 0; ax < 3; ax++) {
      const r2 = new Float64Array(NC), i2 = new Float64Array(NC);
      for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let d = 0; d < NG; d++) {
        const c = (a * NG + b) * NG + d, k2 = kv[a] * kv[a] + kv[b] * kv[b] + kv[d] * kv[d];
        if (k2 === 0) continue;
        const kk = (ax === 0 ? kv[a] : ax === 1 ? kv[b] : kv[d]) / k2;   // ψ_k = i k δ_k / k²
        r2[c] = -kk * dk[1][c]; i2[c] = kk * dk[0][c];
      }
      fft3(r2, i2, 1); psi.push(r2);
    }
    { const r2 = dk[0], i2 = dk[1]; fft3(r2, i2, 1); }
    if (P.wave) {   // (검증용) 상자 길이 파장 하나짜리 물결: ψx = sin(2πx/L)·L/2π, δ = −cos(2πx/L)
      for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let d = 0; d < NG; d++) {
        const c = (a * NG + b) * NG + d, th = 2 * Math.PI * (a + 0.5) / L;
        psi[0][c] = Math.sin(th) * L / (2 * Math.PI); psi[1][c] = 0; psi[2][c] = 0; dk[0][c] = -Math.cos(th);
      }
    }
    let s2 = 0; for (let c = 0; c < NC; c++) s2 += dk[0][c] * dk[0][c];
    const scale = (P.amp / 100) / Math.sqrt(s2 / NC);   // 처음 밀도 요철의 크기(표준편차)를 amp%로 맞춘다

    const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
    const ox = new Float32Array(N), oy = new Float32Array(N), oz = new Float32Array(N);
    const vx = new Float64Array(N), vy = new Float64Array(N), vz = new Float64Array(N);
    const gx = new Float64Array(N), gy = new Float64Array(N), gz = new Float64Array(N);
    const dens = new Float32Array(N);   // 알갱이 자리의 밀도 (그림 색용)
    const wrap = (v) => (v < 0 ? v + L : v >= L ? v - L : v);
    for (let a = 0, i = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let d = 0; d < NG; d++, i++) {
      const c = i, dx = psi[0][c] * scale, dy = psi[1][c] * scale, dz = psi[2][c] * scale;
      px[i] = wrap(a + 0.5 + dx); py[i] = wrap(b + 0.5 + dy); pz[i] = wrap(d + 0.5 + dz);
      vx[i] = S_LIN * dx; vy[i] = S_LIN * dy; vz[i] = S_LIN * dz;   // 자라는 쪽(성장 모드) 속도
    }
    ox.set(px); oy.set(py); oz.set(pz);

    // ---------- 중력 ----------
    const rho = new Float64Array(NC), phi = new Float64Array(NC), fr = new Float64Array(NC), fi = new Float64Array(NC);
    const fgx = new Float64Array(NC), fgy = new Float64Array(NC), fgz = new Float64Array(NC);
    const green = new Float64Array(NC);   // −G / k_eff² (이산 라플라시안)
    for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let d = 0; d < NG; d++) {
      const c = (a * NG + b) * NG + d;
      const k2 = 4 * (Math.sin(kv[a] / 2) ** 2 + Math.sin(kv[b] / 2) ** 2 + Math.sin(kv[d] / 2) ** 2);
      green[c] = k2 === 0 ? 0 : -C.G / k2;
    }
    // CIC: 알갱이 하나를 둘레 8칸에 나눠 담는다 (칸 가운데 = 정수 + 0.5). 칸 번호와 무게는 한 번 구해 담기·읽기에 같이 쓴다
    const ia = new Int32Array(N * 2), ib = new Int32Array(N * 2), id = new Int32Array(N * 2), fa = new Float64Array(N), fb = new Float64Array(N), fd = new Float64Array(N);
    function locate() {
      for (let i = 0; i < N; i++) {
        let u = px[i] - 0.5, k = Math.floor(u); fa[i] = u - k; ia[2 * i] = (k + NG) % NG; ia[2 * i + 1] = (k + 1 + NG) % NG;
        u = py[i] - 0.5; k = Math.floor(u); fb[i] = u - k; ib[2 * i] = (k + NG) % NG; ib[2 * i + 1] = (k + 1 + NG) % NG;
        u = pz[i] - 0.5; k = Math.floor(u); fd[i] = u - k; id[2 * i] = (k + NG) % NG; id[2 * i + 1] = (k + 1 + NG) % NG;
      }
    }
    const cc = new Int32Array(8), ww = new Float64Array(8);
    function corners(i) {
      const a0 = ia[2 * i] * NG2, a1 = ia[2 * i + 1] * NG2, b0 = ib[2 * i] * NG, b1 = ib[2 * i + 1] * NG, d0 = id[2 * i], d1 = id[2 * i + 1];
      const x1 = fa[i], x0 = 1 - x1, y1 = fb[i], y0 = 1 - y1, z1 = fd[i], z0 = 1 - z1;
      cc[0] = a0 + b0 + d0; ww[0] = x0 * y0 * z0; cc[1] = a0 + b0 + d1; ww[1] = x0 * y0 * z1;
      cc[2] = a0 + b1 + d0; ww[2] = x0 * y1 * z0; cc[3] = a0 + b1 + d1; ww[3] = x0 * y1 * z1;
      cc[4] = a1 + b0 + d0; ww[4] = x1 * y0 * z0; cc[5] = a1 + b0 + d1; ww[5] = x1 * y0 * z1;
      cc[6] = a1 + b1 + d0; ww[6] = x1 * y1 * z0; cc[7] = a1 + b1 + d1; ww[7] = x1 * y1 * z1;
    }
    function forces() {
      locate(); rho.fill(0);
      for (let i = 0; i < N; i++) { corners(i); for (let k = 0; k < 8; k++) rho[cc[k]] += ww[k]; }
      for (let c = 0; c < NC; c++) { fr[c] = rho[c] - 1; fi[c] = 0; }   // 평균 밀도 = 칸당 1
      fft3(fr, fi, -1);
      for (let c = 0; c < NC; c++) { fr[c] *= green[c]; fi[c] *= green[c]; }
      fft3(fr, fi, 1); phi.set(fr);
      for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let d = 0; d < NG; d++) {
        const c = (a * NG + b) * NG + d, ap = (a + 1) % NG, am = (a + NG - 1) % NG, bp = (b + 1) % NG, bm = (b + NG - 1) % NG, dp = (d + 1) % NG, dm = (d + NG - 1) % NG;
        fgx[c] = -(phi[(ap * NG + b) * NG + d] - phi[(am * NG + b) * NG + d]) / 2;
        fgy[c] = -(phi[(a * NG + bp) * NG + d] - phi[(a * NG + bm) * NG + d]) / 2;
        fgz[c] = -(phi[(a * NG + b) * NG + dp] - phi[(a * NG + b) * NG + dm]) / 2;
      }
      for (let i = 0; i < N; i++) {
        corners(i); let x = 0, y = 0, z = 0, r = 0;
        for (let k = 0; k < 8; k++) { const c = cc[k], w = ww[k]; x += fgx[c] * w; y += fgy[c] * w; z += fgz[c] * w; r += rho[c] * w; }
        gx[i] = x; gy[i] = y; gz[i] = z; dens[i] = r;
      }
    }

    const S = { params: P, n: N, L, px, py, pz, ox, oy, oz, dens, t: 0, done: false, sLin: S_LIN, H, last: null, hist: { t: [], void: [], big: [], rms: [], clumps: [] }, C };
    const drag = Math.exp(-H * C.DT / 2), hdt = C.DT / 2;
    function step() {
      if (S.t >= P.steps) { S.done = true; return false; }
      ox.set(px); oy.set(py); oz.set(pz);
      for (let i = 0; i < N; i++) {
        vx[i] = vx[i] * drag + gx[i] * hdt; vy[i] = vy[i] * drag + gy[i] * hdt; vz[i] = vz[i] * drag + gz[i] * hdt;
        px[i] = wrap(px[i] + vx[i] * C.DT); py[i] = wrap(py[i] + vy[i] * C.DT); pz[i] = wrap(pz[i] + vz[i] * C.DT);
      }
      forces();
      for (let i = 0; i < N; i++) {
        vx[i] = (vx[i] + gx[i] * hdt) * drag; vy[i] = (vy[i] + gy[i] * hdt) * drag; vz[i] = (vz[i] + gz[i] * hdt) * drag;
      }
      S.t++;
      if (S.t % C.SAMPLE === 0) record();
      if (S.t >= P.steps) S.done = true;
      return true;
    }

    // ---------- 지표 ----------
    const NB = NG / 2, coarse = new Float64Array(NB * NB * NB);
    function voidFrac() {   // 2×2×2칸 덩이 밀도가 평균의 VOID배 미만인 덩이 비율
      coarse.fill(0);
      for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let d = 0; d < NG; d++) coarse[((a >> 1) * NB + (b >> 1)) * NB + (d >> 1)] += rho[(a * NG + b) * NG + d] / 8;
      let v = 0; for (let c = 0; c < coarse.length; c++) if (coarse[c] < C.VOID) v++;
      return v / coarse.length;
    }
    function rmsDelta() { let s = 0; for (let c = 0; c < NC; c++) s += (rho[c] - 1) ** 2; return Math.sqrt(s / NC); }
    // 덩어리: 평균의 DENSE배 넘게 빽빽한 칸들이 면으로 이어진 무리 (상자는 주기적). 무리의 질량 = 그 칸들에 담긴 알갱이 양
    const lab = new Int32Array(NC), stack = new Int32Array(NC);
    function clumps() {
      lab.fill(0); let big = 0, cnt = 0, inC = 0, id = 0;
      for (let c0 = 0; c0 < NC; c0++) {
        if (lab[c0] || rho[c0] <= C.DENSE) continue;
        id++; let sp = 0, m = 0; stack[sp++] = c0; lab[c0] = id;
        while (sp) {
          const c = stack[--sp]; m += rho[c];
          const a = (c / NG2) | 0, b = ((c / NG) | 0) % NG, d = c % NG;
          const nb = [((a + 1) % NG) * NG2 + b * NG + d, ((a + NG - 1) % NG) * NG2 + b * NG + d, a * NG2 + ((b + 1) % NG) * NG + d, a * NG2 + ((b + NG - 1) % NG) * NG + d, a * NG2 + b * NG + (d + 1) % NG, a * NG2 + b * NG + (d + NG - 1) % NG];
          for (let k = 0; k < 6; k++) { const e = nb[k]; if (!lab[e] && rho[e] > C.DENSE) { lab[e] = id; stack[sp++] = e; } }
        }
        if (m > big) big = m; if (m >= C.MINC) { cnt++; inC += m; }
      }
      return { big: big / N, clumps: cnt, inClumps: inC / N };
    }
    function measure() {
      const f = clumps();
      return { t: S.t, time: S.t * C.DT, void: voidFrac(), big: f.big, clumps: f.clumps, inClumps: f.inClumps, rms: rmsDelta() };
    }
    function record() {
      const m = measure(); S.last = m;
      S.hist.t.push(m.t); S.hist.void.push(m.void); S.hist.big.push(m.big); S.hist.rms.push(m.rms); S.hist.clumps.push(m.clumps);
    }
    // 칸별 밀도 분포 (그래프용): 2×2×2 덩이 밀도의 로그 히스토그램
    function densityHist(bins, lo, hi) {
      const h = new Float64Array(bins);
      for (let c = 0; c < coarse.length; c++) { const v = Math.log10(Math.max(1e-3, coarse[c])); const k = Math.floor((v - lo) / (hi - lo) * bins); h[Math.max(0, Math.min(bins - 1, k))]++; }
      for (let k = 0; k < bins; k++) h[k] /= coarse.length;
      return h;
    }
    // 에너지(검증용): 운동 + 위치 에너지 W = ½ Σ φ·δ (칸 단위)
    function energy() {
      let K = 0; for (let i = 0; i < N; i++) K += 0.5 * (vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
      let W = 0; for (let c = 0; c < NC; c++) W += 0.5 * phi[c] * (rho[c] - 1);
      return { K, W, E: K + W };
    }
    function momentum() { let x = 0, y = 0, z = 0; for (let i = 0; i < N; i++) { x += vx[i]; y += vy[i]; z += vz[i]; } return [x / N, y / N, z / N]; }
    forces(); record();
    Object.assign(S, { step, measure, energy, momentum, densityHist, voidFrac });
    return S;
  }
  return { create, DEFAULTS, C };
});
