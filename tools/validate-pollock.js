// 물감 뿌리기(폴록) 검증.  사용법: node tools/validate-pollock.js
// 페이지 문구의 숫자는 이 출력과 일치해야 한다.
const S = require('../site/experiments/pollock/sim.js');
const PER = S.G / S.STEP; // 캔버스 너비 하나 = 256걸음
const f = (v, d = 2) => v.toFixed(d);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const rad = (deg) => (deg * Math.PI) / 180;
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const base = { turn: rad(10), stroke: Math.round(1.2 * PER), amount: Math.round(60 * PER) };
const runAll = (o, ss = seeds) => ss.map((seed) => S.create(Object.assign({}, base, o, { seed })).run());
const show = (rs) => `복잡도 평균 ${f(mean(rs.map((s) => s.D())))} (범위 ${f(Math.min(...rs.map((s) => s.D())))}~${f(Math.max(...rs.map((s) => s.D())))}), 덮은 넓이 ${f(mean(rs.map((s) => s.cover())) * 100, 0)}%`;

console.log('기본값: 방향 트는 정도 10°, 한 번에 긋는 길이 캔버스 너비 1.2배, 물감 캔버스 너비 60배, 그림 8장');
for (const mode of ['brush', 'ruler', 'dots']) console.log('  ', mode.padEnd(5), show(runAll({ mode })));
{
  const r = runAll({ mode: 'brush' });
  console.log('  기본 그림 #1 획 수', r[0].strokes.length, ' 칸 수(큰 8x8 / 중간 32x32 / 작은 128x128):', r[0].counts[6], '/', r[0].counts[4], '/', r[0].counts[2]);
}

console.log('\n물감 양에 따라 (그림 5장 평균 복잡도)');
for (const A of [10, 30, 60, 120, 200]) {
  const o = { amount: Math.round(A * PER) }, ss = seeds.slice(0, 5);
  console.log(`  캔버스 너비 ${A}배:`, ['brush', 'ruler', 'dots'].map((mode) => mode + ' ' + f(mean(runAll(Object.assign({ mode }, o), ss).map((s) => s.D())))).join('  '),
    ' 붓질 덮은 넓이', f(mean(runAll(o, ss).map((s) => s.cover())) * 100, 0) + '%');
}

console.log('\n페이지 차트 ⑤ (그림 101~103 평균, 기본 길이·물감 양)');
console.log('  ', [0, 15, 30, 45, 60, 75, 90, 105, 120].map((t) => t + '°:' + f(mean(runAll({ turn: rad(t) }, [101, 102, 103]).map((s) => s.D())))).join('  '));
console.log('   자로 그은 직선', f(mean(runAll({ mode: 'ruler' }, [101, 102, 103]).map((s) => s.D()))), ' 무작위 점', f(mean(runAll({ mode: 'dots' }, [101, 102, 103]).map((s) => s.D()))));
console.log('  덮은 넓이: 0°', f(mean(runAll({ turn: 0 }).map((s) => s.cover())) * 100, 0) + '%', ' 120°', f(mean(runAll({ turn: rad(120) }).map((s) => s.cover())) * 100, 0) + '%');

console.log('\n방향을 자주 트는 붓(90°)에서 한 번에 긋는 길이에 따라 (그림 5장)');
for (const L of [0.2, 1.2, 4]) console.log(`  캔버스 너비 ${L}배:`, show(runAll({ turn: rad(90), stroke: Math.round(L * PER) }, seeds.slice(0, 5))));

console.log('\n방향 10° 대 120°: 같은 물감에서 큰 칸(8x8=64칸) 중 묻은 칸');
for (const t of [10, 120]) console.log(`  ${t}°:`, f(mean(runAll({ turn: rad(t) }).map((s) => s.counts[6])), 1), '칸');

const a = S.create(Object.assign({}, base, { seed: 5 })).run().D(), b = S.create(Object.assign({}, base, { seed: 5 })).run().D();
console.log('\n같은 시드 재현:', a === b);
