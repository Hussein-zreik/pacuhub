import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';
import type { DayOffDecision } from '@/services/schedule/dayOffDecisions';
import type { DayOffRequest, Snv2Manager } from '@/services/snv2/requestsService';
import { StaffRequests } from './StaffRequests';

const svc = vi.hoisted(() => ({
  isSnv2Configured: vi.fn(() => true),
  friendlySnv2Error: vi.fn((e: unknown) => (e as Error)?.message ?? 'error'),
  snv2Requests: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    watchSession: vi.fn(),
    watchRequests: vi.fn(),
    setDone: vi.fn(),
    approveIntoRoster: vi.fn(),
    removeFromRoster: vi.fn(),
  },
}));
vi.mock('@/services/snv2/requestsService', () => svc);
vi.mock('@/services/activity/activityLog', () => ({ logActivity: vi.fn(async () => {}) }));

const dec = vi.hoisted(() => ({
  watchDecisions: vi.fn(),
  saveDecision: vi.fn(),
  deleteDecision: vi.fn(),
  decisionId: (f: string, r: string) => `${f}__${r}`,
}));
vi.mock('@/services/schedule/dayOffDecisions', () => dec);

const FORM = 'AbCdEfGhIjKlMnOpQrSt12';
const manager: Snv2Manager = { uid: 'm1', email: 'manager@aub.edu.lb' };
const req = (over: Partial<DayOffRequest> = {}): DayOffRequest => ({
  id: 'r1', rnId: 'n0', name: 'Lina Saad', dates: ['2026-11-20'], reason: 'Family event', done: false,
  createdAt: new Date('2026-11-12T08:00'), ...over,
});
const decision = (over: Partial<DayOffDecision> = {}): DayOffDecision => ({
  id: `${FORM}__r9`, formId: FORM, requestId: 'r9', rnId: 'n1', name: 'Omar Fares', dates: ['2026-11-25'], reason: 'Exam',
  decision: 'approved', applied: ['2026-11-25'], notesWritten: ['2026-11-25'], skipped: [], decidedBy: 'hub', decidedAt: new Date(), ...over,
});

const auth = {
  state: { status: 'authorized', user: { uid: 'hub-uid', email: 'm@x.com', displayName: 'M', photoURL: null }, access: { schedule: 'manage' } },
} as unknown as AuthContextValue;
const wrap = (ui: ReactNode) => render(<AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>);

function setup({ session = manager as Snv2Manager | null, requests = [] as DayOffRequest[], decisions = [] as DayOffDecision[] } = {}) {
  svc.snv2Requests.watchSession.mockImplementation((cb: (m: Snv2Manager | null) => void) => (cb(session), () => {}));
  svc.snv2Requests.watchRequests.mockImplementation((_f: string, on: (r: DayOffRequest[]) => void) => (on(requests), () => {}));
  dec.watchDecisions.mockImplementation((_f: string, on: (d: DayOffDecision[]) => void) => (on(decisions), () => {}));
}

