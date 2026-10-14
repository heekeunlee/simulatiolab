// 관세 보복(두 나라 반복 게임) 검증.  사용법: node tools/validate-tariff.js
const S = require('../site/experiments/tariff/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pc = (v) => Math.round(v * 100) + '%';
const D = S.DEFAULTS, RUNS = 100;
console.log('기본값: 보복', pc(D.retal), '· 내리기 전 협상 신호', D.patience, '번 · 국내 압력', pc(D.pressure), '· 협상 빈도', pc(D.talk), '· 우연한 충격', pc(D.shock), '· 처음 A국', pc(D.first), '· 라운드', D.rounds, '· 관세 상한', pc(D.cap));

// 1. 한 라운드 이득표 (죄수의 딜레마 구조 확인)
console.log('\n[1] 한 라운드 이득 (나 / 상대): 둘 다 0%이면 각자 1');
for (const [a, b] of [[0, 0], [0.2, 0], [0, 0.2], [0.2, 0.2], [0.1, 0.2], [0.2, 0.1], [0.1, 0.1], [0.3, 0.3], [0.5, 0.5]])
  console.log(`    내 관세 ${pc(a).padStart(3)} · 상대 ${pc(b).padStart(3)} → 나 ${S.payoff(a, b).toFixed(2)} / 상대 ${S.payoff(b, a).toFixed(2)} · 합계 ${(S.payoff(a, b) + S.payoff(b, a)).toFixed(2)}`);
let best = 0, bv = -9; for (let t = 0; t <= 0.5001; t += 0.01) { const v = S.payoff(t, 0); if (v > bv) { bv = v; best = t; } }
console.log('    상대가 0%일 때 나에게 가장 이득인 관세', pc(best), '(한 라운드 이득', bv.toFixed(2) + ')');

// 2. 기본 설정 한 판(시드 1)
{
  const s = S.create({ seed: 1 }).run();
  console.log('\n[2] 기본 설정 시드 1: 합계', (s.total() / 200 * 100).toFixed(0) + '% (서로 안 올렸을 때 = 100%) · A국', s.cum[0].toFixed(1), '· B국', s.cum[1].toFixed(1), '· 끝 관세', pc(s.t[0]), '/', pc(s.t[1]), '· 평균 관세', pc(s.meanTariff()));
  console.log('    먼저 내린 나라', ['A국', 'B국'][s.firstDown], s.firstDownRound, '라운드 · 협상', s.talks, '번 · 최고 관세', pc(Math.max(...s.tA, ...s.tB)));
  console.log('    A국', s.tA.map((v) => Math.round(v * 100)).join(' '));
  console.log('    B국', s.tB.map((v) => Math.round(v * 100)).join(' '));
}

// 3. 보복 정도별 100판 (집계)
console.log('\n[3] 보복하는 정도별 100판 평균: 두 나라 합계 이득(서로 안 올렸을 때=100) | A국 | B국 | 평균 관세율 | 갈등이 끝난 판 (끝날 때 두 나라 모두 10% 이하)');
for (const r of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]) {
  const o = S.sweep(Object.assign({}, D, { retal: r, seed: 1 }), RUNS);
  console.log(`    보복 ${pc(r).padStart(4)}  합계 ${(mean(o.total) * 100).toFixed(0).padStart(3)} | A ${(mean(o.a) * 100).toFixed(0).padStart(3)} | B ${(mean(o.b) * 100).toFixed(0).padStart(3)} | 관세 ${pc(mean(o.tariff)).padStart(4)} | 끝남 ${pc(o.ended).padStart(4)}`);
}

// 4. 먼저 내린 쪽 vs 나중에 내린 쪽: 한쪽만 내린 동안의 한 라운드 이득 (둘 다 20%에서 시작)
console.log('\n[4] 둘 다 20% → 한쪽이 10%로 먼저 내림 → 둘 다 10%');
console.log('    둘 다 20%: 각자', S.payoff(0.2, 0.2).toFixed(2), '· 먼저 내린 쪽', S.payoff(0.1, 0.2).toFixed(2), '/ 아직 안 내린 쪽', S.payoff(0.2, 0.1).toFixed(2), '· 둘 다 10%: 각자', S.payoff(0.1, 0.1).toFixed(2));
{ // 기본 설정 100판: 먼저 내린 나라와 다른 나라의 누적 이득
  let fd = [], ot = [], n = 0, lower = 0;
  for (let k = 0; k < RUNS; k++) { const s = S.create({ seed: 1 + k }).run(); if (s.firstDown < 0) continue; n++; const a = s.cum[s.firstDown], b = s.cum[1 - s.firstDown]; fd.push(a); ot.push(b); if (a < b) lower++; }
  console.log(`    기본 설정 100판 중 누가 먼저 내린 판 ${n}판: 먼저 내린 나라 평균 ${mean(fd).toFixed(1)} · 다른 나라 ${mean(ot).toFixed(1)} · 먼저 내린 나라가 덜 번 판 ${lower}판`);
}

// 5. 다른 슬라이더 (보복 100%, 100판)
console.log('\n[5] 다른 규칙별 (보복 100%, 100판): 합계 | 끝남');
const show = (lab, o) => { const r = S.sweep(Object.assign({}, D, o, { seed: 1 }), RUNS); console.log(`    ${lab}  합계 ${(mean(r.total) * 100).toFixed(0)} | 관세 ${pc(mean(r.tariff))} | 끝남 ${pc(r.ended)}`); };
for (const p of [0, 0.3, 0.6, 0.9]) show(`국내 압력 ${pc(p)}`, { pressure: p });
for (const p of [1, 3, 6, 10]) show(`협상 신호 ${p}번`, { patience: p });
for (const p of [0.05, 0.25, 0.5]) show(`협상 빈도 ${pc(p)}`, { talk: p });

// 6. 우연한 충격이 없으면 / 재현성
{
  const s = S.create({ shock: 0, retal: 0 }).run();
  console.log('\n[6] 충격 없음·보복 0%: A국', s.cum[0].toFixed(1), '· B국', s.cum[1].toFixed(1), '· 끝 관세', pc(s.t[0]), '/', pc(s.t[1]));
  console.log('    같은 시드 같은 결과:', S.create({ seed: 5 }).run().tA.join() === S.create({ seed: 5 }).run().tA.join());
}
