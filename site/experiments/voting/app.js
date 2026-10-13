(function () {
  'use strict';
  const VT = window.Voting, L = window.Lab;
  const { css, mix, pct, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 지도를 정사각형으로
  const COL = ['#3b82f6', '#e5484d', '#1fa463', '#f59e42', '#7c5cff', '#0ea5a5'];
  const RCOL = { plurality: '#e5484d', runoff: '#f59e42', irv: '#2f6fed', borda: '#1fa463' };
  const RNAME = { plurality: '단순다수', runoff: '결선투표', irv: '선호투표', borda: '보르다' };
  const name = (i) => (i < 0 ? '없음' : String.fromCharCode(65 + i));
  let el = null, agg = null, sweep = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), k: Number($('k').value), polar: Number($('polar').value) / 100 });

  // 범례를 놓을 구석 고르기: 점들 [x, y]이 가장 적게 겹치는 곳
  function pickPos(c, pts, n) {
    const bw = 190, bh = n * 16 + 9, m = c.m; let best = 'tr', bc = 1e9;
    ['tr', 'tl', 'br', 'bl'].forEach((p) => {
      const x0 = p[1] === 'l' ? m.l + 6 : m.l + c.pw - bw - 6, y0 = p[0] === 'b' ? m.t + c.ph - bh - 6 : m.t + 6;
      const cnt = pts.filter(([x, y]) => x >= x0 - 4 && x <= x0 + bw + 4 && y >= y0 - 4 && y <= y0 + bh + 4).length;
      if (cnt < bc) { bc = cnt; best = p; }
    });
    return best;
  }
  function drawMap() {
    const strip = THUMB ? 0 : 66, cw = $('c-map').clientWidth || 600; // 아래 띠: 범례 자리
    const c = L.chart($('c-map'), THUMB ? 1 : (cw < 560 ? 0.9 : 0.62) + strip / cw, { l: 8, r: 8, t: 8, b: 8 });
    const { ctx, w } = c, h = c.h - strip;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, c.h);
    const K = el.params.k, N = el.voters.length;
    // 유권자가 퍼진 범위에 맞춰 확대한다 (가로·세로 같은 비율, 바깥 2%는 잘려도 됨)
    const ex = el.voters.map((p) => Math.max(Math.abs(p.x) / (w / 2 - 16), Math.abs(p.y) / (h / 2 - 16))).sort((a, b) => a - b);
    const candEx = Math.max(...el.cands.map((p) => Math.max(Math.abs(p.x) / (w / 2 - 26), Math.abs(p.y) / (h / 2 - 26))));
    const sc = 1 / Math.max(ex[Math.floor(N * 0.98)], candEx, 1e-6), X = (x) => w / 2 + x * sc, Y = (y) => h / 2 + y * sc;
    const near = (x, y) => { let best = 0, bd = Infinity; for (let k = 0; k < K; k++) { const d = (x - el.cands[k].x) ** 2 + (y - el.cands[k].y) ** 2; if (d < bd) { bd = d; best = k; } } return best; };
    // 바탕: 그 자리의 유권자라면 누구를 1순위로 고를지 (후보마다 "지지 구역")
    const g = 6;
    for (let py = 0; py < h; py += g) for (let px = 0; px < w; px += g) {
      ctx.fillStyle = mix(COL[near((px + g / 2 - w / 2) / sc, (py + g / 2 - h / 2) / sc)], 0.07); ctx.fillRect(px, py, g, g);
    }
    for (let v = 0; v < N; v++) {
      const p = el.voters[v];
      ctx.fillStyle = mix(COL[near(p.x, p.y)], 0.5); ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), w < 500 ? 2.2 : 3, 0, 7); ctx.fill();
    }
    el.cands.forEach((cd, k) => {
      const x = X(cd.x), y = Y(cd.y);
      if (el.winners.condorcet === k) { ctx.strokeStyle = '#d19200'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      ctx.fillStyle = COL[k]; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 13px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(name(k), x, y + 4.5);
    });
    // 후보 옆에 그 후보를 당선시킨 방식을 적는다 (같은 표인데 방식마다 당선자가 다른 것을 지도에서 바로 보이게)
    if (THUMB) return;
    ctx.save(); ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, h, w, strip); ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(0, h + 0.5); ctx.lineTo(w, h + 0.5); ctx.stroke(); ctx.restore();
    L.legend({ ctx, w, h: c.h, m: { l: 0, r: 0, t: h, b: 0 }, pw: w, ph: strip }, [
      { kind: 'dot', color: COL[0], label: '유권자 (색 = 1순위로 고른 후보)' }, { kind: 'dot', color: '#4b5563', label: '후보 (큰 원)' }, { kind: 'dot', color: '#d19200', label: '중도 후보 (금색 테두리)' }], 'tl');
    ctx.font = '600 11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.lineJoin = 'round';
    el.cands.forEach((cd, k) => {
      const rules = VT.RULES.filter((r) => el.winners[r] === k); if (!rules.length) return;
      const x = X(cd.x), right = x < w - 90, y0 = Y(cd.y) - (rules.length - 1) * 7;
      ctx.textAlign = right ? 'left' : 'right';
      rules.forEach((r, i) => {
        const tx = x + (right ? 21 : -21), ty = y0 + i * 14 + 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.strokeText('★ ' + RNAME[r], tx, ty);
        ctx.fillStyle = RCOL[r]; ctx.fillText('★ ' + RNAME[r], tx, ty);
      });
    });
    ctx.lineWidth = 1;
  }

  function drawResults() {
    const c = L.chart($('c-results'), 0.62, { l: 78, r: 14, t: 10, b: 10 });
    const { ctx, m, pw, ph } = c, rows = VT.RULES, K = el.params.k, rowH = ph / rows.length;
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    rows.forEach((rule, i) => {
      const y = m.t + i * rowH, bh = rowH * 0.46, by = y + rowH * 0.12;
      ctx.fillStyle = css('--text'); ctx.textAlign = 'right'; ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(RNAME[rule], m.l - 10, by + bh / 2 + 4);
      let x = m.l; const t = el.tallies[rule];
      t.forEach((v, k) => {
        if (v <= 0) return; const wd = v * pw;
        ctx.fillStyle = COL[k]; ctx.fillRect(x, by, Math.max(0.5, wd - 1), bh);
        if (wd > 22) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(name(k), x + wd / 2, by + bh / 2 + 4); }
        x += wd;
      });
      const wn = el.winners[rule];
      ctx.fillStyle = COL[wn]; ctx.textAlign = 'left'; ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(`★ 당선: ${name(wn)}`, m.l, by + bh + 17);
      ctx.fillStyle = css('--muted'); ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif';
      const note = rule === 'plurality' ? '1순위 득표율' : rule === 'runoff' ? (el.runoffPair ? `결선: ${el.runoffPair.map(name).join(' vs ')}` : '1차에서 과반') : rule === 'irv' ? `${el.irvRounds.length}번째 집계에서 결정` : '순위 점수 비율';
      ctx.textAlign = 'right'; ctx.fillText(note, m.l + pw, by + bh + 17);
    });
  }

  function drawAgg() {
    const c = L.chart($('c-agg'), 0.7, { b: 44, t: 24 }), { ctx, m, pw, ph } = c;
    const Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X: () => 0, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v) => String(Math.round(v * 100)), xLabel: '개표 방식', yLabel: '중도 후보를 뽑은 비율 (%)' });
    const rows = VT.RULES, gw = pw / rows.length, bw = Math.min(46, gw * 0.55);
    rows.forEach((r, i) => {
      const v = agg ? agg.hit[r] / Math.max(1, agg.withCondorcet) : 0, x = m.l + gw * i + (gw - bw) / 2;
      if (agg) { ctx.fillStyle = RCOL[r]; roundRect(ctx, x, Y(v), bw, m.t + ph - Y(v), 5); ctx.fill(); ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(pct(v), x + bw / 2, Y(v) - 6); }
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText(RNAME[r], x + bw / 2, m.t + ph + 18);
    });
  }

  function drawSweep() {
    const mk = (r, dots) => ({ data: sweep.map((d) => ({ x: d.x, runs: [], mean: d.hit[r] })), color: RCOL[r], dots: false });
    // L.dots는 첫 번째 데이터를 늘 파란색(--accent)으로 그리므로, 파란색인 선호투표를 첫 번째로 두고 나머지(단순다수는 빨강)를 series로
    const first = 'irv', rest = VT.RULES.filter((r) => r !== first).map((r) => mk(r));
    const c = L.dots($('c-sweep'), {
      data: mk(first).data, series: rest,
      x0: 2, x1: 6, y0: 0, y1: 1, xTicks: [2, 3, 4, 5, 6], xFmt: (v) => String(v), xLabel: '후보 수 (명)', yLabel: '중도 후보 당선 비율 (%)', yFmt: (v) => String(Math.round(v * 100)), marker: { x: el.params.k },
    });
    const lc = Object.assign({}, c, { m: Object.assign({}, c.m, { t: c.m.t + 20 }), ph: c.ph - 20 }), pts = [];
    sweep.forEach((d) => VT.RULES.forEach((r) => pts.push([c.m.l + ((d.x - 2) / 4) * c.pw, c.m.t + c.ph - d.hit[r] * c.ph])));
    L.legend(lc, ['plurality', 'runoff', 'irv', 'borda'].map((r) => ({ kind: 'line', color: RCOL[r], label: RNAME[r] })), pickPos(lc, pts, 4));
  }

  function renderStats() {
    const w = el.winners;
    const cards = VT.RULES.map((r) => [RNAME[r], '후보 ' + name(w[r]), `득표 비중 ${pct(el.tallies[r][w[r]])}`]);
    cards.push(['중도 후보 (콩도르세 승자)', w.condorcet >= 0 ? '후보 ' + name(w.condorcet) : '없음', '다른 모든 후보와 1:1로 붙으면 이기는 후보']);
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawMap(); drawResults(); drawAgg(); drawSweep(); }

  function after() {
    const P = params(); agg = null; sweep = []; drawAgg(); drawSweep();
    $('note-agg').textContent = '계산 중…'; $('note-sweep').textContent = '계산 중…';
    const jobs = [() => { agg = VT.study(P, 200, 1000); }];
    [2, 3, 4, 5, 6].forEach((k) => jobs.push(() => {
      const r = VT.study({ k, polar: P.polar }, 120, 5000), hit = {};
      VT.RULES.forEach((x) => { hit[x] = r.hit[x] / Math.max(1, r.withCondorcet); });
      sweep.push({ x: k, hit });
    }));
    L.jobs(jobs, () => { drawAgg(); drawSweep(); }, () => {
      $('note-agg').textContent = `같은 설정의 선거 200번 중 단순다수와 선호투표의 당선자가 달랐던 선거: ${pct(agg.pluralityNeIrv / agg.n)}`;
      $('note-sweep').textContent = '후보가 2명이면 모든 방식이 같은 결과입니다';
    });
  }

  const h = L.harness({
    controls: ['k', 'polar'],
    format: { k: (v) => v + '명\u200b', polar: (v) => v + '%' },
    defaults: { k: 4, polar: 60 },
    build() { el = VT.create(params()); },
    draw, after, redrawExtra() { drawAgg(); drawSweep(); }, seedLabel: '선거 번호',
  });
  seedGetter = h.seed;
})();
