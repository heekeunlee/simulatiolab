(function () {
  'use strict';
  const IN = window.Inspection, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const CVS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  let sim = null, cls = null, cls3 = null, rows = [];
  let seedGetter = () => 1;
  const params = () => ({ seed: seedGetter(), mean: Number($('mean').value), cv: Number($('cv').value), n: Number($('n').value) });
  const f1 = (v) => v.toFixed(1);
  const FONT = '12px -apple-system, "Apple SD Gothic Neo", sans-serif', FONT_B = '600 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
  const GOLD = '#d19200';

  // ---------- ① 승객 한 명씩 ----------
  function drawBus() {
    const c = L.chart($('c-bus'), 0.74, { l: 14, r: 14, t: 34, b: 14 }), { ctx, w, h, m, pw } = c;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, h);
    const P = sim.params, q = sim.last;
    ctx.textAlign = 'left'; ctx.fillStyle = css('--text'); ctx.font = FONT_B;
    if (!q) { ctx.fillStyle = css('--muted'); ctx.fillText('재생을 누르면 승객이 한 명씩 도착해요', m.l, 24); }
    else {
      const b0 = sim.bus[q.idx], b1 = sim.bus[q.idx + 1], mid = (b0 + b1) / 2, W = Math.max(5 * P.mean, q.gap + 2 * P.mean);
      const lo = mid - W / 2, X = (t) => m.l + ((t - lo) / W) * pw, y = 100;
      ctx.fillText(`${sim.round}번째 승객 · 이 승객이 걸린 간격은 ${f1(q.gap)}분`, m.l, 22);
      // 걸린 간격 (주황 막대)
      ctx.fillStyle = mix('#e0a100', 0.22); ctx.fillRect(X(b0), y - 34, X(b1) - X(b0), 68);
      // 먼저 도착한 승객들: 간격 안에 얼마나 몰렸는지
      let k = 0; ctx.fillStyle = mix(css('--accent'), 0.5);
      for (let i = 0; i < sim.round - 1; i++) { const t = sim.pass[i].t; if (t < lo || t > lo + W) continue; ctx.beginPath(); ctx.arc(X(t), y + 20 - (k++ % 5) * 6, 2.3, 0, 7); ctx.fill(); }
      // 버스 (세로선)
      ctx.strokeStyle = css('--text'); ctx.lineWidth = 2;
      for (let i = Math.max(0, q.idx - 40); i <= Math.min(P.buses, q.idx + 41); i++) { const t = sim.bus[i]; if (t < lo || t > lo + W) continue; ctx.beginPath(); ctx.moveTo(X(t), y - 40); ctx.lineTo(X(t), y + 40); ctx.stroke(); }
      ctx.lineWidth = 1;
      // 이 승객
      const xp = X(q.t);
      ctx.strokeStyle = css('--unlucky'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xp, y - 44); ctx.lineTo(X(b1), y - 44); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = css('--unlucky'); ctx.beginPath(); ctx.arc(xp, y, 6.5, 0, 7); ctx.fill();
      ctx.textAlign = 'center'; ctx.font = FONT;
      ctx.fillStyle = css('--unlucky'); ctx.fillText(`기다린 시간 ${f1(q.wait)}분`, Math.min(Math.max((xp + X(b1)) / 2, m.l + 50), m.l + pw - 50), y - 52);
      ctx.fillStyle = GOLD; ctx.fillText('버스 간격', (X(b0) + X(b1)) / 2, y + 58);
      ctx.textAlign = 'left'; ctx.fillStyle = css('--muted');
      ctx.fillText('세로선: 버스, 빨간 점: 이 승객, 파란 점: 먼저 도착한 승객들', m.l, y + 80);
      // 지금까지의 평균 대기
      const H = sim.history, top = 150, bot = h - 16, th = sim.theory;
      const ymax = Math.max(th.wait, th.naive, ...H) * 1.15 || 1, Y = (v) => bot - (v / ymax) * (bot - top), Xi = (i) => m.l + (i / Math.max(1, P.n)) * pw;
      ctx.fillStyle = css('--text'); ctx.font = FONT_B;
      ctx.fillText(`지금까지 평균 대기 ${f1(sim.sumWait / sim.round)}분 (단순 계산 ${f1(th.naive)}분)`, m.l, top - 8);
      ctx.strokeStyle = '#8a93a6'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(th.naive)); ctx.lineTo(m.l + pw, Y(th.naive)); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.moveTo(m.l, Y(th.wait)); ctx.lineTo(m.l + pw, Y(th.wait)); ctx.stroke(); ctx.setLineDash([]);
      L.line(ctx, H.map((v, i) => [Xi(i), Y(v)]), css('--unlucky'), 2);
      ctx.font = FONT; ctx.textAlign = 'right'; ctx.fillStyle = '#8a93a6'; ctx.fillText('단순 계산', m.l + pw, Y(th.naive) + 14);
      ctx.fillStyle = GOLD; ctx.fillText('이론', m.l + pw, Y(th.wait) - 5);
    }
    $('when').textContent = `${sim.round}/${sim.params.n}명 · 평균 대기 ${f1(sim.round ? sim.sumWait / sim.round : 0)}분`;
  }

  // 두 분포를 같은 칸에 겹쳐 그리는 히스토그램. A: 하나씩 센 값, B: 사람이 겪은 값
  function overlay(c, A, B, o) {
    const { ctx, m, pw, ph } = c;
    const sorted = B.slice().sort((a, b) => a - b);
    const xmax = Math.max(o.minMax, Math.ceil(sorted[Math.floor(sorted.length * 0.99)] * 1.05));
    const nb = o.bins, bw = xmax / nb, ca = new Array(nb).fill(0), cb = new Array(nb).fill(0);
    A.forEach((v) => { const i = Math.floor(v / bw); if (i < nb) ca[i] += 1; }); B.forEach((v) => { const i = Math.floor(v / bw); if (i < nb) cb[i] += 1; });
    const da = ca.map((v) => v / A.length / bw), db = cb.map((v) => v / B.length / bw), ymax = Math.max(...da, ...db) * 1.08 || 1;
    const X = (v) => m.l + (v / xmax) * pw, Y = (v) => m.t + ph - (v / ymax) * ph;
    const step = xmax > 120 ? 40 : xmax > 60 ? 20 : xmax > 25 ? 10 : xmax > 12 ? 5 : 2, xt = []; for (let t = 0; t <= xmax; t += step) xt.push(t);
    L.axes(c, { X, Y, yTicks: [], xTicks: xt, xFmt: (v) => String(v), xLabel: o.xLabel });
    const px = pw / nb;
    ctx.fillStyle = mix(css('--accent'), 0.5); da.forEach((v, i) => { if (v > 0) ctx.fillRect(m.l + i * px + 0.5, Y(v), Math.max(1, px - 1), m.t + ph - Y(v)); });
    ctx.strokeStyle = '#e0a100'; ctx.lineWidth = 2; ctx.beginPath();
    db.forEach((v, i) => { const x0 = m.l + i * px, x1 = x0 + px; if (i === 0) ctx.moveTo(x0, Y(v)); else ctx.lineTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); }); ctx.stroke(); ctx.lineWidth = 1;
    const ma = A.reduce((s, v) => s + v, 0) / A.length, mb = B.reduce((s, v) => s + v, 0) / B.length;
    const vl = (v, col, label, row) => {
      if (v > xmax) return;
      ctx.setLineDash([4, 3]); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(X(v), m.t + 16 * row); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      const right = v > xmax * 0.6; ctx.fillStyle = col; ctx.textAlign = right ? 'right' : 'left'; ctx.font = FONT_B; ctx.fillText(label, X(v) + (right ? -5 : 5), m.t + 12 + 16 * (row - 1) + 4);
    };
    vl(ma, css('--accent'), o.labelA(ma), 1); vl(mb, GOLD, o.labelB(mb), 2);
    ctx.font = FONT;
  }

  // ---------- ② 간격 분포: 버스 vs 승객 ----------
  function drawHist() {
    const c = L.chart($('c-hist'), 0.7, { b: 40, l: 14 });
    overlay(c, Array.from(sim.heads), sim.seen(), {
      bins: 30, minMax: sim.params.mean * 2, xLabel: '버스 간격 (분)',
      labelA: (v) => `버스를 센 평균 ${f1(v)}분`, labelB: (v) => `승객이 본 평균 ${f1(v)}분`,
    });
  }

  // ---------- ③ 들쭉날쭉할수록 ----------
  function drawCv() {
    const P = sim.params, th = (cv) => IN.theory(P.mean, cv).wait, ymax = Math.max(5, Math.ceil(th(2) / 5) * 5);
    L.dots($('c-cv'), {
      data: rows[0] ? rows[0].pts : [], y0: 0, y1: ymax, yFmt: (v) => String(Math.round(v)),
      series: [{ data: CVS.map((cv) => ({ x: cv, mean: th(cv) })), color: GOLD }],
      x0: 0, x1: 2, xTicks: [0, 0.5, 1, 1.5, 2], xFmt: (v) => String(v), xLabel: '버스가 얼마나 들쭉날쭉한가 (변동계수)',
      refs: [{ y: P.mean / 2, label: '단순 계산 (평균 간격의 절반)', color: '#8a93a6' }], marker: { x: P.cv, label: '지금 설정' },
    });
  }

  // ---------- ④ 학급 인원 ----------
  function drawClass() {
    const c = L.chart($('c-class'), 0.7, { b: 40, l: 14 });
    const stu = []; cls.sizes.forEach((s) => { for (let i = 0; i < s; i++) stu.push(s); });
    overlay(c, cls.sizes, stu, {
      bins: 30, minMax: 40, xLabel: '학급 인원 (명)',
      labelA: (v) => `학급을 센 평균 ${f1(v)}명`, labelB: (v) => `학생이 말한 평균 ${f1(v)}명`,
    });
    $('note-c').innerHTML = `들쭉날쭉한 정도(변동계수)가 ${P_cv().toFixed(1)}이면 학급 평균 ${f1(cls.perClass)}명이 학생이 겪는 평균 ${f1(cls.perStudent)}명이 됩니다 (이론 ${f1(cls.theoryPerStudent)}명). 현실적인 편차(변동계수 0.3)라면 ${f1(cls3.perClass)}명이 ${f1(cls3.perStudent)}명입니다.`;
  }
  const P_cv = () => sim.params.cv;

  function renderStats() {
    const P = sim.params, th = sim.theory;
    const cards = [
      ['평균 버스 간격', f1(sim.busMean) + '분', `버스를 하나씩 센 평균 (설정 ${P.mean}분)`],
      ['승객이 본 평균 간격', f1(sim.meanSeen) + '분', `이론 ${f1(th.seen)}분 · 버스 평균의 ${(sim.meanSeen / sim.busMean).toFixed(1)}배`],
      ['평균 대기 시간', f1(sim.meanWait) + '분', `이론 ${f1(th.wait)}분 · ${P.n}명 기준`],
      ['단순 계산 (간격의 절반)', f1(sim.busMean / 2) + '분', `실제 대기는 이 값의 ${(sim.meanWait / (sim.busMean / 2)).toFixed(1)}배`],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function draw() { renderStats(); drawBus(); drawHist(); drawCv(); drawClass(); }

  function after() {
    const P = params(); rows = [{ pts: [] }]; drawCv(); $('note-cv').textContent = '계산 중…';
    const jobs = CVS.map((cv) => () => {
      const runs = [1, 2, 3].map((k) => IN.study({ mean: P.mean, cv }, 3000, k * 7).wait);
      rows[0].pts.push({ x: cv, runs, mean: L.mean(runs) });
    });
    L.jobs(jobs, () => drawCv(), () => {
      const at = (x) => rows[0].pts.find((p) => p.x === x).mean;
      $('note-cv').textContent = `시간표대로 오면(변동계수 0) ${f1(at(0))}분, 무작위로 오면(1) ${f1(at(1))}분, 많이 몰려 오면(2) ${f1(at(2))}분을 기다립니다 (평균 간격 ${P.mean}분)`;
    });
  }

  const h = L.harness({
    controls: ['mean', 'cv', 'n'],
    format: { mean: (v) => v + '분', cv: (v) => Number(v).toFixed(1), n: (v) => v + '명' },
    defaults: { mean: 10, cv: 1, n: 500 },
    build() {
      const P = params(); sim = IN.create(P);
      cls = IN.classes({ cv: P.cv, seed: P.seed }); cls3 = IN.classes({ cv: 0.3, seed: P.seed });
    },
    advance() { return sim.advance(); },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawHist(); drawCv(); drawClass(); }, seedLabel: '버스 노선 번호',
  });
  seedGetter = h.seed;
})();
