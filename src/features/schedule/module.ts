import { CalendarDays } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'schedule',
  label: 'Schedule',
  description: 'Request days off and, soon, view the published roster.',
  icon: CalendarDays,
  path: 'schedule',
  order: 10,
  permissions: {
    levels: [
      { id: 'view', label: 'Request days off', description: 'Send day-off requests; view the published roster (coming soon).' },
      { id: 'manage', label: 'Manage schedule', description: 'Also open SNV2 and set the staff request link.' },
    ],
  },
  load: () => import('./ScheduleModule'),
});
