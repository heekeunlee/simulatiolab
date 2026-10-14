// 찌르레기 떼 군무(3D 보이드) 검증.  사용법: node tools/validate-murmuration.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const fs = require('fs'), path = require('path');
const M = require('../site/experiments/murmuration/sim.js');
const D = M.DEFAULTS, SEEDS = [1, 2, 3, 4], STEPS = 2000, TAIL = 400;
const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10;
const avg = (rows) => { const o = {}; for (const k of Object.keys(rows[0])) o[k] = rows.reduce((a, r) => a + r[k], 0) / rows.length; return o; };
const pack = (o) => ({ pol: r0(o.pol), coh: r0(o.coh), clu: r1(o.clu), big: r0(o.big * 100), nb: r1(o.nb) });
const run = (o) => pack(avg(SEEDS.map((seed) => M.summary(Object.assign({}, D, { steps: STEPS, seed }, o), TAIL))));
console.log('기본값:', JSON.stringify(D), `· 집계: 시드 ${SEEDS.length}개 평균, ${STEPS}걸음 중 마지막 ${TAIL}걸음 평균 · 덩어리는 새 ${M.minCluster(D.n)}마리 이상만 셈`);
const line = (name, s) => console.log(`    ${name.padEnd(14)} 방향 맞음 ${String(s.pol).padStart(3)} | 뭉친 정도 ${String(s.coh).padStart(3)} | 덩어리 ${String(s.clu).padStart(4)} | 가장 큰 덩어리 ${String(s.big).padStart(3)}% | 이웃 평균 ${s.nb}`);

// [0] 처음 상태와 기본 판의 시간 흐름
{ const s = M.create(Object.assign({}, D, { seed: 1 })); const at = {}; const want = [0, 50, 100, 200, 400, 800];
  at[0] = s.last; while (s.step()) if (want.includes(s.t)) at[s.t] = s.last;
  console.log('\n[0] 기본 판(시드 1) 시간 흐름: 걸음 → 방향 맞음 / 뭉친 정도 / 덩어리');
  console.log('    ' + want.map((t) => `${t}: ${r0(at[t].pol)} / ${r0(at[t].coh)} / ${at[t].clu}`).join('  ·  ')); }

const SWEEP = { k: {}, rules: {}, density: {}, hawk: {} };
console.log('\n[1] 이웃 수 k별 (위상 이웃)');
for (const k of [1, 3, 7, 15]) { SWEEP.k[k] = run({ k }); line(`k = ${k}`, SWEEP.k[k]); }
console.log('\n[2] 규칙 하나씩 끄기 (k = 7)');
for (const [id, name, o] of [['all', '모두 있음', {}], ['coh0', '붙기 없음', { coh: 0 }], ['ali0', '맞추기 없음', { ali: 0 }], ['sep0', '피하기 없음', { sep: 0 }]]) { SWEEP.rules[id] = run(o); line(name, SWEEP.rules[id]); }

console.log('\n[3] 밀도를 갑자기 바꾸면: 600걸음에 떼의 절반을 중심에서 3배 멀리 옮기고, 1100~1400걸음 평균');
for (const mode of ['topo', 'metric']) {
  const rows = SEEDS.map((seed) => {
    const s = M.create(Object.assign({}, D, { mode, seed, steps: 1400 })); let pre = null, nb = 0; const a = { pol: 0, big: 0, clu: 0, k: 0 };
    while (s.step()) { if (s.t === 600) { pre = s.last; nb = s.avgNeighbors(); s.spreadHalf(3); } if (s.t > 1100 && s.t % 5 === 0) { a.pol += s.last.pol; a.big += s.last.big; a.clu += s.last.clu; a.k++; } }
    return { preBig: pre.big, prePol: pre.pol, nb, pol: a.pol / a.k, big: a.big / a.k, clu: a.clu / a.k };
  });
  const o = avg(rows); SWEEP.density[mode] = { preBig: r0(o.preBig * 100), prePol: r0(o.prePol), nb: r1(o.nb), pol: r0(o.pol), big: r0(o.big * 100), clu: r1(o.clu) };
  const d = SWEEP.density[mode];
  console.log(`    ${mode === 'topo' ? '가까운 7마리' : '거리 ' + M.C.RM + ' 안 모두'}  이웃 평균 ${d.nb} | 옮기기 전 가장 큰 덩어리 ${d.preBig}% · 방향 ${d.prePol} → 뒤 ${d.big}% · 방향 ${d.pol} · 덩어리 ${d.clu}`);
}

console.log('\n[4] 매 예시: 600걸음에 매를 보내고, 매가 떠난 뒤 다시 모이기까지 (매 오기 직전의 덩어리 수 이하 + 방향 맞음이 직전보다 10 넘게 낮지 않을 때)');
{ const rec = [], dip = [];
  for (const seed of SEEDS) {
    const s = M.create(Object.assign({}, D, { seed, steps: 2000 })); let lo = 100;
    while (s.step()) { if (s.t === 600) s.sendHawk(); if (s.t > 600 && s.recover == null) lo = Math.min(lo, s.last.pol); }
    rec.push(s.recover); dip.push(r0(lo));
  }
  SWEEP.hawk = { rec, dip };
  console.log(`    시드별 다시 모인 걸음: ${rec.map((v) => (v == null ? '못 모임' : v)).join(', ')} · 그동안 가장 낮았던 방향 맞음: ${dip.join(', ')}`); }

// app.js에 넣은 집계 값과 같은지 확인
const app = fs.readFileSync(path.join(__dirname, '..', 'site', 'experiments', 'murmuration', 'app.js'), 'utf8');
const m = app.match(/const SWEEP = (\{.*?\});/);
const now = JSON.stringify(SWEEP);
console.log('\nSWEEP = ' + now);
console.log(m && m[1] === now ? '\n✓ app.js의 SWEEP과 일치' : '\n✗ app.js의 SWEEP과 다름: 위 SWEEP 줄로 바꿀 것');
