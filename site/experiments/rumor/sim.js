/*
 * 단톡방 소문 확산 모델  (이웃 기반 SIR 계열 + 정정 정보)
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 구조
 *  - 사람 n명이 단톡방 rooms개 중 perPerson개에 들어 있다. 방마다 인기가 달라 큰 방과 작은 방이 생긴다
 *  - 소문 상태: 0 모름 / 1 퍼뜨리는 중 / 2 알지만 더는 안 퍼뜨림
 *  - 정정 상태: 0 못 봄 / 1 정정을 퍼뜨리는 중 / 2 정정을 알지만 더는 안 퍼뜨림
 * 한 라운드
 *  1) 소문을 퍼뜨리는 사람은 자기가 든 모든 방에 글을 올리고, 방의 "소문을 모르고 정정도 못 본" 사람은
 *     확률 p로 솔깃해서 다음 라운드부터 퍼뜨린다
 *  2) 정정이 시작된 뒤에는 정정을 퍼뜨리는 사람이 같은 방식으로 글을 올린다. 확률은 p * correctionFactor
 *     (정정은 소문보다 덜 솔깃하다고 가정). 정정을 본 사람은 소문을 믿지도 퍼뜨리지도 않는다
 *  3) 퍼뜨리던 사람은 확률 q로 관심을 잃는다
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rumor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = {
    n: 500, rooms: 50, perPerson: 3,
    p: 0.015, q: 0.7, seeds: 3,
    correctionDelay: 0,        // 0이면 정정 없음, 아니면 이 라운드가 지난 뒤 정정 시작
    correctionSeeds: 3, correctionFactor: 0.7,
    seed: 1, maxRounds: 200,
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rng = mulberry32(p.seed);
    const n = p.n, R = Math.min(p.rooms, 400), per = Math.min(p.perPerson, R);

    // 방 인기도(큰 방/작은 방): 가중치 1/(순위+1)^0.6
    const w = Array.from({ length: R }, (_, r) => 1 / Math.pow(r + 1, 0.6));
    const cum = []; w.reduce((s, x, i) => (cum[i] = s + x), 0);
    const totalW = cum[R - 1];
    const pickRoom = () => {
      const x = rng() * totalW;
      let lo = 0, hi = R - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] >= x) hi = mid; else lo = mid + 1; }
      return lo;
    };
    const personRooms = [], roomMembers = Array.from({ length: R }, () => []);
    for (let i = 0; i < n; i++) {
      const mine = new Set();
      let guard = 0;
      while (mine.size < per && guard++ < 1000) mine.add(pickRoom());
      const arr = [...mine];
      personRooms.push(arr);
      arr.forEach((r) => roomMembers[r].push(i));
    }

    const rumor = new Uint8Array(n), corr = new Uint8Array(n);
    const lastRumorRoom = new Uint8Array(R), lastCorrRoom = new Uint8Array(R);
    const sim = {
      params: p, n, rooms: R, personRooms, roomMembers, rumor, corr, lastRumorRoom, lastCorrRoom,
      round: 0, done: false, correctionStarted: false, peakSpreaders: 0,
      history: [],

      counts() {
        let unknown = 0, spreading = 0, done = 0, corrected = 0, immune = 0;
        for (let i = 0; i < n; i++) {
          if (rumor[i] === 0) { unknown++; if (corr[i] > 0) immune++; }
          else if (rumor[i] === 1) spreading++; else done++;
          if (corr[i] > 0) corrected++;
        }
        return { unknown, spreading, done, corrected, immune, heard: n - unknown };
      },

      advance() {
        if (sim.done) return false;
        sim.round++;
        lastRumorRoom.fill(0); lastCorrRoom.fill(0);

        if (p.correctionDelay > 0 && !sim.correctionStarted && sim.round > p.correctionDelay) {
          sim.correctionStarted = true;
          let placed = 0, guard = 0;
          while (placed < p.correctionSeeds && guard++ < 10000) {
            const i = Math.floor(rng() * n);
            if (corr[i] === 0) { corr[i] = 1; if (rumor[i] === 1) rumor[i] = 2; placed++; }
          }
        }

        const rumorSp = [], corrSp = [];
        for (let i = 0; i < n; i++) { if (rumor[i] === 1) rumorSp.push(i); if (corr[i] === 1) corrSp.push(i); }
        const newRumor = [], newCorr = [];

        for (const i of rumorSp) {
          for (const r of personRooms[i]) {
            lastRumorRoom[r] = 1;
            for (const j of roomMembers[r]) {
              if (j !== i && rumor[j] === 0 && corr[j] === 0 && rng() < p.p) newRumor.push(j);
            }
          }
        }
        const pc = p.p * p.correctionFactor;
        for (const i of corrSp) {
          for (const r of personRooms[i]) {
            lastCorrRoom[r] = 1;
            for (const j of roomMembers[r]) {
              if (j !== i && corr[j] === 0 && rng() < pc) newCorr.push(j);
            }
          }
        }

        // 관심 잃기 (이번 라운드에 막 퍼뜨린 사람 기준)
        for (const i of rumorSp) if (rng() < p.q) rumor[i] = 2;
        for (const i of corrSp) if (rng() < p.q) corr[i] = 2;
        // 새로 알게 된 사람 반영
        for (const j of newCorr) if (corr[j] === 0) { corr[j] = 1; if (rumor[j] === 1) rumor[j] = 2; }
        for (const j of newRumor) if (rumor[j] === 0 && corr[j] === 0) rumor[j] = 1;

        const c = sim.counts();
        sim.peakSpreaders = Math.max(sim.peakSpreaders, c.spreading);
        sim.history.push(c);
        let active = c.spreading;
        for (let i = 0; i < n; i++) if (corr[i] === 1) active++;
        const waiting = p.correctionDelay > 0 && !sim.correctionStarted;
        if ((active === 0 && !waiting) || sim.round >= p.maxRounds) sim.done = true;
        return true;
      },

      run() { while (!sim.done) sim.advance(); return sim; },
    };

    // 처음 퍼뜨리는 사람
    let placed = 0, guard = 0;
    while (placed < p.seeds && guard++ < 10000) {
      const i = Math.floor(rng() * n);
      if (rumor[i] === 0) { rumor[i] = 1; placed++; }
    }
    sim.history.push(sim.counts());
    return sim;
  }

  // 같은 설정으로 여러 번 돌려 최종 도달률 목록을 얻는다
  function reach(opts, runs, seedBase) {
    const out = [];
    for (let k = 0; k < runs; k++) {
      const s = create(Object.assign({}, opts, { seed: (seedBase || 100) + k })).run();
      out.push(s.counts().heard / s.n);
    }
    return out;
  }

  return { DEFAULTS, create, reach };
});
