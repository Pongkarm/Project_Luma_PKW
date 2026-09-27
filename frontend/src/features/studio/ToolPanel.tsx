import { useEffect, useMemo, useState } from 'react';
import { Segmented } from '../../shared/ui/Segmented.tsx';
import { Slider } from '../../shared/ui/Slider.tsx';
import { Button } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { limits, snapKernel } from '../../config/limits.ts';
import type { SplashColor, ToolName } from '../../contracts/tools.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { toolMeta, toolOrder, versionLabel } from './toolMeta.ts';
import type { ToolRequest } from './useApplyTool.ts';
import { parentOf, useStudio, type StudioVersion } from './studioStore.ts';
import { PoseLandmarks } from './PoseLandmarks.tsx';
import { CutoutMask } from './CutoutMask.tsx';

type Props = {
  /** The version the next tool will run on; null when nothing is open. */
  current: StudioVersion | null;
  pendingTool: ToolName | null;
  unavailable: boolean;
  error: string | null;
  showMask: boolean;
  onShowMask: (show: boolean) => void;
  onApply: (request: ToolRequest) => void;
};

/**
 * The studio's side panel, top to bottom: which tool, its settings, anything
 * the version on screen carries (pose points, a cut-out's mask), and the
 * Apply button pinned at the foot.
 */
export function ToolPanel({ current, pendingTool, unavailable, error, showMask, onShowMask, onApply }: Props) {
  const t = useT();
  const versions = useStudio((state) => state.versions);

  // ── the chosen tool and its settings ───────────────────────────────────
  const [tool, setTool] = useState<ToolName>('sketch');
  const [blurKsize, setBlurKsize] = useState<number>(limits.sketchBlur.default);
  const [targetColor, setTargetColor] = useState<SplashColor>('green');

  // Only the settings of the chosen tool go into the request.
  const request = useMemo<ToolRequest>(
    () =>
      tool === 'sketch' ? { tool, blurKsize }
      : tool === 'color-splash' ? { tool, targetColor }
      : { tool },
    [tool, blurKsize, targetColor],
  );

  // A cut-out's mask belongs to the picture it was cut from.
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

  // Apply's label says what is happening, or what is missing.
  const applyLabel = !current
    ? t('studio.pickFirst')
    : pendingTool
      ? t('studio.applying', { tool: t(toolMeta[pendingTool].label) })
      : t('studio.apply', { tool: t(toolMeta[tool].label) });

  return (
    <aside className="controls" aria-label={t('studio.tools')}>
      <div className="controls__scroll">
        {/* Tool picker and what the chosen tool does. */}
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
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', lineHeight: 1.55 }}>{t(toolMeta[tool].about)}</p>

        {/* Settings: only sketch and splash have any. */}
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

        {/* "No studio on this server" is a note; anything else is an error. */}
        {unavailable ? (
          <Alert tone="note">{t('studio.unavailable')}</Alert>
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : null}

        {/* What the version on screen carries beyond its picture. */}
        {current?.landmarks ? <PoseLandmarks landmarks={current.landmarks} /> : null}
        {current?.mask && maskSource ? (
          <CutoutMask
            mask={current.mask.blob}
            maskUrl={current.mask.url}
            source={maskSource}
            showMask={showMask}
            onShowMask={onShowMask}
          />
        ) : null}

        <Alert tone="note">{t('studio.notSaved')}</Alert>
      </div>

      {/* Pinned foot: Apply, and which version it will run on. */}
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
          {applyLabel}
        </Button>
        {current ? (
          <span className="studio-applies-to">
            {t('studio.appliesTo', { version: versionLabel(versions, current, t) })}
            <span className="mono" style={{ opacity: 0.75 }}>
              <Icon name="info" size={11} /> ⌘↵
            </span>
          </span>
        ) : null}
      </div>
    </aside>
  );
}
