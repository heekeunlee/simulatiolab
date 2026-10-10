// 승자의 저주 모델 검증.  사용법: node tools/validate-auction.js
const A = require('../site/experiments/auction/sim.js');
const N = 40000;
const f = (o) => A.study(o, N, 3);
console.log('가치 100 기준. 낙찰자 평균 손익 (순진한 입찰, shade 0)');
console.log('  입찰자 수별 (오차 20%): 첫째값 방식 | 둘째값 방식 | 손해 본 비율(첫째값)');
for (const n of [2, 3, 5, 10, 20, 30]) { const a = f({ n }), b = f({ n, rule: 'second' }); console.log(`  n=${String(n).padStart(2)}  ${a.mean.toFixed(1).padStart(7)} | ${b.mean.toFixed(1).padStart(7)} | ${(a.lossShare * 100).toFixed(0)}%`); }
console.log('  오차별 (n=10): 첫째값 방식'); for (const s of [0.05, 0.1, 0.2, 0.3, 0.4]) { const a = f({ sigma: s }); console.log(`  오차 ${(s * 100).toFixed(0)}%  ${a.mean.toFixed(1)}  (오차 크기 대비 ${(a.mean / (s * 100)).toFixed(2)}σ)`); }
console.log('손익분기 낮춤 (n=10, 오차 20%): 첫째값', (-f({}).mean / 20).toFixed(2) + 'σ', ' 둘째값', (-f({ rule: 'second' }).mean / 20).toFixed(2) + 'σ');
console.log('모두 shade를 바꿀 때 평균 손익 (n=10, 오차 20%, 첫째값):', [0, 0.5, 1, 1.5, 2].map((s) => s + 'σ:' + f({ shade: s }).mean.toFixed(1)).join('  '));
console.log('나 혼자 낮출 때 (다른 사람 순진, n=10, 오차 20%): 낮춤 → 내 이길 확률, 내 평균 손익(경매당)');
for (const s of [0, 0.5, 1, 1.5, 2, 2.5, 3]) { const a = f({ myShade: s }); console.log(`  ${s}σ  이길 확률 ${(a.myWin * 100).toFixed(1)}%  손익 ${a.myProfit.toFixed(2)}`); }
const s = A.create({ rounds: 400, seed: 1 }).run(); console.log('애니메이션용 한 번 실행(400회) 평균 손익:', s.mean().toFixed(1), ' 손해 본 비율', (s.lossShare() * 100).toFixed(0) + '%');
const first = A.create({ rounds: 400, seed: 1 }); first.advance(); console.log('첫 경매 V', first.last.V.toFixed(1), '낙찰가', first.last.price.toFixed(1), '손익', first.last.profit.toFixed(1));
