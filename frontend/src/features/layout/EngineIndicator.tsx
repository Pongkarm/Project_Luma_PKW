import { useQuery } from '@tanstack/react-query';
import { systemService } from '../../services/systemService.ts';
import { queryKeys } from '../../services/queryKeys.ts';
import { useT } from '../../shared/hooks/useT.ts';

function useEngineStatus() {
  return useQuery({
    queryKey: queryKeys.engineStatus,
    queryFn: () => systemService.engineStatus(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * What the app can honestly say about the backend.
 *
 * /healthz and /api/status both raise on the server today, so "unavailable" is
 * the truthful reading — it does not mean the backend is down, and it does not
 * claim a mode the app cannot actually read.
 */
export function EngineIndicator() {
  const { data } = useEngineStatus();
  const t = useT();

  if (!data) {
    return (
      <span className="rail__engine">
        <span className="dot" />
        {t('engine.checking')}
      </span>
    );
  }

  if (data.state === 'offline') {
    return (
      <span className="rail__engine">
        <span className="dot dot--offline" />
        {t('engine.offline')}
      </span>
    );
  }

  if (data.state === 'unavailable') {
    return (
      <span className="rail__engine" title={data.reason}>
        <span className="dot" />
        {t('engine.unavailable')}
      </span>
    );
  }

  return (
    <span className="rail__engine">
      <span className="dot dot--online" />
      {t('engine.online')}
    </span>
  );
}

/** The inference mode, shown only when the backend actually reports one. */
export function AiModeBadge() {
  const { data } = useEngineStatus();
  const t = useT();
  if (!data || data.state !== 'online' || !data.aiMode) return null;
  return (
    <span
      className="mono"
      style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}
      title={t('engine.modeReported')}
    >
      {data.aiMode.toUpperCase()} MODE
    </span>
  );
}
