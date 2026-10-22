import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      // Same as tsconfig "paths": "@/*" -> "./*"
      '@': root,
      // `import 'server-only'` in lib/server/** must not throw under Vitest
      'server-only': resolve(root, 'tests/unit/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Undo vi.spyOn(...) and vi.stubEnv(...) after every test.
    restoreMocks: true,
    unstubEnvs: true,
  },
})
