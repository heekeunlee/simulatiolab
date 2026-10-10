// 혁명 문턱 모델 검증.  사용법: node tools/validate-revolution.js
const R = require('../site/experiments/revolution/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (o) => { const a = R.finalShare(o, 20); return (mean(a) * 100).toFixed(0) + '% (' + (Math.min(...a) * 100).toFixed(0) + '~' + (Math.max(...a) * 100).toFixed(0) + ')'; };
console.log('기본 설정(평균 20%, 퍼짐 15%, 선동가 1%):', f({}), ' | 선동가 0%:', f({ radicals: 0 }));
const c = R.create({ mode: 'classic' }).run(), m = R.create({ mode: 'missing' }).run();
console.log('고전 예시(문턱 0, 1%, 2%, ... 100명):', (c.share() * 100).toFixed(1) + '%', c.round + '라운드', '| 한 명을 바꾸면:', (m.share() * 100).toFixed(1) + '%', m.round + '라운드');
console.log('\n평균 문턱별 최종 참여 (퍼짐 15%, 20회 평균): 선동가 1% | 0%');
for (const x of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6]) console.log(`  평균 ${(x * 100).toFixed(0).padStart(2)}%  ${f({ mean: x })} | ${f({ mean: x, radicals: 0 })}`);
console.log('\n선동가 수별 (평균 25%, 퍼짐 15%):'); for (const r of [0, 0.005, 0.01, 0.02, 0.03, 0.05]) console.log(`  ${(r * 100).toFixed(1)}%  ${f({ mean: 0.25, radicals: r })}`);
const s = R.create({}).run(); console.log('\n기본 설정 한 번: ', s.round, '라운드, 단계별 참여', s.history.map((v) => (v * 100).toFixed(0)).join(' '));
