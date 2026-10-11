// 평균으로의 회귀 모델 검증.  사용법: node tools/validate-regression.js
const R = require('../site/experiments/regression/sim.js');
const f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const REP = 400;
console.log('점수 = 50 + 10 x (실력 + 운 섞음), 표본 400명, 상위/하위 20%, 진짜 효과 0. %d번 반복 평균', REP);
console.log('운의 몫 | 신뢰도 1-운 | 기울기(실측) | 칭찬받은 쪽 변화 (이론) | 혼난 쪽 변화 (이론) | 코치의 결론 차이 | 혼난 쪽이 더 오른 표본 비율');
for (const luck of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
  const s = R.study({ luck }, REP, 3), t = R.theory({ luck });
  console.log(`  ${(luck * 100).toFixed(0).padStart(3)}%   ${(1 - luck).toFixed(2)}   ${s.slope.toFixed(2)}   ${f2(s.top)} (${f2(t.top)})   ${f2(s.bot)} (${f2(t.bot)})   ${f2(s.gap)} (${f2(t.gap)})   ${(s.gapPos * 100).toFixed(0)}%`);
}
console.log('상위/하위 비율별 (운 50%, 효과 0): 칭찬받은 쪽, 혼난 쪽, 차이');
for (const cut of [0.05, 0.1, 0.2, 0.3, 0.5]) { const s = R.study({ cut }, REP, 5), t = R.theory({ cut }); console.log(`  ${(cut * 100).toFixed(0)}%  ${f2(s.top)} (${f2(t.top)})  ${f2(s.bot)} (${f2(t.bot)})  ${f2(s.gap)}`); }
console.log('표본 크기별 (운 50%, 20%): 코치 차이가 양수인 표본 비율');
for (const n of [20, 40, 100, 400, 2000]) { const s = R.study({ n }, n >= 2000 ? 100 : REP, 7); console.log(`  n=${n}  차이 ${f2(s.gap)}  양수 ${(s.gapPos * 100).toFixed(0)}%`); }
console.log('진짜 효과 (코치 장면: 칭찬 +e, 혼내기 -e, 운 50%, 20%): 코치가 보는 차이 (이론) | 진짜 차이');
for (const eff of [-10, -7, -3, 0, 3, 7, 10]) { const s = R.study({ eff }, REP, 9), t = R.theory({ eff }); console.log(`  e=${String(eff).padStart(3)}  ${f2(s.gap)} (${f2(t.gap)})  진짜 ${f2(t.trueGap)}`); }
console.log('칭찬이 진짜로 +e 도와도(혼내기는 -e) 코치가 보는 차이가 0이 되는 효과: 이론상 e = ' + (R.theory({}).gap / 2).toFixed(1) + ' (운 50%, 20%)');
for (const eff of [0, 3, 6, 7, 8]) { const s = R.study({ eff }, REP, 11); console.log(`  e=${eff}  차이 ${f2(s.gap)}`); }
console.log('스포츠 장면 (운 50%, 20%): 효과 0 -> 상위, 하위 변화 | 상위에 -3(표지가 실제로 해로움)');
{ const a = R.study({ view: 'sports' }, REP, 3), b = R.study({ view: 'sports', eff: -3 }, REP, 3); console.log(`  ${f2(a.top)}, ${f2(a.bot)} | ${f2(b.top)}, ${f2(b.bot)}`); }
const sim = R.create({ seed: 1 }).run(), sm = sim.summary();
console.log('기본값 한 번(시드 1, n=400): 칭찬 %s명 변화 %s, 혼난 %s명 변화 %s, 중간 %s, 기울기 %s, 상관 %s, 차이 %s', sm.nTop, f2(sm.top), sm.nBot, f2(sm.bot), f2(sm.mid), sm.slope.toFixed(2), sm.corr.toFixed(2), f2(sm.gap));
const same = R.create({ seed: 1 }).run().summary(); console.log('같은 시드 같은 결과:', same.gap === sm.gap);
