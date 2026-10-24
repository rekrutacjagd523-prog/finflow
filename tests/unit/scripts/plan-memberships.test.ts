import { describe, expect, it } from 'vitest'
import { planMemberships } from '@/scripts/lib/plan-memberships.mjs'

describe('planMemberships', () => {
  it('turns every entry of the legacy members map into a membership', () => {
    const plan = planMemberships([
      { id: 'org1', data: { ownerId: 'u1', members: { u1: { role: 'owner' } } } },
      { id: 'org2', data: { ownerId: 'u2', members: { u2: { role: 'owner' }, u3: { role: 'owner' } } } },
    ])

    expect(plan.writes).toEqual([
      { orgId: 'org1', uid: 'u1', role: 'owner', addedBy: 'u1' },
      { orgId: 'org2', uid: 'u2', role: 'owner', addedBy: 'u2' },
      { orgId: 'org2', uid: 'u3', role: 'owner', addedBy: 'u2' },
    ])
    expect(plan.skipped).toEqual([])
  })

  it('keeps valid non-owner roles from the old map', () => {
    const plan = planMemberships([{ id: 'o', data: { ownerId: 'u1', members: { u1: { role: 'owner' }, u2: { role: 'viewer' }, u3: { role: 'accountant' } } } }])
    expect(plan.writes.map((w) => [w.uid, w.role])).toEqual([['u1', 'owner'], ['u2', 'viewer'], ['u3', 'accountant']])
  })

  it('an invalid role becomes owner only for the ownerId, otherwise the member is skipped', () => {
    const plan = planMemberships([{ id: 'o', data: { ownerId: 'u1', members: { u1: { role: 'admin' }, u2: { role: 'admin' }, u3: {} } } }])
    expect(plan.writes).toEqual([{ orgId: 'o', uid: 'u1', role: 'owner', addedBy: 'u1' }])
    expect(plan.skipped).toEqual([
      { orgId: 'o', uid: 'u2', reason: 'invalid_role' },
      { orgId: 'o', uid: 'u3', reason: 'invalid_role' },
    ])
  })

  it('addedBy falls back to the member uid when ownerId is missing', () => {
    const plan = planMemberships([{ id: 'o', data: { members: { u1: { role: 'owner' } } } }])
    expect(plan.writes[0].addedBy).toBe('u1')
  })

  it.each([
    ['no members field', { ownerId: 'u1' }],
    ['an empty members map', { ownerId: 'u1', members: {} }],
    ['a members array', { ownerId: 'u1', members: ['u1'] }],
    ['a null members field', { ownerId: 'u1', members: null }],
  ])('skips an organization with %s', (_label, data) => {
    const plan = planMemberships([{ id: 'o', data }])
    expect(plan.writes).toEqual([])
    expect(plan.skipped).toEqual([{ orgId: 'o', uid: null, reason: 'no_members_map' }])
  })

  it('skips member ids that are not usable document ids', () => {
    const plan = planMemberships([{ id: 'o', data: { ownerId: 'u1', members: { 'a/b': { role: 'owner' }, '': { role: 'owner' }, u1: { role: 'owner' } } } }])
    expect(plan.writes.map((w) => w.uid)).toEqual(['u1'])
    expect(plan.skipped.map((s) => s.reason)).toEqual(['invalid_uid', 'invalid_uid'])
  })

  it('is deterministic (the same input gives the same plan)', () => {
    const input = [{ id: 'o', data: { ownerId: 'u1', members: { u2: { role: 'viewer' }, u1: { role: 'owner' } } } }]
    expect(planMemberships(input)).toEqual(planMemberships(input))
  })
})
