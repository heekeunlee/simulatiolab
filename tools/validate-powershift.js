// 힘이 비슷해질 때 왜 위험할까(세력 전이 장난감 모델) 검증.  사용법: node tools/validate-powershift.js
// 페이지 문구는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const S = require('../site/experiments/powershift/sim.js');
const pc = (v) => (v * 100).toFixed(1) + '%';
const p1 = (v) => (v * 100 < 10 ? (Math.round(v * 1000) / 10).toFixed(1) : String(Math.round(v * 100))) + '%';
const SEEDS = 20;
function mc(o) {
  let wars = 0, n = 0, near = 0, rel = [], rs = [];
  for (let s = 1; s <= SEEDS; s++) { const sm = S.create(Object.assign({ seed: s }, o)).run(), su = S.summarize(sm); wars += su.wars; n += su.n; near += su.near; rel = rel.concat(su.rel); rs = rs.concat(su.rs); }
  return { p: wars / n, wars, n, near: near / Math.max(1, wars), rel, rs };
}
const D = S.DEFAULTS;
console.log(`기본값: 추격 속도 +${D.g}%p, 불만 ${D.d}%, 힘을 잘못 보는 정도 ±${D.u}%, 개편 없음 · 다툼거리 해마다 ${D.mu * 100}% · 전쟁 비용 ${D.cost * 100}% · 이길 가능성 k=${D.k}`);
console.log('\n[1] 힘 비율별 해마다의 위험 (기본값, 계산)');
console.log('    ' + S.curve({}, [0.4, 0.6, 0.8, 1, 1.25, 1.5, 2, 3]).map((x) => `${x.r}: ${p1(x.h)}`).join(' · '));
const w0 = S.warChance({});
console.log(`    봉우리: 해마다 ${p1(w0.peak)} (힘 비율 ${w0.peakR.toFixed(2)}), 평균 경로가 따라잡는 해 ${w0.cross.toFixed(0)}년째`);
{ const r = []; for (let e = Math.log(0.3); e <= Math.log(3.34); e += 0.01) r.push(Math.exp(e)); const pk = S.curve({}, r).reduce((p, x) => (x.h > p.h ? x : p)); console.log(`    촘촘한 곡선(④)의 봉우리: 해마다 ${p1(pk.h)} @ 비율 ${pk.r.toFixed(2)} (평탄한 꼭대기: 비율 1에서 ${p1(S.curve({}, [1])[0].h)})`); }
const a = S.curve({}, [0.4])[0].h, b = w0.peak; console.log(`    봉우리 ÷ 비율 0.4 = ${(b / a).toFixed(0)}배`);

console.log(`\n[2] 100년 안에 충돌할 확률: 계산값(흔들림 없는 평균 경로) 대 시뮬레이션(${SEEDS}판 × 100개 세계)`);
const rows = [['기본값', {}], ['불만 0%', { d: 0 }], ['불만 60%', { d: 60 }], ['불만 100%', { d: 100 }], ['정확히 앎(±0%)', { u: 0 }], ['±0%, 불만 60%', { u: 0, d: 60 }], ['±0%, 불만 70%', { u: 0, d: 70 }], ['±0%, 불만 100%', { u: 0, d: 100 }], ['±10%', { u: 10 }], ['±50%', { u: 50 }],
  ['따라잡은 뒤 개편', { reform: 'late' }], ['미리 개편', { reform: 'early' }], ['미리 개편 + ±10%', { reform: 'early', u: 10 }], ['추격 +0.5%p', { g: 0.5 }], ['추격 +1%p', { g: 1 }], ['추격 +3%p', { g: 3 }], ['추격 +4%p', { g: 4 }]];
let maxGap = 0;
rows.forEach(([n, o]) => { const w = S.warChance(o), m = mc(o); maxGap = Math.max(maxGap, Math.abs(w.p - m.p)); console.log(`    ${n.padEnd(14)} 계산 ${pc(w.p).padStart(6)} · 시뮬 ${pc(m.p).padStart(6)} (${m.wars}/${m.n}) · 봉우리 해마다 ${p1(w.peak)} @ 비율 ${w.peakR.toFixed(2)}`); });
console.log(`    계산과 시뮬레이션의 최대 차이 ${(maxGap * 100).toFixed(1)}%p (시뮬은 성장 흔들림이 있어 조금 다를 수 있음)`);

console.log('\n[3] 충돌은 언제 일어났나 (기본값, 시뮬레이션)');
{
  const m = mc({}), rel = m.rel, rs = m.rs;
  const inR = (lo, hi) => rs.filter((r) => r >= lo && r < hi).length / rs.length;
  console.log(`    충돌 ${m.wars}건 중 힘 비율 0.75~1.35(힘이 비슷한 구간): ${pc(inR(0.75, 1.35))} · 0.6 미만: ${pc(inR(0, 0.6))} · 2 이상: ${pc(inR(2, 99))}`);
  const relN = rel.length, w15 = rel.filter((x) => Math.abs(x) <= 15).length;
  console.log(`    100년 안에 따라잡은 세계의 충돌 ${relN}건 중 따라잡은 해(힘 비율 1) ±15년 안: ${pc(w15 / Math.max(1, relN))} (충돌 뒤에도 힘은 계속 자란다고 보고 잰 교차 시점)`);
  // 첫 판(시드 1)
  const s1 = S.summarize(S.create({ seed: 1 }).run()); console.log(`    세계 #1(시드 1): 충돌 ${s1.wars}/100곳, 힘이 비슷한 구간 ${s1.near}곳`);
}
console.log('\n[4] 건전성: 다툼이 전쟁이 될 확률(격자 적분) 대 직접 뽑기 20만 번');
{
  const r = S.mulberry32(5), P = S.norm({}); let worst = 0;
  const g = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  for (const ratio of [0.6, 1, 1.5]) {
    const lr = Math.log(ratio), q = S.pFail(lr, P.dd, P.ss, P); let k = 0; const N = 200000;
    for (let i = 0; i < N; i++) { const wC = S.W(lr + g() * P.ss, P.k), wD = S.W(lr + g() * P.ss, P.k); if (Math.min(1, wC * (1 + P.dd)) - wD > 2 * P.cost) k++; }
    worst = Math.max(worst, Math.abs(q - k / N)); console.log(`    비율 ${ratio}: 적분 ${pc(q)} · 뽑기 ${pc(k / N)}`);
  }
  console.log(`    최대 차이 ${(worst * 100).toFixed(2)}%p`);
  console.log(`    정확히 알 때(±0%) 전쟁이 시작되는 불만 문턱: 불만/(1+불만) > 2×비용 → ${((2 * P.cost) / (1 - 2 * P.cost) * 100).toFixed(1)}%`);
}
