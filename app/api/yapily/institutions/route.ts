import { NextRequest, NextResponse } from 'next/server'

const YAPILY_BASE = 'https://api.yapily.com'

function basicAuth() {
  const creds = `${process.env.YAPILY_APPLICATION_UUID}:${process.env.YAPILY_SECRET}`
  return 'Basic ' + Buffer.from(creds).toString('base64')
}

// GET /api/yapily/institutions?country=PL
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') ?? 'PL'

  const res = await fetch(
    `${YAPILY_BASE}/institutions?${new URLSearchParams({ country })}`,
    { headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' } }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  // Return simplified list
  const institutions = (data.data ?? []).map((inst: {
    id: string
    name: string
    media?: Array<{ source: string; type: string }>
    countries?: Array<{ countryCode2: string }>
  }) => ({
    id: inst.id,
    name: inst.name,
    logo: inst.media?.find((m) => m.type === 'icon')?.source ?? null,
    countries: inst.countries?.map((c) => c.countryCode2) ?? [],
  }))

  // Yapily sandbox fallback — used when no institutions are registered yet
  // (Direct customers need TPP registration; sandbox accounts use these test banks)
  const sandboxFallback = [
    { id: 'modelo-sandbox', name: 'Modelo Sandbox Bank', logo: null },
    { id: 'monzo-sandbox', name: 'Monzo Sandbox', logo: null },
    { id: 'lloyds-sandbox', name: 'Lloyds Sandbox', logo: null },
  ]

  return NextResponse.json({ institutions: institutions.length > 0 ? institutions : sandboxFallback })
}
