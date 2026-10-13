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
    if (window.I18N && window.I18N.lang !== 'ko' && !ctx.__i18n) { // 번역 모드: 캔버스에 그리는 글자도 번역
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
    const m = Object.assign({ l: 44, r: 12, t: 24, b: 36 }, margin);   // 위쪽 여백 24: y축 이름(단위)이 들어갈 자리
    const { ctx, w, h } = setup(canvas, aspect);
    return { ctx, w, h, m, pw: w - m.l - m.r, ph: h - m.t - m.b };
  }

  // 축 이름(단위 포함): y축 이름은 축 맨 위(왼쪽), x축 이름은 축 오른쪽 끝 아래에 쓴다. c = chart() 결과(위쪽 여백 t ≥ 20 필요)
  function axisNames(c, xLabel, yLabel) {
    const { ctx, w, h, m } = c;
    ctx.save(); ctx.fillStyle = css('--text'); ctx.font = '600 11.5px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    if (yLabel) { ctx.textAlign = 'left'; ctx.fillText(yLabel, 4, Math.max(12, m.t - 7)); }
    if (xLabel) { ctx.textAlign = 'right'; ctx.fillText(xLabel, w - m.r, h - 4); }
    ctx.restore();
  }

  // 눈금·격자. o = { X, Y, yTicks, yFmt, xTicks, xFmt, xLabel, yLabel }  (xLabel·yLabel에는 단위까지 쓴다. 예: '걸음 수 (회)', '평균 자본 (원)')
  function axes(c, o) {
    const { ctx, w, h, m } = c;
    ctx.strokeStyle = css('--line'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.lineWidth = 1;
    (o.yTicks || []).forEach((v) => {
      ctx.beginPath(); ctx.moveTo(m.l, o.Y(v)); ctx.lineTo(w - m.r, o.Y(v)); ctx.stroke();
      ctx.fillText(o.yFmt ? o.yFmt(v) : String(v), m.l - 6, o.Y(v) + 4);
    });
    ctx.textAlign = 'center';
    (o.xTicks || []).forEach((v) => ctx.fillText(o.xFmt ? o.xFmt(v) : String(v), o.X(v), h - m.b + 16));
    if (o.xLabel || o.yLabel) axisNames(c, o.xLabel, o.yLabel);
  }

  // 그래프 안 범례. items = [{ kind:'line'|'dash'|'dot'|'box'|'bar', color, label }], pos = 'tr'(기본)|'tl'|'br'|'bl'
  // 그래프 그리는 맨 마지막에 부른다(반투명 흰 바탕이라 선·점 위에 얹어도 읽힌다). 범례 글자는 번역 대상이므로 dyn_<slug>.py에 영어를 넣는다.
  function legend(c, items, pos) {
    const list = (items || []).filter((it) => it && it.label); if (!list.length) return;
    const { ctx, w, m, pw, ph } = c; pos = pos || 'tr';
    ctx.save(); ctx.font = '11.5px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const rowH = 16, padX = 8, padY = 6, sw = 20;
    const tw = Math.max.apply(null, list.map((it) => ctx.measureText(it.label).width));
    const bw = Math.min(tw + sw + padX * 2 + 6, pw - 8), bh = list.length * rowH + padY * 2 - 3;
    const x0 = pos.indexOf('l') >= 0 ? m.l + 6 : m.l + pw - bw - 6, y0 = pos.indexOf('b') >= 0 ? m.t + ph - bh - 6 : m.t + 6;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = css('--line'); ctx.lineWidth = 1;
    roundRect(ctx, x0, y0, bw, bh, 6); ctx.fill(); ctx.stroke();
    list.forEach((it, i) => {
      const cy = y0 + padY + i * rowH + 6, cx = x0 + padX;
      ctx.strokeStyle = it.color; ctx.fillStyle = it.color;
      if (it.kind === 'dot') { ctx.beginPath(); ctx.arc(cx + sw / 2, cy, 4, 0, 7); ctx.fill(); }
      else if (it.kind === 'box' || it.kind === 'bar') { ctx.fillRect(cx + 3, cy - 5, sw - 6, 10); }
      else { ctx.lineWidth = 2.5; if (it.kind === 'dash') ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sw, cy); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
      ctx.fillStyle = css('--text'); ctx.textAlign = 'left'; ctx.fillText(it.label, cx + sw + 6, cy + 4);
    });
    ctx.restore();
  }

  function line(ctx, pts, color, width) {
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = width || 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke(); ctx.lineWidth = 1;
  }

  // 글자 뒤에 반투명 바탕을 깔고 쓴다 (선·점과 겹쳐도 읽히도록)
  function label(ctx, text, x, y, align) {
    const w = ctx.measureText(text).width, a = align || ctx.textAlign || 'left';
    const lx = a === 'right' ? x - w : a === 'center' ? x - w / 2 : x;
    const fill = ctx.fillStyle; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(lx - 3, y - 11, w + 6, 15); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }

  function vline(c, x, color, label_, align) {
    const { ctx, m, ph } = c;
    ctx.strokeStyle = color; ctx.setLineDash([2, 3]); ctx.beginPath();
    ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.textAlign = align || 'left';
    label(ctx, label_, x + (align === 'right' ? -5 : 5), m.t + 11, align || 'left');
  }

  // 점+평균선 그래프(스윕). o = { aspect, data:[{x,runs,mean}], x0, x1, y0, y1, xTicks, xFmt, yFmt, xLabel,
  //   color(첫 데이터 색), marker:{x,label}, series:[{data,color}] (추가 평균선), refs:[{y,label,color}] }
  function dots(canvas, o) {
    const c = chart(canvas, o.aspect || 0.7, { b: 40, r: 14, t: 24 });
    const { ctx, m, pw, ph } = c;
    const y0 = o.y0 == null ? 0 : o.y0, y1 = o.y1 == null ? 1 : o.y1;
    const X = (v) => m.l + ((v - o.x0) / (o.x1 - o.x0 || 1)) * pw, Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const yt = []; for (let i = 0; i <= 4; i++) yt.push(y0 + ((y1 - y0) * i) / 4);
    axes(c, { X, Y, yTicks: yt, yFmt: o.yFmt || pct, xTicks: o.xTicks, xFmt: o.xFmt, xLabel: o.xLabel, yLabel: o.yLabel });
    (o.refs || []).forEach((r) => {
      ctx.setLineDash([5, 3]); ctx.strokeStyle = r.color; ctx.beginPath(); ctx.moveTo(m.l, Y(r.y)); ctx.lineTo(m.l + pw, Y(r.y)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = r.color; ctx.textAlign = 'left'; label(ctx, r.label, m.l + 6, Y(r.y) - 6, 'left');
    });
    const all = [{ data: o.data, color: o.color || css('--accent') }].concat(o.series || []); // o.color: 첫 데이터 색 (기본은 강조색)
    all.forEach((s, k) => {
      if (!s.data || !s.data.length) return;
      if (k === 0 || s.dots) { ctx.fillStyle = mix(s.color, 0.22); s.data.forEach((d) => (d.runs || []).forEach((r) => { ctx.beginPath(); ctx.arc(X(d.x), Y(r), 2.6, 0, 7); ctx.fill(); })); }
      line(ctx, s.data.map((d) => [X(d.x), Y(d.mean)]), s.color, 2.5);
      ctx.fillStyle = s.color; s.data.forEach((d) => { ctx.beginPath(); ctx.arc(X(d.x), Y(d.mean), 3.3, 0, 7); ctx.fill(); });
    });
    if (o.marker && o.marker.x >= o.x0 && o.marker.x <= o.x1) vline(c, X(o.marker.x), css('--rich'), o.marker.label || '지금 설정', o.marker.x > (o.x0 + o.x1) / 2 ? 'right' : 'left');
    if (o.legend) legend(c, o.legend, o.legendPos);
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
  const SPEED_SCALE = 0.7; // 2026-10-12: 애니메이션이 빠르다는 의견으로 전체 속도를 70%로
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
        acc += Math.min(0.25, (ts - lastTs) / 1000) * sp * (cfg.speedScale || SPEED_SCALE); // 전체적으로 조금 느리게 (실험별로 cfg.speedScale로 조정)
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

  return { css, setup, mix, roundRect, pct, mean, chart, axes, axisNames, legend, line, vline, label, dots, jobs, harness };
})();
