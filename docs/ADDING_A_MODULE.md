# Adding a new module (tab)

Adding a tab takes **one new folder** and **zero edits to existing files**.

## 1. Create the folder

```
src/features/handover/
├── module.ts          ← registration (required)
├── HandoverModule.tsx ← root component (default export)
├── components/        ← module-private components
├── hooks/             ← module-private hooks (e.g. useHandoverQuery)
└── api.ts             ← calls into src/services (never Firebase directly)
```

## 2. Register it

```ts
// src/features/handover/module.ts
import { ArrowRightLeft } from 'lucide-react';
import { defineModule } from '@/core/modules/types';

export default defineModule({
  id: 'handover',                 // unique, kebab-case
  label: 'Handover',              // nav label
  description: 'Shift handover summaries.',
  icon: ArrowRightLeft,
  path: 'handover',               // URL: /handover/*
  order: 25,                      // position in the nav
  permissions: {                  // access levels, low → high (optional: omit = everyone)
    levels: [
      { id: 'view', label: 'View handovers' },
      { id: 'write', label: 'Write handovers' },
    ],
  },
  status: 'preview',              // 'live' | 'preview' | 'planned'
  load: () => import('./HandoverModule'),
});
```

## 3. Build the root component

```tsx
// src/features/handover/HandoverModule.tsx
import { Route, Routes } from 'react-router';
import { PageHeader } from '@/components/ui';

export default function HandoverModule() {
  return (
    <Routes>
      <Route index element={<PageHeader title="Handover" />} />
      <Route path=":id" element={/* detail page */ null} />
    </Routes>
  );
}
```

That's all. The sidebar, bottom nav, Home card, route, permission gate, error boundary and loading skeleton are applied automatically, and the new tab's levels appear in **Staff Access** so admins can grant them per person.

## Rules (enforced by ESLint)

- ❌ Don't import from another feature. Move shared code to `src/components`, `src/hooks` or `src/services`.
- ❌ Don't import `firebase` in a feature. Add a function or repository in `src/services`.
- ✅ Check access with `usePermissions().can('handover', 'write')` (from `@/core/permissions/usePermissions`). Never check who someone is.
- ✅ Protect the module's Firestore data with the matching rule, e.g. `allow write: if hasLevel('handover', ['write']);`
- ✅ Need sub-areas, each with its own level (like audit types)? Add `areas: [{ id, label }]` to `permissions`.

## Before committing

```bash
npm run check   # type-check + lint + tests
```

The registry test fails if your module's id or path collides with an existing one.
