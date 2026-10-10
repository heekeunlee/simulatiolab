// 이야기 전달 실험 검증.  사용법: node tools/validate-telephone.js
const T = require('../site/experiments/telephone/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (v, d) => v.toFixed(d == null ? 2 : d);
function show(name, o) {
  const r = T.finals(o, 8);
  const s = T.create(Object.assign({}, o, { seed: 400 }));
  console.log(`  ${name.padEnd(26)} 남은 원본 ${f(mean(r.map((x) => x.survMean)))}  길이 ${f(mean(r.map((x) => x.lenMean)), 1)}  평균 기억용이성 ${f(mean(r.map((x) => x.memMean)))} (처음 ${f(s.origMem)})  원본 비중 ${f(mean(r.map((x) => x.fracMean)))}  사슬 간 유사도 ${f(mean(r.map((x) => x.jac)))} (우연 기준 ${f(mean(r.map((x) => x.jacChance)))})`);
}
console.log('40번 전달 뒤, 8회 평균 (기본: 기억력 96%, 덧붙이기 30%, 관습화 30%)');
show('기본', {});
console.log('기억력');
for (const m of [0.7, 0.8, 0.9, 0.96, 0.99, 1]) show(`기억력 ${(m * 100).toFixed(0)}%`, { memory: m });
console.log('덧붙이기 (기억력 96%)');
for (const c of [0, 0.3, 0.6, 1]) show(`덧붙이기 ${(c * 100).toFixed(0)}%`, { creativity: c });
console.log('관습화 (기억력 96%)');
for (const c of [0, 0.3, 0.6, 1]) show(`관습화 ${(c * 100).toFixed(0)}%`, { convention: c });
const s = T.create({}).run();
console.log('기본 한 번의 세대별 (사슬 평균): 세대 0,1,5,10,20,40 → 남은 원본 / 평균 기억용이성');
console.log([0, 1, 5, 10, 20, 40].map((g) => `${g}:${f(s.history[g] ? s.history[g].survMean : 1)}/${f(s.history[g] ? s.history[g].memMean : s.origMem)}`).join('  '));
