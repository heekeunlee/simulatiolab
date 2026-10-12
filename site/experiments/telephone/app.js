(function () {
  'use strict';
  const TP = window.Telephone, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  let sim = null, sweep = [];
  let seedGetter = () => 1;
  const THUMB = /[?&]thumb=1/.test(location.search);   // 메인 페이지 썸네일용: 40번 전달이 끝난 장면으로 바로 간다
  const params = () => ({ seed: seedGetter(), memory: Number($('memory').value) / 100, creativity: Number($('creativity').value) / 100, convention: Number($('convention').value) / 100 });

  // 기억용이성 0.1(옅은 회청색) → 1(붉은색)
  function mcolor(m) {
    const t = Math.min(1, Math.max(0, (m - 0.1) / 0.9)), a = [228, 232, 241], b = [229, 72, 77];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  }

  // ① 원래 모티프를 기억에 잘 남는 순서로 늘어놓은 격자: 칸이 차 있으면 그 사슬에 아직 남아 있는 것
  //    오른쪽 작은 칸들은 중간에 새로 생긴 모티프, 맨 아래 막대는 원래 모티프마다 남아 있는 사슬 수
  function drawChain() {
    const narrow = ($('c-chain').clientWidth || 600) < 560;
    const left = THUMB ? 10 : narrow ? 44 : 62;
    const c = L.chart($('c-chain'), THUMB ? 1 : narrow ? 0.8 : 0.74, { l: left, r: 12, t: 10, b: THUMB ? 10 : 30 });
    const { ctx, w, h, m, pw, ph } = c, K = sim.chains.length + 1, M = sim.params.M;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const order = sim.original.map((x, i) => i).sort((a, b) => sim.original[b].m - sim.original[a].m);
    const col = new Map(); order.forEach((i, k) => col.set(sim.original[i].id, k));
    const newW = THUMB ? 0 : Math.min(pw * (narrow ? 0.2 : 0.24), 150), gw = pw - newW - (THUMB ? 0 : 14), bw = gw / M;
    const barH = THUMB ? ph * 0.12 : 0, rowH = (ph - barH - (THUMB ? 8 : 0)) / K, bh = Math.min(rowH * 0.74, bw * (narrow ? 2.6 : 1.6));
    const kept = new Array(M).fill(0);
    const cellAt = (x, y, mo, solid) => {
      ctx.fillStyle = mcolor(mo.m); L.roundRect(ctx, x + 0.8, y, Math.max(1, bw - 1.6), bh, 3); ctx.fill();
      if (solid && !THUMB) { ctx.strokeStyle = '#1b1f2a'; ctx.lineWidth = 1.2; L.roundRect(ctx, x + 0.8, y, Math.max(1, bw - 1.6), bh, 3); ctx.stroke(); ctx.lineWidth = 1; }
    };
    for (let r = 0; r < K; r++) {
      const y = m.t + r * rowH + (r === 0 ? 0 : 6) + (rowH - bh) / 2, story = r === 0 ? sim.original : sim.chains[r - 1];
      if (!THUMB) {
        ctx.font = (r === 0 ? '700 12px' : '11px') + ' -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = r === 0 ? css('--text') : css('--muted'); ctx.textAlign = 'right';
        ctx.fillText(r === 0 ? '원본' : `사슬 ${r}`, m.l - 8, y + bh * 0.72);
      }
      // 빈 자리(잊혔거나 바뀐 원래 모티프)
      ctx.strokeStyle = '#d5dbe7'; ctx.setLineDash([2, 2]);
      for (let k = 0; k < M; k++) { L.roundRect(ctx, m.l + k * bw + 1.5, y + 0.5, Math.max(1, bw - 3), bh - 1, 3); ctx.stroke(); }
      ctx.setLineDash([]);
      const extra = [];
      story.forEach((mo) => {
        if (col.has(mo.id)) { const k = col.get(mo.id); cellAt(m.l + k * bw, y, mo, true); if (r > 0) kept[k]++; }
        else extra.push(mo);
      });
      if (!THUMB && r > 0 && extra.length) {
        const ex = m.l + gw + 14, ew = Math.min(bw, newW / Math.max(8, extra.length));
        extra.forEach((mo, i) => {
          ctx.fillStyle = mcolor(mo.m); L.roundRect(ctx, ex + i * ew + 0.6, y, Math.max(1, ew - 1.2), bh, 2); ctx.fill();
          ctx.strokeStyle = '#9aa3b5'; ctx.setLineDash([2, 2]); L.roundRect(ctx, ex + i * ew + 0.6, y, Math.max(1, ew - 1.2), bh, 2); ctx.stroke(); ctx.setLineDash([]);
        });
      }
    }
    if (!THUMB) {
      ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = css('--muted');
      ctx.textAlign = 'left'; ctx.fillText('← 기억에 잘 남는 모티프', m.l, h - 10);
      if (!narrow) {
        ctx.textAlign = 'right'; ctx.fillText('잘 잊히는 모티프 →', m.l + gw, h - 10);
        ctx.textAlign = 'center'; ctx.fillText('새로 생긴 모티프', m.l + gw + 14 + newW / 2, h - 10);
      }
      ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(m.l + gw + 7, m.t); ctx.lineTo(m.l + gw + 7, m.t + ph); ctx.stroke();
    } else {
      // 썸네일: 원래 모티프마다 남아 있는 사슬 수를 막대로
      const by = h - 10;
      for (let k = 0; k < M; k++) {
        const v = kept[k] / sim.chains.length, mo = sim.original[order[k]];
        ctx.fillStyle = mcolor(mo.m); L.roundRect(ctx, m.l + k * bw + 1.5, by - Math.max(2, v * barH), bw - 3, Math.max(2, v * barH), 2); ctx.fill();
      }
    }
    const cur = sim.current();
    $('when').textContent = `${sim.gen}번째 전달 · 원본 모티프 ${pct(cur.survMean)} 남음`;
  }

  function drawSurv() {
    const c = L.chart($('c-surv'), 0.7), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.gens;
    const X = (g) => m.l + (g / T) * pw, Y = (v) => m.t + ph - v * ph, xt = []; for (let g = 0; g <= T; g += T / 4) xt.push(Math.round(g));
    L.axes(c, { X, Y, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: pct, xTicks: xt, xFmt: (g) => String(g), xLabel: '전달 횟수' });
    for (let k = 0; k < sim.chains.length; k++) L.line(ctx, H.map((s, g) => [X(g), Y(s.surv[k])]), mix(css('--accent'), 0.22), 1.2);
    L.line(ctx, H.map((s, g) => [X(g), Y(s.survMean)]), css('--accent'), 3);
    const last = H.length - 1; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(H[last].survMean), 4.5, 0, 7); ctx.fill();
  }

  function drawMem() {
    const c = L.chart($('c-mem'), 0.7, { l: 48 }), { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.gens;
    const vals = H.map((s) => s.memMean).concat([sim.origMem]);
    const lo = Math.floor((Math.min(...vals) - 0.03) * 20) / 20, hi = Math.ceil((Math.max(...vals) + 0.03) * 20) / 20;
    const X = (g) => m.l + (g / T) * pw, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph, xt = []; for (let g = 0; g <= T; g += T / 4) xt.push(Math.round(g));
    const yt = []; for (let v = lo; v <= hi + 1e-9; v += (hi - lo) / 4) yt.push(v);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => v.toFixed(2), xTicks: xt, xFmt: (g) => String(g), xLabel: '전달 횟수' });
    ctx.setLineDash([5, 4]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(sim.origMem)); ctx.lineTo(m.l + pw, Y(sim.origMem)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('원래 이야기의 평균', m.l + 6, Y(sim.origMem) - 6);
    L.line(ctx, H.map((s, g) => [X(g), Y(s.memMean)]), css('--unlucky'), 3);
    const last = H.length - 1; ctx.fillStyle = css('--unlucky'); ctx.beginPath(); ctx.arc(X(last), Y(H[last].memMean), 4.5, 0, 7); ctx.fill();
  }

  function drawSweep() {
    const mk = (key) => sweep.map((d) => ({ x: d.x, runs: d[key], mean: L.mean(d[key]) }));
    L.dots($('c-sweep'), {
      data: mk('surv'), series: [{ data: mk('jac'), color: css('--rich'), dots: true }, { data: sweep.map((d) => ({ x: d.x, runs: [], mean: L.mean(d.chance) })), color: '#8a93a6' }],
      x0: 0.7, x1: 1, y0: 0, y1: 1, xTicks: [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1], xFmt: (v) => Math.round(v * 100) + '%', xLabel: '기억력', marker: { x: sim.params.memory },
    });
  }

  function renderStats() {
    const cur = sim.current(), j = cur.jac;
    const cards = [
      ['전달 횟수', `${sim.gen}/${sim.params.gens}`, `이야기 사슬 ${sim.chains.length}개가 따로 전해져요`],
      ['남은 원래 모티프', pct(cur.survMean), `처음 ${sim.params.M}개 중 평균`],
      ['이야기 길이', cur.lenMean.toFixed(1), `모티프 수 (처음 ${sim.params.M})`],
      ['평균 기억용이성', cur.memMean.toFixed(2), `처음 ${sim.origMem.toFixed(2)}`],
      ['사슬 사이 비슷함', pct(j), `남은 원래 모티프가 겹치는 정도 (우연이면 ${pct(cur.jacChance)})`],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  function draw() { renderStats(); drawChain(); drawSurv(); drawMem(); drawSweep(); }

  function after() {
    const P = params(); sweep = []; drawSweep(); $('note-sweep').textContent = '계산 중…';
    const xs = [0.7, 0.75, 0.8, 0.85, 0.9, 0.93, 0.96, 0.98, 0.99, 1];
    L.jobs(xs.map((x) => () => {
      const r = TP.finals({ memory: x, creativity: P.creativity, convention: P.convention }, 3, 600);
      sweep.push({ x, surv: r.map((s) => s.survMean), jac: r.map((s) => s.jac), chance: r.map((s) => s.jacChance) });
    }), drawSweep, () => {
      const a = sweep[0], b = sweep[sweep.length - 1], above = sweep.every((d) => L.mean(d.jac) > L.mean(d.chance));
      $('note-sweep').textContent = `기억력이 70%이면 원래 모티프가 평균 ${pct(L.mean(a.surv))} 남고, 100%이면 ${pct(L.mean(b.surv))} 남습니다` + (above ? '. 사슬 사이 비슷함은 모든 구간에서 우연 기준보다 높았습니다' : '');
    });
  }

  const h = L.harness({
    controls: ['memory', 'creativity', 'convention'],
    format: { memory: (v) => v + '%', creativity: (v) => v + '%', convention: (v) => v + '%' },
    defaults: { memory: 96, creativity: 30, convention: 30 },
    build() { sim = TP.create(params()); if (THUMB) sim.run(); },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra() { drawSweep(); }, seedLabel: '전달 번호',
  });
  seedGetter = h.seed;
})();
