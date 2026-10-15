// AI와 신입 사다리(가상의 업계) 검증.  사용법: node tools/validate-aijobs.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const M = require('../site/experiments/aijobs/sim.js');
const D = M.DEFAULTS, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const r0 = (v) => Math.round(v), mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const med = (a) => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
console.log('기본값:', JSON.stringify(D), `· 집계: 시드 ${SEEDS.length}개, ${D.years}해`);

// [0] 쌍둥이 확인: AI 대체율 0이면 두 업계가 똑같다
{ const s = M.create(Object.assign({}, D, { s: 0 })); while (s.step());
  const same = s.hist.cost.every((c, i) => Math.abs(c - s.hist.cost0[i]) < 1e-9);
  console.log(`\n[0] 대체율 0%: AI 쓰는 업계와 AI 없음 쌍둥이의 해마다 비용이 같은가 → ${same ? '같음' : '다름(버그)'}`); }

// [1] 기본 판(시드 1) 시간 흐름
{ const s = M.create(D); const at = [0, 5, 10, 15, 20, 25, 30]; while (s.step());
  const h = s.hist;
  console.log('\n[1] 기본 판(시드 1, 대체율 50%): 해 → 신입/중간/숙련 (AI 없음: 신입/중간/숙련) · 밀린 일 · 비용(AI 없음=100) · 숙련 임금 지수');
  at.forEach((t) => console.log(`    ${String(t).padStart(2)}해: ${h.J[t]}/${h.M[t]}/${h.S[t]} (${h.J0[t]}/${h.M0[t]}/${h.S0[t]}) · 밀린 일 ${r0(h.B[t])} · 비용 ${t ? r0((100 * h.cost[t - 1]) / h.cost0[t - 1]) : 100} · 지수 ${t ? h.idx[t - 1].toFixed(2) : '1.00'}`));
  const sum = (a, i, j) => a.slice(i, j).reduce((x, y) => x + y, 0);
  console.log(`    처음 5해 비용 ${r0((100 * sum(h.cost, 0, 5)) / sum(h.cost0, 0, 5))} · 마지막 5해 ${r0((100 * sum(h.cost, 25, 30)) / sum(h.cost0, 25, 30))} · 30해 합계 ${r0((100 * sum(h.cost, 0, 30)) / sum(h.cost0, 0, 30))} (AI 없음=100)`);
  console.log(`    처음 아낀 해 ${s.firstSave}, 해마다 비용이 역전된 해(3해 평균 1% 넘게) ${s.revYear}, 아낀 돈이 다 사라진 해 ${s.evenYear}`);
  console.log(`    숙련자: 처음 ${h.S[0]} → ${h.S[30]} (AI 없음 ${h.S0[30]}), 신입: ${h.J[0]} → ${h.J[30]}`); }

function run(o) {
  const rows = SEEDS.map((seed) => M.summary(Object.assign({}, D, { seed }, o)));
  const rv = rows.map((r) => (r.rev < 0 ? 99 : r.rev)), ev = rows.map((r) => (r.even < 0 ? 99 : r.even));
  const mr = med(rv), me = med(ev);
  return { rev: mr > 30 ? -1 : Math.round(mr), revN: rows.filter((r) => r.rev > 0).length, even: me > 30 ? -1 : Math.round(me), evenN: rows.filter((r) => r.even > 0).length,
    total: r0(100 * mean(rows.map((r) => r.total))), first5: r0(100 * mean(rows.map((r) => r.first5))), last5: r0(100 * mean(rows.map((r) => r.last5))),
    S: r0(mean(rows.map((r) => r.S))), S0: r0(mean(rows.map((r) => r.S0))), J: r0(mean(rows.map((r) => r.J))), B: r0(mean(rows.map((r) => r.B))) };
}
const line = (name, s) => console.log(`    ${name.padEnd(18)} 역전 ${s.rev < 0 ? '없음' : s.rev + '해'} (${s.revN}/8판) | 아낀 돈 사라짐 ${s.even < 0 ? '없음' : s.even + '해'} (${s.evenN}/8판) | 처음 5해 ${s.first5} · 마지막 5해 ${s.last5} · 30해 합계 ${s.total} | 숙련 ${s.S}/${s.S0} · 신입 ${s.J} · 밀린 일 ${s.B}`);
const SWEEP = { grid: {}, mix: {}, pen: {}, ret: {} };
console.log('\n[2] 대체율 × 보충 비율 (역전 해·사라진 해는 8판 중앙값, 30해 안에 없으면 없음)');
for (const s of [30, 50, 70, 90]) for (const b of [0, 50, 100]) { const k = s + '_' + b; SWEEP.grid[k] = run({ s, b }); line(`대체율 ${s}% 보충 ${b}%`, SWEEP.grid[k]); }
console.log('\n[3] 대체율 50%: 보충 비율 × AI가 가르치는 효과');
for (const b of [0, 50, 100]) for (const e of [0, 50]) { const k = b + '_' + e; SWEEP.mix[k] = run({ b, e }); line(`보충 ${b}% 가르침 ${e}%`, SWEEP.mix[k]); }
console.log('\n[4] 대체율 50%: 밀린 일 하나의 손해(벌점)');
for (const pen of [0, 1, 2, 4]) { SWEEP.pen[pen] = run({ pen }); line(`벌점 ${pen}`, SWEEP.pen[pen]); }
console.log('\n[5] 대체율 50%: 은퇴 속도');
for (const r of [6, 10, 14]) { SWEEP.ret[r] = run({ r }); line(`은퇴 ${r}%`, SWEEP.ret[r]); }
const slim = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { rev: v.rev, revN: v.revN, even: v.even, evenN: v.evenN, total: v.total, first5: v.first5, last5: v.last5, S: v.S, S0: v.S0 }]));
console.log('\nSWEEP = ' + JSON.stringify({ grid: slim(SWEEP.grid), mix: slim(SWEEP.mix), pen: slim(SWEEP.pen), ret: slim(SWEEP.ret) }));
