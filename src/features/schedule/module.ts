import { CalendarDays } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'schedule',
  label: 'Schedule',
  description: 'Unit staffing schedule via SNV2.',
  icon: CalendarDays,
  path: 'schedule',
  order: 10,
  permissions: {
    levels: [{ id: 'view', label: 'View schedule', description: 'Open the unit schedule (SNV2).' }],
  },
  load: () => import('./ScheduleModule'),
});
