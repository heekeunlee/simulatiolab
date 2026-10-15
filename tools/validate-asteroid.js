// 소행성 궤도 밀기 검증.  사용법: node tools/validate-asteroid.js
// 페이지 문구의 숫자는 이 출력과 같아야 한다. 판 1(기본 소행성)은 손으로 고른 궤도, 판 2~는 시드로 뽑은 궤도. 무작위 요소는 궤도 모양뿐이다.
const A = require('../site/experiments/asteroid/sim.js');
const C = A.C, L = A.LEADS, f2 = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3));
const med = (a) => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };

// [0] 적분이 건전한가
{ const o = A.orbitFor(1), S = A.baseTrack(o), E0 = A.energy(Array.from(S.subarray(0, 6)));
  let worst = 0; for (let k = 0; k <= A.NN; k += 40) worst = Math.max(worst, Math.abs(A.energy(Array.from(S.subarray(k * 6, k * 6 + 6))) / E0 - 1));
  const s0 = A.encounterState(o), vv = Math.hypot(s0[3], s0[4], s0[5]) ** 2, vis = C.MU * (2 / 1 - 1 / o.a);
  // 거꾸로 만든 0년 상태에서 앞으로 다시 20년 → 만나는 자리로 돌아오는가
  const s = Array.from(S.subarray(0, 6)); for (let k = 0; k < A.NT; k++) A.verlet(s, C.DT);
  const back = Math.hypot(s[0] - 1, s[1], s[2]) / C.RE;
  console.log('[0] 적분 점검 (속도 베를레, 한 걸음 1/4000년)');
  console.log(`    기본 소행성 궤도: 긴반지름 ${o.a}, 이심률 ${o.e}, 기울기 ${o.inc}°, 한 바퀴 ${Math.pow(o.a, 1.5).toFixed(2)}년, 태양에 가장 가까이 ${(o.a * (1 - o.e)).toFixed(2)} · 가장 멀리 ${(o.a * (1 + o.e)).toFixed(2)}`);
  console.log(`    에너지 상대 오차(20년 동안 최대): ${worst.toExponential(1)} · 만나는 순간 속도²와 활력 방정식의 차: ${Math.abs(vv / vis - 1).toExponential(1)}`);
  console.log(`    거꾸로 20년 → 다시 앞으로 20년 돌아온 자리의 어긋남: 지구 반지름의 ${back.toExponential(1)}배 · 밀지 않으면 최접근 ${A.pushedTrack(S, 10, 0, 'along', false).miss.toExponential(1)}`); }

// [1] 기본 판
const s1 = A.create(A.DEFAULTS);
console.log(`\n[1] 기본 판 (리드 10년, 1 cm/s, 진행 방향): 비껴간 거리 지구 반지름의 ${f2(s1.miss)}배 · 두 길 사이 최대 ${f2(s1.maxSep)} · 지구에 대한 상대 속도 ${s1.vrelKms.toFixed(1)} km/s`);

// [2] 리드 타임 × 세기 표 (진행 방향, 기본 소행성)
console.log('\n[2] 비껴간 거리 (지구 반지름) — 행: 세기 cm/s, 열: 리드 타임(년) ' + L.join(' / '));
const S1 = A.baseTrack(A.orbitFor(1)), grid = {};
for (const dv of [0.1, 1, 10, 100]) { grid[dv] = L.map((Ld) => A.pushedTrack(S1, Ld, dv, 'along', false).miss); console.log(`    ${String(dv).padStart(5)}  ` + grid[dv].map(f2).join('  ')); }

// [3] 필요한 세기 (지구 반지름 2개 이상 비껴가려면, 1 cm/s 결과로 나눔)
const sw = A.sweep(1, [1, 10, 100]);
console.log('\n[3] 비껴가는 데 필요한 세기 (cm/s) — 리드 타임 ' + L.join(' / '));
for (const d of ['along', 'radial', 'normal']) console.log(`    ${d.padEnd(7)} ` + sw.need[d].map(f2).join('  '));
const i = (y) => L.indexOf(y);
console.log(`    → 진행 방향: 10년 전 ${f2(sw.need.along[i(10)])} · 1년 전 ${f2(sw.need.along[i(1)])} · 0.1년 전 ${f2(sw.need.along[i(0.1)])} cm/s (10년 전 대비 1년 전 ${(sw.need.along[i(1)] / sw.need.along[i(10)]).toFixed(0)}배, 0.1년 전 ${(sw.need.along[i(0.1)] / sw.need.along[i(10)]).toFixed(0)}배)`);
console.log(`    → 앱의 집계와 같은가: 1cm/s·10년 ${f2(sw.miss[1][i(10)])} = ${f2(grid[1][i(10)])}, 10cm/s·1년 ${f2(sw.miss[10][i(1)])}, 100cm/s·0.1년 ${f2(sw.miss[100][i(0.1)])}`);

