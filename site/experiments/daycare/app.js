(function () {
  'use strict';
  const D = window.Daycare, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const COL = { S: '#8fb3e8', E: '#f0b429', I: '#e5484d', R: '#1fa463', GRAY: '#8a93a6', HOME: '#3b4a6b' };
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 여러 반에서 감기가 번진 장면으로 바로 간다
  let sim = null, ref = null, seedGetter = () => 1, sweepStay = [], sweepSize = [];
  const params = () => ({ seed: seedGetter(), size: Number($('size').value), contact: Number($('contact').value), stay: Number($('stay').value) / 100, hyg: Number($('hyg').value) / 100, imm: Number($('imm').value) });
  const f1 = (v) => v.toFixed(1);
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);

  // ---------- ① 교실 ----------
  function drawRooms() {
    const cw = $('c-room').clientWidth || 600, asp = THUMB ? 1 : cw < 560 ? 0.78 : 0.56;
    const c = L.chart($('c-room'), asp, { l: 8, r: 8, t: 8, b: 8 }), { ctx, w, h } = c;
    ctx.fillStyle = css('--surface') || '#fff'; ctx.fillRect(0, 0, w, h);
    const K = sim.K, S = sim.S, cols = THUMB ? 3 : 4, rows = Math.ceil(K / cols), gap = cw < 560 ? 6 : 10;
    const cwid = (w - 16 - gap * (cols - 1)) / cols, chei = (h - 16 - gap * (rows - 1)) / rows, hd = THUMB ? 6 : cw < 560 ? 15 : 20;
    const day = Math.max(0, sim.day - 1), wk = sim.day > 0 && sim.isWeekend(day);
    const fs = cw < 560 ? 10 : 12;
    for (let k = 0; k < K; k++) {
      const x = 8 + (k % cols) * (cwid + gap), y = 8 + Math.floor(k / cols) * (chei + gap);
      ctx.fillStyle = wk ? 'rgba(138,147,166,0.16)' : 'rgba(47,111,237,0.06)'; ctx.strokeStyle = css('--line');
      L.roundRect(ctx, x, y, cwid, chei, 8); ctx.fill(); ctx.stroke();
      let nI = 0;
      for (let j = 0; j < S; j++) if (sim.st[k * S + j] === 2) nI++;
      if (!THUMB) {
        ctx.font = '600 ' + fs + 'px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = css('--muted');
        ctx.fillText(cw < 560 ? `${k + 1}반` : `${k + 1}반 · 아픈 아이 ${nI}명`, x + 6, y + hd - 4);
      }
      const ix = x + 5, iy = y + hd, iw = cwid - 10, ih = chei - hd - 5;
      let best = 0, bc = 1;
      for (let cc = 1; cc <= S; cc++) { const rr = Math.ceil(S / cc), d = Math.min(iw / cc, ih / rr); if (d > best) { best = d; bc = cc; } }
      const r = best * 0.4, ox = ix + (iw - bc * best) / 2, oy = iy + (ih - Math.ceil(S / bc) * best) / 2;
      for (let j = 0; j < S; j++) {
        const i = k * S + j, s = sim.st[i], px = ox + (j % bc + 0.5) * best, py = oy + (Math.floor(j / bc) + 0.5) * best;
        ctx.beginPath(); ctx.arc(px, py, r, 0, 7);
        if (s === 2) {
          const home = sim.stayer[i] && sim.kday[i] >= 1; // 아프면 쉬는 아이: 속이 빈 고리 (집에 있음)
          if (home || wk) { ctx.strokeStyle = COL.I; ctx.lineWidth = Math.max(1.5, r * 0.35); ctx.stroke(); ctx.lineWidth = 1; }
          else { ctx.fillStyle = COL.I; ctx.fill(); }
        } else if (s === 1) { ctx.fillStyle = COL.E; ctx.fill(); }
        else { ctx.fillStyle = sim.imm[i] > 0 ? COL.R : COL.S; ctx.fill(); }
      }
    }
    const wkn = Math.floor(Math.max(0, sim.day - 1) / 7) + 1;
    $('when').textContent = `${wkn}주째 · ${wk ? '주말' : '평일'}`;
  }

  // ---------- 공통: 주 축 ----------
  function weekChart(id, y0, y1, yTicks, yFmt) {
    const c = L.chart($(id), 0.58, { l: 46, b: 40 }), { m, pw, ph } = c, W = Math.ceil(sim.params.days / 7);
    const X = (w) => m.l + (w / W) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const xt = []; for (let w = 0; w <= W; w += 8) xt.push(w);
    L.axes(c, { X, Y, yTicks, yFmt, xTicks: xt, xFmt: (v) => String(v), xLabel: '학기 시작 후 주 (주)', yLabel: '아픈 아이 비율 (%)' });
    return { c, X, Y, W };
  }

  // ---------- ② 주별 아픈 아이 ----------
  function drawWeeks() {
    const wk = sim.weekly(), rf = ref ? ref.weekly : [];
    const mx = Math.max(0.05, ...wk.sick, ...rf), y1 = Math.ceil((mx + 0.01) * 20) / 20, yt = []; for (let v = 0; v <= y1 + 1e-9; v += y1 > 0.25 ? 0.1 : 0.05) yt.push(+v.toFixed(2));
    const { c, X, Y } = weekChart('c-week', 0, y1, yt, (v) => Math.round(v * 100) + '%');
    const { ctx, m, pw, ph } = c;
    // 기준선: 아프면 쉬는 아이가 없을 때(같은 설정, 여러 번 돌린 평균)
    L.line(ctx, rf.map((v, i) => [X(i + 0.5), Y(v)]), COL.GRAY, 2);
    ctx.setLineDash([]);
    if (wk.sick.length) {
      ctx.fillStyle = mix(COL.I, 0.2); ctx.beginPath(); ctx.moveTo(X(0.5), Y(0));
      wk.sick.forEach((v, i) => ctx.lineTo(X(i + 0.5), Y(v))); ctx.lineTo(X(wk.sick.length - 0.5), Y(0)); ctx.closePath(); ctx.fill();
      L.line(ctx, wk.sick.map((v, i) => [X(i + 0.5), Y(v)]), COL.I, 2.6);
      L.line(ctx, wk.home.map((v, i) => [X(i + 0.5), Y(v)]), COL.HOME, 2);
    }
    L.legend(c, [{ kind: 'line', color: COL.I, label: '이번에 돌린 결과: 아픈 아이' }, { kind: 'line', color: COL.HOME, label: '그 중 집에서 쉰 아이' }, { kind: 'line', color: COL.GRAY, label: '비교: 아무도 안 쉴 때 (평균)' }], 'tr');
  }

  // ---------- ③ 걸린 횟수 분포 ----------
  function drawDist() {
    const KM = 10, d = sim.dist(KM), mx = Math.max(0.1, ...d), y1 = Math.ceil(mx * 10 + 0.5) / 10, yt = []; for (let v = 0; v <= y1 + 1e-9; v += 0.1) yt.push(+v.toFixed(1));
    const c = L.chart($('c-dist'), 0.58, { l: 46, b: 40 }), { ctx, m, pw, ph } = c;
    const X = (k) => m.l + ((k + 0.5) / (KM + 1)) * pw, Y = (v) => m.t + ph - (v / y1) * ph;
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => Math.round(v * 100) + '%', xTicks: d.map((_, i) => i), xFmt: (v) => (v === KM ? KM + '회 이상' : String(v)), xLabel: '한 해 걸린 횟수 (회)', yLabel: '걸린 횟수별 아이 비율 (%)' });
    const bw = pw / (KM + 1) * 0.7;
    d.forEach((v, k) => { ctx.fillStyle = mix(k === 0 ? COL.R : COL.I, 0.8); ctx.fillRect(X(k) - bw / 2, Y(v), bw, Y(0) - Y(v)); });
    const mean = sim.meanInf(); // 평균 위치
    const mxp = m.l + ((mean + 0.5) / (KM + 1)) * pw;
    ctx.strokeStyle = css('--text'); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(mxp, m.t); ctx.lineTo(mxp, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    L.legend(c, [{ kind: 'box', color: mix(COL.R, 0.8), label: '한 번도 안 걸린 아이' }, { kind: 'box', color: mix(COL.I, 0.8), label: '걸린 아이' }, { kind: 'dash', color: css('--text'), label: `평균 ${f1(mean)}회` }], mean > KM / 2 ? 'tl' : 'tr');
  }

  // ---------- ④, ⑤ 훑어 보기 ----------
  function sweepDraw(id, data, x0, x1, xt, xfmt, xlabel, cur, curLabel) {
    const hi = Math.max(1, ...data.map((d) => Math.max(...d.runs))), y1 = Math.ceil((hi + 0.3) / 4) * 4;
    L.dots($(id), { aspect: 0.6, data, x0, x1, y0: 0, y1, xTicks: xt, xFmt: xfmt, yFmt: (v) => (Number.isInteger(v) ? v + '회' : f1(v) + '회'), xLabel: xlabel, yLabel: '걸린 횟수 (회)', color: COL.I, marker: cur == null ? null : { x: cur, label: curLabel } });
  }
  const SPOINTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], ZPOINTS = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
  function drawStay() { sweepDraw('c-stay', sweepStay, 0, 100, [0, 20, 40, 60, 80, 100], (v) => v + '%', '아프면 쉬는 비율 (%)', Number($('stay').value), '지금 설정'); }
  function drawSize() { sweepDraw('c-size', sweepSize, 8, 30, [8, 12, 16, 20, 24, 28], (v) => v + '명', '반 크기 (명)', Number($('size').value), '지금 설정'); }

  function renderStats() {
    const P = sim.params, c = sim.counts(), mxc = (() => { let n = 0; for (let i = 0; i < sim.N; i++) if (sim.cnt[i] > n) n = sim.cnt[i]; return n; })();
    const wks = Math.max(1, Math.ceil(sim.day / 7));
    const cards = [
      ['아이 1명이 걸린 평균 횟수', `${f1(sim.meanInf())}회`, `${wks}주째까지 · 가장 많이 걸린 아이 ${mxc}회`],
      ['아프면 쉬기 0% → 70%', ref ? `${f1(ref.inf0)} → ${f1(ref.inf70)}회` : '계산 중…', '지금 설정에서 한 해 걸린 횟수 (여러 번 돌린 평균)'],
      ['아파서 집에서 쉰 날', `${f1(sim.meanAbs())}일`, '아이 1명당, 평일 기준'],
      ['가장 많이 아팠던 주', sim.day > 7 ? `${sim.peakWeek()}주째` : '아직 알 수 없음', '반 아이 중 아픈 아이가 가장 많았던 때'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRooms(); drawWeeks(); drawDist(); }

  function computeRef() {
    const P = params(), base = { size: P.size, contact: P.contact, hyg: P.hyg, imm: P.imm };
    const a = D.summarize(Object.assign({}, base, { stay: 0 }), 8), b = D.summarize(Object.assign({}, base, { stay: 0.7 }), 8);
    ref = { weekly: a.weekly, inf0: a.inf, inf70: b.inf, abs70: b.abs };
  }

  function sweep(list, pts, mk, redraw, next) {
    const out = []; if (list === 'stay') sweepStay = out; else sweepSize = out;
    L.jobs(pts.map((x) => () => {
      const runs = []; for (let s = 1; s <= 6; s++) runs.push(D.create(Object.assign(mk(x), { seed: s })).run().meanInf());
      out.push({ x, runs, mean: L.mean(runs) });
    }), redraw, () => { redraw(); if (next) next(); });
  }
  function after() {
    const P = params(), base = { size: P.size, contact: P.contact, hyg: P.hyg, imm: P.imm, stay: P.stay };
    computeRef(); renderStats(); drawWeeks();
    sweep('stay', SPOINTS, (x) => Object.assign({}, base, { stay: x / 100 }), drawStay, () => sweep('size', ZPOINTS, (x) => Object.assign({}, base, { size: x }), drawSize));
  }

  const h = L.harness({
    controls: ['size', 'contact', 'stay', 'hyg', 'imm'],
    format: { size: (v) => v + '명', contact: (v) => v + '단계', stay: (v) => v + '%', hyg: (v) => v + '%', imm: (v) => v + '일' },
    defaults: { size: 20, contact: 5, stay: 30, hyg: 0, imm: 30 },
    build() {
      sim = D.create(params());
      if (THUMB) { for (let k = 0; k < 9 && !sim.done(); k++) sim.advance(); }
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawStay(); drawSize(); }, seedLabel: '우리 반 번호',
  });
  seedGetter = h.seed;
})();
