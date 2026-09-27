import { useEffect, useMemo, useState } from 'react';
import { Segmented } from '../../shared/ui/Segmented.tsx';
import { Slider } from '../../shared/ui/Slider.tsx';
import { Button } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { limits, snapKernel } from '../../config/limits.ts';
import type { SplashColor, ToolName } from '../../contracts/tools.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useMediaQuery, CANVAS_CAPABLE_QUERY } from '../../shared/hooks/useMediaQuery.ts';
import { toolMeta, toolOrder, versionLabel } from './toolMeta.ts';
import type { ToolRequest } from './useApplyTool.ts';
import { parentOf, useStudio, type StudioVersion } from './studioStore.ts';
import { PoseLandmarks } from './PoseLandmarks.tsx';
import { useSendToGenerate } from './studioActions.ts';

type Props = {
  current: StudioVersion | null;
  pendingTool: ToolName | null;
  unavailable: boolean;
  error: string | null;
  showMask: boolean;
  onShowMask: (show: boolean) => void;
  onApply: (request: ToolRequest) => void;
};

export function ToolPanel({ current, pendingTool, unavailable, error, showMask, onShowMask, onApply }: Props) {
  const t = useT();
  const [tool, setTool] = useState<ToolName>('sketch');
  const [blurKsize, setBlurKsize] = useState<number>(limits.sketchBlur.default);
  const [targetColor, setTargetColor] = useState<SplashColor>('green');
  const versions = useStudio((state) => state.versions);
  const canPaintMask = useMediaQuery(CANVAS_CAPABLE_QUERY);
  const send = useSendToGenerate();

  const request = useMemo<ToolRequest>(
    () =>
      tool === 'sketch' ? { tool, blurKsize }
      : tool === 'color-splash' ? { tool, targetColor }
      : { tool },
    [tool, blurKsize, targetColor],
  );

  const toolName = t(toolMeta[tool].label);
  const currentName = current ? versionLabel(versions, current, t) : null;
  const maskSource = current?.mask ? parentOf({ versions }, current) : null;

  // ⌘↵ / Ctrl+↵ applies, as it generates on the Generate page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (current && !pendingTool) onApply(request);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, pendingTool, onApply, request]);

  return (
    <aside className="controls" aria-label={t('studio.tools')}>
      <div className="controls__scroll">
        <Segmented
          ariaLabel={t('studio.tools')}
          options={toolOrder.map((value) => ({
            value,
            label: t(toolMeta[value].label),
            icon: toolMeta[value].icon,
          }))}
          value={tool}
          onChange={setTool}
        />

        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {t(toolMeta[tool].about)}
        </p>

        {tool === 'sketch' ? (
          <Slider
            label={t('studio.lineWidth')}
            value={blurKsize}
            min={limits.sketchBlur.min}
            max={limits.sketchBlur.max}
            step={limits.sketchBlur.step}
            ends={[t('studio.lineFine'), t('studio.lineSoft')]}
            onChange={(value) => setBlurKsize(snapKernel(value))}
          />
        ) : tool === 'color-splash' ? (
          <div className="field">
            <span className="label">{t('studio.keepColor')}</span>
            <Segmented
              ariaLabel={t('studio.keepColor')}
              options={[
                { value: 'green', label: t('studio.green') },
                { value: 'red', label: t('studio.red') },
              ]}
              value={targetColor}
              onChange={setTargetColor}
            />
          </div>
        ) : (
          <span className="field__hint">{t('studio.noOptions')}</span>
        )}

        {unavailable ? (
          <Alert tone="note">{t('studio.unavailable')}</Alert>
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : null}

        {/* What the version on screen carries beyond its picture. */}
        {current?.landmarks ? <PoseLandmarks landmarks={current.landmarks} /> : null}

        {current?.mask && maskSource ? (
          <div className="field">
            <div className="label">
              <span className="eyebrow">{t('studio.mask')}</span>
              <button type="button" className="linklike" onClick={() => onShowMask(!showMask)}>
                {showMask ? t('studio.showCutout') : t('studio.showMask')}
              </button>
            </div>
            <img
              src={current.mask.url}
              alt=""
              style={{
                width: 96,
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line)',
                background: '#000',
              }}
            />
            <Button
              icon="layers"
              busy={send.busy === 'mask'}
              disabled={!canPaintMask || send.busy !== null}
              title={canPaintMask ? undefined : t('studio.maskNeedsRoom')}
              onClick={() => void send.asInpaint(maskSource, current.mask!.blob, true)}
            >
              {t('studio.replaceBackground')}
            </Button>
            <Button
              variant="ghost"
              disabled={!canPaintMask || send.busy !== null}
              title={canPaintMask ? undefined : t('studio.maskNeedsRoom')}
              onClick={() => void send.asInpaint(maskSource, current.mask!.blob, false)}
            >
              {t('studio.repaintSubject')}
            </Button>
            <span className="field__hint">
              {canPaintMask ? t('studio.maskHint') : t('studio.maskNeedsRoom')}
            </span>
          </div>
        ) : null}

        <Alert tone="note">{t('studio.notSaved')}</Alert>
      </div>

      <div className="controls__foot">
        <Button
          variant="primary"
          size="lg"
          block
          icon={toolMeta[tool].icon}
          busy={pendingTool !== null}
          disabled={!current}
          onClick={() => onApply(request)}
        >
          {!current
            ? t('studio.pickFirst')
            : pendingTool
              ? t('studio.applying', { tool: t(toolMeta[pendingTool].label) })
              : t('studio.apply', { tool: toolName })}
        </Button>
        {current ? (
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--ink-3)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--sp-6)',
            }}
          >
            {t('studio.appliesTo', { version: currentName ?? '' })}
            <span className="mono" style={{ opacity: 0.75 }}>
              <Icon name="info" size={11} /> ⌘↵
            </span>
          </span>
        ) : null}
      </div>
    </aside>
  );
}
