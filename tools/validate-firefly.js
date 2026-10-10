// 반딧불이 모델 검증.  사용법: node tools/validate-firefly.js
const F = require('../site/experiments/firefly/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const base = { coupling: 0.025, radius: 0.3, spread: 0.1 };
const f = (o) => mean(F.finalSync(Object.assign({}, base, o), 6)).toFixed(2);
console.log('기본(결합 2.5%, 반경 30%, 퍼짐 10%) 최종 동기화 r(6회 평균):', f({}));
const tt = [];
for (let seed = 1; seed <= 10; seed++) { const s = F.create(Object.assign({ seed }, base)); let t = -1; while (s.advance()) if (s.step % 5 === 0 && s.sync() > 0.9 && t < 0) t = s.step * s.params.dt; tt.push(t < 0 ? 'X' : t.toFixed(0)); }
console.log('r>0.9에 처음 닿은 주기(10개 시드):', tt.join(','));
console.log('결합 세기별 최종 r'); for (const c of [0, 0.005, 0.01, 0.015, 0.02, 0.03, 0.05, 0.08]) console.log(`  ${(c * 100).toFixed(1)}%  ${f({ coupling: c })}`);
console.log('이웃 반경별 최종 r'); for (const r of [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.6, 1]) console.log(`  ${(r * 100).toFixed(0)}%  ${f({ radius: r })}`);
console.log('주파수 퍼짐별 최종 r'); for (const s of [0, 0.05, 0.1, 0.15, 0.2]) console.log(`  ${(s * 100).toFixed(0)}%  ${f({ spread: s })}`);
