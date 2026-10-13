(function () {
  'use strict';
  const TL = window.TalentLuck;
  const $ = (id) => document.getElementById(id);
  const { css, setup, mix, roundRect } = window.Lab;
  const Lab = window.Lab;
  const DEFAULTS = { events: 500, pLucky: 50, years: 40, sdT: 0.1 };
  const THUMB = /[?&]thumb=1/.test(location.search); // 메인 페이지 썸네일용: 40년 뒤 장면으로 바로 간다
  const SPEED = 0.7; // 2026-10-12: 전체 애니메이션을 30% 느리게

  let seed = 1;
  let sim = null, st = null, anim = null;
  let playing = false, acc = 0, lastTs = 0;
  let batchResult = null;

  // ---------- 공통 그리기 도구 ----------
  function fmtCap(v) {
    if (v >= 100) return Math.round(v).toLocaleString('ko-KR');
    if (v >= 1) return String(+v.toFixed(1));
    return String(+v.toPrecision(2));
  }

  function jitter(i) {
    return ((Math.imul(i + 1, 2654435761) >>> 0) / 4294967296) - 0.5;
  }

  // 로그 눈금 y축: k = log2(자본/시작자본)
  function logTicks(kmin, kmax) {
    const span = kmax - kmin;
    const stepK = Math.max(1, Math.ceil(span / 6));
    const ticks = [];
    for (let k = Math.ceil(kmin / stepK) * stepK; k <= kmax; k += stepK) ticks.push(k);
    return ticks;
  }

  // ---------- ② 히스토그램 ----------
  function drawHist() {
    const { ctx, w, h } = setup($('c-hist'), 0.95);
    const c0 = sim.params.c0;
    const ks = Array.from(sim.capital, (c) => Math.round(Math.log2(c / c0)));
    const kmin = Math.min(...ks), kmax = Math.max(...ks);
    const counts = new Array(kmax - kmin + 1).fill(0);
    ks.forEach((k) => counts[k - kmin]++);
    const rawMax = Math.max(...counts);
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax / 4))), r0 = rawMax / 4 / mag;
    const gstep = (r0 <= 1 ? 1 : r0 <= 2 ? 2 : r0 <= 5 ? 5 : 10) * mag;
    const cmax = Math.ceil(rawMax / gstep) * gstep;
    const m = { l: 40, r: 8, t: 34, b: 36 };
    const cc = { ctx, w, h, m, pw: w - 40 - 8, ph: h - 34 - 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const bw = pw / counts.length;
    const text = css('--muted'), line = css('--line');

    ctx.strokeStyle = line; ctx.fillStyle = text; ctx.textAlign = 'right';
    for (let v = 0; v <= cmax; v += gstep) {
      const y = m.t + ph - (ph * v) / cmax;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke();
      ctx.fillText(String(v), m.l - 6, y + 4);
    }
    counts.forEach((c, i) => {
      const k = i + kmin;
      ctx.fillStyle = k > 0 ? css('--accent') : k === 0 ? css('--muted') : mix(css('--muted'), 0.55);
      const bh = (ph * c) / cmax;
      ctx.fillRect(m.l + i * bw + 1, m.t + ph - bh, Math.max(1, bw - 2), bh);
    });
    ctx.fillStyle = text; ctx.textAlign = 'center';
    const every = Math.max(1, Math.ceil(counts.length / 7));
    counts.forEach((_, i) => {
      const k = i + kmin;
      if (((k % every) + every) % every) return; // 시작값(k=0)에 늘 눈금이 오도록
      ctx.fillStyle = k === 0 ? css('--text') : text;
      ctx.fillText(fmtCap(c0 * Math.pow(2, k)), m.l + i * bw + bw / 2, h - m.b + 16);
    });
    Lab.axisNames(cc, '최종 자본 (시작값 ' + c0 + ')', '사람 수 (명)');

    // 최고 부자가 있는 막대 위에 금색 표시
    const kr = Math.round(Math.log2(sim.capital[st.richest] / c0)) - kmin;
    const rx = m.l + kr * bw + bw / 2, ry = m.t + ph - (ph * counts[kr]) / cmax - 6;
    ctx.fillStyle = css('--rich');
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry - 8); ctx.lineTo(rx + 5, ry - 8); ctx.closePath(); ctx.fill();
    ctx.textAlign = rx > m.l + pw * 0.75 ? 'right' : 'center';
    ctx.fillText('최고 부자', rx + (rx > m.l + pw * 0.75 ? 6 : 0), ry - 12);
    // 핵심 한 줄: 시작값보다 늘어난(파랑) 사람과 그들이 가진 몫
    const up = Array.from(sim.capital).filter((c) => c > c0 * 1.0001).length;
    ctx.font = '600 13px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = css('--accent');
    ctx.fillText(`시작보다 늘어난 사람 ${Math.round(up / sim.n * 100)}% (파랑)`, m.l, 14);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    Lab.legend(cc, [{ kind: 'box', color: css('--accent'), label: '시작보다 늘어남' }, { kind: 'box', color: css('--muted'), label: '시작과 같음' }, { kind: 'box', color: mix(css('--muted'), 0.55), label: '시작보다 줄어듦' }], 'tr');
  }

  // ---------- ③ 산점도 ----------
  function drawScatter() {
    const { ctx, w, h } = setup($('c-scatter'), 0.7);
    const c0 = sim.params.c0, n = sim.n;
    const ks = Array.from(sim.capital, (c) => Math.log2(c / c0));
    const kmin = Math.min(...ks) - 0.8, kmax = Math.max(...ks) + 0.8;
    const tmin = Math.min(...sim.talent) - 0.02, tmax = Math.max(...sim.talent) + 0.02;
    const m = { l: 48, r: 10, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b, cc = { ctx, w, h, m, pw, ph };
    const X = (t) => m.l + ((t - tmin) / (tmax - tmin)) * pw;
    const Y = (k) => m.t + ph - ((k - kmin) / (kmax - kmin)) * ph;
    const text = css('--muted'), line = css('--line');

    ctx.strokeStyle = line; ctx.fillStyle = text; ctx.textAlign = 'right';
    logTicks(kmin, kmax).forEach((k) => {
      ctx.beginPath(); ctx.moveTo(m.l, Y(k)); ctx.lineTo(w - m.r, Y(k)); ctx.stroke();
      ctx.fillText(fmtCap(c0 * Math.pow(2, k)), m.l - 6, Y(k) + 4);
    });
    ctx.textAlign = 'center';
    for (let t = Math.ceil(tmin * 10) / 10; t <= tmax; t += 0.1) ctx.fillText(t.toFixed(1), X(t), h - m.b + 16);
    Lab.axisNames(cc, '재능', '최종 자본');
    // 시작 자본선
    ctx.setLineDash([5, 3]); ctx.strokeStyle = css('--muted'); ctx.beginPath();
    ctx.moveTo(m.l, Y(0)); ctx.lineTo(w - m.r, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.fillText('시작 자본', m.l + 4, Y(0) - 5);

    ctx.fillStyle = mix(css('--accent'), 0.35);
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(X(sim.talent[i]), Y(ks[i] + jitter(i) * 0.5), 2.2, 0, 7); ctx.fill();
    }
    const mark = (i, color, label, dx) => {
      const x = X(sim.talent[i]), y = Y(ks[i]);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fill();
      ctx.strokeStyle = css('--surface'); ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
      ctx.textAlign = dx < 0 ? 'right' : 'left'; ctx.fillStyle = color;
      ctx.fillText(label, x + dx, y + 4);
    };
    mark(st.richest, css('--rich'), '최고 부자 ' + fmtCap(sim.capital[st.richest]), x(st.richest) > m.l + pw * 0.6 ? -10 : 10);
    mark(st.mostTalented, css('--talent'), '최고 재능자 ' + fmtCap(sim.capital[st.mostTalented]), -10);
    Lab.legend(cc, [{ kind: 'dot', color: mix(css('--accent'), 0.6), label: '보통 사람' }, { kind: 'dot', color: css('--rich'), label: '최고 부자' }, { kind: 'dot', color: css('--talent'), label: '최고 재능자' }], 'tl');
    function x(i) { return X(sim.talent[i]); }
  }

  // ---------- ④ 타임라인 ----------
  function drawTimeline() {
    const { ctx, w, h } = setup($('c-time'), 0.7);
    const c0 = sim.params.c0, n = sim.n, T = sim.steps;
    const k = (t, i) => Math.log2(sim.history[t * n + i] / c0);
    const others = st.byCap.slice(1, 5);
    const series = [st.richest, st.mostTalented, ...others];
    let kmin = 0, kmax = 0;
    series.forEach((i) => { for (let t = 0; t <= T; t++) { const v = k(t, i); kmin = Math.min(kmin, v); kmax = Math.max(kmax, v); } });
    kmin -= 0.8; kmax += 0.8;
    const m = { l: 48, r: 10, t: 24, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b, cc = { ctx, w, h, m, pw, ph };
    const X = (t) => m.l + (t / T) * pw;
    const Y = (v) => m.t + ph - ((v - kmin) / (kmax - kmin)) * ph;
    const text = css('--muted'), line = css('--line');

    ctx.strokeStyle = line; ctx.fillStyle = text; ctx.textAlign = 'right';
    logTicks(kmin, kmax).forEach((v) => {
      ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke();
      ctx.fillText(fmtCap(c0 * Math.pow(2, v)), m.l - 6, Y(v) + 4);
    });
    ctx.textAlign = 'center';
    const yearStep = sim.params.years > 30 ? 10 : 5;
    for (let y = 0; y <= sim.params.years; y += yearStep) ctx.fillText(y + '년', X(y * 2), h - m.b + 16);
    Lab.axisNames(cc, '경과 시간 (년)', '자본');

    const path = (i, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(X(0), Y(k(0, i)));
      for (let t = 1; t <= T; t++) { ctx.lineTo(X(t), Y(k(t - 1, i))); ctx.lineTo(X(t), Y(k(t, i))); }
      ctx.stroke(); ctx.lineWidth = 1;
    };
    others.forEach((i) => path(i, mix(css('--rich'), 0.3), 1));
    path(st.mostTalented, css('--talent'), 2);
    path(st.richest, css('--rich'), 2.5);

    const L = sim.log[st.richest];
    for (let j = 0; j < L.length; j += 2) {
      const t = L[j], code = L[j + 1], x = X(t), y = Y(k(t, st.richest));
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7);
      if (code === TL.LUCKY_USED) { ctx.fillStyle = css('--lucky'); ctx.fill(); }
      else if (code === TL.UNLUCKY) { ctx.fillStyle = css('--unlucky'); ctx.fill(); }
      else { ctx.strokeStyle = css('--lucky'); ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; }
    }
    Lab.legend(cc, [{ kind: 'line', color: css('--rich'), label: '최고 부자' }, { kind: 'line', color: css('--talent'), label: '최고 재능자' }, { kind: 'dot', color: css('--lucky'), label: '행운을 잡음' }, { kind: 'dot', color: css('--unlucky'), label: '불운' }], 'tl');
  }

  // ---------- ① 애니메이션 ----------
  function chip(ctx, text, x, y, color, w) {
    ctx.font = '600 12px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const tw = ctx.measureText(text).width + 16, th = 22;
    let cx = x + 12, cy = y - 30;
    if (cx + tw > w - 6) cx = x - 12 - tw;
    if (cy < 6) cy = y + 10;
    ctx.save();
    ctx.shadowColor = 'rgba(20,30,60,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff'; roundRect(ctx, cx, cy, tw, th, 11); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; roundRect(ctx, cx, cy, tw, th, 11); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, cx + 8, cy + 15);
    ctx.lineWidth = 1;
  }

  function drawWorld() {
    const { ctx, w } = setup($('c-world'), 1);
    const W = anim.params.world, s = w / W, c0 = anim.params.c0;
    // 세계는 토러스(끝과 끝이 이어짐)라서, 썸네일에서는 최고 부자가 가운데 오도록 화면을 돌려 본다
    const ox = THUMB ? W / 2 - anim.ax[st.richest] : 0, oy = THUMB ? W / 2 - anim.ay[st.richest] : 0;
    const PX = (v) => ((((v + ox) % W) + W) % W + 0.5) * s, PY = (v) => ((((v + oy) % W) + W) % W + 0.5) * s;

    // 바탕: 아주 옅은 점 격자
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(99,106,122,.12)';
    for (let g = 20; g < W; g += 20) for (let h = 20; h < W; h += 20) {
      ctx.beginPath(); ctx.arc(g * s, h * s, 1, 0, 7); ctx.fill();
    }

    // 이벤트: 번지는 빛 (행운=초록, 불운=빨강)
    const R = Math.max(10, s * 7);
    for (let k = 0; k < anim.ex.length; k++) {
      const x = PX(anim.ex[k]), y = PY(anim.ey[k]);
      const col = anim.lucky[k] ? '#1fa463' : '#e5484d';
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, mix(col, THUMB ? 0.16 : 0.30)); gr.addColorStop(1, mix(col, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    }
    for (let k = 0; k < anim.ex.length; k++) {
      ctx.fillStyle = mix(anim.lucky[k] ? '#1fa463' : '#e5484d', 0.85);
      ctx.beginPath(); ctx.arc(PX(anim.ex[k]), PY(anim.ey[k]), 1.6, 0, 7); ctx.fill();
    }

    // 사람: 자본이 클수록 크고 진한 파랑, 줄었으면 작고 옅은 회색
    const order = Array.from({ length: anim.n }, (_, i) => i).sort((a, b) => anim.capital[a] - anim.capital[b]);
    for (const i of order) {
      const v = Math.log2(anim.capital[i] / c0);
      let r, col;
      if (v > 0) { r = Math.min(2 + v * 0.7, 8) * (THUMB ? 1.35 : 1); col = mix('#2f6fed', Math.min(0.5 + v * 0.07, 0.95)); }
      else if (v === 0) { r = 2; col = 'rgba(99,106,122,.55)'; }
      else { r = 1.5; col = 'rgba(99,106,122,.28)'; }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(PX(anim.ax[i]), PY(anim.ay[i]), r, 0, 7); ctx.fill();
    }

    // 방금 이벤트를 만난 사람: 자본이 늘었으면 초록 고리, 줄었으면 빨간 고리
    if (anim.step > 0 && !THUMB) {
      const prev = (anim.step - 1) * anim.n;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < anim.n; i++) {
        const a = anim.history[prev + i], b = anim.capital[i];
        if (a === b) continue;
        ctx.strokeStyle = b > a ? '#1fa463' : '#e5484d';
        const v = Math.log2(b / c0), rr = (v > 0 ? Math.min(2 + v * 0.7, 8) : 2) + 3.5;
        ctx.beginPath(); ctx.arc(PX(anim.ax[i]), PY(anim.ay[i]), rr, 0, 7); ctx.stroke();
      }
      ctx.lineWidth = 1;
    }

    // 최고 재능자 / 최고 부자 (최종 결과 기준으로 계속 따라다니며 표시)
    const mark = (i, color, label) => {
      const x = PX(anim.ax[i]), y = PY(anim.ay[i]);
      const R0 = THUMB ? 13 : 9;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, R0, 0, 7); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = THUMB ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(x, y, R0, 0, 7); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      if (!THUMB) chip(ctx, `${label} · 자본 ${fmtCap(anim.capital[i])}`, x, y, color, w);
    };
    mark(st.mostTalented, '#7c5cff', '최고 재능자');
    mark(st.richest, '#d19200', '최고 부자');
    ctx.lineWidth = 1;

    // 지금 상위 20%의 몫
    const caps = Array.from(anim.capital).sort((a, b) => b - a);
    const total = caps.reduce((x, y) => x + y, 0);
    const top20 = caps.slice(0, Math.round(anim.n * 0.2)).reduce((x, y) => x + y, 0);
    const step = anim.step;
    $('when').textContent = `${Math.floor(step / 2)}년 ${step % 2 ? 6 : 0}개월 · 상위 20%의 몫 ${(top20 / total * 100).toFixed(0)}%`;
    const bar = $('prog'); if (bar) bar.style.width = (step / anim.steps * 100) + '%';
  }

  function resetAnim() {
    anim = TL.create(Object.assign({}, sim.params));
    playing = false; acc = 0;
    $('play').textContent = '▶ 재생';
    drawWorld();
  }

  function tick(ts) {
    if (playing) {
      acc += Math.min(0.25, (ts - lastTs) / 1000) * Number($('speed').value) * SPEED;
      let moved = false;
      while (acc >= 1) {
        acc -= 1;
        if (!anim.advance()) { playing = false; $('play').textContent = '▶ 다시 재생'; break; }
        moved = true;
      }
      if (moved) drawWorld();
    }
    lastTs = ts;
    requestAnimationFrame(tick);
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const c0 = sim.params.c0;
    const talRank = st.byTal.indexOf(st.richest) + 1;
    const cards = [
      ['최고 부자의 재능', st.richestTalent.toFixed(2), `평균 ${st.meanTalent.toFixed(2)} · 재능 순위 ${talRank}위 / ${sim.n}명`],
      ['최고 재능자의 최종 자본', fmtCap(st.mostTalentedCapital), `재능 ${st.mostTalentedTalent.toFixed(2)} (1위) · 시작은 ${c0}`],
      ['상위 20%가 가진 자본', (st.top20Share * 100).toFixed(0) + '%', '파레토 법칙(80/20)과 비교해 보세요'],
      ['시작값보다 줄어든 사람', (st.belowInitial * 100).toFixed(0) + '%', '운이 나쁘면 재능이 있어도 줄어요'],
      ['부자 상위 10명 중 재능 상위 10%', st.richInTopDecile + '명', '재능만으로 정해진다면 10명'],
    ];
    $('stats').innerHTML = cards.map(([k, v, s]) =>
      `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  // ---------- 실행 ----------
  function readParams() {
    return {
      seed,
      events: Number($('events').value),
      pLucky: Number($('pLucky').value) / 100,
      years: Number($('years').value),
      sdT: Number($('sdT').value),
    };
  }

  function showOutputs() {
    $('o-events').textContent = $('events').value + '개';
    $('o-pLucky').textContent = $('pLucky').value + '%';
    $('o-years').textContent = $('years').value + '년';
    $('o-sdT').textContent = Number($('sdT').value).toFixed(2);
  }

  function render() {
    drawHist(); drawScatter(); drawTimeline(); drawWorld();
    if (batchResult) drawBatch();
  }

  function run() {
    sim = TL.create(readParams()).run();
    st = TL.stats(sim);
    $('seedinfo').textContent = `운의 번호 #${seed}`;
    renderStats();
    resetAnim();
    if (!THUMB) { playing = true; $('play').textContent = '⏸ 일시정지'; } // 실행하면 바로 40년을 재생
    drawHist(); drawScatter(); drawTimeline();
  }

  // ---------- ⑤ 100번 반복 ----------
  function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
  function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }

  function runBatch() {
    const btn = $('batch'), RUNS = 100, CHUNK = 10;
    const p = readParams();
    btn.disabled = true;
    $('batch-panel').style.display = '';
    const rows = [];
    let done = 0;
    (function next() {
      rows.push(...TL.batch(Object.assign({}, p, { seed: p.seed + done * 7 }), CHUNK));
      done += CHUNK;
      $('batch-text').textContent = `계산 중… ${done}/${RUNS}`;
      if (done < RUNS) return setTimeout(next, 0);
      batchResult = { rows, params: p };
      btn.disabled = false;
      drawBatch();
      $('batch-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    })();
  }

  function drawBatch() {
    const rows = batchResult.rows, n = rows.length;
    const rt = rows.map((r) => r.richestTalent);
    const wins = rows.filter((r) => r.richestIsTopTalent).length;
    const meanT = 0.6;
    $('batch-text').textContent =
      `같은 설정으로 운만 바꿔 ${n}번 돌렸습니다. 최고 부자의 재능 중앙값은 ${median(rt).toFixed(2)}(평균 ${meanT}), ` +
      `그 판에서 재능이 가장 높은 사람이 최고 부자가 된 횟수는 ${wins}번이었고, ` +
      `상위 20%의 자본 비중은 평균 ${(mean(rows.map((r) => r.top20Share)) * 100).toFixed(0)}%였습니다.`;

    const { ctx, w, h } = setup($('c-batch'), 0.4);
    const lo = 0.3, hi = 1.0, bin = 0.025, nb = Math.round((hi - lo) / bin);
    const counts = new Array(nb).fill(0);
    rt.forEach((t) => { counts[Math.min(nb - 1, Math.max(0, Math.floor((t - lo) / bin)))]++; });
    const cmax = Math.max(...counts);
    const m = { l: 36, r: 10, t: 24, b: 34 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b, bw = pw / nb;
    const X = (t) => m.l + ((t - lo) / (hi - lo)) * pw;
    ctx.fillStyle = css('--rich');
    counts.forEach((c, i) => {
      const bh = (ph * c) / cmax;
      ctx.fillRect(m.l + i * bw + 1, m.t + ph - bh, Math.max(1, bw - 2), bh);
    });
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    for (let t = 0.3; t <= 1.0001; t += 0.1) ctx.fillText(t.toFixed(1), X(t), h - m.b + 16);
    Lab.axisNames({ ctx, w, h, m, pw, ph }, '최고 부자의 재능', '반복 횟수 (번)');
    ctx.fillStyle = css('--muted');
    ctx.textAlign = 'right'; ctx.fillText(String(cmax), m.l - 6, m.t + 8); ctx.fillText('0', m.l - 6, m.t + ph);

    const vline = (t, color, label, align) => {
      ctx.strokeStyle = color; ctx.setLineDash([4, 3]); ctx.beginPath();
      ctx.moveTo(X(t), m.t - 4); ctx.lineTo(X(t), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(label, X(t) + (align === 'left' ? 4 : -4), m.t + 4);
    };
    const maxT = mean(rows.map((r) => r.maxTalent));
    vline(meanT, css('--muted'), '평균 ' + meanT, 'right');
    vline(maxT, css('--talent'), '재능 1위의 평균 ' + maxT.toFixed(2), 'right');
  }

  // ---------- 이벤트 연결 ----------
  ['events', 'pLucky', 'years', 'sdT'].forEach((id) => {
    $(id).addEventListener('input', showOutputs);
    $(id).addEventListener('change', run);
  });
  $('run').addEventListener('click', run);
  $('reroll').addEventListener('click', () => { seed++; run(); });
  $('reset').addEventListener('click', () => {
    Object.entries(DEFAULTS).forEach(([k, v]) => { $(k).value = v; });
    seed = 1; batchResult = null; $('batch-panel').style.display = 'none';
    showOutputs(); run();
  });
  $('batch').addEventListener('click', runBatch);
  $('play').addEventListener('click', () => {
    if (anim.step >= anim.steps) resetAnim();
    playing = !playing;
    $('play').textContent = playing ? '⏸ 일시정지' : '▶ 재생';
  });
  $('restart').addEventListener('click', resetAnim);

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

  showOutputs();
  run();
  if (THUMB) { anim.run(); drawWorld(); }
  requestAnimationFrame((ts) => { lastTs = ts; tick(ts); });
})();
