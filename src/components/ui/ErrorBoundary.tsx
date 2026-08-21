import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Waraqa CRM ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-[#FAF5EE]">
          <div className="max-w-md w-full bg-white border border-[#E6D9C7] rounded-3xl p-8 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#A3492F]/15 text-[#A3492F] flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>
            
            <div className="space-y-1">
              <h2 className="font-serif text-xl font-bold text-[#241C1B]">
                Something went wrong
              </h2>
              <p className="text-xs text-[#6B5D50] leading-relaxed">
                An unexpected interface error occurred. The system kept your data safely preserved.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-[#FAF5EE] rounded-xl text-[11px] font-mono text-[#A3492F] text-left overflow-x-auto max-h-28 border border-[#E6D9C7]">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={this.handleReset}
                icon={<RefreshCw size={14} />}
                className="w-full"
              >
                <span>Reload Command Hub</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
