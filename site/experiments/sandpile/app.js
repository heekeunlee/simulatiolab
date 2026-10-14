(function () {
  'use strict';
  const SP = window.Sandpile, L = window.Lab;
  const { css, mix } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search); // 썸네일 촬영: 안정기에 들어선 더미와 큰 눈사태 한 장면으로 바로 간다
  const CAP = 100000; // 알 개수 상한
  // 높이 0~3의 색: 짙은 남색, 청록, 노랑, 분홍빨강
  const PAL = [[14, 18, 52], [24, 168, 196], [250, 194, 48], [240, 62, 112]];
  const HCOL = PAL.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
  let sim = null, seedGetter = () => 1, off = null, offCtx = null, img = null, chartTimer = 0, lastChart = 0;
  const params = () => ({ seed: seedGetter(), size: Number($('size').value), mode: $('mode').value });
  const f2 = (v) => v.toFixed(2);
  const isPaused = () => { const b = $('play'); return !b || b.textContent.indexOf('⏸') < 0; };

  // 눈금 간격을 보기 좋은 수(1, 2, 5 x 10^k)로
  function niceMax(v) { const e = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; }
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const pow10 = (k) => (k >= -3 && k <= 4 ? String(Math.pow(10, k)) : '10' + String(k).split('').map((c) => SUP[c]).join(''));

  // ---------- ① 모래더미 ----------
  function flashF() { // 눈사태 번쩍임이 남는 알 개수. 멈춰 있으면 마지막 한 알의 눈사태만
    if (isPaused()) return 1;
    const sp = Number(($('speed') || { value: 10 }).value) * 0.7;
    return Math.max(3, Math.min(40, Math.round(sp * 0.012)));
  }
  // 3D 보기(app3d.js)가 따라가는 상태: 같은 sim을 그대로 보여 준다(3D는 따로 계산하지 않음)
  function share() { window.SandpileState = { sim, flashF, isPaused, thumb: THUMB }; }
  function drawPile() {
    share();
    const cw = $('c-pile').clientWidth || 600, mobile = cw < 640, N = sim.N, m = 12;
    let side, asp;
    if (THUMB) { side = cw; asp = 1; }
    else if (mobile) { side = cw - 2 * m; asp = (side + 2 * m + 128) / cw; }
    else { side = Math.min(Math.round(cw * 0.46), 560); asp = (side + 2 * m) / cw; }
    const { ctx, w, h } = L.setup($('c-pile'), asp);
    ctx.fillStyle = THUMB ? '#0e1234' : css('--surface'); ctx.fillRect(0, 0, w, h);
    const ox = THUMB ? 0 : m, oy = THUMB ? 0 : m;
    if (!off || off.width !== N) { off = document.createElement('canvas'); off.width = off.height = N; offCtx = off.getContext('2d'); img = offCtx.createImageData(N, N); }
    const F = flashF(), now = sim.t - 1, d = img.data, hh = sim.h, st = sim.stamp;
    for (let i = 0; i < N * N; i++) {
      const c = PAL[hh[i]], age = now - st[i], k = age < F ? (1 - age / F) * (1 - age / F) : 0, o = i * 4;
      d[o] = c[0] + (255 - c[0]) * k; d[o + 1] = c[1] + (255 - c[1]) * k; d[o + 2] = c[2] + (255 - c[2]) * k; d[o + 3] = 255;
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(off, ox, oy, side, side);
    const cell = side / N;
    if (sim.lastSite >= 0 && (F <= 20 || isPaused())) { // 방금 떨어진 자리
      const x = sim.lastSite % N, y = (sim.lastSite - x) / N;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, Math.max(5, cell * 1.1), 0, 7); ctx.stroke();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, Math.max(5, cell * 1.1) + 1.5, 0, 7); ctx.stroke();
    }
    if (THUMB) return;
    // 오른쪽(휴대폰은 아래) 읽는 곳: 마지막 한 알의 결과와 높이별 칸 비율
    const sh = sim.heightShares(), names = [0, 1, 2, 3];
    const rx = mobile ? m : ox + side + 36, rw = mobile ? w - 2 * m : w - rx - m;
    let y = mobile ? oy + side + 24 : 34;
    ctx.textAlign = 'left'; ctx.fillStyle = css('--muted'); ctx.font = '12px ' + FONT;
    ctx.fillText('방금 떨어뜨린 알의 결과', rx, y);
    y += mobile ? 26 : 40; ctx.fillStyle = sim.lastSize >= 100 ? HCOL[3] : css('--text'); ctx.font = '700 ' + (mobile ? 20 : 30) + 'px ' + FONT;
    ctx.fillText(sim.t === 0 ? '아직 떨어뜨리지 않았어요' : sim.lastSize === 0 ? '아무 일 없었음' : `${sim.lastSize}번 무너짐`, rx, y);
    y += mobile ? 28 : 46; ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted');
    ctx.fillText(`지금까지 떨어뜨린 알 ${sim.t}개`, rx, y);
    y += mobile ? 22 : 34; ctx.fillStyle = css('--muted'); ctx.fillText('높이별 칸 비율', rx, y); y += 10;
    const bh = 16, gap = mobile ? 6 : 12;
    names.forEach((k) => {
      ctx.fillStyle = css('--line'); ctx.fillRect(rx + 74, y, rw - 74 - 44, bh);
      ctx.fillStyle = HCOL[k]; ctx.fillRect(rx + 74, y, (rw - 74 - 44) * sh[k], bh);
      ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.fillText(`높이 ${k}`, rx, y + 12);
      ctx.textAlign = 'right'; ctx.fillText(`${Math.round(sh[k] * 100)}%`, rx + rw, y + 12);
      y += bh + gap;
    });
    ctx.textAlign = 'left'; ctx.fillStyle = css('--muted'); ctx.font = '11px ' + FONT;
    ctx.fillText('높이 4가 되면 무너집니다', rx, y + 4);
  }

  // ---------- ② 눈사태 크기의 시간 흐름 ----------
  function xAxisTicks(tmax) { const st = niceMax(tmax / 4), a = []; for (let v = 0; v <= tmax; v += st) a.push(v); return a; }
  function burnShade(ctx, X, c) {
    const bx = X(Math.min(sim.burnAt, c.xmax));
    ctx.fillStyle = mix('#8a93a6', 0.14); ctx.fillRect(c.m.l, c.m.t, bx - c.m.l, c.ph);
    if (bx - c.m.l > 90) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = '11px ' + FONT; ctx.fillText('쌓는 중', c.m.l + 6, c.m.t + c.ph - 8); }
    else if (sim.t > sim.burnAt) { ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; ctx.font = '11px ' + FONT; }
    ctx.font = '12px ' + FONT;
  }
  function drawSizes() {
    const t = sim.t, xmax = Math.max(t, Math.round(sim.burnAt * 1.3), 10), S = sim.sizes;
    let mx = 10; for (let i = 0; i < t; i++) if (S[i] > mx) mx = S[i];
    const ymax = niceMax(mx * 1.1), c = L.chart($('c-size'), 0.62, { l: 52, r: 14, t: 24, b: 40 }), { ctx, m, pw, ph } = c; c.xmax = xmax;
    const X = (v) => m.l + (v / xmax) * pw, Y = (v) => m.t + ph - (v / ymax) * ph;
    L.axes(c, { X, Y, yTicks: [0, ymax / 2, ymax], yFmt: (v) => String(Math.round(v)), xTicks: xAxisTicks(xmax), xFmt: (v) => String(Math.round(v)), xLabel: '떨어뜨린 알 수 (개)', yLabel: '눈사태 크기 (무너진 횟수)' });
    burnShade(ctx, X, c);
    // 화면 한 칸(픽셀)에 들어가는 알들 중 가장 큰 눈사태를 세운다
    const cols = Math.max(1, Math.floor(pw)), best = new Float32Array(cols);
    for (let i = 0; i < t; i++) { const k = Math.min(cols - 1, Math.floor((i / xmax) * cols)); if (S[i] > best[k]) best[k] = S[i]; }
    ctx.strokeStyle = css('--accent'); ctx.lineWidth = 1.3; ctx.beginPath();
    let bi = -1, bv = 0;
    for (let k = 0; k < cols; k++) { if (best[k] > 0) { ctx.moveTo(m.l + k + 0.5, Y(0)); ctx.lineTo(m.l + k + 0.5, Y(best[k])); if (best[k] > bv) { bv = best[k]; bi = k; } } }
    ctx.stroke(); ctx.lineWidth = 1;
    if (bi >= 0 && bv >= 40) { ctx.fillStyle = css('--text'); ctx.textAlign = bi > cols * 0.75 ? 'right' : 'left'; L.label(ctx, `최대 ${bv}번`, m.l + bi + (bi > cols * 0.75 ? -5 : 5), Y(bv) + 4, ctx.textAlign); }
  }

  // ---------- ③ 눈사태 크기 분포 (로그-로그) ----------
  function drawDist() {
    const c = L.chart($('c-dist'), 0.62, { l: 56, r: 16, t: 24, b: 40 }), { ctx, m, pw, ph } = c, D = sim.dist();
    if (!D.pts.length) {
      const x0 = 0, x1 = 3, X = (v) => m.l + ((v - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph + (v / 4) * ph;
      L.axes(c, { X, Y, yTicks: [0, -1, -2, -3, -4], yFmt: (v) => pow10(v), xTicks: [0, 1, 2, 3], xFmt: (v) => pow10(v), xLabel: '눈사태 크기 (무너진 횟수, 로그 눈금)', yLabel: '비율 (크기 한 단위당)' });
      ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('더미가 안정기에 들어서면 분포가 그려져요', m.l + pw / 2, m.t + ph / 2);
      return;
    }
    const x1 = Math.max(2, Math.ceil(Math.log10(sim.maxSize * 1.2))), minY = Math.min(...D.pts.map((q) => Math.log10(q.y))), y0 = Math.min(-2, Math.floor(minY));
    const X = (v) => m.l + (v / x1) * pw, Y = (v) => m.t + ((0.1 - v) / (0.1 - y0)) * ph; // v = log10
    const yt = [], xt = []; for (let k = y0; k <= 0; k++) yt.push(k); for (let k = 0; k <= x1; k++) xt.push(k);
    L.axes(c, { X, Y, yTicks: yt, yFmt: (v) => pow10(v), xTicks: xt, xFmt: (v) => pow10(v), xLabel: '눈사태 크기 (무너진 횟수, 로그 눈금)', yLabel: '비율 (크기 한 단위당)' });
    D.pts.forEach((q) => {
      ctx.fillStyle = q.n >= 10 ? mix(css('--accent'), 0.9) : mix('#8a93a6', 0.6);
      ctx.beginPath(); ctx.arc(X(Math.log10(q.x)), Y(Math.log10(q.y)), q.n >= 10 ? 4 : 3, 0, 7); ctx.fill();
    });
    if (D.slope != null) {
      const a = Math.log10(D.used[0]), b = Math.log10(D.used[1]), col = '#e5484d';
      ctx.setLineDash([6, 4]); L.line(ctx, [[X(a), Y(D.icpt + D.slope * a)], [X(b), Y(D.icpt + D.slope * b)]], col, 2.4); ctx.setLineDash([]);
    }
    const lg = [{ kind: 'dot', color: mix(css('--accent'), 0.9), label: '표본 10개 이상인 점' }, { kind: 'dot', color: mix('#8a93a6', 0.6), label: '표본이 적은 점' }];
    if (D.slope != null) lg.push({ kind: 'dash', color: '#e5484d', label: `기울기 ${f2(D.slope)} (측정)` });
    L.legend(c, lg, 'tr');
  }

  // ---------- ④ 평균 높이 ----------
  function drawHeight() {
    const t = sim.t, xmax = Math.max(t, Math.round(sim.burnAt * 1.3), 10), M = sim.means;
    const c = L.chart($('c-height'), 0.62, { l: 52, r: 14, t: 24, b: 40 }), { ctx, m, pw, ph } = c; c.xmax = xmax;
    const X = (v) => m.l + (v / xmax) * pw, Y = (v) => m.t + ph - (v / 3) * ph;
    L.axes(c, { X, Y, yTicks: [0, 1, 2, 3], yFmt: (v) => String(v), xTicks: xAxisTicks(xmax), xFmt: (v) => String(Math.round(v)), xLabel: '떨어뜨린 알 수 (개)', yLabel: '칸당 평균 모래알 수 (개)' });
    burnShade(ctx, X, c);
    const lg = [{ kind: 'line', color: css('--accent'), label: '칸당 평균 높이' }];
    if (t > sim.burnAt + 50) {
      let s = 0; for (let i = sim.burnAt; i < t; i++) s += M[i];
      const pl = s / (t - sim.burnAt);
      ctx.setLineDash([5, 3]); ctx.strokeStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(m.l, Y(pl)); ctx.lineTo(m.l + pw, Y(pl)); ctx.stroke(); ctx.setLineDash([]);
      lg.push({ kind: 'dash', color: '#e5484d', label: `안정기 평균 ${f2(pl)}` });
    }
    const step = Math.max(1, Math.floor(t / pw)), pts = [];
    for (let i = 0; i < t; i += step) pts.push([X(i), Y(M[i])]);
    if (t) pts.push([X(t - 1), Y(M[t - 1])]);
    L.line(ctx, pts, css('--accent'), 2.6);
    L.legend(c, lg, 'br');
  }

  // ---------- 숫자 카드 ----------
  function renderStats() {
    const ready = sim.nz >= 30, D = ready ? sim.dist() : null, med = ready ? sim.median() : 0;
    const dash = '–', wait = '안정기에 들어서면 계산돼요';
    const cards = [
      ['가장 큰 눈사태 ÷ 보통 눈사태', ready ? `${Math.round(sim.maxSize / Math.max(1, med))}배` : dash, ready ? `최대 ${sim.maxSize}번 무너짐 · 보통(중앙값) ${med}번` : wait],
      ['칸당 평균 높이', f2(sim.mean()), '올라가다가 어느 값에서 멈춰요'],
      ['알을 떨어뜨렸는데 아무 일 없던 비율', ready ? `${Math.round((sim.zero / sim.post) * 100)}%` : dash, ready ? `안정기 이후 떨어뜨린 알 ${sim.post}개 중` : wait],
      ['눈사태 크기 분포의 기울기 (측정)', D && D.slope != null ? f2(D.slope) : dash, D && D.slope != null ? `로그-로그 직선을 맞춘 값 · 눈사태 ${sim.nz}개` : wait],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function drawCharts() { clearTimeout(chartTimer); lastChart = performance.now(); renderStats(); drawSizes(); drawDist(); drawHeight(); }
  function draw() {
    drawPile();
    if (performance.now() - lastChart > 100) drawCharts();
    else { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 130); }
  }

  const h = L.harness({
    controls: ['size', 'mode'],
    format: { size: (v) => v + '×' + v, mode: () => '' },
    defaults: { size: 40, mode: 'random' },
    build() {
      sim = SP.create(params());
      if (THUMB) { // 안정기에 들어선 뒤 큰 눈사태가 난 장면에서 멈춘다
        const N = sim.N; for (let i = 0; i < 4 * N * N; i++) sim.drop();
        for (let i = 0; i < 20000 && sim.lastSize < 0.04 * N * N * 2.5; i++) sim.drop();
      }
    },
    autoplay: !THUMB,
    advance() { if (sim.t >= CAP) return false; sim.drop(); return true; },
    isDone() { return sim.t >= CAP; },
    draw, seedLabel: '모래더미 번호',
  });
  seedGetter = h.seed;

  // 모래 한 알만 떨어뜨리기: 멈춘 채로 그 한 알이 무엇을 일으키는지 본다
  $('one').addEventListener('click', () => {
    if (!isPaused()) $('play').click();
    if (sim.t < CAP) sim.drop();
    drawPile(); drawCharts();
  });
})();
