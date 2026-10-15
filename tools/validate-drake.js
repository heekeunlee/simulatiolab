// 드레이크 방정식과 페르미 역설 검증.  사용법: node tools/validate-drake.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const D = require('../site/experiments/drake/sim.js');
const P = D.DEFAULTS, SEEDS = [1, 2, 3, 4];
// 페이지(app.js)와 같은 반올림: 1,000 이상 정수·쉼표, 10 이상 정수, 1 이상 소수 한 자리, 1 미만 유효숫자 2자리
const f = (v) => { if (v == null) return '-'; if (v >= 1000) return Math.round(v).toLocaleString('en-US'); if (v >= 10) return String(Math.round(v)); if (v >= 1) return String(Math.round(v * 10) / 10); if (v < 1e-6) return '0'; const d = Math.max(0, 1 - Math.floor(Math.log10(v))); return String(Number(v.toPrecision(2)).toFixed(d)).replace(/\.?0+$/, ''); };
const pow = (l) => Math.pow(10, l);
const mc = D.monteCarlo(P, 10000, 1);
console.log('기본 범위:', D.ranges(P).map((r) => `${r.id} ${f(pow(r.lo))}~${f(pow(r.hi))}`).join(' · '));
console.log('\n[1] 몬테카를로 1만 번 (기본 범위)');
console.log(`    가운데 값 ${f(pow(mc.median))}개 · 열 번 중 여덟 번(10~90%) ${f(pow(mc.p10))}~${f(pow(mc.p90))}개 · 1개 미만(우리뿐) ${(mc.pAlone * 100).toFixed(0)}% · 1,000개 이상 ${(mc.pMany * 100).toFixed(0)}%`);
console.log('    흔드는 몫(로그 눈금 분산): ' + mc.share.map((s) => `${s.id} ${(s.v * 100).toFixed(0)}%`).join(' · '));
// 이론값: log N은 고른 분포의 합 → 가운데 값 = 각 범위 가운데의 곱
console.log(`    이론: 가운데 값 = 범위 가운데의 곱 ${f(pow(mc.midLog))}개 (시뮬 ${f(pow(mc.median))})`);
const width = (m) => (m.p90 - m.p10);
console.log(`\n[2] 한 항만 정확히 안다면(그 항의 폭 0): 10~90% 범위의 폭(자릿수)`);
const FIX = {};
console.log(`    모두 모름 ${width(mc).toFixed(1)}자리`);
for (const id of ['L', 'fl', 'rs']) { const m2 = D.monteCarlo(Object.assign({}, P, { fix: id }), 10000, 1); FIX[id] = +width(m2).toFixed(1); console.log(`    ${id}만 앎 ${width(m2).toFixed(1)}자리 (${f(pow(m2.p10))}~${f(pow(m2.p90))}개)`); }
console.log('\n[3] 모르는 정도(범위 폭) 바꾸기');
const U = {};
for (const u of [0, 50, 100, 200]) { const m2 = D.monteCarlo(Object.assign({}, P, { u }), 10000, 1); U[u] = { med: m2.median, p10: m2.p10, p90: m2.p90, alone: Math.round(m2.pAlone * 100) }; console.log(`    ${u}%: 가운데 ${f(pow(m2.median))} · 10~90% ${f(pow(m2.p10))}~${f(pow(m2.p90))} · 1개 미만 ${(m2.pAlone * 100).toFixed(0)}%`); }

console.log('\n[4] 가상 은하(가운데 값: 1년에 문명이 생기는 빠르기 B = ' + f(D.rates(P).B) + '), 수명 L만 바꿔 4판 평균');
const SWEEP = { L: {}, mc: { median: +mc.median.toFixed(3), p10: +mc.p10.toFixed(3), p90: +mc.p90.toFixed(3), alone: Math.round(mc.pAlone * 100) }, fix: FIX };
for (const Ls of [20, 30, 40, 50, 60]) {
  const rows = SEEDS.map((seed) => D.summary(Object.assign({}, P, { L: Ls, seed })));
  const avg = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0) / rows.length;
  const rts = rows.filter((r) => r.rt != null), rt = rts.length ? rts.reduce((a, r) => a + r.rt, 0) / rts.length : null;
  const L = rows[0].L, o = { L, n: +avg('n').toPrecision(3), expect: rows[0].expect, rt: rt == null ? null : Math.round(rt), two: Math.round(avg('rtShare') * 100), ans: Math.round(avg('ans') * 100), died: Math.round(avg('died')) };
  SWEEP.L[Ls] = o;
  console.log(`    수명 ${f(L)}년: 동시에 켜진 문명 평균 ${o.n}개(이론 B·L = ${f(o.expect)}) · 둘 이상 켜진 시간 ${o.two}% · 가장 가까운 이웃 왕복 ${f(o.rt)}년 · 답장 받은 문명 ${o.ans}% (사라진 ${o.died}개 중)`);
}
console.log('\n[5] 건전성: 꾸준한 상태의 평균 수 = B·L (리틀의 법칙). 위 [4]의 평균과 이론값 비교. 점 줄이기(어림) 확인: 수명 100만 년·B 0.006(기대 6,000개)');
{ const o = { L: 60, rs: 3 + 7.78 }; // B를 6배
  const a = D.summary(Object.assign({}, P, o, { cap: 100000, seed: 1 })), b = D.summary(Object.assign({}, P, o, { cap: 3000, seed: 1 }));
  console.log(`    점을 다 그림: 평균 ${f(a.n)}개 · 왕복 ${f(a.rt)}년 · 답장 ${Math.round(a.ans * 100)}%  |  점 3,000개로 줄임(점 하나 = ${a.expect / 3000 > 1 ? f(b.m) : 1}개): 평균 ${f(b.n)}개 · 왕복 ${f(b.rt)}년 · 답장 ${Math.round(b.ans * 100)}%`); }
console.log('\nSWEEP = ' + JSON.stringify(SWEEP));
