/*
 * mask.js — ระบายสี mask สำหรับโหมด "แก้เฉพาะจุด" (inpaint)
 *
 * วิธีทำงาน:
 *  - วาง <canvas> โปร่งใสทับบนภาพต้นฉบับ ขนาดเท่าภาพจริง (พิกเซลต่อพิกเซล)
 *  - ส่วนที่ระบาย = ให้ AI วาดใหม่ / ส่วนที่ไม่ระบาย = คงไว้
 *  - ตอนส่ง แปลงเป็นภาพขาวดำ: ขาว = วาดใหม่, ดำ = คงไว้ (รูปแบบที่ AI ต้องการ)
 */

const MaskEditor = {
  canvas: null,
  ctx: null,
  mode: 'brush', // 'brush' หรือ 'eraser'
  brushSize: 40, // ขนาดพู่กันบนจอ (พิกเซล)
  drawing: false,
  lastPoint: null,
  undoStack: [], // ภาพก่อนหน้า ไว้สำหรับปุ่มย้อนกลับ
  redoStack: [], // ภาพที่ย้อนกลับไป ไว้สำหรับปุ่มทำซ้ำ
  onChange: null, // ฟังก์ชันที่เรียกทุกครั้งที่ภาพ mask เปลี่ยน

  /* เริ่มใช้งานกับ canvas ที่กำหนด */
  init(canvas, onChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.onChange = onChange;

    // pointer events ใช้ได้ทั้งเมาส์ นิ้ว และปากกา
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return; // คลิกขวาไม่วาด
      canvas.setPointerCapture(event.pointerId);
      this.saveUndo();
      this.drawing = true;
      this.lastPoint = this.toCanvasPoint(event);
      this.paintLine(this.lastPoint, this.lastPoint);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.drawing) return;
      const point = this.toCanvasPoint(event);
      this.paintLine(this.lastPoint, point);
      this.lastPoint = point;
    });
    const stop = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.changed();
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  },

  /* ตั้งขนาด canvas ให้เท่าภาพจริง และล้างของเก่า */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.undoStack = [];
    this.redoStack = [];
    this.changed();
  },

  changed() {
    if (this.onChange) this.onChange();
  },

  /* แปลงตำแหน่งเมาส์บนจอ → ตำแหน่งพิกเซลบนภาพจริง (ภาพบนจอถูกย่อ) */
  toCanvasPoint(event) {
    const box = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * this.canvas.width,
      y: ((event.clientY - box.top) / box.height) * this.canvas.height,
    };
  },

  /* ขนาดพู่กันบนจอ → ขนาดบนภาพจริง เพื่อให้เส้นบนจอหนาเท่าที่ตั้งไว้ */
  realBrushSize() {
    const box = this.canvas.getBoundingClientRect();
    return this.brushSize * (this.canvas.width / (box.width || this.canvas.width));
  },

  paintLine(from, to) {
    const ctx = this.ctx;
    // สีเดียวกับสีหลักของธีม (ส้ม) — ยางลบ = ลบพิกเซลออกให้โปร่งใส
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0a458';
    ctx.globalCompositeOperation = this.mode === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = this.realBrushSize();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (from.x === to.x && from.y === to.y) {
      // คลิกจุดเดียวไม่ได้ลาก: เส้นยาว 0 จะไม่ถูกวาด จึงวาดเป็นวงกลมแทน
      ctx.arc(from.x, from.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  },

  snapshot() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  },

  saveUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 30) this.undoStack.shift(); // เก็บแค่ 30 ขั้น กันหน่วยความจำเต็ม
    this.redoStack = [];
  },

  undo() {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.snapshot());
    this.ctx.putImageData(previous, 0, 0);
    this.changed();
  },

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.ctx.putImageData(next, 0, 0);
    this.changed();
  },

  clear() {
    this.saveUndo();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.changed();
  },

  /* สัดส่วนพื้นที่ที่ระบาย 0–1 (นับทุก 4 พิกเซลเพื่อความเร็ว) */
  coverage() {
    if (!this.canvas.width) return 0;
    const pixels = this.snapshot().data;
    let painted = 0;
    let total = 0;
    for (let i = 3; i < pixels.length; i += 16) {
      total += 1;
      if (pixels[i] > 0) painted += 1;
    }
    return total ? painted / total : 0;
  },

  hasMask() {
    return this.coverage() > 0;
  },

  /* สร้างไฟล์ PNG ขาวดำ: ขาว = ส่วนที่ระบาย, ดำ = ส่วนที่เหลือ */
  exportMask() {
    const out = document.createElement('canvas');
    out.width = this.canvas.width;
    out.height = this.canvas.height;
    const ctx = out.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'destination-in'; // เก็บสีขาวไว้เฉพาะตรงที่ระบาย
    ctx.drawImage(this.canvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-over'; // เติมดำด้านหลังส่วนที่เหลือ
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, out.width, out.height);

    return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  },

  /*
   * โหลด mask ขาวดำที่ทำมาจากที่อื่น (เช่น จากเครื่องมือตัดฉากในสตูดิโอ)
   * invert = true → ระบายส่วนที่เป็นสีดำแทน (เช่น อยากเปลี่ยนพื้นหลัง ไม่ใช่ตัวคน)
   */
  loadMask(image, invert) {
    const temp = document.createElement('canvas');
    temp.width = this.canvas.width;
    temp.height = this.canvas.height;
    const tempCtx = temp.getContext('2d');
    tempCtx.drawImage(image, 0, 0, temp.width, temp.height);

    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0a458';
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

    const data = tempCtx.getImageData(0, 0, temp.width, temp.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      // จุดโปร่งใสนับเป็นสีดำ
      const isWhite = ((px[i] + px[i + 1] + px[i + 2]) / 3) * (px[i + 3] / 255) >= 128;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = isWhite !== invert ? 255 : 0;
    }
    this.saveUndo();
    this.ctx.putImageData(data, 0, 0);
    this.changed();
  },
};
