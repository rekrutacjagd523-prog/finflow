import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// `npm run ui:shots` (S01A): screenshots of the key screens for the visual review. Same dev server,
// env and browser as the e2e suite, its own test dir, so `npm run test:e2e` never runs it.
export default defineConfig({
  ...base,
  testDir: './tests/ui-shots',
  retries: 0,
  reporter: 'list',
})
