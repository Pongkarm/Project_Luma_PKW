import { Button } from '../../shared/ui/Button.tsx';
import { Icon } from '../../shared/ui/Icon.tsx';
import { limits } from '../../config/limits.ts';
import type { SplashColor } from '../../contracts/tools.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useMediaQuery, CANVAS_CAPABLE_QUERY } from '../../shared/hooks/useMediaQuery.ts';
import { toolMeta } from './toolMeta.ts';
import { useOpenInStudio, useSendToGenerate } from './studioActions.ts';
import type { QuickEdit } from './useQuickEdit.ts';

/**
 * FRONTEND_TOOLS_SPECIFICATION.md §4B: the four tools one click away, under
 * the image they change. Each runs with its default settings — the studio page
 * is where the settings, the version list and the comparison live.
 */
export function QuickEditBar({ runId, quick }: { runId: string; quick: QuickEdit }) {
  const t = useT();
  const studio = useOpenInStudio();
  const send = useSendToGenerate();
  const canPaintMask = useMediaQuery(CANVAS_CAPABLE_QUERY);
  const { edited, editedFrom, pendingTool } = quick;
  const busy = pendingTool !== null;

  const toolButton = (tool: 'sketch' | 'pose' | 'remove-bg') => (
    <Button
      size="sm"
      variant="ghost"
      icon={toolMeta[tool].icon}
      busy={pendingTool === tool}
      disabled={busy}
      aria-pressed={edited?.tool === tool}
      onClick={() =>
        void quick.run(tool === 'sketch' ? { tool, blurKsize: limits.sketchBlur.default } : { tool })
      }
    >
      {t(toolMeta[tool].label)}
    </Button>
  );

  const swatch = (color: SplashColor) => (
    <button
      type="button"
      className={`quickbar__swatch quickbar__swatch--${color}`}
      disabled={busy}
      aria-pressed={edited?.tool === 'color-splash' && edited.detail === color}
      aria-label={t(color === 'green' ? 'quick.keepGreen' : 'quick.keepRed')}
      title={t(color === 'green' ? 'quick.keepGreen' : 'quick.keepRed')}
      onClick={() => void quick.run({ tool: 'color-splash', targetColor: color })}
    />
  );

  return (
    <div className="quickbar">
      <div className="quickbar__row">
        <span className="eyebrow">{t('quick.title')}</span>
        <div className="quickbar__tools">
          {toolButton('sketch')}
          <span className="quickbar__group" role="group" aria-label={t('studio.toolSplash')}>
            <Icon
              name={pendingTool === 'color-splash' ? 'refresh' : 'droplet'}
              size={14}
              className={pendingTool === 'color-splash' ? 'spin' : undefined}
            />
            {t('studio.toolSplash')}
            {swatch('green')}
            {swatch('red')}
          </span>
          {toolButton('pose')}
          {toolButton('remove-bg')}
        </div>
      </div>

      <div className="quickbar__row">
        <div className="quickbar__tools">
          {edited ? (
            <Button size="sm" variant="ghost" icon="undo" disabled={busy} onClick={quick.showOriginal}>
              {t('quick.original')}
            </Button>
          ) : null}
          {edited?.mask && editedFrom ? (
            <Button
              size="sm"
              icon="layers"
              busy={send.busy === 'mask'}
              disabled={!canPaintMask || busy || send.busy !== null}
              title={canPaintMask ? t('studio.maskHint') : t('studio.maskNeedsRoom')}
              onClick={() => void send.asInpaint(editedFrom, edited.mask!.blob, true)}
            >
              {t('studio.replaceBackground')}
            </Button>
          ) : null}
          {edited?.landmarks ? (
            <span className="mono quickbar__note">
              {edited.landmarks.length > 0
                ? t('quick.points', { count: edited.landmarks.length })
                : t('studio.noPerson')}
            </span>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon="wand"
          busy={studio.busy}
          disabled={busy}
          onClick={() => void studio.openGeneration(runId)}
        >
          {t('quick.more')}
        </Button>
      </div>

      {quick.unavailable ? (
        <p className="quickbar__note">{t('studio.unavailable')}</p>
      ) : quick.error ? (
        <p className="quickbar__note quickbar__note--error" role="alert">
          {quick.error}
        </p>
      ) : null}
    </div>
  );
}
