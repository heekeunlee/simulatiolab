// 이스터섬 과잉 성장 모델 검증.  사용법: node tools/validate-easter.js
const E = require('../site/experiments/easter/sim.js');
const f = (o) => { const s = E.outcomeOf(o); return `최고 ${Math.round(s.peak)}명(${Math.round(s.peakYear)}년) 마지막 ${Math.round(s.final)}명  비율 ${s.ratio.toFixed(2)}  숲 최저 ${(s.minR * 100).toFixed(0)}%  → ${s.outcome}`; };
const b = E.create({}), sb = b.run().summary();
console.log('기본 설정:', f({}), `| 균형점 R*=${b.Rstar.toFixed(2)} P*=${Math.round(b.Pstar)}`);
console.log('\n인구 증가 속도 (기본: 5%)'); for (const g of [0.035, 0.04, 0.05, 0.06, 0.07, 0.08, 0.1]) console.log(`  ${(g * 100).toFixed(1)}%  ${f({ growth: g })}`);
console.log('\n숲 재생 속도 (기본: 1%)'); for (const r of [0.005, 0.01, 0.02, 0.03, 0.04, 0.06, 0.08]) console.log(`  ${(r * 100).toFixed(1)}%  ${f({ regrowth: r })}`);
console.log('\n반응 지연 (기본: 30년)'); for (const d of [5, 15, 30, 50, 80]) console.log(`  ${d}년  ${f({ delay: d })}`);
console.log('\n벌채 강도 (×1e-6, 기본 2)'); for (const h of [0.5, 1, 2, 4, 8, 16]) console.log(`  ${h}  ${f({ harvest: h * 1e-6 })}`);
console.log('\n보존율 (벌채 제한)'); for (const c of [0, 0.2, 0.4, 0.6, 0.8]) console.log(`  ${c * 100}%  ${f({ conservation: c })}`);
