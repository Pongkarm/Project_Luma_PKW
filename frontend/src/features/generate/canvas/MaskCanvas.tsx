/* oxlint-disable react/refs -- the rule flags every `editor.*` access because the
   editor also exposes canvasRef; the values read here are plain state, and the
   ref itself is only ever handed to React as a ref prop. */
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Segmented } from '../../../shared/ui/Segmented.tsx';
import { IconButton } from '../../../shared/ui/Button.tsx';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { MASK_DISPLAY_OPACITY } from './useMaskEditor.ts';
import type { MaskEditor, MaskTool } from './useMaskEditor.ts';
import { useT } from '../../../shared/hooks/useT.ts';

type Props = {
  editor: MaskEditor;
  sourceUrl: string;
  onNaturalSize: (size: { width: number; height: number }) => void;
};



function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function MaskCanvas({ editor, sourceUrl, onNaturalSize }: Props) {
  const [maskOnly, setMaskOnly] = useState(false);
  const t = useT();
  const toolOptions: { value: MaskTool; label: string; icon: 'brush' | 'eraser' }[] = [
    { value: 'brush', label: t('mask.brush'), icon: 'brush' },
    { value: 'eraser', label: t('mask.eraser'), icon: 'eraser' },
  ];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'b':
          editor.setTool('brush');
          break;
        case 'e':
          editor.setTool('eraser');
          break;
        case '[':
          editor.setBrushSize(Math.max(4, editor.brushSize - 6));
          break;
        case ']':
          editor.setBrushSize(Math.min(200, editor.brushSize + 6));
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor]);

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    // Only the primary button paints; a right-click should not draw.
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    editor.beginStroke(event);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.buttons !== 1) return;
    editor.extendStroke(event);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    editor.endStroke();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          height: 'var(--stagebar-h)',
          flex: 'none',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--sp-12)',
          padding: '0 12px 0 16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>{t('mask.title')}</span>
          <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
            {editor.hasMask
              ? t('mask.coverage', { percent: Math.round(editor.coverage * 100) })
              : t('mask.paintPrompt')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
          <Segmented
            iconsOnly
            ariaLabel={t('mask.tool')}
            options={toolOptions}
            value={editor.tool}
            onChange={editor.setTool}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-8)',
              height: 28,
              padding: '0 10px 0 9px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              background: 'var(--panel-2)',
            }}
          >
            <label htmlFor="brush-size" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>
              {t('mask.size')}
            </label>
            <input
              id="brush-size"
              className="slider"
              type="range"
              min={4}
              max={200}
              step={2}
              value={editor.brushSize}
              style={{ width: 76, ['--fill' as string]: `${((editor.brushSize - 4) / 196) * 100}%` }}
              onChange={(event) => editor.setBrushSize(Number(event.target.value))}
            />
            <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', width: 26 }}>
              {editor.brushSize}
            </span>
          </div>
          <IconButton icon="undo" label={t('mask.undo')} disabled={!editor.canUndo} onClick={editor.undo} />
          <IconButton icon="redo" label={t('mask.redo')} disabled={!editor.canRedo} onClick={editor.redo} />
          <IconButton icon="trash" label={t('mask.clear')} disabled={!editor.canUndo} onClick={editor.clear} />
          <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 2px' }} />
          <IconButton
            icon="eye"
            label={maskOnly ? t('mask.showImage') : t('mask.showMaskOnly')}
            aria-pressed={maskOnly}
            style={maskOnly ? { color: 'var(--ink)', borderColor: 'var(--line-strong)' } : undefined}
            onClick={() => setMaskOnly((value) => !value)}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--sp-20)',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-10)', alignItems: 'center' }}>
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              lineHeight: 0,
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
              background: maskOnly ? '#000' : 'var(--ph-image)',
            }}
          >
            <img
              src={sourceUrl}
              alt={t('mask.alt')}
              draggable={false}
              onLoad={(event) =>
                onNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              style={{
                display: 'block',
                maxWidth: 'min(100%, 620px)',
                maxHeight: '58vh',
                width: 'auto',
                height: 'auto',
                opacity: maskOnly ? 0 : 1,
                userSelect: 'none',
              }}
            />
            <canvas
              ref={editor.canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                cursor: 'crosshair',
                touchAction: 'none',
                opacity: maskOnly ? 1 : MASK_DISPLAY_OPACITY,
                filter: maskOnly ? 'grayscale(1) brightness(2.6)' : undefined,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-16)', flexWrap: 'wrap' }}>
            <span
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)', fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}
            >
              <span
                style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--accent)', opacity: 0.55 }}
              />
              {t('mask.legend')}
            </span>
            <span
              className="mono"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}
            >
              <Icon name="info" size={12} />
              {t('mask.shortcuts')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
