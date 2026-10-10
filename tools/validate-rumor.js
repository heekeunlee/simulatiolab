// 소문 모델 검증.  사용법: node tools/validate-rumor.js
const R = require('../site/experiments/rumor/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const s0 = R.create({});
const sizes = s0.roomMembers.map((m) => m.length).sort((a, b) => b - a);
console.log(`단톡방 크기: 최대 ${sizes[0]}, 중앙값 ${sizes[sizes.length >> 1]}, 최소 ${sizes[sizes.length - 1]}`);
console.log('\n전달 확률별 도달률 (정정 없음, 20회 평균)');
for (const p of [0.005, 0.01, 0.015, 0.02, 0.03, 0.05]) {
  const r = R.reach({ p }, 20);
  console.log(`  p=${(p * 100).toFixed(1).padStart(4)}%  도달 ${(mean(r) * 100).toFixed(0).padStart(3)}%  (최소 ${(Math.min(...r) * 100).toFixed(0)}% ~ 최대 ${(Math.max(...r) * 100).toFixed(0)}%)`);
}
console.log('\n정정 시작 시점별 도달률 (p=1.5%, 20회 평균)');
for (const d of [0, 1, 2, 3, 4, 6, 8, 12]) {
  const r = R.reach({ correctionDelay: d }, 20);
  console.log(`  정정 ${d === 0 ? '없음   ' : d + '라운드 뒤'}  도달 ${(mean(r) * 100).toFixed(0).padStart(3)}%`);
}
const one = R.create({}).run();
console.log('\n한 번 실행: 라운드', one.round, '최고 동시 전파자', one.peakSpreaders, '도달', one.counts().heard);
