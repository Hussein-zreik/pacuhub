import { ClipboardList } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'forms',
  label: 'PACU Forms',
  description: 'Clinical documentation, unit checklists and standardized PACU forms.',
  icon: ClipboardList,
  path: 'forms',
  order: 20,
  requires: 'forms.submit',
  status: 'planned',
  load: () => import('./FormsModule'),
});
