// 3D 보기(app3d.js, ES 모듈)를 3D 캔버스가 화면 가까이 왔을 때 불러온다.
// 페이지 첫 로딩(2D 시뮬레이션)을 3D 준비가 막지 않게 하려는 것. ?thumb=1(썸네일 촬영)이면 바로 불러온다.
//   <script src="../../lazy3d.js" data-module="app3d.js"></script>
(function () {
  const me = document.currentScript, mod = (me && me.getAttribute('data-module')) || 'app3d.js';
  const url = new URL(mod, location.href).href;
  let done = false;
  const go = () => { if (done) return; done = true; import(url).catch((e) => console.error('3D 보기를 불러오지 못했어요', e)); };
  const c = document.querySelector('canvas.view3d') || document.getElementById('c-3d');
  if (!c || !('IntersectionObserver' in window) || /[?&]thumb=1/.test(location.search)) return go();
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '700px 0px' });
  io.observe(c);
  // 화면 밖이어도 페이지가 다 뜬 뒤 여유가 생기면 미리 불러 둔다
  window.addEventListener('load', () => setTimeout(() => { if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 3000 }); else go(); }, 4000));
})();
