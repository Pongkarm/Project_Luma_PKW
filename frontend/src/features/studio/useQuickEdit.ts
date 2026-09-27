/**
 * State behind the quick-edit bar under a finished run.
 *
 * It is the studio with the page taken away: the first tool opens a studio
 * session on this run, each tool after that runs on whatever is showing, and
 * "More in Studio" lands on the same versions.
 */
import { useState } from 'react';
import { isApiError } from '../../contracts/errors.ts';
import type { ToolName } from '../../contracts/tools.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';
import { currentVersion, parentOf, useStudio } from './studioStore.ts';
import { openRunInStudio } from './studioImage.ts';
import { useApplyTool, type ToolRequest } from './useApplyTool.ts';

export function useQuickEdit(runId: string) {
  const t = useT();
  const showToast = useToasts((state) => state.show);
  const versions = useStudio((state) => state.versions);
  const currentId = useStudio((state) => state.currentId);
  const originRunId = useStudio((state) => state.originRunId);
  const select = useStudio((state) => state.select);
  const tool = useApplyTool();
  // The first click also fetches the run's image; it counts as busy too.
  const [opening, setOpening] = useState<ToolName | null>(null);

  // Only a session opened on THIS run belongs under this run's picture.
  const current = originRunId === runId ? currentVersion({ versions, currentId }) : null;
  // The original is the run's own image, so only a tool's output counts as an edit.
  const edited = current?.tool ? current : null;

  async function run(request: ToolRequest) {
    let from = current;
    if (!from) {
      setOpening(request.tool);
      try {
        from = await openRunInStudio(runId);
      } catch (error) {
        showToast(isApiError(error) ? error.message : t('studio.openFailed'));
        return;
      } finally {
        setOpening(null);
      }
    }
    tool.apply(request, from);
  }

  return {
    /** What the result stage shows instead of the run's image; null until a tool has run. */
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
