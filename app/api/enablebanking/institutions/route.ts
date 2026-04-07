import { NextRequest, NextResponse } from 'next/server'
import { createJwt } from '@/lib/enablebanking/jwt'

const BASE = 'https://api.enablebanking.com'

// GET /api/enablebanking/institutions?country=PL
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') ?? 'PL'
  try {
    const token = await createJwt()
    const res = await fetch(`${BASE}/aspsps?country=${country}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
    const data = await res.json()
    const institutions = (data.aspsps || []).map((b: { name: string; country: string; logo?: string; bic?: string }) => ({
      id: b.name,
      name: b.name,
      country: b.country,
      logo: b.logo ?? null,
      bic: b.bic ?? null,
    }))
    return NextResponse.json({ institutions })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
