import { ClipboardCheck } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'audits',
  label: 'Unit Audits',
  description: 'Quality and compliance audits: Brief Op Notes, education, infection control and safety.',
  icon: ClipboardCheck,
  path: 'audits',
  order: 30,
  requires: 'audits.view',
  status: 'planned',
  load: () => import('./AuditsModule'),
});
