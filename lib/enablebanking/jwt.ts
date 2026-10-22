import 'server-only'
import { SignJWT, importPKCS8 } from 'jose'

/**
 * Signs the short-lived RS256 JWT that authenticates FinFlow to the Enable Banking API.
 * Claims follow https://enablebanking.com/docs/api/reference/ ("JWT format and signature"):
 * header { typ: 'JWT', alg: 'RS256', kid: <application id> },
 * body { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat, exp } (TTL at most 24 h).
 * ENABLEBANKING_PRIVATE_KEY is a PKCS#8 PEM; literal "\n" sequences are turned into newlines
 * so the key can be stored as a single-line environment variable.
 */
export async function createJwt(): Promise<string> {
  const appId = process.env.ENABLEBANKING_APP_ID
  const rawKey = process.env.ENABLEBANKING_PRIVATE_KEY
  if (!appId || !rawKey) {
    throw new Error('Enable Banking is not configured: set ENABLEBANKING_APP_ID and ENABLEBANKING_PRIVATE_KEY')
  }
  const privateKey = await importPKCS8(rawKey.replace(/\\n/g, '\n'), 'RS256')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: appId })
    .setIssuer('enablebanking.com')
    .setIssuedAt(now)
    .setAudience('api.enablebanking.com')
    .setExpirationTime(now + 3600)
    .sign(privateKey)
}
