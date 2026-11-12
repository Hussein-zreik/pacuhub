import { UserCog } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'staff-access',
  label: 'Staff Access',
  description: 'Approve access requests and choose what each person can use.',
  icon: UserCog,
  path: 'staff-access',
  order: 90,
  permissions: {
    levels: [{ id: 'admin', label: 'Admin', description: "Approve staff and manage everyone's access." }],
  },
  load: () => import('./StaffAccessModule'),
});
