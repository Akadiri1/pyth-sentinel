// ── Error Boundary Component ──
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SENTINEL-1] Error in ${this.props.fallbackLabel || 'component'}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass-card p-4 flex flex-col items-center justify-center gap-3"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="w-6 h-6 text-pyth-yellow" />
          <div className="text-center">
            <p className="font-mono text-xs text-pyth-text-dim font-semibold">
              {this.props.fallbackLabel || 'Component'} Error
            </p>
            <p className="font-mono text-[10px] text-pyth-text-muted mt-1 max-w-xs">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-pyth-purple/15 border border-pyth-purple/25
              text-pyth-purple font-mono text-[10px]
              hover:bg-pyth-purple/25 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
