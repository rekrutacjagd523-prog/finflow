import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const API_ROOT = join(import.meta.dirname, '..', '..', '..', 'app', 'api')

// Routes that authenticate some other way (or are deliberately public). Each needs a reason.
const ALLOW_LIST: Record<string, string> = {
  'auth/session': 'verifies the freshly issued ID token itself and mints the session',
  'auth/logout': 'clears the session; must work with a missing or broken one',
  health: 'public liveness probe',
}

function routeFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...routeFiles(full))
    else if (entry === 'route.ts') found.push(full)
  }
  return found
}

function routeKey(file: string): string {
  return relative(API_ROOT, file).replace(/\\/g, '/').replace(/\/route\.ts$/, '')
}

describe('API route authentication coverage', () => {
  const files = routeFiles(API_ROOT)
  const keys = files.map(routeKey)

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(keys.filter((k) => !(k in ALLOW_LIST)))('%s calls requireUser or requireVerifiedUser', (key) => {
    const source = readFileSync(join(API_ROOT, key, 'route.ts'), 'utf8')
    expect(source).toMatch(/\brequire(Verified)?User\(/)
  })

  it('does not keep allow-list entries for routes that no longer exist', () => {
    for (const key of Object.keys(ALLOW_LIST)) {
      expect(keys, `allow-listed route ${key} does not exist`).toContain(key)
    }
  })

  it('no route still reads a Bearer token', () => {
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), routeKey(file)).not.toMatch(/Bearer \(|requireUserFromBearer/)
    }
  })
})
