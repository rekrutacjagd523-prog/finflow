import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'placeholder',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Local dev and CI e2e: use the Auth + Firestore emulators (ports from firebase.json).
// The guard lives on globalThis so that re-evaluating this module (Next.js HMR)
// does not connect a second time; the SDK throws if an already-started
// Firestore/Auth instance is pointed at an emulator again.
const emulatorGuard = globalThis as typeof globalThis & {
  __finflowFirebaseEmulatorsConnected?: boolean
}
if (
  process.env.NEXT_PUBLIC_USE_EMULATORS === '1' &&
  !emulatorGuard.__finflowFirebaseEmulatorsConnected
) {
  emulatorGuard.__finflowFirebaseEmulatorsConnected = true
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

export default app
