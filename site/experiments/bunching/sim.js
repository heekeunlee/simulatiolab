/*
 * 버스 뭉침(bus bunching): 간격이 고르게 출발한 버스가 왜 두세 대씩 몰려다니게 되는가.
 * 이 프로젝트의 단순화된 구현이다 (신호등·교통 정체·승객 하차·앞지르기 규칙 없음).
 * 브라우저와 Node.js 양쪽에서 같은 파일을 사용한다.
 *
 * 순환 노선: 정류장 S개가 고리 모양 길에 같은 간격으로 있고, 버스 n대가 같은 방향으로 돈다.
 *  - 정류장마다 승객이 일정한 평균 속도(demand명/시간)로 무작위(푸아송)로 도착해 줄을 선다.
 *  - 버스는 정류장 사이를 tau분에 달린다. 정류장에 서면 문을 열고 줄 선 승객을 1명당 beta분씩 태운다.
 *    줄이 빌 때까지(그동안 새로 온 승객도 태운다) 서 있고, 최소 d0분은 선다.
 *    => 늦은 버스는 줄이 길어 더 오래 서고, 그래서 더 늦어진다. 뒤차는 줄이 짧아 빨리 달려 따라잡는다 (되먹임).
 *  - 처방: none = 아무것도 안 함 / hold = 앞 버스가 이 정류장을 떠난 지 (이상적 간격 x 0.8)가 지나기 전엔 못 떠남
 *          limit = 한 정류장에서 서는 시간에 상한을 둬서 줄 일부는 다음 버스에 맡김
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Bunching = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { n: 6, demand: 40, eps: 5, remedy: 'none', stops: 24, tau: 1, d0: 0.1, beta: 0.05, hold: 1.15, capMul: 1.0, minutes: 360, dt: 0.1, seed: 1 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 모두 같은 간격일 때의 이상적인 간격(분)과 정류장당 정차 시간: H = S*(tau+T)/n, T = max(d0, beta*lambda*H/(1-beta*lambda))
  function nominal(p) {
    const lam = p.demand / 60, bl = p.beta * lam;
    let H = (p.stops * (p.tau + p.d0)) / p.n, T = p.d0;
    for (let i = 0; i < 200; i++) { T = Math.max(p.d0, (p.beta * lam * H) / (1 - bl)); H = (p.stops * (p.tau + T)) / p.n; }
    return { H, T, lap: H * p.n };
  }

  function create(opts) {
    const p = Object.assign({}, DEFAULTS, opts);
    const rnd = mulberry32(p.seed * 7919 + 13), S = p.stops, n = p.n, nom = nominal(p);
    const lam = p.demand / 60, mu = lam * p.dt, pe = Math.exp(-mu);
    const poisson = () => { if (mu <= 0) return 0; let k = 0, q = 1; q = rnd(); while (q > pe) { k++; q *= rnd(); } return k; };
    const cap = p.remedy === 'limit' ? p.capMul * nom.T : Infinity, hmin = p.remedy === 'hold' ? p.hold * nom.H : 0;
    const queue = new Array(S).fill(0), lastDep = new Array(S).fill(-1e9);
    const buses = [];
    for (let j = 0; j < n; j++) {
      const off = (j + (rnd() * 2 - 1) * (p.eps / 100)) * (S / n);
      buses.push({ id: j, dist: ((off % S) + S) % S + S, dwell: false, stop: 0, ta: 0, credit: 0 });
    }
    const sim = { p, nom, S, n, buses, queue, t: 0, arrivals: 0, qint: 0, rec: { t: [], gaps: [], cv: [], arr: [], qint: [], dist: [], qlen: [] } };

    function step() {
      const dt = p.dt, t = sim.t;
      for (let s = 0; s < S; s++) { const a = poisson(); queue[s] += a; sim.arrivals += a; sim.qint += queue[s] * dt; }
      // 달리는 버스
      for (const b of buses) {
        if (b.dwell) continue;
        const nd = b.dist + dt / p.tau;
        if (Math.floor(nd + 1e-9) > Math.floor(b.dist + 1e-9)) { b.dist = Math.floor(nd + 1e-9); b.dwell = true; b.stop = b.dist % S; b.ta = t; b.credit = 0; }
        else b.dist = nd;
      }
      // 서 있는 버스: 태우고, 떠날 수 있으면 떠난다
      for (const b of buses) {
        if (!b.dwell) continue;
        const s = b.stop;
        b.credit += dt / p.beta;
        const take = Math.min(Math.floor(b.credit), queue[s]);
        queue[s] -= take; b.credit -= take;
        if (queue[s] === 0 && b.credit > 1) b.credit = 1;
        const waited = t + dt - b.ta;
        const ready = (queue[s] === 0 && waited >= p.d0) || waited >= cap;
        if (ready && t + dt >= lastDep[s] + hmin) { b.dwell = false; lastDep[s] = t + dt; }
      }
      sim.t += dt;
    }

    // 버스 사이 간격: 각 버스의 앞차까지의 거리를 이상적 간격(S/n)으로 나눈 값 (1이면 고름)
    function gaps() {
      const o = buses.map((b) => ({ id: b.id, x: b.dist % S })).sort((a, b) => a.x - b.x), g = new Array(n).fill(1);
      for (let i = 0; i < n; i++) { const a = o[i], c = o[(i + 1) % n]; let d = c.x - a.x; if (i === n - 1) d += S; g[a.id] = d / (S / n); }
      if (n === 1) g[0] = 1;
      return g;
    }
    function cvOf(g) { const m = g.reduce((x, y) => x + y, 0) / g.length; return Math.sqrt(g.reduce((x, y) => x + (y - m) * (y - m), 0) / g.length) / m; }

    function sample() {
      const g = gaps(), r = sim.rec;
      r.t.push(sim.t); r.gaps.push(g); r.cv.push(cvOf(g)); r.arr.push(sim.arrivals); r.qint.push(sim.qint);
      r.dist.push(buses.reduce((x, b) => x + b.dist, 0));
    }
    sample();
    let steps = 0;
    sim.tick = function (k) { for (let i = 0; i < (k || 2); i++) { step(); if (++steps % 10 === 0) sample(); } return !sim.done(); };
    sim.minute = function () { sim.tick(Math.round(1 / p.dt)); return !sim.done(); };
    sim.done = () => sim.rec.t.length > p.minutes;
    sim.run = () => { while (!sim.done()) sim.tick(10); return sim; };
    sim.gapsNow = gaps;
    sim.cvNow = () => cvOf(gaps());
    // 분 단위 구간 [m0, m1]의 평균 기다림(리틀의 법칙: 줄 서 있는 사람 시간 합 / 도착한 사람 수)과 한 바퀴 시간
    sim.waitIn = (m0, m1) => { const r = sim.rec; m1 = Math.min(m1, r.t.length - 1); const a = r.arr[m1] - r.arr[m0]; return a > 0 ? (r.qint[m1] - r.qint[m0]) / a : 0; };
    sim.lapIn = (m0, m1) => { const r = sim.rec; m1 = Math.min(m1, r.t.length - 1); const d = (r.dist[m1] - r.dist[m0]) / n / S; return d > 0 ? (r.t[m1] - r.t[m0]) / d : 0; };
    sim.cvIn = (m0, m1) => { const r = sim.rec; m1 = Math.min(m1, r.t.length - 1); let s = 0, c = 0; for (let i = m0; i <= m1; i++) { s += r.cv[i]; c++; } return s / c; };
    sim.queueNow = () => queue.slice();
    return sim;
  }

  // 같은 설정을 여러 시드로 돌려 뒤쪽 절반의 평균을 낸다
  function summary(opts, seeds) {
    seeds = seeds || 6; const out = { wait: 0, lap: 0, cv: 0, even: 0 };
    for (let k = 0; k < seeds; k++) {
      const s = create(Object.assign({}, opts, { seed: (opts.seed || 1) + k })).run(), M = s.p.minutes, h = Math.floor(M / 2);
      out.wait += s.waitIn(h, M) / seeds; out.lap += s.lapIn(h, M) / seeds; out.cv += s.cvIn(h, M) / seeds;
      out.even = s.nom.H / 2; out.H = s.nom.H; out.lap0 = s.nom.lap;
    }
    return out;
  }

  return { create, summary, nominal, DEFAULTS };
});
