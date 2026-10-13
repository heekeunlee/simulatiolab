// 마트 계산대 줄 서기 모델 검증.  사용법: node tools/validate-checkout.js
const C = require('../site/experiments/checkout/sim.js');
const f = (v, d = 2) => v.toFixed(d);
const NAME = { one: '한 줄', short: '짧은 줄', random: '무작위', items: '물건 적은 줄' };
const SEEDS = [1, 2, 3, 4, 5], N = 100000;
function avg(P, strats) { // 시드 평균
  const acc = {}; strats.forEach((s) => { acc[s] = { mean: 0, p90: 0, over: 0, worse: 0, better: 0, zero: 0 }; });
  SEEDS.forEach((sd) => { const r = C.compare(P, sd, N, strats); strats.forEach((s) => { const a = acc[s], x = r[s], n = SEEDS.length; a.mean += x.mean / n; a.p90 += x.p90 / n; a.over += x.overtaken / n; a.worse += x.pair.worse / n; a.better += x.pair.better / n; a.zero += x.zero / n; }); });
  return acc;
}
console.log('== 1) 이론과 시뮬레이션 (평균 계산 3분, 시드 5개 x 10만 명) ==');
console.log('한 줄 = M/M/c 얼랑 C 공식, 무작위 = 계산대마다 M/M/1 (둘 다 계산 시간 지수분포 cv=1에서 정확)');
for (const [k, rho] of [[2, 0.7], [4, 0.6], [4, 0.8], [4, 0.9], [6, 0.8], [8, 0.9]]) {
  const r = avg({ k, rho, cv: 1 }, ['one', 'random']), t1 = C.theoryOne(k, rho, 1), t2 = C.theoryRandom(k, rho, 1);
  console.log(`  k=${k} 붐빔 ${rho}: 한 줄 평균 시뮬 ${f(r.one.mean)} 이론 ${f(t1.mean)} | 90% 시뮬 ${f(r.one.p90, 1)} 이론 ${f(t1.p90, 1)} || 무작위 평균 시뮬 ${f(r.random.mean)} 이론 ${f(t2.mean)} | 90% 시뮬 ${f(r.random.p90, 1)} 이론 ${f(t2.p90, 1)}`);
}
console.log('\n== 2) 이론: 붐비는 정도가 같아도 계산 시간이 들쭉날쭉하면 (cv=1.5, 근사) ==');
for (const [k, rho] of [[4, 0.9]]) { const r = avg({ k, rho, cv: 1.5 }, ['one', 'random']); console.log(`  평균 한 줄 시뮬 ${f(r.one.mean)} 근사 ${f(C.theoryOne(k, rho, 1.5).mean)} | 무작위 시뮬 ${f(r.random.mean)} 이론 ${f(C.theoryRandom(k, rho, 1.5).mean)}`); }

console.log('\n== 3) 기본 설정 (계산대 4개, 붐빔 90%, cv=1): 방식 비교 ==');
const base = { k: 4, rho: 0.9, cv: 1 }, all = avg(base, C.STRATS);
C.STRATS.forEach((s) => { const x = all[s]; console.log(`  ${NAME[s].padEnd(8)} 평균 ${f(x.mean)}분  90% ${f(x.p90, 1)}분  바로 계산 ${f(x.zero * 100, 0)}%  추월당한 손님 ${f(x.over * 100, 0)}%  한 줄일 때보다 1분 넘게 더 기다림 ${f(x.worse * 100, 0)}% / 덜 기다림 ${f(x.better * 100, 0)}%`); });
console.log(`  평균 비율 짧은줄/한줄 ${f(all.short.mean / all.one.mean)}  무작위/한줄 ${f(all.random.mean / all.one.mean)}  물건적은줄/한줄 ${f(all.items.mean / all.one.mean)}  | 90% 비율 짧은줄/한줄 ${f(all.short.p90 / all.one.p90)}`);

console.log('\n== 4) 설정에 따라 (짧은 줄 / 한 줄 평균 대기 비율) ==');
for (const o of [{ k: 2 }, { k: 4 }, { k: 6 }, { k: 8 }, { rho: 0.6 }, { rho: 0.8 }, { rho: 0.95 }, { cv: 0.5 }, { cv: 1.5 }, { cv: 2 }]) {
  const P = Object.assign({}, base, o), r = avg(P, ['one', 'short', 'items']);
  console.log(`  ${JSON.stringify(o).padEnd(14)} 한줄 ${f(r.one.mean)} 짧은줄 ${f(r.short.mean)} (x${f(r.short.mean / r.one.mean)}) 물건적은줄 ${f(r.items.mean)} (x${f(r.items.mean / r.one.mean)}) | 90% 한줄 ${f(r.one.p90, 1)} 짧은줄 ${f(r.short.p90, 1)}`);
}
console.log('\n== 5) 계산대 수별 한 줄 평균 대기 (붐빔 90% 유지, 손님도 비례해 늘림) ==');
[1, 2, 4, 8].forEach((k) => { const r = avg({ k, rho: 0.9, cv: 1 }, ['one']); console.log(`  k=${k}: ${f(r.one.mean)}분`); });
console.log('\n== 6) 계산대가 놀고 있는데 다른 곳에 기다리는 손님이 있는 시간 비율 (k=4, 붐빔 90%, cv=1; 시드 평균) ==');
{ const acc = {}; C.STRATS.forEach((s) => { acc[s] = 0; });
  SEEDS.forEach((sd) => { const r = C.compare(base, sd, 30000); C.STRATS.forEach((s) => { acc[s] += r[s].idle / SEEDS.length; }); });
  C.STRATS.forEach((s) => console.log(`  ${NAME[s].padEnd(8)} ${f(acc[s] * 100, 1)}%`)); }
