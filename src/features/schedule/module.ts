import { CalendarDays } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'schedule',
  label: 'Schedule',
  description: 'The published roster and day-off requests.',
  icon: CalendarDays,
  path: 'schedule',
  order: 10,
  permissions: {
    levels: [
      { id: 'view', label: 'Request days off', description: 'View the published roster and send day-off requests.' },
      { id: 'manage', label: 'Manage schedule', description: 'Also approve requests, publish the roster from SNV2, and set the request link.' },
    ],
  },
  load: () => import('./ScheduleModule'),
});
