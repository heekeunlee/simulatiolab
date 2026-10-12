// 관리자 화면: 구글 시트(Apps Script)에 쌓인 방문 기록을 나라·날짜·시간별로 보여준다.
(function () {
  const $ = (id) => document.getElementById(id);
  const LOG_URL = window.LAB_LOG_URL || '';
  const COLORS = ['#2f6fed', '#e5484d', '#1fa463', '#e0a100', '#7c5cff', '#0ea5a5', '#c2410c', '#9aa3b5'];
  let pw = null; try { pw = sessionStorage.getItem('lab-admin'); } catch (e) {}
  let rows = [], demo = false;
  const names = (() => { try { return new Intl.DisplayNames(['ko'], { type: 'region' }); } catch (e) { return null; } })();
  const cname = (cc) => (cc === 'ZZ' ? '알 수 없음' : (names && names.of(cc)) || cc);
  const flag = (cc) => (/^[A-Z]{2}$/.test(cc) && cc !== 'ZZ' ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐');
  const pageTitle = (() => { const m = {}; (window.LAB_EXPS || []).forEach((x) => { m['/experiments/' + x.s + '/'] = x.ko; }); m['/'] = '메인 페이지'; m['/index.html'] = '메인 페이지'; return (p) => m[p] || p; })();
  const fmtN = (v) => Number(v || 0).toLocaleString('ko-KR');

  $('logout').onclick = () => { try { sessionStorage.removeItem('lab-admin'); } catch (e) {} location.href = '../'; };

  function showGate() {
    $('gate').hidden = false; $('pw').focus();
    const go = () => {
      const v = $('pw').value; $('gerr').hidden = true;
      const check = LOG_URL ? fetch(LOG_URL + '?a=check&pw=' + encodeURIComponent(v)).then((r) => r.json()).then((j) => !!(j && j.ok)).catch(() => false) : Promise.resolve(v === '0001');
      check.then((ok) => { if (ok) { pw = v; try { sessionStorage.setItem('lab-admin', v); } catch (e) {} $('gate').hidden = true; start(); } else { $('gerr').hidden = false; $('pw').select(); } });
    };
    $('enter').onclick = go; $('pw').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  }

  function legacy() {
    const API = 'https://abacus.jasoncameron.dev/get/simulatiolab.heekeunlee/';
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, '');
    const get = (k) => fetch(API + k).then((r) => (r.ok ? r.json() : null)).then((j) => (j ? j.value : 0)).catch(() => null);
    return Promise.all([get('d-' + day), get('visits')]).then(([t, a]) => ({ today: t, total: a }));
  }
  const card = (label, value, sub) => `<div class="ad-card"><small>${label}</small><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

  function start() {
    if (!LOG_URL) {
      $('setup').hidden = false;
      legacy().then((l) => { $('legacy').innerHTML = card('오늘 방문자 (기존 카운터)', l.today == null ? '-' : fmtN(l.today)) + card('누적 방문자 (기존 카운터)', l.total == null ? '-' : fmtN(l.total)); });
      $('demo').onclick = () => { demo = true; $('setup').hidden = true; $('dash').hidden = false; $('demo-note').hidden = false; rows = demoRows(+$('days').value); render(); };
      return;
    }
    $('dash').hidden = false; load();
  }

  function load() {
    if (demo) { rows = demoRows(+$('days').value); return render(); }
    $('status').textContent = '불러오는 중…';
    fetch(LOG_URL + '?a=stats&days=' + $('days').value + '&pw=' + encodeURIComponent(pw)).then((r) => r.json()).then((j) => {
      if (!j || !j.ok) { $('dash').hidden = true; try { sessionStorage.removeItem('lab-admin'); } catch (e) {} return showGate(); }
      rows = j.rows || []; render(j.total);
    }).catch((e) => { $('status').textContent = '불러오지 못했어요: ' + e.message; });
  }
  $('days').onchange = load; $('tz').onchange = () => render(); $('reload').onclick = load;

  // 행: [시각ISO, 나라, 페이지, 언어, 기기, 오늘첫방문(1/0), 들어온곳]
  function render(total) {
    const tz = $('tz').value;
    const dfmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const hfmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false });
    const tfmt = new Intl.DateTimeFormat('ko-KR', { timeZone: tz, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const ALL = rows.map((r) => { const t = new Date(r[0]); return { t, d: dfmt.format(t), h: +hfmt.format(t) % 24, cc: r[1] || 'ZZ', page: r[2] || '/', lang: r[3] || '-', dev: r[4] || '-', first: +r[5] === 1, ref: r[6] || '', type: r[7] || 'view', secs: +r[8] || 0, ran: +r[9] === 1, ret: +r[10] === 1 }; }).sort((a, b) => a.t - b.t);
    const R = ALL.filter((x) => x.type !== 'leave');          // 페이지를 연 기록
    const LV = ALL.filter((x) => x.type === 'leave');         // 떠날 때 기록 (머문 시간·실험 실행 여부, 시트 v2부터)
    const V = R.filter((x) => x.first);   // 방문자 = 그 브라우저의 그날 첫 방문
    const by = (arr, f) => { const m = new Map(); arr.forEach((x) => { const k = f(x); m.set(k, (m.get(k) || 0) + 1); }); return m; };
    const cV = by(V, (x) => x.cc), cP = by(R, (x) => x.cc);
    const ccs = [...new Set(R.map((x) => x.cc))].sort((a, b) => (cV.get(b) || 0) - (cV.get(a) || 0) || (cP.get(b) || 0) - (cP.get(a) || 0));
    const top = ccs.slice(0, 7), color = (cc) => (top.indexOf(cc) >= 0 ? COLORS[top.indexOf(cc)] : COLORS[7]);
    const today = dfmt.format(new Date());
    loadPreds(); loadPolls(); loadSubs();
    $('status').textContent = `기록 ${fmtN(R.length)}건 (기간 안) · 시간 기준: ${tz === 'UTC' ? 'UTC' : '한국 시간'}` + (total != null ? ` · 시트 전체 ${fmtN(total)}건` : '');
    const dwell = LV.length ? Math.round(LV.reduce((a, x) => a + x.secs, 0) / LV.length) : null;
    const expLV = LV.filter((x) => /\/experiments\//.test(x.page));
    const ranPct = expLV.length ? Math.round((100 * expLV.filter((x) => x.ran).length) / expLV.length) : null;
    const retPct = V.length ? Math.round((100 * V.filter((x) => x.ret).length) / V.length) : null;
    const hasRet = V.some((x) => x.ret) || LV.length > 0;
    const mmss = (sec) => (sec == null ? '-' : sec >= 60 ? Math.floor(sec / 60) + '분 ' + String(sec % 60).padStart(2, '0') + '초' : sec + '초');
    $('cards').innerHTML = card('방문자', fmtN(V.length), '브라우저별 하루 첫 방문') + card('페이지 조회', fmtN(R.length)) + card('나라 수', fmtN(ccs.filter((c) => c !== 'ZZ').length)) +
      card('오늘 방문자', fmtN(V.filter((x) => x.d === today).length)) + card('1인당 페이지', V.length ? (R.length / V.length).toFixed(1) : '-') +
      card('평균 머문 시간', mmss(dwell), dwell == null ? '시트를 v2로 바꾸면 기록됨' : `실험 페이지 ${expLV.length ? mmss(Math.round(expLV.reduce((a, x) => a + x.secs, 0) / expLV.length)) : '-'}`) +
      card('다시 온 방문자', hasRet && retPct != null ? retPct + '%' : '-', '이전 날에도 온 브라우저') +
      card('실험을 돌린 비율', ranPct == null ? '-' : ranPct + '%', '실험 페이지에서 설정을 만지거나 버튼을 누른 비율');
    const maxV = Math.max(1, ...ccs.map((c) => cV.get(c) || 0));
    $('countries').innerHTML = ccs.length ? ccs.map((c) => `<div class="ad-row"><span class="fl">${flag(c)}</span><span class="nm">${cname(c)} <small style="color:var(--muted)">${c}</small></span><span class="v">${fmtN(cV.get(c) || 0)}명</span><span class="p">${fmtN(cP.get(c) || 0)}회</span><span class="bar" style="width:${(100 * (cV.get(c) || 0)) / maxV}%;background:${color(c)}"></span></div>`).join('') : '<p class="small">기간 안 기록이 없어요.</p>';
    // 날짜별 (기간의 모든 날짜를 빈칸 없이)
    const days = []; const n = +$('days').value;
    for (let i = n - 1; i >= 0; i--) days.push(dfmt.format(new Date(Date.now() - i * 864e5)));
    const uniqDays = [...new Set(days)];
    stacked($('c-days'), uniqDays.map((d) => d.slice(5).replace('-', '/')), uniqDays.map((d) => groupTop(V.filter((x) => x.d === d), top)), top);
    $('leg-days').innerHTML = legend(top, ccs.length > top.length);
    // 시간대별 (기간 합계)
    const hours = [...Array(24).keys()];
    stacked($('c-hours'), hours.map((h) => String(h)), hours.map((h) => groupTop(V.filter((x) => x.h === h), top)), top);
    $('leg-hours').innerHTML = legend(top, ccs.length > top.length);
    $('hour-note').textContent = `(기간 합계 · ${tz === 'UTC' ? 'UTC' : '한국 시간'} 0~23시)`;
    // 페이지
    const pP = [...by(R, (x) => x.page)].sort((a, b) => b[1] - a[1]).slice(0, 15), maxP = Math.max(1, ...pP.map((x) => x[1]));
    $('pages').innerHTML = pP.map(([p, v]) => `<div class="ad-row"><span class="fl">📄</span><span class="nm" title="${p}">${pageTitle(p)}</span><span class="v">${fmtN(v)}회</span><span class="p"></span><span class="bar" style="width:${(100 * v) / maxP}%"></span></div>`).join('') || '<p class="small">기록 없음</p>';
    // 언어·기기·들어온 곳
    const LN = { ko: '한국어', en: 'English', es: 'Español', fr: 'Français', ja: '日本語', ru: 'Русский', zh: '中文' };
    const list = (m, f) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${f ? f(k) : k} <b>${fmtN(v)}</b>`).join(' · ') || '-';
    $('mix').innerHTML = `<div class="ad-mix"><h3>화면 언어 (페이지 조회)</h3><p>${list(by(R, (x) => x.lang), (k) => LN[k] || k)}</p><h3>기기 (방문자)</h3><p>${list(by(V, (x) => x.dev), (k) => ({ mobile: '휴대폰·태블릿', desktop: '컴퓨터' }[k] || k))}</p><h3>들어온 곳 (방문자, 직접 접속 제외)</h3><p>${list(by(V.filter((x) => x.ref), (x) => x.ref))}</p></div>`;
    // 나라 × 날짜
    $('matrix').innerHTML = `<table class="ad-tbl"><thead><tr><th>나라</th>${uniqDays.map((d) => `<th>${d.slice(5).replace('-', '/')}</th>`).join('')}<th>합계</th></tr></thead><tbody>` +
      ccs.map((c) => `<tr><td>${flag(c)} ${cname(c)}</td>${uniqDays.map((d) => { const v = V.filter((x) => x.cc === c && x.d === d).length; return `<td${v ? ' class="h"' : ''}>${v || ''}</td>`; }).join('')}<td class="h">${fmtN(cV.get(c) || 0)}</td></tr>`).join('') + '</tbody></table>';
    // 최근 기록
    $('recent').innerHTML = `<table class="ad-tbl"><thead><tr><th>시각</th><th>나라</th><th>페이지</th><th>언어</th><th>기기</th><th>첫 방문</th><th>들어온 곳</th></tr></thead><tbody>` +
      R.slice(-100).reverse().map((x) => `<tr><td>${tfmt.format(x.t)}</td><td>${flag(x.cc)} ${cname(x.cc)}</td><td style="text-align:left">${pageTitle(x.page)}</td><td>${LN[x.lang] || x.lang}</td><td>${x.dev === 'mobile' ? '휴대폰' : x.dev === 'desktop' ? '컴퓨터' : x.dev}</td><td>${x.first ? '●' : ''}</td><td>${x.ref}</td></tr>`).join('') + '</tbody></table>';
  }
  // 예상 투표: 실험별 참여 수·정답률·선택 분포 (시트 v3부터)
  function loadPreds() {
    const box = $('preds'); if (!box) return;
    const P = window.LAB_PREDICT || {}, E = {}; (window.LAB_EXPS || []).forEach((x) => { E[x.s] = x.ko; });
    const draw = (preds) => {
      const rowsP = Object.keys(P).map((s) => { const c = (preds && preds[s]) || [], n = c.slice(0, P[s].o.length).reduce((a, b) => a + (b || 0), 0); return { s, c, n, ok: n ? Math.round((100 * (c[P[s].a] || 0)) / n) : null }; }).sort((a, b) => b.n - a.n);
      box.innerHTML = `<table class="ad-tbl"><thead><tr><th>실험</th><th>참여</th><th>정답률</th><th>선택 분포 (보기 순서대로)</th></tr></thead><tbody>` + rowsP.map((r) => `<tr><td style="text-align:left">${E[r.s] || r.s}</td><td>${fmtN(r.n)}</td><td class="h">${r.ok == null ? '-' : r.ok + '%'}</td><td style="text-align:left">${r.n ? P[r.s].o.map((o, i) => `${i === P[r.s].a ? '✓ ' : ''}${o} <b>${Math.round((100 * (r.c[i] || 0)) / r.n)}%</b>`).join(' · ') : '아직 없음'}</td></tr>`).join('') + '</tbody></table>';
    };
    if (demo) { const f = {}; Object.keys(P).forEach((s, i) => { const n = 30 + i * 7; const a = P[s].a; const c = P[s].o.map((_, k) => (k === a ? Math.round(n * (0.25 + 0.04 * i)) : Math.round(n * 0.3))); f[s] = c; }); return draw(f); }
    if (!LOG_URL) return draw(null);
    fetch(LOG_URL + '?a=preds&pw=' + encodeURIComponent(pw)).then((r) => r.json()).then((j) => draw(j && j.ok ? j.preds : null)).catch(() => draw(null));
  }
  // 주제 투표·오늘의 만약에 결과, 알림 신청자 수 (시트 v3/v4부터)
  function loadPolls() {
    const box = $('polls'); if (!box) return;
    const D = window.LAB_DAILY; if (!D) { box.innerHTML = ''; return; }
    const ymd = (off) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now() + off * 864e5)).replace(/-/g, '');
    const dayIndex = (d) => Math.floor(Date.parse(d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) + 'T00:00:00+09:00') / 864e5);
    const draw = (preds) => {
      const row = (label, opts, c) => { const n = c ? c.slice(0, opts.length).reduce((a, b) => a + (b || 0), 0) : 0; return `<tr><td style="text-align:left">${label}</td><td>${fmtN(n)}</td><td style="text-align:left">${n ? opts.map((o, i) => `${o} <b>${Math.round((100 * (c[i] || 0)) / n)}%</b>`).join(' · ') : '아직 없음'}</td></tr>`; };
      let h = `<table class="ad-tbl"><thead><tr><th>투표</th><th>참여</th><th>선택 분포</th></tr></thead><tbody>` + row('🗳 ' + D.topic.q, D.topic.o, preds && preds[D.topic.id]);
      for (let i = 0; i < 7; i++) { const d = ymd(-i), Q = D.daily[((dayIndex(d) % D.daily.length) + D.daily.length) % D.daily.length]; h += row(`${d.slice(4, 6)}/${d.slice(6)} ${Q.q}`, Q.o, preds && preds['daily-' + d]); }
      box.innerHTML = h + '</tbody></table>';
    };
    if (demo) { const f = {}; f[D.topic.id] = [31, 12, 22, 9]; return draw(f); }
    if (!LOG_URL) return draw(null);
    fetch(LOG_URL + '?a=preds&pw=' + encodeURIComponent(pw)).then((r) => r.json()).then((j) => draw(j && j.ok ? j.preds : null)).catch(() => draw(null));
  }
  let subsCount = null;
  function loadSubs() {
    if (demo) { subsCount = 12; return; } if (!LOG_URL) return;
    fetch(LOG_URL + '?a=subs&pw=' + encodeURIComponent(pw)).then((r) => r.json()).then((j) => { if (j && j.ok) { subsCount = j.count; const c = $('cards'); if (c && !c.querySelector('.subs')) c.insertAdjacentHTML('beforeend', card('알림 신청자', fmtN(subsCount), '이메일은 구글 시트(subscribers)에서 확인').replace('class="ad-card"', 'class="ad-card subs"')); } }).catch(() => {});
  }
  const groupTop = (arr, top) => { const g = top.map(() => 0); let other = 0; arr.forEach((x) => { const i = top.indexOf(x.cc); if (i >= 0) g[i]++; else other++; }); g.push(other); return g; };
  const legend = (top, hasOther) => top.map((c, i) => `<span><i style="background:${COLORS[i]}"></i>${flag(c)} ${cname(c)}</span>`).join('') + (hasOther ? `<span><i style="background:${COLORS[7]}"></i>기타</span>` : '');

  function stacked(cv, labels, data, top) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 600, H = cv.clientHeight || 240;
    cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const m = { l: 34, r: 8, t: 10, b: 24 }, pw_ = W - m.l - m.r, ph = H - m.t - m.b;
    const sums = data.map((g) => g.reduce((a, b) => a + b, 0)), max = Math.max(1, ...sums);
    const step = Math.max(1, Math.ceil(max / 4)), yMax = step * 4;
    c.font = '11px system-ui, sans-serif'; c.fillStyle = '#8a92a6'; c.strokeStyle = '#e6e9f0'; c.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const y = m.t + ph - (ph * i) / 4; c.beginPath(); c.moveTo(m.l, y); c.lineTo(W - m.r, y); c.stroke(); c.fillText(String(step * i), m.l - 6, y + 4); }
    const bw = pw_ / labels.length;
    data.forEach((g, i) => {
      let y = m.t + ph;
      g.forEach((v, k) => { if (!v) return; const h = (ph * v) / yMax; c.fillStyle = k < top.length ? COLORS[k] : COLORS[7]; c.fillRect(m.l + i * bw + bw * 0.12, y - h, bw * 0.76, h); y -= h; });
    });
    c.fillStyle = '#8a92a6'; c.textAlign = 'center';
    const every = Math.ceil(labels.length / Math.max(1, Math.floor(pw_ / 34)));
    labels.forEach((l, i) => { if (i % every === 0) c.fillText(l, m.l + i * bw + bw / 2, H - 7); });
  }

  // 예시 데이터 (연결 전 화면 미리보기용)
  function demoRows(days) {
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const W = [['KR', 40], ['US', 12], ['JP', 9], ['ES', 5], ['FR', 4], ['MX', 3], ['RU', 3], ['CN', 3], ['DE', 2], ['VN', 2], ['ZZ', 1]];
    const tot = W.reduce((a, b) => a + b[1], 0), pick = () => { let x = r() * tot; for (const [c, w] of W) { if ((x -= w) < 0) return c; } return 'KR'; };
    const pages = ['/', '/experiments/talent-vs-luck/', '/experiments/braess/', '/experiments/schelling/', '/experiments/firefly/', '/experiments/regression/'];
    const L = { KR: 'ko', US: 'en', JP: 'ja', ES: 'es', FR: 'fr', MX: 'es', RU: 'ru', CN: 'zh', DE: 'en', VN: 'en', ZZ: 'en' };
    const out = [];
    for (let i = 0; i < Math.min(days, 90) * 18; i++) {
      const t = new Date(Date.now() - r() * days * 864e5), cc = pick(), first = r() < 0.45;
      const pg = pages[Math.floor(r() * pages.length)], dev = r() < 0.6 ? 'mobile' : 'desktop', ret = r() < 0.22 ? 1 : 0;
      out.push([t.toISOString(), cc, pg, L[cc], dev, first ? 1 : 0, r() < 0.3 ? (r() < 0.7 ? 'www.youtube.com' : 'www.google.com') : '', 'view', 0, 0, ret]);
      if (r() < 0.8) out.push([new Date(t.getTime() + 60000).toISOString(), cc, pg, L[cc], dev, 0, '', 'leave', Math.round(20 + r() * r() * 400), r() < 0.55 ? 1 : 0, ret]);
    }
    return out;
  }

  if (!LOG_URL && pw === '0001') start();
  else if (LOG_URL && pw) start();
  else showGate();
  window.addEventListener('resize', () => { if (!$('dash').hidden && rows.length) render(); });
})();
