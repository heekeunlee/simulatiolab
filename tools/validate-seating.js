// 벤치 자리 앉기 모델 검증.  사용법: node tools/validate-seating.js
const S = require('../site/experiments/seating/sim.js');
const f = (v, d = 3) => v.toFixed(d);
console.log('== 1) 아주 긴 벤치의 이론 비율 vs 시뮬레이션(n=2000, 200판) ==');
for (const g of [0, 1, 2, 3]) {
  const th = S.theta(g), n = 2000;
  const sm = S.meanFill('random', n, g, 200, 11).mean / n;
  console.log(`g=${g}: 이론 ${f(th, 4)}  시뮬 ${f(sm, 4)}  정돈 최대 ${f(1 / (g + 1), 4)}  무작위/정돈 ${f(th * (g + 1), 4)}`);
}
console.log('g=1 닫힌 식 (1-e^-2)/2 =', f((1 - Math.exp(-2)) / 2, 4));
console.log('\n== 2) 유한한 벤치: 정확한 기댓값(점화식) vs 시뮬(5000판) ==');
for (const g of [1, 2]) {
  const ex = S.exact(200, g);
  for (const n of [10, 24, 30, 60, 200]) {
    const sm = S.meanFill('random', n, g, 5000, 3).mean;
    console.log(`g=${g} n=${n}: 정확 ${f(ex[n], 3)}명 (${f(ex[n] / n, 4)})  시뮬 ${f(sm, 3)}명 (${f(sm / n, 4)})  정돈 ${S.cap(n, g)}명  낭비 ${f(100 * (1 - ex[n] / S.cap(n, g)), 1)}%`);
  }
}
console.log('\n== 3) 규칙 비교 (3000판, 앉은 사람 평균) ==');
for (const [n, g] of [[24, 1], [24, 2], [30, 2], [30, 3], [60, 1]]) {
  const line = S.RULES.map((r) => `${r} ${f(S.meanFill(r, n, g, 3000, 5).mean, 2)}`).join('  ');
  console.log(`n=${n} g=${g} 정돈 ${S.cap(n, g)}명:  ${line}`);
}
console.log('\n== 4) 기본값 (n=24, g=2, 도착 20명) 한 판, 시드 1~5 ==');
for (let seed = 1; seed <= 5; seed++) {
  const s = S.create({ seed }).run();
  console.log(`seed ${seed}: ` + s.rows.map((r) => `${r.rule} 앉음${r.seated}/돌려보냄${r.turned}`).join('  '));
}
// 검증: 규칙이 간격 규칙을 지켰는지
let bad = 0;
for (let seed = 1; seed <= 300; seed++) for (const g of [0, 1, 2, 3]) {
  const s = S.create({ n: 30, g, arrivals: 40, seed }).run();
  s.rows.forEach((r) => { const idx = []; r.occ.forEach((v, i) => v && idx.push(i)); for (let k = 1; k < idx.length; k++) if (idx[k] - idx[k - 1] < g + 1) bad++; });
}
console.log('\n간격 위반 횟수:', bad);
