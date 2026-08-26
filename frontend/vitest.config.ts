import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Node by default; the few tests that mount a component ask for jsdom with a
  // `@vitest-environment jsdom` docblock, so the pure ones stay fast.
  test: { environment: 'node' },
});
