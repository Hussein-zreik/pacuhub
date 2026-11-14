/**
 * Route table — generated from the module registry.
 *
 * Every module gets `/<path>/*` and owns its sub-routes internally, so adding
 * pages inside a module never touches this file. All registered modules get a
 * route regardless of role; ModuleHost decides access, so a deep link shows a
 * clear "no access" message instead of a confusing 404.
 */
import { Navigate, Route, Routes } from 'react-router';
import { useAccessibleModules, useModuleRegistry } from '@/core/modules/ModuleRegistryContext';
import { useSettings } from '@/context/SettingsContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedLayout, PublicOnlyRoute } from '@/app/guards/ProtectedLayout';
import { ModuleHost } from './ModuleHost';
import { NotFoundPage } from './NotFoundPage';

function DefaultRedirect() {
  const modules = useAccessibleModules().filter((module) => module.showInNav);
  const { prefs } = useSettings();
  // Personal start page, if the person still has access to it; otherwise the first tab.
  const target = modules.find((m) => m.id === prefs.startPage) ?? modules[0];
  return target ? <Navigate to={`/${target.path}`} replace /> : <NotFoundPage />;
}

export function AppRouter() {
  const modules = useModuleRegistry();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DefaultRedirect />} />
        {modules.map((module) => (
          <Route key={module.id} path={`${module.path}/*`} element={<ModuleHost key={module.id} module={module} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
