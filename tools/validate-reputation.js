// 약속을 어긴 나라와 다시 협상할 수 있을까(평판 전파 반복 협상) 검증.  사용법: node tools/validate-reputation.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const R = require('../site/experiments/reputation/sim.js');
const D = R.DEFAULTS, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8], ROUNDS = 300, FROM = 50, FORCE = 100;
const r0 = (v) => Math.round(v), pc = (v) => Math.round(v * 100);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function run(o) {
  const rows = SEEDS.map((seed) => R.summary(Object.assign({}, D, { rounds: ROUNDS, seed }, o), FROM, FORCE));
  const recs = rows.map((r) => r.forced).filter((f) => f && f.dur != null).map((f) => f.dur);
  return {
    deal: pc(mean(rows.map((r) => r.deal))), coop: pc(mean(rows.map((r) => r.coop))),
    brk: Math.round(mean(rows.map((r) => r.brk)) * 100) / 100,
    rec: recs.length ? r0(mean(recs)) : null, recN: recs.length, never: rows.filter((r) => r.forced && r.forced.dur == null && !r.forced.again).length, again: rows.filter((r) => r.forced && r.forced.again).length,
    peak: Math.round(mean(rows.map((r) => r.forced ? r.forced.peak : 0)) * 10) / 10,
  };
}
const line = (name, s) => console.log(`    ${name.padEnd(18)} 협상 성사 ${String(s.deal).padStart(3)}% | 협력 ${String(s.coop).padStart(3)}% | 어김 ${String(s.brk).padStart(4)}번/라운드 | 일부러 어긴 나라 회복 ${s.rec == null ? '  -' : String(s.rec).padStart(3)}라운드 (${s.recN}판, 그 전에 또 어김 ${s.again}판, 끝까지 못 돌아옴 ${s.never}판) | 거절한 나라 최대 ${s.peak}`);
console.log('기본값:', JSON.stringify(D), `· 집계: 시드 ${SEEDS.length}개, ${ROUNDS}라운드, ${FROM + 1}라운드부터 평균 · ${FORCE}라운드에 평판이 가장 좋은 나라가 일부러 한 번 어김`);

// [0] 기본 판(시드 1, 240라운드) 흐름
{ const s = R.create(Object.assign({}, D, { seed: 1 })); while (s.step()) {}
  const ev = s.events, waves = []; let cur = null;
  for (const e of ev) { if (!cur || e.t - cur.end > 25) { cur = { start: e.t, end: e.t, k: 0, who: new Set() }; waves.push(cur); } cur.end = e.t; cur.k++; cur.who.add(e.i); }
  console.log('\n[0] 기본 판(시드 1) 흐름: 어김의 물결 (25라운드 넘게 조용하면 새 물결)');
  waves.forEach((w, k) => console.log(`    물결 ${k + 1}: ${w.start}~${w.end}라운드, 어김 ${w.k}번, 어긴 나라 ${w.who.size}곳`));
  const at = [10, 25, 40, 60, 100, 150, 180, 200, 239];
  console.log('    협상 성사율: ' + at.map((t) => `${t + 1}R ${pc(s.hist.deal[t])}%`).join(' · '));
  console.log('    "어기면 손해" 어림: ' + at.map((t) => `${t + 1}R ${s.hist.cost[t].toFixed(1)}`).join(' · '));
  console.log(`    회복한 나라 ${s.recov.length}번, 회복 기간 ${Math.min(...s.recov.map((r) => r.dur))}~${Math.max(...s.recov.map((r) => r.dur))}라운드 (평균 ${r0(mean(s.recov.map((r) => r.dur)))})`);
  const peaks = []; for (let i = 0; i < s.n; i++) peaks.push(s.breaks[i]);
  console.log(`    나라별 어긴 횟수: ${peaks.join(',')} (한 번도 안 어긴 나라 ${peaks.filter((x) => !x).length}곳)`); }

const SWEEP = { grid: {}, apology: {}, tempt: {} };
const FORGETS = [0, 1, 3, 5, 10, 20], SPREADS = [10, 50, 90];
console.log('\n[1] 잊는 속도 × 소문 퍼지는 속도');
for (const s of SPREADS) for (const f of FORGETS) { const v = run({ forget: f, spread: s }); SWEEP.grid[`${f}_${s}`] = v; line(`망각 ${f}% 전파 ${s}%`, v); }
console.log('\n[2] 사과·보상 (기본: 망각 3%, 전파 50%)');
for (const a of [0, 25, 50, 75, 100]) { SWEEP.apology[a] = run({ apology: a }); line(`보상 ${a}%`, SWEEP.apology[a]); }
console.log('\n[3] 어기는 유혹 크기');
for (const g of [50, 100, 150, 200, 300]) { SWEEP.tempt[g] = run({ tempt: g }); line(`유혹 ${g}%`, SWEEP.tempt[g]); }
console.log('\nSWEEP =', JSON.stringify(SWEEP));
