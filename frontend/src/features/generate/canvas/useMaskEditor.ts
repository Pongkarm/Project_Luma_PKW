import { useCallback, useEffect, useRef, useState } from 'react';

export type MaskTool = 'brush' | 'eraser';

type Point = { x: number; y: number };
type Stroke = { tool: MaskTool; size: number; points: Point[] };

export type MaskEditor = ReturnType<typeof useMaskEditor>;

/**
 * Strokes are painted at FULL alpha and made translucent in CSS for display.
 *
 * Painting translucently would be wrong twice over: overlapping segments of one
 * stroke would compound into darker patches, and the export — which derives the
 * mask from this canvas's alpha channel — would come out mid-grey instead of
 * white, which the engine reads as a partial mask rather than "replace this".
 */
const PAINT = 'rgb(224, 164, 88)';
/** How translucent the mask looks on screen, so the image stays visible under it. */
export const MASK_DISPLAY_OPACITY = 0.55;

/**
 * The inpainting mask.
 *
 * Strokes are kept as data rather than baked into pixels, so undo, redo and
 * clear are exact and the mask can be re-rendered at any display size. The
 * canvas itself is always at the SOURCE IMAGE's true pixel size, so what gets
 * exported lines up with what the engine receives regardless of how the canvas
 * is scaled on screen.
 */
export function useMaskEditor(naturalWidth: number, naturalHeight: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const redoStack = useRef<Stroke[]>([]);
  const active = useRef<Stroke | null>(null);

  const [tool, setTool] = useState<MaskTool>('brush');
  const [brushSize, setBrushSize] = useState(48);
  // Stroke DATA lives in refs so drawing never re-renders; these counts mirror
  // it in state so the toolbar can be derived at render time rather than by
  // reading a ref, which React does not treat as a render input.
  const [strokeCount, setStrokeCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [coverage, setCoverage] = useState(0);

  const syncCounts = useCallback(() => {
    setStrokeCount(strokes.current.length);
    setRedoCount(redoStack.current.length);
  }, []);

  const context = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = PAINT;
    ctx.fillStyle = PAINT;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const [first, ...rest] = stroke.points;
    if (!first) {
      ctx.restore();
      return;
    }
    if (rest.length === 0) {
      // A single tap is a dot, not a nothing.
      ctx.beginPath();
      ctx.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const point of rest) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  const renderAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes.current) drawStroke(ctx, stroke);
  }, [context, drawStroke]);

  /** Rough share of the image that is painted — enough to say "11% of image". */
  const measureCoverage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) {
      setCoverage(0);
      return;
    }
    const sample = document.createElement('canvas');
    sample.width = 64;
    sample.height = 64;
    const ctx = sample.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, 64, 64);
    const { data } = ctx.getImageData(0, 0, 64, 64);
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 12) painted += 1;
    }
    setCoverage(painted / (64 * 64));
  }, []);

  // Re-fit and re-render whenever the source image changes size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || naturalWidth === 0 || naturalHeight === 0) return;
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    renderAll();
    measureCoverage();
  }, [naturalWidth, naturalHeight, renderAll, measureCoverage]);

  /** Screen point → source-image pixel. Survives any CSS scaling of the canvas. */
  const toCanvasPoint = useCallback((event: { clientX: number; clientY: number }): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const beginStroke = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const point = toCanvasPoint(event);
      const ctx = context();
      if (!point || !ctx) return;
      active.current = { tool, size: brushSize, points: [point] };
      drawStroke(ctx, active.current);
      redoStack.current = [];
      setRedoCount(0);
    },
    [brushSize, context, drawStroke, toCanvasPoint, tool],
  );

  const extendStroke = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const stroke = active.current;
      const point = toCanvasPoint(event);
      const ctx = context();
      if (!stroke || !point || !ctx) return;
      const previous = stroke.points[stroke.points.length - 1];
      stroke.points.push(point);
      // Draw only the new segment; the full re-render is kept for undo.
      drawStroke(ctx, { tool: stroke.tool, size: stroke.size, points: [previous, point] });
    },
    [context, drawStroke, toCanvasPoint],
  );

  const endStroke = useCallback(() => {
    if (!active.current) return;
    strokes.current.push(active.current);
    active.current = null;
    syncCounts();
    measureCoverage();
  }, [measureCoverage, syncCounts]);

  const undo = useCallback(() => {
    const stroke = strokes.current.pop();
    if (!stroke) return;
    redoStack.current.push(stroke);
    renderAll();
    syncCounts();
    measureCoverage();
  }, [measureCoverage, renderAll, syncCounts]);

  const redo = useCallback(() => {
    const stroke = redoStack.current.pop();
    if (!stroke) return;
    strokes.current.push(stroke);
    renderAll();
    syncCounts();
    measureCoverage();
  }, [measureCoverage, renderAll, syncCounts]);

  const clear = useCallback(() => {
    if (strokes.current.length === 0) return;
    redoStack.current = [...strokes.current].reverse();
    strokes.current = [];
    renderAll();
    syncCounts();
    measureCoverage();
  }, [measureCoverage, renderAll, syncCounts]);

  /**
   * Export the mask the way the pipeline expects it: white where the image
   * should be repainted, black where it should be left alone, at the source
   * image's exact size.
   *
   * Done with compositing rather than a pixel loop, so the painted colour used
   * on screen has no bearing on what is sent.
   */
  const exportMask = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.current.length === 0) return null;

    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(canvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, out.width, out.height);

    return new Promise((resolve) => out.toBlob((blob) => resolve(blob), 'image/png'));
  }, []);

  /** A data URL of the exported mask, for the little preview swatch. */
  const previewMask = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.current.length === 0) return null;
    const out = document.createElement('canvas');
    out.width = 80;
    out.height = Math.max(1, Math.round((80 * canvas.height) / canvas.width));
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }, []);

  return {
    canvasRef,
    tool,
    setTool,
    brushSize,
    setBrushSize,
    beginStroke,
    extendStroke,
    endStroke,
    undo,
    redo,
    clear,
    exportMask,
    previewMask,
    coverage,
    hasMask: strokeCount > 0,
    canUndo: strokeCount > 0,
    canRedo: redoCount > 0,
  };
}
