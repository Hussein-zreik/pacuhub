import { ClipboardCheck } from 'lucide-react';
import { defineModule } from '@/core/modules/types';
import { AUDIT_CATEGORIES } from './categories';

export default defineModule({
  id: 'audits',
  label: 'Unit Audits',
  description: 'Quality and compliance audits: Brief Op Notes, education, infection control and safety.',
  icon: ClipboardCheck,
  path: 'audits',
  order: 30,
  status: 'planned',
  permissions: {
    levels: [
      { id: 'view', label: 'View results', description: 'See audit results and summaries.' },
      { id: 'enter', label: 'Enter & view', description: 'Also complete new audits.' },
      { id: 'full', label: 'Enter, view & export', description: 'Also export to Excel / PDF.' },
    ],
    areas: AUDIT_CATEGORIES,
  },
  load: () => import('./AuditsModule'),
});
