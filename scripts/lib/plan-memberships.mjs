// Pure planning for scripts/migrate-memberships.mjs (S02): which membership documents the legacy
// `organizations/{id}.members` maps imply. No I/O, no Firebase imports: unit-tested in Vitest.

const ROLES = ['owner', 'accountant', 'viewer']

/**
 * @param {Array<{ id: string, data: Record<string, unknown> }>} orgDocs
 * @returns {{ writes: Array<{orgId: string, uid: string, role: string, addedBy: string}>,
 *             skipped: Array<{orgId: string, uid: string | null, reason: string}> }}
 */
export function planMemberships(orgDocs) {
  const writes = []
  const skipped = []

  for (const { id: orgId, data } of orgDocs) {
    const members = data?.members
    if (typeof members !== 'object' || members === null || Array.isArray(members) || Object.keys(members).length === 0) {
      skipped.push({ orgId, uid: null, reason: 'no_members_map' })
      continue
    }
    const ownerId = typeof data.ownerId === 'string' && data.ownerId.length > 0 ? data.ownerId : null

    for (const uid of Object.keys(members)) {
      if (uid.length === 0 || uid.includes('/')) {
        skipped.push({ orgId, uid, reason: 'invalid_uid' })
        continue
      }
      const declared = members[uid]?.role
      const role = ROLES.includes(declared) ? declared : uid === ownerId ? 'owner' : null
      if (role === null) {
        skipped.push({ orgId, uid, reason: 'invalid_role' })
        continue
      }
      writes.push({ orgId, uid, role, addedBy: ownerId ?? uid })
    }
  }
  return { writes, skipped }
}
