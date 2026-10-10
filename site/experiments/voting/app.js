(function () {
  'use strict';
  const VT = window.Voting, L = window.Lab;
  const { css, mix, pct, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const COL = ['#3b82f6', '#e5484d', '#1fa463', '#f59e42', '#7c5cff', '#0ea5a5'];
  const RCOL = { plurality: '#e5484d', runoff: '#f59e42', irv: '#2f6fed', borda: '#1fa463' };
  const RNAME = { plurality: '단순다수', runoff: '결선투표', irv: '선호투표', borda: '보르다' };
  const name = (i) => (i < 0 ? '없음' : String.fromCharCode(65 + i));
  let el = null, agg = null, sweep = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), k: Number($('k').value), polar: Number($('polar').value) / 100 });

  function drawMap() {
    const c = L.chart($('c-map'), 0.7, { l: 8, r: 8, t: 8, b: 8 });
    const { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const R = 3.6, sx = w / (2 * R), sy = h / (2 * R), X = (x) => w / 2 + x * sx, Y = (y) => h / 2 + y * sy;
    const K = el.params.k, N = el.voters.length;
    for (let v = 0; v < N; v++) {
      const p = el.voters[v]; let best = 0, bd = Infinity;
      for (let k = 0; k < K; k++) { const d = (p.x - el.cands[k].x) ** 2 + (p.y - el.cands[k].y) ** 2; if (d < bd) { bd = d; best = k; } }
      ctx.fillStyle = mix(COL[best], 0.38); ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3, 0, 7); ctx.fill();
    }
    el.cands.forEach((cd, k) => {
      const x = X(cd.x), y = Y(cd.y);
      if (el.winners.condorcet === k) { ctx.strokeStyle = '#d19200'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      ctx.fillStyle = COL[k]; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 13px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(name(k), x, y + 4.5);
    });
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
    const c = L.chart($('c-agg'), 0.7, { b: 44, t: 18 }), { ctx, m, pw, ph } = c;
    const Y = (v) => m.t + ph - v * ph;
    L.axes(c, { X: () => 0, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct });
    const rows = VT.RULES, gw = pw / rows.length, bw = Math.min(46, gw * 0.55);
    rows.forEach((r, i) => {
      const v = agg ? agg.hit[r] / Math.max(1, agg.withCondorcet) : 0, x = m.l + gw * i + (gw - bw) / 2;
      if (agg) { ctx.fillStyle = RCOL[r]; roundRect(ctx, x, Y(v), bw, m.t + ph - Y(v), 5); ctx.fill(); ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(pct(v), x + bw / 2, Y(v) - 6); }
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText(RNAME[r], x + bw / 2, m.t + ph + 18);
    });
  }

  function drawSweep() {
    const mk = (r, dots) => ({ data: sweep.map((d) => ({ x: d.x, runs: [], mean: d.hit[r] })), color: RCOL[r], dots: false });
    const all = VT.RULES.map((r) => mk(r));
    L.dots($('c-sweep'), {
      data: all[0].data, series: all.slice(1).map((s) => s),
      x0: 2, x1: 6, y0: 0, y1: 1, xTicks: [2, 3, 4, 5, 6], xFmt: (v) => v + '명', xLabel: '후보 수', marker: { x: el.params.k },
    });
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
    format: { k: (v) => v + '명', polar: (v) => v + '%' },
    defaults: { k: 4, polar: 60 },
    build() { el = VT.create(params()); },
    draw, after, redrawExtra() { drawAgg(); drawSweep(); }, seedLabel: '선거 번호',
  });
  seedGetter = h.seed;
})();
