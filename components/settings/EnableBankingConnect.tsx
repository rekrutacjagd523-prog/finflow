'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Building2, RefreshCw, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Institution {
  id: string
  name: string
  country: string
  logo: string | null
}

interface EbConnection {
  sessionId: string
  institutionName: string
  connectedAt: string
}

interface Props {
  orgId: string
}

const STORAGE_KEY = (orgId: string) => `eb_connections_${orgId}`

function loadConnections(orgId: string): EbConnection[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(orgId)) ?? '[]') } catch { return [] }
}
function saveConnections(orgId: string, conns: EbConnection[]) {
  localStorage.setItem(STORAGE_KEY(orgId), JSON.stringify(conns))
}

const COUNTRIES = [
  { code: 'PL', name: '🇵🇱 Польща' },
  { code: 'DE', name: '🇩🇪 Німеччина' },
  { code: 'GB', name: '🇬🇧 Велика Британія' },
  { code: 'FR', name: '🇫🇷 Франція' },
  { code: 'NL', name: '🇳🇱 Нідерланди' },
  { code: 'LT', name: '🇱🇹 Литва' },
  { code: 'UA', name: '🇺🇦 Україна' },
]

export default function EnableBankingConnect({ orgId }: Props) {
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<EbConnection[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [country, setCountry] = useState('PL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => { setConnections(loadConnections(orgId)) }, [orgId])

  // Handle callback
  useEffect(() => {
    const payload = searchParams.get('eb_auth')
    if (!payload) return
    try {
      const { sessionId } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      if (!sessionId) return
      const pending = JSON.parse(sessionStorage.getItem('eb_pending') ?? '{}')
      const newConn: EbConnection = {
        sessionId,
        institutionName: pending.name ?? 'Банк',
        connectedAt: new Date().toISOString(),
      }
      const updated = [...loadConnections(orgId).filter(c => c.sessionId !== sessionId), newConn]
      saveConnections(orgId, updated)
      setConnections(updated)
      sessionStorage.removeItem('eb_pending')
      toast.success(`${newConn.institutionName} підключено`)
      const url = new URL(window.location.href)
      url.searchParams.delete('eb_auth')
      window.history.replaceState({}, '', url.toString())
    } catch { toast.error('Помилка підключення банку') }
  }, [searchParams, orgId])

  const loadInstitutions = async (c: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/enablebanking/institutions?country=${c}`)
      const data = await res.json()
      setInstitutions(data.institutions ?? [])
    } catch { toast.error('Не вдалось завантажити банки') }
    finally { setLoading(false) }
  }

  const handleShowPicker = async () => {
    if (!showPicker) await loadInstitutions(country)
    setShowPicker(v => !v)
  }

  const handleCountryChange = async (c: string) => {
    setCountry(c)
    await loadInstitutions(c)
  }

  const handleConnect = async (inst: Institution) => {
    setConnecting(true)
    try {
      const res = await fetch('/api/enablebanking/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspspName: inst.id, country: inst.country, orgId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      sessionStorage.setItem('eb_pending', JSON.stringify({ name: inst.name, authorizationId: data.authorizationId }))
      window.location.href = data.url
    } catch (e) {
      toast.error('Помилка: ' + (e instanceof Error ? e.message : String(e)))
      setConnecting(false)
    }
  }

  const handleDisconnect = (sessionId: string) => {
    const updated = connections.filter(c => c.sessionId !== sessionId)
    saveConnections(orgId, updated)
    setConnections(updated)
    toast.success('Банк відключено')
  }

  const filtered = institutions.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      {connections.map(conn => (
        <div key={conn.sessionId} className="flex items-center justify-between p-3 rounded-[8px] bg-[#f9fafb] border border-[#e5e7eb]">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#6b7280]" />
            <div>
              <p className="text-sm font-medium text-[#111111]">{conn.institutionName}</p>
              <p className="text-xs text-[#6b7280]">Підключено {new Date(conn.connectedAt).toLocaleDateString()}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 hover:text-red-600"
            onClick={() => handleDisconnect(conn.sessionId)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" className="rounded-[8px] border-[#00c896] text-[#00c896] hover:bg-[#00c896]/5"
        onClick={handleShowPicker} disabled={loading || connecting}>
        {showPicker ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
        {connecting ? 'Перенаправлення...' : loading ? 'Завантаження...' : 'Підключити банк'}
      </Button>

      {showPicker && (
        <div className="border border-[#e5e7eb] rounded-[8px] p-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {COUNTRIES.map(c => (
              <button key={c.code} onClick={() => handleCountryChange(c.code)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${country === c.code ? 'bg-[#00c896] text-white border-[#00c896]' : 'border-[#e5e7eb] text-[#6b7280] hover:border-[#00c896]'}`}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Пошук банку..." className="pl-8 text-sm rounded-[6px] border-[#e5e7eb]" />
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-[#00c896]" />
              <span className="text-sm text-[#6b7280]">Завантаження...</span>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-[#9ca3af] text-center py-4">Банків не знайдено</p>
              ) : filtered.map(inst => (
                <button key={inst.id} onClick={() => handleConnect(inst)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] hover:border-[#00c896] hover:bg-[#f0fdf9] transition-all text-left">
                  {inst.logo
                    ? <img src={inst.logo} alt={inst.name} className="w-7 h-7 rounded object-contain" />
                    : <div className="w-7 h-7 rounded bg-[#f3f4f6] flex items-center justify-center text-xs font-bold text-[#6b7280]">{inst.name[0]}</div>
                  }
                  <span className="text-sm text-[#111111] flex-1">{inst.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
