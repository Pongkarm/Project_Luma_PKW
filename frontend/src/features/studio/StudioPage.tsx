/**
 * /studio — the full studio: the picture on the left, the tools on the right,
 * and every version made so far along the bottom.
 */
import { useState } from 'react';
import { Icon } from '../../shared/ui/Icon.tsx';
import { Button, IconButton } from '../../shared/ui/Button.tsx';
import { ImageViewer } from '../../shared/ui/ImageViewer.tsx';
import { useT } from '../../shared/hooks/useT.ts';
import { usePageTitle } from '../../shared/hooks/usePageTitle.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';
import { currentVersion, parentOf, useStudio } from './studioStore.ts';
import { useSendToGenerate } from './studioActions.ts';
import { useApplyTool } from './useApplyTool.ts';
import { versionDetail, versionLabel } from './toolMeta.ts';
import { ToolPanel } from './ToolPanel.tsx';
import { ToolBusy } from './ToolBusy.tsx';
import { CompareView } from './CompareView.tsx';
import { VersionStrip } from './VersionStrip.tsx';
import { StudioEmpty } from './StudioEmpty.tsx';

export function StudioPage() {
  const t = useT();
  usePageTitle(t('nav.studio'));

  // ── the session ────────────────────────────────────────────────────────
  const versions = useStudio((state) => state.versions);
  const currentId = useStudio((state) => state.currentId);
  const sourceLabel = useStudio((state) => state.sourceLabel);
  const close = useStudio((state) => state.close);
  const current = currentVersion({ versions, currentId });
  // What "before" means in the compare view: the version this one was made from.
  const before = current ? parentOf({ versions }, current) : null;

  const { apply, pendingTool, unavailable, error } = useApplyTool();
  const send = useSendToGenerate();
  const showToast = useToasts((state) => state.show);

  // ── view toggles ───────────────────────────────────────────────────────
  const [comparing, setComparing] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [viewing, setViewing] = useState(false);

  // Picking another version turns "show the mask" off: it belongs to one cut-out.
  const [shownId, setShownId] = useState(currentId);
  if (shownId !== currentId) {
    setShownId(currentId);
    setShowMask(false);
  }

  // ── what to draw ───────────────────────────────────────────────────────
  const mask = showMask ? (current?.mask ?? null) : null;
  const shownUrl = mask ? mask.url : current?.url;
  const compareWith = comparing ? before : null;
  // A cut-out is transparent; the checkerboard shows where.
  const onChecker = current?.tool === 'remove-bg' && !mask;
  const name = current ? versionLabel(versions, current, t) : '';
  const detail = current ? versionDetail(current, t) : null;
  const caption = current ? `${current.width} × ${current.height} · ${name}${detail ? ` · ${detail}` : ''}` : '';

  return (
    <div className="app__workspace studio">
      <main className="main" id="main" tabIndex={-1}>
        {/* Stage bar: where the picture came from, which version is showing. */}
        <div className="stagebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)', minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>{t('studio.title')}</span>
            <span className="mono studio-subtitle">
              {current ? `${sourceLabel ?? ''} · ${name}` : t('stage.noRun')}
            </span>
          </div>
          {current ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
              <Button
                size="sm"
                variant={comparing ? 'primary' : 'secondary'}
                icon="compare"
                disabled={!before}
                aria-pressed={comparing}
                onClick={() => setComparing(!comparing)}
              >
                {t('studio.compare')}
              </Button>
              <IconButton icon="close" label={t('studio.startOver')} onClick={close} />
            </div>
          ) : null}
        </div>

        {/* Stage: the current version, framed, with save and reuse under it. */}
        <div className="stage">
          {current && shownUrl ? (
            <div className="result">
              <div
                className={`result__media${compareWith ? '' : ' result__media--zoom'}`}
                style={{ position: 'relative' }}
                // In compare mode a click is a drag on the slider, not "open full size".
                onClick={() => !compareWith && setViewing(true)}
                title={compareWith ? undefined : t('run.viewFull')}
              >
                {compareWith ? (
                  <CompareView before={compareWith.url} after={shownUrl} alt={name} checker={onChecker} />
                ) : (
                  <img className={`img-in${onChecker ? ' checker' : ''}`} src={shownUrl} alt={name} />
                )}
                <ToolBusy tool={pendingTool} />
              </div>

              <div className="result__bar">
                <span className="result__meta">{caption}</span>
                <div style={{ display: 'flex', gap: 'var(--sp-8)', flexWrap: 'wrap' }}>
                  <a
                    className="btn btn--sm btn--secondary"
                    href={current.url}
                    download={`luma-studio-${current.tool ?? 'original'}-${current.id}.png`}
                    onClick={() => showToast(t('run.savedImage'))}
                  >
                    <Icon name="download" size={14} />
                    {t('run.saveImage')}
                  </a>
                  <Button
                    size="sm"
                    busy={send.busy === 'source'}
                    disabled={send.busy !== null}
                    onClick={() => void send.asSource(current)}
                  >
                    {t('studio.useAsSource')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <StudioEmpty />
          )}
        </div>

        {versions.length > 0 ? <VersionStrip /> : null}
      </main>

      {/* Right-hand panel (a bottom sheet on a phone): pick a tool, set it, apply. */}
      <ToolPanel
        current={current}
        pendingTool={pendingTool}
        unavailable={unavailable}
        error={error}
        showMask={showMask}
        onShowMask={setShowMask}
        onApply={(request) => current && apply(request, current)}
      />

      {viewing && shownUrl ? (
        <ImageViewer url={shownUrl} alt={name} meta={caption} onClose={() => setViewing(false)} />
      ) : null}
    </div>
  );
}
