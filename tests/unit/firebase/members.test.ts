import { describe, expect, it } from 'vitest'
import { roleFromMemberData } from '@/lib/firebase/members'

describe('roleFromMemberData', () => {
  it.each(['owner', 'accountant', 'viewer'])('returns %s', (role) => {
    expect(roleFromMemberData({ uid: 'u', role })).toBe(role)
  })

  it.each([undefined, null, 'owner', 5, [], {}, { role: 'admin' }, { role: '' }, { role: null }, { uid: 'u' }])(
    'returns null for %j',
    (data) => {
      expect(roleFromMemberData(data)).toBeNull()
    },
  )
})
