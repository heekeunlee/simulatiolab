// 모래더미 모델 검증.  사용법: node tools/validate-sandpile.js
const S = require('../site/experiments/sandpile/sim.js');
const f = (v, d = 2) => v.toFixed(d);

// 1) 모래 알 보존·안정성: 더한 알 = 남은 알 + 사라진 알, 매번 모든 칸이 3알 이하
{
  const s = S.create({ size: 40, seed: 1 }); let ok = true;
  for (let i = 0; i < 5000; i++) { s.drop(); }
  let sum = 0, mx = 0; for (let i = 0; i < s.h.length; i++) { sum += s.h[i]; mx = Math.max(mx, s.h[i]); }
  console.log(`보존 검사: 더한 알 ${s.t} = 남은 ${sum} + 사라진 ${s.lost}  -> ${s.t === sum + s.lost ? '일치' : '불일치'}; 최대 높이 ${mx} (3 이하여야 함)`);
}

// 2) 기본 설정(40x40, 무작위 떨어뜨리기) 20000알: 시드 1~5
const DROPS = 20000, seeds = [1, 2, 3, 4, 5], rows = [];
for (const seed of seeds) {
  const s = S.create({ size: 40, seed });
  const at = {}; for (let i = 1; i <= DROPS; i++) { s.drop(); if (i % 1600 === 0 && i <= 6400) at[i / 1600] = s.mean(); }
  const d = s.dist();
  rows.push({ seed, at, mean: s.mean(), zero: s.zero / s.post, med: s.median(), max: s.maxSize, ratio: s.maxSize / s.median(), slope: d.slope, used: d.used, nz: s.nz, post: s.post });
}
console.log('기본(40x40, 무작위, 20000알), 안정기 = 3x1600알 이후');
for (const r of rows) console.log(`  시드 ${r.seed}: 평균 높이 1N^2 ${f(r.at[1])} 2N^2 ${f(r.at[2])} 3N^2 ${f(r.at[3])} 4N^2 ${f(r.at[4])} 끝 ${f(r.mean)} | 아무 일 없음 ${f(r.zero * 100, 1)}% 중앙값 ${r.med} 최대 ${r.max} 배율 ${f(r.ratio, 0)}배 | 기울기 ${f(r.slope)} (눈사태 ${r.nz}개)`);
const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
console.log(`  평균: 끝 높이 ${f(avg('mean'))} 아무 일 없음 ${f(avg('zero') * 100, 1)}% 중앙값 ${f(avg('med'), 1)} 최대 ${f(avg('max'), 0)} 배율 ${f(avg('ratio'), 0)} 기울기 ${f(avg('slope'))}`);

// 3) 판 크기별 (시드 1~3 평균, 안정기 이후 알 20000개)
console.log('판 크기별 (시드 1~3 평균)');
for (const N of [20, 40, 60, 100]) {
  const r = [1, 2, 3].map((seed) => { const s = S.create({ size: N, seed }); const n = 3 * N * N + 20000; for (let i = 0; i < n; i++) s.drop(); const d = s.dist(); return { mean: s.mean(), zero: s.zero / s.post, med: s.median(), max: s.maxSize, slope: d.slope }; });
  const a = (k) => r.reduce((x, y) => x + y[k], 0) / r.length;
  console.log(`  ${N}x${N}: 평균 높이 ${f(a('mean'))} 아무 일 없음 ${f(a('zero') * 100, 1)}% 중앙값 ${f(a('med'), 1)} 최대 ${f(a('max'), 0)} 기울기 ${f(a('slope'))}`);
}

// 4) 가운데에만 떨어뜨리기
{
  const s = S.create({ size: 40, seed: 1, mode: 'center' }); const marks = [];
  for (let i = 1; i <= 20000; i++) { s.drop(); if (i === 1600 || i === 6400 || i === 20000) marks.push(`${i}알 ${f(s.mean())}`); }
  const d = s.dist();
  console.log(`가운데 떨어뜨리기(40x40, 20000알): 평균 높이 ${marks.join(', ')} | 아무 일 없음 ${f(s.zero / s.post * 100, 1)}% 중앙값 ${s.median()} 최대 ${s.maxSize} 기울기 ${d.slope == null ? '없음' : f(d.slope)}`);
}

// 5) 같은 칸, 같은 한 알: 안정된 더미(무작위로 쌓은 40x40, 12000알 뒤)의 가운데 칸에 3000알을 하나씩 더하기
{
  const s = S.create({ size: 40, seed: 1 }); for (let i = 0; i < 12000; i++) s.drop();
  const c = 20 * 40 + 20, sizes = []; for (let i = 0; i < 3000; i++) sizes.push(s.drop(c));
  const z = sizes.filter((v) => v === 0).length, big = sizes.filter((v) => v >= 100).length;
  console.log(`같은 칸(가운데) 3000알: 아무 일 없음 ${f(z / 30, 1)}% (${z}번), 100번 이상 무너짐 ${big}번, 최대 ${Math.max(...sizes)}번`);
}
