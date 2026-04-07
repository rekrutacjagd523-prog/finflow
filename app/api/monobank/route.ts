import { NextRequest, NextResponse } from 'next/server'

const MONO_BASE = 'https://api.monobank.ua'

// GET /api/monobank?action=client&token=xxx
// GET /api/monobank?action=statement&token=xxx&account=xxx&from=xxx&to=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    if (action === 'client') {
      const res = await fetch(`${MONO_BASE}/personal/client-info`, {
        headers: { 'X-Token': token },
      })
      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: err }, { status: res.status })
      }
      const data = await res.json()
      return NextResponse.json(data)
    }

    if (action === 'statement') {
      const account = searchParams.get('account')
      const from = searchParams.get('from')
      const to = searchParams.get('to')
      if (!account || !from) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

      const toParam = to ?? Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${MONO_BASE}/personal/statement/${account}/${from}/${toParam}`, {
        headers: { 'X-Token': token },
      })
      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: err }, { status: res.status })
      }
      const data = await res.json()
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
