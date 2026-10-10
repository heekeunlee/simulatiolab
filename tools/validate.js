// 논문 결과와 우리 구현을 비교하는 검증 스크립트.  사용법: node tools/validate.js
const TL = require('../site/experiments/talent-vs-luck/sim.js');

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('논문 기준값: 최고 부자 재능 0.61(평균 0.6 근처), 최고 재능자 자본 < 초기값(10), 상위 20%가 약 80%\n');

const first = TL.stats(TL.create({ seed: 1 }).run());
console.log('[단일 실행 seed=1]');
console.log('  최고 부자 재능:', first.richestTalent.toFixed(3), ' 자본:', first.richestCapital);
console.log('  최고 재능자 재능:', first.mostTalentedTalent.toFixed(3), ' 자본:', first.mostTalentedCapital);
console.log('  상위 20% 자본 비중:', (first.top20Share * 100).toFixed(1) + '%');
console.log('  초기 자본(10) 미만 비율:', (first.belowInitial * 100).toFixed(1) + '%');

const runs = 300;
const b = TL.batch({}, runs);
console.log(`\n[${runs}회 반복]`);
console.log('  최고 부자 재능 중앙값:', median(b.map((r) => r.richestTalent)).toFixed(3));
console.log('  최고 부자 재능 평균  :', mean(b.map((r) => r.richestTalent)).toFixed(3));
console.log('  상위 20% 비중 평균   :', (mean(b.map((r) => r.top20Share)) * 100).toFixed(1) + '%');
console.log('  최고 부자가 최고 재능자였던 비율:', (b.filter((r) => r.richestIsTopTalent).length / runs * 100).toFixed(1) + '%');
console.log('  상위 10명 부자 중 재능 상위 10% 인원 평균:', mean(b.map((r) => r.richInTopDecile)).toFixed(2), '/ 10');
