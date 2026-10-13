// 농경 전파(전진하는 파동) 모델 검증.  사용법: node tools/validate-farming.js
const W = require('../site/experiments/farming/sim.js');
const f = (v, d = 2) => (v == null ? '-' : v.toFixed(d));
console.log('① 1차원 평면 파동 (흡수 0): 측정 속도 vs 2·sqrt(rD)');
for (const [r, D] of [[0.01, 10], [0.025, 10], [0.04, 10], [0.025, 4], [0.025, 20], [0.025, 30], [0.01, 4], [0.04, 4]]) {
  const m = W.speed1D({ r, D, mix: 0 }), t = 2 * Math.sqrt(r * D);
  console.log(`  r=${r} D=${D}: 측정 ${f(m)} 이론 ${f(t)} 비 ${f(m / t, 3)}`);
}
console.log('② 토착민 흡수 mix 가 클수록 (r=0.025, D=10): 측정 vs 2·sqrt((r+mix·kappa·h0)·D)');
for (const mix of [0, 0.25, 0.5, 0.75, 1]) {
  const p = { r: 0.025, D: 10, mix }, m = W.speed1D(p);
  console.log(`  mix=${mix}: 측정 ${f(m)} 이론(흡수 반영) ${f(W.speedEff(Object.assign({}, W.DEFAULTS, p)))} 이론(2sqrt(rD)) ${f(W.speedBase(Object.assign({}, W.DEFAULTS, p)))}`);
}
console.log('③ 2차원 점 기원 (기본값, 흡수 0.5, 땅 기름짐 잡음 0.25): 시드별');
for (const seed of [1, 2, 3, 4]) {
  const s = W.create({ seed }).run(5);
  console.log(`  seed=${seed}: 측정 ${f(s.speed())} 이론(2sqrt(rD)) ${f(W.speedBase(s.params))} 이론(흡수 반영) ${f(W.speedEff(s.params))} | 끝 t=${s.t.toFixed(0)}년 덮은 땅 ${f(s.hist.cover.at(-1) * 100, 1)}% 토착 혈통 ${f(s.hist.gShare.at(-1) * 100, 1)}%`);
}
console.log('④ 잡음 없음(patch=0), mix=0, 2차원:');
{ const s = W.create({ patch: 0, mix: 0 }).run(5); console.log(`  측정 ${f(s.speed())} 이론 ${f(W.speedBase(s.params))}  끝 t=${s.t.toFixed(0)}년`); }
console.log('⑤ 기본값 전체 횡단 시간 (장벽별):');
for (const barrier of ['none', 'sea', 'mountain']) {
  const s = W.create({ barrier, seed: 1 }).run(5), h = s.hist;
  const at = (c) => { for (let i = 0; i < h.cover.length; i++) if (h.cover[i] >= c) return h.t[i]; return null; };
  // 장벽 앞(열 44)과 뒤(열 64)의 중간 줄(행 30)·땅다리 줄(행 13) 도착 시각
  const row = (r, c) => f(s.T[r * s.nx + c], 0);
  console.log(`  ${barrier}: 측정(100~380km) ${f(s.speed())} | 땅 50% ${f(at(0.5), 0)}년 90% ${f(at(0.9), 0)}년 99% ${f(at(0.99), 0)}년 끝 ${s.t.toFixed(0)}년 | T(행30,열40)=${row(30, 40)} T(행30,열70)=${row(30, 70)} T(행13,열70)=${row(13, 70)} T(행50,열70)=${row(50, 70)}`);
}
console.log('⑥ 산맥 안에서의 속도 (행 30, 열 50~58) vs 평지 (열 20~40), 잡음 0:');
{ const s = W.create({ barrier: 'mountain', patch: 0, mix: 0 }).run(5);
  const out = s.rowSpeed(30, 20, 40), inn = s.rowSpeed(30, 50, 58);
  console.log(`  평지 ${f(out)} 산맥 ${f(inn)} 비 ${f(inn / out, 3)} (이론 ${f(Math.sqrt(W.BAR.mD * W.BAR.mR), 3)})`); }
console.log('⑦ 해협: 땅다리 반대편 도착 지연 (잡음 0, mix 0.5):');
{ const s = W.create({ barrier: 'sea', patch: 0 }).run(5);
  for (const r of [13, 30, 50]) console.log(`  행 ${r}: 열 45 ${f(s.T[r * s.nx + 45], 0)}년 → 열 70 ${f(s.T[r * s.nx + 70], 0)}년 (차 ${f(s.T[r * s.nx + 70] - s.T[r * s.nx + 45], 0)}년)`); }
console.log('⑧ 흡수 비율별 끝 상태 토착 혈통 비율 / 속도 (2차원, 시드 1, 잡음 0.25):');
for (const mix of [0, 0.5, 1]) { const s = W.create({ mix }).run(5); console.log(`  mix=${mix}: 속도 ${f(s.speed())} 토착 혈통 ${f(s.hist.gShare.at(-1) * 100, 1)}% 남은 수렵채집 ${f(s.hist.hLeft.at(-1) * 100, 1)}%`); }
console.log('⑨ 한 세대(25년) 이동 거리 = 속도 × 25');
