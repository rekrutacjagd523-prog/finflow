import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { initializeFirestore, type Firestore } from 'firebase-admin/firestore'
import { HttpError } from '@/lib/server/http-error'

type Admin = { db: Firestore; auth: Auth }

let cached: Admin | null = null

function notConfigured(): HttpError {
  return new HttpError(500, 'server not configured')
}

function createApp(): App {
  const emulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST,
  )

  // With FIREBASE_AUTH_EMULATOR_HOST set, firebase-admin's verifyIdToken accepts
  // unsigned (alg "none") tokens. A leaked emulator variable on a deployed
  // server would therefore be an authentication bypass: refuse to start.
  if (emulator && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
    console.error('firebase-admin: emulator host set in a deployed environment; refusing')
    throw notConfigured()
  }

  // Emulator (CI e2e, local emulators): firebase emulators:exec sets
  // FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST; the SDK talks to
  // them without credentials, it only needs a project id.
  if (emulator) {
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-finflow',
    })
  }

  // Production / preview: base64 of the service-account JSON downloaded from
  // Firebase Console (keeps the PEM newlines intact inside one env var).
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!encoded) {
    throw notConfigured()
  }
  let credential: ReturnType<typeof cert>
  try {
    const serviceAccount: unknown = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
    credential = cert(serviceAccount as Parameters<typeof cert>[0])
  } catch {
    // Fixed message on purpose: the original error can quote the secret.
    console.error('firebase-admin: FIREBASE_SERVICE_ACCOUNT is not a valid base64 service account')
    throw notConfigured()
  }
  return initializeApp({ credential })
}

/**
 * Lazily initialised firebase-admin singleton. Server-only.
 * getApps() lets a dev hot reload reuse the already-initialised default app.
 */
export function getAdmin(): { db: Firestore; auth: Auth } {
  if (cached) return cached
  const app = getApps().find((a) => a.name === '[DEFAULT]') ?? createApp()
  cached = {
    // Production: REST transport (no gRPC channel setup, faster serverless cold start).
    // Emulator: gRPC, because REST loads Application Default Credentials even there
    // and fails with "Could not load the default credentials".
    db: initializeFirestore(app, { preferRest: !process.env.FIRESTORE_EMULATOR_HOST }),
    auth: getAuth(app),
  }
  return cached
}
