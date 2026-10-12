// 사이트 공용 서비스 (모든 페이지가 불러옴)
//  ① 오늘 방문자 / 누적 방문자 (외부 무료 카운터 abacus): 같은 브라우저는 하루에 한 번만 올리고, 서비스가 응답하지 않으면 숨긴다. 날짜는 한국 시간.
//  ② 방문 기록: 페이지를 볼 때마다 구글 시트(Apps Script)에 한 줄 (시각·나라·페이지·언어·기기). IP는 보내지 않음. LOG_URL이 비어 있으면 아무것도 안 함.
//  ③ 관리자 모드: 왼쪽 위 로고를 빠르게 5번 누르면 비밀번호 창 → 관리자 화면(/admin/)
// 실제 사이트 주소에서 사람이 볼 때만 세고 기록한다 (로컬 테스트·자동화 브라우저는 읽기만).
(function () {
  // Apps Script 웹 앱 주소 (tools/analytics/README.md 참고). 비어 있으면 방문 기록을 하지 않는다.
  const LOG_URL = 'https://script.google.com/macros/s/AKfycbw0eJdnbOftjzqREDW89QTh-qcLtx4LS4Jqp48CQrDW_erf6XGBnzIXf5KhnbFLDE4q/exec';
  window.LAB_LOG_URL = LOG_URL;
  const real = location.hostname === 'heekeunlee.github.io' && !navigator.webdriver && !/HeadlessChrome/.test(navigator.userAgent);
  const isAdmin = /\/admin\/?/.test(location.pathname);
  let day;
  try { day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, ''); }
  catch (e) { const d = new Date(); day = String(d.getFullYear()) + (d.getMonth() + 1) + d.getDate(); }
  let last = null;
  try { last = localStorage.getItem('lab-visit-day'); } catch (e) {}
  const firstToday = last !== day;
  // 다시 온 방문자: 이 브라우저가 처음 온 날과 오늘이 다르면 "다시 온" 것
  let firstDay = null; try { firstDay = localStorage.getItem('lab-first-day'); if (!firstDay) { firstDay = day; localStorage.setItem('lab-first-day', day); } } catch (e) {}
  const returning = !!firstDay && firstDay !== day;

  // ① 방문자 수
  const box = document.getElementById('visits');
  if (box) {
    const API = 'https://abacus.jasoncameron.dev', NS = 'simulatiolab.heekeunlee';
    const counted = !firstToday || !real;
    const call = (key) => fetch(`${API}/${counted ? 'get' : 'hit'}/${NS}/${key}`).then((r) => (r.ok ? r.json() : null)).then((j) => (j && typeof j.value === 'number' ? j.value : null)).catch(() => null);
    Promise.all([call('d-' + day), call('visits')]).then(([today, total]) => {
      if (total == null && today == null) return;
      const fmt = (v) => (v == null ? '0' : v.toLocaleString('ko-KR'));
      document.getElementById('v-today').textContent = fmt(today);
      document.getElementById('v-total').textContent = fmt(total);
      box.hidden = false;
      if (!counted && real) { try { localStorage.setItem('lab-visit-day', day); } catch (e) {} }
    });
  }

  // ② 방문 기록
  if (LOG_URL && real && !isAdmin) {
    const country = () => {
      let cc = null; try { cc = sessionStorage.getItem('lab-cc'); } catch (e) {}
      if (cc) return Promise.resolve(cc);
      const ctl = window.AbortController ? new AbortController() : null; if (ctl) setTimeout(() => ctl.abort(), 3000);
      return fetch('https://api.country.is/', ctl ? { signal: ctl.signal } : {}).then((r) => r.json()).then((j) => { const c = (j && j.country) || 'ZZ'; try { sessionStorage.setItem('lab-cc', c); } catch (e) {} return c; }).catch(() => 'ZZ');
    };
    country().then((cc) => {
      let ref = ''; try { const r = document.referrer && new URL(document.referrer); if (r && r.hostname !== location.hostname) ref = r.hostname; } catch (e) {}
      const body = JSON.stringify({
        country: cc, page: location.pathname.replace(/^\/simulatiolab/, '') || '/', lang: (window.I18N && window.I18N.lang) || '',
        type: 'view', device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop', first: firstToday, ref, returning: returning ? 1 : 0,
      });
      fetch(LOG_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, keepalive: true }).catch(() => {});
    });
  }

  // ③ 관리자 모드: 로고 5번 연속 클릭
  const brand = document.querySelector('.nav .brand');
  if (brand) {
    let n = 0, timer = null, reset = null;
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      n++; clearTimeout(timer); clearTimeout(reset);
      if (n >= 5) { n = 0; openGate(); return; }
      // 한 번만 누른 경우에는 잠깐 뒤 원래대로 이동 (연속 클릭인지 기다림)
      const href = brand.href;
      timer = setTimeout(() => { if (n === 1) location.href = href; n = 0; }, 450);
      reset = setTimeout(() => { n = 0; }, 2000);
    });
  }
  function adminUrl() { const a = document.querySelector('.nav .brand'); return new URL('admin/', new URL(a ? a.getAttribute('href') : './', location.href)).href; }
  function openGate() {
    if (document.getElementById('admin-gate')) return;
    const wrap = document.createElement('div'); wrap.id = 'admin-gate';
    wrap.innerHTML = '<div class="ag-box" role="dialog" aria-modal="true" aria-labelledby="ag-t"><b id="ag-t">관리자 모드</b>' +
      '<p>비밀번호를 입력하세요.</p><input id="ag-pw" type="password" inputmode="numeric" autocomplete="off" maxlength="32">' +
      '<p class="ag-err" id="ag-err" hidden>비밀번호가 맞지 않아요.</p>' +
      '<div class="ag-btns"><button type="button" id="ag-cancel">취소</button><button type="button" id="ag-ok" class="on">확인</button></div></div>';
    const css = document.createElement('style');
    css.textContent = '#admin-gate{position:fixed;inset:0;z-index:999;background:rgba(15,18,34,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '#admin-gate .ag-box{width:min(340px,100%);background:#fff;color:#1b1f2a;border-radius:16px;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,.25);font:inherit}' +
      '#admin-gate b{font-size:18px}#admin-gate p{margin:8px 0;font-size:14px;color:#5a6178}#admin-gate input{width:100%;box-sizing:border-box;font:inherit;font-size:20px;letter-spacing:.3em;padding:10px 12px;border:1px solid #d6dbe6;border-radius:10px;margin-top:4px}' +
      '#admin-gate .ag-err{color:#e5484d}#admin-gate .ag-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}#admin-gate button{font:inherit;font-weight:700;padding:9px 16px;border-radius:10px;border:1px solid #d6dbe6;background:#fff;cursor:pointer}#admin-gate button.on{background:#2f6fed;border-color:#2f6fed;color:#fff}';
    wrap.appendChild(css); document.body.appendChild(wrap);
    const pw = wrap.querySelector('#ag-pw'), err = wrap.querySelector('#ag-err'), ok = wrap.querySelector('#ag-ok');
    const close = () => wrap.remove();
    pw.focus();
    wrap.querySelector('#ag-cancel').onclick = close;
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); if (e.key === 'Enter') submit(); });
    ok.onclick = submit;
    function pass() { try { sessionStorage.setItem('lab-admin', pw.value); } catch (e) {} location.href = adminUrl(); }
    function submit() {
      err.hidden = true; ok.disabled = true; ok.textContent = '확인 중…';
      // 구글 쪽(Apps Script)에서 비밀번호를 확인한다. 아직 연결 전이면 기본 비밀번호로만 들어가 연결 안내를 본다.
      const check = LOG_URL ? fetch(LOG_URL + '?a=check&pw=' + encodeURIComponent(pw.value)).then((r) => r.json()).then((j) => !!(j && j.ok)).catch(() => false)
        : Promise.resolve(pw.value === '0001');
      check.then((good) => { if (good) pass(); else { ok.disabled = false; ok.textContent = '확인'; err.hidden = false; pw.select(); } });
    }
  }
})();
