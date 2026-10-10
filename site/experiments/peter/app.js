(function () {
  'use strict';
  const PT = window.Peter, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  const NAMES = { best: '최고 능력자 승진', worst: '최저 능력자 승진', random: '무작위 승진', alt: '번갈아 승진' };
  const ORDER = ['best', 'worst', 'random', 'alt'];
  let sim = null, cmp = [], cmpDone = false;

  const params = () => ({ seed: seed(), strategy: $('strategy').value, continuity: Number($('continuity').value) / 100, years: Number($('years').value) });
  let seedGetter = () => 1; const seed = () => seedGetter();

  // 능력 0~10 → 색 (빨강 - 노랑 - 파랑)
  function color(c) {
    const t = Math.min(1, Math.max(0, c / 10));
    const a = t < 0.5 ? [229, 72, 77] : [245, 196, 81], b = t < 0.5 ? [245, 196, 81] : [47, 111, 237], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`;
  }

  function drawPyramid() {
    const c = L.chart($('c-pyramid'), 0.62, { l: 8, r: 8, t: 8, b: 8 });
    const { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const rows = sim.levels.length, rowH = (h - 16) / rows;
    sim.levels.forEach((lv, l) => {
      const sorted = lv.slice().sort((a, b) => b.c - a.c);
      const size = lv.length, maxW = w - 120, r = Math.min(7, (maxW / Math.max(81, size)) / 2.1);
      const gap = Math.min(r * 2.3, maxW / size);
      const total = gap * size, x0 = 100 + (maxW - total) / 2 + gap / 2, y = 8 + rowH * l + rowH / 2;
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(l === 0 ? '최상위' : l === rows - 1 ? '말단' : `${rows - l}단계`, 10, y + 4);
      sorted.forEach((p, i) => { ctx.fillStyle = color(p.c); ctx.beginPath(); ctx.arc(x0 + i * gap, y, r, 0, 7); ctx.fill(); });
    });
    const e = sim.efficiency();
    $('when').textContent = `${sim.year}년째 · 조직 효율 ${e.toFixed(2)}`;
  }

  function drawEff() {
    const c = L.chart($('c-eff'), 0.7);
    const { ctx, m, pw, ph } = c, H = sim.history, T = sim.params.years;
    const lo = Math.floor(Math.min(...H, 6) - 0.2), hi = Math.ceil(Math.max(...H, 8) + 0.1);
    const X = (t) => m.l + (t / T) * pw, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    const yt = []; for (let v = lo; v <= hi; v++) yt.push(v);
    const xt = []; for (let t = 0; t <= T; t += T / 5) xt.push(t);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => v.toFixed(0), xTicks: xt, xFmt: (t) => Math.round(t) + '년', xLabel: '경과 시간' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(H[0])); ctx.lineTo(m.l + pw, Y(H[0])); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('처음 수준', m.l + 6, Y(H[0]) - 6);
    L.line(ctx, H.map((v, t) => [X(t), Y(v)]), css('--accent'), 2.5);
    const last = H.length - 1; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(H[last]), 4.5, 0, 7); ctx.fill();
  }

  function drawLevels() {
    const c = L.chart($('c-levels'), 0.62, { l: 64, r: 16, t: 12, b: 30 });
    const { ctx, w, m, pw, ph } = c, means = sim.levelMeans(), n = means.length;
    const X = (v) => m.l + (v / 10) * pw, rowH = ph / n;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    for (let v = 0; v <= 10; v += 2) { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); ctx.fillText(String(v), X(v), m.t + ph + 16); }
    means.forEach((v, i) => {
      const y = m.t + i * rowH + rowH * 0.18, hh = rowH * 0.64;
      ctx.fillStyle = color(v); L.roundRect(ctx, m.l, y, Math.max(2, X(v) - m.l), hh, 4); ctx.fill();
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.fillText(i === 0 ? '최상위' : i === n - 1 ? '말단' : `${n - i}단계`, m.l - 8, y + hh / 2 + 4);
      ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.fillText(v.toFixed(1), X(v) + 6, y + hh / 2 + 4);
    });
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--text'); ctx.beginPath(); ctx.moveTo(X(7), m.t); ctx.lineTo(X(7), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawCmp() {
    const c = L.chart($('c-cmp'), 0.7, { b: 52, t: 16 });
    const { ctx, m, pw, ph } = c;
    const lo = 3, hi = 10, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    L.axes(c, { X: () => 0, Y, yTicks: [3, 5, 7, 9], yFmt: (v) => v.toFixed(0) });
    const gw = pw / ORDER.length, bw = Math.min(34, gw * 0.3);
    ORDER.forEach((k, i) => {
      const cx = m.l + gw * i + gw / 2;
      [['cs', '#2f6fed', -1], ['peter', '#e5484d', 1]].forEach(([hyp, col, side]) => {
        const d = cmp.find((r) => r.k === k && r.h === hyp); if (!d) return;
        const x = cx + (side < 0 ? -bw - 2 : 2);
        ctx.fillStyle = col; L.roundRect(ctx, x, Y(d.v), bw, m.t + ph - Y(d.v), 4); ctx.fill();
        ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText(d.v.toFixed(1), x + bw / 2, Y(d.v) - 5);
      });
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText(NAMES[k].replace(' 승진', ''), cx, m.t + ph + 18);
    });
    ctx.setLineDash([4, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(7)); ctx.lineTo(m.l + pw, Y(7)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.fillText('처음 7.0', m.l + 4, Y(7) - 5);
  }

  function renderStats() {
    const means = sim.levelMeans(), e = sim.efficiency(), d = e - sim.history[0];
    const cards = [
      ['조직 효율', e.toFixed(2), `처음 ${sim.history[0].toFixed(2)} → ${d >= 0 ? '+' : ''}${d.toFixed(2)}`],
      ['최상위 평균 능력', means[0].toFixed(1), '처음엔 평균 7 정도'],
      ['말단 평균 능력', means[means.length - 1].toFixed(1), '가장 큰 층(81명)'],
      ['지금까지 승진', sim.promotions + '명', `${sim.year}년 동안`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawPyramid(); drawEff(); drawLevels(); }

  function after() {
    const P = params(); cmp = []; drawCmp();
    L.jobs(ORDER.flatMap((k) => [['cs', 1], ['peter', 0]].map(([h, cont]) => () => {
      cmp.push({ k, h, v: L.mean(PT.finalEfficiency({ strategy: k, continuity: cont, years: P.years }, 12)) });
    })), drawCmp, () => {
      const g = (k, h) => cmp.find((r) => r.k === k && r.h === h).v;
      $('note-cmp').textContent = `상식 가설에서 최고 능력자 승진은 ${g('best', 'cs').toFixed(1)}, 피터 가설에서는 ${g('best', 'peter').toFixed(1)}입니다 (무작위 승진은 ${g('random', 'peter').toFixed(1)})`;
    });
  }

  const h = L.harness({
    controls: ['strategy', 'continuity', 'years'],
    format: { continuity: (v) => v + '%', years: (v) => v + '년', strategy: () => '' },
    defaults: { strategy: 'best', continuity: 0, years: 60 },
    build() { sim = PT.create(params()); },
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawCmp, seedLabel: '조직 번호',
  });
  seedGetter = h.seed;
})();
