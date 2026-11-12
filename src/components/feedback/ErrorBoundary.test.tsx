import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { ModuleErrorFallback } from './ModuleErrorFallback';

function Boom(): never {
  throw new Error('kaboom');
}

const boundary = (label: string, child: React.ReactNode, onError = vi.fn()) => (
  <ErrorBoundary onError={onError} fallback={(props) => <ModuleErrorFallback {...props} moduleLabel={label} />}>
    {child}
  </ErrorBoundary>
);

describe('module isolation', () => {
  it('a crashing module shows its fallback while sibling modules keep working', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <>
        {boundary('Audits', <Boom />, onError)}
        {boundary('Schedule', <p>Schedule is fine</p>)}
      </>,
    );
    expect(screen.getByText('Audits ran into a problem')).toBeInTheDocument();
    expect(screen.getByText('Schedule is fine')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
    expect(screen.getByText(/^PH-/)).toBeInTheDocument(); // reference id for IT
  });

  it('"Try again" recovers once the underlying problem is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('transient');
      return <p>Recovered</p>;
    }
    render(boundary('Forms', <Flaky />));
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('resets automatically when resetKeys change (e.g. navigation)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Harness() {
      const [page, setPage] = useState('bad');
      return (
        <>
          <button onClick={() => setPage('good')}>navigate</button>
          <ErrorBoundary resetKeys={[page]} fallback={() => <p>fallback</p>}>
            {page === 'bad' ? <Boom /> : <p>good page</p>}
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByText('fallback')).toBeInTheDocument();
    await userEvent.click(screen.getByText('navigate'));
    expect(screen.getByText('good page')).toBeInTheDocument();
  });

  it('identifies chunk-load failures and offers a reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function ChunkFail(): never {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/AuditsModule.js');
    }
    render(boundary('Audits', <ChunkFail />));
    expect(screen.getByText("Audits couldn't be loaded")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });
});
