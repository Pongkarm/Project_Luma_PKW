import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../shared/ui/Button.tsx';
import { Icon } from '../shared/ui/Icon.tsx';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** A rendering fault should not leave a blank page with no way forward. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[LUMA] render failure', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="authpage">
        <div className="centered-note">
          <Icon name="alert" size={22} />
          <h1 style={{ fontSize: 15, fontWeight: 600 }}>Something in the interface broke</h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Your drafts are saved. Reloading usually clears it.
          </p>
          <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', wordBreak: 'break-word' }}>
            {error.message}
          </p>
          <Button icon="refresh" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
