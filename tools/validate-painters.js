// 사용법: node tools/validate-painters.js
const P = require('../site/experiments/painters/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (o) => { const r = P.final(o, 6); return `다양성 ${mean(r.map((x) => x.diversity)).toFixed(2)} 쏠림 ${(mean(r.map((x) => x.concentration)) * 100).toFixed(0)}%`; };
const s0 = P.create({}); console.log('처음 다양성', s0.history[0].diversity.toFixed(2));
console.log('기본 (copy 60, bias 50, 독창성 40, 보상 20):', f({}));
console.log('모방률별 (bias 50%)'); for (const c of [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1]) console.log(`  모방 ${(c * 100).toFixed(0)}%  ${f({ copy: c })}  | 인기 편향 0: ${f({ copy: c, bias: 0 })}`);
console.log('독창성별 (copy 60)'); for (const o of [0.1, 0.3, 0.5, 0.8]) console.log(`  독창성 ${o}  ${f({ originality: o })}`);
console.log('보상별'); for (const r of [0, 0.2, 0.5, 1]) console.log(`  보상 ${r}  ${f({ reward: r })}`);
const h = P.create({ copy: 0.8 }).run().history; console.log('copy 80% 라운드별 다양성:', [0, 10, 20, 40, 80, 120].map((r) => r + ':' + h[r].diversity.toFixed(2)).join(' '));
