// 산불 모델 검증.  사용법: node tools/validate-wildfire.js
const W = require('../site/experiments/wildfire/sim.js');
const f = (v, d = 1) => v.toFixed(d), pc = (v) => f(v * 100, 0) + '%';
// 1) 독립 구현으로 확인한 정사각 격자 site percolation: 나무 밀도 rho 에서 가장 큰 덩어리의 비율 (이론 임계값 약 0.593)
function rngF(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function largest(n, rho, seed) {
  const r = rngF(seed), g = new Uint8Array(n * n), seen = new Uint8Array(n * n); let best = 0, tot = 0;
  for (let i = 0; i < n * n; i++) if (r() < rho) { g[i] = 1; tot++; }
  for (let s = 0; s < n * n; s++) {
    if (!g[s] || seen[s]) continue; const st = [s]; seen[s] = 1; let c = 0;
    while (st.length) { const q = st.pop(); c++; const x = q % n; for (const nb of [x > 0 ? q - 1 : -1, x < n - 1 ? q + 1 : -1, q - n, q + n]) if (nb >= 0 && nb < n * n && g[nb] && !seen[nb]) { seen[nb] = 1; st.push(nb); } }
    best = Math.max(best, c);
  }
  return best / (n * n);
}
console.log('독립 구현, 100x100 격자, 무작위 나무 밀도별 가장 큰 덩어리가 전체 칸에서 차지하는 비율 (20회 평균)');
for (const rho of [0.3, 0.4, 0.5, 0.55, 0.59, 0.62, 0.65, 0.7]) { let s = 0; for (let k = 1; k <= 20; k++) s += largest(100, rho, k); console.log('  밀도', rho, '→', f(s / 20, 3)); }
// 2) 균형: 장기 평균에서 단위 시간당 자라는 나무 수 = 타는 나무 수
{
  const m = W.create({ n: 100, p: 0.01, f: 0.0002, s: 0, seed: 1 }); 
  m.run(1500); const t0 = m.step, b0 = m.burned, tr0 = m.density() * m.N;
  m.run(30000); const tr1 = m.density() * m.N, burnedN = m.burned - b0;
  console.log('균형 (30000단계): 탄 나무 합', burnedN, '나무 수 변화', Math.round(tr1 - tr0), '→ 심은 나무 =', burnedN + Math.round(tr1 - tr0), ' (빈 땅 비율 평균 x p x 칸 수 x 단계와 비교:', Math.round(0.01 * (1 - W.stats(m, 1500).meanDens) * m.N * 30000), ')');
}
// 3) 기본 설정: 억제 강도별
const base = { n: 100, p: 0.01, f: 0.0002, smallFrac: 0.05 }, T = 40000, WARM = 2000;
console.log('기본 (100x100, p=1%, 1만 칸당 번개 2번/단계, 끄는 불 상한 5%, 큰 불 = 10% 이상), 시드 1~4 평균, 40000단계 중 앞 2000단계 제외');
for (const s of [0, 0.5, 0.9, 1]) {
  const rs = [1, 2, 3, 4].map((seed) => W.stats(W.create(Object.assign({}, base, { s, seed })).run(T), WARM));
  const avg = (k) => rs.reduce((x, y) => x + y[k], 0) / rs.length;
  console.log(`  끄는 확률 ${pc(s)}: 불 ${f(avg('count'), 0)}번, 큰 불 ${f(avg('big'), 0)}번 (1만 단계당 ${f(avg('bigPer10k'), 1)}), 큰 불의 면적 비중 ${pc(avg('bigShare'))}, 탄 면적/단계 ${f(avg('burnPerStep') * 100, 2)}%, 평균 밀도 ${pc(avg('meanDens'))}, 가장 큰 불 격자의 ${f(avg('largest') / 100, 0)}%, 상위 1% 불의 면적 비중 ${pc(avg('top1Share'))}`);
}
// 4) 큰 불(10%) 상한 / 번개 세기 / 자라는 속도 바꾸기 (끄는 확률 0 vs 90%)
console.log('설정을 바꾸면 (큰 불의 면적 비중: 끄기 0% → 90%, 큰 불 횟수 1만 단계당)');
for (const o of [{ f: 0.0001 }, { f: 0.0002 }, { f: 0.0005 }, { f: 0.001 }, { p: 0.005 }, { p: 0.02 }, { n: 60 }, { n: 160 }]) {
  const q = Object.assign({}, base, o);
  const run = (s) => { const r = [1, 2, 3].map((seed) => W.stats(W.create(Object.assign({}, q, { s, seed })).run(T), WARM)); return [r.reduce((x, y) => x + y.bigShare, 0) / 3, r.reduce((x, y) => x + y.bigPer10k, 0) / 3]; };
  const a = run(0), b = run(0.9);
  console.log(' ', JSON.stringify(o), pc(a[0]), '→', pc(b[0]), ' 횟수', f(a[1], 1), '→', f(b[1], 1));
}
