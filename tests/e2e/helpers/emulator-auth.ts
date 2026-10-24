import type { APIRequestContext } from '@playwright/test'

const API_KEY = 'demo-api-key'
const PROJECT = 'demo-finflow'

/** The password of every user createEmulatorUser creates. */
export const EMULATOR_USER_PASSWORD = 'e2e-pass-123456'

function emulatorHost(): string {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (!host) throw new Error('FIREBASE_AUTH_EMULATOR_HOST is not set (run inside firebase emulators:exec)')
  return host
}

function identityToolkit(method: string): string {
  return `http://${emulatorHost()}/identitytoolkit.googleapis.com/v1/${method}?key=${API_KEY}`
}

async function ok(res: Awaited<ReturnType<APIRequestContext['post']>>, what: string): Promise<void> {
  if (!res.ok()) throw new Error(`${what} failed: ${res.status()} ${await res.text()}`)
}

/**
 * Marks the email verified the way a real user would: it applies the VERIFY_EMAIL code that the
 * Auth emulator recorded (the app requests one at sign-up; REST-created users get one from
 * createEmulatorUser). The ID token's `email_verified` claim does NOT change; only the user record does.
 */
export async function verifyEmailInEmulator(request: APIRequestContext, email: string): Promise<void> {
  const list = await request.get(`http://${emulatorHost()}/emulator/v1/projects/${PROJECT}/oobCodes`)
  await ok(list, 'list oob codes')
  const { oobCodes } = (await list.json()) as {
    oobCodes: { email: string; requestType: string; oobCode: string }[]
  }
  const match = [...oobCodes].reverse().find((c) => c.email === email && c.requestType === 'VERIFY_EMAIL')
  if (!match) throw new Error(`no VERIFY_EMAIL code recorded for ${email}`)
  await ok(await request.post(identityToolkit('accounts:update'), { data: { oobCode: match.oobCode } }), 'apply oob code')
}

/** Creates an Auth-emulator user (no organization) and returns a fresh ID token. */
export async function createEmulatorUser(
  request: APIRequestContext,
  opts: { verified?: boolean } = {},
): Promise<{ email: string; idToken: string }> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@finflow.test`
  const signUp = await request.post(identityToolkit('accounts:signUp'), {
    data: { email, password: EMULATOR_USER_PASSWORD, returnSecureToken: true },
  })
  await ok(signUp, 'signUp')
  const { idToken } = (await signUp.json()) as { idToken: string }

  if (opts.verified) {
    await ok(
      await request.post(identityToolkit('accounts:sendOobCode'), {
        data: { requestType: 'VERIFY_EMAIL', idToken },
      }),
      'sendOobCode',
    )
    await verifyEmailInEmulator(request, email)
  }
  return { email, idToken }
}

/** Signs an existing Auth-emulator user in over REST; returns the uid and a fresh ID token. */
export async function signInEmulatorUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ uid: string; idToken: string }> {
  const res = await request.post(identityToolkit('accounts:signInWithPassword'), {
    data: { email, password, returnSecureToken: true },
  })
  await ok(res, 'signInWithPassword')
  const { localId, idToken } = (await res.json()) as { localId: string; idToken: string }
  return { uid: localId, idToken }
}
