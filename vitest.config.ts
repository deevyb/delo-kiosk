import { defineConfig } from 'vitest/config'

// Dev-only. Scoped to lib/ — component testing stays manual per project convention.
export default defineConfig({
  test: { include: ['lib/**/*.test.ts'], environment: 'node' },
})
