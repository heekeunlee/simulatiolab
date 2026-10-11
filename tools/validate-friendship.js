// 친구의 역설 모델 검증.  사용법: node tools/validate-friendship.js
const F = require('../site/experiments/friendship/sim.js');
const pc = (v) => (v * 100).toFixed(1) + '%';
const NETS = 300;
console.log(`[기본값 n=150, 허브 80%, 평균 친구 6] 서로 다른 관계망 ${NETS}개 평균`);
let r = F.study({}, NETS, 11);
console.log(`  평균 친구 수 ${r.meanDeg.toFixed(2)} | 친구들 평균(사람별 평균의 평균) ${r.meanFriendDeg.toFixed(2)} (${(r.meanFriendDeg / r.meanDeg).toFixed(2)}배) | 친구 목록 이어붙이기 <k²>/<k> ${r.listMean.toFixed(2)}`);
console.log(`  친구들이 더 많은 사람 ${pc(r.fewerShare)} | 같음 ${pc(r.equalShare)} | 내가 더 많음 ${pc(r.moreShare)} | 최대 친구 수 평균 ${r.maxDeg.toFixed(0)}`);
let minGap = Infinity, below = 0, fewMin = 1, fewMax = 0; r.runs.forEach((M) => { minGap = Math.min(minGap, M.meanFriendDeg - M.meanDeg); if (M.fewerShare < 0.5) below++; fewMin = Math.min(fewMin, M.fewerShare); fewMax = Math.max(fewMax, M.fewerShare); });
console.log(`  관계망마다 (친구들 평균 − 평균 친구 수)의 최솟값 ${minGap.toFixed(3)} (0 이상이면 항상 성립), 친구들이 더 많은 사람이 절반 미만인 관계망 ${below}/${NETS}개, 비율 범위 ${pc(fewMin)}~${pc(fewMax)}`);
// 이론 확인: 친구 목록을 이어 붙인 평균 = <k²>/<k>를 직접 세어 본 값과 비교
const n0 = F.network(Object.assign({}, F.DEFAULTS), F.mulberry32(5)), M0 = F.measure(n0);
let slots = 0, tot = 0; n0.forEach((a) => a.forEach((j) => { slots++; tot += M0.deg[j]; }));
console.log(`  이론 확인(관계망 1개): 친구 목록 전체의 평균 ${(tot / slots).toFixed(4)} = <k²>/<k> ${M0.listMean.toFixed(4)}`);
const sd = Array.from(M0.deg).sort((a, b) => b - a), top = Math.ceil(M0.n * 0.1), topSlots = sd.slice(0, top).reduce((x, y) => x + y, 0) / sd.reduce((x, y) => x + y, 0);
console.log(`  친구 수 상위 10%(${top}명)가 모든 친구 목록 칸에서 차지하는 비중 ${pc(topSlots)}`);

console.log('\n[허브 쏠림별, n=150 평균 친구 6, 관계망 100개] 허브 | 평균 친구 | 친구들 평균 | 배 | 친구들이 더 많은 사람');
for (const hb of [0, 0.25, 0.5, 0.8, 1]) { const q = F.study({ hub: hb }, 100, 21); console.log(`  ${(hb * 100).toFixed(0).padStart(3)}% | ${q.meanDeg.toFixed(2)} | ${q.meanFriendDeg.toFixed(2)} | ${(q.meanFriendDeg / q.meanDeg).toFixed(2)} | ${pc(q.fewerShare)}`); }
console.log('\n[인원별, 허브 80% 평균 친구 6, 관계망 100개] n | 친구들이 더 많은 사람 | 배');
for (const n of [30, 100, 150, 300]) { const q = F.study({ n }, 100, 22); console.log(`  ${String(n).padStart(3)} | ${pc(q.fewerShare)} | ${(q.meanFriendDeg / q.meanDeg).toFixed(2)}`); }
console.log('\n[평균 친구 수별, n=150 허브 80%, 관계망 100개] 평균 | 측정 평균 | 배 | 친구들이 더 많은 사람');
for (const a of [2, 4, 6, 8, 12]) { const q = F.study({ avg: a }, 100, 23); console.log(`  ${String(a).padStart(2)} | ${q.meanDeg.toFixed(2)} | ${(q.meanFriendDeg / q.meanDeg).toFixed(2)} | ${pc(q.fewerShare)}`); }
console.log('\n[그래프 ④ 선 (평균 친구 4/8/12), n=150, 6개 평균] 허브 0% | 100%');
for (const a of [4, 8, 12]) console.log(`  평균 ${a}: ${pc(F.study({ avg: a, hub: 0 }, 6, 9).fewerShare)} | ${pc(F.study({ avg: a, hub: 1 }, 6, 9).fewerShare)}`);
console.log('\n[표본 뽑기, 기본값 관계망 seed 1, 300번]');
const s = F.create({ seed: 1 }).run(), M = s.M, p = F.typicalPerson(M);
console.log(`  관계망: 평균 친구 ${M.meanDeg.toFixed(2)}, 친구들 평균 ${M.meanFriendDeg.toFixed(2)}, 친구들이 더 많은 사람 ${pc(M.fewerShare)}, 최대 ${M.maxDeg}명`);
console.log(`  무작위 사람 평균 ${s.selfMean().toFixed(2)} | 그 사람이 말한 친구 평균 ${s.friendMean().toFixed(2)}`);
console.log(`  처음 선택되는 사람: 친구 ${M.deg[p]}명, 친구들 평균 ${M.fr[p].toFixed(1)}명`);
console.log('  표본 10000번 (기본값 관계망 300개 평균):');
let a = 0, b = 0, z = 0; for (let t = 1; t <= 300; t++) { const q = F.create({ seed: t, rounds: 10000, layoutIters: 0 }).run(); a += q.selfMean() / 300; b += q.friendMean() / 300; z += q.M.meanFriendDeg / 300; }
console.log(`  무작위 사람 ${a.toFixed(2)} | 그 사람이 말한 친구 ${b.toFixed(2)} | (참고: 친구들 평균 이론값 ${z.toFixed(2)})`);
const t0 = Date.now(); F.create({ n: 300 }); console.log('\nn=300 생성+배치 시간', Date.now() - t0, 'ms');
