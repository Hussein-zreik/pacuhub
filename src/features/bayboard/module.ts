import { LayoutGrid } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'bayboard',
  label: 'Bay Board',
  description: 'Live PACU bays: who is in recovery, care complete, and for how long.',
  icon: LayoutGrid,
  path: 'bay-board',
  order: 5,
  permissions: {
    levels: [
      { id: 'view', label: 'View', description: 'See the live bay board.' },
      { id: 'update', label: 'Update bays', description: 'Place in recovery, care complete, out of recovery, nurse and tags.' },
      { id: 'manage', label: 'Manage', description: 'Also set up bays, close bays, alert times and the unit capacity signal.' },
    ],
  },
  load: () => import('./BayBoardModule'),
});
