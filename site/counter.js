// 누적 방문자 수 (외부 무료 카운터 abacus 사용)
// 같은 브라우저에서는 하루에 한 번만 올리고, 서비스가 응답하지 않으면 조용히 숨긴다.
(function () {
  const el = document.getElementById('visits');
  if (!el) return;
  const API = 'https://abacus.jasoncameron.dev', NS = 'simulatiolab.heekeunlee', KEY = 'visits';
  const d = new Date();
  const today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  let last = null;
  try { last = localStorage.getItem('lab-visit-day'); } catch (e) {}
  const counted = last === today;
  fetch(`${API}/${counted ? 'get' : 'hit'}/${NS}/${KEY}`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => {
      if (typeof j.value !== 'number') return;
      el.querySelector('b').textContent = j.value.toLocaleString('ko-KR');
      el.hidden = false;
      if (!counted) { try { localStorage.setItem('lab-visit-day', today); } catch (e) {} }
    })
    .catch(() => {});
})();
