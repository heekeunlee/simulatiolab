// 점 몇 개면 그림이 보일까 (halftone) 검증.  사용법: node tools/validate-halftone.js
const H = require('../site/experiments/halftone/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const med = (a) => { const b = a.filter((v) => v != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const pc = (v) => (v * 100).toFixed(0) + '%';
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const at = (s, n) => { let c = 0; for (const [k, v] of s.hist) if (k <= n) c = v; return c; };
function report(o, label) {
  const rs = SEEDS.map((seed) => H.create(Object.assign({ seed }, o)).run());
  const ns = [10, 30, 100, 300, 1000, 3000, 6000, 12000, 20000].filter((n) => n <= o.count);
  console.log(label, ' 닮은 정도(시드 8개 평균): ' + ns.map((n) => n + '개 ' + pc(mean(rs.map((s) => at(s, n))))).join(' · '));
  console.log('   50% 도달 중앙값', med(rs.map((s) => s.reach(0.5))), '개 · 80%', med(rs.map((s) => s.reach(0.8))), '개 · 90%', med(rs.map((s) => s.reach(0.9))), '개 · 끝 덮인 면적', pc(mean(rs.map((s) => s.coverage()))));
  const pk = rs.map((s) => s.hist.reduce((a, b) => (b[1] > a[1] ? b : a)));
  console.log('   가장 닮았던 때(평균): 닮은 정도', pc(mean(pk.map((q) => q[1]))), '· 점', Math.round(mean(pk.map((q) => q[0]))), '개 근처');
  return rs;
}
console.log('기본 설정: 얼굴, 점 6,000개, 점 크기 1, 멀리서 보기 3');
report({ pic: 'face', count: 6000, size: 1, blur: 3 }, ' 얼굴');
report({ pic: 'land', count: 6000, size: 1, blur: 3 }, ' 풍경');
console.log('\n멀리서 보는 정도별 (얼굴, 점 20,000개까지, 점 크기 1)');
for (const b of [1, 2, 3, 4, 5, 6]) report({ pic: 'face', count: 20000, size: 1, blur: b }, '  흐림 ' + b);
console.log('\n점 크기별 (얼굴, 점 20,000개까지, 멀리서 보기 3)');
for (const z of [0.5, 1, 2, 3]) report({ pic: 'face', count: 20000, size: z, blur: 3 }, '  크기 ' + z);
console.log('\n같은 시드 재현:', H.create({ seed: 5, count: 800 }).run().sim() === H.create({ seed: 5, count: 800 }).run().sim());
