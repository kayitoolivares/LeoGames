// Un "pincel" que entiende las mismas órdenes que Phaser.Graphics (fillRect, lineStyle, fillCircle...)
// pero dibuja en un <canvas> normal. Sirve para usar los mismos dibujos en los juegos 3D, que no usan Phaser
// (por ejemplo, Bloquecito manejando un kart). Solo tiene las órdenes que hacen falta.
export class CanvasGraphics {
  constructor(ctx) {
    this.ctx = ctx;
  }

  fillStyle(color, alpha = 1) {
    this.ctx.fillStyle = css(color, alpha);
    return this;
  }

  lineStyle(width, color, alpha = 1) {
    this.ctx.lineWidth = width;
    this.ctx.strokeStyle = css(color, alpha);
    return this;
  }

  clear() {
    return this;
  }

  fillRect(x, y, w, h) {
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x, y, w, h) {
    this.ctx.strokeRect(x, y, w, h);
  }

  fillRoundedRect(x, y, w, h, r) {
    this.roundedPath(x, y, w, h, r);
    this.ctx.fill();
  }

  strokeRoundedRect(x, y, w, h, r) {
    this.roundedPath(x, y, w, h, r);
    this.ctx.stroke();
  }

  roundedPath(x, y, w, h, r) {
    const ctx = this.ctx;
    const k = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + h, k);
    ctx.arcTo(x + w, y + h, x, y + h, k);
    ctx.arcTo(x, y + h, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  }

  fillCircle(x, y, r) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  strokeCircle(x, y, r) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  fillEllipse(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  strokeEllipse(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  fillTriangle(x1, y1, x2, y2, x3, y3) {
    this.fillPoints([{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }], true);
  }

  fillPoints(points, close = false) {
    this.pointsPath(points, close);
    this.ctx.fill();
  }

  strokePoints(points, close = false) {
    this.pointsPath(points, close);
    this.ctx.stroke();
  }

  pointsPath(points, close) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (close) ctx.closePath();
  }

  lineBetween(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  // Rebanada de pastel (Phaser la deja lista para fillPath()).
  slice(x, y, r, start, end, anticlockwise = false) {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.arc(x, y, r, start, end, anticlockwise);
    this.ctx.closePath();
  }

  fillPath() {
    this.ctx.fill();
  }

  save() {
    this.ctx.save();
  }

  restore() {
    this.ctx.restore();
  }

  translateCanvas(x, y) {
    this.ctx.translate(x, y);
  }

  rotateCanvas(angle) {
    this.ctx.rotate(angle);
  }
}

function css(color, alpha) {
  return `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;
}
