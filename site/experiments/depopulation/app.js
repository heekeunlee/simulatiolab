(function () {
  'use strict';
  const DP = window.Depop, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 40해쯤, 바깥부터 회색으로 가라앉은 지도에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_CLOSED = '#64748b', C_CITY = '#e8590c', C_ALIVE = '#1f9d55', C_OFF = '#a3acb9', C_ON = '#1f9d55';
  // 집계(미리 계산): node tools/validate-depopulation.js 출력과 같아야 한다 (기본 설정, 처음 지도 8개 평균, 60해 끝 값)
  const SWEEP = {"pull":{"50":{"closed":45,"alive":66,"city":47,"total":100,"spread":19.8,"first":8.3,"half":-1,"halfN":0},"100":{"closed":74,"alive":24,"city":69,"total":100,"spread":20.3,"first":4.6,"half":32.1,"halfN":8},"150":{"closed":87,"alive":9,"city":83,"total":100,"spread":18.1,"first":3.6,"half":22.5,"halfN":8}},"thr":{"40":{"closed":54,"alive":21,"city":66,"total":100,"spread":22.3,"first":21.9,"half":36,"halfN":8},"60":{"closed":74,"alive":24,"city":69,"total":100,"spread":20.3,"first":4.6,"half":32.1,"halfN":8},"80":{"closed":84,"alive":19,"city":73,"total":100,"spread":3.9,"first":2,"half":18.5,"halfN":8}},"birth":{"0":{"closed":39,"alive":65,"city":46,"total":100,"spread":14.6,"first":4.8,"half":-1,"halfN":0},"50":{"closed":55,"alive":47,"city":55,"total":100,"spread":21.6,"first":4.6,"half":46.9,"halfN":8},"100":{"closed":74,"alive":24,"city":69,"total":100,"spread":20.3,"first":4.6,"half":32.1,"halfN":8}},"prot":{"near":{"own":57,"ownB":53,"nb":45,"nbB":45,"held":32.1,"heldB":32,"of":68,"closed":73.5,"closedB":73.7,"ring":4},"mid":{"own":46,"ownB":36,"nb":34,"nbB":34,"held":20.5,"heldB":20.8,"of":72,"closed":73.4,"closedB":73.7,"ring":7.5},"far":{"own":42,"ownB":27,"nb":27,"nbB":27,"held":13.3,"heldB":13.4,"of":67,"closed":73.3,"closedB":73.7,"ring":11}}};
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0;
  const params = () => ({
    seed: seedGetter(), pull: Number($('pull').value), thr: Number($('thr').value), birth: Number($('birth').value),
    protect: Number($('protect').value), where: $('where').value,
  });
  const speed = () => ($('speed') ? Number($('speed').value) : 2);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  // 3D 지도(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.DepopState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB }; }

  // ---------- ② 시간별 문 닫은 마을 비율 · 도시 인구 비중 (재생 시점까지) ----------
  function drawTime() {
    const cv = $('c-time'), items = [{ kind: 'line', color: C_CLOSED, label: '시설이 문 닫은 마을 (%)' }, { kind: 'line', color: C_CITY, label: '도시에 사는 사람 비중 (%)' }, { kind: 'dash', color: '#94a3b8', label: '처음 문 닫은 해' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 38, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.years, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [0, 10, 20, 30, 40, 50, 60], xLabel: '모델 속 시간 (해)', yLabel: '비율 (%)' });
    if (sim.firstYear >= 0) { ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(sim.firstYear), m.t); ctx.lineTo(X(sim.firstYear), m.t + ph); ctx.stroke(); ctx.setLineDash([]); }
    const H = sim.hist;
    L.line(ctx, H.city.map((v, k) => [X(k), Y(v)]), C_CITY, 2.4);
    L.line(ctx, H.closed.map((v, k) => [X(k), Y(v)]), C_CLOSED, 2.8);
    const n = H.closed.length - 1;
    [[H.closed[n], C_CLOSED], [H.city[n], C_CITY]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(n), Y(v), 4, 0, 7); ctx.fill(); });
    L.drawLegendBelow(c, items);
  }
  // ③ 남은 마을 수 (재생 시점까지)
  function drawAlive() {
    const cv = $('c-alive'), NV = sim.VIL.length, items = [{ kind: 'line', color: C_ALIVE, label: '남은 마을 (인구가 처음의 절반 이상)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.58 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const T = sim.params.years, X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - (v / NV) * ph;
    L.axes(c, { X, Y, yTicks: [0, 150, 300, 450, 616], xTicks: [0, 10, 20, 30, 40, 50, 60], xLabel: '모델 속 시간 (해)', yLabel: '마을 수 (개)' });
    const H = sim.hist.alive;
    L.line(ctx, H.map((v, k) => [X(k), Y(v)]), C_ALIVE, 2.8);
    const n = H.length - 1; ctx.fillStyle = C_ALIVE; ctx.beginPath(); ctx.arc(X(n), Y(H[n]), 4, 0, 7); ctx.fill();
    L.drawLegendBelow(c, items);
  }

  // ---------- ④~⑦ 집계 막대 ----------
  function bars(cv, groups, series, yLabel) {
    const items = series.map((s) => ({ kind: 'box', color: s.color, label: s.label }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.6 + sp.extra / (cv.clientWidth || 400), { b: sp.b + 22, l: 38, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / groups.length, Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X: (v) => m.l + (v + 0.5) * gw, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [], yLabel });
    groups.forEach((g, i) => {
      const x0 = m.l + i * gw;
      if (g.cur) { ctx.fillStyle = 'rgba(31,157,85,.08)'; ctx.fillRect(x0 + 2, m.t, gw - 4, ph); }
      const bw = Math.min(36, (gw - 18) / g.vals.length);
      const start = x0 + (gw - bw * g.vals.length - 4 * (g.vals.length - 1)) / 2;
      g.vals.forEach((v, k) => {
        const x = start + k * (bw + 4); ctx.fillStyle = series[k].color; ctx.fillRect(x, Y(v), bw, Y(0) - Y(v));
        ctx.font = '700 11.5px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(String(v), x + bw / 2, Y(v) - 4);
      });
      ctx.font = (g.cur ? '700 ' : '600 ') + '12px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center';
      ctx.fillText(g.name, x0 + gw / 2, m.t + ph + 16);
      ctx.font = '11px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText(g.sub, x0 + gw / 2, m.t + ph + 31);
    });
    L.drawLegendBelow(Object.assign({}, c, { m: Object.assign({}, m, { b: m.b - 18 }) }), items);   // 막대 이름 두 줄 아래
  }
  const SER = [{ label: '시설이 문 닫은 마을 (%)', color: C_CLOSED }, { label: '남은 마을 (%)', color: C_ALIVE }];
  const D = DP.DEFAULTS;
  const isDef = (P, skip) => ['pull', 'thr', 'birth'].every((k) => k === skip || P[k] === D[k]) && P.protect === 0;
  const halfTxt = (s) => (s.half >= 0 ? `반까지 ${Math.round(s.half)}해` : '반까지 안 닿음');
  function drawPull() {
    const P = params(), groups = [50, 100, 150].map((v) => { const s = SWEEP.pull[v]; return { name: `끌림 ${v}%`, vals: [s.closed, s.alive], sub: halfTxt(s), cur: isDef(P, 'pull') && P.pull === v }; });
    bars($('c-pull'), groups, SER, '비율 (%)');
  }
  function drawThr() {
    const P = params(), groups = [40, 60, 80].map((v) => { const s = SWEEP.thr[v]; return { name: `문턱 ${v}명`, vals: [s.closed, s.alive], sub: halfTxt(s), cur: isDef(P, 'thr') && P.thr === v }; });
    bars($('c-thr'), groups, SER, '비율 (%)');
  }
  function drawBirth() {
    const P = params(), groups = [0, 50, 100].map((v) => { const s = SWEEP.birth[v]; return { name: `출생 영향 ${v}%`, vals: [s.closed, s.alive], sub: halfTxt(s), cur: isDef(P, 'birth') && P.birth === v }; });
    bars($('c-birth'), groups, SER, '비율 (%)');
  }
  function drawProt() {
    const P = params(), names = { near: '도시 가까이', mid: '중간 거리', far: '변두리' };
    const groups = ['near', 'mid', 'far'].map((w) => { const s = SWEEP.prot[w]; return { name: names[w], vals: [s.ownB, s.own], sub: `둘레 마을 ${s.nbB}% → ${s.nb}%`, cur: P.protect === 3 && P.where === w && isDef(Object.assign({}, P, { protect: 0 })) }; });
    bars($('c-prot'), groups, [{ label: '안 지켜 줄 때', color: C_OFF }, { label: '3곳 지켜 줄 때', color: C_ON }], '지켜 준 마을에 남은 인구 (처음 대비 %)');
  }
  function notes() {
    const Pu = SWEEP.pull, Th = SWEEP.thr, B = SWEEP.birth, Pr = SWEEP.prot;
    $('note-p').textContent = `문 닫은 마을: 끌림 50% ${Pu[50].closed}% · 100% ${Pu[100].closed}% · 150% ${Pu[150].closed}% (전체 인구는 모두 처음의 ${Pu[100].total}%)`;
    $('note-t').textContent = `남은 마을: 문턱 40명 ${Th[40].alive}% · 60명 ${Th[60].alive}% · 80명 ${Th[80].alive}%`;
    $('note-b').textContent = `문 닫은 마을: 출생 영향 0% ${B[0].closed}% · 50% ${B[50].closed}% · 100% ${B[100].closed}%`;
    $('note-x').textContent = `둘레 2칸 안 마을 가운데 시설이 남은 곳: 변두리 ${Pr.far.of}곳 중 ${Pr.far.heldB} → ${Pr.far.held} · 중간 ${Pr.mid.of}곳 중 ${Pr.mid.heldB} → ${Pr.mid.held}`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const m = sim.last, NV = sim.VIL.length;
    let half = '', halfSub = '아직 처음 문 닫은 마을이 없어요';
    if (sim.firstYear >= 0) {
      if (sim.halfYear >= 0) { half = `${sim.halfYear - sim.firstYear}해`; halfSub = `처음 닫힌 ${sim.firstYear}해째부터 ${sim.halfYear}해째까지`; }
      else halfSub = sim.done ? '이 판에서는 반까지 닫히지 않았어요' : `처음 닫힌 때: ${sim.firstYear}해째`;
    }
    const cards = [
      ['남은 마을', `${m.alive}곳`, `${NV}곳 중 · 인구가 처음의 절반 이상`],
      ['시설이 문 닫은 마을', `${Math.round(m.closed)}%`, `${m.nClosed}곳`],
      ['도시에 사는 사람 비중', `${Math.round(m.city)}%`, `전체 인구는 처음의 ${Math.round(m.total)}%`],
      ['연쇄가 번진 거리', sim.firstYear >= 0 ? `${m.spread}칸까지` : '', sim.firstYear >= 0 ? '처음 문 닫은 곳에서 닫힌 마을이 이어진 거리' : '아직 문 닫은 곳이 없어요'],
      ['처음 닫힌 뒤 반이 닫히기까지', half, halfSub],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${sim.t}해 / ${sim.params.years}해`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawTime(); drawAlive(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 120) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 140); }
  }
  function drawSweeps() { drawPull(); drawThr(); drawBirth(); drawProt(); notes(); }

  const h = L.harness({
    controls: ['pull', 'thr', 'birth', 'protect', 'where'],
    format: { pull: (v) => v + '%', thr: (v) => v + '명', birth: (v) => v + '%', protect: (v) => (Number(v) ? v + '곳' : '없음'), where: () => '' },
    defaults: { pull: 100, thr: 60, birth: 100, protect: 0, where: 'mid' },
    speedScale: 1,
    build() {
      sim = DP.create(params());
      if (THUMB) { while (sim.t < 40) sim.step(); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done) return false; sim.step(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '지도',
  });
  seedGetter = h.seed;
  window.DepopApp = { params, sim: () => sim };
})();
