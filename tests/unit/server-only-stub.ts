// Test-only stand-in for the `server-only` package.
// The real package throws on import unless the bundler resolves the
// `react-server` export condition (Next.js does; Vitest does not).
// vitest.config.ts aliases `server-only` to this empty module.
export {}
