import { useT } from '../../shared/hooks/useT.ts';

/**
 * Sits next to a control the current inference mode ignores.
 *
 * The control keeps its value and stays legible — it is disabled, not hidden,
 * because the setting is real and will work again under a different mode.
 * What it must not do is look adjustable when adjusting it changes nothing.
 */
export function NoEffect() {
  const t = useT();
  return (
    <span className="no-effect" title={t('mode.noEffectWhy')}>
      {t('mode.noEffect')}
    </span>
  );
}
