import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /pass-the-wolf/; local dev serves from /.
const base = process.env.GITHUB_PAGES === 'true' ? '/pass-the-wolf/' : '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
