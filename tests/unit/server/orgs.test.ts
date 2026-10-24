import { describe, expect, it } from 'vitest'
import { HttpError } from '@/lib/server/http-error'
import { parseCreateOrgInput } from '@/lib/server/orgs'

describe('parseCreateOrgInput', () => {
  it('accepts a valid body and trims the name', () => {
    expect(parseCreateOrgInput({ name: '  Acme sp. z o.o.  ', currency: 'PLN' })).toEqual({
      name: 'Acme sp. z o.o.',
      currency: 'PLN',
    })
  })

  it.each(['PLN', 'EUR', 'USD', 'UAH'])('accepts currency %s', (currency) => {
    expect(parseCreateOrgInput({ name: 'A', currency }).currency).toBe(currency)
  })

  it('accepts a 120 character name and rejects 121', () => {
    expect(parseCreateOrgInput({ name: 'x'.repeat(120), currency: 'PLN' }).name).toHaveLength(120)
    expect(() => parseCreateOrgInput({ name: 'x'.repeat(121), currency: 'PLN' })).toThrow(HttpError)
  })

  it.each([
    ['not an object', 'x'],
    ['null', null],
    ['an array', []],
    ['no name', { currency: 'PLN' }],
    ['an empty name', { name: '', currency: 'PLN' }],
    ['a blank name', { name: '   ', currency: 'PLN' }],
    ['a non-string name', { name: 5, currency: 'PLN' }],
    ['no currency', { name: 'A' }],
    ['a currency outside the list', { name: 'A', currency: 'GBP' }],
    ['a lowercase currency', { name: 'A', currency: 'pln' }],
    ['an extra field', { name: 'A', currency: 'PLN', ownerId: 'someone' }],
    ['an extra plan field', { name: 'A', currency: 'PLN', plan: 'pro' }],
  ])('rejects %s with 400', (_label, body) => {
    const run = () => parseCreateOrgInput(body)
    expect(run).toThrow(HttpError)
    try {
      run()
    } catch (e) {
      expect((e as HttpError).status).toBe(400)
    }
  })

  it('rejects a __proto__ key', () => {
    expect(() => parseCreateOrgInput(JSON.parse('{"name":"A","currency":"PLN","__proto__":{"x":1}}'))).toThrow(HttpError)
  })
})
