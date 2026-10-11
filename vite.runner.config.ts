import { defineConfig } from 'vite';

/**
 * Builds the sandbox harness as a classic IIFE script into public/runner/.
 * A classic script is required: module scripts in an opaque-origin sandboxed
 * iframe would be fetched in CORS mode and fail on plain static hosting.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'public/runner',
    emptyOutDir: false,
    target: 'es2022',
    lib: {
      entry: 'src/runner/harness.ts',
      formats: ['iife'],
      name: 'CQHarness',
      fileName: () => 'harness.js',
    },
  },
});
