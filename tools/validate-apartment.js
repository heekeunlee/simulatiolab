// 아파트 가격 전염 모델 검증.  사용법: node tools/validate-apartment.js
const A = require('../site/experiments/apartment/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (o) => { const r = A.summarize(o, 6); return `정점 평균가 ${mean(r.map((x) => x.peakMean)).toFixed(0)}, 고평가(소득 기준선 +30%↑) 동네 최대 ${(mean(r.map((x) => x.peakHot)) * 100).toFixed(0)}%, 끝 평균가 ${mean(r.map((x) => x.final)).toFixed(0)} (정점 대비 -${(mean(r.map((x) => x.drop)) * 100).toFixed(0)}%)`; };
console.log('기본(전염 0.6, 대출 60%, 기대 0.5, 금리충격 50분기):', f({}));
console.log('전염 세기별 (금리충격 없음)'); for (const c of [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 1]) console.log(`  전염 ${c}:`, f({ contagion: c, rateStep: 0 }));
console.log('대출 한도별 (전염 0.6, 금리충격 없음)'); for (const l of [0.3, 0.4, 0.5, 0.6, 0.7, 0.9]) console.log(`  대출 ${l * 100}%:`, f({ ltv: l, rateStep: 0 }));
console.log('기대 세기별'); for (const o of [0, 0.5, 1]) console.log(`  기대 ${o}:`, f({ optimism: o, rateStep: 0 }));
console.log('금리충격 시점별'); for (const r of [0, 40, 60, 80]) console.log(`  충격 ${r}:`, f({ rateStep: r }));
