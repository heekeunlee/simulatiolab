// 셸링 모델 검증.  사용법: node tools/validate-schelling.js
const S = require('../site/experiments/schelling/sim.js');
console.log('임계값별 최종 평균 같은 이웃 비율 (5회 평균, 50x50, 빈 칸 10%)');
const ts = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
for (const t of ts) {
  let sum = 0, rounds = 0, start = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const s = S.create({ threshold: t, seed }); start += s.metrics().avgSame; s.run();
    sum += s.metrics().avgSame; rounds += s.round;
  }
  console.log(`  원하는 비율 ${(t * 100).toFixed(0).padStart(3)}%  처음 ${(start / 5 * 100).toFixed(0)}% → 끝 ${(sum / 5 * 100).toFixed(0)}%  (${(rounds / 5).toFixed(0)}라운드)`);
}
