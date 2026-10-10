// 추가 실험 검증.  사용법: node tools/validate-more.js [peter|youtube|traffic|dating|bar|queue|vote]
const which = process.argv[2];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const run = { };

run.peter = () => {
  const P = require('../site/experiments/peter/sim.js');
  console.log('조직 효율(0~10), 60년 뒤, 30회 평균 — 처음 효율은 약 7.0');
  console.log('승진 방식      상식(연속성100%)  절반(50%)  피터(0%)');
  for (const [k, name] of [['best', '최고 능력자'], ['worst', '최저 능력자'], ['random', '무작위    '], ['alt', '번갈아    ']]) {
    const f = (c) => mean(P.finalEfficiency({ strategy: k, continuity: c }, 30)).toFixed(2);
    console.log(`${name}     ${f(1)}           ${f(0.5)}      ${f(0)}`);
  }
};

run.youtube = () => {
  const Y = require('../site/experiments/youtube/sim.js');
  console.log('인기 추천 비율별 (평행우주 12개 평균): 품질-구독자 상관 / 상위 10% 몫 / 1위 채널의 품질 순위(중앙값)');
  for (const s of [0, 0.3, 0.5, 0.7, 0.9, 1]) {
    const w = Y.worlds({ social: s }, 12);
    const med = w.map((x) => x.topQualityRank).sort((a, b) => a - b)[6];
    console.log(`  social ${(s * 100).toFixed(0).padStart(3)}%  상관 ${mean(w.map((x) => x.corr)).toFixed(2)}  상위10% 몫 ${(mean(w.map((x) => x.top10Share)) * 100).toFixed(0)}%  1위의 품질 순위 ${med}위`);
  }
};

run.traffic = () => {
  const T = require('../site/experiments/traffic/sim.js');
  console.log('밀도별 평균 속도(칸/단계)와 정체(정지 차량 비율): 무작위 감속 p=0 vs p=25%');
  for (const d of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.6]) {
    const a = T.measure({ density: d, p: 0 }, 300, 300, 2), b = T.measure({ density: d, p: 0.25 }, 300, 300, 2);
    console.log(`  밀도 ${(d * 100).toFixed(0).padStart(2)}%  p=0: 속도 ${a.avg.toFixed(2)} 정체 ${(a.jam * 100).toFixed(0)}%  |  p=25%: 속도 ${b.avg.toFixed(2)} 정체 ${(b.jam * 100).toFixed(0)}% 교통량 ${b.flow.toFixed(0)}대/시`);
  }
};

run.dating = () => {
  const D = require('../site/experiments/dating/sim.js');
  console.log('눈높이(eye)별, 기준 하향 1%/라운드, 100라운드 뒤 (8회 평균): 짝 찾은 비율 / 평균 걸린 라운드 / 커플 매력 차이');
  for (const e of [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]) {
    const r = D.measure({ eye: e, drift: 0.01 }, 8);
    console.log(`  eye ${(e >= 0 ? '+' : '') + e.toFixed(1)}  짝 ${(mean(r.map((x) => x.matched)) * 100).toFixed(0).padStart(3)}%  대기 ${mean(r.map((x) => x.meanWait)).toFixed(1).padStart(5)}  차이 ${mean(r.map((x) => x.meanDiff)).toFixed(2)}`);
  }
  console.log('기준 하향 속도별 (eye +0.1)');
  for (const d of [0, 0.005, 0.01, 0.02]) { const r = D.measure({ eye: 0.1, drift: d }, 8); console.log(`  drift ${(d * 100).toFixed(1)}%  짝 ${(mean(r.map((x) => x.matched)) * 100).toFixed(0)}%`); }
};

run.bar = () => {
  const B = require('../site/experiments/bar/sim.js');
  console.log('정원 60명, 사람 100명, 200주 (뒤쪽 100주 기준, 6회 평균): 평균 손님 / 표준편차 / 후회한 사람 비율');
  const show = (name, o) => { const r = B.measure(o, 6); console.log(`  ${name.padEnd(12)} 평균 ${mean(r.map((x) => x.mean)).toFixed(1)}  표준편차 ${mean(r.map((x) => x.std)).toFixed(1)}  후회 ${(mean(r.map((x) => x.regret)) * 100).toFixed(0)}%`); };
  show('모두 같은 예측', { mode: 'same' });
  for (const k of [1, 2, 3, 5, 8, 12]) show(`전략 ${k}개`, { strategies: k });
  console.log('정원 변화 (전략 5개)'); for (const c of [30, 50, 70, 90]) show(`정원 ${c}`, { cap: c });
};

run.queue = () => {
  const Q = require('../site/experiments/queue/sim.js');
  const f = (o) => { const r = Q.final(o, 5); return `질서 ${(mean(r.map((x) => x[0])) * 100).toFixed(0)}% 새치기 ${(mean(r.map((x) => x[1])) * 100).toFixed(0)}% 눈총 ${(mean(r.map((x) => x[2])) * 100).toFixed(0)}%`; };
  console.log('150라운드 뒤 (5회 평균)  기본: 이득 0.5, 눈총 효과 1.0, 눈총 비용 0.2, 처음 새치기 20%, 눈총형 20%');
  console.log('  기본                ', f({}));
  console.log('  눈총형 없음          ', f({ punishers: 0 }));
  for (const pu of [0, 0.3, 0.6, 1, 1.5]) console.log(`  눈총 효과 ${pu}        `, f({ punish: pu }));
  for (const gn of [0.2, 0.5, 1, 1.5]) console.log(`  이득 ${gn} (눈총형 없음) `, f({ gain: gn, punishers: 0 }), ' | (있음) ', f({ gain: gn }));
  for (const c of [0.05, 0.2, 0.5, 0.8]) console.log(`  눈총 비용 ${c}        `, f({ cost: c }));
};

run.vote = () => {
  const V = require('../site/experiments/voting/sim.js');
  console.log('후보 수별 (양극화 0.6, 300번 선거): 콩도르세 승자가 있는 비율 / 각 방식이 그 승자를 뽑은 비율 / 단순다수와 선호투표가 다른 비율');
  for (const k of [2, 3, 4, 5, 6]) {
    const r = V.study({ k }, 300), h = (x) => (r.hit[x] / Math.max(1, r.withCondorcet) * 100).toFixed(0).padStart(3) + '%';
    console.log(`  후보 ${k}명  승자 있음 ${(r.withCondorcet / r.n * 100).toFixed(0)}%  다수 ${h('plurality')} 결선 ${h('runoff')} 선호 ${h('irv')} 보르다 ${h('borda')}  다수≠선호 ${(r.pluralityNeIrv / r.n * 100).toFixed(0)}%`);
  }
  console.log('양극화별 (후보 4명)');
  for (const q of [0, 0.4, 0.8, 1]) { const r = V.study({ k: 4, polar: q }, 300), h = (x) => (r.hit[x] / Math.max(1, r.withCondorcet) * 100).toFixed(0) + '%'; console.log(`  양극화 ${q}  승자 있음 ${(r.withCondorcet / r.n * 100).toFixed(0)}%  다수 ${h('plurality')} 결선 ${h('runoff')} 선호 ${h('irv')} 보르다 ${h('borda')}`); }
};

if (!run[which]) { console.log('사용법: node tools/validate-more.js', Object.keys(run).join('|')); process.exit(0); }
run[which]();
