// 약한 유대(작은 세상) 모델 검증.  사용법: node tools/validate-weakties.js
const W = require('../site/experiments/weakties/sim.js');
const f = (v, d = 2) => v.toFixed(d);
const base = { n: 300, k: 6, q: 0.5, seed: 1 };
console.log('기본 설정: 300명, 이웃 6명, 전달 확률 50%');
// 이론: p=0 에서 군집계수 C0 = 3(k-2)/(4(k-1)), 경로 길이 L0 ≈ n/(2k); p>0 에서 C(p) ≈ C0 (1-p)^3
const C0 = (3 * (base.k - 2)) / (4 * (base.k - 1)), L0t = base.n / (2 * base.k);
const sw = W.sweep(base, [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1], 20);
console.log(`p=0: 경로 길이 시뮬 ${f(sw.zero.L)} (근사 n/2k = ${f(L0t)}), 군집계수 시뮬 ${f(sw.zero.C, 3)} (이론 ${f(C0, 3)}), 90% 도달 ${f(sw.zero.T, 1)}턴`);
console.log('p | 경로길이(비율) | 군집계수 시뮬 vs 이론 C0(1-p)^3 (비율) | 90%까지 턴');
sw.pts.forEach((d) => console.log(`${(d.x * 100).toFixed(2).padStart(6)}% | ${f(d.L)} (${f(d.Lr)}) | ${f(d.C, 3)} vs ${f(C0 * Math.pow(1 - d.x, 3), 3)} (${f(d.Cr)}) | ${f(d.T, 1)}`));
// 기본 p=2% : 속도 배수
const T0 = W.t90Mean(base, 0, 40), T2 = W.t90Mean(base, 0.02, 40), T5 = W.t90Mean(base, 0.05, 40), T1 = W.t90Mean(base, 0.01, 40), T100 = W.t90Mean(base, 1, 40);
console.log(`90% 도달 턴 (40번 평균): p=0 ${f(T0, 1)}, 1% ${f(T1, 1)}, 2% ${f(T2, 1)}, 5% ${f(T5, 1)}, 100% ${f(T100, 1)} -> 2%일 때 x${f(T0 / T2, 1)} 빠름`);
const g2 = W.buildGraph(300, 6, 0.02, W.mulberry32(1)); console.log(`p=2% 한 그래프: 약한 연결 ${g2.weak.length}개 / 전체 ${g2.weak.length + g2.lattice.length}개 (기대 ${0.02 * 900})`);
// 절반 지점(소수 연결만으로)
const sw1 = W.sweep(base, [0.01], 20).pts[0]; console.log(`p=1%: 경로 길이 ${f(sw1.L)} = p=0의 ${f(sw1.Lr * 100, 0)}%, 군집계수는 ${f(sw1.Cr * 100, 0)}%`);
// 재현성
const a = W.runSpread(W.buildGraph(300, 6, 0.02, W.mulberry32(5)), 0.5, W.mulberry32(6)).t90, b = W.runSpread(W.buildGraph(300, 6, 0.02, W.mulberry32(5)), 0.5, W.mulberry32(6)).t90; console.log('같은 시드 같은 결과:', a === b);
// 모두에게 퍼지는지
const r = W.runSpread(g2, 0.5, W.mulberry32(3)); console.log(`p=2% 한 번: 90% ${r.t90}턴, 100% ${r.t100}턴, 최종 ${f(r.reached * 100, 0)}%`);
// 전달 확률 낮을 때 / 이웃 수 다를 때
for (const o of [{ q: 0.2 }, { q: 1 }, { k: 4 }, { k: 10 }, { n: 500 }]) { const bb = Object.assign({}, base, o); console.log(`  ${JSON.stringify(o)}: p=0 ${f(W.t90Mean(bb, 0, 20), 1)}턴 -> p=2% ${f(W.t90Mean(bb, 0.02, 20), 1)}턴`); }
