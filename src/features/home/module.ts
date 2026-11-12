import { House } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'home',
  label: 'Home',
  description: 'Your PACU Hub overview.',
  icon: House,
  path: 'home',
  order: 0,
  load: () => import('./HomePage'),
});
