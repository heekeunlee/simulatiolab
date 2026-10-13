// 10년 국채 금리·채권 가격 모델 검증.  사용법: node tools/validate-treasury.js
const T = require('../site/experiments/treasury/sim.js');
const f = (v, d = 2) => v.toFixed(d);
const pc = (v, d = 2) => (v * 100).toFixed(d);
const base = { r0: 2.5, b: 3.5, a: 0.3, sig: 1, tp: 0.5 };
const s = T.summary(base);
console.log('기본값(예시 숫자) 닫힌 해: 10년 금리', pc(s.y0), '%  듀레이션(수정)', f(s.mod), ' 매컬리', f(s.mac), ' +1%p →', pc(s.up), '%  -1%p →', pc(s.dn, 2), '%  단기 +1%p → 10년 금리', pc(s.dY, 3), '%p');
console.log('  앞으로 10년 단기금리 예상 평균', pc(s.avgExp), '%, 연속복리 수익률(프리미엄 전)', pc(s.ycc), '%, 정상상태 표준편차', pc(s.sdStat, 3), '%p');

// 1) 시뮬레이션 분포 vs 닫힌 해
const N = 20000, sm = T.create(Object.assign({}, base, { n: N, seed: 3 })).run(), q = sm.q;
console.log('\n[1] 단기금리 평균·표준편차 (시뮬 vs 이론), n =', N);
for (const yr of [1, 3, 5, 10]) {
  const m = yr * 12, v = sm.shortAt(m), mu = v.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(v.reduce((x, y) => x + (y - mu) * (y - mu), 0) / N);
  const mT = q.b + (q.r0 - q.b) * Math.exp(-q.a * yr), sT = q.sig * Math.sqrt((1 - Math.exp(-2 * q.a * yr)) / (2 * q.a));
  console.log(`  ${yr}년: 평균 ${pc(mu, 3)}% (이론 ${pc(mT, 3)}%)  표준편차 ${pc(sd, 3)}%p (이론 ${pc(sT, 3)}%p)`);
}

// 2) 몬테카를로 무이표채 가격 E[exp(-∫r dt)] vs 닫힌 해
console.log('\n[2] 10년 무이표채 가격 (몬테카를로 vs 닫힌 해)');
function mc(sim, tau) {
  const mm = tau * 12; let acc = 0, acc2 = 0;
  sim.R.forEach((r) => { let I = 0; for (let t = 0; t < mm; t++) I += 0.5 * (r[t] + r[t + 1]) * T.DT; const v = Math.exp(-I); acc += v; acc2 += v * v; });
  const n = sim.R.length, mean = acc / n, se = Math.sqrt((acc2 / n - mean * mean) / n); return { mean, se };
}
for (const tau of [2, 5, 10]) {
  const r = mc(sm, tau), P = T.zcb(q, q.r0, tau);
  console.log(`  ${tau}년: 시뮬 ${f(r.mean, 4)} (표준오차 ${f(r.se, 4)})  닫힌 해 ${f(P, 4)}  → 수익률 시뮬 ${pc(-Math.log(r.mean) / tau, 3)}% 닫힌 해 ${pc(-Math.log(P) / tau, 3)}%`);
}
console.log('  기대가설(예상 평균만) 10년 수익률', pc(s.avgExp, 3), '% vs 닫힌 해', pc(s.ycc, 3), '% → 차이(볼록성·위험 보정)', pc(s.ycc - s.avgExp, 3), '%p');

// 3) 듀레이션: 수치 미분 vs 공식
const y0 = s.y0, c = s.c, h = 1e-5;
const num = -(T.bondPrice(c, y0 + h) - T.bondPrice(c, y0 - h)) / (2 * h) / T.bondPrice(c, y0);
console.log('\n[3] 수정 듀레이션: 공식', f(s.mod, 4), ' 수치 미분', f(num, 4), '  (이표 =', pc(c), '%, 가격', f(T.bondPrice(c, y0), 3) + ')');
console.log('  선형(듀레이션) 예상 ±1%p:', pc(-s.mod * 0.01), '%  실제 +1%p', pc(s.up), '%  -1%p', pc(s.dn), '% → 볼록성이 하락은 덜, 상승은 더');
for (const yy of [2, 4, 6, 8]) { const cc = yy / 100; console.log(`  이표=금리 ${yy}% 채권: 수정 듀레이션 ${f(T.modified(cc, cc), 2)}`); }

// 4) 충격: 단기금리 +1%p가 10년 금리에 미치는 영향은 회귀 속도에 따라 다르다
console.log('\n[4] 단기금리 +1%p → 10년 금리(%p), 회귀 속도 a별 (닫힌 해)');
for (const a of [0.05, 0.15, 0.3, 0.6, 1.2]) { const z = T.summary(Object.assign({}, base, { a })); console.log(`  a=${a}: +${pc(z.dY, 2)}%p  (10년 금리 ${pc(z.y0, 2)}%)`); }
const sh = T.create(Object.assign({}, base, { n: 5000, seed: 5 })); sh.shock(0.01); sh.run();
const yy0 = T.create(Object.assign({}, base, { n: 5000, seed: 5 })).yieldsAt(0).reduce((x, y) => x + y, 0) / 5000, yy1 = sh.yieldsAt(0).reduce((x, y) => x + y, 0) / 5000;
console.log('  시뮬 충격 직후 평균 10년 금리 변화', pc(yy1 - yy0, 3), '%p');

// 5) 1년·3년 뒤 채권 가격 변화 분포 (가격만, 이자 제외)
console.log('\n[5] 가격 변화 분포 (시작 가격 100 대비, 이자 제외)');
for (const yr of [1, 3, 10]) {
  const v = sm.priceChangeAt(yr * 12).sort((x, y) => x - y), g = (p) => v[Math.floor(p * (N - 1))];
  const mu = v.reduce((x, y) => x + y, 0) / N;
  console.log(`  ${yr}년 뒤: 평균 ${pc(mu, 1)}%  하위5% ${pc(g(0.05), 1)}%  중앙 ${pc(g(0.5), 1)}%  상위5% ${pc(g(0.95), 1)}%  손실 확률 ${pc(v.filter((x) => x < 0).length / N, 0)}%`);
}
// 6) 10년 금리 평균 경로
console.log('\n[6] 기본값 평균 경로: 단기금리 vs 10년 금리 (시뮬 평균)');
for (const yr of [0, 1, 3, 5, 10]) { const m = yr * 12, a = (x) => x.reduce((p, q2) => p + q2, 0) / N; console.log(`  ${yr}년: 단기 ${pc(a(sm.shortAt(m)), 2)}%  10년 ${pc(a(sm.yieldsAt(m)), 2)}%`); }
// 프리미엄 효과
console.log('\n[7] 기간 프리미엄 0 / 0.5 / 1.5 → 10년 금리', [0, 0.5, 1.5].map((tp) => pc(T.summary(Object.assign({}, base, { tp })).y0)).join(' / '), '%');
