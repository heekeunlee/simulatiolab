// 은하 충돌(제한 N체) 검증.  사용법: node tools/validate-galaxy.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const fs = require('fs'), path = require('path');
const G = require('../site/experiments/galaxy/sim.js');
const D = G.DEFAULTS, SEEDS = [1, 2, 3];
const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const run = (o, seeds = SEEDS) => {
  const rows = seeds.map((seed) => G.summary(Object.assign({}, D, { count: false, seed }, o)));
  const m = rows.map((r) => r.merged).filter((v) => v != null);
  return { tail: r0(mean(rows.map((r) => r.tail))), tailA: r0(mean(rows.map((r) => r.tailA))), tailB: r0(mean(rows.map((r) => r.tailB))), merged: m.length === rows.length ? r1(mean(m)) : null };
};
console.log('기본값:', JSON.stringify(D), `· 시간 단위 "바퀴" = 큰 은하 바깥 별이 한 바퀴 도는 시간(${r2(G.TURN)}), 한 걸음 ${G.C.DT}, 한 판 ${D.turns}바퀴`);

// [0] 건전성: 에너지 보존
{ const s = G.create(Object.assign({}, D, { solo: true, count: false }));
  const e0 = Array.from({ length: s.n }, (_, i) => s.starEnergy(i));
  const rad = (i) => Math.hypot(s.px[i] - s.cx[0], s.py[i] - s.cy[0], s.pz[i] - s.cz[0]), ra = Array.from({ length: s.n }, (_, i) => rad(i));
  while (s.step()); 
  const err = e0.map((e, i) => Math.abs((s.starEnergy(i) - e) / e)).sort((a, b) => a - b), dr = ra.map((r, i) => Math.abs(rad(i) - r) / r).sort((a, b) => a - b);
  console.log(`\n[0] 건전성 ① 은하 하나만(별 ${s.n}개, ${D.turns}바퀴): 별 에너지 오차 중앙값 ${err[err.length >> 1].toExponential(1)}, 최대 ${err[err.length - 1].toExponential(1)} · 반지름 변화 중앙값 ${(dr[dr.length >> 1] * 100).toFixed(2)}%, 99번째 ${(dr[Math.floor(dr.length * 0.99)] * 100).toFixed(1)}%`); }
{ const s = G.create(Object.assign({}, D, { friction: false, count: false, n: 20 })); const e0 = s.coreEnergy(); let worst = 0, kmax = 0;
  const ke = () => 0.5 * s.M[0] * (s.cvx[0] ** 2 + s.cvy[0] ** 2 + s.cvz[0] ** 2) + 0.5 * s.M[1] * (s.cvx[1] ** 2 + s.cvy[1] ** 2 + s.cvz[1] ** 2);
  while (s.step()) { worst = Math.max(worst, Math.abs(s.coreEnergy() - e0)); kmax = Math.max(kmax, ke()); }
  console.log(`    ② 제동을 끈 두 중심: 에너지가 처음 값에서 가장 크게 벗어난 양 ${worst.toExponential(1)} = 가장 빠를 때 운동 에너지(${kmax.toFixed(2)})의 ${(worst / kmax * 100).toFixed(3)}% · 제동을 끄면 합쳐짐: ${s.merged == null ? '없음(한 번 스치고 멀어짐)' : s.turns(s.merged).toFixed(2) + '바퀴'}`); }
{ const s = G.create(Object.assign({}, D, { count: false, n: 20 })); const e0 = s.coreEnergy(); while (s.step()); const p = s.momentum();
  console.log(`    ③ 제동 켬: 전체 운동량 ${Math.hypot(...p).toExponential(1)} (0이어야 함) · 두 중심 에너지 ${e0.toFixed(3)} → ${s.coreEnergy().toFixed(3)} (제동이 에너지를 빼서 합쳐짐 ${s.turns(s.merged).toFixed(2)}바퀴)`); }

const SWEEP = {};
// [1] 기본 판 시간 흐름
{ const s = G.create(Object.assign({}, D, { seed: 1 })); const at = {};
  while (s.step()) { const tt = Math.round(s.turns(s.t) * 100) / 100; for (const w of [1, 2, 3, 4, 6, 8]) if (!at[w] && s.turns(s.t) >= w) at[w] = { tail: r0(s.last.tail), sep: r2(s.last.sep), close: s.close.slice() }; }
  const p = s.peri[0];
  SWEEP.base = { peri: r1(s.turns(p.t)), periR: r2(p.r), merged: r1(s.turns(s.merged)), tail: r0(s.last.tail), tailA: r0(s.last.tailA), tailB: r0(s.last.tailB), close: s.close.slice(), s0: Math.round(s.s0 * 1000) / 1000, n: s.n, nA: s.NA, nB: s.NB };
  console.log(`\n[1] 기본 판(시드 1): 첫 근접 통과 ${SWEEP.base.peri}바퀴(중심 사이 ${SWEEP.base.periR}) · 합쳐짐 ${SWEEP.base.merged}바퀴 · 끝 꼬리 별 ${SWEEP.base.tail}% (큰 ${SWEEP.base.tailA}%, 작은 ${SWEEP.base.tailB}%) · 별 ${s.NA}+${s.NB}개, 처음 별 사이 간격 ${SWEEP.base.s0}`);
  console.log('    ' + Object.entries(at).map(([w, v]) => `${w}바퀴: 거리 ${v.sep} 꼬리 ${v.tail}% 가까이 지나간 쌍 ${v.close.join('/')}`).join('\n    ')); }

