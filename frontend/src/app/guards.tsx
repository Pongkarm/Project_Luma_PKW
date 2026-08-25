import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../features/auth/sessionStore.ts';
import { Icon } from '../shared/ui/Icon.tsx';
import { useT } from '../shared/hooks/useT.ts';

function Booting() {
  const t = useT();
  return (
    <div className="authpage">
      <div className="centered-note">
        <Icon name="refresh" size={20} className="spin" />
        <span className="subtle" style={{ fontSize: 12.5 }}>
          {t('auth.restoring')}
        </span>
      </div>
    </div>
  );
}

/**
 * Route guarding lives here and nowhere else — no screen decides for itself
 * whether someone is allowed to see it.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  const location = useLocation();

  if (status === 'booting') return <Booting />;
  if (status === 'anonymous') {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Someone already signed in has no business on the sign-in screen. */
export function RequireAnonymous({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  if (status === 'booting') return <Booting />;
  if (status === 'authenticated') return <Navigate to="/generate" replace />;
  return <>{children}</>;
}