// [4] 정비례 점검: 세기를 2배로 하면 거리도 2배인가, 필요한 세기로 밀면 정말 2가 되는가
{ let worst = 0, worstNeed = 0;
  for (const d of ['along', 'radial', 'normal']) for (const Ld of L) {
    const m1 = A.pushedTrack(S1, Ld, 1, d, false).miss, m2 = A.pushedTrack(S1, Ld, 2, d, false).miss; worst = Math.max(worst, Math.abs(m2 / m1 / 2 - 1));
    const nd = C.SAFE / m1; if (nd <= 100) worstNeed = Math.max(worstNeed, Math.abs(A.pushedTrack(S1, Ld, nd, d, false).miss / C.SAFE - 1));
  }
  console.log(`\n[4] 정비례 점검: 1→2 cm/s일 때 거리 비율이 2에서 벗어난 최대 ${(worst * 100).toFixed(2)}% · 필요한 세기(100 cm/s 이하)로 밀었을 때 2에서 벗어난 최대 ${(worstNeed * 100).toFixed(2)}%`); }

// [5] 이론값과 비교: 진행 방향으로 밀면 궤도 크기가 조금 바뀌어 한 바퀴 시간이 달라지고, 그 차이가 바퀴마다 쌓인다
//     늦어지는(빨라지는) 시간 δt ≈ 3 · L · a · v · Δv / μ (v = 미는 순간 속력),  어긋남 = v_소행성·δt 중 상대 속도에 수직인 성분
{ const o = A.orbitFor(1), e = A.encounterState(o), va = [e[3], e[4], e[5]], vr = [e[3], e[4] - 2 * Math.PI, e[5]], un = Math.hypot(...vr), u = vr.map((x) => x / un);
  console.log('\n[5] 이론(바퀴마다 쌓이는 시간차) 대 시뮬레이션, 진행 방향 1 cm/s');
  for (const Ld of [2, 5, 10, 20]) {
    const k0 = A.NT - Math.round(Ld / C.DT), s = S1.subarray(k0 * 6, k0 * 6 + 6), v = Math.hypot(s[3], s[4], s[5]);
    const dt = (3 * Ld * o.a * v * A.cms(1)) / C.MU, d = va.map((x) => x * dt), dp = d.reduce((a, x, j) => a + x * u[j], 0), perp = Math.hypot(...d.map((x, j) => x - dp * u[j])) / C.RE;
    const sim = A.pushedTrack(S1, Ld, 1, 'along', false).miss;
    console.log(`    리드 ${String(Ld).padStart(2)}년: 이론 ${f2(perp)} · 시뮬레이션 ${f2(sim)} (차 ${((sim / perp - 1) * 100).toFixed(0)}%)`);
  } }

// [6] 다른 궤도 20개(판 1~20)에서도 '일찍 조금 ↔ 늦게 많이'가 성립하는가
{ const n1 = [], n10 = [], n01 = [], r05 = [], a05 = [], rad10 = [];
  for (let seed = 1; seed <= 20; seed++) { const w = A.sweep(seed, [1]); n1.push(w.need.along[i(1)]); n10.push(w.need.along[i(10)]); n01.push(w.need.along[i(0.1)]); r05.push(w.need.radial[i(0.5)]); a05.push(w.need.along[i(0.5)]); rad10.push(w.need.radial[i(10)] / w.need.along[i(10)]); }
  const better = n10.filter((v, k) => v < n1[k]).length, radBetter = r05.filter((v, k) => v < a05[k]).length;
  console.log('\n[6] 판 1~20 (서로 다른 궤도)에서 진행 방향으로 비껴가는 데 필요한 세기의 중앙값');
  console.log(`    10년 전 ${f2(med(n10))} · 1년 전 ${f2(med(n1))} · 0.1년 전 ${f2(med(n01))} cm/s · 10년 전이 1년 전보다 적게 든 판 ${better}/20 · 범위: 10년 전 ${f2(Math.min(...n10))}~${f2(Math.max(...n10))}, 1년 전 ${f2(Math.min(...n1))}~${f2(Math.max(...n1))}`);
  console.log(`    0.5년 전에는 옆으로(태양 쪽) 미는 쪽이 적게 든 판 ${radBetter}/20 · 10년 전에 옆으로 밀면 진행 방향보다 중앙값 ${med(rad10).toFixed(0)}배 더 세게 밀어야 함`); }
