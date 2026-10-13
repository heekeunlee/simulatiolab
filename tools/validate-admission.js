// 입소 배정 모델 검증.  사용법: node tools/validate-admission.js
const A = require('../site/experiments/admission/sim.js');
const f = (v, d = 1) => v.toFixed(d);
const NAME = { queue: '선착순', rsd: '추첨 순번', boston: '보스턴', da: '지연 수락(DA)' };
const base = { n: 200, m: 8, c: 0.6, rho: 0.5, ratio: 1.0, early: 0.25 };
const SEEDS = 12;

// 1) 닫힌 식: 모든 아이가 같은 순위(c=1)이고 자리 수 = 아이 수이면, 어떤 방식이든 각 지망에 정확히 1/M씩 배정된다 -> 평균 (M+1)/2, 1지망 1/M
console.log('1) 모두 같은 취향(c=1), 정원=아이 수, 8곳: 이론 평균 지망 ' + f((8 + 1) / 2, 2) + ', 1지망 비율 ' + f(100 / 8, 1) + '%');
for (const m of A.MECHS) {
  const S = A.make(Object.assign({}, base, { c: 1, seed: 1 })), r = A.metrics(S, A.run(S, m, S.prefs));
  console.log(`   ${NAME[m]}: 평균 ${f(r.avgRank, 2)}, 1지망 ${f(r.first * 100)}%, 미배정 ${r.unassigned}`);
}

// 2) 기관 순번이 모두 같으면(rho=0) 지연 수락과 추첨 순번 고르기는 같은 결과 (알려진 동치)
let same = 0, tot = 0;
for (let s = 1; s <= 30; s++) { const S = A.make(Object.assign({}, base, { rho: 0, seed: s })); const a = A.run(S, 'da', S.prefs), b = A.run(S, 'rsd', S.prefs); tot++; if (a.every((v, i) => v === b[i])) same++; }
console.log(`2) rho=0에서 DA와 추첨 순번 결과가 똑같은 경우: ${same}/${tot}`);

// 3) 애니메이션 기록의 마지막 장면이 실제 배정과 같은가
let okTrace = 0, totTrace = 0;
for (let s = 1; s <= 10; s++) for (const m of A.MECHS) { const S = A.make(Object.assign({}, base, { seed: s })); const fr = A.trace(S, m), a = A.run(S, m, S.prefs); totTrace++; if (fr[fr.length - 1].a.every((v, i) => v === a[i])) okTrace++; }
console.log(`3) 단계 기록의 마지막 = 실제 결과: ${okTrace}/${totTrace}`);

// 4) 기본 설정 평균 (시드 ${SEEDS}개)
console.log(`4) 기본 설정(아이 200, 8곳, c=0.6, rho=0.5, 정원=아이 수, 먼저 접수 25%) 시드 1~${SEEDS} 평균`);
const agg = {};
for (const m of A.MECHS) agg[m] = { first: 0, avg: 0, envy: 0, gap: 0, lie: 0, lieAvg: 0, lieN: 0, ealy: 0 };
for (let s = 1; s <= SEEDS; s++) {
  const S = A.make(Object.assign({}, base, { seed: s }));
  for (const m of A.MECHS) {
    const r = A.metrics(S, A.run(S, m, S.prefs)), mp = A.manip(S, m, 60), a = agg[m];
    a.first += r.first; a.avg += r.avgRank; a.envy += r.envy; a.gap += r.gap; a.lie += mp.share; if (mp.gain) { a.lieAvg += mp.sumGain; a.lieN += mp.gain; }
  }
}
for (const m of A.MECHS) { const a = agg[m]; console.log(`   ${NAME[m]}: 1지망 ${f(a.first / SEEDS * 100)}%  평균 지망 ${f(a.avg / SEEDS, 2)}  억울한 아이 ${f(a.envy / SEEDS * 100)}%  먼저 접수한 집의 이득 ${f(a.gap / SEEDS, 2)}지망  바꿔 적어 이득 ${f(a.lie / SEEDS * 100)}% (이득 볼 때 평균 ${a.lieN ? f(a.lieAvg / a.lieN, 1) : '-'}지망 좋아짐)`); }

// 5) 시드 1 한 장면 (페이지 첫 화면과 같은 설정)
const S1 = A.make(Object.assign({}, base, { seed: 1 })), cmp = A.compare(S1);
console.log('5) 시드 1 (첫 화면):');
for (const m of A.MECHS) { const r = cmp[m], mp = A.manip(S1, m, 60); console.log(`   ${NAME[m]}: 1지망 ${f(r.first * 100, 0)}%  평균 ${f(r.avgRank, 2)}  미배정 ${r.unassigned}  억울 ${f(r.envy * 100, 0)}%  바꿔 적어 이득 ${f(mp.share * 100, 0)}% (${mp.gain}/${mp.tested})  시험한 목록 ${mp.cand}개`); }
const bs = A.manip(S1, 'boston', 60).best; console.log('   보스턴에서 가장 이득 본 아이:', JSON.stringify({ child: bs.child, 솔직: bs.truthRank + 1, 바꿔적기: bs.lieRank + 1 }));
console.log('   그 아이를 DA에서 시험:', JSON.stringify((({ truthRank, lieRank, gain, cand }) => ({ 솔직: truthRank + 1, 최선: lieRank + 1, gain, cand }))(A.create(Object.assign({}, base, { seed: 1 })).childTest('da', bs.child))));

// 6) 설정을 바꿨을 때 (시드 1~3 평균)
console.log('6) 설정별 바꿔 적어 이득 보는 아이 비율 (시드 1~3, 아이 60명씩)');
for (const o of [{ c: 0 }, { c: 0.3 }, { c: 0.6 }, { c: 0.9 }, { ratio: 0.8 }, { ratio: 1.2 }, { rho: 0 }, { rho: 1 }]) {
  const line = A.MECHS.map((m) => { let g = 0, t = 0; for (let s = 1; s <= 3; s++) { const mp = A.manip(A.make(Object.assign({}, base, o, { seed: s })), m, 60); g += mp.gain; t += mp.tested; } return `${NAME[m]} ${f(g / t * 100, 0)}%`; }).join('  ');
  console.log('   ' + JSON.stringify(o) + '  ' + line);
}
// 7) 정원 부족 때의 미배정
console.log('7) 정원 80% / 90% / 100% / 120%일 때 미배정(아이 200): ' + [0.8, 0.9, 1, 1.2].map((r) => { const S = A.make(Object.assign({}, base, { ratio: r, seed: 1 })); return A.MECHS.map((m) => A.metrics(S, A.run(S, m, S.prefs)).unassigned).join('/'); }).join(' | '));
// 8) 속도
const t0 = Date.now(); A.MECHS.forEach((m) => A.manip(A.make(Object.assign({}, base, { seed: 5 })), m, 60)); console.log('8) 네 방식 시험 시간', Date.now() - t0, 'ms');