// [2] 별 크기별 가까이 지나간 쌍 (다른 은하 별끼리, 시드 3개 평균)
{ const rows = SEEDS.map((seed) => G.summary(Object.assign({}, D, { seed })));
  const c = [0, 1, 2].map((k) => r1(mean(rows.map((r) => r.close[k]))));
  const pairs = rows[0].n; const all = SWEEP.base.nA * SWEEP.base.nB;
  SWEEP.size = { close: c, pairs: all };
  console.log(`\n[2] 별 크기(처음 별 사이 간격의 1/10 · 1/100 · 1/1000)별, 다른 은하 별끼리 그만큼 가까이 지나간 쌍 (시드 3개 평균): ${c.join(' · ')}  (가능한 쌍 ${all.toLocaleString()}개)`);
  console.log(`    크기를 1/10로 줄이면 쌍은 약 ${r0(c[0] / Math.max(0.1, c[1]))}배 줄어듦 (부딪히는 넓이는 크기의 제곱 → 100배 기대) · 시드별 1/10: ${rows.map((r) => r.close[0]).join(', ')} · 1/100: ${rows.map((r) => r.close[1]).join(', ')} · 1/1000: ${rows.map((r) => r.close[2]).join(', ')}`);
  const m2 = G.summary(Object.assign({}, D, { n: 2000 }));
  console.log(`    (휴대폰 별 2,000개, 시드 1): ${m2.close.join(' · ')}`); }

// [3] 도는 방향
console.log('\n[3] 원반이 도는 방향 (시드 3개 평균, 끝 꼬리 별 %)');
SWEEP.spin = {};
for (const sp of ['pro', 'retro', 'mix']) { SWEEP.spin[sp] = run({ spin: sp }); const v = SWEEP.spin[sp]; console.log(`    ${sp.padEnd(5)} 전체 ${v.tail}% · 큰 은하 ${v.tailA}% · 작은 은하 ${v.tailB}% · 합쳐짐 ${v.merged}바퀴`); }
// [4] 가장 가까이 오는 거리
console.log('\n[4] 가장 가까이 오는 거리 (큰 은하 반지름 대비)');
SWEEP.rp = {};
for (const rp of [50, 100, 150, 200, 300]) { SWEEP.rp[rp] = run({ rp }); const v = SWEEP.rp[rp]; console.log(`    ${(rp / 100).toFixed(1)}  꼬리 ${v.tail}% · 합쳐짐 ${v.merged == null ? '판 안에 안 합쳐짐' : v.merged + '바퀴'}`); }
// [5] 무게 비
console.log('\n[5] 작은 은하 무게 (큰 은하 대비 %)');
SWEEP.q = {};
for (const q of [10, 25, 50, 100]) { SWEEP.q[q] = run({ q }); const v = SWEEP.q[q]; console.log(`    ${String(q).padStart(3)}%  꼬리 전체 ${v.tail}% · 큰 ${v.tailA}% · 작은 ${v.tailB}% · 합쳐짐 ${v.merged == null ? '없음' : v.merged + '바퀴'}`); }
// [6] 기울기
console.log('\n[6] 원반 기울기 (공전면 대비)');
SWEEP.tilt = {};
for (const tilt of [0, 30, 60, 90]) { SWEEP.tilt[tilt] = run({ tilt }); const v = SWEEP.tilt[tilt]; console.log(`    ${String(tilt).padStart(2)}°  꼬리 전체 ${v.tail}% · 큰 ${v.tailA}% · 작은 ${v.tailB}%`); }

const app = fs.readFileSync(path.join(__dirname, '..', 'site', 'experiments', 'galaxy', 'app.js'), 'utf8');
const m = app.match(/const SWEEP = (\{.*?\});/);
const now = JSON.stringify(SWEEP);
console.log('\nSWEEP = ' + now);
console.log(m && m[1] === now ? '\n✓ app.js의 SWEEP과 일치' : '\n✗ app.js의 SWEEP과 다름: 위 SWEEP 줄로 바꿀 것');
