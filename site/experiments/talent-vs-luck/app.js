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
  let sim = null, st = null, view = null;
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
    const lgItems = [{ kind: 'box', color: css('--accent'), label: '시작보다 늘어남' }, { kind: 'box', color: css('--muted'), label: '시작과 같음' }, { kind: 'box', color: mix(css('--muted'), 0.55), label: '시작보다 줄어듦' }], lgSp = Lab.belowSpace($('c-hist'), lgItems);
    const { ctx, w, h } = setup($('c-hist'), 0.95 + lgSp.extra / ($('c-hist').clientWidth || 400));
    const c0 = sim.params.c0;
    const ks = Array.from(sim.capital, (c) => Math.round(Math.log2(c / c0)));
    const kmin = Math.min(...ks), kmax = Math.max(...ks);
    const counts = new Array(kmax - kmin + 1).fill(0);
    ks.forEach((k) => counts[k - kmin]++);
    const rawMax = Math.max(...counts);
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax / 4))), r0 = rawMax / 4 / mag;
    const gstep = (r0 <= 1 ? 1 : r0 <= 2 ? 2 : r0 <= 5 ? 5 : 10) * mag;
    const cmax = Math.ceil(rawMax / gstep) * gstep;
    const m = { l: 40, r: 8, t: 34, b: lgSp.b };
    const cc = { ctx, w, h, m, pw: w - 40 - 8, ph: h - 34 - m.b };
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
    Lab.drawLegendBelow(cc, lgItems);
  }

  // ---------- ③ 산점도 ----------
  function drawScatter() {
    const lgItems = [{ kind: 'dot', color: mix(css('--accent'), 0.6), label: '보통 사람' }, { kind: 'dot', color: css('--rich'), label: '최고 부자' }, { kind: 'dot', color: css('--talent'), label: '최고 노력자' }], lgSp = Lab.belowSpace($('c-scatter'), lgItems);
    const { ctx, w, h } = setup($('c-scatter'), 0.7 + lgSp.extra / ($('c-scatter').clientWidth || 400));
    const c0 = sim.params.c0, n = sim.n;
    const ks = Array.from(sim.capital, (c) => Math.log2(c / c0));
    const kmin = Math.min(...ks) - 0.8, kmax = Math.max(...ks) + 0.8;
    const tmin = Math.min(...sim.talent) - 0.02, tmax = Math.max(...sim.talent) + 0.02;
    const m = { l: 48, r: 10, t: 24, b: lgSp.b };
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
    Lab.axisNames(cc, '노력', '최종 자본');
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
    mark(st.mostTalented, css('--talent'), '최고 노력자 ' + fmtCap(sim.capital[st.mostTalented]), -10);
    Lab.drawLegendBelow(cc, lgItems);
    function x(i) { return X(sim.talent[i]); }
  }

  // ---------- ④ 타임라인 ----------
  function drawTimeline() {
    const lgItems = [{ kind: 'line', color: css('--rich'), label: '최고 부자' }, { kind: 'line', color: css('--talent'), label: '최고 노력자' }, { kind: 'up', color: css('--lucky'), label: '행운을 잡음' }, { kind: 'down', color: css('--unlucky'), label: '불운' }, { kind: 'ring', color: '#7a8699', label: '행운이 왔지만 놓침' }], lgSp = Lab.belowSpace($('c-time'), lgItems);
    const { ctx, w, h } = setup($('c-time'), 0.7 + lgSp.extra / ($('c-time').clientWidth || 400));
    const c0 = sim.params.c0, n = sim.n, T = sim.steps;
    const k = (t, i) => Math.log2(sim.history[t * n + i] / c0);
    const others = st.byCap.slice(1, 5);
    const series = [st.richest, st.mostTalented, ...others];
    let kmin = 0, kmax = 0;
    series.forEach((i) => { for (let t = 0; t <= T; t++) { const v = k(t, i); kmin = Math.min(kmin, v); kmax = Math.max(kmax, v); } });
    kmin -= 0.8; kmax += 0.8;
    const m = { l: 48, r: 10, t: 24, b: lgSp.b };
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
      // 모양으로도 구분: 행운을 잡음 ▲(초록), 불운 ▼(빨강), 놓친 행운 ◯(회색 속 빈 원)
      const tri = (dir, col) => { ctx.beginPath(); ctx.moveTo(x, y + dir * 5.5); ctx.lineTo(x - 5.5, y - dir * 4.2); ctx.lineTo(x + 5.5, y - dir * 4.2); ctx.closePath(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; };
      if (code === TL.LUCKY_USED) tri(-1, css('--lucky'));
      else if (code === TL.UNLUCKY) tri(1, css('--unlucky'));
      else { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#7a8699'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.lineWidth = 1; }
    }
    Lab.drawLegendBelow(cc, lgItems);
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

  // ---------- ① 100명이 걸어 다니기 ----------
  // 화면 속 세계는 가로세로 100칸, 사람 100명. 모델과 같은 규칙(행운은 노력만큼의 확률, 불운은 무조건 절반)을 눈에 보이게 옮긴 그림이고,
  // 사람당 만남 빈도(6개월에 약 0.04번)도 같게 맞췄다. 아래 통계·그래프는 1,000명 모델의 계산이다.
  const VIEW_N = 100, VIEW_W = 100, V_SPEED = 3, HIT_R = 2.5;
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const lerpHex = (a, b, t) => { const pa = [1, 3, 5].map((i) => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.substr(i, 2), 16)); return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  function rng32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function createView(p, sd) {
    const rnd = rng32(sd * 7919 + 13), W = VIEW_W;
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); };
    const nItems = Math.max(2, Math.round(p.events * 26 / 500)), nLucky = Math.round(nItems * p.pLucky);
    const people = Array.from({ length: VIEW_N }, () => { let t; do { t = (p.meanT || 0.6) + p.sdT * gauss(); } while (t < 0 || t > 1); return { x: rnd() * W, y: rnd() * W, ang: rnd() * 6.2832, tal: t, k: 0, kd: 0 }; });
    const items = Array.from({ length: nItems }, (_, i) => ({ x: rnd() * W, y: rnd() * W, lucky: i < nLucky, born: 0 }));
    let topT = 0; people.forEach((q, i) => { if (q.tal > people[topT].tal) topT = i; });
    const v = { t: 0, steps: p.years * 2, people, items, fx: [], topT, rnd, W };
    v.advance = function (dt) {   // dt = 지난 시간(6개월 단위)
      let left = dt;
      while (left > 1e-9) {
        const d = Math.min(left, 0.2); left -= d; v.t += d;
        for (const q of people) {
          q.ang += (rnd() - 0.5) * 1.1 * Math.sqrt(d);
          q.x = (q.x + Math.cos(q.ang) * V_SPEED * d + W) % W; q.y = (q.y + Math.sin(q.ang) * V_SPEED * d + W) % W;
          for (const it of items) {
            if (it.born > v.t) continue;
            let dx = Math.abs(it.x - q.x), dy = Math.abs(it.y - q.y); if (dx > W / 2) dx = W - dx; if (dy > W / 2) dy = W - dy;
            if (dx * dx + dy * dy > HIT_R * HIT_R) continue;
            let kind;
            if (it.lucky) { if (rnd() < q.tal) { q.k++; kind = 'up'; } else kind = 'miss'; } else { q.k--; kind = 'down'; }
            v.fx.push({ x: it.x, y: it.y, kind, at: v.t });
            it.x = rnd() * W; it.y = rnd() * W; it.born = v.t + 0.5;   // 다른 곳에 새로 놓인다
          }
        }
        if (v.t >= v.steps) { v.t = v.steps; return false; }
      }
      return true;
    };
    v.run = function () { while (v.advance(0.2)) { /* 끝까지 */ } };
    return v;
  }

  function personPath(ctx, x, y, h) {   // 사람 픽토그램: 머리 + 어깨/몸통 (발 끝이 y)
    const r = h * 0.22, bw = h * 0.62;
    ctx.beginPath(); ctx.arc(x, y - h + r, r, 0, 7);
    ctx.moveTo(x - bw / 2, y); ctx.lineTo(x - bw / 2, y - h * 0.34); ctx.quadraticCurveTo(x - bw / 2, y - h * 0.58, x, y - h * 0.58);
    ctx.quadraticCurveTo(x + bw / 2, y - h * 0.58, x + bw / 2, y - h * 0.34); ctx.lineTo(x + bw / 2, y); ctx.closePath();
  }
  let sizeCap = 5.5;
  const sizeF = (k) => Math.min(1 + 0.5 * Math.abs(k), sizeCap);   // 한 번 만날 때마다 키가 절반씩 더 커진다 (격차가 확 벌어져 보이게)
  function personColor(k) {
    if (k > 0.05) return lerpHex('#8db2f7', '#071d66', Math.min(k / 4.5, 1));
    if (k < -0.05) return lerpHex('#f29a9e', '#6a0710', Math.min(-k / 4.5, 1));
    return '#a3a9b8';
  }

  let lastDraw = 0;
  function drawWorld(dtSec) {
    const { ctx, w } = setup($('c-world'), 1);
    const s = w / VIEW_W, base = Math.max(12, w / 42); sizeCap = w < 500 ? 4 : 5.5;   // 좁은 화면에서는 너무 겹치지 않게 상한을 낮춤
    const px = (v) => v * s;
    ctx.fillStyle = '#f7f9fd'; ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(99,106,122,.10)';
    for (let g = 10; g < VIEW_W; g += 10) for (let h = 10; h < VIEW_W; h += 10) { ctx.beginPath(); ctx.arc(px(g), px(h), 1, 0, 7); ctx.fill(); }

    // 행운은 초록빛, 불운은 붉은빛
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const it of view.items) {
      if (it.born > view.t) continue;
      const a = Math.min(1, (view.t - it.born) / 0.4), pop = 0.4 + 0.6 * (1 - Math.exp(-(view.t - it.born) * 6));
      const col = it.lucky ? '#1fa463' : '#e5484d', R = base * 2.6 * pop, x = px(it.x), y = px(it.y);
      ctx.globalAlpha = Math.max(0.15, a);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R);   // 번지는 빛: 행운은 초록빛, 불운은 붉은빛
      gr.addColorStop(0, mix(col, 0.55)); gr.addColorStop(0.45, mix(col, 0.26)); gr.addColorStop(1, mix(col, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
      ctx.fillStyle = it.lucky ? '#168a52' : '#d6232a'; ctx.beginPath(); ctx.arc(x, y, base * 0.2 * pop, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 사람: 행운을 만나면 파랑으로 커지고 짙어지고, 불운을 만나면 빨강으로 커지고 짙어진다 (서로 상쇄)
    const k = Math.min(1, (dtSec || 0) * 5);
    view.people.forEach((q) => { q.kd += (q.k - q.kd) * (dtSec == null ? 1 : k); });
    const order = view.people.map((q, i) => i).sort((a, b) => Math.abs(view.people[a].kd) - Math.abs(view.people[b].kd));
    for (const i of order) {
      const q = view.people[i], f = sizeF(q.kd), h = base * 0.95 * f;
      personPath(ctx, px(q.x), px(q.y) + h * 0.5, h);
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
      ctx.fillStyle = personColor(q.kd); ctx.fill();
    }

    // 만난 순간의 물결: 파랑(붙잡음) / 빨강(불운) / 회색(놓침)
    view.fx = view.fx.filter((e) => view.t - e.at < 0.9);
    for (const e of view.fx) {
      const u = (view.t - e.at) / 0.9;
      ctx.globalAlpha = 1 - u; ctx.lineWidth = 3; ctx.strokeStyle = e.kind === 'up' ? '#2f6fed' : e.kind === 'down' ? '#d6232a' : '#8b93a5';
      ctx.beginPath(); ctx.arc(px(e.x), px(e.y), base * (0.8 + u * 2.4), 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (!THUMB) {
      // 노력 1등에게 보라색 고리, 지금 가장 부자(파랑이 가장 큰 사람)에게 왕관
      const t = view.people[view.topT]; ctx.strokeStyle = '#7c5cff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px(t.x), px(t.y), base * 0.95 * sizeF(t.kd) * 0.6 + 4, 0, 7); ctx.stroke();
      chip(ctx, '최고 노력자', px(t.x), px(t.y) - base * 0.95 * sizeF(t.kd) * 0.4, '#7c5cff', w);
      let rich = 0; view.people.forEach((q, i) => { if (q.k > view.people[rich].k) rich = i; });
      const r = view.people[rich]; if (r.k >= 2) { ctx.font = `${Math.round(base * 1.5)}px ${EMOJI}`; ctx.fillStyle = '#000'; ctx.fillText('👑', px(r.x), px(r.y) - base * 0.95 * sizeF(r.kd) * 0.5 - base * 0.7); }
    }

    // 요약: 시간, 상위 20%의 몫, 색별 인원
    const caps = view.people.map((q) => 10 * Math.pow(2, q.k)).sort((a, b) => b - a);
    const total = caps.reduce((x, y) => x + y, 0), top20 = caps.slice(0, Math.round(VIEW_N * 0.2)).reduce((x, y) => x + y, 0);
    const step = Math.floor(view.t);
    $('when').textContent = `${Math.floor(step / 2)}년 ${step % 2 ? 6 : 0}개월 · 상위 20%의 몫 ${(top20 / total * 100).toFixed(0)}%`;
    const nb = view.people.filter((q) => q.k > 0).length, nr = view.people.filter((q) => q.k < 0).length;
    const wc = $('wcount'); if (wc) wc.textContent = `파랑 ${nb}명 · 회색 ${VIEW_N - nb - nr}명 · 빨강 ${nr}명`;
    const bar = $('prog'); if (bar) bar.style.width = (view.t / view.steps * 100) + '%';
  }

  function resetAnim() {
    view = createView(readParams(), seed);
    playing = false; acc = 0;
    $('play').textContent = '▶ 재생';
    drawWorld();
  }

  function tick(ts) {
    const dtSec = Math.min(0.25, (ts - lastTs) / 1000);
    if (playing) {
      if (!view.advance(dtSec * Number($('speed').value) * SPEED * 0.6)) { playing = false; $('play').textContent = '▶ 다시 재생'; }
      drawWorld(dtSec);
    } else if (view && view.people.some((q) => Math.abs(q.kd - q.k) > 0.01)) drawWorld(dtSec);
    lastTs = ts;
    requestAnimationFrame(tick);
  }

  // ---------- 통계 카드 ----------
  function renderStats() {
    const c0 = sim.params.c0;
    const talRank = st.byTal.indexOf(st.richest) + 1;
    const cards = [
      ['최고 부자의 노력', st.richestTalent.toFixed(2), `평균 ${st.meanTalent.toFixed(2)} · 노력 순위 ${talRank}위 / ${sim.n}명`],
      ['최고 노력자의 최종 자본', fmtCap(st.mostTalentedCapital), `노력 ${st.mostTalentedTalent.toFixed(2)} (1위) · 시작은 ${c0}`],
      ['상위 20%가 가진 자본', (st.top20Share * 100).toFixed(0) + '%', '파레토 법칙(80/20)과 비교해 보세요'],
      ['시작값보다 줄어든 사람', (st.belowInitial * 100).toFixed(0) + '%', '운이 나쁘면 노력해도 줄어요'],
      ['부자 상위 10명 중 노력 상위 10%', st.richInTopDecile + '명', '노력만으로 정해진다면 10명'],
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
      `같은 설정으로 운만 바꿔 ${n}번 돌렸습니다. 최고 부자의 노력 중앙값은 ${median(rt).toFixed(2)}(평균 ${meanT}), ` +
      `그 판에서 노력이 가장 높은 사람이 최고 부자가 된 횟수는 ${wins}번이었고, ` +
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
    Lab.axisNames({ ctx, w, h, m, pw, ph }, '최고 부자의 노력', '반복 횟수 (번)');
    ctx.fillStyle = css('--muted');
    ctx.textAlign = 'right'; ctx.fillText(String(cmax), m.l - 6, m.t + 8); ctx.fillText('0', m.l - 6, m.t + ph);

    const vline = (t, color, label, align) => {
      ctx.strokeStyle = color; ctx.setLineDash([4, 3]); ctx.beginPath();
      ctx.moveTo(X(t), m.t - 4); ctx.lineTo(X(t), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(label, X(t) + (align === 'left' ? 4 : -4), m.t + 4);
    };
    const maxT = mean(rows.map((r) => r.maxTalent));
    vline(meanT, css('--muted'), '평균 ' + meanT, 'right');
    vline(maxT, css('--talent'), '노력 1위의 평균 ' + maxT.toFixed(2), 'right');
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
    if (view.t >= view.steps) resetAnim();
    playing = !playing;
    $('play').textContent = playing ? '⏸ 일시정지' : '▶ 재생';
  });
  $('restart').addEventListener('click', resetAnim);

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

  showOutputs();
  run();
  if (THUMB) { view.run(); view.people.forEach((q) => { q.kd = q.k; }); drawWorld(); }
  requestAnimationFrame((ts) => { lastTs = ts; tick(ts); });
})();
