import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            reset={this.handleReset}
          />
        );
      }

      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류가 발생했습니다</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="text-sm">
                  예상치 못한 오류가 발생했습니다. 다시 시도해 주세요.
                </p>
                {this.state.error.message && (
                  <p className="text-xs font-mono bg-destructive/10 p-2 rounded">
                    {this.state.error.message}
                  </p>
                )}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex justify-end">
              <Button onClick={this.handleReset} variant="outline">
                다시 시도
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
