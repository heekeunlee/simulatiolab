// 달이 없었다면 지구의 계절은(자전축 세차 + 공명 장난감 모델) 검증.  사용법: node tools/validate-moonaxis.js
// 페이지 문구와 app.js의 집계(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const M = require('../site/experiments/moonaxis/sim.js');
const D = M.DEFAULTS, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const r1 = (v) => Math.round(v * 10) / 10;
const stat = (rows) => { const r = rows.map((x) => x.range); return { mean: r1(r.reduce((a, b) => a + b, 0) / r.length), lo: r1(Math.min(...r)), hi: r1(Math.max(...r)), min: r1(Math.min(...rows.map((x) => x.min))), max: r1(Math.max(...rows.map((x) => x.max))) }; };
const many = (o) => stat(SEEDS.map((seed) => M.run(Object.assign({}, D, o, { seed }))));
console.log('기본값:', JSON.stringify(D), `· 집계: 시작 ${SEEDS.length}가지(궤도 흔들림의 처음 위상·축 방향) · 시간 단위 천 년, ${D.years}천 년 = 100만 년`);
console.log('세차 빠르기(라디안/천 년): 달 0 →', M.C.ALPHA_SUN.toFixed(4), '· 달 1 →', (M.C.ALPHA_SUN * (1 + M.C.LUNAR)).toFixed(4),
  '| 한 바퀴(23°): 달 0', Math.round(2 * Math.PI / (M.C.ALPHA_SUN * Math.cos(23 * M.DEG))), '천 년 · 달 1', Math.round(2 * Math.PI / (M.C.ALPHA_SUN * (1 + M.C.LUNAR) * Math.cos(23 * M.DEG))), '천 년');
console.log('궤도면 흔들림 한 바퀴(천 년):', M.C.G.map((g) => Math.round(2 * Math.PI / -g)).join(', '));

// [0] 기본 판(시작 #1): 달 없음 vs 지금의 달
const one = (o) => M.run(Object.assign({}, D, { seed: 1 }, o));
const a = one({ moon: 0 }), b = one({ moon: 1 });
console.log('\n[0] 시작 #1, 100만 년: 달 없음', r1(a.min), '~', r1(a.max), '° (폭', r1(a.range), ') · 지금의 달', r1(b.min), '~', r1(b.max), '° (폭', r1(b.range), ')');

// [1] 달 질량별 (집계)
const SWEEP = { moon: {}, pert: { m0: {}, m1: {} } };
console.log('\n[1] 달 질량별 흔들림 폭(최대−최소, 도): 평균 [가장 작은 판 ~ 가장 큰 판] · 전체 최소~최대 기울기');
for (let i = 0; i <= 10; i++) { const m = i / 10; const s = many({ moon: m }); SWEEP.moon[m.toFixed(1)] = s; console.log(`    달 ${m.toFixed(1)}: 폭 ${s.mean} [${s.lo} ~ ${s.hi}] · 기울기 ${s.min}° ~ ${s.max}°`); }

// [2] 섭동 세기별, 달 없음 vs 지금의 달 (집계)
console.log('\n[2] 섭동 세기별 흔들림 폭 평균: 달 없음 / 지금의 달');
for (const p of [0, 0.5, 1, 1.5, 2]) { const s0 = many({ moon: 0, pert: p }), s1 = many({ moon: 1, pert: p }); SWEEP.pert.m0[p] = s0.mean; SWEEP.pert.m1[p] = s1.mean; console.log(`    세기 ${p}: ${s0.mean} [${s0.lo}~${s0.hi}] / ${s1.mean} [${s1.lo}~${s1.hi}]`); }

// [3] 건전성: 섭동 0이면 기울기가 그대로여야 한다 / 축 길이 오차 / 적분 간격을 절반으로 줄여도 같은지
console.log('\n[3] 건전성');
const z = one({ moon: 0, pert: 0 }), z1 = one({ moon: 1, pert: 0 });
console.log('    섭동 0: 달 없음 기울기', z.min.toFixed(6), '~', z.max.toFixed(6), '· 지금의 달', z1.min.toFixed(6), '~', z1.max.toFixed(6), '(처음 23°)');
let maxErr = 0; for (const m of [0, 0.3, 1]) for (const seed of SEEDS) maxErr = Math.max(maxErr, M.run(Object.assign({}, D, { moon: m, seed })).normErr);
console.log('    천 년마다 축 길이가 1에서 벗어난 최대 오차:', maxErr.toExponential(1));
const dt0 = M.C.DT;
for (const m of [0, 1]) {
  const x = one({ moon: m }); M.C.DT = dt0 / 2; const y = one({ moon: m }); M.C.DT = dt0;
  let dmax = 0; for (let i = 0; i < x.hist.length; i++) dmax = Math.max(dmax, Math.abs(x.hist[i] - y.hist[i]));
  console.log(`    적분 간격 ${dt0} → ${dt0 / 2}천 년 (달 ${m}): 기울기 곡선 최대 차이 ${dmax.toExponential(1)}°`);
}
console.log('\nSWEEP =', JSON.stringify(SWEEP));
