// 제재의 역설 검증.  사용법: node tools/validate-sanctions.js
const S = require('../site/experiments/sanctions/sim.js');
const pc = (v) => Math.round(v * 100) + '%';
const D = S.DEFAULTS, RUNS = 100;
console.log('기본값: 나라', D.n, '· 참여율', pc(D.p), '· 새는 정도', pc(D.leak), '· 결집 효과', pc(D.rally), '· 피해가 지지를 깎는 정도', pc(D.hard), '· 제재 기간', D.months, '달 · 문턱 결속', D.thresh);

// 1. 기본 설정 시드 1
{
  const s = S.create({ seed: 1 }).run();
  console.log('\n[1] 기본 시드 1: 참여국', s.part.filter(Boolean).length, '개 · 끊긴 무역', pc(s.lost), '· 끝 달 새는 비율', pc(s.leakRate[s.T]), '· 끝 달 피해', pc(s.D[s.T]), '· 평균 피해', pc(s.avg(s.D)));
  console.log('    결속: 시작 50 → 첫 6달 평균', s.earlyC().toFixed(0), '· 최고', s.peakC().toFixed(0), '→ 최저', s.minC.toFixed(0), '→ 끝', s.C[s.T].toFixed(0), '· 30 아래로 내려간 달', s.hit < 0 ? '없음' : s.hit - s.params.start);
  console.log('    C', s.C.map((v) => Math.round(v)).join(' '));
}

// 2. 참여율별 100판
console.log('\n[2] 참여율별 100판 (기본 새는 정도 50%): 압력이 통한 판 | 평균 피해 | 새는 비율 | 참여국 손해 | 손해 대비 피해 | 첫 6달 결속 평균 | 끝 결속 평균 | 통한 달(중앙값)');
const med = (a) => { if (!a.length) return '-'; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
for (let p = 0; p <= 10; p++) {
  const o = S.sweep(Object.assign({}, D, { p: p / 10, seed: 1 }), RUNS);
  console.log(`    참여 ${pc(p / 10).padStart(4)}  통함 ${pc(o.success).padStart(4)} | 피해 ${pc(o.damage).padStart(4)} | 샘 ${pc(o.leak).padStart(4)} | 참여국 손해 ${pc(o.partLoss).padStart(4)} | 효율 ${pc(o.ratio).padStart(4)} | 첫6달 ${o.peak.toFixed(0)} | 끝 ${o.endC.toFixed(0)} | ${med(o.hitAt)}달`);
}

// 3. 새는 정도별 문턱
console.log('\n[3] 새는 정도별 참여율 문턱 (압력이 통한 판이 절반 이상이 되는 가장 낮은 참여율, 100판)');
for (const lk of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1]) console.log('    새는 정도', pc(lk).padStart(4), '→ 문턱', (t => t == null ? '없음' : pc(t))(S.threshold(Object.assign({}, D, { leak: lk, seed: 1 }), RUNS)));

// 4. 결집 효과·피해 민감도
console.log('\n[4] 결집 효과별 (참여 80%): 첫 6달 결속 평균 · 통한 판 · 통한 달 중앙값');
for (const pp of [0.6, 0.8]) for (const r of [0, 0.5, 1]) { const o = S.sweep(Object.assign({}, D, { p: pp, rally: r, seed: 1 }), RUNS); console.log('    참여', pc(pp), '결집', pc(r), '→ 첫 6달', o.peak.toFixed(0), '· 통함', pc(o.success), '·', med(o.hitAt), '달'); }
console.log('    피해가 지지를 깎는 정도별 (참여 80%)');
for (const h of [0.2, 0.5, 1]) { const o = S.sweep(Object.assign({}, D, { p: 0.8, hard: h, seed: 1 }), RUNS); console.log('    깎는 정도', pc(h), '→ 통함', pc(o.success), '· 끝 결속', o.endC.toFixed(0)); }
// 5. 건전성: 참여 0%면 피해 0, 새는 정도 0이면 새는 비율 0
{ const a = S.sweep(Object.assign({}, D, { p: 0, seed: 1 }), 20), b = S.sweep(Object.assign({}, D, { p: 0.5, leak: 0, seed: 1 }), 20);
  console.log('\n[5] 건전성: 참여 0% 피해', pc(a.damage), '· 새는 정도 0% 새는 비율', pc(b.leak), '· 같은 시드 같은 결과', S.create({ seed: 3 }).run().C[30] === S.create({ seed: 3 }).run().C[30]); }
