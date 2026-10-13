// 선행학습 딜레마 모델 검증.  사용법: node tools/validate-hagwon.js
const H = require('../site/experiments/hagwon/sim.js');
const f = (v, d = 1) => v.toFixed(d), pc = (v, d = 1) => (v * 100).toFixed(d) + '%';
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const D = H.DEFAULTS;
console.log('기본값: 가구', D.n, ' 학원 효과', D.beta, '점 · 비용', D.cost, ' 상한', D.cap, ' 운 sd', D.sdLuck, ' 합격선', D.cutoff, ' tau', D.tau, ' 라운드', D.rounds);

// 1. 이론: 모두가 같은 수준 e일 때, 혼자 한 개 더 보낸 가구의 순위 이득 = Phi(beta / (sigma*sqrt2)) - 1/2 (상대평가)
const sg = H.sigma(D), th = H.Phi(D.beta / (sg * Math.SQRT2)) - 0.5;
console.log('\n[1] 상대평가: 모두가 같은 수준일 때 혼자 한 개 더 보낸 평균 순위 이득 (이론) =', pc(th, 2), ' (sigma =', f(sg, 3) + ')');
// 시뮬: 아이 많이(n=20000) 점수 = base + beta*e, 한 가구씩 beta만큼 올려 보고 순위 변화를 평균 (표본)
function devGain(n, e, seed, beta, mode) {
  const S = H.create({ n, seed, beta, mode, cap: 5, rounds: 0 });
  S.e.fill(e); const score = Float64Array.from(S.base, (b) => b + beta * e), sorted = Float64Array.from(score).sort();
  const lower = (s) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < s) lo = m + 1; else hi = m; } return lo; };
  const out = (own, s2) => (lower(s2) - (own < s2 ? 1 : 0)) / (n - 1);
  let g = 0; for (let i = 0; i < n; i++) g += out(score[i], score[i] + beta) - out(score[i], score[i]);
  return g / n;
}
for (const e of [0, 1, 2, 4]) console.log('   e =', e, ' 시뮬(n=20000) 평균 이득', pc(mean([1, 2, 3].map((s) => devGain(20000, e, s, D.beta))), 2), ' 이론', pc(H.symmetric(D, e).gainOne, 2));
for (const b of [0.1, 0.2, 0.4, 0.5]) console.log('   beta =', b, ' 시뮬', pc(mean([1, 2, 3].map((s) => devGain(20000, 2, s, b))), 2), ' 이론', pc(H.Phi(b / (sg * Math.SQRT2)) - 0.5, 2));

// 2. 모두가 같은 수준이면 순위가 하나도 안 바뀐다 (1개 -> 2개: 비용 2배)
{
  const n = 300, S = H.create({ n, seed: 1, rounds: 0 }); const rk = (e) => { S.e.fill(e); return S.outcomes(); };
  const r0 = rk(0), r1 = rk(1), r2 = rk(2), r5 = rk(5);
  const md = (a, b) => Math.max(...Array.from(a, (v, i) => Math.abs(v - b[i])));
  console.log('\n[2] 모두 같은 수준일 때 순위 변화 최댓값: 0개→1개', md(r0, r1).toExponential(1), ' 1개→2개', md(r1, r2).toExponential(1), ' 0개→5개', md(r0, r5).toExponential(1));
  console.log('    평균 순위 (모두 2개)', f(mean(r2), 3), ' 학원비: 1개일 때', f(D.cost * 1, 2), '→ 2개일 때', f(D.cost * 2, 2), '(가구당), 총액 2배');
}

// 3. 죄수의 딜레마 구조: 이론(상대평가, 비용 0.04, 효과 0.3)
console.log('\n[3] 죄수의 딜레마 구조 (상대평가, 이론값)');
const s0 = H.symmetric(D, 0), s5 = H.symmetric(D, 5), s4 = H.symmetric(D, 4);
console.log('    모두 0개 순이득', pc(s0.net), '| 모두 5개 순이득', pc(s5.net), '| 혼자 한 개 더 이득', pc(s0.gainOne, 2), '> 비용', pc(D.cost, 2), '→ 우월전략', s0.gainOne > D.cost);
console.log('    모두 4개에서 혼자 5개로: 이득 − 비용 =', pc(s4.gainOne - D.cost, 2), ' 균형 수준(이론)', H.equilibriumLevel(D));
for (const c of [0.02, 0.04, 0.07, 0.08, 0.1]) console.log('    비용', c, '→ 이론 균형 수준', H.equilibriumLevel(Object.assign({}, D, { cost: c })), ' (이득', pc(th, 2) + ')');

