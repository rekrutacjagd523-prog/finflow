import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { initializeFirestore, type Firestore } from 'firebase-admin/firestore'
import { HttpError } from '@/lib/server/http-error'

type Admin = { db: Firestore; auth: Auth }

let cached: Admin | null = null

function createApp(): App {
  // Emulator (CI e2e, local emulators): firebase emulators:exec sets
  // FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST; the SDK talks to
  // them without credentials, it only needs a project id.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-finflow',
    })
  }

  // Production / preview: base64 of the service-account JSON downloaded from
  // Firebase Console (keeps the PEM newlines intact inside one env var).
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!encoded) {
    throw new HttpError(500, 'server not configured')
  }
  const serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  return initializeApp({ credential: cert(serviceAccount) })
}

/**
 * Lazily initialised firebase-admin singleton. Server-only.
 * getApps() lets a dev hot reload reuse the already-initialised default app.
 */
export function getAdmin(): { db: Firestore; auth: Auth } {
  if (cached) return cached
  const app = getApps()[0] ?? createApp()
  cached = {
    // Production: REST transport (no gRPC channel setup, faster serverless cold start).
    // Emulator: gRPC, because REST loads Application Default Credentials even there
    // and fails with "Could not load the default credentials".
    db: initializeFirestore(app, { preferRest: !process.env.FIRESTORE_EMULATOR_HOST }),
    auth: getAuth(app),
  }
  return cached
}
