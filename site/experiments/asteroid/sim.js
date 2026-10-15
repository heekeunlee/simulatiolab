// 소행성 궤도 밀기: 태양 중심 2체(태양 + 소행성) + 원 궤도를 도는 가상의 지구. 브라우저/Node 공용(UMD), DOM 없음, 시드 난수(mulberry32).
// 단위: 길이 = 지구 궤도 반지름(1), 시간 = 1년, 태양 중력 상수 MU = 4π² (그러면 지구가 1년에 한 바퀴). 지구의 중력은 넣지 않는다.
// 소행성은 T(=20)년에 지구와 정확히 같은 자리(1,0,0)에 오도록 만든다: 그 자리의 상태에서 거꾸로(-dt) 적분해 20년 전 상태를 얻는다.
// 적분: 속도 베를레(velocity Verlet, 시간 대칭) → 같은 dt로 앞으로 돌리면 반올림 오차 수준으로 같은 길을 되밟는다.
// 밀기: 지구와 만나기 L년 전에 소행성 속도를 dv(cm/s)만큼 바꾼다(진행 방향 / 옆으로(태양 쪽) / 위로(궤도면 밖)). 그 뒤 지구에 가장 가까이 온 거리를 잰다.
// 화면 단위 환산(예시): 지구 궤도 반지름 = 지구 반지름 23,481개, 지구 공전 속도(2π) = 29.78 km/s.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Asteroid = factory();
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
  const TAU = Math.PI * 2;
  const C = {
    MU: TAU * TAU,         // 태양 중력 상수 (길이 1, 시간 1년)
    T: 20,                 // 소행성이 (밀지 않으면) 지구와 만나는 때 (년): 리드 타임은 최대 20년
    DT: 1 / 4000,          // 적분 한 걸음 (년, 약 2.2시간)
    W: 0.05,               // 만나는 때 앞뒤로 최접근을 찾는 창 (년)
    RE: 1 / 23481,         // 지구 반지름 (지구 궤도 반지름 단위)
    VKMS: 29.78,           // 지구 공전 속도 2π가 몇 km/s인지 (환산용)
    SAFE: 2,               // 이 모델이 정한 '비껴감' 기준: 지구 반지름 2개 이상 떨어져 지나감
    SHOW: 1 / 400,         // 재생 한 칸 = 약 0.9일
    SLOWK: 60,             // 지구에 다가갈수록 재생을 늦춘다: 한 칸 = (지구까지 거리 / 상대 속도) / SLOWK
    CORE: 300,             // 지구 곁 확대 화면을 가로지르는 데 쓰는 칸 수 (가장 느린 재생)
    PRE: 0.25,             // 미는 순간 조금 전부터 재생 (년)
  };
  const LEADS = [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 20];      // 리드 타임 (년) 슬라이더 칸
  const DVS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];   // 밀기 세기 (cm/s) 슬라이더 칸
  const DEFAULTS = { seed: 1, lead: 10, dv: 1, dir: 'along' };
  const cms = (v) => (v * 1e-5 / C.VKMS) * TAU;              // cm/s → 모델 속도(길이/년)
  const toRE = (d) => d / C.RE;                               // 모델 길이 → 지구 반지름

  // 소행성 궤도 모양 (판마다): 긴반지름 a, 이심률 e, 기울기 inc, 만날 때 태양 쪽으로 들어오는 중인지(in)
  function orbitFor(seed) {
    if (seed === 1) return { a: 1.4, e: 0.4, inc: 6, inbound: true };
    const r = mulberry32(seed * 7919 + 13);
    const a = 1.1 + r() * 0.8, emin = Math.max(0.15, 1 - 1 / a + 0.08), e = emin + r() * (0.6 - emin);
    return { a: +a.toFixed(3), e: +e.toFixed(3), inc: +(2 + r() * 12).toFixed(1), inbound: r() < 0.5 };
  }
  // 만나는 순간의 상태: 위치 (1,0,0), 궤도면은 x축(교점)을 지나며 inc만큼 기운다
  function encounterState(o) {
    const p = o.a * (1 - o.e * o.e), cf = (p - 1) / o.e, sf = (o.inbound ? -1 : 1) * Math.sqrt(Math.max(0, 1 - cf * cf));
    const vr = Math.sqrt(C.MU / p) * o.e * sf, vt = Math.sqrt(C.MU * p), i = (o.inc * Math.PI) / 180;
    return [1, 0, 0, vr, vt * Math.cos(i), vt * Math.sin(i)];
  }
  // 속도 베를레 한 걸음 (s = [x,y,z,vx,vy,vz], 제자리에서 바꾼다)
  function acc(x, y, z) { const r2 = x * x + y * y + z * z, f = -C.MU / (r2 * Math.sqrt(r2)); return [f * x, f * y, f * z]; }
  function verlet(s, dt) {
    let a = acc(s[0], s[1], s[2]);
    s[3] += 0.5 * dt * a[0]; s[4] += 0.5 * dt * a[1]; s[5] += 0.5 * dt * a[2];
    s[0] += dt * s[3]; s[1] += dt * s[4]; s[2] += dt * s[5];
    a = acc(s[0], s[1], s[2]);
    s[3] += 0.5 * dt * a[0]; s[4] += 0.5 * dt * a[1]; s[5] += 0.5 * dt * a[2];
  }
  const energy = (s) => 0.5 * (s[3] * s[3] + s[4] * s[4] + s[5] * s[5]) - C.MU / Math.hypot(s[0], s[1], s[2]);
  const earth = (t) => { const th = TAU * (t - C.T); return [Math.cos(th), Math.sin(th), 0]; };

  // 밀지 않은 기준 궤도: 0~T+W 년, 걸음마다 상태 저장
  const NT = Math.round(C.T / C.DT), NW = Math.round(C.W / C.DT), NN = NT + NW;
  function baseTrack(o) {
    const S = new Float64Array((NN + 1) * 6), s = encounterState(o);
    S.set(s, NT * 6);
    const b = s.slice(); for (let k = NT - 1; k >= 0; k--) { verlet(b, -C.DT); S.set(b, k * 6); }
    const f = s.slice(); for (let k = NT + 1; k <= NN; k++) { verlet(f, C.DT); S.set(f, k * 6); }
    return S;
  }
  // 밀기 방향 단위 벡터: along = 속도 방향, radial = 궤도면 안에서 속도에 수직(태양 쪽), normal = 궤도면에 수직
  function pushDir(s, dir) {
    const v = [s[3], s[4], s[5]], vn = Math.hypot(...v), u = v.map((x) => x / vn);
    const r = [s[0], s[1], s[2]], h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]], hn = Math.hypot(...h), nrm = h.map((x) => x / hn);
    if (dir === 'normal') return nrm;
    if (dir === 'radial') { const w = [nrm[1] * u[2] - nrm[2] * u[1], nrm[2] * u[0] - nrm[0] * u[2], nrm[0] * u[1] - nrm[1] * u[0]]; return w; }   // n × u: 속도에서 왼쪽 90° = 태양 쪽
    return u;
  }
  // 민 궤도: 리드 L년 전(걸음 k0)에 속도를 바꾸고 T+W까지 적분. store면 상태를 모두 저장
  function pushedTrack(S, lead, dv, dir, store) {
    const k0 = NT - Math.round(lead / C.DT), s = Array.from(S.subarray(k0 * 6, k0 * 6 + 6)), d = pushDir(s, dir), q = cms(dv);
    s[3] += q * d[0]; s[4] += q * d[1]; s[5] += q * d[2];
    const P = store ? new Float64Array((NN + 1) * 6) : null;
    if (P) { P.set(S.subarray(0, (k0 + 1) * 6)); P.set(s, k0 * 6); }
    const lo = NT - NW; let best = Infinity, bk = -1; const keep = [];   // 창 안의 상태만 따로 (최접근 다듬기용)
    for (let k = k0; k <= NN; k++) {
      if (k > k0) verlet(s, C.DT);
      if (P) P.set(s, k * 6);
      if (k >= lo) { keep[k - lo] = s.slice(); const e = earth(k * C.DT), dd = Math.hypot(s[0] - e[0], s[1] - e[1], s[2] - e[2]); if (dd < best) { best = dd; bk = k; } }
    }
    // 최접근 다듬기: 가장 가까운 걸음 앞뒤 한 칸을 3차 에르미트 보간 + 황금분할 탐색
    const get = (k) => keep[k - lo];
    const at = (t) => { const k = Math.min(NN - 1, Math.max(lo, Math.floor(t / C.DT))); return hermite(get(k), get(k + 1), t / C.DT - k); };
    const dist = (t) => { const p = at(t), e = earth(t); return Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]); };
    let a = Math.max(lo, bk - 1) * C.DT, b = Math.min(NN, bk + 1) * C.DT; const g = (Math.sqrt(5) - 1) / 2;
    let c1 = b - g * (b - a), c2 = a + g * (b - a), f1 = dist(c1), f2 = dist(c2);
    for (let i = 0; i < 80; i++) { if (f1 < f2) { b = c2; c2 = c1; f2 = f1; c1 = b - g * (b - a); f1 = dist(c1); } else { a = c1; c1 = c2; f1 = f2; c2 = a + g * (b - a); f2 = dist(c2); } }
    const tm = (a + b) / 2, md = Math.min(best, dist(tm));
    return { miss: toRE(md), tMiss: tm, P, k0, end: s };
  }
  // 두 걸음 상태(a, b) 사이 위치를 3차 에르미트 보간 (u = 0~1)
  function hermite(A, B, u) {
    const h = C.DT, u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return [0, 1, 2].map((i) => h00 * A[i] + h10 * h * A[i + 3] + h01 * B[i] + h11 * h * B[i + 3]);
  }

  // 한 판: 재생은 밀기 조금 전부터 만나는 때 조금 뒤까지
  function create(p0) {
    const p = Object.assign({}, DEFAULTS, p0), o = orbitFor(p.seed), S = baseTrack(o);
    const R = pushedTrack(S, p.lead, p.dv, p.dir, true), P = R.P;
    const tPush = C.T - p.lead, t0 = Math.max(0, tPush - C.PRE);
    const posAt = (A, t) => { const k = Math.min(NN - 1, Math.max(0, Math.floor(t / C.DT))); return hermite(A.subarray(k * 6, k * 6 + 6), A.subarray((k + 1) * 6, (k + 1) * 6 + 6), t / C.DT - k); };
    // 두 소행성(밀기 전 길 / 민 길) 사이 거리의 최댓값 (그래프 축 고정용)
    let maxSep = 0; for (let k = R.k0; k <= NT; k += 4) { const i = k * 6; maxSep = Math.max(maxSep, Math.hypot(P[i] - S[i], P[i + 1] - S[i + 1], P[i + 2] - S[i + 2])); }
    // 지구에 대한 상대 속도(만나는 때), 지구 곁 확대 화면 반지름(지구 반지름 단위)과 그 화면을 가로지르는 시간
    const ie = NT * 6, vrel = Math.hypot(S[ie + 3], S[ie + 4] - TAU, S[ie + 5]);
    const view = Math.max(6, 2.6 * R.miss), passTime = (2 * view * C.RE) / vrel, hcore = passTime / C.CORE;
    const sim = {
      params: p, orbit: o, base: S, pushed: P, tPush, t0, t1: R.tMiss + passTime * 1.2, t: t0, done: false,
      miss: R.miss, tMiss: R.tMiss, hit: R.miss < 1, safe: R.miss >= C.SAFE, maxSep: toRE(maxSep),
      vrel, vrelKms: (vrel / TAU) * C.VKMS, view, passTime, slow: false,
      hist: [],
      ast: (t, pushed) => posAt(pushed ? P : S, t), earth,
      sep: (t) => { const a = posAt(P, t), b = posAt(S, t); return toRE(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); },
      dEarth: (t, pushed) => { const a = posAt(pushed === false ? S : P, t), e = earth(t); return toRE(Math.hypot(a[0] - e[0], a[1] - e[1], a[2] - e[2])); },
      // 재생 한 칸: 지구에 다가갈수록 천천히 (확대 화면에서 눈으로 따라갈 수 있게)
      step() {
        if (sim.done) return false;
        const d = Math.abs(sim.t - C.T) < C.W ? sim.dEarth(sim.t) * C.RE : Infinity, hh = Math.min(C.SHOW, Math.max(hcore, d / (vrel * C.SLOWK)));   // 마지막 만남 앞뒤 0.05년 안에서만 늦춘다
        sim.slow = hh < C.SHOW * 0.999;
        sim.t = Math.min(sim.t1, sim.t + hh);
        sim.record();
        if (sim.t >= sim.t1 - 1e-12) sim.done = true;
        return true;
      },
      record() { const t = sim.t; sim.hist.push([t, t >= tPush ? sim.sep(Math.min(t, C.T)) : 0]); },
      passed: () => sim.t >= sim.tMiss,       // 최접근 순간을 지났는가 (그 전에는 최종값을 보여 주지 않는다)
      phase: () => (sim.t < tPush ? 'before' : sim.slow ? 'near' : sim.t > C.T ? 'after' : 'cruise'),
      period: () => Math.pow(o.a, 1.5),
      pushVec: () => { const k = R.k0 * 6; return pushDir(Array.from(S.subarray(k, k + 6)), p.dir); },
    };
    sim.record();
    return sim;
  }

  // 집계: 리드 타임별 최접근 거리 (지금 궤도, 방향 dir, 세기 dv). 미는 세기에 거의 정비례하므로 '필요한 세기'는 1cm/s 결과로 나눠 구한다(검증 스크립트가 확인)
  function sweep(seed, dvs, dirs) {
    const S = baseTrack(orbitFor(seed)), out = { miss: {}, need: {} };
    (dvs || [0.5, 2, 10]).forEach((dv) => { out.miss[dv] = LEADS.map((L) => pushedTrack(S, L, dv, 'along', false).miss); });
    (dirs || ['along', 'radial', 'normal']).forEach((d) => { out.need[d] = LEADS.map((L) => C.SAFE / pushedTrack(S, L, 1, d, false).miss); });
    return out;
  }

  return { create, sweep, orbitFor, encounterState, baseTrack, pushedTrack, pushDir, verlet, energy, earth, hermite, cms, toRE, C, LEADS, DVS, DEFAULTS, NT, NN, mulberry32 };
});
