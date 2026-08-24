import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <span className="brand-mark" aria-hidden="true"><i /></span>
        <p className="fatal-error-kicker">ANON Alpha 0.1.0</p>
        <h1>ANON couldn’t render this screen</h1>
        <p>Your local data was not sent anywhere. Reload the interface; if this continues, restart the app.</p>
        <button className="button" onClick={() => window.location.reload()}>Reload ANON</button>
      </main>
    );
  }
}
