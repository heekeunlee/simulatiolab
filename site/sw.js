// 홈 화면 앱(PWA)용 서비스 워커. 일부러 아무것도 저장하지 않는다 — 항상 최신 페이지를 네트워크에서 받는다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
