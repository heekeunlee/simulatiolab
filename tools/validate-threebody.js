// 세 천체 문제(쌍둥이 판) 검증.  사용법: node tools/validate-threebody.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const fs = require('fs'), path = require('path');
const M = require('../site/experiments/threebody/sim.js');
const D = M.DEFAULTS, C = M.C, T = D.steps * C.DT;
const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
const r1 = (v) => Math.round(v * 10) / 10, r0 = Math.round;
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2; };
console.log(`기본값: ${JSON.stringify(D)} · 한 걸음 = 모델 시간 ${C.DT}, 한 판 = 시간 ${T} · 갈라짐 = 같은 별끼리 거리 차 > ${C.DIVERGE} · 튕겨 나감 = 쌍의 중심에서 ${C.ESC} × 시작 거리보다 멀고 묶이지 않음`);

// [0] 기본 판(시드 1)
const s1 = M.create(D); const marks = {}; const want = [0, 5, 10, 15, 20, 25];
const E0 = M.energy(s1.A, (C.SOFT * D.dist) ** 2);
let maxP = 0; marks[0] = s1.diff;
while (s1.step()) { const t = r1(s1.time()); if (want.includes(t)) marks[t] = s1.diff; maxP = Math.max(maxP, s1.momentum()); }
console.log('\n[0] 기본 판(시드 1): 두 판의 거리 차 (시간: 차이)');
console.log('    ' + want.map((t) => `${t}: ${marks[t].toPrecision(2)}`).join(' · '));
console.log(`    갈라진 때 ${s1.tDiv} · 튕겨 나감 A: ${s1.esc ? '별 ' + (s1.esc.body + 1) + ', 시간 ' + r1(s1.esc.t) : '없음'} · B: ${s1.escB ? '별 ' + (s1.escB.body + 1) + ', 시간 ' + r1(s1.escB.t) : '없음'}`);
console.log(`    별 둘 쌍둥이: 끝(시간 ${T})의 거리 차 ${s1.diff2.toPrecision(2)} · 갈라짐 ${s1.tDiv2 == null ? '없음' : s1.tDiv2}`);
console.log(`    건전성: 처음 에너지 ${E0.toFixed(4)} · 에너지 상대 오차 최대 별 셋 ${s1.eErr.toExponential(1)}, 별 둘 ${s1.eErr2.toExponential(1)} · 운동량 최대 ${maxP.toExponential(1)} · 한 판 계산 잘게 쪼갠 걸음 ${s1.sub}`);

// [1] 케플러 검산: 별 둘의 주기 = 2π √(a³ / (G M))
{ const i2 = M.initial2(1), s = M.makeSys(i2.m, i2.x, i2.v), soft2 = (C.SOFT) ** 2; let prevY = s.x[4], cross = [], t = 0; const h = 0.002;
  for (let k = 0; k < 40000 && cross.length < 3; k++) { M.advance(s, h, soft2); t += h; const y = s.x[4]; if (prevY < 0 && y >= 0) cross.push(t); prevY = y; }
  const r0_ = 2, e = 0.5, a = r0_ / (1 + e), Pth = 2 * Math.PI * Math.sqrt(a ** 3 / 2);
  console.log(`\n[1] 케플러 검산(별 둘, 이심률 0.5): 주기 시뮬레이션 ${(cross[2] - cross[1]).toFixed(4)} · 이론 ${Pth.toFixed(4)}`); }

