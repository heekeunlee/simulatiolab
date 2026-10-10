// 실험 페이지들이 함께 쓰는 그리기 도구
window.Lab = (function () {
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // 캔버스를 화면 크기와 고해상도 화면에 맞춰 준비한다
  function setup(canvas, aspect) {
    const w = canvas.clientWidth || 400;
    const h = Math.round(w * aspect);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    if (window.I18N && window.I18N.lang === 'en' && !ctx.__i18n) { // 영어 모드: 캔버스에 그리는 글자도 번역
      ctx.__i18n = true;
      ['fillText', 'strokeText'].forEach((fn) => { const o = ctx[fn].bind(ctx); ctx[fn] = (txt, ...a) => o(window.I18N.t(String(txt)), ...a); });
      const mt = ctx.measureText.bind(ctx); ctx.measureText = (txt) => mt(window.I18N.t(String(txt)));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    return { ctx, w, h };
  }

  function mix(hex, alpha) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 차트 도구 ----------
  const pct = (v) => (v * 100).toFixed(0) + '%';
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  function chart(canvas, aspect, margin) {
    const m = Object.assign({ l: 44, r: 12, t: 12, b: 36 }, margin);
    const { ctx, w, h } = setup(canvas, aspect);
    return { ctx, w, h, m, pw: w - m.l - m.r, ph: h - m.t - m.b };
  }

  // 눈금·격자. o = { X, Y, yTicks, yFmt, xTicks, xFmt, xLabel }
  function axes(c, o) {
    const { ctx, w, h, m, pw } = c;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.lineWidth = 1;
    (o.yTicks || []).forEach((v) => {
      ctx.beginPath(); ctx.moveTo(m.l, o.Y(v)); ctx.lineTo(w - m.r, o.Y(v)); ctx.stroke();
      ctx.fillText(o.yFmt ? o.yFmt(v) : String(v), m.l - 6, o.Y(v) + 4);
    });
    ctx.textAlign = 'center';
    (o.xTicks || []).forEach((v) => ctx.fillText(o.xFmt ? o.xFmt(v) : String(v), o.X(v), h - m.b + 16));
    if (o.xLabel) ctx.fillText(o.xLabel, m.l + pw / 2, h - 4);
  }

  function line(ctx, pts, color, width) {
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = width || 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke(); ctx.lineWidth = 1;
  }

  function vline(c, x, color, label, align) {
    const { ctx, m, ph } = c;
    ctx.strokeStyle = color; ctx.setLineDash([2, 3]); ctx.beginPath();
    ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.textAlign = align || 'left';
    ctx.fillText(label, x + (align === 'right' ? -5 : 5), m.t + 11);
  }

  // 점+평균선 그래프(스윕). o = { aspect, data:[{x,runs,mean}], x0, x1, y0, y1, xTicks, xFmt, yFmt, xLabel,
  //   marker:{x,label}, series:[{data,color}] (추가 평균선), refs:[{y,label,color}] }
  function dots(canvas, o) {
    const c = chart(canvas, o.aspect || 0.7, { b: 40, r: 14, t: 14 });
    const { ctx, m, pw, ph } = c;
    const y0 = o.y0 == null ? 0 : o.y0, y1 = o.y1 == null ? 1 : o.y1;
    const X = (v) => m.l + ((v - o.x0) / (o.x1 - o.x0 || 1)) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const yt = []; for (let i = 0; i <= 4; i++) yt.push(y0 + ((y1 - y0) * i) / 4);
    axes(c, { X, Y, yTicks: yt, yFmt: o.yFmt || pct, xTicks: o.xTicks, xFmt: o.xFmt, xLabel: o.xLabel });
    (o.refs || []).forEach((r) => {
      ctx.setLineDash([5, 3]); ctx.strokeStyle = r.color; ctx.beginPath(); ctx.moveTo(m.l, Y(r.y)); ctx.lineTo(m.l + pw, Y(r.y)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = r.color; ctx.textAlign = 'left'; ctx.fillText(r.label, m.l + 6, Y(r.y) - 6);
    });
    const all = [{ data: o.data, color: css('--accent') }].concat(o.series || []);
    all.forEach((s, k) => {
      if (!s.data || !s.data.length) return;
      if (k === 0 || s.dots) { ctx.fillStyle = mix(s.color, 0.22); s.data.forEach((d) => (d.runs || []).forEach((r) => { ctx.beginPath(); ctx.arc(X(d.x), Y(r), 2.6, 0, 7); ctx.fill(); })); }
      line(ctx, s.data.map((d) => [X(d.x), Y(d.mean)]), s.color, 2.5);
      ctx.fillStyle = s.color; s.data.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.mean), 3.3, 0, 7); ctx.fill(); });
    });
    if (o.marker && o.marker.x >= o.x0 && o.marker.x <= o.x1) vline(c, X(o.marker.x), css('--rich'), o.marker.label || '지금 설정', o.marker.x > (o.x0 + o.x1) / 2 ? 'right' : 'left');
    return c;
  }

  // 한 번에 하나씩 비동기로 작업을 실행하며 화면을 갱신한다 (새 실험이 시작되면 이전 작업은 중단)
  let sweepToken = 0;
  function jobs(list, onStep, onDone) {
    const token = ++sweepToken;
    (function next(i) {
      if (token !== sweepToken) return;
      if (i >= list.length) { if (onDone) onDone(); return; }
      list[i](); if (onStep) onStep();
      setTimeout(() => next(i + 1), 0);
    })(0);
  }

  // ---------- 실행 틀: 슬라이더, 버튼, 재생 루프 ----------
  // cfg = { controls:[id...], format:{id:fn}, defaults:{id:value}, build(seed), advance()?, draw(), after()?, autoplay, seedLabel }
  function harness(cfg) {
    const $ = (id) => document.getElementById(id);
    let seed = 1, playing = false, acc = 0, lastTs = 0;
    const setBtn = (t) => { const b = $('play'); if (b) b.textContent = t; };
    const outputs = () => cfg.controls.forEach((id) => { const o = $('o-' + id); if (o && cfg.format[id]) o.textContent = cfg.format[id]($(id).value); });
    const label = () => { const e = $('seedinfo'); if (e) e.textContent = (cfg.seedLabel || '운의 번호') + ' #' + seed; };
    function fresh(auto) {
      cfg.build(seed);
      playing = !!auto && !!cfg.advance; acc = 0;
      setBtn(playing ? '⏸ 일시정지' : '▶ 재생');
      label(); cfg.draw();
    }
    function start() { fresh(cfg.autoplay !== false); if (cfg.after) cfg.after(); }
    function tick(ts) {
      if (playing && cfg.advance) {
        const sp = $('speed') ? Number($('speed').value) : 10;
        acc += ((ts - lastTs) / 1000) * sp;
        let moved = false;
        while (acc >= 1 && playing) {
          acc -= 1;
          if (cfg.advance()) moved = true; else { playing = false; setBtn('▶ 다시 재생'); }
        }
        if (moved) cfg.draw();
      }
      lastTs = ts; requestAnimationFrame(tick);
    }
    cfg.controls.forEach((id) => { $(id).addEventListener('input', outputs); $(id).addEventListener('change', start); });
    const on = (id, f) => { const e = $(id); if (e) e.addEventListener('click', f); };
    on('run', start);
    on('reroll', () => { seed++; start(); });
    on('reset', () => { Object.entries(cfg.defaults).forEach(([k, v]) => { $(k).value = v; }); seed = 1; outputs(); start(); });
    on('play', () => {
      if (!cfg.advance) return;
      if (cfg.isDone && cfg.isDone()) fresh(true);
      else { playing = !playing; setBtn(playing ? '⏸ 일시정지' : '▶ 재생'); }
    });
    on('stepbtn', () => { playing = false; setBtn('▶ 재생'); if (cfg.advance) { cfg.advance(); cfg.draw(); } });
    on('restart', () => fresh(false));
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { cfg.draw(); if (cfg.redrawExtra) cfg.redrawExtra(); }, 150); });
    outputs(); start(); requestAnimationFrame(tick);
    return { seed: () => seed };
  }

  return { css, setup, mix, roundRect, pct, mean, chart, axes, line, vline, dots, jobs, harness };
})();
