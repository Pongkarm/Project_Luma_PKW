import { Icon } from '../../shared/ui/Icon.tsx';
import { useT } from '../../shared/hooks/useT.ts';
import type { ToolName } from '../../contracts/tools.ts';
import { toolMeta } from './toolMeta.ts';

/**
 * "Applying Sketch…" laid over the picture while a tool runs, so the wait is
 * attached to the image it will change. The parent must be position: relative.
 */
export function ToolBusy({ tool }: { tool: ToolName | null }) {
  const t = useT();
  if (!tool) return null;
  return (
    <div className="studio-busy" role="status">
      <Icon name="refresh" size={20} className="spin" />
      <span>{t('studio.applying', { tool: t(toolMeta[tool].label) })}</span>
    </div>
  );
}