// 4. 절대평가 이론값 (모두 같은 수준)
console.log('\n[4] 절대평가 이론값: 모두 같은 수준 e → 평균 합격 가능성 | 순이득 | 혼자 한 개 더 이득');
for (const e of [0, 1, 2, 3, 4, 5]) { const s = H.symmetric(Object.assign({}, D, { mode: 'abs' }), e); console.log('   e =', e, pc(s.outcome), '|', pc(s.net), '|', pc(s.gainOne, 2)); }
console.log('    절대평가 균형 수준(이론)', H.equilibriumLevel(Object.assign({}, D, { mode: 'abs' })));

// 5. 시뮬레이션 동역학 (시드 1~5 평균; 시드 1 값도 따로)
function run(o, seeds) {
  return seeds.map((seed) => { const s = H.create(Object.assign({ seed }, o)).run(), R = s.params.rounds, ch = s.change();
    return { e0: s.meanE[0], e1: s.meanE[R], x: s.meanE[0] > 0 ? s.meanE[R] / s.meanE[0] : NaN, o0: s.outcome[0], o1: s.outcome[R], n0: s.net[0], n1: s.net[R], up: ch.up, dn: ch.down, marg: s.marginal(), s };
  });
}
function show(name, o) {
  const r = run(o, [1, 2, 3, 4, 5]), a = (k) => mean(r.map((x) => x[k]));
  const r1 = r[0];
  console.log(`  ${name}: 평균 학원 ${f(a('e0'), 2)}→${f(a('e1'), 2)} (시드1 ${f(r1.e0, 2)}→${f(r1.e1, 2)}) · 학원비 ×${f(a('x'))} (시드1 ×${f(r1.x)}) · 결과 ${pc(a('o0'), 0)}→${pc(a('o1'), 0)} (시드1 ${pc(r1.o0, 0)}→${pc(r1.o1, 0)}) · 순이득 ${pc(a('n0'), 0)}→${pc(a('n1'), 0)} (시드1 ${pc(r1.n0, 0)}→${pc(r1.n1, 0)}) · 오른 집 ${pc(a('up'), 0)} 내린 집 ${pc(a('dn'), 0)} (시드1 ${pc(r1.up, 0)}/${pc(r1.dn, 0)})`);
}
console.log('\n[5] 시뮬레이션 (100라운드, 시드 1~5 평균)');
show('상대평가 기본', {});
show('절대평가', { mode: 'abs' });
show('상한 2개', { cap: 2 });
show('상한 0개', { cap: 0 });
show('비용 0.02', { cost: 0.02 });
show('비용 0.07', { cost: 0.07 });
show('비용 0.10', { cost: 0.1 });
show('효과 0.15', { beta: 0.15 });
show('효과 0.5', { beta: 0.5 });
{
  const s = H.create({ seed: 1 }).run(), R = s.params.rounds;
  const first = (v) => s.meanE.findIndex((x) => x >= v);
  console.log('  상대평가 시드1: 평균 학원 2개 넘는 라운드', first(2), ' 3개', first(3), ' 4개', first(4), ' | 마지막 라운드 평균 순위', f(s.outcome[R], 3), '(항상 0.5)');
  const lv = s.shares[R].map((v) => pc(v, 0)).join(' '); console.log('  마지막 학원 수별 비율(0~5개):', lv);
  // 가구의 기본 실력 점수 위치별 투입: 상·하위 극단 아이의 학원 수
  const idx = Array.from(s.base, (b, i) => i).sort((a, b) => s.base[a] - s.base[b]), q = (a, b) => mean(idx.slice(Math.floor(a * 300), Math.floor(b * 300)).map((i) => s.e[i]));
  console.log('  기본 점수 하위 10%:', f(q(0, 0.1)), '개 · 가운데 40~60%:', f(q(0.4, 0.6)), '개 · 상위 10%:', f(q(0.9, 1)), '개');
}
// 6. 재현성
console.log('\n[6] 같은 시드 같은 결과:', H.create({ seed: 5 }).run().meanE.join() === H.create({ seed: 5 }).run().meanE.join());
