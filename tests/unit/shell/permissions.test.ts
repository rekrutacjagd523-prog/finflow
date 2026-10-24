import { describe, expect, it } from 'vitest'
import { ROLES, can, isRole, type Action, type Role } from '@/lib/shell/permissions'

const ACTIONS: Action[] = ['data.write', 'bank.manage', 'company.edit', 'subscription.view']

// role -> actions it may perform
const MATRIX: Record<Role, Action[]> = {
  owner: ['data.write', 'bank.manage', 'company.edit', 'subscription.view'],
  accountant: ['data.write'],
  viewer: [],
}

describe('ROLES / isRole', () => {
  it('lists exactly the three roles', () => {
    expect([...ROLES]).toEqual(['owner', 'accountant', 'viewer'])
  })

  it.each(['owner', 'accountant', 'viewer'])('accepts %s', (role) => {
    expect(isRole(role)).toBe(true)
  })

  it.each([undefined, null, '', 'admin', 'editor', 'Owner', 1, {}, ['owner']])('rejects %s', (value) => {
    expect(isRole(value)).toBe(false)
  })
})

describe('can', () => {
  for (const role of ROLES) {
    for (const action of ACTIONS) {
      const allowed = MATRIX[role].includes(action)
      it(`${role} ${allowed ? 'can' : 'cannot'} ${action}`, () => {
        expect(can(role, action)).toBe(allowed)
      })
    }
  }

  it.each([null, undefined])('nobody (%s) can do anything', (role) => {
    for (const action of ACTIONS) expect(can(role, action)).toBe(false)
  })
})
