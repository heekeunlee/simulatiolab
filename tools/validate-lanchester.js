// 란체스터 모델 검증.  사용법: node tools/validate-lanchester.js
const L = require('../site/experiments/lanchester/sim.js');
const f = (v, d = 1) => v.toFixed(d);
const SEEDS = 300;
function mc(o) {
  let wa = 0, wb = 0, sumA = 0, sumB = 0, steps = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const m = L.create(Object.assign({}, o, { seed: s })).run(), r = m.result();
    if (r.winner === 'a') { wa++; sumA += r.aLeft; } else if (r.winner === 'b') { wb++; sumB += r.bLeft; }
    steps += m.step;
  }
  return { wa: wa / SEEDS, wb: wb / SEEDS, leftA: wa ? sumA / wa : 0, leftB: wb ? sumB / wb : 0, steps: steps / SEEDS };
}
function row(name, o) {
  const th = L.outcome(o.law, o.a, o.b, o.q, o.split), s = mc(o);
  const w = th.winner, thLeft = w === 'a' ? th.aLeft : th.bLeft, start = w === 'a' ? o.a : o.b;
  const pad = (v) => f(v, 0).padStart(3);
  console.log(`${name}: 이론 승자 ${w || '무승부'} ${w ? `남음 ${f(thLeft)}명(${f(100 * thLeft / start, 0)}%)` : ''} | 시뮬 ${SEEDS}회 파랑 승 ${pad(100 * s.wa)}% 남음 ${f(s.leftA)}명 / 빨강 승 ${pad(100 * s.wb)}% 남음 ${f(s.leftB)}명 | 평균 ${f(s.steps, 0)}단계`);
}
const base = { a: 200, b: 100, q: 1, law: 'square', split: 'none' };
console.log('--- 기본값 (파랑 200 대 빨강 100, 질 같음)');
row('사각 법칙, 모여서', base);
row('선형 법칙, 모여서', Object.assign({}, base, { law: 'linear' }));
row('사각, 파랑(큰 쪽)이 둘로 나뉨', Object.assign({}, base, { split: 'a' }));
console.log('--- 130 대 100 (큰 쪽이 나뉘면 지는 예)');
const mid = { a: 130, b: 100, q: 1, law: 'square', split: 'none' };
row('사각, 모여서', mid); row('사각, 파랑이 둘로 나뉨', Object.assign({}, mid, { split: 'a' })); row('사각, 빨강이 둘로 나뉨', Object.assign({}, mid, { split: 'b' }));
row('선형, 모여서', Object.assign({}, mid, { law: 'linear' })); row('선형, 파랑이 둘로 나뉨', Object.assign({}, mid, { law: 'linear', split: 'a' }));
console.log('--- 200 대 100');
row('사각, 빨강(작은 쪽)이 둘로 나뉨', Object.assign({}, base, { split: 'b' }));
row('선형, 파랑이 둘로 나뉨', Object.assign({}, base, { law: 'linear', split: 'a' }));
row('선형, 빨강이 둘로 나뉨', Object.assign({}, base, { law: 'linear', split: 'b' }));
console.log('--- 같은 병력 100 대 100: 한쪽이 나뉘면');
const eq = { a: 100, b: 100, q: 1, law: 'square', split: 'none' };
row('사각, 모여서 (무승부 근처)', eq);
row('사각, 파랑이 둘로 나뉨', Object.assign({}, eq, { split: 'a' }));
row('선형, 파랑이 둘로 나뉨', Object.assign({}, eq, { law: 'linear', split: 'a' }));
console.log('--- 질로 병력을 메우기: 빨강 100, 파랑 200 에서 파랑 질이 낮으면');
for (const q of [1, 0.5, 0.25]) row(`사각 q=${q}`, Object.assign({}, base, { q }));
for (const q of [1, 0.5, 0.25]) row(`선형 q=${q}`, Object.assign({}, base, { q, law: 'linear' }));
console.log('--- 전투력 비율 (파랑÷빨강, 모여서)');
for (const [a, b, q] of [[200, 100, 1], [200, 100, 0.25], [200, 100, 0.5], [141, 100, 0.5], [300, 100, 1]]) console.log(`  ${a} 대 ${b}, q=${q}: 사각 ×${f(L.strengthRatio('square', a, b, q), 2)}  선형 ×${f(L.strengthRatio('linear', a, b, q), 2)}`);
console.log('--- 균형선 근처 (사각 q·r²=1): 승률이 절반쯤이어야 한다');
row('141 대 100, q=0.5 (사각 균형)', { a: 141, b: 100, q: 0.5, law: 'square', split: 'none' });
row('200 대 100, q=0.25 (사각 균형)', { a: 200, b: 100, q: 0.25, law: 'square', split: 'none' });
row('200 대 100, q=0.5 (선형 균형)', { a: 200, b: 100, q: 0.5, law: 'linear', split: 'none' });
console.log('--- 병력 2배일 때 남는 비율 (사각, q=1): 이론 √(1-1/4)=' + f(100 * Math.sqrt(0.75), 1) + '%');
console.log('  n=50,100,200,400 (파랑 2n 대 빨강 n):');
for (const n of [25, 50, 100, 200]) row(`   ${2 * n} 대 ${n}`, { a: 2 * n, b: n, q: 1, law: 'square', split: 'none' });
