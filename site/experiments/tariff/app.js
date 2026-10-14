(function () {
  'use strict';
  const TF = window.Tariff, L = window.Lab;
  const { css, mix, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 관세가 높이 올라간 장면으로 바로 간다
  const JUMP = +((location.search.match(/[?&]t=(\d+)/) || [])[1] || 0); // 확인용: ?t=라운드 (그 시점으로 바로 가서 멈춤)
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const CA = '#e07b39', CB = '#2f6fed', BASE = '#5b6475', BURDEN = '#c2410c';
  const NAME = ['A국', 'B국'];
  const pc = (v) => Math.round(v * 100) + '%';
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  let sim = null, seedGetter = () => 1, rows = [];
  const params = () => ({
    seed: seedGetter(), retal: Number($('retal').value) / 100, patience: Number($('patience').value),
    pressure: Number($('pressure').value) / 100, talk: Number($('talk').value) / 100,
  });

  // ---------- ① 두 나라와 무역선 ----------
  function personPath(ctx, x, y, h) {   // 사람 픽토그램: 머리 + 어깨/몸통 (발 끝이 y)
    const r = h * 0.22, bw = h * 0.62;
    ctx.beginPath(); ctx.arc(x, y - h + r, r, 0, 7);
    ctx.moveTo(x - bw / 2, y); ctx.lineTo(x - bw / 2, y - h * 0.34); ctx.quadraticCurveTo(x - bw / 2, y - h * 0.58, x, y - h * 0.58);
    ctx.quadraticCurveTo(x + bw / 2, y - h * 0.58, x + bw / 2, y - h * 0.34); ctx.lineTo(x + bw / 2, y); ctx.closePath();
  }
  function chip(ctx, text, x, y, cx, cy, color, big, w) {   // 이름표: 글상자(cx,cy = 상자 가운데) + 대상(x,y)까지 곧게 이어진 선
    ctx.font = (big ? '700 15px ' : '600 12px ') + FONT;
    const tw = ctx.measureText(tr(text)).width + (big ? 20 : 16), th = big ? 28 : 22;
    let bx = Math.max(4, Math.min(cx - tw / 2, w - tw - 4)); const by = cy - th / 2;
    const ax = Math.min(Math.max(x, bx + 10), bx + tw - 10), ay = y < by ? by : by + th;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
    ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; roundRect(ctx, bx, by, tw, th, th / 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = color; roundRect(ctx, bx, by, tw, th, th / 2); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, bx + (big ? 10 : 8), by + (big ? 19 : 15)); ctx.lineWidth = 1;
  }
  const EVT = { first: '먼저 올림', shock: '국내 사정으로 올림', retal: '보복으로 올림', down: '협상 끝에 내림', blocked: '내리려다 국내 반대로 막힘' };
  function drawScene(now) {
    const cv = $('c-scene'), cw = cv.clientWidth || 600, narrow = cw < 560;
    const { ctx, w, h } = L.setup(cv, THUMB ? 1 : narrow ? 1.08 : 0.5);
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const t = sim.t, P = sim.params;
    const top = THUMB ? 0.1 * h : narrow ? 66 : 58, bot = THUMB ? 0.9 * h : h - (narrow ? 70 : 46);   // 휴대폰: 아래쪽은 재생 막대가 덮으므로 비워 둔다
    const bw = THUMB ? w * 0.3 : narrow ? w * 0.27 : w * 0.2, bh = bot - top, gap = narrow ? 6 : 16;
    const boxX = [gap, w - gap - bw];
    // 무역선: 위 = A국 → B국 수출(B국 관세가 막음), 아래 = B국 → A국 수출(A국 관세가 막음)
    const laneY = narrow ? [top + bh * 0.22, top + bh * 0.8] : [top + bh * 0.3, top + bh * 0.7], lx0 = boxX[0] + bw, lx1 = boxX[1];
    for (let k = 0; k < 2; k++) {
      const vol = TF.volume(k === 0 ? t[1] : t[0]), col = k === 0 ? CA : CB, y = laneY[k];
      const thick = THUMB ? 6 + vol * 40 : 3 + vol * (narrow ? 22 : 30);
      ctx.fillStyle = mix(col, 0.16); roundRect(ctx, lx0, y - thick / 2, lx1 - lx0, thick, thick / 2); ctx.fill();
      // 화물 상자: 거래량이 많을수록 촘촘히
      const sz = THUMB ? 18 : narrow ? 9 : 12, spacing = (THUMB ? 40 : narrow ? 22 : 30) / Math.max(0.12, vol), len = lx1 - lx0, speed = 40;
      const ph = THUMB ? 0.37 : ((now || 0) / 1000) * speed;
      for (let d = (ph % spacing); d < len; d += spacing) {
        const x = k === 0 ? lx0 + d : lx1 - d;
        ctx.fillStyle = col; roundRect(ctx, x - sz / 2, y - sz / 2, sz, sz, 2); ctx.fill();
      }
      // 화살표 끝
      ctx.fillStyle = col; ctx.beginPath();
      if (k === 0) { ctx.moveTo(lx1 - 2, y); ctx.lineTo(lx1 - 12, y - 7); ctx.lineTo(lx1 - 12, y + 7); }
      else { ctx.moveTo(lx0 + 2, y); ctx.lineTo(lx0 + 12, y - 7); ctx.lineTo(lx0 + 12, y + 7); }
      ctx.fill();
      if (!THUMB) {
        ctx.font = (narrow ? '11px ' : '12px ') + FONT; ctx.fillStyle = col; ctx.textAlign = 'center';
        ctx.fillText(narrow ? `수출 ${Math.round(vol * 100)}%` : `${NAME[k]} → ${NAME[1 - k]} 수출 ${Math.round(vol * 100)}%`, (lx0 + lx1) / 2, k === 0 ? y - thick / 2 - 8 : y + thick / 2 + 16);
      }
    }
    // 두 나라
    const pr = sim.parts(), g = sim.gainNow();
    for (let i = 0; i < 2; i++) {
      const x0 = boxX[i], col = i ? CB : CA;
      ctx.fillStyle = mix(col, 0.1); roundRect(ctx, x0, top, bw, bh, 18); ctx.fill();
      ctx.strokeStyle = mix(col, 0.5); ctx.lineWidth = 2; roundRect(ctx, x0, top, bw, bh, 18); ctx.stroke(); ctx.lineWidth = 1;
      let fs = THUMB ? 30 : narrow ? 15 : 17; ctx.font = '700 ' + fs + 'px ' + FONT;
      while (fs > 10 && ctx.measureText(tr(NAME[i])).width > bw - 12) { fs--; ctx.font = '700 ' + fs + 'px ' + FONT; }   // 영어 이름이 상자보다 길면 줄인다
      ctx.fillStyle = col; ctx.textAlign = 'center';
      ctx.fillText(NAME[i], x0 + bw / 2, top + (THUMB ? 40 : 24));
      // 사람(소비자·기업) 6명: 부담이 클수록 고개 숙인 듯 작아지고 연해진다
      const burden = pr[i].burden, ppl = 6, cols = 3, cellW = bw / (cols + 1);
      const hp = Math.min(cellW * (THUMB ? 1.5 : 1.25), bh * 0.2) * (1 - burden * 0.7);
      for (let q = 0; q < ppl; q++) {
        const px = x0 + cellW * (1 + (q % cols)), py = top + bh * (q < cols ? 0.47 : 0.68);
        personPath(ctx, px, py, hp); ctx.fillStyle = mix(col, 0.85 - burden * 0.9); ctx.fill();
      }
      // 소비자·기업 부담 막대 (관세 50%일 때 가득)
      const by = top + bh * 0.78, bwid = bw - 24, bH = narrow ? 10 : 12;
      ctx.fillStyle = 'rgba(99,106,122,.15)'; roundRect(ctx, x0 + 12, by, bwid, bH, 4); ctx.fill();
      ctx.fillStyle = BURDEN; if (burden > 0) { roundRect(ctx, x0 + 12, by, Math.max(4, bwid * (burden / (TF.DEFAULTS.cap * 1.0))), bH, 4); ctx.fill(); }
      if (!THUMB) {
        ctx.fillStyle = css('--text'); ctx.font = (narrow ? '10.5px ' : '11.5px ') + FONT; ctx.textAlign = 'center';
        ctx.fillText(narrow || tr('부담') !== '부담' ? '부담' : '소비자·기업 부담', x0 + bw / 2, by - 5);   // 영어 등은 상자에 맞게 짧게
        ctx.font = '600 ' + (narrow ? 11 : 12) + 'px ' + FONT; ctx.fillStyle = g[i] >= 1 ? '#15803d' : '#b91c1c';
        ctx.fillText(narrow ? `이득 ${g[i].toFixed(2)}` : `이번 분기 ${g[i].toFixed(2)}`, x0 + bw / 2, by + bH + 16);
      }
    }
    // 관세율 이름표: 각 나라가 들어오는 수입품에 붙이는 관문(무역선이 나라에 닿는 곳)
    const gate = [[lx0, laneY[1]], [lx1, laneY[0]]];
    for (let i = 0; i < 2; i++) {
      const col = i ? CB : CA, [gx, gy] = gate[i];
      ctx.fillStyle = col; ctx.fillRect(gx - 3, gy - 18, 6, 36);
      if (THUMB) { ctx.font = '800 34px ' + FONT; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(pc(t[i]), i ? lx1 - 50 : lx0 + 50, i ? gy - 34 : gy + 56); continue; }
      // 휴대폰에서는 두 이름표 모두 위쪽에 (아래는 재생 막대 자리)
      const cxx = narrow ? (i ? w * 0.75 : w * 0.25) : (i ? lx1 - 70 : lx0 + 70);
      chip(ctx, narrow ? `관세 ${pc(t[i])}` : `${NAME[i]} 관세 ${pc(t[i])}`, gx, gy, cxx, narrow ? top - 34 : i ? top - 28 : bot + 26, col, true, w);
    }
    // 이번 라운드에 일어난 일
    if (!THUMB) {
      const evs = sim.events.filter((e) => e.round === sim.round && e.kind !== 'first');
      const first = sim.events.find((e) => e.round === sim.round && e.kind === 'first');
      const msgs = [];
      if (first) msgs.push([0, `${NAME[0]}이 먼저 관세를 ${pc(first.to)}로 올림`]);
      evs.forEach((e) => msgs.push([e.who, e.kind === 'blocked' ? `${NAME[e.who]}: 내리려다 국내 반대로 막힘` : `${NAME[e.who]}: ${EVT[e.kind]} ${pc(e.from)} → ${pc(e.to)}`]));
      if (sim.talkAt[sim.round]) msgs.push([-1, '협상 테이블이 열림']);
      ctx.font = (narrow ? '11.5px ' : '12.5px ') + FONT; ctx.textAlign = 'center';
      const mid = (lx0 + lx1) / 2, my0 = top + bh * 0.5 - (msgs.length - 1) * 9;
      msgs.slice(0, 3).forEach(([who, s], k) => {
        const tx = tr(s), tw = Math.min(w - 12, ctx.measureText(tx).width + 14), y = my0 + k * 18;
        ctx.fillStyle = 'rgba(255,255,255,.92)'; roundRect(ctx, mid - tw / 2, y - 12, tw, 17, 8); ctx.fill();
        ctx.fillStyle = who < 0 ? '#15803d' : who ? CB : CA; ctx.fillText(s, mid, y);
      });
    }
  }
  let raf = 0;
  function loop(ts) { drawScene(ts); raf = requestAnimationFrame(loop); }

  // 선 끝 숫자 이름표: 서로 겹치지 않게 위아래로 벌려 쓴다 (y = 글자 가운데 높이)
  function endLabels(c, x, list) {
    const { ctx, m, pw, ph } = c, GAP = 16;
    list.sort((a, b) => a.y - b.y);
    for (let k = 1; k < list.length; k++) if (list[k].y - list[k - 1].y < GAP) list[k].y = list[k - 1].y + GAP;
    const over = list[list.length - 1].y - (m.t + ph - 6); if (over > 0) list.forEach((l) => { l.y -= over; });
    if (list[0].y < m.t + 6) { const d = m.t + 6 - list[0].y; list.forEach((l) => { l.y += d; }); }
    const right = x > m.l + pw * 0.85;
    ctx.font = '700 13px ' + FONT; ctx.textAlign = right ? 'right' : 'left';
    list.forEach((l) => { ctx.fillStyle = l.color; L.label(ctx, l.text, x + (right ? -9 : 9), l.y + 5); });
    ctx.font = '12px ' + FONT;
  }

  // ---------- ② 관세율 (재생 시점까지) ----------
  const R = () => sim.params.rounds;
  function drawTariff() {
    const cv = $('c-tariff'), items = [{ kind: 'line', color: CA, label: 'A국 관세 (먼저 올린 나라)' }, { kind: 'line', color: CB, label: 'B국 관세' }, { kind: 'box', color: 'rgba(21,128,61,.25)', label: '갈등이 끝난 구간 (두 나라 모두 10% 이하)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.5 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40 }), { ctx, m, pw, ph } = c;
    const X = (r) => m.l + (r / R()) * pw, Y = (v) => m.t + ph - (v / 0.5) * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], yFmt: (v) => String(Math.round(v * 100)), xTicks: [0, 20, 40, 60, 80, 100], xLabel: '라운드 (분기)', yLabel: '관세율 (%)' });
    ctx.fillStyle = 'rgba(21,128,61,.08)'; ctx.fillRect(m.l, Y(0.1), pw, Y(0) - Y(0.1));
    const st = (a, dy) => a.map((v, r) => [X(r), Y(v) + dy]);
    L.line(ctx, st(sim.tB, 1.5), CB, 2.5); L.line(ctx, st(sim.tA, -1.5), CA, 2.5);
    const r = sim.round;
    [[sim.tA[r], CA], [sim.tB[r], CB]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(r), Y(v), 4, 0, 7); ctx.fill(); });
    endLabels(c, X(r), [{ y: Y(sim.tA[r]) - 8, text: pc(sim.tA[r]), color: CA }, { y: Y(sim.tB[r]) + 8, text: pc(sim.tB[r]), color: CB }]);
    ctx.font = '12px ' + FONT; L.drawLegendBelow(c, items);
  }

  // ---------- ③ 누적 이득 (재생 시점까지, 기준선도) ----------
  function drawGain() {
    const cv = $('c-gain'), items = [{ kind: 'line', color: CA, label: 'A국' }, { kind: 'line', color: CB, label: 'B국' }, { kind: 'dash', color: BASE, label: '서로 안 올렸다면 (한 나라)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.5 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40 }), { ctx, m, pw, ph } = c;
    const top = R() * 1.12, X = (r) => m.l + (r / R()) * pw, Y = (v) => m.t + ph - (Math.max(0, v) / top) * ph;
    L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], xTicks: [0, 20, 40, 60, 80, 100], xLabel: '라운드 (분기)', yLabel: '쌓인 이득 (점)' });
    ctx.setLineDash([5, 4]); L.line(ctx, sim.base.map((v, r) => [X(r), Y(v)]), BASE, 2); ctx.setLineDash([]);
    L.line(ctx, sim.cumB.map((v, r) => [X(r), Y(v)]), CB, 2.5); L.line(ctx, sim.cumA.map((v, r) => [X(r), Y(v)]), CA, 2.5);
    const r = sim.round;
    if (r > 0) {
      [[sim.cumA[r], CA], [sim.cumB[r], CB]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(r), Y(v), 4, 0, 7); ctx.fill(); });
      const hiA = sim.cumA[r] >= sim.cumB[r];
      endLabels(c, X(r), [{ y: Y(r) - 8, text: String(r), color: BASE }, { y: Y(sim.cumA[r]) + (hiA ? 4 : 10), text: sim.cumA[r].toFixed(0), color: CA }, { y: Y(sim.cumB[r]) + (hiA ? 10 : 4), text: sim.cumB[r].toFixed(0), color: CB }]);
    }
    ctx.font = '12px ' + FONT; L.drawLegendBelow(c, items);
  }

  // ---------- ④ 보복 정도별 100판 (집계) ----------
  const RETALS = [0, 25, 50, 75, 100, 125, 150];
  function drawSweep() {
    const cv = $('c-sweep'), P = params();
    const items = [{ kind: 'line', color: '#15803d', label: '두 나라 합계 이득 (서로 안 올렸을 때 = 100)' }, { kind: 'line', color: '#7c3aed', label: '갈등이 끝난 판 (%)' }, { kind: 'line', color: BURDEN, label: '평균 관세율 (%)' }];
    const sp = L.belowSpace(cv, items), c = L.chart(cv, 0.5 + sp.extra / (cv.clientWidth || 400), { b: sp.b, l: 40 }), { ctx, m, pw, ph } = c;
    const X = (v) => m.l + (v / 150) * pw, Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => String(Math.round(v * 100)), xTicks: RETALS, xFmt: (v) => String(v), xLabel: '보복하는 정도 (%)', yLabel: '100판 평균 (%)' });
    const ser = [['total', '#15803d'], ['ended', '#7c3aed'], ['tariff', BURDEN]];
    ser.forEach(([k, col]) => {
      const pts = rows.map((d) => [X(d.x), Y(d[k])]); L.line(ctx, pts, col, 2.5);
      ctx.fillStyle = col; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill(); });
    });
    L.vline(c, X(P.retal * 100), css('--rich'), '지금 설정', P.retal * 100 > 75 ? 'right' : 'left');
    L.drawLegendBelow(c, items);
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const r = sim.round, t = sim.t, tot = sim.total(), diff = r >= 4 ? (tot - 2 * r) / (2 * r) : null;
    const fd = sim.firstDown;
    const cards = [
      ['지금 관세율 (A국 / B국)', `${pc(t[0])} / ${pc(t[1])}`, sim.done ? `끝 · ${r}라운드(분기)` : `${r}라운드째 · 진행 중`],
      ['두 나라 합계 이득', diff == null ? '' : (diff >= 0 ? '+' : '−') + Math.abs(Math.round(diff * 100)) + '%', '서로 안 올렸을 때와 비교'],
      ['쌓인 이득 (A국 / B국)', `${sim.cum[0].toFixed(0)} / ${sim.cum[1].toFixed(0)}`, `서로 안 올렸다면 각각 ${r}`],
      ['먼저 관세를 내린 나라', fd < 0 ? '아직 없음' : NAME[fd], fd < 0 ? `협상 ${sim.talks}번 열림` : `${sim.firstDownRound}라운드 · 협상 ${sim.talks}번 열림`],
    ];
    $('stats').classList.toggle('live', !sim.done);
    $('stats').innerHTML = cards.map(([k, v, s], i) => `<div class="stat"><div class="k"${i === 1 ? ' style="color:#15803d"' : ''}>${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawTariff(); drawGain(); if (THUMB || !raf) drawScene(performance.now()); }

  function after() {
    const P = params(); rows = []; drawSweep();
    $('note-s').textContent = '계산 중…';
    const jobs = RETALS.map((x) => () => {
      const o = TF.sweep(Object.assign({}, P, { retal: x / 100, seed: 1 }), 100);
      rows.push({ x, total: L.mean(o.total), ended: o.ended, tariff: L.mean(o.tariff) });
    });
    L.jobs(jobs, drawSweep, () => {
      const a = rows[0], b = rows[rows.length - 1];
      $('note-s').textContent = `지금 설정에서 보복 0%면 합계 ${Math.round(a.total * 100)}, 150%면 ${Math.round(b.total * 100)} (서로 안 올렸을 때 = 100)`;
    });
  }

  const h = L.harness({
    controls: ['retal', 'patience', 'pressure', 'talk'],
    format: { retal: (v) => v + '%', patience: (v) => v + '회', pressure: (v) => v + '%', talk: (v) => v + '%' },
    defaults: { retal: 100, patience: 3, pressure: 30, talk: 25 },
    build() {
      sim = TF.create(params());
      if (THUMB) for (let k = 0; k < 60 && sim.advance(); k++); else if (JUMP) for (let k = 0; k < JUMP && sim.advance(); k++);
    },
    autoplay: !THUMB && !JUMP, speedScale: 0.6,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawSweep(); }, seedLabel: '무역 갈등',
  });
  seedGetter = h.seed;
  if (!THUMB) raf = requestAnimationFrame(loop);
})();
