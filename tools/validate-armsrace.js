// 군비 경쟁은 어디서 멈출까(리처드슨 군비 경쟁 모델, 1년 단위) 검증.  사용법: node tools/validate-armsrace.js
// 페이지 문구는 이 출력과 같아야 한다. 모든 판은 시드 고정(1..100)이라 다시 돌려도 같다.
const M = require('../site/experiments/armsrace/sim.js');
const D = M.DEFAULTS, C = M.C;
const pct = (v) => Math.round(v * 100) + '%', r0 = (v) => (v == null ? '-' : Math.round(v));
const show = (o) => { const s = M.many(Object.assign({}, D, o), 100); return `과열선 넘은 판 ${pct(s.hotRate)} · 넘은 해 중앙값 ${s.medYear == null ? '-' : s.medYear + '년째'} · 안 넘은 판의 마지막 10년 합계 평균 ${r0(s.calmTotal)}`; };
console.log('기본값:', JSON.stringify(D), `· 상수: ${JSON.stringify(C)}`);

// [0] 기본 판 (사건 #1)
const r = M.run(D);
console.log(`\n[0] 기본 판(사건 #1): 과열선 100을 ${r.hot}년째에 넘음, ${r.t}년째에 200을 넘어 판 끝 · 커지는 빠르기(이론) 해마다 ${pct(M.theory(D.kA, D.kB, D.a, D.g).grow)}`);

// [1] 합의 방식별 (기본 설정, 100판씩, 합의는 10년째)
console.log('\n[1] 합의 방식별 (10년째부터, 100판)');
for (const ag of ['none', 'acut', 'aonly', 'both']) console.log(`    ${ag.padEnd(5)}: ${show({ agree: ag })}`);
const tb = M.theory(D.kA / 2, D.kB / 2, D.a, D.g), ta = M.theory(D.kA / 2, D.kB, D.a, D.g);
console.log(`    이론: 둘 다 절반 → 멈춤 ${tb.stable}, 합계 ${r0(tb.x + tb.y)} / A만 절반 → 멈춤 ${ta.stable}, 커지는 빠르기 해마다 ${(ta.grow * 100).toFixed(1)}%`);

// [2] 비용 부담(a)별 (반응 24%·24%, 불만 +1)
console.log('\n[2] 비용 부담별 (반응 24% 둘 다)');
for (const a of [0.1, 0.15, 0.2, 0.24, 0.25, 0.3, 0.4]) { const t = M.theory(D.kA, D.kB, a, D.g); console.log(`    부담 ${pct(a)}: ${show({ a })} | 이론 멈춤 ${t.stable}${t.stable ? ', 합계 ' + r0(t.x + t.y) : ''}`); }

// [3] 불만(g)별: 반응이 부담보다 클 때(기본) / 작을 때(반응 10%)
console.log('\n[3] 불만별');
for (const g of [-2, -1, -0.5, 0, 1, 2]) console.log(`    불만 ${g}: 기본 반응 → ${show({ g })} | 반응 10% → ${show({ g, kA: 0.1, kB: 0.1 })}`);
console.log(`    (반응 > 부담, 불만 < 0 일 때 계산상 문턱: 두 나라 합계 2|g|/(k−a). 불만 −1 → ${r0(2 / (D.kA - D.a))}, −0.5 → ${r0(1 / (D.kA - D.a))}, 처음 합계 ${2 * C.BASE})`);

// [4] 한쪽만 반응이 클 때 (A 0.4, B 변화)
console.log('\n[4] 한쪽만 반응이 클 때: A 40%');
for (const kB of [0, 0.03, 0.05, 0.06, 0.1]) { const t = M.theory(0.4, kB, D.a, D.g); console.log(`    B ${pct(kB)}: ${show({ kA: 0.4, kB })} | 곱 ${(0.4 * kB).toFixed(4)} vs 부담² ${(D.a * D.a).toFixed(4)} · 이론 ${t.stable ? 'A ' + r0(t.x) + ' / B ' + r0(t.y) : '폭주'}`); }

// [5] 처음 격차: 격차가 얼마나 빨리 사라지나 (반응 10%: 멈추는 쪽, 기본: 폭주 쪽)
console.log('\n[5] 처음 격차 20 (A 20, B 0)');
for (const o of [{ kA: 0.1, kB: 0.1 }, {}]) {
  const q = M.run(Object.assign({}, D, o, { gap: 20 }));
  const at = (t) => (t < q.xs.length ? `${r0(q.xs[t])}/${r0(q.ys[t])}` : '-');
  console.log(`    반응 ${pct(o.kA || D.kA)}: A/B 처음 ${at(0)} · 5년 ${at(5)} · 10년 ${at(10)} · 20년 ${at(20)} · 과열 ${q.hot}`);
  console.log(`       격차 0과 비교: ${show(Object.assign({}, o, { gap: 0 }))} | 격차 20: ${show(Object.assign({}, o, { gap: 20 }))}`);
}

// [6] 반응 지도 (441판, 지금 부담 15%, 불만 +1): 이론 경계와 맞는지
const G = M.grid(D, 20, 0.4);
let agree = 0, slow = 0; G.forEach((g) => { const th = M.theory(g.kA, g.kB, D.a, D.g); const hot = g.hot >= 0; if (hot === !th.stable) agree++; else slow++; });
console.log(`\n[6] 반응 지도 441판: 과열 ${G.filter((g) => g.hot >= 0).length}판 · 이론(곱 > 부담²)과 일치 ${agree}판, 불일치 ${slow}판`);
G.filter((g) => (g.hot >= 0) !== !M.theory(g.kA, g.kB, D.a, D.g).stable).slice(0, 12).forEach((g) => { const th = M.theory(g.kA, g.kB, D.a, D.g); console.log(`       불일치: A ${pct(g.kA)} B ${pct(g.kB)} → 과열 ${g.hot}, 이론 멈춤 ${th.stable}, 빠르기 ${(th.grow * 100).toFixed(1)}%, 합계 ${r0(g.total)}`); });

// [7] 건전성: 잡음 0이면 멈추는 수준이 이론값과 같은지, 이산 시간 고윳값
console.log('\n[7] 건전성');
for (const o of [{ kA: 0.1, kB: 0.1 }, { kA: 0.05, kB: 0.2 }, { kA: 0.12, kB: 0.12 }]) {
  const s = M.create(Object.assign({}, D, o, { noise: 0 })); for (let i = 0; i < 400 && !s.done; i++) s.step();
  const s2 = M.create(Object.assign({}, D, o, { noise: 0 })); C.YEARS = 2000; while (s2.step()); C.YEARS = 60;
  const t = M.theory(o.kA, o.kB, D.a, D.g); console.log(`    반응 ${pct(o.kA)}/${pct(o.kB)}, 잡음 0: 2000년 뒤 A ${s2.x.toFixed(3)} B ${s2.y.toFixed(3)} | 이론 A ${t.x.toFixed(3)} B ${t.y.toFixed(3)}`);
}
let worst = Infinity; for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) for (const a of [0.05, 0.15, 0.4]) { const kA = 0.01 * i, kB = 0.01 * j; const lo = 1 - a - Math.sqrt(kA * kB); worst = Math.min(worst, lo + 1); }
console.log(`    작은 고윳값 1 − a − √(kA·kB) 의 최소 + 1 = ${worst.toFixed(2)} (> 0 이면 이산 시간에서도 진동 폭주 없음 → 안정 조건은 곱 < 부담² 하나)`);
