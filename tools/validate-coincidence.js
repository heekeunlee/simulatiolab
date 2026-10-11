// 우연의 일치 모델 검증.  사용법: node tools/validate-coincidence.js
const C = require('../site/experiments/coincidence/sim.js');
const pc = (v) => (v * 100).toFixed(1) + '%';
const T = 20000;
console.log('생일 하나만 (k=1): 인원 → 이론 어딘가 일치 | 시뮬레이션 | 이론 나와 일치 | 시뮬레이션');
for (const n of [10, 15, 20, 23, 30, 40, 50, 57, 70, 100]) {
  const s = C.study({ n, k: 1 }, T, 3);
  console.log(`  n=${String(n).padStart(3)}  ${pc(C.theoryAny(n, 1, 30)).padStart(6)} | ${pc(s.any).padStart(6)} | ${pc(C.theoryMe(n, 1, 30)).padStart(6)} | ${pc(s.me).padStart(6)}   쌍 ${C.pairsOf(n)}  기대 일치쌍 ${C.expectedPairs(n, 1, 30).toFixed(2)} (sim ${C.create({ n, k: 1, rounds: 20000, seed: 3 }).run().meanPairs().toFixed(2)})`);
}
console.log('처음으로 50% 이상이 되는 인원 (생일만): 어딘가 일치', C.smallestN((n) => C.theoryAny(n, 1, 30), 0.5, 400), ' 나와 일치', C.smallestN((n) => C.theoryMe(n, 1, 30), 0.5, 400), '(나 말고 +' + (C.smallestN((n) => C.theoryMe(n, 1, 30), 0.5, 400) - 1) + '명)');
console.log('처음으로 99% 이상: 어딘가', C.smallestN((n) => C.theoryAny(n, 1, 30), 0.99, 400), ' 나와', C.smallestN((n) => C.theoryMe(n, 1, 30), 0.99, 2000));
console.log('나와 일치 (생일만): 23명', pc(C.theoryMe(23, 1, 30)), ' 57명', pc(C.theoryMe(57, 1, 30)), ' 100명', pc(C.theoryMe(100, 1, 30)));
console.log('특징 수별 (n=23, pool=30): k → 이론 어딘가 | 시뮬 | 이론 나와 | 시뮬 | 기대 일치쌍');
for (const k of [1, 2, 3, 4, 5, 6]) { const s = C.study({ n: 23, k, pool: 30 }, T, 5); console.log(`  k=${k}  ${pc(C.theoryAny(23, k, 30)).padStart(6)} | ${pc(s.any).padStart(6)} | ${pc(C.theoryMe(23, k, 30)).padStart(6)} | ${pc(s.me).padStart(6)} | ${C.expectedPairs(23, k, 30).toFixed(2)} (sim ${C.create({ n: 23, k, pool: 30, rounds: 20000, seed: 5 }).run().meanPairs().toFixed(2)})`); }
console.log('풀 크기별 (n=23, k=3): pool → 이론 어딘가 | 나와');
for (const pool of [5, 10, 30, 100, 200]) console.log(`  pool=${pool}  ${pc(C.theoryAny(23, 3, pool))} | ${pc(C.theoryMe(23, 3, pool))}`);
console.log('몇 명이면 어딘가 일치가 50% 넘나 (k별, pool=30):', [1, 2, 3, 4, 5, 6].map((k) => k + ':' + C.smallestN((n) => C.theoryAny(n, k, 30), 0.5, 400)).join('  '));
console.log('몇 명이면 나와 일치가 50% 넘나 (k별, pool=30):', [1, 2, 3, 4, 5, 6].map((k) => k + ':' + C.smallestN((n) => C.theoryMe(n, k, 30), 0.5, 2000)).join('  '));
console.log('쌍의 수: ', [10, 23, 50, 100].map((n) => n + '명 ' + C.pairsOf(n) + '쌍').join(', '));
const s = C.create({ rounds: 300, seed: 1 }).run(); console.log('애니메이션용 한 번 실행(300회, n=23,k=1): 일치한 방', pc(s.anyShare()), ' 나와 일치', pc(s.meShare()), ' 평균 일치쌍', s.meanPairs().toFixed(2));
const f = C.create({ rounds: 300, seed: 1 }); f.advance(); console.log('첫 방: 일치쌍', f.last.pairs.length, ' 나와', f.last.meCount);
