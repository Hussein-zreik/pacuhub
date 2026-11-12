import { ClipboardList } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'forms',
  label: 'PACU Forms',
  description: 'Clinical documentation, unit checklists and standardized PACU forms.',
  icon: ClipboardList,
  path: 'forms',
  order: 20,
  permissions: {
    levels: [
      { id: 'fill', label: 'Fill forms', description: 'Complete and submit forms.' },
      { id: 'review', label: 'Fill & review', description: 'Also see all submissions and co-sign.' },
    ],
  },
  status: 'planned',
  load: () => import('./FormsModule'),
});
