import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayOffRequest, Snv2Manager } from '@/services/snv2/requestsService';
import { StaffRequests } from './StaffRequests';

const svc = vi.hoisted(() => ({
  isSnv2Configured: vi.fn(() => true),
  friendlySnv2Error: vi.fn(() => 'error'),
  snv2Requests: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    watchSession: vi.fn(),
    watchRequests: vi.fn(),
    setDone: vi.fn(),
  },
}));
vi.mock('@/services/snv2/requestsService', () => svc);

const FORM = 'AbCdEfGhIjKlMnOpQrSt12';
const manager: Snv2Manager = { uid: 'm1', email: 'manager@aub.edu.lb' };
const req = (over: Partial<DayOffRequest>): DayOffRequest => ({
  id: 'r1', name: 'Lina Saad', dates: ['2026-11-20'], reason: 'Family event', done: false, createdAt: new Date('2026-11-12T08:00'), ...over,
});

function session(value: Snv2Manager | null) {
  svc.snv2Requests.watchSession.mockImplementation((cb: (m: Snv2Manager | null) => void) => {
    cb(value);
    return () => {};
  });
}
function requests(list: DayOffRequest[]) {
  svc.snv2Requests.watchRequests.mockImplementation((_f: string, onData: (r: DayOffRequest[]) => void) => {
    onData(list);
    return () => {};
  });
}

describe('StaffRequests (day-off requests in Schedule)', () => {
  beforeEach(() => {
    svc.isSnv2Configured.mockReturnValue(true);
    svc.snv2Requests.signIn.mockReset().mockResolvedValue(undefined);
    svc.snv2Requests.setDone.mockReset().mockResolvedValue(undefined);
    session(null);
    requests([]);
  });

  it('asks the manager to connect SNV2 when not signed in', () => {
    render(<StaffRequests formId={FORM} />);
    expect(screen.getByPlaceholderText(/snv2 manager email/i)).toBeInTheDocument();
  });

  it('needs the request link to be set first', () => {
    render(<StaffRequests formId={null} />);
    expect(screen.getByText(/set the snv2 staff request link above first/i)).toBeInTheDocument();
  });

  it('connects with the entered SNV2 credentials', async () => {
    const user = userEvent.setup();
    render(<StaffRequests formId={FORM} />);
    await user.type(screen.getByPlaceholderText(/snv2 manager email/i), 'manager@aub.edu.lb');
    await user.type(screen.getByPlaceholderText(/snv2 password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /connect snv2/i }));
    expect(svc.snv2Requests.signIn).toHaveBeenCalledWith('manager@aub.edu.lb', 'secret123');
  });

  it('lists pending requests once connected, and marks one done', async () => {
    const user = userEvent.setup();
    session(manager);
    requests([req({ id: 'r1', name: 'Lina Saad' }), req({ id: 'r2', name: 'Omar Fares', done: true })]);
    render(<StaffRequests formId={FORM} />);

    expect(screen.getByText('Lina Saad')).toBeInTheDocument();
    expect(screen.queryByText('Omar Fares')).not.toBeInTheDocument(); // handled ones hidden by default
    expect(screen.getByText('1 new')).toBeInTheDocument();
    expect(screen.getByText(/connected as manager@aub.edu.lb/i)).toBeInTheDocument();

    const row = screen.getByText('Lina Saad').closest('li')!;
    await user.click(within(row).getByRole('button', { name: /mark done/i }));
    expect(svc.snv2Requests.setDone).toHaveBeenCalledWith(FORM, 'r1', true);
  });

  it('can reveal handled requests', async () => {
    const user = userEvent.setup();
    session(manager);
    requests([req({ id: 'r2', name: 'Omar Fares', done: true })]);
    render(<StaffRequests formId={FORM} />);
    expect(screen.queryByText('Omar Fares')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show handled/i }));
    expect(screen.getByText('Omar Fares')).toBeInTheDocument();
  });
});
