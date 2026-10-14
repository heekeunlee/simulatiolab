(function () {
  'use strict';
  const M = window.MereExposure, L = window.Lab;
  const { css, mix, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const BLUE = '#2f6fed', GRAY = '#8a93a6', INK = '#1d2433', PINK = '#d6336c', GOLD = '#d19200';
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 60번째 들었을 때(좋아하는 사람과 질린 사람이 섞인 모습)로 바로 간다
  const THUMB_K = 60;
  let sim = null, seedGetter = () => 1, king = null, sweep = null, sweepKey = '';
  const params = () => ({ seed: seedGetter(), c: Number($('c').value) / 100, rate: Number($('rate').value), gap: Number($('gap').value) });
  const r0 = (v) => Math.round(v);
  const sg = (v) => (Math.round(v) < 0 ? '-' : '') + Math.abs(Math.round(v)); // 음수 기호는 번역 규칙이 읽을 수 있게 '-'
  const cLabel = (v) => (v < 25 ? '단순한 곡' : v < 60 ? '보통인 곡' : '복잡한 곡');

  // ---------- 사람 픽토그램 (talent-vs-luck과 같은 모양: 머리 + 어깨/몸통, 발 끝이 y) ----------
  function personPath(ctx, x, y, h) {
    const r = h * 0.22, bw = h * 0.62;
    ctx.beginPath(); ctx.arc(x, y - h + r, r, 0, 7);
    ctx.moveTo(x - bw / 2, y); ctx.lineTo(x - bw / 2, y - h * 0.34); ctx.quadraticCurveTo(x - bw / 2, y - h * 0.58, x, y - h * 0.58);
    ctx.quadraticCurveTo(x + bw / 2, y - h * 0.58, x + bw / 2, y - h * 0.34); ctx.lineTo(x + bw / 2, y); ctx.closePath();
  }
  function chipLayout(ctx, text, x, y, w, up) {
    ctx.font = '600 12px ' + FONT;
    const tw = ctx.measureText(text).width + 16, th = 22;
    let cx = x + 12, cy = up ? y - 34 : y + 12;
    if (cx + tw > w - 6) cx = x - 12 - tw;
    cx = Math.max(6, cx);
    if (cy < 6) cy = y + 12;
    return { cx, cy, tw, th };
  }
  function mark(ctx, text, x, y, color, w, up) { // 글상자 가장 가까운 가장자리에서 그 사람까지 곧은 선
    const Lc = chipLayout(ctx, text, x, y, w, up);
    const tx = Math.min(Math.max(x, Lc.cx + 12), Lc.cx + Lc.tw - 12), ty = (Lc.cy + Lc.th / 2 < y) ? Lc.cy + Lc.th : Lc.cy;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; roundRect(ctx, Lc.cx, Lc.cy, Lc.tw, Lc.th, 11); ctx.fill(); ctx.restore();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; roundRect(ctx, Lc.cx, Lc.cy, Lc.tw, Lc.th, 11); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, Lc.cx + 8, Lc.cy + 15); ctx.lineWidth = 1;
  }

  // 사람 자리: 레코드판을 둘러싼 동심원 세 줄 (20 + 32 + 48 = 100명)
  const RINGS = [20, 32, 48];
  function seats(n) {
    const out = []; let i = 0;
    RINGS.forEach((cnt, r) => { for (let j = 0; j < cnt && i < n; j++, i++) out.push({ ring: r, ang: (j + (r % 2 ? 0.5 : 0)) / cnt * Math.PI * 2 - Math.PI / 2 }); });
    return out;
  }

  // ---------- ① 레코드판과 듣는 사람 100명 ----------
  function drawRing() {
    const cw = $('c-ring').clientWidth || 600, mobile = cw < 560, asp = THUMB ? 1 : mobile ? 1.22 : 0.72;
    const c = L.chart($('c-ring'), asp, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const top = THUMB ? 0 : mobile ? 40 : 34, bot = THUMB ? 0 : mobile ? 44 : 30, cx = w / 2, cy = top + (h - top - bot) / 2, R = Math.min(w, h - top - bot) / 2 - (THUMB ? 8 : 10);
    const k = sim.k, P = sim.params;
    // 레코드판: 듣는 횟수만큼 돈다
    const rec = R * 0.34, rot = k * 0.9;
    ctx.fillStyle = '#20232b'; ctx.beginPath(); ctx.arc(cx, cy, rec, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    for (let g = rec * 0.45; g < rec - 2; g += Math.max(2.5, rec / 22)) { ctx.beginPath(); ctx.arc(cx, cy, g, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, rec * 0.8, rot, rot + 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rec * 0.66, rot + Math.PI, rot + Math.PI + 0.7); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(cx, cy, rec * 0.4, 0, 7); ctx.fill();
    if (!THUMB) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = '700 ' + Math.round(rec * 0.3) + 'px ' + FONT; ctx.fillText(String(k), cx, cy + rec * 0.05);
      ctx.font = '600 ' + Math.max(10, Math.round(rec * 0.12)) + 'px ' + FONT; ctx.fillText('번째', cx, cy + rec * 0.24);
    } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, rec * 0.07, 0, 7); ctx.fill(); }

    // 사람: 호감이 높을수록 크고 진한 파랑, 듣기 전보다 싫어졌으면(호감 0 아래) 작은 회색
    const S = seats(sim.n), ringR = [R * 0.52, R * 0.72, R * 0.92], hMax = Math.min(R * (mobile ? 0.13 : 0.12), THUMB ? 40 : 30), pos = [];
    for (let i = 0; i < sim.n; i++) {
      const s = S[i], rr = ringR[s.ring], x = cx + rr * Math.cos(s.ang), y = cy + rr * Math.sin(s.ang), v = sim.like[i];
      const q = Math.max(0, Math.min(1, v / 100)), hh = v > 0 ? hMax * (0.45 + 0.55 * q) : hMax * 0.38;
      const col = v > 0 ? mix(BLUE, 0.3 + 0.7 * q) : mix(GRAY, k === 0 ? 0.45 : Math.min(0.85, 0.4 + Math.min(1, -v / 100) * 0.45));
      personPath(ctx, x, y + hh / 2, hh); ctx.fillStyle = col; ctx.fill();
      pos.push([x, y]);
    }
    if (THUMB) return;
    // 지금 이 순간 가장 좋아하는 사람 / 가장 질린 사람: 격차가 40점 넘게 벌어진 뒤에 붙는다
    let mx = 0, mn = 0;
    for (let i = 1; i < sim.n; i++) { if (sim.like[i] > sim.like[mx]) mx = i; if (sim.like[i] < sim.like[mn]) mn = i; }
    if (!king) king = { hi: mx, lo: mn };
    if (sim.like[mx] > sim.like[king.hi] + 0.5) king.hi = mx;
    if (sim.like[mn] < sim.like[king.lo] - 0.5) king.lo = mn;
    if (k > 0 && sim.like[king.hi] - sim.like[king.lo] > 40) {
      const [hx, hy] = pos[king.hi], [lx, ly] = pos[king.lo];
      mark(ctx, `가장 좋아하는 사람 · ${sg(sim.like[king.hi])}점`, hx, hy, BLUE, w, hy < cy || hy > h - bot - 40);
      mark(ctx, `가장 질린 사람 · ${sg(sim.like[king.lo])}점`, lx, ly, INK, w, ly < cy || ly > h - bot - 40);
    }
    ctx.font = '600 13px ' + FONT; ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
    ctx.fillText(`${k}번째 듣는 중 · 평균 호감 ${sg(sim.mean[k])}점`, 12, 20);
    ctx.font = '11.5px ' + FONT; ctx.fillStyle = css('--muted');
    if (mobile) ctx.fillText('크고 진한 파랑 = 좋아함 · 작은 회색 = 듣기 전보다 싫어짐', 12, 36);
    else { ctx.textAlign = 'right'; ctx.fillText('크고 진한 파랑 = 좋아함 · 작은 회색 = 듣기 전보다 싫어짐', w - 12, 20); }
    $('when').textContent = `${k}/${P.listens}번째 · ${P.gap === 1 ? '매일' : P.gap + '일마다'} 한 번`;
  }

  // ---------- ② 듣는 횟수에 따른 호감 (재생 시점까지) ----------
  const YMIN = -100, YMAX = 100;
  function listenChart(id, yLabel, legendItems) {
    const el = $(id), sp = L.belowSpace(el, legendItems), cw = el.clientWidth || 400, asp0 = cw < 560 ? 0.85 : 0.58;
    const c = L.chart(el, asp0 + sp.extra / cw, { l: 46, b: sp.b, r: 14 }), { m, pw, ph } = c, K = sim.params.listens;
    const X = (k) => m.l + (k / K) * pw, Y = (v) => m.t + ph - ((Math.max(YMIN, Math.min(YMAX, v)) - YMIN) / (YMAX - YMIN)) * ph;
    const xt = []; for (let k = 0; k <= K; k += 20) xt.push(k);
    L.axes(c, { X, Y, yTicks: [-100, -50, 0, 50, 100], yFmt: (v) => String(v), xTicks: xt, xFmt: (v) => String(v), xLabel: '듣는 횟수 (번째)', yLabel });
    return { c, X, Y };
  }
  function drawCurve() {
    const items = [{ kind: 'line', color: mix(GRAY, 0.5), label: '한 사람의 호감' }, { kind: 'line', color: BLUE, label: '100명 평균' }];
    const { c, X, Y } = listenChart('c-curve', '호감 (점)', items), { ctx, m, pw } = c, k = sim.k;
    ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(m.l + pw, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < sim.n; i++) {
      ctx.strokeStyle = mix(GRAY, 0.16); ctx.lineWidth = 1; ctx.beginPath();
      for (let j = 0; j <= k; j++) { const x = X(j), y = Y(sim.hist[j][i]); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    L.line(ctx, sim.mean.slice(0, k + 1).map((v, j) => [X(j), Y(v)]), BLUE, 3);
    if (k > 0) { ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(X(k), Y(sim.mean[k]), 4.5, 0, 7); ctx.fill(); }
    const pk = sim.peak();
    if (k > 0 && pk.at < k && sim.mean[k] < pk.value - 3) { // 꼭대기를 지나 내려오기 시작한 뒤에만 표시
      ctx.fillStyle = GOLD; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(pk.at), Y(pk.value), 6, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
      ctx.font = '600 12px ' + FONT; ctx.fillStyle = GOLD; const right = X(pk.at) > m.l + pw * 0.7;
      ctx.textAlign = right ? 'right' : 'left'; L.label(ctx, `가장 좋았던 때: ${pk.at}번째`, X(pk.at) + (right ? -9 : 9), Y(pk.value) - 9, right ? 'right' : 'left');
    }
    L.drawLegendBelow(c, items);
  }

  // ---------- ③ 지금 호감의 분포 (100명, 재생 시점) ----------
  function drawHist() {
    const el = $('c-hist'), items = [{ kind: 'box', color: BLUE, label: '좋아함 (0점 위)' }, { kind: 'box', color: GRAY, label: '듣기 전보다 싫어짐 (0점 아래)' }];
    const sp = L.belowSpace(el, items), cw = el.clientWidth || 400, asp0 = cw < 560 ? 0.85 : 0.58;
    const c = L.chart(el, asp0 + sp.extra / cw, { l: 46, b: sp.b, r: 14 }), { ctx, m, pw, ph } = c;
    const lo = -150, hi = 100, bw = 10, nb = (hi - lo) / bw, cnt = new Array(nb).fill(0);
    for (let i = 0; i < sim.n; i++) { const b = Math.max(0, Math.min(nb - 1, Math.floor((sim.like[i] - lo) / bw))); cnt[b]++; }
    const ymax = 50, X = (v) => m.l + ((v - lo) / (hi - lo)) * pw, Y = (v) => m.t + ph - (Math.min(v, ymax) / ymax) * ph;
    L.axes(c, { X, Y, yTicks: [0, 10, 20, 30, 40, 50], yFmt: (v) => String(v), xTicks: [-150, -100, -50, 0, 50, 100], xFmt: (v) => String(v), xLabel: '지금 호감 (점)', yLabel: '사람 수 (명)' });
    for (let b = 0; b < nb; b++) {
      if (!cnt[b]) continue; const x0 = X(lo + b * bw), x1 = X(lo + (b + 1) * bw);
      ctx.fillStyle = lo + b * bw >= 0 ? BLUE : GRAY; ctx.fillRect(x0 + 1, Y(cnt[b]), x1 - x0 - 2, Y(0) - Y(cnt[b]));
    }
    ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(X(0), m.t); ctx.lineTo(X(0), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    L.drawLegendBelow(c, items);
  }

  // ---------- ④⑤ 곡의 복잡도별 비교 (집계: 같은 설정으로 끝까지 돌린 결과, 시드 3개 평균) ----------
  const CS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], GAPS = [1, 3, 7];
  function ensureSweep() {
    const P = sim.params, key = [P.rate, P.gap].join('|');
    if (sweepKey === key && sweep) return; sweepKey = key;
    sweep = {
      peak: CS.map((cc) => M.summary({ c: cc, rate: P.rate, gap: P.gap }, [1, 2, 3])),
      fin: GAPS.map((g) => CS.map((cc) => M.summary({ c: cc, rate: P.rate, gap: g }, [1, 2, 3]).final)),
    };
  }
  function drawPeakSweep() {
    ensureSweep();
    const el = $('c-peak'), cw = el.clientWidth || 400, c = L.chart(el, cw < 560 ? 0.85 : 0.6, { l: 46, b: 40, r: 14 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v + 0.05) / 1.1 * pw, Y = (v) => m.t + ph - (v / 100) * ph, cur = sim.params.c;
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], yFmt: (v) => String(v), xTicks: [0, 0.5, 1], xFmt: (v) => (v === 0 ? '단순' : v === 1 ? '복잡' : '중간'), xLabel: '곡의 복잡도', yLabel: '가장 좋아한 때 (번째)' });
    const bw = pw / 1.1 * 0.1 * 0.7;
    CS.forEach((cc, i) => {
      const v = sweep.peak[i].peakAt, on = Math.abs(cc - cur) < 0.051;
      ctx.fillStyle = on ? BLUE : mix(BLUE, 0.35); ctx.fillRect(X(cc) - bw / 2, Y(v), bw, Y(0) - Y(v));
      ctx.fillStyle = on ? BLUE : css('--muted'); ctx.font = (on ? '700 ' : '') + (cw < 560 ? '10px ' : '11px ') + FONT; ctx.textAlign = 'center';
      ctx.fillText(String(r0(v)), X(cc), Y(v) - 5);
    });
  }
  function drawFinalSweep() {
    ensureSweep();
    const items = GAPS.map((g, j) => ({ kind: 'line', color: [GRAY, mix(BLUE, 0.55), BLUE][j], label: g === 1 ? '매일 들을 때' : `${g}일마다 들을 때` }));
    const el = $('c-final'), sp = L.belowSpace(el, items), cw = el.clientWidth || 400, asp0 = cw < 560 ? 0.85 : 0.6;
    const c = L.chart(el, asp0 + sp.extra / cw, { l: 46, b: sp.b, r: 30 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + v * pw, Y = (v) => m.t + ph - ((Math.max(-100, Math.min(100, v)) + 100) / 200) * ph;
    L.axes(c, { X, Y, yTicks: [-100, -50, 0, 50, 100], yFmt: (v) => String(v), xTicks: [0, 0.5, 1], xFmt: (v) => (v === 0 ? '단순' : v === 1 ? '복잡' : '중간'), xLabel: '곡의 복잡도', yLabel: '100번째 들었을 때 평균 호감 (점)' });
    ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(0)); ctx.lineTo(m.l + pw, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    GAPS.forEach((g, j) => {
      const col = items[j].color, pts = CS.map((cc, i) => [X(cc), Y(sweep.fin[j][i])]);
      L.line(ctx, pts, col, g === sim.params.gap ? 3.4 : 2.2); ctx.fillStyle = col; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); });
    });
    const cur = sim.params.c; L.vline(c, X(cur), css('--rich'), '지금 설정', cur > 0.5 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }

  // ---------- 숫자 카드 (재생 중에는 지금까지의 값, 흐리게) ----------
  function renderStats() {
    const k = sim.k, pk = sim.peak(), done = sim.done();
    let neg = 0; for (let i = 0; i < sim.n; i++) if (sim.like[i] < 0) neg++;
    const at = Array.from(sim.bestAt).sort((a, b) => a - b), early = at[Math.floor(sim.n * 0.1)], late = at[Math.floor(sim.n * 0.9)];
    const rising = k > 0 && pk.at === k;
    const cards = [
      ['가장 좋아한 때 (100명 평균)', k > 0 ? `${pk.at}번째` : '', k === 0 ? '' : rising ? `아직 오르는 중 · 평균 호감 ${sg(pk.value)}점` : `그때 평균 호감 ${sg(pk.value)}점`],
      ['지금 평균 호감', k > 0 ? `${sg(sim.mean[k])}점` : '', k > 0 ? `${k}번째 · 가장 좋을 때보다 ${sg(sim.mean[k] - pk.value)}점` : ''],
      ['듣기 전보다 싫어진 사람', k > 0 ? `${neg}명` : '', '100명 중, 호감이 0점 아래'],
      ['사람마다 가장 좋아한 때', k > 0 ? (early === late ? `${early}번째` : `${early}~${late}번째`) : '', '빨리 질리는 10% ~ 늦게 질리는 10%'],
    ];
    $('stats').style.opacity = done || THUMB ? '' : '0.55';
    $('stats').innerHTML = cards.map(([kk, v, s]) => `<div class="stat"><div class="k">${kk}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawRing(); drawCurve(); drawHist(); }
  function after() { drawPeakSweep(); drawFinalSweep(); }

  const h = L.harness({
    controls: ['c', 'rate', 'gap'],
    format: {
      c: (v) => `${cLabel(Number(v))} (${v})`,
      rate: (v) => `보통의 ${Number(v).toFixed(1)}배`,
      gap: (v) => (Number(v) === 1 ? '매일' : `${v}일마다`),
    },
    defaults: { c: 30, rate: 1, gap: 1 },
    build() {
      sim = M.create(params()); king = null;
      if (THUMB) for (let j = 0; j < THUMB_K && !sim.done(); j++) sim.advance();
    },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra: after, seedLabel: '청중',
  });
  seedGetter = h.seed;
})();
