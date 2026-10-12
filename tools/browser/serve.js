// 사이트를 로컬에서 서비스하는 작은 서버 (shoot.js, check.js, make_thumbs.js 공용)
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '..', '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
module.exports = function serve() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/simulatiolab/, '');
      if (p.endsWith('/')) p += 'index.html';
      fs.readFile(path.join(SITE, p), (e, d) => {
        if (e) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d);
      });
    }).listen(0, () => ok({ srv, base: `http://localhost:${srv.address().port}/simulatiolab/`, SITE }));
  });
};
