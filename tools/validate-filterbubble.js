// 필터버블 검증.  사용법: node tools/validate-filterbubble.js
// 페이지 문구의 숫자와 app.js의 SWEEP(집계)은 이 출력과 같아야 한다. 모든 판은 끝(200걸음)까지 돌리고 마지막 20걸음을 평균한다.
const F = require('../site/experiments/filterbubble/sim.js');
const D = F.DEFAULTS, SEEDS = [1, 2, 3, 4];
const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10;
function agg(o) {
  const a = { pol: 0, cl: 0, cross: 0, move: 0, one: 0 };
  for (const seed of SEEDS) { const s = F.summary(Object.assign({}, D, o, { seed })); a.pol += s.pol / SEEDS.length; a.cl += s.cl / SEEDS.length; a.cross += s.cross / SEEDS.length; a.move += s.move / SEEDS.length; a.one += s.oneSide ? 1 : 0; }
  return { pol: r0(a.pol), cl: r1(a.cl), cross: r0(a.cross), move: r0(a.move), one: a.one };
}
const row = (name, a) => `    ${String(name).padEnd(16)} 갈라진 정도 ${String(a.pol).padStart(3)} | 덩어리 ${String(a.cl).padStart(3)} | 다른 편 글 ${String(a.cross).padStart(3)}% | 평균 이동 ${String(a.move).padStart(3)} | 한쪽 끝 쏠림 ${a.one}/${SEEDS.length}판`;
console.log('기본값:', JSON.stringify(D), '· 상수', JSON.stringify(F.C));

console.log('\n[1] 기본 설정 첫 판(시드 1) 시간 흐름');
{
  const s = F.create(D); const H = s.hist;
  while (!s.done) s.step();
  for (const t of [0, 1, 5, 10, 20, 30, 50, 100, 200]) console.log(`    ${String(t).padStart(3)}걸음: 갈라진 정도 ${r0(H.pol[t])} · 덩어리 ${H.cl[t]} · 다른 편 글 ${isNaN(H.cross[t]) ? '-' : r0(H.cross[t]) + '%'} · 평균 이동 ${r0(H.move[t])}`);
  console.log('    끝 무리:', s.last.groups.map((g) => `${g.size}명@${r0(g.mean)}`).join(', '));
  const t40 = H.pol.findIndex((v) => v >= 40); console.log('    갈라진 정도가 처음 40을 넘은 걸음:', t40);
}
const SW = { s: {}, div: {}, eps: {} };
console.log('\n[2] 추천이 취향을 따르는 정도별 (집계: 시드 4개 평균)');
for (const s of [0, 10, 20, 30, 50, 75, 100]) { const a = agg({ s: s / 100 }); SW.s[s] = a; console.log(row(`추천 ${s}%`, a)); }
console.log('\n[3] 가끔 반대 글 섞기별 (추천 100%) · 끌리는 폭 40 vs 80');
for (const eps of [40, 80]) for (const d of [0, 10, 30]) { const a = agg({ s: 1, eps: eps / 100, div: d / 100 }); SW.div[eps + '_' + d] = a; console.log(row(`폭 ${eps} 섞기 ${d}%`, a)); }
console.log('\n[4] 쉽게 끌리는 폭별 · 추천 0% vs 50%');
for (const s of [0, 50]) for (const e of [20, 30, 40, 60, 80]) { const a = agg({ s: s / 100, eps: e / 100 }); SW.eps[s + '_' + e] = a; console.log(row(`추천 ${s}% 폭 ${e}`, a)); }
console.log('\n[5] 가정 바꿔 보기');
console.log(row('굳어짐 0, 추천 0%', agg({ s: 0, reinf: 0 })));
console.log(row('굳어짐 0, 추천 50%', agg({ reinf: 0 })));
console.log(row('굳어짐 0, 추천 100%', agg({ s: 1, reinf: 0 })));
console.log(row('굳어짐 50%, 추천 50%', agg({ reinf: 0.5 })));
console.log(row('굳어짐 200%, 추천 0%', agg({ s: 0, reinf: 2 })));
console.log(row('거슬림 50%, 추천 0%', agg({ s: 0, rep: 0.5 })));
console.log(row('거슬림 100%, 추천 0%', agg({ s: 0, rep: 1 })));
console.log(row('거슬림 100%, 추천 50%', agg({ rep: 1 })));
console.log(row('거슬림 100%, 추천 100%', agg({ s: 1, rep: 1 })));
console.log(row('거슬림 100%, 굳어짐 0, 추천 0%', agg({ s: 0, rep: 1, reinf: 0 })));
console.log(row('거슬림 100%, 굳어짐 0, 추천 100%', agg({ s: 1, rep: 1, reinf: 0 })));
console.log('\n[6] 사람 수별 (기본)');
for (const n of [100, 200, 400, 1000]) console.log(row(`${n}명`, agg({ n })));
console.log('\n[7] 점검');
{
  const a = F.summary(D), b = F.summary(D); console.log('    같은 설정 같은 결과:', a.pol === b.pol && a.cross === b.cross);
  const s = F.runToEnd(D); let mn = 9, mx = -9; for (const v of s.x) { mn = Math.min(mn, v); mx = Math.max(mx, v); } console.log('    의견 범위:', mn.toFixed(3), '~', mx.toFixed(3), '(−1 ~ 1 안이어야)');
  const z = F.summary({ ...D, s: 0 }); console.log('    추천 0%: 다른 편 글 비율이 약 절반이어야 →', r0(z.cross) + '%');
}
console.log('\nSWEEP =', JSON.stringify(SW));
