// 협력의 진화 모델 검증.  사용법: node tools/validate-cooperation.js
const Co = require('../site/experiments/cooperation/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const show = (name, o, runs) => {
  const r = Co.measure(o, runs || 6), sh = [0, 1, 2, 3, 4].map((i) => (mean(r.map((x) => x.shares[i])) * 100).toFixed(0).padStart(3));
  console.log(`  ${name.padEnd(22)} 협력률 ${(mean(r.map((x) => x.coop)) * 100).toFixed(0).padStart(3)}% (${(Math.min(...r.map((x) => x.coop)) * 100).toFixed(0)}~${(Math.max(...r.map((x) => x.coop)) * 100).toFixed(0)})  전략 비율(항상협력/항상배신/맞받아치기/너그러운/파블로프) ${sh.join(' / ')}`);
};
console.log('150세대 뒤 (마지막 20세대 평균, 6회)  기본: 배신자 50%, 실수 2%, 10판, T=5');
show('기본', {});
for (const d of [0.1, 0.3, 0.5, 0.7, 0.9]) show(`처음 배신자 ${d * 100}%`, { defectors: d });
for (const e of [0, 0.01, 0.02, 0.05, 0.1]) show(`실수 ${e * 100}%`, { noise: e });
for (const g of [1, 2, 5, 10, 30, 50]) show(`게임 길이 ${g}`, { rounds: g });
for (const t of [4, 5, 6, 7]) show(`유혹 T=${t}`, { T: t });
console.log('\n기본 설정 12회: '); const r12 = Co.measure({}, 12); console.log('  협력률 ' + r12.map((x) => (x.coop * 100).toFixed(0)).join(', '));
console.log('실수 5%, 12회: ' + Co.measure({ noise: 0.05 }, 12).map((x) => (x.coop * 100).toFixed(0)).join(', '));
console.log('실수 10%, 12회: ' + Co.measure({ noise: 0.1 }, 12).map((x) => (x.coop * 100).toFixed(0)).join(', '));
