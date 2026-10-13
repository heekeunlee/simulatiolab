(function () {
  'use strict';
  const K = window.Checkout, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const COLORS = { one: '#2f6fed', short: '#e0a100', random: '#e5484d', items: '#1fa463' };
  const SHORT = { one: '한 줄', short: '짧은 줄', random: '무작위 줄', items: '물건 적은 줄' };
  const PANEL_TITLE = { one: 'A · 한 줄로 서기', short: 'B · 줄 따로, 사람 적은 줄', random: 'C · 줄 따로, 아무 줄', items: 'D · 줄 따로, 물건 적은 줄' };
  const THUMB = /[?&]thumb=1/.test(location.search);   // 썸네일 촬영: 줄이 길게 선 장면에서 멈춘다
  const WARM = 120, HORIZON = 240, STEP = 0.1;         // 화면은 가게 문 연 지 120분 뒤(줄이 자리 잡은 뒤)에 시작해 240분까지 (분 단위)
  const f1 = (v) => v.toFixed(1);
  let sc = null, T = WARM, me = 0, seedGetter = () => 1;
  let LR = null;                                        // 긴 시간 평균 결과
  let sweep = [], sweepKey = '';
  let pos = {};                                         // 화면 속 손님 위치 (부드럽게 이동)
  let hit = [];                                         // 클릭용 위치 목록

  const params = () => ({ k: Number($('k').value), rho: Number($('rho').value) / 100, cv: Number($('cv').value) });
  const strat = () => $('strat').value;

  // ---------- 가게 한 칸 그리기 ----------
  function snapshot(res, T, sepLines) {
    const k = sc.data.k, N = sc.N, arr = sc.data.arr, out = [], serving = new Array(k).fill(-1), rank = {};
    let waiting = 0, nextRank = 0, maxRank = 0;
    for (let i = 0; i < N && arr[i] <= T; i++) {
      if (res.end[i] <= T) continue;
      if (res.start[i] <= T) { serving[res.line[i]] = i; out.push({ i, st: 1, line: res.line[i], rank: 0 }); continue; }
      const q = sepLines ? res.qline[i] : -1; rank[q] = rank[q] == null ? 0 : rank[q] + 1;
      out.push({ i, st: 0, line: q, rank: rank[q] }); waiting++; if (rank[q] > maxRank) maxRank = rank[q];
    }
    return { list: out, serving, waiting, maxRank };
  }

  function drawStore(ctx, pn, T) {
    const { x, y, w, h, kind, res, small } = pn, k = sc.data.k, sep = kind !== 'one', col = COLORS[kind];
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = mix(col, 0.55); ctx.lineWidth = 2; L.roundRect(ctx, x, y, w, h, 10); ctx.stroke(); ctx.lineWidth = 1;
    const snap = snapshot(res, T, sep);
    ctx.textAlign = 'left'; ctx.font = '600 ' + (small ? 12 : 13) + 'px ' + FONT; ctx.fillStyle = THUMB ? 'rgba(0,0,0,0)' : col;
    if (!THUMB) ctx.fillText(PANEL_TITLE[kind], x + 12, y + 20);
    ctx.textAlign = 'right'; ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
    if (!THUMB) ctx.fillText(`기다리는 사람 ${snap.waiting}명`, x + w - 12, y + 20);
    // 계산대
    const colW = (w - 16) / k, cashY = y + (small ? 32 : 38), bw = Math.min(small ? 40 : 52, colW - 6), bh = small ? 18 : 22;
    const anyWait = snap.waiting > 0;
    for (let j = 0; j < k; j++) {
      const cx = x + 8 + colW * (j + 0.5), si = snap.serving[j], idle = si < 0, bad = idle && anyWait;
      ctx.fillStyle = bad ? mix('#e5484d', 0.22) : idle ? '#eef1f6' : mix(col, 0.16);
      ctx.strokeStyle = bad ? '#e5484d' : idle ? '#c9d0dc' : col; ctx.lineWidth = bad ? 2.4 : 1.4;
      L.roundRect(ctx, cx - bw / 2, cashY, bw, bh, 5); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
      if (si >= 0) { // 계산이 얼마나 진행됐는지
        const fr = Math.max(0, Math.min(1, (T - res.start[si]) / (res.end[si] - res.start[si])));
        ctx.fillStyle = mix(col, 0.55); ctx.fillRect(cx - bw / 2 + 3, cashY + bh - 6, (bw - 6) * fr, 3);
      } else if (bad && !THUMB && !small) { ctx.fillStyle = '#e5484d'; ctx.textAlign = 'center'; ctx.font = '600 10px ' + FONT; ctx.fillText('놀고 있음', cx, cashY + bh + 11); }
      else if (bad && !THUMB) { ctx.fillStyle = '#e5484d'; ctx.textAlign = 'center'; ctx.font = '600 10px ' + FONT; ctx.fillText('!', cx, cashY + bh + 11); }
    }
    // 줄 영역
    const rTop = cashY + bh + (small ? 22 : 26), rBot = y + h - (THUMB ? 8 : small ? 30 : 34);
    const rmax = Math.max(5, Math.min(small ? 8 : 11, colW * 0.36)), rmin = rmax * 0.5;
    const ncol = small ? 6 : 8;
    let sp, rows = 1;
    if (!sep) { rows = Math.max(1, Math.ceil((snap.maxRank + 1) / ncol)); sp = Math.max(7, Math.min(2 * rmax + 4, (rBot - rTop) / rows)); }
    else sp = Math.max(6, Math.min(2 * rmax + 3, (rBot - rTop) / (snap.maxRank + 1)));
    // 안내선
    ctx.strokeStyle = '#dde3ee'; ctx.setLineDash([3, 4]);
    if (sep) for (let j = 0; j < k; j++) { const cx = x + 8 + colW * (j + 0.5); ctx.beginPath(); ctx.moveTo(cx, cashY + bh + 4); ctx.lineTo(cx, rBot); ctx.stroke(); }
    else { const nr = Math.max(2, rows); for (let r = 0; r < nr; r++) { const yy = rTop + (r + 0.5) * sp; ctx.beginPath(); ctx.moveTo(x + 14, yy); ctx.lineTo(x + w - 14, yy); ctx.stroke(); } }
    ctx.setLineDash([]);
    // 손님
    const px = pn.pos;
    const sorted = snap.list.slice().sort((a, b) => a.st - b.st);
    sorted.forEach((c) => {
      const it = sc.data.items[c.i], r = rmin + (rmax - rmin) * Math.min(1, it / 20);
      let tx, ty;
      if (c.st === 1) { tx = x + 8 + colW * (c.line + 0.5); ty = cashY + bh / 2; }
      else if (sep) { tx = x + 8 + colW * (c.line + 0.5); ty = rTop + c.rank * sp + rmax; }
      else { const row = Math.floor(c.rank / ncol); let cc = c.rank % ncol; if (row % 2) cc = ncol - 1 - cc; tx = x + 18 + (w - 36) * (cc + 0.5) / ncol; ty = rTop + row * sp + sp / 2; }
      let p = px[c.i];
      if (!p) { p = px[c.i] = (T - sc.data.arr[c.i] > 1.2) ? { x: tx, y: ty } : { x: x + w / 2, y: y + h - 6 }; }
      p.x += (tx - p.x) * 0.35; p.y += (ty - p.y) * 0.35;
      c.px = p.x; c.py = p.y; c.r = r;
    });
    sorted.forEach((c) => {
      const serving = c.st === 1, heavy = Math.min(1, sc.data.items[c.i] / 20);
      ctx.fillStyle = serving ? mix(col, 0.95) : mix('#475569', 0.35 + 0.45 * heavy);
      ctx.beginPath(); ctx.arc(c.px, c.py, c.r, 0, 7); ctx.fill();
      if (!THUMB && c.r >= 8.5) { ctx.fillStyle = '#fff'; ctx.font = '600 ' + (c.r >= 10 ? 10 : 9) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(String(sc.data.items[c.i]), c.px, c.py + 3.5); }
      hit.push({ i: c.i, x: c.px, y: c.py, r: c.r });
    });
    // '나'
    const m = sorted.find((c) => c.i === me);
    if (m && !THUMB) {
      ctx.strokeStyle = '#f5b301'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.px, m.py, m.r + 4, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center'; const lw = 24;
      ctx.fillStyle = '#f5b301'; L.roundRect(ctx, m.px - lw / 2, m.py - m.r - 24, lw, 15, 7); ctx.fill();
      ctx.fillStyle = '#4a3600'; ctx.fillText('나', m.px, m.py - m.r - 13);
    }
    // 내 상태
    if (!THUMB) {
      const a = sc.data.arr[me], st = res.start[me];
      let txt;
      if (T < a) txt = '나: 아직 도착 전';
      else if (T < st) {
        let ahead = 0; for (let i = me + 1; i < sc.N && sc.data.arr[i] <= T; i++) if (res.start[i] <= T && res.start[i] < st) ahead++;
        txt = ahead > 0 ? (small ? `나: ${f1(T - a)}분째 · 뒤에 온 ${ahead}명이 먼저 계산` : `나: ${f1(T - a)}분째 기다리는 중 · 뒤에 온 ${ahead}명이 먼저 계산`) : `나: ${f1(T - a)}분째 기다리는 중`;
      } else txt = `나: ${f1(st - a)}분 기다리고 계산 시작`;
      ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#7a5a00'; ctx.fillText(txt, x + 12, y + h - 12);
    }
  }

  function drawStoreCanvas() {
    const cv = $('c-store'), cw = cv.clientWidth || 800, stacked = THUMB || cw < 700;
    const gap = 12, strip = THUMB ? 0 : 30, ph = stacked ? (THUMB ? 0 : 0) : 0;
    let asp, panelH;
    if (THUMB) { panelH = (cw - gap) / 2; asp = 1; }
    else if (stacked) { panelH = 270; asp = (panelH * 2 + gap + strip) / cw; }
    else { panelH = Math.max(380, Math.min(500, cw * 0.5)); asp = (panelH + strip) / cw; }
    const c = L.chart(cv, asp, { l: 0, r: 0, t: 0, b: 0 }), { ctx, w, h } = c;
    hit = [];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const pw = stacked ? w : (w - gap) / 2;
    const pns = [
      { x: 0, y: 0, w: pw, h: panelH, kind: 'one', res: sc.A, small: stacked && cw < 520, pos: pos.A || (pos.A = {}) },
      { x: stacked ? 0 : pw + gap, y: stacked ? panelH + gap : 0, w: pw, h: panelH, kind: sc.strat, res: sc.B, small: stacked && cw < 520, pos: pos.B || (pos.B = {}) },
    ];
    pns.forEach((pn) => drawStore(ctx, pn, T));
    // 같은 손님 비교
    if (!THUMB) {
      const a = sc.data.arr[me], sa = sc.A.start[me], sb = sc.B.start[me], yy = h - 10;
      ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center';
      const fit = (txt) => { let fs = 13; while (fs > 9 && ctx.measureText(txt).width > w - 10) { fs--; ctx.font = '600 ' + fs + 'px ' + FONT; } return txt; };
      if (T >= sa && T >= sb) {
        const wa = sa - a, wb = sb - a, d = wb - wa;
        ctx.fillStyle = d > 0.05 ? '#c2352f' : d < -0.05 ? '#14804f' : css('--text');
        const msg = fit(d > 0.05 ? `나: 한 줄이면 ${f1(wa)}분, 줄 따로면 ${f1(wb)}분 (${f1(d)}분 더 걸림)` : d < -0.05 ? `나: 한 줄이면 ${f1(wa)}분, 줄 따로면 ${f1(wb)}분 (${f1(-d)}분 덜 걸림)` : `나: 한 줄이면 ${f1(wa)}분, 줄 따로면 ${f1(wb)}분 (차이 없음)`); ctx.fillText(msg, w / 2, yy);
      } else { ctx.fillStyle = css('--muted'); ctx.fillText('손님 점을 눌러 \'나\'를 바꿔 보세요 (점 크기 = 물건 수)', w / 2, yy); }
    }
    $('when').textContent = `가게 문 연 지 ${Math.round(T)}분`;
    // 뒤에 오는 렌더 단계에서 클릭용 위치를 쓰도록 저장
  }

  // ---------- 숫자 카드 ----------
  function longRun() {
    const P = params(), s = strat(), N = 150000;
    const data = K.gen(P, 777 + seedGetter(), N), rA = K.run(data, 'one'), rB = K.run(data, s);
    const a = K.summarize(data, rA), b = K.summarize(data, rB);
    LR = { a, b, pair: K.paired(data, rA, rB), idle: K.idleWait(data, rB), s, P };
  }
  function renderStats() {
    if (!LR) return;
    const { a, b, pair, idle, s } = LR, ratio = b.mean / Math.max(0.05, a.mean);
    const cards = [
      ['뒤에 온 손님에게 추월당하는 손님', `${Math.round(b.overtaken * 100)}%`, '줄 따로일 때. 한 줄은 0% (먼저 온 순서대로 계산)'],
      ['평균 기다림: 한 줄 → 줄 따로', `${f1(a.mean)} → ${f1(b.mean)}분`, `×${ratio.toFixed(2)} · 손님 15만 명으로 낸 긴 시간 평균`],
      ['10명 중 9명이 기다리는 시간 이내', `${f1(a.p90)} → ${f1(b.p90)}분`, '90% 대기시간 (한 줄 → 줄 따로)'],
      ['놀고 있는 계산대 + 기다리는 사람', `${(idle * 100).toFixed(0)}%`, '계산대가 비었는데 다른 줄엔 손님이 있는 시간. 한 줄은 0%'],
    ];
    $('stats').innerHTML = cards.map(([k, v, t]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
  }

  // ---------- 차트 ----------
  function niceTicks(max) {
    const raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) || raw;
    const t = []; for (let v = 0; v <= max + st * 0.01; v += st) t.push(+v.toFixed(6)); return { st, ticks: t, top: t[t.length - 1] };
  }
  function sweepChart(id, key, theory, yName) {
    const P = params(), cv = $(id);
    const c = L.chart(cv, window.innerWidth < 560 ? 0.9 : 0.62, { l: 46, r: 16, t: 24, b: 42 }), { ctx, m, pw, ph } = c;
    const done = sweep.filter(Boolean);
    let hi = 1; done.forEach((d) => ['one', 'short', 'items'].forEach((s) => { hi = Math.max(hi, d[s][key]); }));
    const nt = niceTicks(hi * 1.25), X = (v) => m.l + ((v - 0.5) / 0.46) * pw, Y = (v) => m.t + ph - (v / nt.top) * ph;
    L.axes(c, { X, Y, yTicks: nt.ticks, yFmt: (v) => String(v), xTicks: [0.5, 0.6, 0.7, 0.8, 0.9], xFmt: (v) => String(Math.round(v * 100)), xLabel: '붐빔 정도 (%)', yLabel: yName });
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t - 4, pw + 6, ph + 4); ctx.clip();
    ['random', 'items', 'short', 'one'].forEach((s) => {
      const pts = done.map((d) => [X(d.rho), Y(d[s][key])]);
      L.line(ctx, pts, COLORS[s], s === 'one' ? 3 : 2.4);
    });
    ctx.restore();
    if (theory) {
      ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t - 4, pw + 6, ph + 4); ctx.clip(); ctx.setLineDash([5, 4]);
      ['one', 'random'].forEach((s) => {
        const pts = []; for (let r = 0.5; r <= 0.9601; r += 0.01) pts.push([X(r), Y(theory(s, P.k, r, P.cv))]);
        L.line(ctx, pts, s === 'one' ? '#1b3f99' : '#9b1c20', 1.6);
      });
      ctx.setLineDash([]); ctx.restore();
    }
    L.vline(c, X(P.rho), css('--rich'), '지금 설정', P.rho > 0.78 ? 'right' : 'left');
    if (!done.length) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('계산 중…', m.l + pw / 2, m.t + ph / 2); }
    const lg = [['one', 'A'], ['short', 'B'], ['items', 'D'], ['random', 'C']].map(([s]) => ({ kind: 'line', color: COLORS[s], label: SHORT[s] }));
    if (theory) lg.push({ kind: 'dash', color: '#6b7280', label: '점선: 이론값' });
    L.legend(c, lg, 'tl');
  }
  const thMean = (s, k, r, cv) => (s === 'one' ? K.theoryOne(k, r, cv).mean : K.theoryRandom(k, r, cv).mean);
  const thP90 = (s, k, r) => (s === 'one' ? K.theoryOne(k, r, 1).p90 : K.theoryRandom(k, r, 1).p90);
  function drawMean() { sweepChart('c-mean', 'mean', thMean, '평균 대기시간 (분)'); }
  function drawP90() { sweepChart('c-p90', 'p90', Math.abs(params().cv - 1) < 0.05 ? thP90 : null, '90% 대기시간 (분)'); }

  function drawHist() {
    if (!LR) return;
    const cv = $('c-hist'), c = L.chart(cv, window.innerWidth < 560 ? 0.9 : 0.62, { l: 46, r: 16, t: 24, b: 42 }), { ctx, m, pw, ph } = c;
    const A = LR.a.waits, B = LR.b.waits, all = A.concat(B).sort((x, y) => x - y);
    const cap = Math.max(10, Math.ceil(all[Math.floor(all.length * 0.97)] / 5) * 5), nb = cap;
    const hist = (arr) => { const h = new Array(nb).fill(0); arr.forEach((v) => { h[Math.min(nb - 1, Math.floor(v))]++; }); return h.map((v) => (v / arr.length) * 100); };
    const hA = hist(A), hB = hist(B), top = niceTicks(Math.max.apply(null, hA.concat(hB)) * 1.1);
    const X = (v) => m.l + (v / nb) * pw, Y = (v) => m.t + ph - (v / top.top) * ph;
    const xt = []; for (let v = 0; v <= nb; v += cap > 30 ? 10 : 5) xt.push(v);
    L.axes(c, { X, Y, yTicks: top.ticks, yFmt: (v) => String(v), xTicks: xt, xFmt: (v) => String(v), xLabel: '기다린 시간 (분, 끝 칸은 그 이상)', yLabel: '손님 비율 (%)' });
    const bw = pw / nb;
    ctx.fillStyle = mix(COLORS.one, 0.55); hA.forEach((v, i) => ctx.fillRect(X(i) + 1, Y(v), Math.max(1, bw - 2), Y(0) - Y(v)));
    const col = COLORS[LR.s]; ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath();
    hB.forEach((v, i) => { const x0 = X(i), x1 = X(i + 1); i ? ctx.lineTo(x0, Y(v)) : ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); });
    ctx.stroke(); ctx.lineWidth = 1;
    L.legend(c, [{ kind: 'box', color: mix(COLORS.one, 0.55), label: `${SHORT.one}: 바로 계산 ${Math.round(LR.a.zero * 100)}%` }, { kind: 'line', color: col, label: `${SHORT[LR.s]}: 바로 계산 ${Math.round(LR.b.zero * 100)}%` }], 'tr');
  }
  function notes() {
    $('note-mean').innerHTML = `<span>${Math.abs(params().cv - 1) < 0.05 ? '점선은 이론값 (얼랑 C 공식과 줄마다 M/M/1). 시뮬레이션과 거의 겹칩니다' : '점선은 이론 근사 (계산 시간이 지수분포가 아니라 한 줄은 근사, 무작위 줄은 폴라체크-힌친 공식)'}</span>`;
    $('note-p90').innerHTML = `<span>${Math.abs(params().cv - 1) < 0.05 ? '점선은 이론값 (계산 시간이 지수분포일 때 정확한 식)' : '90% 이론식은 계산 시간이 지수분포(들쭉날쭉함 1.0)일 때만 정확해서, 지금은 그리지 않았습니다'}</span>`;
  }

  function runSweep() {
    const P = params(), key = P.k + '|' + P.cv;
    if (key === sweepKey && sweep.filter(Boolean).length) { drawMean(); drawP90(); return; }
    sweepKey = key; sweep = [];
    const jobs = []; for (let r = 50; r <= 96; r += 2) jobs.push(() => { sweep.push(K.sweepPoint(P, r / 100, 30000, 2)); });
    L.jobs(jobs, () => { if (sweep.length % 6 === 0) { drawMean(); drawP90(); } }, () => { drawMean(); drawP90(); });
  }

  function draw() { drawStoreCanvas(); }
  function after() { longRun(); renderStats(); drawHist(); notes(); runSweep(); }

  if (THUMB) { $('rho').value = 95; $('k').value = 5; }
  const h = L.harness({
    controls: ['k', 'rho', 'cv', 'strat'],
    format: { k: (v) => String(v), rho: (v) => v + '%', cv: (v) => Number(v).toFixed(1), strat: () => '' },
    defaults: { k: 4, rho: 90, cv: 1, strat: 'short' },
    build(seed) {
      sc = K.scene(params(), seed, strat(), HORIZON, WARM);
      T = WARM; me = sc.me; pos = {};
      if (THUMB) { // 줄이 가장 길게 선 순간의 장면
        let best = -1;
        for (let t = WARM; t < WARM + 90; t += 1) { let n = 0; for (let i = 0; i < sc.N && sc.data.arr[i] <= t; i++) if (sc.B.start[i] > t) n++; if (n > best) { best = n; T = t; } }
      }
    },
    autoplay: !THUMB,
    advance() { T += STEP; return T < HORIZON; },
    isDone() { return T >= HORIZON; },
    draw, after, redrawExtra() { drawMean(); drawP90(); drawHist(); }, seedLabel: '손님 번호', speedScale: 1,
  });
  seedGetter = h.seed;

  // 손님을 눌러 '나'로 삼기
  $('c-store').addEventListener('click', (e) => {
    const r = $('c-store').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 18 * 18;
    hit.forEach((c) => { const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y); if (d < bd) { bd = d; best = c; } });
    if (best) { me = best.i; drawStoreCanvas(); }
  });
})();
