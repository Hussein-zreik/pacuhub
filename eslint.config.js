import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Fast-refresh hint (dev-only). Co-locating a provider with its hooks is
      // intentional here, so those names are allowed.
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['buttonVariants', 'AuthContext', 'useAuth', 'usePermissions', 'useModuleRegistry', 'useAccessibleModules', 'usePermissionCatalog', 'useSettings'],
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // ARCHITECTURAL GUARDRAIL: feature modules are isolated plugins.
    // A feature may never import another feature, and may never touch the
    // Firebase SDK directly — all data access goes through src/services.
    // This is what keeps a bug in one module from leaking into another.
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/features/**'],
              message: 'Features must not import other features. Move shared code to src/components, src/hooks or src/services.',
            },
            {
              group: ['firebase', 'firebase/*'],
              message: 'Do not call Firebase from a feature. Add a function to src/services instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // UI primitives must stay presentation-only.
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['firebase', 'firebase/*', '@/services/*', '@/services/**'], message: 'UI components must not access data services.' },
            { group: ['@/features/*', '@/features/**'], message: 'UI components must not depend on features.' },
          ],
        },
      ],
    },
  },
);
