// 무지의 베일 모델 검증.  사용법: node tools/validate-veil.js
const V = require('../site/experiments/veil/sim.js');
const names = V.SOCIETIES.map((s) => s.id);
console.log('사회: 평균 / 최소');
V.SOCIETIES.forEach((s) => console.log(' ', s.id.padEnd(8), V.mean(s.inc).toFixed(1).padStart(6), String(V.minOf(s.inc)).padStart(4)));
console.log('규칙: 평균 극대화 →', names[V.choice('avg')], '| 최소 극대화 →', names[V.choice('maximin')]);
let prev = null; const flips = [];
for (let i = 0; i <= 160; i++) { const g = i * 0.05, w = names[V.choice('eu', g)]; if (w !== prev) { flips.push(`γ=${g.toFixed(2)}→${w}`); prev = w; } }
console.log('기대효용 선택이 바뀌는 지점:', flips.join('  '));
console.log('γ=1.0 (log) 확실성 등가:', V.SOCIETIES.map((s) => s.id + ' ' + V.ce(s.inc, 1).toFixed(1)).join(', '));
for (const [m, sd] of [[2, 1], [0.5, 0.5], [1, 1], [3, 1], [5, 1], [7, 1], [2, 0]]) {
  const c = V.population(m, sd, 1000, 1), c2 = V.population(m, sd, 1000, 2);
  console.log(`집단 γ 평균 ${m}, 퍼짐 ${sd}: ` + names.map((n, i) => n + ' ' + c[i] + '/' + c2[i]).join(', ') + '  (시드 1/2, 1,000명)');
}
// 베일 뒤 추첨: 오래 뽑으면 평균에 수렴
for (const rule of ['avg', 'maximin']) { const s = V.create({ rule, draws: 20000, seed: 3 }); while (s.advance()); console.log(`추첨 20,000번 (${rule}): 평균 ${s.avgSoFar().toFixed(1)} (사회 평균 ${V.mean(s.society.inc).toFixed(1)})`); }
const s2 = V.create({ gamma: 1.5, draws: 120, seed: 1 }); while (s2.advance());
console.log('기본(γ=1.5) 선택:', s2.society.id, '120번 추첨 평균', s2.avgSoFar().toFixed(1), '최소', Math.min(...s2.incomes), '최대', Math.max(...s2.incomes));
console.log('γ별 고른 사회의 평균/최소:');
for (const g of [0, 0.5, 1, 1.5, 2, 2.25, 4, 6, 6.25, 8]) { const i = V.choice('eu', g), s = V.SOCIETIES[i]; console.log(`  γ=${g}`, s.id.padEnd(8), '평균', V.mean(s.inc).toFixed(1), '최소', V.minOf(s.inc)); }
