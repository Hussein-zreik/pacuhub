import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import { ModuleRegistryProvider } from '@/core/modules/ModuleRegistryContext';
import { moduleRegistry } from '@/core/modules/discovered';
import { DEFAULT_CONFIG, type Bay } from '@/services/bayboard/model';
import BayBoardModule from './BayBoardModule';

const svc = vi.hoisted(() => ({
  watchBays: vi.fn(),
  watchBoardConfig: vi.fn(),
  watchTodayEvents: vi.fn(),
  runBayAction: vi.fn(),
  addBay: vi.fn(),
  renameBay: vi.fn(),
  swapBays: vi.fn(),
  deleteBay: vi.fn(),
  saveBoardConfig: vi.fn(),
}));
vi.mock('@/services/bayboard/bayService', () => svc);
vi.mock('@/hooks/usePublishedRosters', () => ({ usePublishedRosters: () => ({ rosters: [], error: false }) }));

const NOW = new Date('2026-11-14T10:00:00');
const bay = (over: Partial<Bay>): Bay => ({
  id: 'b1', name: 'Bay 1', order: 0, status: 'empty', nurse: null, tags: [], delayReason: null,
  inRecoveryAt: null, careCompleteAt: null, updatedAt: null, updatedByName: null, ...over,
});
const BAYS = [
  bay({ id: 'b1', name: 'Bay 1' }),
  bay({ id: 'b2', name: 'Bay 2', order: 1, status: 'in-recovery', inRecoveryAt: new Date('2026-11-14T08:55'), nurse: { uid: 'x', name: 'Omar Fares' }, tags: ['oxygen'] }),
  bay({ id: 'b3', name: 'Bay 3', order: 2, status: 'care-complete', inRecoveryAt: new Date('2026-11-14T08:00'), careCompleteAt: new Date('2026-11-14T09:50'), delayReason: 'awaiting-bed' }),
  bay({ id: 'b4', name: 'Bay 4', order: 3, status: 'closed' }),
];

function renderBoard(access: Record<string, string>) {
  const auth = {
    state: { status: 'authorized', user: { uid: 'u1', email: 'lina@aub.edu.lb', displayName: 'Lina Saad', photoURL: null }, access },
  } as unknown as AuthContextValue;
  return render(
    <AuthContext.Provider value={auth}>
      <ModuleRegistryProvider modules={moduleRegistry}>
        <BayBoardModule />
      </ModuleRegistryProvider>
    </AuthContext.Provider>,
  );
}

describe('Bay Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    svc.watchBays.mockImplementation((on: (b: Bay[]) => void) => (on(BAYS), () => {}));
    svc.watchBoardConfig.mockImplementation((on: (c: unknown) => void) => (on({ ...DEFAULT_CONFIG, capacity: { level: 'amber', note: 'Two nurses on break' } }), () => {}));
    svc.watchTodayEvents.mockImplementation((_s: Date, on: (e: unknown[]) => void) => (on([]), () => {}));
    svc.runBayAction.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('shows every bay with Epic status names, timers and alerts', () => {
    renderBoard({ bayboard: 'update' });
    expect(screen.getByRole('button', { name: /^Bay 1, Empty$/ })).toBeInTheDocument();
    // 65 min in recovery → past the 60-min amber threshold
    expect(screen.getByRole('button', { name: /Bay 2, In Recovery, 1 h 05 in recovery, amber alert, nurse Omar Fares/ })).toBeInTheDocument();
    // 10 min since care complete → no alert yet (amber at 30)
    expect(screen.getByRole('button', { name: /Bay 3, Recovery Care Complete, 10 min since care complete$/ })).toBeInTheDocument();
    expect(screen.getByText('Awaiting bed')).toBeInTheDocument();
    expect(screen.getByText(/PACU AMBER/)).toBeInTheDocument();
    expect(screen.getByText(/Two nurses on break/)).toBeInTheDocument();
  });

  it('a nurse places a patient in recovery, assigned to themselves with a tag', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    renderBoard({ bayboard: 'update' });
    await user.click(screen.getByRole('button', { name: /^Bay 1, Empty$/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: /assigned nurse/i })).toHaveValue('Lina Saad');
    await user.click(within(dialog).getByRole('button', { name: 'Pediatric' }));
    await user.click(within(dialog).getByRole('button', { name: /place in recovery/i }));
    await waitFor(() =>
      expect(svc.runBayAction).toHaveBeenCalledWith('b1', { type: 'place', nurse: { uid: 'u1', name: 'Lina Saad' }, tags: ['pediatric'] }, { uid: 'u1', name: 'Lina Saad' }),
    );
  });

  it('Out of recovery needs a second tap to confirm', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    renderBoard({ bayboard: 'update' });
    await user.click(screen.getByRole('button', { name: /^Bay 3,/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^out of recovery$/i }));
    expect(svc.runBayAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: /confirm: out of recovery/i }));
    await waitFor(() => expect(svc.runBayAction).toHaveBeenCalledWith('b3', { type: 'out' }, expect.anything()));
  });

  it('a delay reason can be set after Recovery Care Complete', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    renderBoard({ bayboard: 'update' });
    await user.click(screen.getByRole('button', { name: /^Bay 3,/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Awaiting transport' }));
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(svc.runBayAction).toHaveBeenCalledWith('b3', expect.objectContaining({ type: 'edit', delayReason: 'awaiting-transport' }), expect.anything()));
  });

  it('view-only staff see the board but get no actions or set-up', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    renderBoard({ bayboard: 'view' });
    expect(screen.queryByRole('button', { name: /set up/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Bay 1, Empty$/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /place in recovery/i })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/view this bay but not change it/i)).toBeInTheDocument();
  });

  it('only managers can close a bay or change the capacity signal', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    const { unmount } = renderBoard({ bayboard: 'update' });
    expect(screen.queryByRole('button', { name: /^change$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Bay 1, Empty$/ }));
    expect(within(await screen.findByRole('dialog')).queryByRole('button', { name: /close bay/i })).not.toBeInTheDocument();
    unmount();
    renderBoard({ bayboard: 'manage' });
    expect(screen.getByRole('button', { name: /^change$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set up/i })).toBeInTheDocument();
  });
});
