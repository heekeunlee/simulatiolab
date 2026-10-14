(function () {
  'use strict';
  const H = window.Harmony, L = window.Lab;
  const { css, mix, roundRect } = L;
  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const THUMB = /[?&]thumb=1/.test(location.search), AT = +((location.search.match(/[?&]at=(\d+)/) || [])[1] || 0); // 확인용: ?at=센트 (그 자리까지 올라가 멈춤) // 썸네일 촬영: 한 옥타브를 다 올라가 골이 모두 드러난 곡선으로 바로 간다
  const tr = (s) => (window.I18N && window.I18N.lang !== 'ko' ? window.I18N.t(s) : s);
  const LOW = '#2f6fed', HIGH = '#e07b39', GREEN = '#1fa463', GRAY = '#b4bccb', INK = '#1a1d26';
  let sim = null, seedGetter = () => 1, sweepCounts = null, sweepKey = '';
  const params = () => ({ seed: seedGetter(), N: Number($('N').value), target: Number($('target').value) });

  // 간격 이름: 반음 자리에서 15센트 안이면 그 이름, 아니면 '○○ 근처'
  const nameOf = (c) => { const n = H.nearest(c); return Math.abs(c - n.c) <= 15 ? n.ko : `${n.ko} 근처`; };
  const simple = (c) => { const r = H.nearestRatio(c, 8); return r && r.err <= 8 ? r : null; }; // 파형이 되풀이될 만큼 단순한 비 (8센트 안)

  function chipAt(ctx, text, cx, cy, color, font) {   // 글상자(가운데 cx, 위 cy) 그리기 → 상자 크기 반환
    ctx.font = font || ('600 12px ' + FONT);
    const tw = ctx.measureText(text).width + 16, th = 22, x = cx - tw / 2;
    ctx.save(); ctx.shadowColor = 'rgba(20,30,60,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; roundRect(ctx, x, cy, tw, th, 11); ctx.fill(); ctx.restore();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; roundRect(ctx, x, cy, tw, th, 11); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, cx, cy + 15); ctx.lineWidth = 1;
    return { x, y: cy, w: tw, h: th };
  }

  // ---------- ① 합쳐진 소리의 모양 (스스로 흐르는 애니메이션) ----------
  let tA = 0, lastWave = 0;
  function wave(t, r, A, N, f0) {   // 두 음을 합친 순간값 (-1~1)
    let s = 0, n = 0;
    for (let k = 0; k < N; k++) { s += A[k] * Math.sin(2 * Math.PI * f0 * (k + 1) * t) + A[k] * Math.sin(2 * Math.PI * f0 * r * (k + 1) * t); n += 2 * A[k]; }
    return s / n;
  }
  function tone(t, r, A, N, f0) { let s = 0, n = 0; for (let k = 0; k < N; k++) { s += A[k] * Math.sin(2 * Math.PI * f0 * r * (k + 1) * t); n += A[k]; } return s / n; }

  // 0.25초 동안 소리의 위아래 폭: 낮은 음 네 주기 창 안의 최댓값·최솟값 (간격이 바뀔 때만 다시 계산)
  let envCache = { key: '' };
  function envelope(r, A, N, f0, cols) {
    const key = [r, N, cols, A.join(',')].join('|'); if (envCache.key === key) return envCache;
    const per = 24, win = per * 4, dt = 1 / (f0 * per), n = Math.ceil(0.25 / dt) + win, v = new Float32Array(n);   // 창 = 낮은 음 4주기 (단순한 비의 되풀이를 덮고, 느린 울렁임은 남긴다)
    for (let i = 0; i < n; i++) v[i] = wave(i * dt, r, A, N, f0);
    const hi = new Float32Array(cols), lo = new Float32Array(cols);
    for (let c = 0; c < cols; c++) { const i0 = Math.floor((c / cols) * (n - win)); let mx = -1, mn = 1; for (let k = 0; k < win; k++) { const x = v[i0 + k]; if (x > mx) mx = x; if (x < mn) mn = x; } hi[c] = mx; lo[c] = mn; }
    return (envCache = { key, hi, lo });
  }
  function drawWave() {
    const cv = $('c-wave'), cw = cv.clientWidth || 700, mobile = cw < 560;
    const { ctx, w, h } = L.setup(cv, mobile ? 1.0 : 0.46);
    const P = sim.params, A = sim.amps, N = P.N, f0 = P.f0, c = sim.c, r = H.ratio(c), now = sim.now();
    const pad = 12;
    // 머리줄: 간격 이름과 거칠기 큰 숫자
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = `700 ${mobile ? 19 : 22}px ${FONT}`;
    ctx.fillText(nameOf(c), pad, 30);
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted');
    const sr = simple(c);
    ctx.fillText(sr ? `진동수 비 ${r.toFixed(3)} ≈ ${sr.p}:${sr.q}` : `진동수 비 ${r.toFixed(3)}`, pad, 48);
    const gw = mobile ? 96 : 170, gx = w - pad - gw;
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `700 ${mobile ? 24 : 28}px ${FONT}`; ctx.fillText(String(Math.round(now)), w - pad, 30);
    const numW = ctx.measureText(String(Math.round(now))).width;
    ctx.font = '12px ' + FONT; ctx.fillStyle = css('--muted'); ctx.fillText('거칠기', w - pad - numW - 6, 30);
    ctx.fillStyle = '#e9edf4'; roundRect(ctx, gx, 40, gw, 8, 4); ctx.fill();
    ctx.fillStyle = mix('#e5484d', 0.35 + 0.65 * now / 100); roundRect(ctx, gx, 40, Math.max(4, gw * now / 100), 8, 4); ctx.fill();

    // 가운데 칸: 가까이 본 파형
    const top = 62, laneA = (h - top) * 0.55, yA = top, yB = top + laneA + 8, laneB = h - yB - 6;
    const x0 = pad, x1 = w - pad, pw = x1 - x0, periods = mobile ? 4 : 6, span = periods / f0;
    ctx.textAlign = 'left'; ctx.font = '600 11.5px ' + FONT; ctx.fillStyle = css('--text');
    ctx.fillText('가까이 본 파형 (약 0.02초)', x0, yA + 12);
    const thinH = laneA * 0.22, thinY = yA + 22 + thinH / 2, sumY = yA + 22 + thinH + 8 + (laneA - thinH - 38) / 2, sumA = (laneA - thinH - 38) / 2;
    // 되풀이 표시: 단순한 비 p:q면 낮은 음 q번 진동마다 같은 모양
    if (sr && sr.q <= periods) {
      const T = sr.q / f0; let k0 = Math.ceil(tA / T);
      ctx.strokeStyle = mix(GREEN, 0.55); ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2;
      for (let k = k0; k * T <= tA + span; k++) { const x = x0 + ((k * T - tA) / span) * pw; ctx.beginPath(); ctx.moveTo(x, sumY - sumA - 4); ctx.lineTo(x, sumY + sumA + 4); ctx.stroke(); }
      ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    const M = Math.round(pw);
    const path = (fn, yc, amp, color, lw) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i <= M; i++) { const t = tA + (i / M) * span, y = yc - amp * fn(t); i ? ctx.lineTo(x0 + (i / M) * pw, y) : ctx.moveTo(x0, y); } ctx.stroke(); ctx.lineWidth = 1; };
    path((t) => tone(t, 1, A, N, f0), thinY, thinH / 2, mix(LOW, 0.8), 1.4);
    path((t) => tone(t, r, A, N, f0), thinY, thinH / 2, mix(HIGH, 0.85), 1.4);
    path((t) => wave(t, r, A, N, f0), sumY, sumA, INK, 2.4);
    ctx.font = '11.5px ' + FONT; ctx.textAlign = 'right';
    const tag = (txt, col, y) => { ctx.fillStyle = col; L.label(ctx, txt, x1, y, 'right'); };
    tag('낮은 음 · 도', LOW, yA + 12); tag('높은 음', HIGH, yA + 26);
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'left'; L.label(ctx, '합친 소리', x0, sumY - sumA + 2, 'left');

    // 아래 칸: 멀리 본 소리의 울렁임 (0.25초 동안의 위아래 폭)
    ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(x0, yB - 4); ctx.lineTo(x1, yB - 4); ctx.stroke();
    ctx.fillStyle = css('--text'); ctx.font = '600 11.5px ' + FONT; ctx.textAlign = 'left';
    ctx.fillText('멀리 본 소리의 울렁임 (0.25초)', x0, yB + 12);
    const eY = yB + 20 + (laneB - 20) / 2, eA = (laneB - 24) / 2, cols = Math.round(pw);
    const env = envelope(r, A, N, f0, cols);
    ctx.fillStyle = mix(css('--accent') || '#2f6fed', 0.55); ctx.beginPath();
    ctx.moveTo(x0, eY - eA * env.hi[0]); for (let i = 1; i < cols; i++) ctx.lineTo(x0 + i, eY - eA * env.hi[i]);
    for (let i = cols - 1; i >= 0; i--) ctx.lineTo(x0 + i, eY - eA * env.lo[i]); ctx.closePath(); ctx.fill();
  }
  function flow(ts) {
    if (sim && !THUMB && ts - lastWave > 45) { tA += (ts - lastWave) / 1000 / 300; lastWave = ts; drawWave(); }
    requestAnimationFrame(flow);
  }

  // ---------- ② 음을 올리며 잰 거칠기 ----------
  function xTicks(narrow) { return narrow ? [0, 200, 400, 500, 700, 900, 1100, 1200] : H.NAMES.map((n) => n.c); }
  // 축 눈금의 짧은 음 이름은 언어별로 직접 바꾼다 (한 글자 낱말을 번역 규칙에 넣으면 다른 문장 조각까지 바뀔 수 있어서)
  const NOTE = {
    en: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B', 'high C', 'C′'],
    es: ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si', 'Do agudo', 'Do′'],
    fr: ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si', 'Do aigu', 'Do′'],
    ja: ['ド', 'ド♯', 'レ', 'ミ♭', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ラ♭', 'ラ', 'シ♭', 'シ', '高いド', 'ド′'],
    ru: ['до', 'до♯', 'ре', 'ми♭', 'ми', 'фа', 'фа♯', 'соль', 'ля♭', 'ля', 'си♭', 'си', 'верхнее до', 'до′'],
    zh: ['do', 'do♯', 're', 'mi♭', 'mi', 'fa', 'fa♯', 'sol', 'la♭', 'la', 'si♭', 'si', '高音 do', 'do′'],
  };
  const shortName = (c, narrow) => {
    const i = c === 1200 ? (narrow ? 13 : 12) : Math.round(c / 100), lang = (window.I18N && window.I18N.lang) || 'ko';
    if (lang === 'ko') return c === 1200 ? (narrow ? '도′' : '높은 도') : H.nearest(c).short;
    return (NOTE[lang] || NOTE.en)[i];
  };
  function drawCurve() {
    const cvEl = $('c-curve'), cw = cvEl.clientWidth || 600, narrow = cw < 560;
    const c = L.chart(cvEl, THUMB ? 1 : narrow ? 0.8 : 0.56, THUMB ? { l: 14, r: 14, t: 24, b: 20 } : { l: 44, r: 14, t: 26, b: 40 }), { ctx, m, pw, ph } = c;
    const cv = sim.curve, R = sim.reached, X = (v) => m.l + (v / 1200) * pw, Y = (v) => m.t + ph - (v / 100) * ph;
    if (!THUMB) L.axes(c, { X, Y, yTicks: [0, 25, 50, 75, 100], xTicks: xTicks(narrow), xFmt: (v) => shortName(v, narrow), xLabel: '두 번째 음 (낮은 음은 도)', yLabel: '거칠기 (가장 거친 곳 = 100)' });
    ctx.strokeStyle = mix('#8a93a6', 0.18); for (let k = 1; k < 12; k++) { ctx.beginPath(); ctx.moveTo(X(k * 100), m.t); ctx.lineTo(X(k * 100), m.t + ph); ctx.stroke(); }
    // 지나온 곳까지만 곡선
    const pts = []; for (let v = 0; v <= R; v++) pts.push([X(v), Y(cv.idx[v])]);
    if (pts.length > 1) {
      ctx.fillStyle = mix(css('--accent') || '#2f6fed', 0.14); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(X(R), Y(0)); ctx.closePath(); ctx.fill();
      L.line(ctx, pts, css('--accent') || '#2f6fed', THUMB ? 5 : 2.5);
    }
    // 지나온 골: 초록 점 + 비율 이름표 (두 높이로 엇갈려 겹치지 않게)
    const ds = H.dips(cv, R).filter((d) => d.c > 0);
    ds.forEach((d, i) => {
      const x = X(d.c), y = Y(d.v), lab = `${d.name.p}:${d.name.q}`;
      if (!THUMB) {
        const cy = m.t + 2 + (i % 2) * 26 + (narrow ? 0 : 0), box = chipAt(ctx, lab, x, cy, GREEN, (narrow ? '600 11px ' : '600 12px ') + FONT);
        ctx.strokeStyle = mix(GREEN, 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, box.y + box.h); ctx.lineTo(x, y - 6); ctx.stroke(); ctx.lineWidth = 1;
      }
      ctx.fillStyle = GREEN; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, THUMB ? 11 : 5, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
    });
    if (THUMB) return;
    // 지금 가리키는 곳: 큰 점 + 간격 이름표
    const x = X(sim.c), y = Y(cv.idx[sim.c]);
    ctx.strokeStyle = mix(INK, 0.35); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    const text = `${nameOf(sim.c)} · ${Math.round(cv.idx[sim.c])}`;
    ctx.font = '700 13px ' + FONT; const tw = ctx.measureText(tr(text)).width + 16;
    let cx = x + tw / 2 + 14; if (cx + tw / 2 > m.l + pw) cx = x - tw / 2 - 14;
    const cy = Math.min(m.t + ph - 30, Math.max(m.t + 56, y - 34));
    const box = chipAt(ctx, text, cx, cy, INK, '700 13px ' + FONT);
    const ex = cx > x ? box.x : box.x + box.w; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ex, cy + 11); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = INK; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
  }

  // ---------- ③ 반음 간격마다 거칠기 순위 ----------
  function drawBars() {
    const el = $('c-bars'), cw = el.clientWidth || 600, narrow = cw < 560;
    const lg = [{ kind: 'box', color: GREEN, label: '지금까지 가장 편한 세 간격 (같은 음 제외)' }, { kind: 'box', color: mix(css('--accent') || '#2f6fed', 0.75), label: '나머지 간격' }];
    const sp = L.belowSpace(el, lg), c = L.chart(el, (narrow ? 0.78 : 0.56) + sp.extra / cw, { l: 40, r: 10, t: 26, b: sp.b }), { ctx, m, pw, ph } = c;
    const cv = sim.curve, R = sim.reached, n = H.NAMES.length, bw = pw / n;
    const X = (i) => m.l + (i + 0.5) * bw, Y = (v) => m.t + ph - (v / 100) * ph;
    L.axes(c, { X: (i) => X(i), Y, yTicks: [0, 25, 50, 75, 100], xTicks: H.NAMES.map((_, i) => i), xFmt: (i) => shortName(H.NAMES[i].c, narrow), xLabel: '두 번째 음 (낮은 음은 도)', yLabel: '거칠기 (가장 거친 곳 = 100)' });
    const shown = H.NAMES.map((nm, i) => ({ i, v: cv.idx[nm.c], ok: nm.c <= R })).filter((d) => d.ok);
    const cand = shown.filter((d) => d.i > 0), best = cand.length >= 6 ? cand.slice().sort((a, b) => a.v - b.v).slice(0, 3).map((d) => d.i) : []; // 같은 음은 빼고, 여섯 간격 이상 지난 뒤에 표시
    ctx.font = (narrow ? '10px ' : '11px ') + FONT; ctx.textAlign = 'center';
    shown.forEach((d) => {
      const col = best.includes(d.i) ? GREEN : mix(css('--accent') || '#2f6fed', 0.75);
      const y = Y(Math.max(0.8, d.v)); ctx.fillStyle = col; ctx.fillRect(X(d.i) - bw * 0.36, y, bw * 0.72, m.t + ph - y);
      ctx.fillStyle = css('--text'); ctx.fillText(String(Math.round(d.v)), X(d.i), y - 4);
    });
    L.drawLegendBelow(c, lg);
  }

  // ---------- ④ 배음 수에 따라 생기는 편한 골의 수 (집계) ----------
  function drawSweep() {
    const el = $('c-sweep'), cw = el.clientWidth || 600, narrow = cw < 560, P = sim.params;
    const lg = [{ kind: 'box', color: css('--rich') || '#d19200', label: '지금 설정' }, { kind: 'box', color: GRAY, label: '다른 배음 수' }];
    const sp = L.belowSpace(el, lg), c = L.chart(el, (narrow ? 0.75 : 0.56) + sp.extra / cw, { l: 40, r: 10, t: 26, b: sp.b }), { ctx, m, pw, ph } = c;
    const YM = 12, bw = pw / 10, X = (k) => m.l + (k - 0.5) * bw, Y = (v) => m.t + ph - (v / YM) * ph;
    L.axes(c, { X, Y, yTicks: [0, 3, 6, 9, 12], xTicks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], xFmt: (v) => String(v), xLabel: '소리에 겹친 배음 수 (개)', yLabel: '한 옥타브 안의 편한 골 (개)' });
    if (sweepCounts) {
      ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center';
      sweepCounts.forEach((v, i) => {
        const k = i + 1, y = Y(v); ctx.fillStyle = k === P.N ? (css('--rich') || '#d19200') : GRAY;
        ctx.fillRect(X(k) - bw * 0.34, y, bw * 0.68, m.t + ph - y);
        ctx.fillStyle = css('--text'); ctx.fillText(String(v), X(k), y - 5);
      });
    } else { ctx.fillStyle = css('--muted'); ctx.textAlign = 'center'; ctx.fillText('계산 중…', m.l + pw / 2, m.t + ph / 2); }
    L.drawLegendBelow(c, lg);
  }

  function renderStats() {
    const cv = sim.curve, c = sim.c, sr = simple(c), ds = H.dips(cv, sim.reached).filter((d) => d.c > 0), playing = !sim.done();
    const cards = [
      ['지금 두 음이 부딪치는 정도 (거칠기)', String(Math.round(cv.idx[c])), '가장 거친 곳 = 100 · 0에 가까울수록 편안해요', ''],
      ['지금 두 음의 간격', nameOf(c), sr ? `진동수 비 ${H.ratio(c).toFixed(3)} · 단순한 비 ${sr.p}:${sr.q}에 가까워요` : `진동수 비 ${H.ratio(c).toFixed(3)} · 가까운 단순한 비가 없어요`, ''],
      ['지나온 길에서 찾은 편한 골', `${ds.length}개`, ds.length ? ds.map((d) => `${d.name.p}:${d.name.q}`).join(' · ') : '아직 없어요', playing ? 'opacity:.55' : ''],
      ['같은 모양으로 돌아오는 간격 (낮은 음 진동 수)', sr ? `${sr.q}번마다` : '안 돌아와요', sr ? '비가 단순할수록 빨리 같은 모양으로 돌아와요' : '두 음의 주기가 어긋나 모양이 계속 바뀌어요', ''],
    ];
    $('stats').innerHTML = cards.map(([k, v, s, st]) => `<div class="stat"${st ? ` style="${st}"` : ''}><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  // ---------- 소리 (버튼을 눌렀을 때만, 실패하면 조용히) ----------
  let AC = null, soundOn = false, live = null, lastAdv = 0, quiet = false;
  function audio() {
    try { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); } if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; }
  }
  function voices(ac, r, dest) {   // 두 음 × 배음 N개의 사인파
    const P = sim.params, A = sim.amps, out = [], tot = A.reduce((a, b) => a + b, 0) * 2;
    [1, r].forEach((rr, j) => A.forEach((a, k) => {
      const f = P.f0 * rr * (k + 1); if (f > 12000) return;
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = (0.5 * a) / tot;
      o.connect(g); g.connect(dest); o.start(); out.push({ o, j, k });
    }));
    return out;
  }
  function msg(t) { const e = $('sndmsg'); if (e) e.textContent = t; }
  function hear() {
    const ac = audio(); if (!ac) { msg('이 브라우저에서는 소리를 낼 수 없어요'); return; }
    try {
      soundOn = true; const m = ac.createGain(), t = ac.currentTime; m.gain.setValueAtTime(0, t); m.gain.linearRampToValueAtTime(0.9, t + 0.04); m.gain.setValueAtTime(0.9, t + 1.5); m.gain.linearRampToValueAtTime(0, t + 1.9); m.connect(ac.destination);
      voices(ac, H.ratio(sim.c), m).forEach((v) => v.o.stop(t + 2));
      msg(`들리는 소리: ${nameOf(sim.c)}`);
    } catch (e) { /* 소리를 못 내도 화면은 그대로 */ }
  }
  function stopLive() { if (!live) return; try { const t = AC.currentTime; live.m.gain.cancelScheduledValues(t); live.m.gain.setTargetAtTime(0, t, 0.08); live.vs.forEach((v) => v.o.stop(t + 0.5)); } catch (e) {} live = null; }
  function hearSweep() {
    const ac = audio(); if (!ac) { msg('이 브라우저에서는 소리를 낼 수 없어요'); return; }
    stopLive(); $('restart').click();
    try { soundOn = true; const m = ac.createGain(); m.gain.value = 0; m.gain.setTargetAtTime(0.8, ac.currentTime, 0.05); m.connect(ac.destination); live = { m, vs: voices(ac, 1, m) }; } catch (e) { live = null; }
    lastAdv = performance.now(); quiet = true; $('play').click(); quiet = false;
    msg('소리를 따라 올라가는 중이에요. 일시정지하면 소리도 멈춰요');
  }
  function liveFollow() {
    if (!live) return;
    try { const t = AC.currentTime, r = H.ratio(sim.c); live.vs.forEach((v) => { if (v.j === 1) v.o.frequency.setTargetAtTime(sim.params.f0 * r * (v.k + 1), t, 0.03); }); } catch (e) {}
    if (sim.done()) { setTimeout(stopLive, 900); msg(`끝: ${nameOf(sim.c)}`); }
  }
  setInterval(() => { if (live && performance.now() - lastAdv > 450) { stopLive(); msg('소리를 멈췄어요'); } }, 200);

  function draw() { renderStats(); drawCurve(); drawBars(); drawSweep(); if (THUMB) drawWave(); $('when').textContent = `반음 ${(sim.reached / 100).toFixed(1)}개 위 · ${sim.done() ? '끝' : '올라가는 중'}`; }

  function after() {
    const P = params(), key = String(P.seed);
    if (key === sweepKey && sweepCounts) { drawSweep(); return; }
    sweepKey = key; sweepCounts = null; const tmp = [];
    L.jobs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((N) => () => { tmp.push(H.dipCount(N, P.seed)); }), null, () => { sweepCounts = tmp; if (sim) drawSweep(); });
  }

  const h = L.harness({
    controls: ['target', 'N'],
    format: { target: (v) => nameOf(Number(v)), N: (v) => `${v}개` },
    defaults: { target: 1200, N: 6 },
    build(seed) {
      stopLive();
      sim = H.create(params());
      if (THUMB) while (sim.advance());
      else if (AT) while (sim.reached < AT && sim.advance());
    },
    autoplay: !THUMB && !AT,
    speedScale: 0.7,
    advance() { const ok = sim.advance(); if (ok) lastAdv = performance.now(); liveFollow(); return ok; },
    isDone() { return sim.done(); },
    draw, after, redrawExtra() { drawSweep(); }, seedLabel: '음색',
  });
  seedGetter = h.seed;
  $('hear').addEventListener('click', hear);
  $('hearsweep').addEventListener('click', hearSweep);
  $('play').addEventListener('click', () => { if (live && !quiet) { stopLive(); msg('소리를 멈췄어요'); } });
  // 다 올라간 뒤에는 곡선을 눌러 그 간격으로 옮겨 볼 수 있다 (소리 버튼을 한 번 누른 뒤에만 소리가 난다)
  $('c-curve').addEventListener('click', (e) => {
    if (!sim) return; const rc = e.target.getBoundingClientRect(), x = e.clientX - rc.left, m = { l: 44, r: 14 }, pw = rc.width - m.l - m.r;
    const c = Math.round(((x - m.l) / pw) * 1200); if (c < 0 || c > sim.reached) return;
    sim.jump(c); draw(); if (soundOn && !live) hear();
  });
  if (THUMB) draw(); else requestAnimationFrame(flow);
})();
