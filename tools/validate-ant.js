// 랭턴의 개미 모델 검증.  사용법: node tools/validate-ant.js
const Ant = require('../site/experiments/ant/sim.js');
const f = (v, d = 1) => v.toFixed(d);
const G = Ant.G, C0 = Ant.C0, P = Ant.PERIOD;

// 1) 빈 판에서 개미 한 마리: 고속도로 시작 걸음 (두 가지 방법으로)
const s = Ant.create({ maxSteps: 40000 });
const px = [s.ants[0].x], py = [s.ants[0].y];
while (s.step()) { px.push(s.ants[0].x); py.push(s.ants[0].y); }
// 방법 B(사후 확인): 이 걸음 이후로 끝까지 104걸음마다 같은 변위가 되풀이되는 가장 이른 걸음
const dx = px[px.length - 1] - px[px.length - 1 - P], dy = py[py.length - 1] - py[py.length - 1 - P];
let last = -1;
for (let t = 0; t + P < px.length; t++) if (px[t + P] - px[t] !== dx || py[t + P] - py[t] !== dy) last = t;
const onsetPost = last + 1;
console.log(`빈 판, 개미 1마리: 실시간 판정 시작 걸음 ${s.onset}, 사후 확인 시작 걸음 ${onsetPost}, 104걸음당 이동 (${dx},${dy}), 40,000걸음 때 검은 칸 ${s.black}, 원점에서 거리 ${f(s.dist())}`);
// 고속도로에서 검은 칸은 104걸음마다 12칸씩 늘어난다 (대각선으로 2칸 전진)
const hb = s.hist.black, ht = s.hist.t, i1 = ht.indexOf(30000), i2 = ht.indexOf(40000);
console.log(`30,000~40,000걸음 검은 칸 증가: ${hb[i2] - hb[i1]}칸 (걸음당 ${f((hb[i2] - hb[i1]) / 10000, 4)}), 거리 증가 ${f(s.hist.dist[i2] - s.hist.dist[i1])}칸 (걸음당 ${f((s.hist.dist[i2] - s.hist.dist[i1]) / 10000, 4)})`);

// 2) 대칭이 깨지는 걸음 (빈 판): 검은 칸 모양이 어떤 거울/회전과도 같지 않게 되는 첫 걸음
const t = Ant.create({ maxSteps: 3000 });
const syms = [(x, y) => [y, x], (x, y) => [-y, -x], (x, y) => [-x, y], (x, y) => [x, -y], (x, y) => [-x, -y], (x, y) => [-y, x], (x, y) => [y, -x]];
function blackSet(sm) { const a = []; for (let y = sm.minY; y <= sm.maxY; y++) for (let x = sm.minX; x <= sm.maxX; x++) if (sm.grid[y * G + x] & 1) a.push([x - C0, y - C0]); return a; }
function symmetric(sm, fn) { const set = new Set(blackSet(sm).map(([x, y]) => x + ',' + y)); for (const k of set) { const [x, y] = k.split(',').map(Number); const [a, b] = fn(x, y); if (!set.has(a + ',' + b)) return false; } return true; }
const sy = syms.map(() => -1);
while (t.step()) { const st = t.steps; if (st > 2500) break; syms.forEach((fn, i) => { if (symmetric(t, fn)) sy[i] = st; }); }
console.log('각 변환(대각 거울, 반대 대각 거울, 좌우, 상하, 180도 회전...)으로 모양이 같게 보이는 마지막 걸음 (-1이면 한 번도 아님)', JSON.stringify(sy));
// 주의: 개미의 위치는 포함하지 않고 검은 칸의 모양만 본다
let firstBreak = null;
const t2 = Ant.create({ maxSteps: 3000 });
while (t2.step()) { if (t2.steps > 2500) break; if (!syms.some((fn) => symmetric(t2, fn)) && t2.steps > 20) { firstBreak = t2.steps; break; } }
console.log('검은 칸 모양이 어떤 대칭도 갖지 않게 된 첫 걸음(20걸음 이후):', firstBreak);

// 3) 무작위 시작: 고속도로가 생기는 비율 (예산 60,000걸음)
function rate(opts, N) {
  let ok = 0; const ons = [];
  for (let seed = 1; seed <= N; seed++) { const m = Ant.create(Object.assign({ seed, maxSteps: 60000 }, opts)); while (m.step() && !(m.onset !== null && m.steps > m.onset + 400)); if (m.onset !== null) { ok++; ons.push(m.onset); } }
  ons.sort((a, b) => a - b);
  return { ok, N, med: ons.length ? ons[ons.length >> 1] : null, min: ons[0], max: ons[ons.length - 1] };
}
const N = 60;
console.log(`무작위 시작 (한 변 21칸 안에서 검은 칸 비율 d, ${N}회, 60,000걸음 안에):`);
for (const d of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5]) { const r = rate({ noise: true, dens: d }, N); console.log(`  d=${d}  개미 1마리: ${r.ok}/${r.N} 고속도로, 시작 걸음 중앙값 ${r.med}, 범위 ${r.min}~${r.max}`); }
console.log('개미 여러 마리 (빈 판 / d=0.15):');
for (const a of [2, 3, 4]) {
  const r0 = rate({ ants: a }, 1), r = rate({ ants: a, noise: true, dens: 0.15 }, N);
  console.log(`  ${a}마리 빈 판: ${r0.ok}/1 고속도로(시작 ${r0.med})  | 무작위 d=0.15: ${r.ok}/${r.N}, 중앙값 ${r.med}, 범위 ${r.min}~${r.max}`);
}
