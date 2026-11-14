import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredRoster } from '@/services/roster/published';
import { PublishedRoster } from './PublishedRoster';

const fortnight = (start: string): StoredRoster => ({
  start,
  lockedAt: '2026-11-20T10:00:00.000Z',
  rns: [
    { id: 'rn1', name: 'Lina Saad', row: 'D7 D7 OFF N7 N7 OFF OFF S8 S8 S9 OFF OFF D6 REQ'.split(' ') },
    { id: 'rn2', name: 'Omar Fares', row: Array(14).fill('OFF') },
  ],
  groups: [{ label: 'Nurse Aids', rows: [{ id: 'aide0', name: 'Rami', row: Array(14).fill('E10') }] }],
  shifts: [{ code: 'E10', label: '10a–6p', color: '#5fcfc4' }],
  fp: 'x',
  syncedAt: null,
});
const ROSTERS = [fortnight('2026-11-16'), fortnight('2026-11-30'), fortnight('2026-12-14')];

describe('Published roster (staff view)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-02T09:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('opens the current fortnight with my row and My shifts', () => {
    render(<PublishedRoster rosters={ROSTERS} error={false} rosterId="rn1" isManager={false} />);
    expect(screen.getByText('30 Nov – 13 Dec 2026')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /my shifts · lina saad/i })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^8 working shifts/.test(el.textContent ?? ''))).toBeInTheDocument();
    const mine = screen.getByRole('row', { current: true });
    expect(within(mine).getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Nurse Aids')).toBeInTheDocument();
    expect(screen.getByText('10a–6p')).toBeInTheDocument(); // custom shift in the key
  });

  it('moves between fortnights', async () => {
    const user = userEvent.setup();
    render(<PublishedRoster rosters={ROSTERS} error={false} rosterId="rn1" isManager={false} />);
    await user.click(screen.getByRole('button', { name: /next fortnight/i }));
    expect(screen.getByText('14 Dec – 27 Dec 2026')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next fortnight/i })).toBeDisabled();
  });

  it('asks to be linked when the account has no roster name', () => {
    render(<PublishedRoster rosters={ROSTERS} error={false} rosterId={null} isManager={false} />);
    expect(screen.getByText(/ask your nurse manager to link your account/i)).toBeInTheDocument();
    expect(screen.queryByRole('row', { current: true })).not.toBeInTheDocument();
  });

  it('explains the empty state differently for managers', () => {
    const { rerender } = render(<PublishedRoster rosters={[]} error={false} rosterId={null} isManager={false} />);
    expect(screen.getByText(/once the nurse manager locks a fortnight/i)).toBeInTheDocument();
    rerender(<PublishedRoster rosters={[]} error={false} rosterId={null} isManager />);
    expect(screen.getByText(/lock a fortnight in snv2/i)).toBeInTheDocument();
  });
});
