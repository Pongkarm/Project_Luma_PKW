import { useQuery } from '@tanstack/react-query';
import { systemService } from '../../services/systemService.ts';
import { queryKeys } from '../../services/queryKeys.ts';

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

  if (!data) {
    return (
      <span className="rail__engine">
        <span className="dot" />
        Checking…
      </span>
    );
  }

  if (data.state === 'offline') {
    return (
      <span className="rail__engine">
        <span className="dot dot--offline" />
        Backend unreachable
      </span>
    );
  }

  if (data.state === 'unavailable') {
    return (
      <span className="rail__engine" title={data.reason}>
        <span className="dot" />
        Status unavailable
      </span>
    );
  }

  return (
    <span className="rail__engine">
      <span className="dot dot--online" />
      Online
    </span>
  );
}

/** The inference mode, shown only when the backend actually reports one. */
export function AiModeBadge() {
  const { data } = useEngineStatus();
  if (!data || data.state !== 'online' || !data.aiMode) return null;
  return (
    <span
      className="mono"
      style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}
      title="Inference mode reported by the backend"
    >
      {data.aiMode.toUpperCase()} MODE
    </span>
  );
}
