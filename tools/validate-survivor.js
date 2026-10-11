// 생존자 편향 모델 검증.  사용법: node tools/validate-survivor.js
const S = require('../site/experiments/survivor/sim.js');
const nm = (a) => a.map((i) => S.NAMES[i]).join('+') || '-';
const pc = (v) => (v * 100).toFixed(1) + '%';
console.log('부위 넓이 비율:', S.NAMES.map((n, i) => n + ' ' + (S.AREA[i] * 100).toFixed(1) + '%').join(' · '));
console.log('치명률(총탄 1발):', S.NAMES.map((n, i) => n + ' ' + (S.lethality(0.5)[i] * 100).toFixed(0) + '%').join(' · '));

// 1) 기본값(엔진 50%, 출격 2000, 보강 2곳), 여러 시드 평균
function avg(opts, seeds) {
  const acc = { none: 0, intuitive: 0, wald: 0, best: 0, th: { none: 0, intuitive: 0, wald: 0, best: 0 }, ret: 0 }; const vis = [0, 0, 0, 0, 0], pickI = {}, pickW = {};
  seeds.forEach((sd) => {
    const r = S.study(Object.assign({ seed: sd }, opts));
    ['none', 'intuitive', 'wald', 'best'].forEach((k) => { acc[k] += r[k] / seeds.length; acc.th[k] += r.theory[k] / seeds.length; });
    acc.ret += r.returnedShare / seeds.length; r.visible.forEach((v, i) => { vis[i] += v / seeds.length; });
    pickI[nm(r.picks.intuitive)] = (pickI[nm(r.picks.intuitive)] || 0) + 1; pickW[nm(r.picks.wald)] = (pickW[nm(r.picks.wald)] || 0) + 1;
  });
  return { acc, vis, pickI, pickW };
}
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
for (const [label, opts] of [['기본값 (엔진 50%, 2000회, 2곳)', {}], ['큰 표본 (20000회)', { n: 20000 }]]) {
  const sd = label.startsWith('큰') ? seeds.slice(0, 20) : seeds;
  const { acc, vis, pickI, pickW } = avg(opts, sd);
  console.log('\n[' + label + '] 시드 ' + sd.length + '개 평균');
  console.log('  돌아온 비율(= 무장갑 생존율) ' + pc(acc.ret));
  console.log('  생존율 시뮬레이션  무장갑 ' + pc(acc.none) + ' | 구멍 많은 곳 ' + pc(acc.intuitive) + ' | 빈 곳(월드) ' + pc(acc.wald) + ' | 최선 ' + pc(acc.best));
  console.log('  생존율 이론값      무장갑 ' + pc(acc.th.none) + ' | 구멍 많은 곳 ' + pc(acc.th.intuitive) + ' | 빈 곳(월드) ' + pc(acc.th.wald) + ' | 최선 ' + pc(acc.th.best));
  console.log('  맞은 총탄 중 돌아온 비행기에서 보이는 비율:', S.NAMES.map((n, i) => n + ' ' + pc(vis[i])).join(' · '));
  console.log('  직관 선택 분포:', JSON.stringify(pickI), ' 월드 선택 분포:', JSON.stringify(pickW));
}

// 2) 애니메이션 시드 1 (화면 기본 상태)
const s1 = S.create({ seed: 1 }); s1.run(); const pk = s1.picks(2);
console.log('\n[화면 기본 상태 seed 1] 돌아온 ' + s1.returned + '/' + s1.params.n + ' 구멍(돌아온 비행기):', S.NAMES.map((n, i) => n + ' ' + s1.holesRet[i]).join(' · '), ' 전체 맞은 수:', S.NAMES.map((n, i) => n + ' ' + s1.holesAll[i]).join(' · '));
console.log('  직관 선택', nm(pk.intuitive), pc(s1.survival(pk.intuitive)), '| 월드 선택', nm(pk.wald), pc(s1.survival(pk.wald)), '| 최선', nm(pk.best), '| 무장갑', pc(s1.survival([])));
console.log('  엔진+조종석: ', pc(s1.survival([0, 1])), ' 동체+날개: ', pc(s1.survival([2, 3])));

// 3) 슬라이더별 (시드 평균)
console.log('\n엔진 치명률별 (2000회, 2곳, 시드 100개 평균):  치명률 → 무장갑 / 직관 / 월드 / 최선 (이론 최선)');
for (const e of [0, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9]) { const { acc } = avg({ eng: e }, seeds.slice(0, 100)); console.log('  ' + (e * 100).toFixed(0).padStart(3) + '%  ' + [acc.none, acc.intuitive, acc.wald, acc.best].map(pc).join(' / ') + '  (' + pc(acc.th.best) + ')'); }
console.log('\n보강 곳수별 (엔진 50%):  곳수 → 무장갑 / 직관 / 월드 / 최선');
for (const b of [1, 2, 3]) { const { acc, pickW } = avg({ budget: b }, seeds.slice(0, 100)); console.log('  ' + b + '곳  ' + [acc.none, acc.intuitive, acc.wald, acc.best].map(pc).join(' / ') + '  월드 선택 ' + JSON.stringify(pickW)); }
console.log('\n출격 횟수별 (엔진 50%, 2곳): 횟수 → 월드가 최선을 고른 비율 / 직관이 최선을 고른 비율 (시드 200개)');
for (const n of [100, 300, 500, 1000, 2000, 5000]) {
  let w = 0, it = 0; seeds.forEach((sd) => { const s = S.create({ n, seed: sd }); const k = s.picks(2); if (k.wald.join() === k.best.join()) w++; if (k.intuitive.join() === k.best.join()) it++; });
  console.log('  ' + String(n).padStart(4) + '회  ' + (w / seeds.length * 100).toFixed(0) + '% / ' + (it / seeds.length * 100).toFixed(0) + '%');
}
