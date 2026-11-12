import { UserCog } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'staff-access',
  label: 'Staff Access',
  description: 'Approve access requests and manage staff roles.',
  icon: UserCog,
  path: 'staff-access',
  order: 90,
  requires: 'admin.manage',
  load: () => import('./StaffAccessModule'),
});
