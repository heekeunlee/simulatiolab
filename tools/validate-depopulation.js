// 지방 소멸의 악순환(가상의 지도) 검증.  사용법: node tools/validate-depopulation.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const fs = require('fs'), path = require('path');
const M = require('../site/experiments/depopulation/sim.js');
const D = M.DEFAULTS, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8], NV = M.create(D).VIL.length;
const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('기본값:', JSON.stringify(D), `· 마을 ${NV}개 + 도시 9칸 · 집계: 시드 ${SEEDS.length}개 평균, ${D.years}해 끝 값`);

// [0] 기본 판(시드 1) 시간 흐름
{ const s = M.create(Object.assign({}, D, { seed: 1 })); const at = { 0: s.last }; const want = [10, 20, 30, 40, 50, 60];
  while (s.step()) if (want.includes(s.t)) at[s.t] = s.last;
  console.log('\n[0] 기본 판(시드 1): 해 → 남은 마을 / 문 닫은 % / 도시 인구 비중 % / 전체 인구(처음 대비 %) / 번진 거리');
  console.log('    ' + [0].concat(want).map((t) => `${t}: ${at[t].alive} / ${r0(at[t].closed)} / ${r0(at[t].city)} / ${r0(at[t].total)} / ${at[t].spread}`).join('  ·  '));
  console.log(`    처음 문 닫은 해 ${s.firstYear}, 절반이 닫힌 해 ${s.halfYear} (→ ${s.halfYear - s.firstYear}해 걸림)`); }

function run(o) {
  const rows = SEEDS.map((seed) => M.summary(Object.assign({}, D, { seed }, o)));
  const halves = rows.map((r) => r.half);
  return { closed: r0(mean(rows.map((r) => r.closed))), alive: r0((100 * mean(rows.map((r) => r.alive))) / NV), city: r0(mean(rows.map((r) => r.city))),
    total: r0(mean(rows.map((r) => r.total))), spread: r1(mean(rows.map((r) => r.spread))), first: r1(mean(rows.map((r) => r.first))),
    half: halves.every((h) => h >= 0) ? r1(mean(halves)) : -1, halfN: halves.filter((h) => h >= 0).length };
}
const line = (name, s) => console.log(`    ${name.padEnd(12)} 문 닫은 ${String(s.closed).padStart(3)}% | 남은 마을 ${String(s.alive).padStart(3)}% | 도시 비중 ${s.city}% | 전체 ${s.total}% | 번진 거리 ${s.spread}칸 | 처음 닫힘 ${s.first}해 | 반까지 ${s.half < 0 ? `(${s.halfN}/${SEEDS.length}판만 반에 닿음)` : s.half + '해'}`);
const SWEEP = { pull: {}, thr: {}, birth: {}, prot: {} };
console.log('\n[1] 도시로 끌리는 세기별');
for (const v of [50, 100, 150]) { SWEEP.pull[v] = run({ pull: v }); line(`끌림 ${v}%`, SWEEP.pull[v]); }
console.log('\n[2] 시설 유지 문턱별');
for (const v of [40, 60, 80]) { SWEEP.thr[v] = run({ thr: v }); line(`문턱 ${v}명`, SWEEP.thr[v]); }
console.log('\n[3] 출생 영향별 (0 = 젊은층이 떠나도 아기 수는 처음 그대로, 100 = 젊은층 수만큼)');
for (const v of [0, 50, 100]) { SWEEP.birth[v] = run({ birth: v }); line(`출생 영향 ${v}%`, SWEEP.birth[v]); }

// [4] 지켜 주기: 같은 시드에서 지켜 줄 때와 안 지켜 줄 때, 지켜 준 마을과 그 둘레 2칸 마을의 끝 인구(처음 대비)와 시설이 남은 수
console.log('\n[4] 지켜 주기 (3곳씩, 같은 처음 지도에서 지킬 때 vs 안 지킬 때) · 둘레 = 지켜 준 곳에서 2칸 안 마을');
const NB = (s, cells) => { const out = new Set(), W = s.W; cells.forEach((c) => { const x = c % W, y = (c / W) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue; const j = yy * W + xx; if (!s.isCity[j] && cells.indexOf(j) < 0) out.add(j); } }); return [...out]; };
const ratio = (s, cells) => mean(cells.map((c) => s.pop[c] / s.P0[c])) * 100;
for (const where of ['near', 'mid', 'far']) {
  const acc = { own: [], ownB: [], nb: [], nbB: [], held: [], heldB: [], of: [], closed: [], closedB: [] };
  for (const seed of SEEDS) {
    const A = M.summary(Object.assign({}, D, { seed, protect: 3, where })), B = M.summary(Object.assign({}, D, { seed }));
    const cells = A.s.protectedCells, nb = NB(A.s, cells);
    acc.own.push(ratio(A.s, cells)); acc.ownB.push(ratio(B.s, cells)); acc.nb.push(ratio(A.s, nb)); acc.nbB.push(ratio(B.s, nb));
    acc.held.push(nb.reduce((a, j) => a + A.s.open[j], 0)); acc.heldB.push(nb.reduce((a, j) => a + B.s.open[j], 0)); acc.of.push(nb.length);
    acc.closed.push(A.closed); acc.closedB.push(B.closed);
  }
  const o = { own: r0(mean(acc.own)), ownB: r0(mean(acc.ownB)), nb: r0(mean(acc.nb)), nbB: r0(mean(acc.nbB)), held: r1(mean(acc.held)), heldB: r1(mean(acc.heldB)), of: r0(mean(acc.of)), closed: r1(mean(acc.closed)), closedB: r1(mean(acc.closedB)), ring: M.C.RING[where] };
  SWEEP.prot[where] = o;
  console.log(`    ${({ near: '도시 가까이', mid: '중간', far: '변두리' })[where].padEnd(7)}(중심에서 ${o.ring}칸) 지켜 준 마을 인구 ${o.ownB}% → ${o.own}% | 둘레 마을 인구 ${o.nbB}% → ${o.nb}% | 둘레 ${o.of}곳 중 시설 남음 ${o.heldB} → ${o.held} | 전체 문 닫은 ${o.closedB}% → ${o.closed}%`);
}

// [5] 끌림 0이면 아무도 떠나지 않는다
{ const z = run({ pull: 0 }); line('끌림 0%', z); }

const app = fs.readFileSync(path.join(__dirname, '..', 'site', 'experiments', 'depopulation', 'app.js'), 'utf8');
const m = app.match(/const SWEEP = (\{.*?\});/);
const now = JSON.stringify(SWEEP);
console.log('\nSWEEP = ' + now);
console.log(m && m[1] === now ? '\n✓ app.js의 SWEEP과 일치' : '\n✗ app.js의 SWEEP과 다름: 위 SWEEP 줄로 바꿀 것');
