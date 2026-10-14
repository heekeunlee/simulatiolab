// 같은 노래를 계속 들으면 (단순 노출 + 질림) 모델 검증.  사용법: node tools/validate-mereexposure.js
const M = require('../site/experiments/mereexposure/sim.js');
const D = M.DEFAULTS, f0 = (v) => Math.round(v), f1 = (v) => v.toFixed(1), pc = (v) => Math.round(v * 100) + '%';
console.log('기본값: 사람', D.n, '명 · 듣기', D.listens, '번 · 복잡도', D.c, '· 질리는 속도', D.rate, '· 간격', D.gap, '일 · 쉬는 동안 가라앉는 시간', M.REST, '일');

// 1. 닫힌 식과 시뮬레이션 (질림 민감도가 모두 1인 경우)
{
  let maxd = 0;
  for (const o of [{}, { c: 0 }, { c: 1 }, { gap: 7 }, { rate: 2 }]) {
    const S = M.create(Object.assign({ sdS: 0 }, o)).run();
    for (let k = 1; k <= 100; k++) maxd = Math.max(maxd, Math.abs(S.mean[k] - M.likingAt(o, k, 1)));
  }
  console.log('\n[1] 닫힌 식 B_k = delta(1-a^k)/(1-a) 과 시뮬레이션 차이 최댓값:', maxd.toExponential(1), '점');
  const steady = (o) => { const p = Object.assign({}, D, o), a = M.decay(p.gap); return 100 * (1 - 0.045 * p.rate * (1.1 - p.c) / (1 - a)); };
  console.log('    아주 오래 들었을 때(평균적인 사람) 호감의 이론값: 기본', f1(steady({})), '· 단순(0)', f1(steady({ c: 0 })), '· 복잡(1)', f1(steady({ c: 1 })), '· 7일마다', f1(steady({ gap: 7 })));
}

// 2. 기본 설정 (시드 1과 시드 1~5 평균)
const show = (name, o) => {
  const a = M.summary(o, [1]), b = M.summary(o, [1, 2, 3, 4, 5]);
  console.log(`  ${name}: 가장 좋아한 때 ${f0(a.peakAt)}번째 (5시드 ${f1(b.peakAt)}) · 그때 호감 ${f0(a.peak)}점 (${f0(b.peak)}) · 10번째 ${f0(a.at10)} · 30번째 ${f0(a.at30)} · 100번째 ${f0(a.final)}점 (${f0(b.final)}) · 싫어진 사람 ${pc(a.disliked)} (${pc(b.disliked)}) · 사람마다 ${f0(a.firstAt)}~${f0(a.lastAt)}번째`);
};
console.log('\n[2] 기본 설정과 곡의 복잡도');
show('기본(복잡도 0.3)', {});
for (const c of [0, 0.1, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) show('복잡도 ' + c, { c });
console.log('\n[3] 듣는 간격');
for (const gap of [2, 3, 5, 7, 14]) show(gap + '일마다', { gap });
for (const gap of [1, 3, 7]) { show('단순(0) ' + gap + '일마다', { c: 0, gap }); show('복잡(1) ' + gap + '일마다', { c: 1, gap }); }
console.log('\n[4] 질리는 속도');
for (const rate of [0.5, 1.5, 2]) show('×' + rate, { rate });

// 5. 재생과 그래프: 처음 몇 번의 평균 호감 (기본, 시드 1)
{
  const S = M.create({ seed: 1 }).run();
  console.log('\n[5] 기본 시드1 평균 호감:', [1, 2, 3, 5, 8, 11, 15, 20, 30, 50, 70, 100].map((k) => k + '번째 ' + f0(S.mean[k])).join(' · '));
  console.log('    싫어진 사람 수:', [20, 30, 40, 50, 60, 80, 100].map((k) => k + '번째 ' + S.disliked[k] + '명').join(' · '));
  const first = S.disliked.findIndex((v) => v > 0); console.log('    처음으로 싫어진 사람이 생긴 때:', first, '번째');
}
// 6. 재현성
console.log('\n[6] 같은 시드 같은 결과:', M.create({ seed: 4 }).run().mean.join() === M.create({ seed: 4 }).run().mean.join());
