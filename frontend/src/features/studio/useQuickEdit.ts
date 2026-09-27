import { useState } from 'react';
import { generationService } from '../../services/generationService.ts';
import { isApiError } from '../../contracts/errors.ts';
import type { ToolName } from '../../contracts/tools.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';
import { currentVersion, parentOf, useStudio } from './studioStore.ts';
import { measureImage, resultLabel } from './studioActions.ts';
import { useApplyTool, type ToolRequest } from './useApplyTool.ts';

/**
 * The quick-edit bar under a finished run.
 *
 * It is the studio with the page taken away: the first tool opens a studio
 * session on this run, each tool after that runs on whatever is showing, and
 * "More in Studio" lands on the same versions. `edited` is what the result
 * stage shows instead of the run's own image — null until a tool has run, or
 * once the person goes back to the original.
 */
export function useQuickEdit(runId: string) {
  const t = useT();
  const showToast = useToasts((state) => state.show);
  const versions = useStudio((state) => state.versions);
  const currentId = useStudio((state) => state.currentId);
  const originRunId = useStudio((state) => state.originRunId);
  const open = useStudio((state) => state.open);
  const select = useStudio((state) => state.select);
  const tool = useApplyTool();
  const [opening, setOpening] = useState<ToolName | null>(null);

  const current = originRunId === runId ? currentVersion({ versions, currentId }) : null;
  const edited = current?.tool ? current : null;

  async function run(request: ToolRequest) {
    let from = current;
    if (!from) {
      setOpening(request.tool);
      try {
        const blob = await generationService.fetchImageBlob(runId);
        open(blob, await measureImage(blob), resultLabel(runId), runId);
        from = currentVersion(useStudio.getState());
      } catch (error) {
        showToast(isApiError(error) ? error.message : t('studio.openFailed'));
        return;
      } finally {
        setOpening(null);
      }
    }
    if (from) tool.apply(request, from);
  }

  return {
    edited,
    /** What `edited` was made from — the full picture a cut-out's mask belongs to. */
    editedFrom: edited ? parentOf({ versions }, edited) : null,
    run,
    pendingTool: opening ?? tool.pendingTool,
    error: tool.error,
    unavailable: tool.unavailable,
    showOriginal: () => versions[0] && select(versions[0].id),
  };
}

export type QuickEdit = ReturnType<typeof useQuickEdit>;
