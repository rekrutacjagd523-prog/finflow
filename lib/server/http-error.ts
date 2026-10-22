/**
 * An error that maps 1:1 onto an HTTP response.
 * Throw it from server code; route handlers turn it into JSON via errorResponse().
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Converts anything thrown inside a route handler into a JSON Response.
 * HttpError -> { error: message } with its status.
 * Anything else -> logged server-side, client gets a generic 500 (no internals leak).
 */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status })
  }
  console.error(e)
  return Response.json({ error: 'internal' }, { status: 500 })
}
