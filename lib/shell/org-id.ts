// Company ids that arrive from the URL. Same allow-list as the server (lib/server/auth.ts): a Firestore
// document id without slashes or dots, at most 128 characters, and not a reserved `__.*__` id.
// Pure and import-free: the shell uses it to refuse a malformed id before any Firestore call.

const ORG_ID = /^[A-Za-z0-9_-]{1,128}$/
const RESERVED_ID = /^__.*__$/

export function isValidOrgId(value: unknown): value is string {
  return typeof value === 'string' && ORG_ID.test(value) && !RESERVED_ID.test(value)
}