describe('Day-off requests: approve / reject / history / undo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.isSnv2Configured.mockReturnValue(true);
    svc.snv2Requests.setDone.mockResolvedValue(undefined);
    dec.saveDecision.mockResolvedValue(undefined);
    dec.deleteDecision.mockResolvedValue(undefined);
  });

  it('asks to connect SNV2 when not signed in', () => {
    setup({ session: null });
    wrap(<StaffRequests formId={FORM} />);
    expect(screen.getByPlaceholderText(/snv2 manager email/i)).toBeInTheDocument();
  });

  it('Approve → Req off in the roster, decision recorded, request marked done', async () => {
    const user = userEvent.setup();
    setup({ requests: [req()] });
    svc.snv2Requests.approveIntoRoster.mockResolvedValue({ applied: ['2026-11-20'], notesWritten: ['2026-11-20'], skipped: [] });
    wrap(<StaffRequests formId={FORM} />);

    await user.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(svc.snv2Requests.setDone).toHaveBeenCalledWith(FORM, 'r1', true));
    expect(svc.snv2Requests.approveIntoRoster).toHaveBeenCalledWith('n0', ['2026-11-20'], 'Family event');
    expect(dec.saveDecision).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', decision: 'approved', applied: ['2026-11-20'] }),
      'hub-uid',
    );
  });

  it('Approve with nothing addable → clear error, nothing recorded', async () => {
    const user = userEvent.setup();
    setup({ requests: [req()] });
    svc.snv2Requests.approveIntoRoster.mockResolvedValue({ applied: [], notesWritten: [], skipped: [{ date: '2026-11-20', why: 'fortnight is locked in SNV2' }] });
    wrap(<StaffRequests formId={FORM} />);

    await user.click(screen.getByRole('button', { name: /approve/i }));
    expect(await screen.findByText(/nothing was added to the roster/i)).toBeInTheDocument();
    expect(dec.saveDecision).not.toHaveBeenCalled();
    expect(svc.snv2Requests.setDone).not.toHaveBeenCalled();
  });

  it('if the decision cannot be saved, the roster change is rolled back', async () => {
    const user = userEvent.setup();
    setup({ requests: [req()] });
    svc.snv2Requests.approveIntoRoster.mockResolvedValue({ applied: ['2026-11-20'], notesWritten: [], skipped: [] });
    svc.snv2Requests.removeFromRoster.mockResolvedValue({ removed: ['2026-11-20'], locked: [], changedInSnv2: [] });
    dec.saveDecision.mockRejectedValueOnce(new Error('offline'));
    wrap(<StaffRequests formId={FORM} />);

    await user.click(screen.getByRole('button', { name: /approve/i }));
    expect(await screen.findByText(/roster change was reverted/i)).toBeInTheDocument();
    expect(svc.snv2Requests.removeFromRoster).toHaveBeenCalledWith('n0', ['2026-11-20'], [], 'Family event');
  });

  it('Reject → recorded, roster untouched, request marked done', async () => {
    const user = userEvent.setup();
    setup({ requests: [req()] });
    wrap(<StaffRequests formId={FORM} />);

    await user.click(screen.getByRole('button', { name: /reject/i }));
    await waitFor(() => expect(svc.snv2Requests.setDone).toHaveBeenCalledWith(FORM, 'r1', true));
    expect(svc.snv2Requests.approveIntoRoster).not.toHaveBeenCalled();
    expect(dec.saveDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'rejected', applied: [] }), 'hub-uid');
  });

  it('decided requests leave Pending and show in History', async () => {
    const user = userEvent.setup();
    setup({ requests: [req({ id: 'r9', name: 'Omar Fares', done: true })], decisions: [decision()] });
    wrap(<StaffRequests formId={FORM} />);
    expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /history/i }));
    const row = screen.getByText('Omar Fares').closest('li')!;
    expect(within(row).getByText('Approved')).toBeInTheDocument();
    expect(within(row).getByText(/added to roster as req off/i)).toBeInTheDocument();
  });

  it('Undo an approval → removes the Req off, deletes the decision, reopens the request', async () => {
    const user = userEvent.setup();
    setup({ decisions: [decision()] });
    svc.snv2Requests.removeFromRoster.mockResolvedValue({ removed: ['2026-11-25'], locked: [], changedInSnv2: [] });
    wrap(<StaffRequests formId={FORM} />);

    await user.click(screen.getByRole('tab', { name: /history/i }));
    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    const dialog = await screen.findByRole('dialog', { name: /undo approval/i });
    await user.click(within(dialog).getByRole('button', { name: /^undo$/i }));

    await waitFor(() => expect(dec.deleteDecision).toHaveBeenCalledWith(FORM, 'r9'));
    expect(svc.snv2Requests.removeFromRoster).toHaveBeenCalledWith('n1', ['2026-11-25'], ['2026-11-25'], 'Exam');
    expect(svc.snv2Requests.setDone).toHaveBeenCalledWith(FORM, 'r9', false);
  });

  it('Undo where the fortnight is now locked keeps the decision and explains why', async () => {
    const user = userEvent.setup();
    setup({ decisions: [decision()] });
    svc.snv2Requests.removeFromRoster.mockResolvedValue({ removed: [], locked: ['2026-11-25'], changedInSnv2: [] });
    wrap(<StaffRequests formId={FORM} />);

    await user.click(screen.getByRole('tab', { name: /history/i }));
    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^undo$/i }));

    expect(await screen.findByText(/partly undone/i)).toBeInTheDocument();
    expect(dec.deleteDecision).not.toHaveBeenCalled();
    expect(dec.saveDecision).toHaveBeenCalledWith(expect.objectContaining({ applied: ['2026-11-25'] }), 'hub-uid');
  });

  it('Undo a rejection → back to Pending without touching the roster', async () => {
    const user = userEvent.setup();
    setup({ decisions: [decision({ decision: 'rejected', applied: [], notesWritten: [] })] });
    wrap(<StaffRequests formId={FORM} />);

    await user.click(screen.getByRole('tab', { name: /history/i }));
    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    await user.click(within(await screen.findByRole('dialog', { name: /undo rejection/i })).getByRole('button', { name: /^undo$/i }));

    await waitFor(() => expect(dec.deleteDecision).toHaveBeenCalled());
    expect(svc.snv2Requests.removeFromRoster).not.toHaveBeenCalled();
  });
});
