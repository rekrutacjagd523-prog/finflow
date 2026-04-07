import { SignJWT, importPKCS8 } from 'jose'

export async function createJwt(): Promise<string> {
  const APP_ID = process.env.ENABLEBANKING_APP_ID!
  const PRIVATE_KEY_PEM = process.env.ENABLEBANKING_PRIVATE_KEY!.replace(/\\n/g, '\n')
  const privateKey = await importPKCS8(PRIVATE_KEY_PEM, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: APP_ID })
    .setIssuer(APP_ID)
    .setIssuedAt(now)
    .setAudience('api.enablebanking.com')
    .setExpirationTime(now + 3600)
    .sign(privateKey)
}
