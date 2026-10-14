// 기립박수(관객석 문턱 모델) 검증.  사용법: node tools/validate-ovation.js
const O = require('../site/experiments/ovation/sim.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pc = (v) => (v * 100).toFixed(0) + '%';
const D = O.DEFAULTS, RUNS = 30;
const avg = (o) => mean(O.finals(Object.assign({}, D, o), RUNS));
console.log('기본값: 관객', D.rows, '줄 ×', D.cols, '자리 =', D.rows * D.cols, '명 · 만족도', D.quality, '· 따라 하기', D.follow, '· 처음 일어선 사람', D.starters, '명(', D.place, ') · 시야', D.depth, '줄 · 반응 확률', D.react, '· 최대', D.maxSteps, '초');

// 1. 시야: 앞줄은 양옆만 보이고, 앞줄 사람은 뒤에서 많은 사람이 본다
{
  const { vis, seenBy } = O.visibility(D), C = D.cols, mid = Math.floor(C / 2), last = (D.rows - 1) * C;
  console.log('\n[1] 보이는 사람 수: 앞줄 가운데', vis[mid].length, '명 · 맨 뒷줄 가운데', vis[last + mid].length, '명');
  console.log('    나를 보는 사람 수: 앞줄 가운데', seenBy[mid], '명 · 맨 뒷줄 가운데', seenBy[last + mid], '명');
}

// 2. 기본 설정 한 번(시드 1)과 30번 평균
{
  const s = O.create({ seed: 1 }).run();
  console.log('\n[2] 기본 설정 시드 1: 끝난 시각', s.step, '초 · 결국 일어선 비율', pc(s.share()), '(앞쪽 절반', pc(s.front[s.step]), '/ 뒤쪽 절반', pc(s.back[s.step]) + ')');
  console.log('    10초 때', pc(s.history[10]), '· 시간별', s.history.map((v) => Math.round(v * 100)).join(' '));
  const runs = [], fr = [], bk = [];
  for (let k = 0; k < RUNS; k++) { const r = O.create({ seed: 1 + k * 13 }).run(); runs.push(r.share()); fr.push(r.front[r.step]); bk.push(r.back[r.step]); }
  console.log('    30번 평균', pc(mean(runs)), '(가장 적을 때', pc(Math.min(...runs)), '· 가장 많을 때', pc(Math.max(...runs)) + ') · 앞쪽 절반', pc(mean(fr)), '뒤쪽 절반', pc(mean(bk)));
}

// 3. 같은 수가 어디에서 일어서느냐 (만족도 75%, 따라 하기 60%)
console.log('\n[3] 처음 일어선 사람 수별 결국 일어선 비율 (30번 평균): 앞쪽 두 줄 | 아무 데나 | 뒤쪽 두 줄');
for (const k of [0, 1, 2, 4, 6, 8, 10, 14, 20, 30]) console.log(`    ${String(k).padStart(2)}명  ${pc(avg({ starters: k, place: 'front' })).padStart(4)} | ${pc(avg({ starters: k, place: 'random' })).padStart(4)} | ${pc(avg({ starters: k, place: 'back' })).padStart(4)}   (처음 비율 ${pc(k / (D.rows * D.cols))})`);

// 4. 만족도의 선 (처음 8명 앞쪽)
console.log('\n[4] 공연 만족도별 결국 일어선 비율 (처음 8명 앞쪽, 30번 평균)');
for (const q of [0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) console.log(`    만족도 ${pc(q)}  ${pc(avg({ quality: q }))}  (뒤쪽 두 줄이면 ${pc(avg({ quality: q, place: 'back' }))})`);

// 5. 따라 하는 정도
console.log('\n[5] 따라 하는 정도별 (기본 나머지, 30번 평균)');
for (const f of [0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 1]) console.log(`    따라 하기 ${pc(f)}  ${pc(avg({ follow: f }))}`);
console.log('    따라 하기 0%(문턱 무한대): ', pc(avg({ follow: 0 })), '= 처음 일어선 사람만', pc(D.starters / (D.rows * D.cols)));

// 6. 재현성
console.log('\n[6] 같은 시드 같은 결과:', O.create({ seed: 5 }).run().history.join() === O.create({ seed: 5 }).run().history.join());
