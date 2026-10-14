// 히트곡과 평행 세계 모델 검증.  사용법: node tools/validate-hitsong.js
const H = require('../site/experiments/hitsong/sim.js');
const pc = (v, d = 0) => (v * 100).toFixed(d) + '%';
const D = H.DEFAULTS;

// 1) 순위표를 안 보면(s=0) 곡마다 다운로드 수의 기댓값 = 듣는 사람 × (1/곡 수) × 매력
{
  const P = Object.assign({}, D, { s: 0 }), ap = H.appeal(P), R = 400, rng = H.mulberry32(99), sum = new Float64Array(P.n);
  for (let r = 0; r < R; r++) { const { c } = H.runWorld(P, rng); for (let k = 0; k < P.n; k++) sum[k] += c[k]; }
  let worst = 0; for (let k = 0; k < P.n; k++) { const ex = (P.N * ap[k]) / P.n; worst = Math.max(worst, Math.abs(sum[k] / R - ex) / ex); }
  console.log(`① s=0 기댓값 검사 (세계 ${R}개 평균): 곡별 상대 오차 최대 ${pc(worst, 2)}  · 1번 곡 기대 ${(P.N * ap[0] / P.n).toFixed(0)}회, 2번 곡 ${(P.N * ap[1] / P.n).toFixed(0)}회, 48번 곡 ${(P.N * ap[47] / P.n).toFixed(0)}회`);
  console.log(`   매력(마음에 들어 다운로드할 확률): 1번 ${pc(ap[0])} 2번 ${pc(ap[1])} 3번 ${pc(ap[2])} 10번 ${pc(ap[9])} 24번 ${pc(ap[23])} 48번 ${pc(ap[47])}`);
}

// 2) 기본값 첫 실험(시드 1)의 끝 장면 — 페이지를 열면 처음 보이는 판
for (const seed of [1, 2, 3]) {
  const sim = H.create({ seed }), st = sim.stats(sim.S);
  console.log(`② 기본값 시드 ${seed}: 1번 곡이 1등인 세계 ${st.bestWins}/8 · 서로 다른 1등 곡 ${st.distinct}가지 (실력 순위 ${[...new Set(st.leaders)].sort((a, b) => a - b).map((k) => k + 1).join(',')}) · 1등 몫 ${pc(st.topShare)} · 지니 ${st.gini.toFixed(2)} · 최대 다운로드 ${sim.maxCount}`);
}
{
  const sim = H.create({ seed: 1, s: 0 }), st = sim.stats(sim.S);
  console.log(`   같은 시드, s=0: 1번 곡 1등 ${st.bestWins}/8 · 서로 다른 1등 곡 ${st.distinct}가지 · 1등 몫 ${pc(st.topShare)} · 지니 ${st.gini.toFixed(2)}`);
}

// 3) 남의 선택을 보는 정도별 (세계 800개 집계, 기본 실력 차이·듣는 사람 10,000명)
console.log('③ 남의 선택을 보는 정도별 (세계 800개):');
const big = {};
for (const sv of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
  const r = H.aggregate({ s: sv / 100 }, 800, 5000 + sv); big[sv] = r;
  console.log(`   s=${sv}%: 1번 곡 1등 ${pc(r.bestWin)} · 8개 세계의 서로 다른 1등 곡 ${r.distinct.toFixed(1)}가지 · 1등 곡 실력 순위 평균 ${r.meanLeaderRank.toFixed(1)}위 (가장 낮은 ${r.worstLeaderRank}위) · 1등 몫 ${pc(r.topShare, 1)} · 지니 ${r.gini.toFixed(2)}`);
}
// 페이지 차트 ④와 같은 설정(세계 160개, 시드 101+s)
console.log('   (차트 ④와 같은 160개 집계) ' + [0, 30, 60, 100].map((sv) => { const r = H.aggregate({ s: sv / 100 }, 160, 101 + sv); return `s=${sv}%: 1등 ${pc(r.bestWin)} 몫 ${pc(r.topShare)}`; }).join(' | '));

// 4) 곡끼리 실력 차이 (spread)를 바꾸면
console.log('④ 곡끼리 실력 차이별 (세계 800개):');
for (const sp of [0.3, 0.5, 0.7, 0.8]) for (const sv of [0, 60]) {
  const r = H.aggregate({ s: sv / 100, spread: sp }, 800, 7000 + sv + sp * 100);
  console.log(`   차이 90% vs ${Math.round((0.9 - sp) * 100)}%, s=${sv}%: 1번 곡 1등 ${pc(r.bestWin)} · 서로 다른 1등 ${r.distinct.toFixed(1)}가지 · 1등 실력 순위 평균 ${r.meanLeaderRank.toFixed(1)}위 · 지니 ${r.gini.toFixed(2)}`);
}

// 5) 듣는 사람 수를 바꾸면
console.log('⑤ 듣는 사람 수별 (세계 800개):');
for (const N of [2000, 10000, 20000]) for (const sv of [0, 60]) {
  const r = H.aggregate({ s: sv / 100, N }, 800, 9000 + sv + N / 1000);
  console.log(`   N=${N}, s=${sv}%: 1번 곡 1등 ${pc(r.bestWin)} · 서로 다른 1등 ${r.distinct.toFixed(1)}가지 · 지니 ${r.gini.toFixed(2)}`);
}

// 6) 기록(재생)과 한 번에 돌린 결과가 같은가
{
  const P = Object.assign({}, D, { seed: 4 }), sim = H.create(P);
  const rng = H.mulberry32((((P.seed >>> 0) * 1009 + 1 * 7919) * 2654435761) >>> 0), { c } = H.runWorld(P, rng);
  let diff = 0; const last = sim.counts(sim.S, 0); for (let k = 0; k < P.n; k++) diff += Math.abs(last[k] - c[k]);
  console.log(`⑥ 재생 기록의 마지막 = 직접 돌린 결과: 차이 ${diff}`);
}
