import { Settings } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

// No `permissions`: every approved user can open Settings for their own
// preferences. Unit settings and the activity log inside are admin-only.
export default defineModule({
  id: 'settings',
  label: 'Settings',
  description: 'Your display and sign-out preferences; unit settings for admins.',
  icon: Settings,
  path: 'settings',
  order: 95,
  load: () => import('./SettingsModule'),
});
