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

  return { css, setup, mix, roundRect };
})();
