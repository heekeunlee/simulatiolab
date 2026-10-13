// 캐리 트레이드와 환율 모델 검증.  사용법: node tools/validate-fxrate.js
const F = require('../site/experiments/fxrate/sim.js');
const f = (v, d = 2) => v.toFixed(d);
const base = { diff: 4, vol: 8, uip: 0.3, imp: 0.12, years: 20 };
const PATHS = 200;

console.log('1) 평균 캐리 수익 vs 이론 (1-uip)*금리차, 경로 ' + PATHS + '개 x 20년');
for (const [label, o] of [['쏠림 없음 uip=0', { imp: 0, uip: 0 }], ['쏠림 없음 uip=0.3', { imp: 0, uip: 0.3 }], ['쏠림 없음 uip=1', { imp: 0, uip: 1 }], ['쏠림 있음 uip=0', { uip: 0 }], ['쏠림 있음 uip=0.3 (기본)', {}], ['쏠림 있음 uip=1', { uip: 1 }]]) {
  const p = Object.assign({}, base, o), e = F.ensemble(p, PATHS), t = F.theoryMean(p);
  const se = (e.sd * Math.sqrt(52) * 100) / Math.sqrt(PATHS * p.years);
  console.log(`  ${label}: 이론 연 ${f(t.annual * 100)}% | 시뮬 연 ${f(e.annMean * 100)}% (표준오차 약 ${f(se)}) | 왜도 ${f(e.skew)} | 최대 낙폭 ${f(e.dd * 100, 1)}%p | 최악의 주 ${f(e.worst * 100, 1)}% | 수익 난 주 ${f(e.posShare * 100, 1)}%`);
}

console.log('2) 임의보행 검증 (쏠림 없음): 주간 변동성 vs 이론, 1주 자기상관');
{
  const p = Object.assign({}, base, { imp: 0, uip: 0 }); const sims = [];
  for (let k = 0; k < 100; k++) sims.push(F.create(Object.assign({}, p, { seed: 300 + k })).run());
  let sd = 0, ac = 0; sims.forEach((s) => { const st = F.simStats(s); sd += st.sd; let m = st.mean, a = 0, b = 0; for (let i = 1; i < s.ret.length; i++) a += (s.ret[i] - m) * (s.ret[i - 1] - m); s.ret.forEach((v) => { b += (v - m) * (v - m); }); ac += a / b; });
  console.log(`  주간 표준편차 시뮬 ${f(sd / sims.length * 100, 3)}% | 이론 vol/sqrt(52) = ${f(p.vol / Math.sqrt(52), 3)}% | 1주 자기상관 평균 ${f(ac / sims.length, 3)}`);
}

console.log('3) 기본 설정 한 경로 (시드 1~5)');
for (let s = 1; s <= 5; s++) {
  const m = F.create(Object.assign({}, base, { seed: s })).run(), st = F.simStats(m);
  console.log(`  시드 ${s}: 청산 ${m.crashes.length}번 | 연 평균 ${f(st.annMean * 100)}% | 최대 낙폭 ${f(st.dd * 100, 1)}%p | 최악의 주 ${f(st.worst * 100, 1)}% | 평균 주 이익 ${f(st.mean * 100, 3)}% | 최악/평균 ${st.worstOverMean ? f(st.worstOverMean, 0) : '-'}주치 | 왜도 ${f(st.skew)}`);
}
{
  const e = F.ensemble(base, PATHS), ws = e.stats.map((s) => s.worstOverMean).filter((v) => v).sort((a, b) => a - b);
  const cr = []; for (let k = 0; k < 100; k++) cr.push(F.create(Object.assign({}, base, { seed: 700 + k })).run().crashes.length / 20);
  console.log(`  200경로 평균: 최대 낙폭 ${f(e.dd * 100, 1)}%p, 최악의 주 ${f(e.worst * 100, 1)}%, 왜도 ${f(e.skew)}, 최악/평균 중앙값 ${f(ws[ws.length >> 1], 0)}주치, 연 청산 횟수 평균 ${f(cr.reduce((a, b) => a + b) / cr.length)}`);
}

