import { useRef, useState, type DragEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../shared/ui/Icon.tsx';
import { Button, IconButton } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { ImageViewer } from '../../shared/ui/ImageViewer.tsx';
import { useAuthedImage } from '../../shared/hooks/useAuthedImage.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { usePageTitle } from '../../shared/hooks/usePageTitle.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';
import { limits } from '../../config/limits.ts';
import { generationService } from '../../services/generationService.ts';
import { validateBeforeUpload } from '../../services/uploadService.ts';
import { queryKeys } from '../../services/queryKeys.ts';
import type { Generation } from '../../contracts/generation.ts';
import { currentVersion, parentOf, useStudio } from './studioStore.ts';
import { measureImage, useOpenInStudio, useSendToGenerate } from './studioActions.ts';
import { useApplyTool } from './useApplyTool.ts';
import { toolMeta, versionLabel } from './toolMeta.ts';
import { ToolPanel } from './ToolPanel.tsx';
import { CompareView } from './CompareView.tsx';
import { VersionStrip } from './VersionStrip.tsx';

export function StudioPage() {
  const t = useT();
  usePageTitle(t('nav.studio'));
  const versions = useStudio((state) => state.versions);
  const currentId = useStudio((state) => state.currentId);
  const sourceLabel = useStudio((state) => state.sourceLabel);
  const close = useStudio((state) => state.close);
  const current = currentVersion({ versions, currentId });
  const before = current ? parentOf({ versions }, current) : null;

  const { apply, pendingTool, unavailable, error } = useApplyTool();
  const send = useSendToGenerate();
  const showToast = useToasts((state) => state.show);
  const [comparing, setComparing] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [viewing, setViewing] = useState(false);

  // Switching version resets the two views that only make sense for one version.
  const [shownId, setShownId] = useState(currentId);
  if (shownId !== currentId) {
    setShownId(currentId);
    setShowMask(false);
  }

  const canCompare = Boolean(current && before);
  const isCutout = current?.tool === 'remove-bg';
  const shownUrl = current && showMask && current.mask ? current.mask.url : current?.url;
  const versionName = current ? versionLabel(versions, current, t) : '';

  return (
    <div className="app__workspace studio">
      <main className="main" id="main" tabIndex={-1}>
        <div className="stagebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)', minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>{t('studio.title')}</span>
            <span
              className="mono"
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--ink-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {current ? `${sourceLabel ?? ''} · ${versionName}` : t('stage.noRun')}
            </span>
          </div>
          {current ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
              <Button
                size="sm"
                variant={comparing ? 'primary' : 'secondary'}
                icon="compare"
                disabled={!canCompare}
                aria-pressed={comparing}
                onClick={() => setComparing(!comparing)}
              >
                {t('studio.compare')}
              </Button>
              <IconButton icon="close" label={t('studio.startOver')} onClick={close} />
            </div>
          ) : null}
        </div>

        <div className="stage">
          {current && shownUrl ? (
            <div className="result">
              <div
                className={[
                  'result__media',
                  comparing && canCompare ? '' : 'result__media--zoom',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ position: 'relative' }}
                onClick={() => !(comparing && canCompare) && setViewing(true)}
                title={comparing && canCompare ? undefined : t('run.viewFull')}
              >
                {comparing && canCompare && before ? (
                  <CompareView before={before.url} after={shownUrl} alt={versionName} checker={isCutout && !showMask} />
                ) : (
                  <img
                    className={`img-in${isCutout && !showMask ? ' checker' : ''}`}
                    src={shownUrl}
                    alt={versionName}
                  />
                )}
                {pendingTool ? (
                  <div className="studio-busy" role="status">
                    <Icon name="refresh" size={20} className="spin" />
                    <span>{t('studio.applying', { tool: t(toolMeta[pendingTool].label) })}</span>
                  </div>
                ) : null}
              </div>

              <div className="result__bar">
                <span className="result__meta">
                  {current.width} × {current.height} · {versionName}
                  {current.detail ? ` · ${current.detail}` : ''}
                </span>
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
        <ImageViewer
          url={shownUrl}
          alt={versionName}
          meta={current ? `${current.width} × ${current.height} · ${versionName}` : undefined}
          onClose={() => setViewing(false)}
        />
      ) : null}
    </div>
  );
}

const RECENT_SIZE = 8;

/**
 * Nothing open yet: drop a file, or pick up a recent result. A dropped file is
 * never uploaded — the tools take the bytes directly, and nothing is stored
 * unless the person later chooses to use a version as a source.
 */
function StudioEmpty() {
  const t = useT();
  const open = useStudio((state) => state.open);
  const { openGeneration, busy } = useOpenInStudio();
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recent = useQuery({
    queryKey: queryKeys.generations(1, RECENT_SIZE),
    queryFn: () => generationService.list({ page: 1, page_size: RECENT_SIZE }),
  });
  const completed = (recent.data?.items ?? []).filter((run) => run.status === 'completed');

  async function openFile(file: File | undefined) {
    if (!file) return;
    const local = validateBeforeUpload(file);
    if (local) {
      setProblem(local.message);
      return;
    }
    try {
      open(file, await measureImage(file), file.name);
      setProblem(null);
    } catch {
      setProblem(t('studio.openFailed'));
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void openFile(event.dataTransfer.files[0]);
  }

  return (
    <div className="studio-empty">
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('studio.emptyTitle')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t('studio.emptyBody')}
        </p>
      </div>

      <div
        className={['drop', dragging ? 'drop--over' : ''].filter(Boolean).join(' ')}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" size={22} />
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--ink)' }}>{t('studio.drop')}</span>
        <span className="field__hint">{t('upload.constraints')}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={limits.upload.accept}
        className="visually-hidden"
        onChange={(event) => {
          void openFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {problem ? <Alert tone="error">{problem}</Alert> : null}

      {completed.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)', width: '100%' }}>
          <span className="eyebrow">{t('studio.recent')}</span>
          <div className="runstrip__row" aria-busy={busy || undefined}>
            {completed.map((run) => (
              <RecentThumb key={run.id} run={run} disabled={busy} onPick={() => void openGeneration(run.id)} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecentThumb({ run, disabled, onPick }: { run: Generation; disabled: boolean; onPick: () => void }) {
  const image = useAuthedImage(run.id);
  return (
    <button type="button" className="thumb" disabled={disabled} onClick={onPick} title={run.prompt}>
      {image.url ? (
        <img className="img-in" src={image.url} alt="" />
      ) : (
        <span className="skeleton" style={{ width: '100%', height: '100%' }} />
      )}
      <span className="visually-hidden">{run.prompt}</span>
    </button>
  );
}
