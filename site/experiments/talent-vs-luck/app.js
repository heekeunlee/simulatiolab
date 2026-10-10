(function () {
  'use strict';
  const TL = window.TalentLuck;
  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const DEFAULTS = { events: 500, pLucky: 50, years: 40, sdT: 0.1 };

  let seed = 1;
  let sim = null, st = null, anim = null;
  let playing = false, acc = 0, lastTs = 0;
  let batchResult = null;

  // ---------- 공통 그리기 도구 ----------
  function setup(canvas, aspect) {
    const w = canvas.clientWidth || 400;
    const h = Math.round(w * aspect);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    return { ctx, w, h };
  }

  function fmtCap(v) {
    if (v >= 100) return Math.round(v).toLocaleString('ko-KR');
    if (v >= 1) return String(+v.toFixed(1));
    return String(+v.toPrecision(2));
  }

  function mix(hex, alpha) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
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
    const { ctx, w, h } = setup($('c-hist'), 0.7);
    const c0 = sim.params.c0;
    const ks = Array.from(sim.capital, (c) => Math.round(Math.log2(c / c0)));
    const kmin = Math.min(...ks), kmax = Math.max(...ks);
    const counts = new Array(kmax - kmin + 1).fill(0);
    ks.forEach((k) => counts[k - kmin]++);
    const cmax = Math.max(...counts);
    const m = { l: 40, r: 8, t: 10, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const bw = pw / counts.length;
    const text = css('--muted'), line = css('--line');

    ctx.strokeStyle = line; ctx.fillStyle = text; ctx.textAlign = 'right';
    for (let g = 0; g <= 3; g++) {
      const v = Math.round((cmax * g) / 3), y = m.t + ph - (ph * g) / 3;
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
      if (i % every) return;
      ctx.fillText(fmtCap(c0 * Math.pow(2, i + kmin)), m.l + i * bw + bw / 2, h - m.b + 16);
    });
    ctx.fillText('최종 자본 (시작값 ' + c0 + ')', m.l + pw / 2, h - 4);
  }

  // ---------- ③ 산점도 ----------
  function drawScatter() {
    const { ctx, w, h } = setup($('c-scatter'), 0.7);
    const c0 = sim.params.c0, n = sim.n;
    const ks = Array.from(sim.capital, (c) => Math.log2(c / c0));
    const kmin = Math.min(...ks) - 0.8, kmax = Math.max(...ks) + 0.8;
    const tmin = Math.min(...sim.talent) - 0.02, tmax = Math.max(...sim.talent) + 0.02;
    const m = { l: 48, r: 10, t: 10, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
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
    ctx.fillText('재능', m.l + pw / 2, h - 4);

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
    const m = { l: 48, r: 10, t: 10, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
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
    ctx.fillText('경과 시간', m.l + pw / 2, h - 4);

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
  }

  // ---------- ① 애니메이션 ----------
  function drawWorld() {
    const { ctx, w } = setup($('c-world'), 1);
    const W = anim.params.world, s = w / W, c0 = anim.params.c0;
    ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = css('--line'); ctx.strokeRect(0.5, 0.5, w - 1, w - 1);

    for (let i = 0; i < anim.n; i++) {
      const v = Math.log2(anim.capital[i] / c0);
      let r, col;
      if (v > 0) { r = Math.min(1.6 + v * 0.55, 6.5); col = mix(css('--accent'), Math.min(0.55 + v * 0.06, 0.95)); }
      else if (v === 0) { r = 1.6; col = mix(css('--muted'), 0.5); }
      else { r = 1.3; col = mix(css('--muted'), 0.25); }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc((anim.ax[i] + 0.5) * s, (anim.ay[i] + 0.5) * s, r, 0, 7); ctx.fill();
    }
    ctx.lineWidth = 1.2;
    for (let k = 0; k < anim.ex.length; k++) {
      ctx.strokeStyle = mix(anim.lucky[k] ? css('--lucky') : css('--unlucky'), 0.75);
      ctx.beginPath(); ctx.arc((anim.ex[k] + 0.5) * s, (anim.ey[k] + 0.5) * s, Math.max(2.5, s), 0, 7); ctx.stroke();
    }
    const ring = (i, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc((anim.ax[i] + 0.5) * s, (anim.ay[i] + 0.5) * s, 8, 0, 7); ctx.stroke();
    };
    ring(st.mostTalented, css('--talent'));
    ring(st.richest, css('--rich'));
    ctx.lineWidth = 1;

    let top = 0;
    for (let i = 0; i < anim.n; i++) top = Math.max(top, anim.capital[i]);
    const step = anim.step;
    $('when').textContent = `${Math.floor(step / 2)}년 ${step % 2 ? 6 : 0}개월 (${step}/${anim.steps}) · 최고 자본 ${fmtCap(top)}`;
  }

  function resetAnim() {
    anim = TL.create(Object.assign({}, sim.params));
    playing = false; acc = 0;
    $('play').textContent = '▶ 재생';
    drawWorld();
  }

  function tick(ts) {
    if (playing) {
      acc += ((ts - lastTs) / 1000) * Number($('speed').value);
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
    const m = { l: 36, r: 10, t: 22, b: 34 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b, bw = pw / nb;
    const X = (t) => m.l + ((t - lo) / (hi - lo)) * pw;
    ctx.fillStyle = css('--rich');
    counts.forEach((c, i) => {
      const bh = (ph * c) / cmax;
      ctx.fillRect(m.l + i * bw + 1, m.t + ph - bh, Math.max(1, bw - 2), bh);
    });
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'center';
    for (let t = 0.3; t <= 1.0001; t += 0.1) ctx.fillText(t.toFixed(1), X(t), h - m.b + 16);
    ctx.fillText('최고 부자의 재능', m.l + pw / 2, h - 4);
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
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  showOutputs();
  run();
  requestAnimationFrame(tick);
})();