console.log('4) 쏠림의 힘 imp 변화 (기본 나머지): 왜도 | 최대 낙폭 | 최악의 주');
for (const imp of [0, 0.05, 0.12, 0.2, 0.25]) { const e = F.ensemble(Object.assign({}, base, { imp }), 100); console.log(`  imp=${imp}: ${f(e.skew)} | ${f(e.dd * 100, 1)}%p | ${f(e.worst * 100, 1)}%`); }

console.log('5) 금리차 변화 (uip 0.3, 24경로, 페이지 ④와 같음): 연 평균 캐리 | 최악의 주 손실 | 평균 최대 낙폭 | 왜도');
F.sweepDiff(base, [0, 1, 2, 3, 4, 6, 8, 10], 24).forEach((d) => console.log(`  ${d.x}%p: ${f(d.mean)}% | ${f(d.loss, 1)}% | ${f(d.dd, 1)}%p | ${f(d.skew)}`));

console.log('6) 예측 비교(Meese-Rogoff 맛보기): 52주 뒤 환율 변화를 맞히기, 쏠림 없음 uip=0.3 vs 있음');
for (const imp of [0, 0.12]) {
  let eRW = 0, eUIP = 0, cnt = 0;
  for (let k = 0; k < 100; k++) { const s = F.create(Object.assign({}, base, { imp, seed: 900 + k })).run(); for (let t = 0; t + 52 < s.x.length; t += 26) { const a = s.x[t + 52] - s.x[t]; eRW += a * a; const b = a + base.diff / 100; eUIP += b * b; cnt++; } }
  console.log(`  imp=${imp}: 오차 제곱 평균의 제곱근 - 변화 없음 예측 ${f(Math.sqrt(eRW / cnt) * 100)}%p | UIP 예측(금리차만큼 약해짐) ${f(Math.sqrt(eUIP / cnt) * 100)}%p`);
}

console.log('7) 이론 대조 정밀판: 경로 3000개 x 20년. 쏠림이 있으면 환율 밀림의 합이 imp*(마지막 쏠림-처음 쏠림)이라 그만큼을 연으로 나눠 이론에 더해 비교');
for (const [label, o] of [['쏠림 없음 uip=0.3', { imp: 0, uip: 0.3 }], ['쏠림 없음 uip=1', { imp: 0, uip: 1 }], ['쏠림 있음 uip=0.3', { uip: 0.3 }], ['쏠림 있음 uip=1', { uip: 1 }]]) {
  const p = Object.assign({}, base, o); let sum = 0, cT = 0, sd = 0; const n = 3000;
  for (let k = 0; k < n; k++) { const s = F.create(Object.assign({}, p, { seed: 5000 + k })).run(); const st = F.simStats(s); sum += st.annMean; sd += st.annSd; cT += s.c[s.c.length - 1]; }
  cT /= n; const th = F.theoryMean(p).annual * 100, adj = p.imp * (cT - 0.1) / p.years * 100, se = (sd / n * 100) / Math.sqrt(n * p.years);
  console.log(`  ${label}: 이론 ${f(th)}% + 쏠림 보정 ${f(adj)}% = ${f(th + adj)}% | 시뮬 ${f(sum / n * 100)}% (표준오차 약 ${f(se)}) | 끝 쏠림 평균 ${f(cT)}`);
}

console.log('8) 페이지 히스토그램과 같은 설정: 경로 40개(시드 100~139) 주간 수익 중 -5% 아래인 주, 같은 평균·표준편차의 정규분포라면');
{
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  for (const imp of [0.12, 0]) {
    const e = F.ensemble(Object.assign({}, base, { imp }), 40, 100); let n = 0, s = 0, tail = 0; e.rets.forEach((r) => r.forEach((v) => { n++; s += v; if (v < -0.05) tail++; }));
    const mu = s / n; let s2 = 0; e.rets.forEach((r) => r.forEach((v) => { s2 += (v - mu) * (v - mu); })); const sd = Math.sqrt(s2 / n);
    console.log(`  imp=${imp}: 전체 ${n}주 중 -5% 아래 ${tail}주 (${f(tail / n * 100, 2)}%) | 정규분포 기대 ${f(n * Phi((-0.05 - mu) / sd), 1)}주 | 왜도 ${f(e.skew)}`);
  }
}