// [2] 처음 차이 크기별 갈라지는 시간 (별 셋: 시드 24개 중앙값, 판 안에 안 갈라지면 시간 80으로 셈 / 별 둘: 늘 같은 궤도, 시간 2000까지)
const SWEEP = { eps: [], q: [] };
console.log('\n[2] 처음 차이 → 갈라지는 시간 (별 셋 중앙값 / 별 둘)');
const EPS = [0.001, 0.003, 0.01, 0.03, 0.1];
for (const eps of EPS) {
  const d = SEEDS.map((seed) => { const r = M.run(Object.assign({}, D, { seed, eps })); return r.tDiv == null ? T : r.tDiv; });
  const r2 = M.run(Object.assign({}, D, { eps, steps: 100000 }));
  const row = { eps, three: r1(med(d)), lo: r1(Math.min(...d)), hi: r1(Math.max(...d)), never: d.filter((v) => v >= T).length, two: r2.tDiv2 == null ? null : r1(r2.tDiv2) };
  SWEEP.eps.push(row);
  console.log(`    ${String(eps).padEnd(6)} 별 셋 ${row.three} (범위 ${row.lo}~${row.hi}, 안 갈라짐 ${row.never}판) · 별 둘 ${row.two}`);
}
{ const a = SWEEP.eps[0], b = SWEEP.eps[EPS.length - 1], per10 = (a.three - b.three) / 2, two10 = SWEEP.eps[1].two && SWEEP.eps[3].two ? SWEEP.eps[1].two / SWEEP.eps[3].two : null;
  console.log(`    처음 차이를 10배 줄이면: 별 셋은 평균 시간 ${r1(per10)}만큼 늦게 갈라짐 · 별 둘은 약 ${two10 ? r1(two10) : '?'}배 늦게(0.03→0.003)`); }

// [3] 셋째 별 무게별: 판 안에 하나가 튕겨 나간 비율, 튕겨 나간 별이 가장 가벼운 별인 횟수
console.log('\n[3] 셋째 별 무게 → 튕겨 나감 (시드 24개, 판 A)');
for (const q of [0.3, 1, 3]) {
  const rs = SEEDS.map((seed) => M.run(Object.assign({}, D, { seed, q })));
  const e = rs.filter((r) => r.esc), light = q < 1 ? e.filter((r) => r.esc.body === 2).length : q > 1 ? e.filter((r) => r.esc.body !== 2).length : null;
  const row = { q, ej: e.length, n: rs.length, light, t: e.length ? r1(med(e.map((r) => r.esc.t))) : null, div: r1(med(rs.map((r) => r.tDiv == null ? T : r.tDiv))), err: Math.max(...rs.map((r) => r.eErr)) };
  SWEEP.q.push({ q, ej: row.ej, n: row.n, light: row.light, t: row.t, div: row.div });
  console.log(`    무게 ${q}: 튕겨 나감 ${row.ej}/${row.n}판 · 그중 가장 가벼운 별 ${row.light == null ? '-' : row.light} · 튕겨 나간 시간 중앙값 ${row.t} · 갈라지는 시간 중앙값 ${row.div} · 에너지 오차 최대 ${row.err.toExponential(1)}`);
}
// [4] 시작 거리별 갈라지는 시간 (중앙값)
console.log('\n[4] 시작 거리 → 갈라지는 시간 중앙값 (시드 24개)');
SWEEP.dist = [];
for (const dist of [0.6, 1, 1.6]) {
  const rs = SEEDS.map((seed) => M.run(Object.assign({}, D, { seed, dist })));
  const row = { dist, div: r1(med(rs.map((r) => r.tDiv == null ? T : r.tDiv))), ej: rs.filter((r) => r.esc).length };
  SWEEP.dist.push(row);
  console.log(`    거리 ${dist}: 갈라짐 ${row.div} · 튕겨 나감 ${row.ej}/24 · 에너지 오차 최대 ${Math.max(...rs.map((r) => r.eErr)).toExponential(1)}`);
}
// [5] 전체 에너지 오차
{ let mx = 0; for (const seed of SEEDS) mx = Math.max(mx, M.run(Object.assign({}, D, { seed })).eErr); console.log(`\n[5] 기본 설정 시드 24개: 에너지 상대 오차 최대 ${mx.toExponential(1)}`); }

const app = fs.readFileSync(path.join(__dirname, '..', 'site', 'experiments', 'threebody', 'app.js'), 'utf8');
const m = app.match(/const SWEEP = (\{.*?\});/);
const now = JSON.stringify(SWEEP);
console.log('\nSWEEP = ' + now);
console.log(m && m[1] === now ? '\n✓ app.js의 SWEEP과 일치' : '\n✗ app.js의 SWEEP과 다름: 위 SWEEP 줄로 바꿀 것');
