import { describe, expect, it, vi } from 'vitest'
import { HttpError, errorResponse } from '@/lib/server/http-error'

describe('HttpError', () => {
  it('carries an HTTP status and a message', () => {
    const err = new HttpError(403, 'forbidden')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(HttpError)
    expect(err.status).toBe(403)
    expect(err.message).toBe('forbidden')
    expect(err.name).toBe('HttpError')
  })
})

describe('errorResponse', () => {
  it('maps an HttpError to a JSON response with its status and message', async () => {
    const res = errorResponse(new HttpError(401, 'unauthorized'))
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })

  it('maps any other error to a generic 500 and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('db password is hunter2')
    const res = errorResponse(boom)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
    expect(log).toHaveBeenCalledWith(boom)
  })

  it('treats thrown non-Error values as internal errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = errorResponse('just a string')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
  })
})
