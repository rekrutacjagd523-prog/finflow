/**
 * An error that maps 1:1 onto an HTTP response.
 * Throw it from server code; route handlers turn it into JSON via errorResponse().
 *
 * `status` is normalized: anything that is not an integer in 400-599 becomes 500, so a bad
 * status can never make `Response.json` throw a RangeError inside an error handler.
 */
export class HttpError extends Error {
  public readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500
  }
}

/**
 * Converts anything thrown inside a route handler into a JSON Response.
 * HttpError -> { error: message } with its status.
 * Anything else -> logged server-side (name, message, stack only: the error object itself may
 * carry request headers or tokens), client gets a generic 500 (no internals leak).
 */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status })
  }
  if (e instanceof Error) {
    console.error('unhandled error', { name: e.name, message: e.message, stack: e.stack })
  } else {
    console.error('unhandled error', { name: 'NonError', message: String(e) })
  }
  return Response.json({ error: 'internal' }, { status: 500 })
}
