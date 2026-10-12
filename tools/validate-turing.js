// 그레이-스콧 모델 검증.  사용법: node tools/validate-turing.js
const T = require('../site/experiments/turing/sim.js');
console.log('프리셋별 반복 횟수에 따른 통계 (v 평균 / 대비(표준편차) / v>0.2 면적 / 유한 여부), 시드 1~3');
for (const [name, pr] of Object.entries(T.PRESETS)) {
  for (const seed of [1, 2, 3]) {
    const s = T.create({ F: pr.F, k: pr.k, seed }), row = [];
    for (const target of [2000, 6000, 12000, 20000]) { s.advance(target - s.iter); const q = s.stats(); row.push(`${target}: ${q.vMean.toFixed(3)}/${q.contrast.toFixed(3)}/${(q.area * 100).toFixed(0)}%${q.finite ? '' : ' !유한X'}`); }
    console.log(`${name.padEnd(8)} seed${seed}  ${row.join('  |  ')}`);
  }
}

// 무늬 덩어리(v>0.2 인 연결된 칸) 개수와 평균 크기: 점은 작은 덩어리가 많고, 줄무늬/산호는 큰 덩어리가 몇 개뿐이다
function blobs(sim) {
  const S = sim.size, v = sim.v, seen = new Uint8Array(S * S); let count = 0, total = 0, biggest = 0;
  for (let i0 = 0; i0 < S * S; i0++) {
    if (seen[i0] || v[i0] <= 0.2) continue;
    count++; let size = 0; const st = [i0]; seen[i0] = 1;
    while (st.length) { const i = st.pop(); size++; const x = i % S, y = (i - x) / S;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = ((y + dy + S) % S) * S + (x + dx + S) % S; if (!seen[j] && v[j] > 0.2) { seen[j] = 1; st.push(j); } } }
    total += size; biggest = Math.max(biggest, size);
  }
  return { count, mean: count ? total / count : 0, biggest };
}
console.log('\n20000회 뒤 덩어리 (개수 / 평균 칸 수 / 가장 큰 덩어리 칸 수), 시드 1~3');
for (const [name, pr] of Object.entries(T.PRESETS)) {
  const row = [1, 2, 3].map((seed) => { const s = T.create({ F: pr.F, k: pr.k, seed }); s.advance(20000); const b = blobs(s); return `${b.count}/${b.mean.toFixed(0)}/${b.biggest}`; });
  console.log(`  ${name.padEnd(8)} ${row.join('   ')}`);
}

// 3D 보기 문구 확인: 자리 잡은 뒤 무늬 꼭대기(주변 8칸보다 높은 v>0.2 칸)의 높이 범위
function peaks(sim) {
  const S = sim.size, v = sim.v, pk = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = v[y * S + x]; if (c <= 0.2) continue; let top = true;
    for (let dy = -1; dy <= 1 && top; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && v[((y + dy + S) % S) * S + (x + dx + S) % S] > c) { top = false; break; }
    if (top) pk.push(c);
  }
  pk.sort((a, b) => a - b); return pk;
}
console.log('\n20000회 뒤 꼭대기 높이 v (개수 / 최소 / 중앙값 / 최대), 시드 1~3');
for (const [name, pr] of Object.entries(T.PRESETS)) {
  const row = [1, 2, 3].map((seed) => { const s = T.create({ F: pr.F, k: pr.k, seed }); s.advance(20000); const p = peaks(s); return `${p.length}/${p[0].toFixed(3)}/${p[p.length >> 1].toFixed(3)}/${p[p.length - 1].toFixed(3)}`; });
  console.log(`  ${name.padEnd(8)} ${row.join('   ')}`);
}
