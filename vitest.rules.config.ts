import { defineConfig } from 'vitest/config'

const root = import.meta.dirname

// Firestore security-rules tests. Run through `npm run test:rules`, which starts
// the Firestore emulator (firebase emulators:exec) and sets FIRESTORE_EMULATOR_HOST.
export default defineConfig({
  resolve: {
    // Same as tsconfig "paths": "@/*" -> "./*"
    alias: { '@': root },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // All test files share one emulator database, so they must not run in parallel.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
