'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/useAuth'
import { Building2, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface Institution {
  id: string
  name: string
  logo: string | null
}

interface YapilyConnection {
  institutionId: string
  institutionName: string
  consentToken: string
  connectedAt: string
}

interface Props {
  orgId: string
}

const STORAGE_KEY = (orgId: string) => `yapily_connections_${orgId}`

function loadConnections(orgId: string): YapilyConnection[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY(orgId)) ?? '[]')
  } catch {
    return []
  }
}

function saveConnections(orgId: string, conns: YapilyConnection[]) {
  localStorage.setItem(STORAGE_KEY(orgId), JSON.stringify(conns))
}

export default function YapilyConnect({ orgId }: Props) {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<YapilyConnection[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  // Load saved connections
  useEffect(() => {
    setConnections(loadConnections(orgId))
  }, [orgId])

  // Handle callback from Yapily
  useEffect(() => {
    const payload = searchParams.get('yapily_auth')
    if (!payload) return

    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
      const { consentToken, orgId: callbackOrgId } = JSON.parse(
        decodeURIComponent(atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
      ) as { consentToken: string; orgId: string }

      if (callbackOrgId !== orgId) return

      // Fetch account info to get institution name
      fetch(`/api/yapily/data?type=accounts&consentToken=${encodeURIComponent(consentToken)}`)
        .then((r) => r.json())
        .then((data) => {
          const firstAccount = data.accounts?.[0]
          const institutionId = firstAccount?.institutionId ?? 'unknown'
          const institutionName = firstAccount?.institutionName ?? firstAccount?.institutionId ?? 'Bank'

          const newConn: YapilyConnection = {
            institutionId,
            institutionName,
            consentToken,
            connectedAt: new Date().toISOString(),
          }

          const updated = [...loadConnections(orgId).filter((c) => c.institutionId !== institutionId), newConn]
          saveConnections(orgId, updated)
          setConnections(updated)
          toast.success(`${institutionName} підключено`)

          // Remove param from URL
          const url = new URL(window.location.href)
          url.searchParams.delete('yapily_auth')
          window.history.replaceState({}, '', url.toString())
        })
        .catch(() => toast.error('Не вдалось завантажити рахунки після підключення'))
    } catch {
      toast.error('Помилка обробки відповіді банку')
    }
  }, [searchParams, orgId])

  const handleShowPicker = async () => {
    if (institutions.length === 0) {
      setLoading(true)
      try {
        const res = await fetch('/api/yapily/institutions?country=PL')
        const data = await res.json()
        setInstitutions(data.institutions ?? [])
      } catch {
        toast.error('Не вдалось завантажити список банків')
      } finally {
        setLoading(false)
      }
    }
    setShowPicker((v) => !v)
  }

  const handleConnect = async (inst: Institution) => {
    if (!user) { toast.error('Потрібно авторизуватись'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/yapily/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: inst.id, orgId, userId: user.uid }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.authorisationUrl
    } catch (e) {
      toast.error('Помилка: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (conn: YapilyConnection) => {
    setSyncing(conn.institutionId)
    try {
      const accRes = await fetch(`/api/yapily/data?type=accounts&consentToken=${encodeURIComponent(conn.consentToken)}`)
      const accData = await accRes.json()
      if (accData.error) throw new Error(accData.error)
      toast.success(`Синхронізовано ${accData.accounts?.length ?? 0} рахунків`)
    } catch (e) {
      toast.error('Помилка синхронізації: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSyncing(null)
    }
  }

  const handleDisconnect = (institutionId: string) => {
    const updated = connections.filter((c) => c.institutionId !== institutionId)
    saveConnections(orgId, updated)
    setConnections(updated)
    toast.success('Банк відключено')
  }

  return (
    <div className="space-y-4">
      {/* Connected banks */}
      {connections.map((conn) => (
        <div key={conn.institutionId} className="flex items-center justify-between p-3 rounded-[8px] bg-[#f9fafb] border border-[#e5e7eb]">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#6b7280]" />
            <div>
              <p className="text-sm font-medium text-[#111111]">{conn.institutionName}</p>
              <p className="text-xs text-[#6b7280]">
                Підключено {new Date(conn.connectedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              disabled={syncing === conn.institutionId}
              onClick={() => handleSync(conn)}
            >
              <RefreshCw className={`w-4 h-4 ${syncing === conn.institutionId ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-red-500 hover:text-red-600"
              onClick={() => handleDisconnect(conn.institutionId)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}

      {/* Connect button */}
      <Button
        variant="outline"
        className="rounded-[8px] border-[#00c896] text-[#00c896] hover:bg-[#00c896]/5"
        onClick={handleShowPicker}
        disabled={loading}
      >
        {showPicker ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
        {loading ? 'Завантаження...' : 'Підключити банк'}
      </Button>

      {/* Institution picker */}
      {showPicker && institutions.length > 0 && (
        <div className="border border-[#e5e7eb] rounded-[8px] max-h-64 overflow-y-auto">
          {institutions.map((inst) => (
            <button
              key={inst.id}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f9fafb] transition-colors text-left border-b border-[#f3f4f6] last:border-0"
              onClick={() => handleConnect(inst)}
            >
              {inst.logo ? (
                <img src={inst.logo} alt={inst.name} className="w-6 h-6 object-contain rounded" />
              ) : (
                <Building2 className="w-6 h-6 text-[#6b7280]" />
              )}
              <span className="text-sm text-[#111111]">{inst.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
