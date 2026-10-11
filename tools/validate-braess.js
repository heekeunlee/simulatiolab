// 브라에스의 역설 모델 검증.  사용법: node tools/validate-braess.js
const B = require('../site/experiments/braess/sim.js');
const f = (v, d = 1) => v.toFixed(d);
const base = { n: 4000, cost: 0, sens: 10 };
const s0 = B.summary(base);
console.log('교과서 설정 (4000명, 지름길 0분, x/100): 닫힘', f(s0.closed), ' 열림', f(s0.open), ' 사회 최적', f(s0.opt), ' 무정부 가격', f(s0.poa, 3), ' 열림 점유', s0.openShares.map((v) => f(v, 2)).join('/'));
// 시뮬레이션 (유한한 운전자) vs 이론
for (const plan of ['open', 'close']) {
  const sm = B.create(Object.assign({}, base, { plan, seed: 1 })).run();
  const at = (i) => f(sm.avg[i]);
  const last = sm.shares[sm.shares.length - 1].map((v) => f(v * 100, 0) + '%').join('/');
  console.log(`시뮬 plan=${plan}: 라운드 0 ${at(0)}, 50 ${at(50)}, 180 ${at(180)}  마지막 점유(A/B/지름길) ${last}  바뀐 곳`, JSON.stringify(sm.changes));
}
// 시뮬 균형이 진짜 내시 균형인가 (아무도 옮겨서 이득을 못 본다) + 여러 시드·설정에서 이론과 비교
console.log('설정별 이론 vs 시뮬(180라운드 마지막 평균), 시드 1~3 평균');
for (const o of [{ n: 4000 }, { n: 2000 }, { n: 3000 }, { n: 4500 }, { n: 6000 }, { n: 8000 }, { n: 4000, cost: 10 }, { n: 4000, cost: 20 }, { n: 4000, cost: 30 }, { n: 4000, sens: 5 }, { n: 4000, sens: 20 }]) {
  const p = Object.assign({}, base, o), s = B.summary(p);
  const sims = [1, 2, 3].map((seed) => { const m = B.create(Object.assign({}, p, { seed, rounds: 180 })).run(); return [m.avg[50], m.avg[m.avg.length - 1]]; });
  const mean = (i) => sims.reduce((x, y) => x + y[i], 0) / sims.length;
  console.log(`  n=${p.n} cost=${p.cost} sens=${p.sens}: 이론 닫힘 ${f(s.closed)} 열림 ${f(s.open)} 최적 ${f(s.opt)} PoA ${f(s.poa, 3)} | 시뮬 50R ${f(mean(0))} 끝 ${f(mean(1))}`);
}
// 지름길이 도움/해가 되는 구간 (비용 0, x/100)
console.log('운전자 수별 (비용 0, x/100): 닫힘 | 열림 | 최적 | PoA | 열림-닫힘');
for (const n of [500, 1000, 2000, 3000, 3500, 4000, 4500, 5000, 6000, 8000, 9000, 10000]) { const s = B.summary({ n, cost: 0, sens: 10 }); console.log(`  ${String(n).padStart(5)}  ${f(s.closed)} | ${f(s.open)} | ${f(s.opt)} | ${f(s.poa, 3)} | ${f(s.change)}`); }
// 곡선으로 훑어 구간 경계 찾기
const ns = []; for (let n = 100; n <= 10000; n += 10) ns.push(n);
const cv = B.curveN(base, ns);
const helps = cv.filter((d) => d.open < d.closed - 1e-6), hurts = cv.filter((d) => d.open > d.closed + 1e-6);
console.log('도움이 되는 구간 끝', helps.length ? helps[helps.length - 1].x : '-', ' 해가 되는 구간', hurts[0].x, '~', hurts[hurts.length - 1].x);
const mx = cv.reduce((a, b) => (b.poa > a.poa ? b : a)); console.log('최대 무정부 가격', f(mx.poa, 3), 'at n =', mx.x, ' (선형 지연 시간의 상한 4/3 =', f(4 / 3, 3) + ')');
// 지름길 비용
console.log('지름길 비용별 (n=4000): 열림 균형 | 닫힘 | 최적');
for (const c of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]) { const s = B.summary({ n: 4000, cost: c, sens: 10 }); console.log(`  ${String(c).padStart(2)}분  ${f(s.open)} | ${f(s.closed)} | ${f(s.opt)}`); }
const cc = B.curveC(base, Array.from({ length: 451 }, (_, i) => i / 10));
const hurtC = cc.filter((d) => d.open > d.closed + 1e-6); console.log('n=4000에서 해가 되는 지름길 비용 구간: 0 ~', hurtC[hurtC.length - 1].x, ' (이 위에서는 지름길이 있어도 아무도 쓰지 않음)');
// 혼잡 민감도
console.log('혼잡 민감도(1000명당 분)별 (n=4000, 비용 0): 닫힘 | 열림 | PoA');
for (const sn of [4, 5, 8, 10, 15, 20]) { const s = B.summary({ n: 4000, cost: 0, sens: sn }); console.log(`  ${sn}  ${f(s.closed)} | ${f(s.open)} | ${f(s.poa, 3)}`); }
// 순서: 열었다 vs 막았다
const op = B.create(Object.assign({}, base, { plan: 'open', seed: 1 })).run(), cl = B.create(Object.assign({}, base, { plan: 'close', seed: 1 })).run();
console.log('열기 실험: 49R', f(op.avg[49]), '->180R', f(op.avg[180]), ' | 막기 실험: 49R', f(cl.avg[49]), '->180R', f(cl.avg[180]));
// 라운드별 수렴 속도
console.log('열기 실험 라운드별 평균:', [50, 55, 60, 70, 80, 90, 110, 130, 180].map((i) => i + ':' + f(op.avg[i])).join('  '));
console.log('막기 실험 라운드별 평균:', [50, 55, 60, 70, 80, 90, 110, 130, 180].map((i) => i + ':' + f(cl.avg[i])).join('  '));
// 균형 확인: 끝 상태에서 아무도 혼자 옮겨서 이득을 못 보는가 (유한 운전자의 내시 균형)
function isNash(p) {
  const m = B.create(p).run(), cn = m.counts(), a = p.sens / 1000, F = 45, c = p.cost, open = m.open;
  const cost = (r, LA, LB) => (r === 0 ? a * (LA + 1) + F : r === 1 ? F + a * (LB + 1) : a * (LA + 1) + c + a * (LB + 1));
  let worst = 0;
  for (let r = 0; r < 3; r++) {
    if (!cn[r]) continue;
    const k = cn.slice(); k[r]--; const LA = k[0] + k[2], LB = k[1] + k[2], cur = cost(r, LA, LB);
    for (let q = 0; q < (open ? 3 : 2); q++) worst = Math.max(worst, cur - cost(q, LA, LB));
  }
  return worst;
}
console.log('끝 상태에서 혼자 옮겨 얻는 최대 이득(분, 0 이하면 내시 균형):', [{ n: 4000, cost: 0, sens: 10, plan: 'open' }, { n: 4500, cost: 0, sens: 10, plan: 'open' }, { n: 4000, cost: 10, sens: 10, plan: 'open' }, { n: 2000, cost: 0, sens: 10, plan: 'open' }, { n: 4000, cost: 0, sens: 10, plan: 'close' }].map((p) => isNash(p).toFixed(4)).join(' '));
// 재현성: 같은 시드 -> 같은 결과
const r1 = B.create({ seed: 5 }).run().avg.join(','), r2 = B.create({ seed: 5 }).run().avg.join(','); console.log('같은 시드 같은 결과:', r1 === r2);
const o4 = B.optimum({ n: 4000, cost: 0, sens: 10, fixed: 45 }, true); console.log('사회 최적(4000명): 평균', f(o4.time, 2), ' 지름길 이용 비율', f(o4.shortcutShare * 100, 0) + '%');
const op2 = B.create(Object.assign({}, base, { plan: 'open', seed: 1 })).run(); const fr = op2.avg.findIndex((v, i) => i > 50 && v >= 79.5); console.log('열기 실험에서 평균이 79.5분에 닿는 라운드:', fr);
