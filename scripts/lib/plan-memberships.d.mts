export interface PlannedMembership {
  orgId: string
  uid: string
  role: 'owner' | 'accountant' | 'viewer'
  addedBy: string
}
export interface SkippedMembership {
  orgId: string
  uid: string | null
  reason: 'no_members_map' | 'invalid_uid' | 'invalid_role'
}
export function planMemberships(orgDocs: Array<{ id: string; data: Record<string, unknown> }>): {
  writes: PlannedMembership[]
  skipped: SkippedMembership[]
}
