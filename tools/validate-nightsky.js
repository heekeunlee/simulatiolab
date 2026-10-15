// 밤하늘 별 밝기 분포 검증.  사용법: node tools/validate-nightsky.js
// 페이지 문구와 app.js의 집계 그래프(④⑤, 같은 계산을 브라우저에서 다시 함)는 이 출력과 같아야 한다. 시드 고정이라 다시 돌려도 같다.
const N = require('../site/experiments/nightsky/sim.js');
const D = N.DEFAULTS, C = N.C, SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const runs = (o) => SEEDS.map((seed) => N.summary(Object.assign({}, D, o, { seed })));
const avg = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
const r0 = Math.round, r1 = (v) => Math.round(v * 10) / 10;
console.log('기본값:', JSON.stringify(D), `· 별이 흩어진 공 반지름 ${C.R}, 최소 거리 ${C.DMIN}, 원래 밝기 평균 ${C.M0}등급 · 집계: 시드 ${SEEDS.length}개 평균`);

// [0] 이론과 비교: 고르게 퍼진 별은 'm등급보다 밝은 별 수'가 10^(0.6m)에 비례 → 한 등급마다 10^0.6 ≈ 3.98배
//     공 안 밀도 n, 원래 밝기가 정규분포(폭 σ등급)이면  N(<m) = Ntot · (10^(0.6m) − 1)/(R³ − 1) · exp(½(0.6·ln10·σ)²)  (공의 끝에 닿지 않는 동안)
console.log('\n[0] 이론과 시뮬레이션: m등급보다 밝은 별 수 (8판 평균)');
for (const w of [0, 100]) {
  const rs = runs({ width: w }), s = w / 100, boost = Math.exp(0.5 * (0.6 * Math.LN10 * s) ** 2), Nt = D.n * 1000;
  const row = [1, 2, 3, 4, 5, 6, 7].map((m) => `${m}: ${r0(avg(rs, (r) => r.cum[m]))} (이론 ${r0(Nt * (10 ** (0.6 * m) - 1) / (C.R ** 3 - 1) * boost)})`);
  console.log(`    밝기 폭 ${s}등급: ` + row.join(' · '));
}
console.log(`    한 등급마다 배수(이론) 10^0.6 = ${(10 ** 0.6).toFixed(2)}`);

// [1] 기본 하늘
{ const rs = runs({});
  console.log('\n[1] 기본(별 10만 개, 밝기 폭 1등급, 먼지 없음, 시골 = 6등급까지)');
  console.log(`    보이는 별 ${r0(avg(rs, (r) => r.vis))}개 (판별 ${rs.map((r) => r.vis).join(', ')}) = 전체의 ${(avg(rs, (r) => r.vis) / 1000).toFixed(2)}%`);
  console.log(`    1등급보다 밝은 별 ${r1(avg(rs, (r) => r.cum[1]))}개 · 2등급보다 밝은 별 ${r1(avg(rs, (r) => r.cum[2]))}개 · 3등급보다 밝은 별 ${r1(avg(rs, (r) => r.cum[3]))}개`);
  console.log(`    한 등급마다 배수(4~7등급) ${avg(rs, (r) => r.ratio).toFixed(2)} (판별 ${rs.map((r) => r.ratio.toFixed(2)).join(', ')})`);
  console.log(`    밝게 보이는 상위 20개 중 원래 밝은 별(원래 밝기 상위 10%) ${r1(avg(rs, (r) => r.top20))}개 (판별 ${rs.map((r) => r.top20).join(', ')})`);
  console.log(`    보이는 별까지 거리의 중앙값 ${r1(avg(rs, (r) => r.medVis))} · 모든 별의 거리 중앙값 ${r1(avg(rs, (r) => r.medAll))} (공 반지름 ${C.R})`); }

// [2] 조건별 집계 (페이지 ④)
console.log('\n[2] 조건별: 한 등급마다 배수 · 6등급까지 보이는 별 · 2등급보다 밝은 별 · 보이는 별 거리 중앙값 · 상위 20개 중 원래 밝은 별');
for (const [name, o] of [['기본', {}], ['별 2배', { n: 200 }], ['별 1/4', { n: 25 }], ['밝기 모두 같음', { width: 0 }], ['밝기 차이 2배', { width: 200 }], ['먼지 50%', { dust: 50 }], ['먼지 100%', { dust: 100 }]]) {
  const rs = runs(o);
  console.log(`    ${name.padEnd(10)} ${avg(rs, (r) => r.ratio).toFixed(2)}배 | ${String(r0(avg(rs, (r) => r.cum[6]))).padStart(5)}개 | ${String(r0(avg(rs, (r) => r.cum[2]))).padStart(3)}개 | 거리 ${r1(avg(rs, (r) => r.medVis))} | ${r1(avg(rs, (r) => r.top20))}개`);
}

// [3] 도시 불빛 (페이지 ⑤)
{ const rs = runs({}), names = ['깜깜한 산속', '시골', '교외', '작은 도시', '큰 도시', '도심 한복판'];
  console.log('\n[3] 도시 불빛(보이는 한계 등급)별 보이는 별 수');
  console.log('    ' + C.LIMITS.map((lim, i) => `${names[i]}(${lim}등급) ${r0(avg(rs, (r) => r.cum[lim]))}`).join(' · ')); }

// [4] 재생 건전성: 재생 끝의 보이는 별 수 = 한계 등급보다 밝은 별 수, 별 수는 줄지 않음
{ const s = N.create(Object.assign({}, D, { seed: 1 })); let prev = 0, ok = true; while (s.step()) { if (s.shown < prev) ok = false; prev = s.shown; }
  console.log(`\n[4] 재생 점검: ${s.steps}걸음, 끝에 보이는 별 ${s.shown} = 한계보다 밝은 별 ${s.brighter(s.lim)} → ${s.shown === s.brighter(s.lim) && ok ? '일치' : '불일치'}`); }
