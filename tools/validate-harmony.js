// 두 음의 어울림(거칠기) 모델 검증.  사용법: node tools/validate-harmony.js
const H = require('../site/experiments/harmony/sim.js');
const f = (v, d = 1) => v.toFixed(d);
const ET = (cv) => H.NAMES.map((n) => `${n.short} ${f(cv.idx[n.c], 0)}`).join(', ');
console.log('① 배음 수별: 가장 거친 곳(센트), 편한 골(같은 음 제외), 반음 자리의 거칠기 (음색 #1)');
for (const N of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const cv = H.curve(N, 1); let mx = 0; for (let c = 0; c <= 1200; c++) if (cv.idx[c] > cv.idx[mx]) mx = c;
  const d = H.dips(cv).filter((x) => x.c > 0);
  console.log(`  N=${N}: 가장 거친 곳 ${mx}센트(반음 ${f(mx / 100)}개) | 골 ${d.length}개: ${d.map((x) => `${x.name.p}:${x.name.q}@${x.c}(${f(x.v)})`).join(' ')}`);
  console.log(`         반음 자리: ${ET(cv)}`);
}
console.log('② 기본값(N=6, 음색 #1): 반음 자리 거칠기 순위 (편한 순)');
{ const cv = H.curve(6, 1); const rk = H.NAMES.map((n) => ({ n: n.ko, v: cv.idx[n.c] })).sort((a, b) => a.v - b.v);
  console.log('  ' + rk.map((x) => `${x.n} ${f(x.v, 0)}`).join(' < ')); }
console.log('③ 순음(N=1)과 악기 소리(N=6) 대비: 도-솔 · 도-시 · 도-파# · 도-라');
for (const N of [1, 6]) { const cv = H.curve(N, 1); console.log(`  N=${N}: 도-솔 ${f(cv.idx[700], 0)} 도-시 ${f(cv.idx[1100], 0)} 도-파# ${f(cv.idx[600], 0)} 도-라 ${f(cv.idx[900], 0)} 도-높은 도 ${f(cv.idx[1200], 0)}`); }
console.log('④ 다른 음색(배음 세기를 무작위로, N=6): 골의 자리');
for (const s of [1, 2, 3, 4, 5, 6]) { const d = H.dips(H.curve(6, s)).filter((x) => x.c > 0); console.log(`  음색 #${s}: ${d.map((x) => `${x.name.p}:${x.name.q}@${x.c}`).join(' ')}`); }
console.log('⑤ 다른 음색에서 배음 수별 골 개수 (그래프 ④)');
for (const s of [1, 2, 3]) console.log(`  음색 #${s}: ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((N) => H.dipCount(N, s)).join(' ')}`);
console.log('⑥ 평균율(반음 자리)과 단순한 비의 차이 (센트)');
H.NAMES.forEach((n) => { const r = H.nearestRatio(n.c, 8); if (n.c % 1200) console.log(`  ${n.ko}: ${n.c} vs ${r.p}:${r.q} = ${f(H.cents(r.p / r.q))} (차 ${f(n.c - H.cents(r.p / r.q))})`); });
console.log('⑦ 재생 동기화: 지나온 곳까지만 찾은 골 (N=6)');
for (const R of [300, 400, 500, 750, 1200]) { const d = H.dips(H.curve(6, 1), R).filter((x) => x.c > 0); console.log(`  ${R}센트까지: ${d.map((x) => `${x.name.p}:${x.name.q}`).join(' ') || '없음'}`); }
