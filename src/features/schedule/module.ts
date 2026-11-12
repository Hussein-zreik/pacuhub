import { CalendarDays } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'schedule',
  label: 'Schedule',
  description: 'Unit staffing schedule via SNV2.',
  icon: CalendarDays,
  path: 'schedule',
  order: 10,
  requires: 'schedule.view',
  load: () => import('./ScheduleModule'),
});
