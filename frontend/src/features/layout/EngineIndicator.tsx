import { useT } from '../../shared/hooks/useT.ts';
import { useEngineStatus } from '../../shared/hooks/useEngineStatus.ts';

/**
 * Compact status for the top bar. The rail footer version disappeared whenever
 * the rail collapsed, which is exactly when someone might wonder whether the
 * engine is up.
 */
export function EnginePill() {
  const { data } = useEngineStatus();
  const t = useT();

  const tone =
    !data ? '' : data.state === 'online' ? 'dot--online' : data.state === 'offline' ? 'dot--offline' : '';
  const label = !data
    ? t('engine.checking')
    : data.state === 'online'
      ? t('engine.online')
      : data.state === 'offline'
        ? t('engine.offline')
        : t('engine.unavailable');

  return (
    <span className="status-pill" title={`${t('nav.engine')}: ${label}`}>
      <span className={`dot ${tone}`} />
      <span className="status-pill__text">{label}</span>
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
      {t('engine.modeBadge', { mode: data.aiMode.toUpperCase() })}
    </span>
  );
}
