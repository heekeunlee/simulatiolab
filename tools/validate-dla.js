// 확산 제한 응집(DLA) 검증.  사용법: node tools/validate-dla.js
const D = require('../site/experiments/dla/sim.js');
const f = (v, d = 2) => v.toFixed(d);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
console.log('고전 설정: 점 씨앗, 붙는 확률 100%, 입자 4000개, 시드 8개');
const runs = seeds.map((seed) => D.create({ stick: 1, shape: 'point', count: 4000, seed }).run());
const Ds = runs.map((s) => s.dimension().D);
console.log('  질량-반지름 기울기 D: 평균', f(mean(Ds)), '±', f(sd(Ds)), ' 범위', f(Math.min(...Ds)), '~', f(Math.max(...Ds)), ' (알려진 점근값 약 1.71)');
console.log('  가장 먼 끝까지 반지름: 평균', f(mean(runs.map((s) => s.rmax())), 0), '칸');
console.log('  원 안 채움 비율: 평균', f(mean(runs.map((s) => s.fill())) * 100, 1) + '%');
console.log('  입자당 걸음: 평균', f(mean(runs.map((s) => s.steps / s.n)), 0));
const L2 = runs.map((s) => s.landing(300));
console.log('  마지막 300개 중 바깥 30%(r/rmax>=0.7)에 붙은 비율: 평균', f(mean(L2.map((l) => l.bins.slice(14).reduce((a, b) => a + b, 0) / l.total)) * 100, 0) + '%, 안쪽 절반(r/rmax<0.5)에: 평균', f(mean(L2.map((l) => l.bins.slice(0, 10).reduce((a, b) => a + b, 0) / l.total)) * 100, 0) + '%');
// 입자 수에 따른 D (유한 크기 효과)
for (const n of [500, 1000, 2000, 4000, 8000]) {
  const d = seeds.slice(0, 5).map((seed) => D.create({ stick: 1, shape: 'point', count: n, seed }).run().dimension().D);
  console.log('  입자', n, '개: D 평균', f(mean(d)), '±', f(sd(d)));
}
console.log('\n붙는 확률에 따라 (점 씨앗, 입자 4000개, 시드 5개)');
for (const p of [1, 0.5, 0.2, 0.1, 0.05]) {
  const rs = [1, 2, 3, 4, 5].map((seed) => D.create({ stick: p, shape: 'point', count: 4000, seed }).run());
  console.log('  p =', p, ' D', f(mean(rs.map((s) => s.dimension().D))), ' 반지름', f(mean(rs.map((s) => s.rmax())), 0), ' 채움', f(mean(rs.map((s) => s.fill())) * 100, 0) + '%', ' 입자당 걸음', f(mean(rs.map((s) => s.steps / s.n)), 0));
}
console.log('\n페이지 차트 ④ (입자 1200개, 시드 100/101 평균 채움 비율, 점 씨앗)');
console.log('  ', [0.05, 0.1, 0.2, 0.4, 0.7, 1].map((p) => p + ':' + f(mean([100, 101].map((seed) => D.create({ stick: p, shape: 'point', count: 1200, seed }).run().fill())) * 100, 0) + '%').join('  '));
console.log('\n씨앗 모양 (붙는 확률 100%, 입자 3000개, 시드 3개): D(점은 중심 기준, 선·고리는 표본 기준)');
for (const shape of ['point', 'line', 'ring']) {
  const rs = [1, 2, 3].map((seed) => D.create({ stick: 1, shape, count: 3000, seed }).run());
  console.log('  ', shape, ' D', f(mean(rs.map((s) => s.dimension().D))), ' 반지름', f(mean(rs.map((s) => s.rmax())), 0), ' 채움', f(mean(rs.map((s) => s.fill())) * 100, 0) + '%');
}
console.log('\n같은 시드 재현:', D.create({ seed: 5, count: 800 }).run().dimension().D === D.create({ seed: 5, count: 800 }).run().dimension().D);
