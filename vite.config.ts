import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

/** The build's version: the git commit it was built from. Online players must match. */
function buildVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

// GitHub Pages serves the site from /pass-the-wolf/; local dev serves from /.
const base = process.env.GITHUB_PAGES === 'true' ? '/pass-the-wolf/' : '/';

export default defineConfig({
  base,
  define: { __BUILD__: JSON.stringify(buildVersion()) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: { main: 'index.html', demo: 'demo.html', winsScreens: 'wins-screens.html' },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
