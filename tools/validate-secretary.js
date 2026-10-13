// 비서 문제(최적 멈춤) 모델 검증.  사용법: node tools/validate-secretary.js
const S = require('../site/experiments/secretary/sim.js');
const f = (v, d = 1) => (v * 100).toFixed(d);
// 1) 정확한 순위 분포의 합이 1이고, 1위 확률이 닫힌 식과 같은가
let maxErr = 0, maxSum = 0;
for (const n of [5, 10, 40, 100]) for (let r = 0; r < n; r++) {
  const d = S.rankDist(n, r), sum = d.reduce((a, b) => a + b, 0);
  maxSum = Math.max(maxSum, Math.abs(sum - 1)); maxErr = Math.max(maxErr, Math.abs(d[0] - S.pBest(n, r)));
}
console.log('순위 분포 합-1 최대오차', maxSum.toExponential(1), ' 1위 확률 vs 닫힌 식 최대오차', maxErr.toExponential(1));
// 2) 최적 컷오프 (최고 한 명)
console.log('최적 컷오프 (최고 1명): n  r  r/n  P(성공)');
for (const n of [5, 10, 20, 40, 100, 1000]) { const o = S.optimum(n, 1); console.log(`  n=${n}: r=${o.r} (${f(o.r / n, 1)}%)  P=${f(o.p, 1)}%`); }
console.log('  1/e =', f(1 / Math.E, 1) + '%');
// 3) 시뮬레이션 vs 정확한 값 (30000번)
console.log('시뮬레이션 vs 정확한 값 (30000번):');
let worst = 0;
for (const [n, r] of [[5, 2], [10, 4], [20, 7], [40, 15], [40, 5], [40, 30], [100, 37], [100, 10], [100, 80]]) {
  const T = 30000, cnt = S.trialRanks(n, r, T, 12345 + n + r), ex = S.rankDist(n, r);
  const sim1 = cnt[0] / T, e1 = ex[0], sim2 = (cnt[0] + cnt[1]) / T, e2 = ex[0] + ex[1];
  worst = Math.max(worst, Math.abs(sim1 - e1), Math.abs(sim2 - e2));
  console.log(`  n=${n} r=${r}: 1위 시뮬 ${f(sim1)}% 정확 ${f(e1)}% | 2위 이내 시뮬 ${f(sim2)}% 정확 ${f(e2)}%`);
}
console.log('  최대 차이', f(worst, 2) + '%p');
// 4) 기본값 n=40, 관찰 37%
{
  const n = 40, r = S.cutToR(n, 37), d = S.rankDist(n, r), c = S.curve(n, 1)[r];
  const mean = d.reduce((a, p, k) => a + p * (k + 1), 0);
  console.log(`기본값 n=40 컷오프 37% (r=${r}): 최고 ${f(d[0])}%  2위이내 ${f(d[0] + d[1])}%  3위이내 ${f(d[0] + d[1] + d[2])}%  평균 순위 ${mean.toFixed(1)}위  지나쳐 보냄 ${f(c.passed)}%  일찍 멈춤 ${f(c.settled)}%  무작위 ${f(1 / n)}%`);
  const o1 = S.optimum(n, 1), o2 = S.optimum(n, 2), o3 = S.optimum(n, 3);
  console.log(`  n=40 최적: 1위 r=${o1.r} (${f(o1.r / n, 0)}%) ${f(o1.p)}% | 2위이내 r=${o2.r} (${f(o2.r / n, 0)}%) ${f(o2.p)}% | 3위이내 r=${o3.r} (${f(o3.r / n, 0)}%) ${f(o3.p)}%`);
  for (const rr of [0, 4, 8, 15, 24, 32, 39]) { const c2 = S.curve(n, 1)[rr]; console.log(`  r=${rr} (${f(rr / n, 0)}%): 성공 ${f(c2.p)}%  일찍 멈춤 ${f(c2.settled)}%  지나쳐 보냄 ${f(c2.passed)}%`); }
}
// 5) n=100
{
  const n = 100;
  for (const g of [1, 2, 3]) { const o = S.optimum(n, g); console.log(`n=100 최적 (상위 ${g}명): r=${o.r} (${f(o.r / n, 0)}%) ${f(o.p)}%`); }
  const d = S.rankDist(n, 37); console.log(`  n=100 r=37: 최고 ${f(d[0])}%  평균 순위 ${d.reduce((a, p, k) => a + p * (k + 1), 0).toFixed(1)}위`);
}
// 6) 한 판 상태 기계 확인: choose()와 create()가 같은 선택을 하는가
{
  let bad = 0;
  for (let seed = 1; seed <= 500; seed++) { const s = S.create({ n: 30, cut: 37, goal: 1, seed }).run(); const c = S.choose(s.order, s.r); if (c.pick !== s.picked) bad++; }
  console.log('상태 기계 vs choose 불일치', bad, '/ 500');
}
