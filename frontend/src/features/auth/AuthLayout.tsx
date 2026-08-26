import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../shared/ui/Icon.tsx';
import { useT } from '../../shared/hooks/useT.ts';
import type { TKey } from '../../config/i18n.ts';

const features: { icon: IconName; name: TKey; body: TKey }[] = [
  { icon: 'generate', name: 'auth.f1', body: 'auth.f1d' },
  { icon: 'image', name: 'auth.f2', body: 'auth.f2d' },
  { icon: 'layers', name: 'auth.f3', body: 'auth.f3d' },
];

/**
 * The shell both auth screens share, so sign-in and registration cannot drift
 * apart. The left panel explains the product on a wide screen and is dropped
 * entirely below 940px, where the form is the only thing worth showing.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <div className="auth">
      <aside className="auth__brand">
        <span className="mark">
          <span className="brand__mark" aria-hidden="true">
            L
          </span>
          <span className="brand__word">LUMA</span>
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-32)' }}>
          <h2 className="auth__tagline">{t('auth.tagline')}</h2>
          <div className="auth__features">
            {features.map((feature) => (
              <div className="auth__feature" key={feature.name}>
                <Icon name={feature.icon} size={16} className="auth__featureIcon" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  <span className="auth__featureName">{t(feature.name)}</span>
                  <span className="auth__featureBody">{t(feature.body)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <span className="auth__foot">{t('auth.foot')}</span>
      </aside>

      <main className="auth__panel">
        <div className="auth__card">
          <div className="auth__markRow">
            <span className="brand__mark" aria-hidden="true">
              L
            </span>
            <span className="brand__word">LUMA</span>
          </div>

          <div className="auth__head">
            <h1 className="auth__title">{title}</h1>
            <p className="auth__sub">{subtitle}</p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
