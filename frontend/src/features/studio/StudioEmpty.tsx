import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '../../shared/ui/Alert.tsx';
import { DropZone } from '../../shared/ui/DropZone.tsx';
import { useAuthedImage } from '../../shared/hooks/useAuthedImage.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { generationService } from '../../services/generationService.ts';
import { validateBeforeUpload } from '../../services/uploadService.ts';
import { queryKeys } from '../../services/queryKeys.ts';
import type { Generation } from '../../contracts/generation.ts';
import { useStudio } from './studioStore.ts';
import { measureImage } from './studioImage.ts';
import { useOpenInStudio } from './studioActions.ts';

/** How many recent runs to offer as a starting point. */
const RECENT_SIZE = 8;

/**
 * The studio with nothing open: drop a file, or pick a recent result.
 *
 * A dropped file is never uploaded — the tools take the bytes directly, and
 * nothing is stored unless the person later uses a version as a source.
 */
export function StudioEmpty() {
  const t = useT();
  const open = useStudio((state) => state.open);
  const { openGeneration, busy } = useOpenInStudio();
  const [problem, setProblem] = useState<string | null>(null);

  // Shares its cache with the run strip on the Generate page.
  const recent = useQuery({
    queryKey: queryKeys.generations(1, RECENT_SIZE),
    queryFn: () => generationService.list({ page: 1, page_size: RECENT_SIZE }),
  });
  const completed = (recent.data?.items ?? []).filter((run) => run.status === 'completed');

  /** Check the file the way an upload would, then open it straight from memory. */
  async function openFile(file: File) {
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

  return (
    <div className="studio-empty">
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{t('studio.emptyTitle')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>{t('studio.emptyBody')}</p>
      </div>

      <DropZone label={t('studio.drop')} hint={t('upload.constraints')} onFile={(file) => void openFile(file)} />
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

/** One recent run, fetched behind the token like every other result image. */
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
