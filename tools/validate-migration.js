// 국경을 닫으면 이주 흐름은 어디로 갈까 (가상의 땅, 길 6개) 검증.  사용법: node tools/validate-migration.js
const S = require('../site/experiments/migration/sim.js');
const D = S.DEFAULTS, RUNS = 8, pc = (v) => (v * 100).toFixed(1) + '%', f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1);
const names = S.ROUTES.map((r) => r.ko);
console.log('기본값:', JSON.stringify(D), '· 판 수', RUNS, '(막기 전 = 12~23달 평균, 막은 뒤 = 48~71달 평균)');
console.log('길:', S.ROUTES.map((r, i) => `${r.ko}(부담 ${r.base}, 위험 ${r.risk}%, ${r.cap}명/달)`).join(' · '));
const line = (x) => `나선 ${f0(x.tries)} · 도착 ${f0(x.arr)} · 사고 ${f1(x.acc)} · 위험한 길 ${pc(x.risky)} · 되돌려짐 ${f0(x.back)} · 통제 비용 ${f0(x.cost)}/달 | 길별 ${x.flow.map((v, i) => names[i] + ' ' + f0(v)).join(', ')}`;
const run = (o) => S.sweep(Object.assign({}, D, o, { seed: 1 }), RUNS);

console.log('\n[1] 기본 설정 (압력 60, 24개월째 큰길을 세기 80%로 막음)');
const d = run({});
console.log('    막기 전', line(d.pre)); console.log('    막은 뒤', line(d.post));
console.log(`    → 도착 ${pc(d.post.arr / d.pre.arr - 1)} · 위험한 길 비중 ${(d.post.risky / d.pre.risky).toFixed(1)}배 · 위험한 길로 간 사람 수 ${f0(d.pre.risky * d.pre.tries)}→${f0(d.post.risky * d.post.tries)}명 · 사고 ${pc(d.post.acc / d.pre.acc - 1)}`);

console.log('\n[2] 막는 세기별 (막은 뒤, 막기 전 = 100)');
for (const st of [0, 20, 40, 60, 80, 100]) {
  const o = run({ strength: st });
  console.log(`    세기 ${String(st).padStart(3)}%  도착 ${f0(100 * o.post.arr / o.pre.arr)} · 위험한 길로 간 사람 ${f0(100 * o.post.risky * o.post.tries / (o.pre.risky * o.pre.tries))} · 사고 ${f0(100 * o.post.acc / o.pre.acc)} | 위험한 길 비중 ${pc(o.post.risky)} · 되돌려짐 ${f0(o.post.back)}/달 · 통제 비용 ${f0(o.post.cost)}/달`);
}

console.log('\n[3] 출발지의 압력별 (막은 뒤 구간 = 48~71달): 막지 않음 vs 큰길 80%로 막음');
for (const p of [20, 40, 60, 80, 100]) {
  const a = run({ pressure: p, strength: 0 }).post, b = run({ pressure: p }).post;
  console.log(`    압력 ${String(p).padStart(3)}  막지 않음: 도착 ${f0(a.arr)} · 사고 ${f1(a.acc)} · 위험한 길 ${pc(a.risky)}  |  막음: 도착 ${f0(b.arr)} · 사고 ${f1(b.acc)} · 위험한 길 ${pc(b.risky)}`);
}

console.log('\n[4] 어느 길을 막느냐 (세기 80%)');
for (let i = 0; i < 6; i++) { const o = run({ block: i }); console.log(`    ${names[i].padEnd(6)} 막음 → 도착 ${f0(o.post.arr)} · 사고 ${f1(o.post.acc)} · 위험한 길 ${pc(o.post.risky)}`); }

console.log('\n[5] 정식 관문이 받는 수 (큰길 80%로 막음)');
for (const g of [50, 100, 200, 300]) { const o = run({ gatecap: g }); console.log(`    관문 ${String(g).padStart(3)}%  막기 전 위험한 길 ${pc(o.pre.risky)} · 도착 ${f0(o.pre.arr)}  →  막은 뒤 위험한 길 ${pc(o.post.risky)} · 도착 ${f0(o.post.arr)} · 사고 ${f1(o.post.acc)}`); }

console.log('\n[6] 위험을 꺼리는 정도 (큰길 80%로 막음)');
for (const w of [30, 100, 200]) { const o = run({ riskw: w }); console.log(`    ${String(w).padStart(3)}%  막기 전 위험한 길 ${pc(o.pre.risky)} · 사고 ${f1(o.pre.acc)}  →  막은 뒤 ${pc(o.post.risky)} · 사고 ${f1(o.post.acc)}`); }

console.log('\n[7] 압력을 60→40으로 줄일 때 vs 큰길을 막을 때 (막은 뒤 구간)');
{ const base = run({ strength: 0 }).post, lowP = run({ pressure: 40, strength: 0 }).post, blk = d.post;
  console.log(`    그대로: 도착 ${f0(base.arr)} · 사고 ${f1(base.acc)} · 위험한 길 ${pc(base.risky)}`);
  console.log(`    압력 40: 도착 ${f0(lowP.arr)} · 사고 ${f1(lowP.acc)} · 위험한 길 ${pc(lowP.risky)}`);
  console.log(`    큰길 막음: 도착 ${f0(blk.arr)} · 사고 ${f1(blk.acc)} · 위험한 길 ${pc(blk.risky)}`); }

console.log('\n[8] 첫 판(시드 1) 기록');
{ const s = S.create({ seed: 1 }).run();
  console.log('    위험한 길 비중(달별 %):', s.risky.map((v) => Math.round(v * 100)).join(' '));
  console.log('    도착(달별):', s.arr.join(' '));
  console.log('    쌓인 통제 비용', s.cost.reduce((a, b) => a + b, 0).toFixed(0), '점 · 되돌려 보낸 사람', s.back.reduce((a, b) => a + b, 0), '명'); }
