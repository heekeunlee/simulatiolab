// 대기 시간의 역설 모델 검증.  사용법: node tools/validate-inspection.js
const I = require('../site/experiments/inspection/sim.js');
const f = (x, d = 1) => x.toFixed(d);
const big = (o) => { const s = I.create(Object.assign({ buses: 20000, n: 40000, seed: 3 }, o)); return s; };
console.log('평균 간격 10분. 변동계수(cv)별: 버스 간격 평균 | 승객이 본 간격 평균 (이론 10(1+cv^2)) | 평균 대기 실측 (이론 5(1+cv^2)) | 단순 계산 5');
for (const cv of [0, 0.25, 0.5, 1, 1.5, 2]) {
  const s = big({ cv }), t = I.theory(10, cv);
  console.log(`  cv=${cv}  버스 ${f(s.busMean)} (cv실측 ${f(s.busCv, 2)}) | 본 간격 ${f(s.meanSeen)} (이론 ${f(t.seen)}) | 대기 ${f(s.meanWait)} (이론 ${f(t.wait)}) | 단순 ${f(t.naive)}`);
}
console.log('기본 설정(평균 10분, cv 1.0, 승객 500명, 시드 1):');
const d = I.create({}); console.log('  평균 간격', f(d.busMean), ' 승객이 본 간격', f(d.meanSeen), ' 평균 대기', f(d.meanWait), ' 이론', f(d.theory.wait), ' 단순', f(d.theory.naive));
const ws = d.waits().sort((a, b) => a - b); console.log('  대기 중앙값', f(ws[250]), ' 최대', f(ws[499]));
let short = 0, long = 0; for (const q of d.pass) { if (q.gap < 10) short++; if (q.gap >= 20) long++; } console.log('  승객 중 평균(10분)보다 짧은 간격을 만난 비율', f(short / 5, 0) + '%', ' 20분 이상 간격', f(long / 5, 0) + '%');
let bl = 0; for (const h of d.heads) if (h >= 20) bl++; console.log('  버스 간격 중 20분 이상 비율', f(bl / d.heads.length * 100, 0) + '%');
console.log('평균 간격별(cv 1): 평균 간격 | 본 간격 | 대기');
for (const m of [2, 5, 10, 20, 30]) { const s = big({ mean: m, cv: 1 }); console.log(`  ${m}분  ${f(s.meanSeen)}  ${f(s.meanWait)}`); }
console.log('승객 수별 (cv 1, 평균 10) 대기 실측의 흔들림: 시드 1..20 중 최소~최대');
for (const n of [50, 500, 3000]) { const v = []; for (let k = 1; k <= 20; k++) v.push(I.create({ n, seed: k }).meanWait); console.log(`  ${n}명  ${f(Math.min(...v))} ~ ${f(Math.max(...v))}`); }
console.log('스윕 study 3000명 x3 (평균 10): cv 0, 0.5, 1, 2 대기', [0, 0.5, 1, 2].map((cv) => f([1, 2, 3].reduce((a, k) => a + I.study({ mean: 10, cv }, 3000, k * 7).wait, 0) / 3)).join(' / '));
console.log('학급 인원 (평균 25명, 20000학급): cv | 학급당 평균 | 학생당 평균 (이론 25(1+cv^2))');
for (const cv of [0, 0.2, 0.3, 0.5, 1, 1.5, 2]) { const c = I.classes({ cv, seed: 3, count: 20000 }); console.log(`  cv=${cv}  ${f(c.perClass)} | ${f(c.perStudent)} (이론 ${f(c.theoryPerStudent)})`); }
const c1 = I.classes({ cv: 1 }), c3 = I.classes({ cv: 0.3 });
console.log('기본 1000학급 cv1:', f(c1.perClass), f(c1.perStudent), ' cv0.3:', f(c3.perClass), f(c3.perStudent));
