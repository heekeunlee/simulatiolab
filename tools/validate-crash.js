// 손절 연쇄 폭락(문턱 연쇄 + 가격 충격) 검증.  사용법: node tools/validate-crash.js
const S = require('../site/experiments/crash/sim.js');
const D = S.DEFAULTS, C = S.C, RUNS = 100;
const p1 = (v) => (v * 100).toFixed(1) + '%', p0 = (v) => Math.round(v * 100) + '%';
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const run = (p) => S.sweep(Object.assign({}, D, p), RUNS, 1);
const line = (lab, o) => `${lab}  큰 폭락 ${p0(o.big).padStart(4)} | 가운데 −${p1(q(o.drops, 0.5))} | 상위10% −${p1(q(o.drops, 0.9))} | 연쇄 ${mean(o.chains).toFixed(1)}단계 | 판 사람 ${p0(mean(o.sold))} | 중간(3~7%) ${p0(o.drops.filter((d) => d >= 0.03 && d < 0.07).length / RUNS)}`;
console.log('기본값: 충격 −' + D.shock + '% · 손절선 퍼짐', D.spread, '(표준편차', p1(S.SPREADS[D.spread - 1]) + ') · 빚', D.lev + '% · 시장 얇음', D.impact, '(계수', S.IMPACTS[D.impact - 1] + ') · 큰손', D.whale + '% · 저가 매수자', D.dip + '% · 보유자', C.N, '· 라운드', C.ROUNDS, '· 큰 폭락 기준 −' + p0(C.BIG));

// [0] 건전성: 흔들림 0, 보유자 모두가 한 라운드에 팔면 로그 가격이 계수 × 보유량/N 만큼 내려가는지
{
  const keep = C.NOISE; C.NOISE = 0;
  const s = S.create({ shock: 2, spread: 1, lev: 0, impact: 3, whale: 0, dip: 0, seed: 3 });
  s.people.forEach((a) => { a.line = 0; }); s.order.forEach((a) => { a.line = 0; });
  s.advance();
  const want = Math.log(0.98) - S.IMPACTS[2];
  console.log('\n[0] 건전성: 모두 한 번에 팔면 로그 가격', s.x.toFixed(5), '기대', want.toFixed(5), '차이', Math.abs(s.x - want).toExponential(1));
  const s2 = S.create({ shock: 2, spread: 3, lev: 20, impact: 3, whale: 0, dip: 0, seed: 1 }); s2.run();
  console.log('    판 사람 수 + 남은 사람 수 =', s2.soldPeople + s2.people.filter((a) => a.sold < 0).length, '(보유자', C.N + ')');
  const s3 = S.create({ shock: 2, spread: 3, lev: 0, impact: 3, whale: 0, dip: 0, seed: 1 }).run(), s4 = S.create({ shock: 2, spread: 3, lev: 0, impact: 3, whale: 0, dip: 0, seed: 1 }).run();
  console.log('    같은 시드 두 번: 하루 낙폭', p1(s3.drop()), p1(s4.drop()), s3.drop() === s4.drop() ? '같음' : '다름');
  C.NOISE = keep;
}

// [1] 장 #1 (화면 첫 판 = 내부 시드 8)
{
  const s = S.create(Object.assign({}, D, { seed: 8 })).run();
  console.log('\n[1] 장 #1 (시드 8): 하루 낙폭 −' + p1(s.drop()), '· 가장 낮을 때 −' + p1(1 - Math.exp(s.minX)), '· 연쇄', s.chainRounds, '단계 · 마지막으로 판 라운드', s.lastSaleRound, '· 판 사람', p0(s.soldShare()), '· 빚 낸 사람 중', p0(s.soldLev / s.levCount()), '· 큰손 판 라운드', s.whaleRound);
  console.log('    라운드별 낙폭(%):', s.path.map((x) => ((1 - Math.exp(x)) * 100).toFixed(1)).join(' '));
}

// [2] 기본 설정 100판
const base = run({});
console.log('\n[2] 기본 설정 100판:', line('', base));
console.log('    충격(−2%)의 몇 배로 빠졌나: 가운데', (q(base.drops, 0.5) / 0.02).toFixed(1), '배');

// [3] 손절선 퍼짐 × 충격 (촘촘하면 절벽, 퍼지면 완만)
console.log('\n[3] 손절선 퍼짐 × 외부 충격: 큰 폭락 비율 (가운데 낙폭)');
for (const sp of [1, 3, 5]) {
  const row = [1, 1.5, 2, 2.5, 3, 3.5, 4].map((sh) => { const o = run({ spread: sp, shock: sh }); return `−${sh}%: ${p0(o.big).padStart(4)} (−${p1(q(o.drops, 0.5))})`; });
  console.log(`    퍼짐 ${sp}  ` + row.join(' · '));
}
console.log('    충격 −1%일 때 가운데 낙폭: 퍼짐 1', '−' + p1(q(run({ spread: 1, shock: 1 }).drops, 0.5)), '· 퍼짐 5', '−' + p1(q(run({ spread: 5, shock: 1 }).drops, 0.5)));

// [4] 지렛대 하나씩 (나머지는 기본값)
console.log('\n[4] 하나씩 바꿀 때 (나머지 기본값, 100판씩)');
for (const sp of [1, 2, 3, 4, 5]) console.log(line(`    손절선 퍼짐 ${sp}`, run({ spread: sp })));
for (const l of [0, 10, 20, 40, 60]) console.log(line(`    빚 ${String(l).padStart(2)}%     `, run({ lev: l })));
for (const i of [1, 2, 3, 4, 5]) console.log(line(`    시장 얇음 ${i} `, run({ impact: i })));
for (const w of [0, 10, 20, 30, 40]) console.log(line(`    큰손 ${String(w).padStart(2)}%    `, run({ whale: w })));
for (const d of [0, 10, 20, 30, 40, 50]) console.log(line(`    저가 매수 ${String(d).padStart(2)}%`, run({ dip: d })));
for (const sh of [1, 1.5, 2, 2.5, 3]) console.log(line(`    충격 −${sh}%   `, run({ shock: sh })));

// [5] 큰손: 폭락 확률보다 크기
{
  const a = run({ whale: 0 }), b = run({ whale: 40 });
  const bigMean = (o) => { const x = o.drops.filter((d) => d >= C.BIG); return x.length ? mean(x) : 0; };
  console.log('\n[5] 큰손 0% → 40%: 큰 폭락', p0(a.big), '→', p0(b.big), '· 큰 폭락 판의 평균 낙폭 −' + p1(bigMean(a)), '→ −' + p1(bigMean(b)), '· 가장 크게 빠진 판 −' + p1(q(a.drops, 0.99)), '→ −' + p1(q(b.drops, 0.99)));
}
