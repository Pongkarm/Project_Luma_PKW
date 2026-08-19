// frontend/js/edit.js — Responsive Canvas Mask Inpainting Tool
class CanvasInpainter {
    constructor(canvasId, brushSize = 25) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.brushSize = brushSize;
        this.originalImage = null;

        this.initEvents();
    }

    initEvents() {
        const start = (e) => {
            e.preventDefault();
            this.isDrawing = true;
            this.ctx.beginPath();
            const { x, y } = this.getCoords(e);
            this.ctx.moveTo(x, y);
            this.draw(e);
        };

        const move = (e) => {
            e.preventDefault();
            if (!this.isDrawing) return;
            this.draw(e);
        };

        const stop = (e) => {
            e.preventDefault();
            this.isDrawing = false;
            this.ctx.closePath();
        };

        // Mouse Events
        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);

        // Touch Events (Mobile/Tablet)
        this.canvas.addEventListener('touchstart', start, { passive: false });
        this.canvas.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', stop, { passive: false });
    }

    getCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Formula recommended by Iris: scale factor to original image resolution
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    draw(e) {
        const { x, y } = this.getCoords(e);
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#FFFFFF'; // Pure white mask for inpaint
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    loadImage(imageSrc, callback = null) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.originalImage = img;
            this.canvas.width = img.naturalWidth || 512;
            this.canvas.height = img.naturalHeight || 512;
            this.clear();
            if (callback) callback(img);
        };
        img.src = imageSrc;
    }

    clear() {
        // Reset mask canvas to solid black (#000000)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    exportMask() {
        return this.canvas.toDataURL('image/webp', 0.95);
    }
}
