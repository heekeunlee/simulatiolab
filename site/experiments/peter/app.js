(function () {
  'use strict';
  const PT = window.Peter, L = window.Lab;
  const { css, mix, pct } = L;
  const $ = (id) => document.getElementById(id);
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 60년 뒤의 피라미드
  const NAMES = { best: '최고 능력자 승진', worst: '최저 능력자 승진', random: '무작위 승진', alt: '번갈아 승진' };
  const ORDER = ['best', 'worst', 'random', 'alt'];
  let sim = null, cmp = [], cmpDone = false;

  const params = () => ({ seed: seed(), strategy: $('strategy').value, continuity: Number($('continuity').value) / 100, years: Number($('years').value) });
  let seedGetter = () => 1; const seed = () => seedGetter();

  // 능력 → 색. 처음 평균(7)을 가운데(옅은 베이지)로, 낮을수록 빨강, 높을수록 파랑 (중간색이 탁해지지 않게 두 갈래로 섞는다)
  function color(c) {
    const mid = [214, 205, 186], lo = [229, 72, 77], hi = [47, 111, 237];
    const t = c < 7 ? Math.min(1, (7 - c) / 3.5) : Math.min(1, (c - 7) / 2.5), to = c < 7 ? lo : hi;
    return `rgb(${mid.map((v, i) => Math.round(v + (to[i] - v) * Math.pow(t, 0.8))).join(',')})`;
  }

  // 단계마다 한 줄에 최대 21명씩 쌓아 피라미드 모양으로 그린다 (휴대폰에서도 점이 너무 작아지지 않게)
  const PER_ROW = 21;
  function drawPyramid() {
    const cv = $('c-pyramid'), W = cv.clientWidth || 400, labW = W < 520 ? 52 : 74;
    const rowsOf = (lv) => Math.ceil(lv.length / PER_ROW);
    const nRows = sim.levels.reduce((t, lv) => t + rowsOf(lv), 0), gaps = sim.levels.length - 1;
    const cell = Math.min(THUMB ? 40 : 30, (W - labW - 16) / PER_ROW), lg = cell * 0.55, legH = THUMB ? 0 : 64, need = nRows * cell + gaps * lg + 24 + legH;
    const c = L.chart(cv, THUMB ? 1 : need / W, { l: 0, r: 0, t: 0, b: 0 });
    const { ctx, w, h } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const cx = labW + (w - labW - 8) / 2, r = cell * 0.4, rows = sim.levels.length;
    let y = (h - need) / 2 + 12;
    sim.levels.forEach((lv, l) => {
      const sorted = lv.slice().sort((a, b) => b.c - a.c), nr = rowsOf(lv);
      if (!THUMB) {
        ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = (W < 520 ? 11 : 12) + 'px -apple-system, "Apple SD Gothic Neo", sans-serif';
        ctx.fillText(l === 0 ? '최상위' : l === rows - 1 ? '말단' : `${rows - l}단계`, 8, y + (nr * cell) / 2 + 4);
      }
      sorted.forEach((p, i) => {
        const row = Math.floor(i / PER_ROW), inRow = Math.min(PER_ROW, lv.length - row * PER_ROW), col = i % PER_ROW;
        const x = cx + (col - (inRow - 1) / 2) * cell, yy = y + row * cell + cell / 2;
        ctx.fillStyle = color(p.c); ctx.beginPath(); ctx.arc(x, yy, r, 0, 7); ctx.fill();
      });
      y += nr * cell + lg;
    });
    if (!THUMB) L.legend({ ctx, w, m: { l: 8, t: 0, r: 8, b: 0 }, pw: w - 16, ph: h - 4 }, [{ kind: 'dot', color: color(9.5), label: '능력 높음' }, { kind: 'dot', color: color(7), label: '처음 평균 (7)' }, { kind: 'dot', color: color(3.5), label: '능력 낮음' }], 'br');
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
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => v.toFixed(0), xTicks: xt, xFmt: (t) => String(Math.round(t)), xLabel: '경과 시간 (년)', yLabel: '조직 효율' });
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(m.l, Y(H[0])); ctx.lineTo(m.l + pw, Y(H[0])); ctx.stroke(); ctx.setLineDash([]);
        L.line(ctx, H.map((v, t) => [X(t), Y(v)]), css('--accent'), 2.5);
    const last = H.length - 1; ctx.fillStyle = css('--accent'); ctx.beginPath(); ctx.arc(X(last), Y(H[last]), 4.5, 0, 7); ctx.fill();
    L.legend(c, [{ kind: 'line', color: css('--accent'), label: '조직 효율' }, { kind: 'dash', color: css('--muted'), label: '처음 수준' }], H[last] > H[0] ? 'br' : 'tr');
  }

  function drawLevels() {
    const c = L.chart($('c-levels'), 0.62, { l: 64, r: 30, t: 24, b: 36 });
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
    ctx.fillStyle = css('--text'); ctx.textAlign = 'center'; ctx.fillText('처음 평균 7', X(7), m.t - 7);
    L.axisNames(c, '평균 능력', null);
  }

  function drawCmp() {
    const c = L.chart($('c-cmp'), 0.7, { b: 52, t: 16 });
    const { ctx, m, pw, ph } = c;
    const lo = 3, hi = 13, Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    L.axes(c, { X: () => 0, Y, yTicks: [3, 5, 7, 9, 11], yFmt: (v) => v.toFixed(0), yLabel: '조직 효율' });
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
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.font = '11px -apple-system, "Apple SD Gothic Neo", sans-serif'; ctx.fillText('처음 7.0', m.l + gw * 2, Y(7) + 13); // 막대 사이 빈 곳, 선 아래에
    L.legend(c, [{ kind: 'box', color: '#2f6fed', label: '상식 가설 (이어질 확률 100%)' }, { kind: 'box', color: '#e5484d', label: '피터 가설 (이어질 확률 0%)' }], 'tr');
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
    build() { sim = PT.create(params()); if (THUMB) sim.run(); },
    autoplay: !THUMB,
    advance() { return sim.advance(); },
    isDone() { return sim.done; },
    draw, after, redrawExtra: drawCmp, seedLabel: '조직 번호',
  });
  seedGetter = h.seed;
})();
