/**
 * Generic error boundary.
 *
 * Used at two levels:
 *   1. Around the whole app (last-resort catastrophic fallback).
 *   2. Around EACH module — so a runtime error in Audits cannot take down
 *      Schedule, Forms or the navigation shell.
 *
 * `resetKeys`: when any key changes (e.g. the user navigates elsewhere), the
 * boundary clears its error automatically and re-renders its children.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createErrorId } from '@/utils/errors';

export interface FallbackProps {
  error: Error;
  errorId: string;
  reset: () => void;
}

interface Props {
  children: ReactNode;
  fallback: (props: FallbackProps) => ReactNode;
  onError?: (error: Error, info: ErrorInfo, errorId: string) => void;
  resetKeys?: readonly unknown[];
}

interface State {
  error: Error | null;
  errorId: string;
}

const keysChanged = (a: readonly unknown[] = [], b: readonly unknown[] = []) =>
  a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, errorId: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)), errorId: createErrorId() };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info, this.state.errorId);
  }

  override componentDidUpdate(prevProps: Props) {
    if (this.state.error && keysChanged(prevProps.resetKeys, this.props.resetKeys)) this.reset();
  }

  reset = () => this.setState({ error: null, errorId: '' });

  override render() {
    const { error, errorId } = this.state;
    if (error) return this.props.fallback({ error, errorId, reset: this.reset });
    return this.props.children;
  }
}
