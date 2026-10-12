// 지프 법칙 실험 검증.  사용법: node tools/validate-zipf.js
const Z = require('../site/experiments/zipf/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f2 = (v) => v.toFixed(2);
console.log('10만 단어 글, 6회 평균. 기울기 = 순위 3~200 구간 최소제곱 (부호는 절댓값으로 표기)');
console.log('복사(부익부) 모드');
for (const a of [0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1]) {
  const r = Z.slopes({ novelty: a }, 6);
  console.log(`  novelty ${(a * 100).toFixed(1)}%  기울기 ${f2(-mean(r.map((x) => x.slope)))}  (1-α=${f2(1 - a)})  어휘 ${Math.round(mean(r.map((x) => x.vocab)))}  상위10 ${(mean(r.map((x) => x.top10)) * 100).toFixed(0)}%  상위100 ${(mean(r.map((x) => x.top100)) * 100).toFixed(0)}%`);
}
console.log('균등 선택(대조) 모드');
for (const a of [0.005, 0.01, 0.03, 0.1]) {
  const r = Z.slopes({ novelty: a, mode: 'uniform' }, 6);
  console.log(`  novelty ${(a * 100).toFixed(1)}%  기울기 ${f2(-mean(r.map((x) => x.slope)))}  어휘 ${Math.round(mean(r.map((x) => x.vocab)))}  상위10 ${(mean(r.map((x) => x.top10)) * 100).toFixed(0)}%  상위100 ${(mean(r.map((x) => x.top100)) * 100).toFixed(0)}%`);
}
console.log('적합 구간 민감도 (복사, novelty 3%)');
for (const [lo, hi] of [[1, 50], [3, 200], [5, 500], [10, 1000]]) { const r = Z.slopes({ novelty: 0.03, fitFrom: lo, fitTo: hi }, 6); console.log(`  순위 ${lo}~${hi}: ${f2(-mean(r.map((x) => x.slope)))}`); }
console.log('토큰 수 민감도 (복사, novelty 3%)');
for (const t of [5000, 20000, 100000]) { const r = Z.slopes({ novelty: 0.03, total: t }, 6); console.log(`  ${t}단어: 기울기 ${f2(-mean(r.map((x) => x.slope)))}  어휘 ${Math.round(mean(r.map((x) => x.vocab)))}`); }
const names = new Set(); for (let i = 0; i < 3000; i++) names.add(Z.wordName(i)); console.log('가짜 단어 3000개 중 서로 다른 단어:', names.size, '예:', [0, 1, 2, 50, 500, 2999].map(Z.wordName).join(' '));
{ const r = Z.slopes({ novelty: 0.03 }, 6); console.log('1위 단어의 몫 (복사, novelty 3%, 6편 평균):', (mean(r.map((x) => x.ranked[0].count / 100000)) * 100).toFixed(1) + '%'); }
