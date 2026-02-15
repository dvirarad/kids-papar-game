// ══════════════════════════════════════════
// UTILS — Pure helpers, drawing primitives
// ══════════════════════════════════════════

function showError(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.classList.add('visible'); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = Math.PI / 2 * 3, step = Math.PI / spikes;
  ctx.beginPath(); ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step;
  }
  ctx.closePath();
}

function drawHeart(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.4);
  ctx.bezierCurveTo(cx - size, cy - size * 0.3, cx - size * 0.5, cy - size, cx, cy - size * 0.4);
  ctx.bezierCurveTo(cx + size * 0.5, cy - size, cx + size, cy - size * 0.3, cx, cy + size * 0.4);
  ctx.closePath();
}

function drawBalloonText(ctx, text, x, y, fontSize, fillColor, strokeColor) {
  ctx.save();
  ctx.font = `bold ${fontSize}px Rubik, Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  // White outer glow
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = fontSize * 0.22;
  ctx.strokeText(text, x, y);
  // Colored thick outline (balloon border)
  ctx.strokeStyle = strokeColor; ctx.lineWidth = fontSize * 0.12;
  ctx.strokeText(text, x, y);
  // Fill with lighter color
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  // Shine highlight
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, x, y - fontSize * 0.06);
  ctx.globalAlpha = 1.0;
  ctx.restore();
}

function distributePointsOnPath(vertices, n, closed) {
  const segments = [];
  let totalLen = 0;
  const len = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < len; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, d });
    totalLen += d;
  }
  const pts = [];
  for (let i = 0; i < n; i++) {
    let target = (i / n) * totalLen;
    let acc = 0;
    for (const seg of segments) {
      if (acc + seg.d >= target) {
        const t = (target - acc) / seg.d;
        pts.push({ x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t });
        break;
      }
      acc += seg.d;
    }
  }
  return pts;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = reject; img.src = src;
  });
}

function b64toDataUrl(b64) { return `data:image/png;base64,${b64}`; }

function base64ToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
