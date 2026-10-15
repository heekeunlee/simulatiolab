(function () {
  'use strict';
  const SM = window.Strait, L = window.Lab;
  const { css } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일: 길목이 막혀 우회로에 줄이 길게 선 장면에서 멈춘다
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const C_USE = '#e8890c', C_FAR = '#7c4dff', C_BLK = '#d62828', C_OK = '#2f6fed';
  // 집계(미리 계산): node tools/validate-strait.js 출력의 SWEEP과 같아야 한다 (세계 8가지 평균)
  const SWEEP = {"cap":{"1":{"4":{"peak":123.2,"far":120.7,"use":123.2,"rec":12.5,"never":0,"load":191.2},"10":{"peak":128.5,"far":125.3,"use":128.5,"rec":17.1,"never":0,"load":191.2},"20":{"peak":147.2,"far":143.4,"use":147.2,"rec":28.5,"never":0,"load":191.2}},"2":{"4":{"peak":102.7,"far":101,"use":102.7,"rec":3,"never":0,"load":95.9},"10":{"peak":102.7,"far":101,"use":102.7,"rec":3,"never":0,"load":95.9},"20":{"peak":102.7,"far":101,"use":102.7,"rec":3,"never":0,"load":95.9}},"1.25":{"4":{"peak":111.6,"far":109.6,"use":111.6,"rec":5.6,"never":0,"load":153},"10":{"peak":111.6,"far":109.6,"use":111.6,"rec":5.6,"never":0,"load":153},"20":{"peak":111.6,"far":109.6,"use":111.6,"rec":5.9,"never":0,"load":153}},"1.5":{"4":{"peak":107.7,"far":106,"use":107.7,"rec":4,"never":0,"load":127.9},"10":{"peak":107.8,"far":106.1,"use":107.8,"rec":4.8,"never":0,"load":127.9},"20":{"peak":108,"far":106.3,"use":108,"rec":4.8,"never":0,"load":127.9}},"2.5":{"4":{"peak":102.1,"far":100.4,"use":102.1,"rec":3,"never":0,"load":76.7},"10":{"peak":102.1,"far":100.4,"use":102.1,"rec":3,"never":0,"load":76.7},"20":{"peak":102.1,"far":100.4,"use":102.1,"rec":3,"never":0,"load":76.7}}},"which":{"A":{"peak":128.5,"far":125.3,"use":128.5,"rec":17.1,"never":0,"load":191.2},"B":{"peak":153.9,"far":126.1,"use":153.9,"rec":17.3,"never":0,"load":161.9},"C":{"peak":154.2,"far":126.1,"use":154.2,"rec":17.4,"never":0,"load":161.5}},"detour":{"1":{"ice":125.3,"star":116.6,"use":128.5},"2":{"ice":115.3,"star":117.5,"use":130.2},"0.8":{"ice":128.7,"star":116.3,"use":128.3},"1.5":{"ice":122.9,"star":117.2,"use":133.4}}};
  let sim = null, seedGetter = () => 1, lastStepAt = 0, chartTimer = 0, lastChart = 0, yTop = 150;
  const params = () => ({ seed: seedGetter(), which: $('which').value, dur: Number($('dur').value), cap: Number($('cap').value) / 100, detour: Number($('detour').value) / 100 });
  const speed = () => ($('speed') ? Number($('speed').value) : 3);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };
  const blockedName = () => (sim.blockedRoute >= 0 ? sim.ROUTES[sim.blockedRoute].name : '');

  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 그린다(3D는 따로 계산하지 않음)
  function share() { window.StraitState = { sim, lastStepAt, interval: 1 / speed(), isPaused, thumb: THUMB }; }

  // ---------- ② 수입 물가 지수의 시간 변화 (재생 시점까지) ----------
  function drawIdx() {
    const cv = $('c-idx');
    const items = [{ kind: 'line', color: C_USE, label: '막힌 길목을 쓰던 나라 (평균)' }, { kind: 'line', color: C_FAR, label: '안 쓰던 나라 (평균)' }, { kind: 'box', color: 'rgba(214,40,40,.16)', label: '길목이 막힌 동안' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 14, t: 30 }), { ctx, m, pw, ph } = c;
    const H = sim.hist, T = SM.C.WEEKS;
    const cur = H.reduce((a, h) => Math.max(a, h.useAvg, h.farAvg), 100);
    while (cur > yTop - 2) yTop += 50;   // 축은 넘칠 때만 한 단계 넓힌다 (끝을 미리 보지 않음)
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - ((Math.min(yTop, v) - 95) / (yTop - 95)) * ph;
    const yt = []; for (let v = 100; v <= yTop; v += yTop > 200 ? 50 : 10) yt.push(v);
    // 막힌 기간(지금까지)
    const t0 = SM.C.START, t1 = Math.min(sim.t, sim.reopenAt);
    if (sim.t >= t0 && sim.blockedRoute >= 0) { ctx.fillStyle = 'rgba(214,40,40,.10)'; ctx.fillRect(X(t0 - 1), m.t, X(t1 - (sim.t >= sim.reopenAt ? 1 : 0)) - X(t0 - 1), ph); }
    L.axes(c, { X, Y, yTicks: yt, xTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80], xLabel: '주', yLabel: '수입 물가 지수 (평소 = 100)' });
    const pts = (f) => [[X(0), Y(100)]].concat(H.map((h) => [X(h.t), Y(f(h))]));
    L.line(ctx, pts((h) => h.farAvg), C_FAR, 2.4);
    L.line(ctx, pts((h) => h.useAvg), C_USE, 2.6);
    if (H.length) { const h = H[H.length - 1]; [[h.useAvg, C_USE], [h.farAvg, C_FAR]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(h.t), Y(v), 4.5, 0, 7); ctx.fill(); }); }
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 바닷길별 붐비는 정도 (지금) ----------
  function drawLoad() {
    const cv = $('c-load');
    const items = [{ kind: 'box', color: C_OK, label: '용량 안' }, { kind: 'box', color: C_BLK, label: '용량을 넘음 (줄이 생김)' }];
    const sp = L.belowSpace(cv, items), narrow = (cv.clientWidth || 400) < 520;
    const c = L.chart(cv, (narrow ? 0.82 : 0.5) + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: narrow ? 84 : 110, r: narrow ? 76 : 92, t: 30 }), { ctx, m, pw, ph, w } = c;
    const R = sim.ROUTES, n = R.length, gh = ph / n, XM = 2, X = (v) => m.l + (Math.min(XM, v) / XM) * pw;
    L.axes(c, { X, Y: () => -99, xTicks: narrow ? [0, 1, 2] : [0, 0.5, 1, 1.5, 2], xFmt: (v) => Math.round(v * 100) + '%', xLabel: '짐 ÷ 용량', yLabel: '' });
    ctx.strokeStyle = css('--line'); [0, 0.5, 1.5, 2].forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); });
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(1), m.t - 4); ctx.lineTo(X(1), m.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.font = '600 11px ' + FONT; ctx.fillStyle = '#334155'; ctx.textAlign = 'center'; ctx.fillText('용량', X(1), m.t - 8);
    R.forEach((r, i) => {
      const y = m.t + i * gh, bh = Math.min(22, gh * 0.62), by = y + (gh - bh) / 2, x = sim.routeLoad(i), wait = sim.routeQ(i) / sim.E[sim.RE[i]].cap * 7;
      const isBlk = sim.blocked && i === sim.blockedRoute;
      ctx.font = '600 12px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'right'; ctx.fillText(r.name, m.l - 8, by + bh / 2 + 4);
      if (isBlk) {
        ctx.fillStyle = 'rgba(214,40,40,.12)'; ctx.fillRect(m.l, by, pw, bh);
        ctx.fillStyle = C_BLK; ctx.font = '700 12px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('막힘', m.l + 8, by + bh / 2 + 4);
        return;
      }
      ctx.fillStyle = C_OK; ctx.fillRect(m.l, by, X(Math.min(1, x)) - m.l, bh);
      if (x > 1) { ctx.fillStyle = C_BLK; ctx.fillRect(X(1), by, X(x) - X(1), bh); }
      // 오른쪽 칸: 붐빔 % (위) · 줄 때문에 더 기다리는 날 (아래)
      ctx.font = '700 11.5px ' + FONT; ctx.fillStyle = x > 1 ? C_BLK : css('--text'); ctx.textAlign = 'left';
      const tx = w - m.r + 8, wl = wait >= 0.5;
      ctx.fillText(Math.round(x * 100) + '%', tx, by + bh / 2 + (wl ? -2 : 4));
      if (wl) { ctx.font = '600 10.5px ' + FONT; ctx.fillStyle = C_BLK; ctx.fillText(`기다림 +${Math.round(wait)}일`, tx, by + bh / 2 + 11); }
    });
    L.drawLegendBelow(c, items);
  }

  // ---------- ④⑤ 집계: 바닷길 용량 × 막힌 기간 ----------
  const CAPS = ['1', '1.25', '1.5', '2', '2.5'], DURS = ['4', '10', '20'], DCOL = ['#93c5fd', '#3b82f6', '#1e3a8a'];
  function drawSweep(id, key, yMin, yMax, yTicks, yLabel, fmt) {
    const cv = $(id), P = params();
    const items = DURS.map((d, j) => ({ kind: 'box', color: DCOL[j], label: `${d}주 막힘` }));
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.56 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40, r: 10, t: 30 }), { ctx, m, pw, ph } = c;
    const gw = pw / CAPS.length, Y = (v) => m.t + ph - ((Math.min(yMax, v) - yMin) / (yMax - yMin)) * ph;
    L.axes(c, { X: (i) => m.l + (i + 0.5) * gw, Y, yTicks, xTicks: [0, 1, 2, 3, 4], xFmt: (i) => Math.round(Number(CAPS[i]) * 100) + '%', xLabel: '바닷길 용량 (지금 = 100%)', yLabel });
    const ci = CAPS.indexOf(String(P.cap));
    CAPS.forEach((cp, i) => {
      const x0 = m.l + i * gw, bw = Math.min(20, (gw - 10) / 3);
      if (i === ci) { ctx.fillStyle = 'rgba(47,111,237,.07)'; ctx.fillRect(x0 + 1, m.t, gw - 2, ph); }
      DURS.forEach((d, j) => {
        const v = SWEEP.cap[cp][d][key], x = x0 + gw / 2 + (j - 1.5) * bw;
        ctx.fillStyle = DCOL[j]; ctx.fillRect(x + 1, Y(v), bw - 2, Y(yMin) - Y(v));
        if (gw > 60) { ctx.font = '700 10px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(fmt(v), x + bw / 2, Y(v) - 4); }
      });
    });
    L.drawLegendBelow(c, items);
  }
  function notes() {
    const S = SWEEP.cap['1'], W = SWEEP.which, Dt = SWEEP.detour;
    $('note-p').textContent = `용량 100%에서 4주 막힘 ${S['4'].peak} · 10주 ${S['10'].peak} · 20주 ${S['20'].peak} / 용량 150%면 기간과 상관없이 약 ${SWEEP.cap['1.5']['10'].peak}`;
    $('note-r').textContent = `용량 100%: 4주 막힘 → 다시 열린 뒤 ${S['4'].rec}주 · 10주 → ${S['10'].rec}주 · 20주 → ${S['20'].rec}주 / 우회로가 두 배로 멀면 얼음 바다 최고 ${Dt['2'].ice}(보통 ${Dt['1'].ice})`;
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    if (!sim) return;
    const h = sim.hist[sim.hist.length - 1];
    const state = sim.blockedRoute < 0 ? '막힌 길목 없음' : sim.t < SM.C.START ? `${SM.C.START}주째에 ${blockedName()}이 막혀요` : sim.blocked ? `${blockedName()} 막힘 (${sim.t - SM.C.START + 1}주째)` : `${blockedName()} 다시 열림`;
    const maxNow = h ? h.max : 100;
    let topI = 0; sim.idx.forEach((v, i) => { if (v > sim.idx[topI]) topI = i; });
    const rec = sim.t < sim.reopenAt ? '' : sim.recoverAt != null ? `다시 열린 뒤 ${sim.recoverAt - sim.reopenAt}주` : `다시 열린 뒤 ${sim.t - sim.reopenAt}주째, 아직`;
    const busiest = sim.ROUTES.map((r, i) => [i, sim.routeLoad(i)]).filter(([i]) => !(sim.blocked && i === sim.blockedRoute)).sort((a, b) => b[1] - a[1])[0];
    const wait = sim.routeQ(busiest[0]) / sim.E[sim.RE[busiest[0]]].cap * 7;
    const cards = [
      ['가장 많이 오른 나라 (지금)', `${Math.round(maxNow)}`, maxNow >= 100.5 ? sim.PORTS[topI].name : '평소 = 100'],
      ['안 쓰던 나라 중 최고 (지금까지)', `${Math.round(sim.peakFar)}`, sim.peakFarPort >= 0 && sim.peakFar >= 100.5 ? sim.PORTS[sim.peakFarPort].name : ''],
      ['가장 붐비는 바닷길 (지금)', `${Math.round(busiest[1] * 100)}%`, wait >= 0.5 ? `${sim.ROUTES[busiest[0]].name} · 기다림 +${Math.round(wait)}일` : sim.ROUTES[busiest[0]].name],
      ['다 풀리기까지', rec ? (sim.recoverAt != null ? `${sim.recoverAt - sim.reopenAt}주` : '…') : '', rec || state],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    const wh = $('when'); if (wh) wh.textContent = `${sim.t}주 / ${SM.C.WEEKS}주 · ${state}`;
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawIdx(); drawLoad(); }
  function draw() {
    share();
    if (performance.now() - lastChart > 150) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 170); }
  }
  function drawSweeps() {
    drawSweep('c-peak', 'peak', 100, 150, [100, 110, 120, 130, 140, 150], '가장 많이 오른 나라의 최고 지수', (v) => String(Math.round(v)));
    drawSweep('c-rec', 'rec', 0, 30, [0, 5, 10, 15, 20, 25, 30], '다시 열린 뒤 풀리기까지 (주)', (v) => String(Math.round(v)));
    notes();
  }

  const h = L.harness({
    controls: ['which', 'dur', 'cap', 'detour'],
    format: { dur: (v) => v + '주', cap: (v) => v + '%', detour: (v) => v + '%' },
    defaults: { which: 'A', dur: 10, cap: 100, detour: 100 },
    speedScale: 1,
    build() {
      const P = params(); sim = SM.create(P); yTop = 150;
      if (THUMB) { for (let t = 0; t < 12; t++) sim.step(); }
      lastStepAt = performance.now(); share();
    },
    autoplay: !THUMB,
    advance() { if (sim.done) return false; sim.step(); lastStepAt = performance.now(); return true; },
    isDone() { return sim.done; },
    draw,
    after() { drawCharts(); drawSweeps(); },
    redrawExtra() { drawCharts(); drawSweeps(); },
    seedLabel: '세계',
  });
  seedGetter = h.seed;
  window.StraitApp = { params, sim: () => sim };
})();
