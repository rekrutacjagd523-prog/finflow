import type { APIRequestContext } from '@playwright/test'

const PROJECT = 'demo-finflow'

export type Plain = string | number | boolean | null | Date | Plain[] | { [key: string]: Plain }
export type SeedFields = { [key: string]: Plain | undefined }

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } }

function firestoreHost(): string {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is not set (run inside firebase emulators:exec)')
  return host
}

function toValue(value: Plain): FirestoreValue {
  if (value === null) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: value.length > 0 ? { values: value.map(toValue) } : {} }
  return { mapValue: { fields: toFields(value) } }
}

function toFields(data: SeedFields): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) fields[key] = toValue(value)
  }
  return fields
}

/**
 * Creates a document on the Firestore emulator as admin (`Bearer owner` bypasses the security
 * rules). Test data only; `Date` becomes a Firestore Timestamp, numbers become doubles.
 */
export async function seedDoc(
  request: APIRequestContext,
  collectionPath: string,
  docId: string,
  data: SeedFields,
): Promise<void> {
  const url = `http://${firestoreHost()}/v1/projects/${PROJECT}/databases/(default)/documents/${collectionPath}?documentId=${encodeURIComponent(docId)}`
  const res = await request.post(url, {
    headers: { Authorization: 'Bearer owner' },
    data: { fields: toFields(data) },
  })
  if (!res.ok()) throw new Error(`seed ${collectionPath}/${docId} failed: ${res.status()} ${await res.text()}`)
}
