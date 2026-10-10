// 원숭이와 햄릿 검증.  사용법: node tools/validate-monkey.js
const M = require('../site/experiments/monkey/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
for (const t of ['tobe', 'weasel']) {
  const text = M.TARGETS[t], L = text.length;
  console.log(`\n[${t}] "${text}" (${L}글자)`);
  const gens = M.selectionGens(text, 100, 0.05, 20);
  console.log(`  누적 선택(복사본 100, 돌연변이 5%): 평균 ${mean(gens).toFixed(0)}세대 (최소 ${Math.min(...gens)}, 최대 ${Math.max(...gens)}), 평균 ${mean(gens.map((g) => g * 100)).toFixed(0)}번 시도`);
  const s = M.create({ target: t, seed: 3 }).run();
  console.log(`  순수 우연 ${s.chanceAttempts.toLocaleString()}번 시도 뒤 최고 일치 ${s.chanceBestMatch}/${L}  ("${s.chanceString()}")`);
  console.log(`  27^${L} = 10^${M.log10Chance(L).toFixed(2)},  초당 10억 번 시도 시 기대 ${M.chanceYears(L, 1e9).toExponential(2)}년 (우주 나이의 ${(M.chanceYears(L, 1e9) / M.UNIVERSE_YEARS).toExponential(2)}배)`);
}
console.log('\n돌연변이율별 세대 수 (TO BE OR NOT TO BE, 복사본 100, 10회 평균)');
for (const m of [0.005, 0.01, 0.02, 0.05, 0.1, 0.2]) console.log(`  ${(m * 100).toFixed(1)}%  ${mean(M.selectionGens(M.TARGETS.tobe, 100, m, 10)).toFixed(0)}세대`);
console.log('복사본 수별 세대 수 (돌연변이 5%)');
for (const o of [10, 30, 100, 200]) console.log(`  ${o}  ${mean(M.selectionGens(M.TARGETS.tobe, o, 0.05, 10)).toFixed(0)}세대`);
console.log('앞 L글자까지 시도 횟수 평균 (선택, 복사본 100, 5%) vs 우연 27^L');
for (const L of [1, 3, 6, 9, 12, 15, 18]) console.log(`  L=${L}  선택 ${mean(M.selectionAttempts(M.TARGETS.tobe, L, 100, 0.05, 8)).toFixed(0)}  우연 ${Math.pow(27, L).toExponential(2)}`);
