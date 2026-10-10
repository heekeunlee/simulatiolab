// 공유지 모델 검증.  사용법: node tools/validate-commons.js
const C = require('../site/experiments/commons/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (o, runs) => { const r = C.measure(o, runs || 10); return `저량 ${(mean(r.map((x) => x.stock)) * 100).toFixed(0).padStart(3)}% (${(Math.min(...r.map((x) => x.stock)) * 100).toFixed(0)}~${(Math.max(...r.map((x) => x.stock)) * 100).toFixed(0)})  수확 ${mean(r.map((x) => x.harvest)).toFixed(1).padStart(5)}  절제 ${(mean(r.map((x) => x.restrain)) * 100).toFixed(0).padStart(3)}%`; };
console.log('기본(감시 0, n=40, 조건부 20%, 절제 10%):', f({}));
console.log('감시 확률별 (벌금 1배, 10회 평균)'); for (const m of [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1]) console.log(`  감시 ${(m * 100).toFixed(0).padStart(3)}%`, f({ monitor: m }));
console.log('벌금별 (감시 20%)'); for (const fi of [0, 0.5, 1, 2, 3]) console.log(`  벌금 ${fi}배`, f({ monitor: 0.2, fine: fi }));
console.log('이용자 수별 (감시 0)'); for (const n of [10, 20, 40, 80]) console.log(`  n=${n}`, f({ n }));
console.log('조건부 협력자 비율별 (감시 0)'); for (const c of [0, 0.2, 0.4, 0.6]) console.log(`  조건부 ${(c * 100).toFixed(0)}%`, f({ cc: c }));
const s = C.create({ seed: 3 }).run();
console.log('기본 한 번: 저량(0,20,50,100,200)', [0, 20, 50, 100, 200].map((t) => s.stockHist[t].toFixed(0)).join(','), '탐욕 비율', [0, 20, 50, 100, 200].map((t) => (s.shareHist[t][0] * 100).toFixed(0)).join(','));
console.log('최저 저량(수용력 대비) 평균과 그 시점 — 감시 확률별 (벌금 1배, 10회)');
for (const m of [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1]) {
  const mins = [], at = [];
  for (let k = 0; k < 10; k++) { const s = C.create({ monitor: m, seed: 1 + k * 9 }).run(); let mi = Infinity, ai = 0; s.stockHist.forEach((v, t) => { if (v < mi) { mi = v; ai = t; } }); mins.push(mi); at.push(ai); }
  console.log(`  감시 ${(m * 100).toFixed(0).padStart(3)}%  최저 ${(mean(mins)).toFixed(1).padStart(5)} (${Math.min(...mins).toFixed(1)}~${Math.max(...mins).toFixed(1)})  최저 시점 평균 ${mean(at).toFixed(0)}라운드`);
}
console.log('저량이 10 아래로 내려간 적이 있는 비율 (감시별)'); for (const m of [0, 0.3, 0.6, 1]) { let c = 0; for (let k = 0; k < 20; k++) { const s = C.create({ monitor: m, seed: 100 + k * 5 }).run(); if (Math.min(...s.stockHist) < 10) c++; } console.log(`  감시 ${m * 100}%`, c + '/20'); }
console.log('최대 지속 수확(rK/4) =', 0.4 * 100 / 4);

console.log('--- 최대 지속 수확 10 대비, 이용자 수·벌금·조건부 협력자 (감시 20%, 12회 평균)');
for (const n of [10, 20, 40, 80]) console.log(`  n=${n} (감시 20%)`, f({ n, monitor: 0.2 }, 12));
for (const fi of [0, 1, 3]) console.log(`  벌금 ${fi}배 (감시 50%)`, f({ monitor: 0.5, fine: fi }, 12));
for (const c of [0, 0.2, 0.5]) console.log(`  조건부 ${c * 100}% (감시 20%)`, f({ cc: c, monitor: 0.2 }, 12));
