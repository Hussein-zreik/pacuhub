/**
 * Automatic module discovery.
 *
 * Vite resolves this glob at build time: every `src/features/<name>/module.ts`
 * is registered. Only the tiny `module.ts` metadata files are bundled eagerly;
 * each module's UI stays in its own lazy chunk.
 */
import { buildRegistry, definitionsFromGlob } from './registry';

const files = import.meta.glob('/src/features/*/module.ts', { eager: true });

export const moduleRegistry = buildRegistry(definitionsFromGlob(files));
