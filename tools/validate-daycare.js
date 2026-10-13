// 어린이집 감기 모델 검증.  사용법: node tools/validate-daycare.js
const D = require('../site/experiments/daycare/sim.js');
const f = (v, d = 1) => v.toFixed(d);
const SEEDS = 20;

// 1) 이론 대조: 한 반에 500명, 주말·계절·바깥 감염·재감염 없음 -> 균질 혼합 SIR (z = 1 - exp(-R0 z))
console.log('[이론 대조] 균질 혼합 SIR: 한 반 500명, 처음 5명 감염, 면역은 영영 풀리지 않음, 주말·계절·바깥 감염 없음');
const sirBase = { classes: 1, size: 500, init: 5, weekend: false, season: 0, eps: 0, home: 0, imm: 20000, days: 730, hyg: 0, contact: 1 };
for (const [R0t, stay] of [[0.8, 0], [1.5, 0], [2, 0], [3, 0], [2, 0.5], [3, 0.7]]) {
  const p0 = Object.assign({}, sirBase, { stay });
  const unit = R0t / (499 * D.attendDays(p0)); // 접촉 강도 1일 때 쌍당 전파확률 = unit
  const p = Object.assign({}, p0, { tauUnit: unit });
  const th = D.finalSize(D.r0(p));
  let sum = 0; for (let s = 1; s <= SEEDS; s++) { const m = D.create(Object.assign({}, p, { seed: s })).run(); sum += (m.totalInf + 5) / m.N; }
  console.log(`  R0=${f(D.r0(p), 2)} (쉬는 비율 ${stay * 100}%): 이론 최종 크기 ${f(th * 100)}%  | 시뮬 평균 ${f(sum / SEEDS * 100)}% (처음 5명 포함, 시드 ${SEEDS}개)`);
}

// 2) 기본 설정 (반 20명, 접촉 5단계, 쉬기 30%, 전파 감소 0%, 면역 30일) 결과
const base = { size: 20, contact: 5, stay: 0.3, hyg: 0, imm: 30 };
const avg = (o) => { let inf = 0, ab = 0, pk = 0, nv = 0; const dist = []; for (let s = 1; s <= SEEDS; s++) { const m = D.create(Object.assign({}, base, o, { seed: s })).run(); inf += m.meanInf(); ab += m.meanAbs(); pk += m.peakWeek(); nv += m.dist(10)[0]; } return { inf: inf / SEEDS, abs: ab / SEEDS, pk: pk / SEEDS, never: nv / SEEDS }; };
const row = (label, o) => { const r = avg(o); console.log(`  ${label}: 걸린 횟수 ${f(r.inf)} | 쉰 날 ${f(r.abs)} | 정점 ${f(r.pk, 0)}주째(평균) | 한 번도 안 걸린 비율 ${f(r.never * 100, 0)}%`); return r; };
console.log(`[기본 설정 주변, 시드 ${SEEDS}개 평균] 반 20명 / 접촉 5 / 면역 30일`);
console.log(' 아프면 쉬는 비율');
const R = {}; for (const s of [0, 0.3, 0.5, 0.7, 1]) R[s] = row(`쉬기 ${s * 100}%`, { stay: s });
console.log(`  -> 0%에서 70%로: ${f(R[0].inf)} -> ${f(R[0.7].inf)} 회 (${f((1 - R[0.7].inf / R[0].inf) * 100, 0)}% 감소), 쉰 날 ${f(R[0].abs)} -> ${f(R[0.7].abs)}`);
console.log(' 반 크기');
for (const z of [8, 10, 14, 20, 26, 30]) row(`반 ${z}명`, { size: z });
console.log(' 반 크기 x 쉬기 (0% / 70%)');
for (const z of [10, 20, 30]) { const a = avg({ size: z, stay: 0 }), b = avg({ size: z, stay: 0.7 }); console.log(`  반 ${z}명: ${f(a.inf)} -> ${f(b.inf)}`); }
console.log(' 전파 감소 (손씻기·환기)');
for (const h of [0, 0.2, 0.3, 0.4, 0.6]) row(`감소 ${h * 100}%`, { hyg: h });
console.log(' 접촉 강도');
for (const c of [2, 5, 8, 10]) row(`접촉 ${c}단계`, { contact: c });
console.log(' 면역 지속');
for (const d of [14, 30, 60, 90, 180]) row(`면역 ${d}일`, { imm: d });
console.log(' 쉬기 0% + 전파 감소 30% + 반 12명');
row('복합', { stay: 0, hyg: 0.3, size: 12 });

// 3) 재현성, 시드 1 한 번
const a = D.create({ seed: 5 }).run().sick.join(','), b = D.create({ seed: 5 }).run().sick.join(','); console.log('같은 시드 같은 결과:', a === b);
const m1 = D.create(Object.assign({}, base, { seed: 1 })).run();
console.log(`시드 1 기본 설정: 걸린 횟수 ${f(m1.meanInf())}, 쉰 날 ${f(m1.meanAbs())}, 정점 ${m1.peakWeek()}주째, 분포(0~5회+):`, m1.dist(5).map((v) => f(v * 100, 0) + '%').join(' '));
// 면역이 쌓이는 모습: 반기별 새 감염 수 (시드 20개 평균, 아이 1명당)
const q = [0, 0, 0, 0]; for (let s = 1; s <= SEEDS; s++) { const m = D.create(Object.assign({}, base, { seed: s })).run(); m.newInf.forEach((v, d) => { q[Math.min(3, Math.floor(d / 92))] += v / m.N / SEEDS; }); }
console.log('분기별 아이 1명당 새로 걸린 횟수(3~5월, 6~8월, 9~11월, 12~2월):', q.map((v) => f(v, 2)).join(' / '));
