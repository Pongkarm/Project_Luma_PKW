import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../shared/ui/Button.tsx';
import { Icon } from '../shared/ui/Icon.tsx';
import { translate } from '../config/i18n.ts';

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

    // A class component cannot use hooks, and the store may be part of what
    // broke — read the language straight off <html> instead.
    const language = document.documentElement.lang === 'th' ? 'th' : 'en';
    const crashText = {
      title: translate(language, 'crash.title'),
      body: translate(language, 'crash.body'),
      reload: translate(language, 'crash.reload'),
    };

    return (
      <div className="authpage">
        <div className="centered-note">
          <Icon name="alert" size={22} />
          <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>{crashText.title}</h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {crashText.body}
          </p>
          <p className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', wordBreak: 'break-word' }}>
            {error.message}
          </p>
          <Button icon="refresh" onClick={() => window.location.reload()}>
            {crashText.reload}
          </Button>
        </div>
      </div>
    );
  }
}
