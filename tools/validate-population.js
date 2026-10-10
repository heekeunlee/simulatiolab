// 인구 모델 검증.  사용법: node tools/validate-population.js
const P = require('../site/experiments/population/sim.js');
const m = (v) => (v / 1e6).toFixed(1) + 'M', pc = (v) => (v * 100).toFixed(1) + '%';
const s = P.survival(83.5);
let l = 1; const sv = {}; for (let x = 0; x < 101; x++) { if ([65, 80, 90].includes(x)) sv[x] = l.toFixed(3); l *= s[x]; }
console.log('생존확률 (출생 → 65/80/90세까지):', sv);
const st = P.create({}); const a = st.summary();
console.log('2024 시작:', '총', m(a.total), '0~14', pc(a.shareYoung), '15~64', pc(a.shareWork), '65+', pc(a.shareOld), '중위연령', a.median.toFixed(1), '노년부양비', pc(a.oldDep));
const first = st.advance(); console.log('2024→25 출생아', Math.round(st.lastBirths / 1000) + '천 (참고: 2023년 약 230천)');
const row = (o) => { const h = P.project(o), e = h[h.length - 1]; return `2070: 총 ${m(e.total)}, 65+ ${pc(e.shareOld)}, 15~64 ${pc(e.shareWork)}, 노년부양비 ${pc(e.oldDep)}, 중위연령 ${e.median.toFixed(1)}`; };
console.log('\n기본(합계출산율 0.72 유지, 이민 0, 기대수명 +1년/10년):\n ', row({}));
for (const t of [0.5, 0.72, 1.0, 1.5, 2.1]) console.log(`TFR ${t}:`, row({ tfr: t }));
console.log('이민 +100k/년, TFR 0.72:', row({ migration: 100000 }));
console.log('이민 +300k/년, TFR 0.72:', row({ migration: 300000 }));
console.log('이민 -50k/년:', row({ migration: -50000 }));
console.log('기대수명 증가 0 / 4년 per 10년:', row({ lifeGain: 0 }), '|', row({ lifeGain: 4 }));
const h72 = P.project({ endYear: 2072 }), e = h72[h72.length - 1];
console.log('\n2072 (모델, TFR 0.72 고정):', m(e.total), pc(e.shareOld), '← 통계청 중위 추계(2072): 약 36M, 65+ 47.7% (출산율이 0.65→1.08로 회복한다고 가정)');
