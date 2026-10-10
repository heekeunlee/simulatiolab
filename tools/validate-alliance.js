// 동맹 연쇄 모델 검증.  사용법: node tools/validate-alliance.js
const A = require('../site/experiments/alliance/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const row = (o, shots) => { const s = A.sizes(o, shots || 400, 100); const w = s.filter((x) => x >= 12).length / s.length; const loc = s.filter((x) => x <= 4).length / s.length; return `평균 ${mean(s).toFixed(1)}개국  세계대전급(12개국 이상) ${(w * 100).toFixed(0)}%  작게 끝남(4개국 이하) ${(loc * 100).toFixed(0)}%`; };
console.log('나라 24개, 조약을 지킬 확률 70%, 400번 (무작위 동맹)');
for (const k of [0, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) console.log(`  평균 동맹 ${k}개:`, row({ allies: k }));
console.log('\n평균 동맹 3개, 조약을 지킬 확률');
for (const c of [0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 1]) console.log(`  ${(c * 100).toFixed(0)}%:`, row({ commit: c }));
console.log('\n구조별 (조약을 지킬 확률 70%)');
console.log('  둘씩 묶인 동맹:', row({ structure: 'pairs' }));
for (const k of [1, 2, 3, 4]) console.log(`  두 진영(진영 안 평균 ${k}개):`, row({ structure: 'blocs', allies: k }));
