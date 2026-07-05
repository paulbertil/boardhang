import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Vitest config, separate from vite.config.ts so `tsc -b` (which type-checks
// vite.config.ts) never sees Vitest's bundled-vite plugin types, which clash
// with this project's rolldown-based Vite 8. Vitest loads this file at runtime
// only. We merge the app's Vite config so the React plugin (JSX transform)
// applies to component tests, and re-declare the `@` alias here with a URL-based
// path so it resolves reliably under Vitest's config loader.
export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
)
