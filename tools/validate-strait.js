// 길목 하나가 막히면(가상 항로망 + 혼잡 + 길목 앞 줄) 검증.  사용법: node tools/validate-strait.js
// 페이지 문구와 app.js의 집계(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const M = require('../site/experiments/strait/sim.js');
const D = M.DEFAULTS, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const r1 = (v) => Math.round(v * 10) / 10;
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const many = (o) => {
  const rs = SEEDS.map((seed) => M.run(Object.assign({}, D, o, { seed })));
  const rec = rs.map((r) => (r.recover == null ? 99 : r.recover));
  return { peak: r1(avg(rs.map((r) => r.peak))), far: r1(avg(rs.map((r) => r.peakFar))), use: r1(avg(rs.map((r) => r.peakUse))), rec: r1(avg(rec)), never: rs.filter((r) => r.recover == null).length, load: r1(avg(rs.map((r) => r.maxLoad)) * 100) };
};
const seaPeak = (s, si) => r1(Math.max(...s.hist.map((h) => Math.max(...h.idx.filter((v, i) => M.PORTS[i].sea === si)))));
console.log('기본값:', JSON.stringify(D), `· 항구 ${M.PORTS.length}곳 · 바닷길 ${M.ROUTES.length}개 · ${M.C.START}주째에 막힘 · ${M.C.WEEKS}주 · 집계: 세계 ${SEEDS.length}가지(항구 사이 화물량 0.7~1.3배)`);

// [0] 기본 판(세계 #1)
const s0 = M.create(Object.assign({}, D));
console.log('\n[0] 평소(막히기 전) 바닷길 붐빔(짐/용량 %):', M.ROUTES.map((r, i) => `${r.id} ${Math.round(s0.flow[s0.RE[i]] / s0.E[s0.RE[i]].cap * 100)}`).join(' · '));
console.log('    평소 수입 일수(항구 평균):', r1(avg(s0.base)), '일 · 가람 해협을 쓰던 항구', Array.from(s0.uses).filter((x) => x).length, '곳');
const a = M.run(Object.assign({}, D, { seed: 1 }));
let qmax = 0, qmaxAt = 0, waitMax = 0; a.s.qHist.forEach((q, t) => q.forEach((v, ri) => { if (v > qmax) { qmax = v; qmaxAt = t + 1; } const w = v / a.s.E[a.s.RE[ri]].cap * 7; if (w > waitMax) waitMax = w; }));
console.log('    기본 판: 가장 많이 오른 나라', r1(a.peak), M.PORTS[a.s.peakPort].name, '· 안 쓰던 나라 중', r1(a.peakFar), M.PORTS[a.s.peakFarPort].name,
  '· 바다별 최고: 노을', seaPeak(a.s, 0), '새벽', seaPeak(a.s, 1), '별', seaPeak(a.s, 2), '얼음', seaPeak(a.s, 3));
console.log('    가장 붐빈 바닷길', Math.round(a.maxLoad * 100), '% · 가장 긴 기다림', r1(waitMax), '일 · 다시 열린 뒤 풀리기까지', a.recover, '주 (막힌 기간', D.dur, '주)');
const h = a.s.hist; console.log('    주별(쓰던 평균/먼 평균):', h.filter((x) => x.t % 2 === 0 && x.t <= 30).map((x) => `${x.t}주 ${Math.round(x.useAvg)}/${Math.round(x.farAvg)}`).join(' '));
const m0 = many({}); console.log('    세계 8가지 평균: 최고', m0.peak, '· 먼 나라 최고', m0.far, '· 회복', m0.rec, '주');

// [1] 용량 × 막힌 기간 (집계)
const SWEEP = { cap: {}, which: {}, detour: {} };
console.log('\n[1] 바닷길 용량 × 막힌 기간: 가장 많이 오른 나라 / 안 쓰던 나라 중 최고 / 다시 열린 뒤 풀리기까지(주, 80주 안에 안 풀린 판 수)');
for (const cap of [1, 1.25, 1.5, 2, 2.5]) { SWEEP.cap[cap] = {}; for (const dur of [4, 10, 20]) { const s = many({ cap, dur }); SWEEP.cap[cap][dur] = s; console.log(`    용량 ${cap * 100}% · ${dur}주: ${s.peak} / ${s.far} / ${s.rec}주 (${s.never}) · 붐빔 최고 ${s.load}%`); } }

// [2] 어느 길목을 막나
console.log('\n[2] 막는 길목별(기본 설정): 쓰던 나라 최고 / 안 쓰던 나라 최고 / 회복');
for (const w of ['A', 'B', 'C']) { const s = many({ which: w }); SWEEP.which[w] = s; console.log(`    ${w} ${M.ROUTES.find((r) => r.id === w).name}: ${s.use} / ${s.far} / ${s.rec}주`); }

// [3] 우회로 길이
console.log('\n[3] 우회로 길이별(가람 해협, 10주): 얼음 바다 최고 / 별 바다 최고 / 쓰던 나라 최고');
for (const d of [0.8, 1, 1.5, 2]) {
  const rs = SEEDS.map((seed) => M.run(Object.assign({}, D, { detour: d, seed })));
  const o = { ice: r1(avg(rs.map((r) => seaPeak(r.s, 3)))), star: r1(avg(rs.map((r) => seaPeak(r.s, 2)))), use: r1(avg(rs.map((r) => r.peakUse))) };
  SWEEP.detour[d] = o; console.log(`    ${d * 100}%: ${o.ice} / ${o.star} / ${o.use}`);
}

// [4] 건전성
console.log('\n[4] 건전성');
const z = M.run(Object.assign({}, D, { which: 'none' }));
console.log('    안 막으면 80주 내내 물가 지수 최고', z.peak.toFixed(3), '(100이어야 함)');
const s1 = M.create(Object.assign({}, D)); let tot = 0, dem = 0; s1.OD.forEach((od) => { dem += od.q; od.paths.forEach((p) => { tot += p.f; }); });
console.log('    화물 보존: 수요 합', dem.toFixed(6), '· 길에 나뉜 합', tot.toFixed(6));
// 평소 상태의 균형(워드롭): 쓰이는 길의 시간이 가장 빠른 길보다 얼마나 긴가
let gap = 0, gw = 0; for (const od of s1.OD) { const cs = od.paths.filter((p) => p.f > 1e-6).map((p) => p.es.reduce((x, k) => x + s1.cost[k], 0)); const b = Math.min(...cs); od.paths.forEach((p, j) => { if (p.f > 1e-6) { const c = p.es.reduce((x, k) => x + s1.cost[k], 0); gap += p.f * (c - b) / b; gw += p.f; } }); }
console.log('    평소 균형 차이(쓰이는 길이 가장 빠른 길보다 긴 정도, 화물 가중 평균):', (gap / gw * 100).toFixed(3), '%');
console.log('\nSWEEP =', JSON.stringify(SWEEP));
