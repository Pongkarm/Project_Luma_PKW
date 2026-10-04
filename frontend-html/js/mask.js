/*
 * mask.js — ระบายสี mask สำหรับโหมด "แก้เฉพาะจุด" (inpaint)
 *
 * วิธีทำงาน:
 *  - วาง <canvas> โปร่งใสทับบนภาพต้นฉบับ ขนาดเท่าภาพจริง (พิกเซลต่อพิกเซล)
 *  - ส่วนที่ระบาย = ให้ AI วาดใหม่ / ส่วนที่ไม่ระบาย = คงไว้
 *  - ตอนส่ง แปลงเป็นภาพขาวดำ: ขาว = วาดใหม่, ดำ = คงไว้ (รูปแบบที่ AI ต้องการ)
 */

const UNDO_BUDGET_BYTES = 200 * 1024 * 1024; // หน่วยความจำรวมที่ยอมให้ปุ่มย้อนกลับใช้

/* สีพู่กัน = สีหลักของธีม (ส้ม) อ่านจาก CSS เพื่อให้ตรงกับธีมเสมอ */
function brushColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0a458';
}

const MaskEditor = {
  canvas: null,
  ctx: null,
  mode: 'brush', // 'brush' หรือ 'eraser'
  brushSize: 40, // ขนาดพู่กันบนจอ (พิกเซล)
  drawing: false,
  lastPoint: null,
  undoStack: [], // ภาพก่อนหน้า ไว้สำหรับปุ่มย้อนกลับ
  redoStack: [], // ภาพที่ย้อนกลับไป ไว้สำหรับปุ่มทำซ้ำ
  painted: 0, // สัดส่วนพื้นที่ที่ระบาย 0–1 — คำนวณใหม่เฉพาะตอน mask เปลี่ยน
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

  /* mask เปลี่ยน → นับพื้นที่ที่ระบายใหม่ แล้วแจ้งหน้าเว็บ */
  changed() {
    this.painted = this.measure();
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
    // ยางลบ = ลบพิกเซลออกให้โปร่งใส
    const color = brushColor();
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

  /*
   * จำภาพก่อนระบายไว้สำหรับปุ่มย้อนกลับ
   * แต่ละขั้นเก็บภาพทั้ง canvas (ภาพ 4096×4096 = 64 MB ต่อขั้น) จึงจำกัดรวมไม่เกินราว 200 MB:
   * ภาพ 768×768 ย้อนได้ 30 ขั้น, ภาพ 4096×4096 ย้อนได้ 3 ขั้น
   */
  saveUndo() {
    this.undoStack.push(this.snapshot());
    const bytesPerStep = this.canvas.width * this.canvas.height * 4;
    const maxSteps = Math.max(3, Math.min(30, Math.floor(UNDO_BUDGET_BYTES / bytesPerStep)));
    while (this.undoStack.length > maxSteps) this.undoStack.shift();
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

  /*
   * นับสัดส่วนพื้นที่ที่ระบาย 0–1
   * ย่อ canvas ให้ด้านยาวเหลือ 256 พิกเซลก่อนนับ — อ่านภาพเต็ม 4096×4096 ทุกครั้งจะช้ามาก
   */
  measure() {
    if (!this.canvas.width) return 0;
    const scale = Math.min(1, 256 / Math.max(this.canvas.width, this.canvas.height));
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(this.canvas.width * scale));
    small.height = Math.max(1, Math.round(this.canvas.height * scale));
    const ctx = small.getContext('2d');
    ctx.drawImage(this.canvas, 0, 0, small.width, small.height);
    const pixels = ctx.getImageData(0, 0, small.width, small.height).data;
    let painted = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) painted += 1;
    }
    return painted / (pixels.length / 4);
  },

  /* สัดส่วนที่ระบายล่าสุด (เรียกบ่อยได้ ไม่ต้องนับใหม่) */
  coverage() {
    return this.painted;
  },

  hasMask() {
    return this.painted > 0;
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

    const color = brushColor();
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
