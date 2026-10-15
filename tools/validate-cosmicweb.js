// 우주 거미줄(입자-격자 중력 장난감 모델) 검증.  사용법: node tools/validate-cosmicweb.js
// 페이지 문구와 app.js의 집계 그래프(SWEEP)는 이 출력과 같아야 한다. 모든 판은 시드 고정이라 다시 돌려도 같다.
const fs = require('fs'), path = require('path');
const M = require('../site/experiments/cosmicweb/sim.js');
const D = M.DEFAULTS, C = M.C, SEEDS = [1, 2, 3];
const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const REVEAL = 0.1;   // "거미줄이 드러난 때": 빈 공간이 10%를 넘은 첫 기록 시점
function runOne(o) {
  const s = M.create(Object.assign({}, D, o)); let reveal = null;
  const chk = () => { if (reveal == null && s.last.void >= REVEAL) reveal = s.t * C.DT; };
  chk(); while (s.step()) if (s.t % C.SAMPLE === 0) chk();
  return { s, reveal };
}
function agg(o) {
  const rows = SEEDS.map((seed) => runOne(Object.assign({ seed }, o)));
  const mean = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  const rv = rows.map((r) => r.reveal);
  return { void: r0(mean((r) => r.s.last.void * 100)), big: r0(mean((r) => r.s.last.big * 100)), clumps: r0(mean((r) => r.s.last.clumps)),
           reveal: rv.every((v) => v != null) ? r1(rv.reduce((a, b) => a + b, 0) / rv.length) : null, revealN: rv.filter((v) => v != null).length };
}
const line = (name, a) => console.log(`    ${name.padEnd(12)} 빈 공간 ${String(a.void).padStart(3)}% | 가장 큰 덩어리 ${String(a.big).padStart(3)}% | 덩어리 ${String(a.clumps).padStart(3)}개 | 거미줄이 드러난 때 ${a.reveal == null ? `(${a.revealN}/${SEEDS.length}판만)` : 't = ' + a.reveal}`);
console.log('기본값:', JSON.stringify(D), `· 상자 ${C.NG}³칸, 알갱이 ${C.NG ** 3}개, dt ${C.DT}, 끝 시간 ${D.steps * C.DT}`);
console.log(`지표: 빈 공간 = 2×2×2칸 덩이 밀도 < 평균의 ${C.VOID}배인 비율 · 덩어리 = 평균의 ${C.DENSE}배 넘는 칸이 이어진 무리(알갱이 ${C.MINC}개 이상) · 집계 = 시드 ${SEEDS.length}개 평균`);

// [0] 이론 확인: 상자 길이 파장 하나짜리 작은 물결이 자라는 빠르기 vs 선형 이론 s = (−H + √(H² + 4G))/2, 그리고 H = 0일 때 에너지
console.log('\n[0] 작은 물결 하나(요철 0.5%, 100걸음)의 자라는 빠르기: 이론 vs 시뮬레이션');
const GROW = {};
for (const ex of [0, 100, 200]) {
  const s = M.create({ wave: true, amp: 0.5, expand: ex, steps: 100 }); const a = s.last.rms; const e0 = s.energy(); let maxErr = 0;
  while (s.step()) { if (ex === 0) { const e = s.energy(); maxErr = Math.max(maxErr, Math.abs(e.E - e0.E) / e.K); } }
  const meas = Math.log(s.last.rms / a) / (s.t * C.DT); GROW[ex] = { th: Math.round(s.sLin * 1000) / 1000, sim: Math.round(meas * 1000) / 1000 };
  const mom = Math.max(...s.momentum().map(Math.abs));
  console.log(`    팽창 ${String(ex).padStart(3)}%: 이론 ${GROW[ex].th.toFixed(3)} · 시뮬레이션 ${GROW[ex].sim.toFixed(3)} (차이 ${r1((meas / s.sLin - 1) * 100)}%) · 평균 속도 ${mom.toExponential(1)}` + (ex === 0 ? ` · 에너지 오차 최대 ${r2(maxErr * 100)}% (운동 에너지 대비)` : ''));
}

// [1] 기본 판(시드 1)의 시간 흐름
{ const { s, reveal } = runOne({ seed: 1 }); const H = s.hist, want = [0, 100, 150, 180, 200, 220, 240];
  console.log('\n[1] 기본 판(시드 1) 시간 흐름: 걸음(시간) → 울퉁불퉁한 정도(밀도 표준편차) / 빈 공간 / 가장 큰 덩어리 / 덩어리 수');
  console.log('    ' + want.map((t) => { const k = H.t.indexOf(t); return `${t}(${r1(t * C.DT)}): ${r2(H.rms[k])} / ${r0(H.void[k] * 100)}% / ${r0(H.big[k] * 100)}% / ${H.clumps[k]}`; }).join('\n    '));
  console.log(`    처음 울퉁불퉁 ${r2(H.rms[0] * 100)}% → 끝 ${r1(H.rms[H.rms.length - 1])} (${r0(H.rms[H.rms.length - 1] / H.rms[0])}배) · 거미줄이 드러난 때 t = ${reveal}`);
  const h = s.densityHist(4, -1, 1), lo = s.densityHist(1, -3, Math.log10(C.VOID));
  let below1 = 0; { const hh = s.densityHist(40, -3, 3); for (let k = 0; k < 20; k++) below1 += hh[k]; }
  console.log(`    끝: 평균보다 성긴 덩이 ${r0(below1 * 100)}%`); }

const SWEEP = { amp: {}, grain: {}, expand: {}, grow: GROW };
console.log('\n[2] 처음 요철 크기별 (끝 시간 ' + D.steps * C.DT + ')');
for (const amp of [0.5, 1, 2, 4]) { SWEEP.amp[amp] = agg({ amp }); line(`요철 ${amp}%`, SWEEP.amp[amp]); }
console.log('\n[3] 요철의 결별');
for (const grain of ['big', 'mix', 'small']) { SWEEP.grain[grain] = agg({ grain }); line(grain, SWEEP.grain[grain]); }
console.log('\n[4] 팽창 속도별');
for (const expand of [0, 50, 100, 150, 200]) { SWEEP.expand[expand] = agg({ expand }); line(`팽창 ${expand}%`, SWEEP.expand[expand]); }

const app = fs.readFileSync(path.join(__dirname, '..', 'site', 'experiments', 'cosmicweb', 'app.js'), 'utf8');
const m = app.match(/const SWEEP = (\{.*?\});/);
const now = JSON.stringify(SWEEP);
console.log('\nSWEEP = ' + now);
console.log(m && m[1] === now ? '\n✓ app.js의 SWEEP과 일치' : '\n✗ app.js의 SWEEP과 다름: 위 SWEEP 줄로 바꿀 것');
