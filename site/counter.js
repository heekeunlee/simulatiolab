// 오늘 방문자 / 누적 방문자 (외부 무료 카운터 abacus 사용)
// 같은 브라우저는 하루에 한 번만 올리고(오늘·누적 동시에), 서비스가 응답하지 않으면 조용히 숨긴다.
// 날짜는 한국 시간(KST) 기준이다.
(function () {
  const box = document.getElementById('visits');
  if (!box) return;
  const API = 'https://abacus.jasoncameron.dev', NS = 'simulatiolab.heekeunlee';
  let day;
  try { day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, ''); }
  catch (e) { const d = new Date(); day = String(d.getFullYear()) + (d.getMonth() + 1) + d.getDate(); }
  let last = null;
  try { last = localStorage.getItem('lab-visit-day'); } catch (e) {}
  const counted = last === day;
  const call = (key) => fetch(`${API}/${counted ? 'get' : 'hit'}/${NS}/${key}`).then((r) => (r.ok ? r.json() : null)).then((j) => (j && typeof j.value === 'number' ? j.value : null)).catch(() => null);
  Promise.all([call('d-' + day), call('visits')]).then(([today, total]) => {
    if (total == null && today == null) return;
    const fmt = (v) => (v == null ? '0' : v.toLocaleString('ko-KR'));
    document.getElementById('v-today').textContent = fmt(today);
    document.getElementById('v-total').textContent = fmt(total);
    box.hidden = false;
    if (!counted) { try { localStorage.setItem('lab-visit-day', day); } catch (e) {} }
  });
})();
