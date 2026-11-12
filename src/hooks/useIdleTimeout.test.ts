import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_STORAGE_KEY, readLastActivity, useIdleTimeout } from './useIdleTimeout';

const TIMEOUT = 5 * 60_000;
const WARNING = 60_000;

describe('useIdleTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (enabled = true) => {
    const onTimeout = vi.fn();
    const hook = renderHook(() => useIdleTimeout({ enabled, timeoutMs: TIMEOUT, warningMs: WARNING, onTimeout }));
    return { onTimeout, ...hook };
  };

  it('warns one minute before timing out, then signs out', () => {
    const { result, onTimeout } = setup();
    act(() => vi.advanceTimersByTime(TIMEOUT - WARNING - 1000));
    expect(result.current.isWarning).toBe(false);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.isWarning).toBe(true);
    expect(result.current.remainingMs).toBeLessThanOrEqual(WARNING);

    act(() => vi.advanceTimersByTime(WARNING));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('user activity before the warning extends the session', () => {
    const { onTimeout } = setup();
    act(() => vi.advanceTimersByTime(TIMEOUT - WARNING - 5000));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    act(() => vi.advanceTimersByTime(TIMEOUT - 10_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('passive activity during the warning does NOT extend the session', () => {
    const { result, onTimeout } = setup();
    act(() => vi.advanceTimersByTime(TIMEOUT - WARNING + 1000));
    expect(result.current.isWarning).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('pointermove'));
    });
    act(() => vi.advanceTimersByTime(WARNING));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('"Stay signed in" resets the window', () => {
    const { result, onTimeout } = setup();
    act(() => vi.advanceTimersByTime(TIMEOUT - WARNING + 1000));
    act(() => result.current.stayActive());
    expect(result.current.isWarning).toBe(false);
    act(() => vi.advanceTimersByTime(TIMEOUT - WARNING - 1000));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('signs out immediately when a stale session is re-opened', () => {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now() - TIMEOUT - 1));
    const { onTimeout } = setup();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('honours activity recorded by another tab', () => {
    const { onTimeout } = setup();
    act(() => vi.advanceTimersByTime(TIMEOUT - 5000));
    act(() => {
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now()));
      window.dispatchEvent(new StorageEvent('storage', { key: ACTIVITY_STORAGE_KEY }));
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const { onTimeout } = setup(false);
    act(() => vi.advanceTimersByTime(TIMEOUT * 2));
    expect(onTimeout).not.toHaveBeenCalled();
    expect(readLastActivity()).toBeNull();
  });
});
