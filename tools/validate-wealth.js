// 부의 쏠림 모델 검증.  사용법: node tools/validate-wealth.js
const W = require('../site/experiments/wealth/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (v) => (v * 100).toFixed(0).padStart(3) + '%';
const s = W.create({}).run(), q = s.current();
let tot = 0; s.wealth.forEach((v) => { tot += v; });
console.log(`총 재산 보존: ${tot.toFixed(6)} (시작 ${s.n})`);
console.log(`기본 설정(공정한 거래, 세금 0, 300라운드): 지니 ${q.gini.toFixed(2)}, 상위 1% ${f(q.top1)}, 상위 10% ${f(q.top10)}, 하위 50% ${f(q.bottom50)}`);
console.log('라운드별 지니:', [0, 10, 30, 100, 200, 300].map((r) => `${r}:${s.stats[r].gini.toFixed(2)}`).join('  '));
console.log('\n재분배율별 최종 지니 (5회 평균)');
for (const t of [0, 0.005, 0.01, 0.02, 0.03, 0.05, 0.08]) console.log(`  세금 ${(t * 100).toFixed(1).padStart(4)}%  지니 ${mean(W.finalGini({ tax: t }, 5)).toFixed(2)}`);
console.log('\n부자 유리 편향별 (세금 0)');
for (const b of [0, 0.02, 0.05, 0.1]) console.log(`  편향 ${(b * 100).toFixed(0).padStart(2)}%  지니 ${mean(W.finalGini({ bias: b }, 5)).toFixed(2)}`);
