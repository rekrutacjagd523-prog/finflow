import { SignJWT, importPKCS8 } from 'jose'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function createJwt(): Promise<string> {
  let APP_ID: string
  let PRIVATE_KEY_PEM: string

  try {
    const { env } = await getCloudflareContext({ async: true })
    APP_ID = (env as Record<string, string>).ENABLEBANKING_APP_ID ?? process.env.ENABLEBANKING_APP_ID!
    const raw = (env as Record<string, string>).ENABLEBANKING_PRIVATE_KEY ?? process.env.ENABLEBANKING_PRIVATE_KEY!
    PRIVATE_KEY_PEM = raw.replace(/\\n/g, '\n')
  } catch {
    APP_ID = process.env.ENABLEBANKING_APP_ID!
    PRIVATE_KEY_PEM = process.env.ENABLEBANKING_PRIVATE_KEY!.replace(/\\n/g, '\n')
  }
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
