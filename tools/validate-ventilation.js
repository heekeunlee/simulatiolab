// 환기(문과 창문 배치) 검증.  사용법: node tools/validate-ventilation.js
// 페이지 문구의 숫자는 이 출력과 같아야 한다. 모든 판은 끝(시간 60 = 6,000걸음)까지 돌린다.
const V = require('../site/experiments/ventilation/sim.js');
const D = V.DEFAULTS, pc = (v) => Math.round(v * 100) + '%', ht = (v) => (v == null ? '안 됨(60 안에)' : v < 10 ? v.toFixed(1) : String(Math.round(v)));
const LAY = [['one', '창 1개', { count: 1 }], ['same', '같은 벽 2개', { count: 2, layout: 'same' }], ['adjacent', '옆 벽 2개', { count: 2, layout: 'adjacent' }], ['opposite', '마주 보는 벽 2개', { count: 2, layout: 'opposite' }]];
const WN = ['아주 약하게', '약하게', '보통', '세게', '아주 세게'], DN = { front: '정면', diag: '비스듬히', side: '옆' };
const row = (name, s) => `    ${name.padEnd(12)} 절반까지 ${ht(s.half).padStart(4)} | 끝에 아직 탁한 곳 ${pc(s.stale).padStart(4)} | 끝 평균 ${s.mean.toFixed(0).padStart(3)} | 사람 자리 ${s.person.toFixed(0).padStart(3)} | 들어오는 흐름 ${s.inflow.toFixed(2)}`;
console.log('기본값:', JSON.stringify(D), '· 격자', V.W + '×' + V.H, '· 한 판', V.STEPS, '걸음 = 시간', V.STEPS / V.UNIT);

console.log('\n[1] 바람 압력 규칙 (벽이 바람을 마주 보는 정도: +1 정면, 0 나란함, −1 등짐)');
for (const d of ['front', 'diag', 'side']) console.log(`    바람 ${DN[d]}: ` + ['L', 'R', 'T', 'B'].map((w) => `${w} ${V.facing(w, V.windVec(d)).toFixed(2)}`).join(' · '));

const base = {}; 
console.log('\n[2] 배치별 (기본: 정면 바람 · 보통 · 틈 6칸 · 방 한가운데 사람)');
LAY.forEach(([id, n, o]) => { const s = V.summary(Object.assign({}, D, o)); base[id] = s; console.log(row(n, s)); });

console.log('\n[3] 바람 세기별 절반까지 걸린 시간 (정면 바람)');
LAY.forEach(([id, n, o]) => console.log(`    ${n.padEnd(12)} ` + [1, 2, 3, 4, 5].map((k) => { const s = V.summary(Object.assign({}, D, o, { wind: k })); return `${k}:${ht(s.half)}/${pc(s.stale)}`; }).join('  ')));

console.log('\n[4] 바람 방향별 (보통 바람): 절반까지 / 끝에 아직 탁한 곳');
LAY.forEach(([id, n, o]) => console.log(`    ${n.padEnd(12)} ` + ['front', 'diag', 'side'].map((d) => { const s = V.summary(Object.assign({}, D, o, { dir: d })); return `${DN[d]} ${ht(s.half)}/${pc(s.stale)}`; }).join('  ')));

console.log('\n[5] 방을 나누는 벽 (마주 보는 벽 2개, 정면)');
for (const door of ['none', 'open', 'closed']) console.log(row({ none: '벽 없음', open: '방문 열림', closed: '방문 닫힘' }[door], V.summary(Object.assign({}, D, { door }))));

console.log('\n[6] 사람 자리: 한가운데 vs 구석 (첫 판 = 오른쪽 아래 구석)');
for (const [id, n, o] of LAY.slice(2)) for (const src of ['center', 'corner']) console.log(row(`${n} ${src === 'center' ? '가운데' : '구석'}`, V.summary(Object.assign({}, D, o, { src }))));

console.log('\n[7] 틈 크기 (마주 보는 벽 2개, 정면)');
for (const g of [2, 4, 6, 9, 12]) console.log(row(`틈 ${g}칸`, V.summary(Object.assign({}, D, { gap: g }))));

console.log('\n[8] 창 3개 (정면)');
for (const lay of ['same', 'adjacent', 'opposite']) console.log(row(`${lay} 3개`, V.summary(Object.assign({}, D, { count: 3, layout: lay }))));

console.log('\n[9] 점검');
{
  let worst = 0; for (const [, , o] of LAY) for (const d of ['front', 'diag', 'side']) { const s = V.create(Object.assign({}, D, o, { dir: d })); worst = Math.max(worst, s.divMax); }
  console.log('    방 안 칸마다 흐름 합(비압축이면 0)의 최댓값:', worst.toExponential(2));
  const s = V.create(D); let mn = 1e9; s.run(); for (let i = 0; i < s.C.length; i++) if (s.type[i] === 1) mn = Math.min(mn, s.C[i]);
  console.log('    끝에서 방 안 최솟값(음수가 아니어야):', mn.toFixed(3), '· 같은 설정 같은 결과:', V.summary(D).mean === V.summary(D).mean);
}

console.log('\n[10] 일반 지식과 같은 방향인가: "맞통풍(마주 보는 벽)이 같은 벽 단측 환기보다 환기량이 크다고 알려져 있다"');
{
  const op = base.opposite, sa = base.same, on = base.one;
  console.log(`    정면 바람: 마주 보는 벽 절반 ${ht(op.half)}, 같은 벽 ${ht(sa.half)}, 창 1개 ${ht(on.half)} · 들어오는 흐름 ${op.inflow.toFixed(2)} vs ${sa.inflow.toFixed(2)} vs ${on.inflow.toFixed(2)}`);
  const ok = op.inflow > sa.inflow && (sa.half == null || (op.half != null && op.half < sa.half));
  console.log('    → ' + (ok ? '같은 방향 (이 모델에서도 마주 보는 벽이 더 빨리, 더 구석구석 바뀜)' : '다른 방향! 보고할 것'));
  const side = V.summary(Object.assign({}, D, { dir: 'side' }));
  console.log(`    단, 바람이 옆(두 창의 벽과 나란히)에서 오면 마주 보는 벽도 흐름 ${side.inflow.toFixed(2)}, 절반 ${ht(side.half)} (이 모델의 압력 규칙 때문)`);
}
