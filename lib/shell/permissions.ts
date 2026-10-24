// Roles and what they may do (S02). Pure and import-free: used by the browser UI and by server code.
// This is a convenience layer for the UI; the real protection is firestore.rules and requireOrgRole.

export const ROLES = ['owner', 'accountant', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export type Action =
  | 'data.write' // accounts, categories, transactions
  | 'bank.manage' // bank connections
  | 'company.edit' // company name and currency
  | 'subscription.view' // plan and billing

const ALLOWED: Record<Action, readonly Role[]> = {
  'data.write': ['owner', 'accountant'],
  'bank.manage': ['owner'],
  'company.edit': ['owner'],
  'subscription.view': ['owner'],
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** `role` is null/undefined while it is unknown (loading) or when the user has no membership: nothing is allowed. */
export function can(role: Role | null | undefined, action: Action): boolean {
  return role != null && ALLOWED[action].includes(role)
}
