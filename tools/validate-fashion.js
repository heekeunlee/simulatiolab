// 유행 순환 검증.  사용법: node tools/validate-fashion.js
const F = require('../site/experiments/fashion/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const show = (name, o, rounds) => { const r = F.measure(Object.assign({ rounds: rounds || 600 }, o), 6); console.log(`  ${name.padEnd(18)} 회전 ${mean(r.map((x) => x.rotation)).toFixed(2)}바퀴/100라운드 (최소 ${Math.min(...r.map((x) => x.rotation)).toFixed(2)}, 최대 ${Math.max(...r.map((x) => x.rotation)).toFixed(2)})  다양성 ${mean(r.map((x) => x.diversity)).toFixed(2)}`); };
console.log('기본: 트렌드세터 15%, 모방 2도, 도망 2도, 흔들림 1도, 600라운드');
show('기본', {});
console.log('도망 속도 β (모방 α=2)');   for (const b of [0, 0.5, 1, 2, 3, 5]) show('β=' + b, { beta: b });
console.log('모방 속도 α (도망 β=2)');   for (const a of [0.5, 1, 2, 3, 5]) show('α=' + a, { alpha: a });
console.log('트렌드세터 비율');          for (const s of [0.05, 0.1, 0.15, 0.25, 0.4]) show('비율 ' + s, { share: s });
console.log('흔들림');                   for (const j of [0, 1, 2, 3, 5]) show('흔들림 ' + j, { jitter: j });
console.log('β=0 이면 한 스타일에 머무는가 (6000라운드까지)'); show('β=0, 6000', { beta: 0 }, 6000);
const s = F.create({}).run(); console.log('기본 한 번: 대중이 트렌드세터보다 뒤처진 정도(도)', s.gap().toFixed(1), ' 한 바퀴 약', (100 / s.rotation()).toFixed(0), '라운드');
