// 해바라기 씨 배열 검증.  사용법: node tools/validate-sunflower.js
const S = require('../site/experiments/sunflower/sim.js');
console.log('황금각', S.GOLDEN.toFixed(4), '°');
for (const n of [300, 600, 1000]) {
  console.log(`씨앗 ${n}개: 빈틈 평균 / 가장 큰 빈틈 (이상 간격 대비, 작을수록 고름)`);
  for (const a of [90, 120, 137, 137.3, 137.508, 137.7, 138, 144, 150, 180]) { const m = S.metrics(n, a); console.log(`  ${String(a).padStart(7)}°  평균 ${m.gap.toFixed(3)}  최대 ${m.maxGap.toFixed(3)}`); }
}
const g = S.metrics(1000, S.GOLDEN, true);
console.log('황금각 1000개: 가장 가까운 이웃 거리 평균', g.nnMean.toFixed(3), 'CV', g.nnCV.toFixed(3), '번호 차이 상위', JSON.stringify(g.topDiffs));
for (const a of [137, 138, 144]) { const m = S.metrics(1000, a, true); console.log(`${a}°: nn 평균 ${m.nnMean.toFixed(3)} CV ${m.nnCV.toFixed(3)} 번호 차이 상위`, JSON.stringify(m.topDiffs)); }
const t0 = Date.now(); S.sweep(1000, 90, 180, 0.5); console.log('스윕(181점, 1000개) 시간 ms:', Date.now() - t0);
