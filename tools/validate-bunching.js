// 버스 뭉침 모델 검증.  사용법: node tools/validate-bunching.js
const B = require('../site/experiments/bunching/sim.js');
const f = (v, d = 2) => v.toFixed(d);
const SEEDS = 20;
const base = { n: 6, demand: 40, eps: 5 };
const nom = B.nominal(Object.assign({}, B.DEFAULTS, base));
console.log(`이상적 간격 H=${f(nom.H)}분, 정차 ${f(nom.T, 3)}분/정류장, 한 바퀴 ${f(nom.lap, 1)}분 (정류장 24개, 버스 6대, 정류장당 40명/시간)`);
// 1) 이론: 간격이 모두 같으면 도착이 무작위일 때 평균 기다림은 H/2, 간격이 h_i이면 sum h^2 / (2 sum h) = (H/2)(1+CV^2)
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('\n[기다림 이론식 확인] 시뮬 실측 기다림 vs (H/2)(1+CV^2), 뒤쪽 절반 평균, 시드', SEEDS, '개');
for (const rem of ['none', 'hold', 'limit']) {
  const meas = [], pred = [], cvs = [];
  for (let k = 1; k <= SEEDS; k++) {
    const s = B.create(Object.assign({}, base, { remedy: rem, seed: k })).run(), M = s.p.minutes, h = M / 2;
    meas.push(s.waitIn(h, M));
    let q = 0, c = 0; for (let i = h; i <= M; i++) { const g = s.rec.gaps[i]; q += 1 + s.rec.cv[i] ** 2; c++; }
    pred.push((nom.H / 2) * (q / c) * (s.lapIn(h, M) / nom.lap)); cvs.push(s.cvIn(h, M));
  }
  console.log(`  ${rem.padEnd(5)} 실측 ${f(mean(meas))}분  식 ${f(mean(pred))}분  평균 CV ${f(mean(cvs))}`);
}
// 2) 군집 진행
console.log('\n[간격 변동계수(CV) 변화] 처방별, 시드 평균 (시간: 0/30/60/90/120/180/240/300/360분)');
const T = [0, 30, 60, 90, 120, 180, 240, 300, 360];
for (const rem of ['none', 'hold', 'limit']) {
  const acc = T.map(() => 0);
  for (let k = 1; k <= SEEDS; k++) { const s = B.create(Object.assign({}, base, { remedy: rem, seed: k })).run(); T.forEach((t, i) => (acc[i] += s.rec.cv[t] / SEEDS)); }
  console.log('  ' + rem.padEnd(5), acc.map((v) => f(v)).join(' '));
}
// 3) 처방별 요약 (뒤쪽 절반)
console.log('\n[처방별 평균 기다림 / 한 바퀴 시간 / CV, 시드', SEEDS, '개 평균]');
const R = {};
for (const rem of ['none', 'hold', 'limit']) { R[rem] = B.summary(Object.assign({}, base, { remedy: rem }), SEEDS); console.log(`  ${rem.padEnd(5)} 기다림 ${f(R[rem].wait)}분 (이상 ${f(R[rem].even)}) 한 바퀴 ${f(R[rem].lap, 1)}분 CV ${f(R[rem].cv)}`); }
console.log(`  기다림 배수 none/이상 = x${f(R.none.wait / R.none.even, 1)}, hold/이상 = x${f(R.hold.wait / R.hold.even, 1)}, 한 바퀴 hold/none = x${f(R.hold.lap / R.none.lap, 2)}`);
// 4) 처음 어긋남이 0이어도?
console.log('\n[처음 어긋남별 처방 없음 CV 도달: 시드별 CV가 처음 0.5를 넘는 시각(분) 평균]');
for (const eps of [0, 5, 10, 25]) {
  const ts = [];
  for (let k = 1; k <= SEEDS; k++) { const s = B.create(Object.assign({}, base, { eps, seed: k })).run(); const i = s.rec.cv.findIndex((v) => v > 0.5); ts.push(i < 0 ? 360 : i); }
  console.log(`  eps=${eps}%: ${f(mean(ts), 0)}분`);
}
console.log('\n[버스 수별 (처방 없음) 기다림 / 이상]');
for (const n of [3, 4, 6, 8, 12]) { const s = B.summary({ n, demand: 40, eps: 5 }, SEEDS); console.log(`  n=${n}: 기다림 ${f(s.wait)} 이상 ${f(s.even)} 배수 x${f(s.wait / s.even, 1)} CV ${f(s.cv)}`); }
console.log('\n[수요별 (처방 없음)]');
for (const d of [10, 20, 40, 60, 90]) { const s = B.summary({ n: 6, demand: d, eps: 5 }, SEEDS); const h = B.summary({ n: 6, demand: d, eps: 5, remedy: 'hold' }, SEEDS); console.log(`  demand=${d}: 배수 x${f(s.wait / s.even, 1)} CV ${f(s.cv)} | hold CV ${f(h.cv)} 기다림 ${f(h.wait)}`); }
console.log('\n[화면 기본 설정 그대로: 시드 1~6 평균 = 막대 차트와 통계 카드]');
for (const rem of ['none', 'hold', 'limit']) { const s = B.summary(Object.assign({}, base, { remedy: rem }), 6); console.log(`  ${rem.padEnd(5)} 기다림 ${f(s.wait)}분 한 바퀴 ${f(s.lap, 1)}분 CV ${f(s.cv)}`); }
const one = B.create(Object.assign({}, base, { seed: 1 })).run(), g = one.rec.gaps[one.rec.gaps.length - 1];
console.log('  시드 1 처방 없음, 끝 시점 간격(이상=1):', g.map((v) => f(v)).join(' '), ' CV', f(one.rec.cv[one.rec.cv.length - 1]), ' 기다림 배수 1+CV^2 = ', f(1 + one.rec.cv[one.rec.cv.length - 1] ** 2, 1));
