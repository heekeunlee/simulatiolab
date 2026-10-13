// 전쟁 모델 검증.  사용법: node tools/validate-war.js
const W = require('../site/experiments/war/sim.js');
const f = (v, d = 1) => v.toFixed(d), pc = (v) => f(v * 100, 1) + '%';
const D = W.DEFAULTS;
console.log('== 1) 협상 실패 (Fearon): 이론 전쟁 확률 = max(0, 1 - c/u),  c=전쟁 비용(한쪽), u=불확실성 ==');
console.log('기본 설정 u=' + D.u + ' c=' + D.c + ': 이론', pc(W.theoryWar(D)), ' 시뮬(20만 건)', pc(W.bargainRun(D, 200000, 3)), ' A의 요구', f(W.demand(D), 3), ' 협상 범위 폭(2c)', f(2 * D.c, 2));
let maxErr = 0;
for (const u of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) for (const c of [0.05, 0.1, 0.15, 0.2, 0.3]) {
  const P = Object.assign({}, D, { u, c }), th = W.theoryWar(P), sm = W.bargainRun(P, 100000, 9); maxErr = Math.max(maxErr, Math.abs(th - sm));
}
console.log('u 0~0.5, c 0.05~0.3 의 45개 조합: 이론과 시뮬의 최대 차이', pc(maxErr));
for (const u of [0, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5]) { const P = Object.assign({}, D, { u }); console.log(`  u=${u}: 이론 ${pc(W.theoryWar(P))} 시뮬 ${pc(W.bargainRun(P, 100000, 4))}`); }
for (const c of [0.05, 0.1, 0.15, 0.2, 0.25]) { const P = Object.assign({}, D, { c }); console.log(`  c=${c}: 이론 ${pc(W.theoryWar(P))} 시뮬 ${pc(W.bargainRun(P, 100000, 4))}`); }
// 공개 정보에서는 항상 합의: A가 p를 안다면 협상 범위 안(요구 = p+c)을 불러 거절이 없다. u=0
console.log('정보가 완전할 때(u=0) 전쟁', pc(W.bargainRun(Object.assign({}, D, { u: 0 }), 20000, 1)));
console.log('\n== 2) 군비 경쟁 (Richardson): k < a 이면 안정, 균형 g/(a-k) ==');
let ok = 0, tot = 0, bad = [];
for (let k = 0.1; k <= 1.0001; k += 0.05) for (let a = 0.1; a <= 1.0001; a += 0.05) {
  const P = Object.assign({}, D, { k, a }); const r = W.armsRun(P, 2000, 2); const sim = r.cross < 0;
  const th = Math.abs(k - a) < 1e-9 ? null : W.armsStable(P); if (th === null) continue; tot++;
  if (sim === th) ok++; else bad.push(`k=${f(k, 2)} a=${f(a, 2)}`);
}
console.log(`k, a 0.1~1.0 (경계 k=a 제외) ${tot}개 조합에서 '시뮬 2000라운드 동안 과열선 안 넘음'과 'k<a' 일치: ${ok}/${tot}`, bad.slice(0, 6).join(', '));
for (const [k, a] of [[0.4, 0.6], [0.5, 0.6], [0.55, 0.6]]) { const P = Object.assign({}, D, { k, a }); const r = W.armsRun(P, 400, 1); console.log(`  k=${k} a=${a}: 이론 균형 ${f(W.armsLevel(P), 2)}, 시뮬 마지막 100개 평균 ${f(r.xs.slice(-100).reduce((s, v) => s + v, 0) / 100, 2)}`); }
for (const [k, a] of [[0.6, 0.45], [0.5, 0.45], [0.7, 0.45], [0.9, 0.45]]) { const P = Object.assign({}, D, { k, a }); const rs = [1, 2, 3, 4, 5].map((s) => W.armsRun(P, 160, s).cross); console.log(`  k=${k} a=${a}: 과열선(${D.danger}) 첫 도달 라운드(시드 1~5)`, rs.join(', ')); }
console.log('\n== 3) 번짐: 정사각 격자 결합 퍼콜레이션 임계 q=0.5 (15x15=225개국, 한 나라에서 시작) ==');
for (const q of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0]) { const s = W.spreadStats(q, D.grid, 2000, 1); console.log(`  q=${q}: 평균 참전 ${f(s.mean, 1)}개국 (${pc(s.mean / 225)}), 전체의 25% 이상으로 번진 비율 ${pc(s.big)}`); }
{ const s = W.spreadStats(0.5, D.grid, 20000, 2), N = 225; const cnt = (a, b) => s.sizes.filter((v) => v >= a && v < b).length / s.sizes.length;
  console.log('q=0.5 규모 분포(2만 번): 1~2개국', pc(cnt(1, 3)), ' 3~9', pc(cnt(3, 10)), ' 10~29', pc(cnt(10, 30)), ' 30~99', pc(cnt(30, 100)), ' 100개국 이상', pc(cnt(100, 1e9)), ' 최대', Math.max(...s.sizes));
  const s2 = W.spreadStats(0.3, D.grid, 20000, 2); console.log('q=0.3: 30개국 이상', pc(s2.sizes.filter((v) => v >= 30).length / 20000), ' 최대', Math.max(...s2.sizes)); }
// 애니메이션 상태가 이론과 맞는지
const sm = W.create({ seed: 1 }).run(); console.log('\n기본 애니메이션 160라운드:', sm.disputes.length, '건 중 전쟁', pc(sm.warRate()), ' 군비 과열선 도달 라운드', sm.cross, ' 끝난 번짐', sm.sizes.length, '번 규모', sm.sizes.join(','));
