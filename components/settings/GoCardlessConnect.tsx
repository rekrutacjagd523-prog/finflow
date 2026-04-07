'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, Trash2, Plus, Search, CheckCircle2, Clock, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getGcConnections,
  createGcConnection,
  updateGcConnection,
  deleteGcConnection,
  fetchInstitutions,
  createRequisition,
  fetchRequisition,
  fetchAccountDetails,
  fetchAccountBalances,
  fetchAccountTransactions,
  type GcConnection,
  type GcInstitution,
  type GcAccount,
} from '@/lib/firebase/gocardlessConnections'
import { createTransaction } from '@/lib/firebase/transactions'
import { getAccounts, createAccount } from '@/lib/firebase/accounts'
import type { Account } from '@/types'

interface Props {
  orgId: string
}

const COUNTRIES = [
  { code: 'PL', name: 'Польща' },
  { code: 'DE', name: 'Німеччина' },
  { code: 'FR', name: 'Франція' },
  { code: 'GB', name: 'Велика Британія' },
  { code: 'NL', name: 'Нідерланди' },
  { code: 'IT', name: 'Італія' },
  { code: 'ES', name: 'Іспанія' },
  { code: 'AT', name: 'Австрія' },
  { code: 'BE', name: 'Бельгія' },
  { code: 'CZ', name: 'Чехія' },
  { code: 'SK', name: 'Словаччина' },
  { code: 'HU', name: 'Угорщина' },
  { code: 'RO', name: 'Румунія' },
  { code: 'LT', name: 'Литва' },
  { code: 'LV', name: 'Латвія' },
  { code: 'EE', name: 'Естонія' },
]

const INITIAL_SYNC_DAYS = 90

function timeAgo(date: Date | null): string {
  if (!date) return 'Ніколи'
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Щойно'
  if (mins < 60) return `${mins} хв тому`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} год тому`
  return `${Math.floor(hrs / 24)} дн тому`
}

function statusBadge(status: GcConnection['status']) {
  if (status === 'linked') return <CheckCircle2 className="w-3.5 h-3.5 text-[#00c896]" />
  if (status === 'expired') return <span className="text-xs text-[#ef4444]">Протермінований</span>
  return <Clock className="w-3.5 h-3.5 text-[#f59e0b]" />
}

// ─── Step components ──────────────────────────────────────────────────────────

function CountryStep({
  onSelect,
}: {
  onSelect: (code: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#111111] mb-3">Оберіть країну банку</p>
      <div className="grid grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e5e7eb] hover:border-[#00c896] hover:bg-[#f0fdf9] text-sm text-left transition-all"
          >
            <span className="text-base">{countryFlag(c.code)}</span>
            <span className="text-[#111111]">{c.name}</span>
            <span className="ml-auto text-[#9ca3af] text-xs">{c.code}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function countryFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

function BankStep({
  country,
  onSelect,
  onBack,
}: {
  country: string
  onSelect: (inst: GcInstitution) => void
  onBack: () => void
}) {
  const [institutions, setInstitutions] = useState<GcInstitution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchInstitutions(country)
      .then(setInstitutions)
      .catch(() => toast.error('Помилка завантаження банків'))
      .finally(() => setLoading(false))
  }, [country])

  const filtered = institutions.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-[#6b7280] hover:text-[#111111] transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-medium text-[#111111]">
          Оберіть банк {countryFlag(country)}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук банку..."
          className="pl-8 text-sm rounded-[6px] border-[#e5e7eb]"
          autoFocus
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-4 h-4 animate-spin text-[#00c896]" />
          <span className="ml-2 text-sm text-[#6b7280]">Завантаження...</span>
        </div>
      ) : (
        <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-[#9ca3af] text-center py-4">Банків не знайдено</p>
          ) : (
            filtered.map((inst) => (
              <button
                key={inst.id}
                onClick={() => onSelect(inst)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#e5e7eb] hover:border-[#00c896] hover:bg-[#f0fdf9] transition-all text-left"
              >
                {inst.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inst.logo} alt={inst.name} className="w-7 h-7 rounded object-contain" />
                ) : (
                  <div className="w-7 h-7 rounded bg-[#f3f4f6] flex items-center justify-center text-xs font-bold text-[#6b7280]">
                    {inst.name[0]}
                  </div>
                )}
                <span className="text-sm text-[#111111] flex-1 truncate">{inst.name}</span>
                {inst.bic && <span className="text-xs text-[#9ca3af]">{inst.bic}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GoCardlessConnect({ orgId }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [connections, setConnections] = useState<GcConnection[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState<'country' | 'bank'>('country')
  const [country, setCountry] = useState('')
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    const unsub1 = getGcConnections(orgId, setConnections)
    const unsub2 = getAccounts(orgId, setAccounts)
    return () => { unsub1(); unsub2() }
  }, [orgId])

  // Handle redirect back from bank authorization
  const handleRequisitionCallback = useCallback(async (requisitionId: string) => {
    // Remove query params from URL
    router.replace(pathname)

    try {
      const req = await fetchRequisition(requisitionId)

      if (req.status !== 'LN' || !req.accounts?.length) {
        toast.error('Авторизація не завершена або рахунки відсутні')
        return
      }

      // Fetch details for each account
      const gcAccounts: GcAccount[] = []
      for (const accountId of req.accounts) {
        try {
          const [detailsRes, balancesRes] = await Promise.all([
            fetchAccountDetails(accountId),
            fetchAccountBalances(accountId),
          ])
          const details = detailsRes.account
          const balanceEntry = balancesRes.balances?.find(
            (b) => b.balanceType === 'interimAvailable' || b.balanceType === 'closingBooked'
          )
          gcAccounts.push({
            id: accountId,
            iban: details.iban ?? '',
            currency: details.currency ?? 'PLN',
            name: details.name ?? details.ownerName ?? details.product ?? 'Рахунок',
            product: details.product,
            balance: balanceEntry ? parseFloat(balanceEntry.balanceAmount.amount) : 0,
          })
        } catch {
          // Skip account if details fail
        }
      }

      // Find existing pending connection by requisitionId
      const existing = connections.find((c) => c.requisitionId === requisitionId)
      if (existing) {
        await updateGcConnection(orgId, existing.id, {
          status: 'linked',
          accounts: gcAccounts,
        })
        toast.success(`Підключено: ${existing.institutionName} (${gcAccounts.length} рахунків)`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка підключення')
    }
  }, [orgId, connections, router, pathname])

  useEffect(() => {
    const ref = searchParams.get('gc_ref')
    if (ref) handleRequisitionCallback(ref)
  }, [searchParams, handleRequisitionCallback])

  const handleSelectBank = async (inst: GcInstitution) => {
    setConnecting(true)
    try {
      const reference = crypto.randomUUID()
      const redirectUrl = `${window.location.origin}${pathname}?gc_ref=${reference}`

      const requisition = await createRequisition(inst.id, redirectUrl, reference)

      // Save pending connection before redirect
      await createGcConnection(orgId, {
        requisitionId: requisition.id,
        institutionId: inst.id,
        institutionName: inst.name,
        institutionLogo: inst.logo ?? '',
        accounts: [],
        status: 'pending',
      })

      setShowForm(false)
      // Open bank auth in same tab
      window.location.href = requisition.link
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка підключення')
      setConnecting(false)
    }
  }

  const handleSync = async (conn: GcConnection) => {
    setSyncingId(conn.id)
    let imported = 0
    let skipped = 0

    try {
      const dateFrom = conn.lastSyncAt
        ? conn.lastSyncAt.toISOString().split('T')[0]
        : new Date(Date.now() - INITIAL_SYNC_DAYS * 86400_000).toISOString().split('T')[0]

      for (const gcAcc of conn.accounts) {
        // Find or create matching FinFlow account
        const label = `${conn.institutionName} ${gcAcc.currency}${gcAcc.iban ? ' ···' + gcAcc.iban.slice(-4) : ''}`
        let ffAccount = accounts.find(
          (a) => (a as Account & { gcAccountId?: string }).gcAccountId === gcAcc.id
            || a.name === label
        )

        if (!ffAccount) {
          const id = await createAccount(orgId, {
            name: label,
            type: 'bank',
            balance: gcAcc.balance ?? 0,
            currency: gcAcc.currency,
            color: '#6366f1',
          })
          ffAccount = {
            id, orgId, name: label, type: 'bank',
            balance: gcAcc.balance ?? 0, currency: gcAcc.currency, color: '#6366f1',
          }
          setAccounts((prev) => [...prev, ffAccount!])
        }

        // Fetch transactions
        let txRes: { transactions: { booked: ReturnType<typeof Array>[0][] } }
        try {
          txRes = await fetchAccountTransactions(gcAcc.id, dateFrom) as typeof txRes
        } catch {
          continue
        }

        for (const tx of (txRes.transactions?.booked ?? [])) {
          const raw = tx as {
            transactionAmount: { amount: string; currency: string }
            remittanceInformationUnstructured?: string
            remittanceInformationStructured?: string
            creditorName?: string
            debtorName?: string
            bookingDate: string
          }
          const amount = parseFloat(raw.transactionAmount.amount)
          if (isNaN(amount)) { skipped++; continue }

          const type = amount >= 0 ? 'income' : 'expense'
          const absAmount = Math.abs(amount)
          const description = raw.remittanceInformationUnstructured
            ?? raw.remittanceInformationStructured
            ?? (type === 'income' ? raw.debtorName : raw.creditorName)
            ?? ''

          try {
            await createTransaction(orgId, {
              type,
              accountId: ffAccount.id,
              amount: absAmount,
              currency: raw.transactionAmount.currency,
              date: new Date(raw.bookingDate),
              description,
              isRecurring: false,
              tags: [],
              fileUrls: [],
            })
            imported++
          } catch {
            skipped++
          }
        }
      }

      await updateGcConnection(orgId, conn.id, { lastSyncAt: new Date() })
      toast.success(`Синхронізовано: ${imported} транзакцій${skipped ? `, пропущено ${skipped}` : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка синхронізації')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (conn: GcConnection) => {
    if (!confirm(`Видалити підключення "${conn.institutionName}"?`)) return
    await deleteGcConnection(orgId, conn.id)
    toast.success('Підключення видалено')
  }

  return (
    <div className="space-y-4">
      {/* Connected banks */}
      {connections.map((conn) => (
        <div key={conn.id} className="flex items-center gap-3 p-4 rounded-xl border border-[#e5e7eb] bg-white">
          {conn.institutionLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={conn.institutionLogo}
              alt={conn.institutionName}
              className="w-10 h-10 rounded-xl object-contain border border-[#f3f4f6]"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#6366f1] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">{conn.institutionName[0]}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[#111111]">{conn.institutionName}</p>
              {statusBadge(conn.status)}
            </div>
            <p className="text-xs text-[#9ca3af]">
              {conn.accounts.length > 0
                ? `${conn.accounts.length} рахунків · Синхр: ${timeAgo(conn.lastSyncAt)}`
                : 'Очікує авторизації...'
              }
            </p>
            {conn.accounts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {conn.accounts.map((acc) => (
                  <span
                    key={acc.id}
                    className="text-xs px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]"
                  >
                    {acc.currency}{acc.iban ? ` ···${acc.iban.slice(-4)}` : ''}{acc.balance !== undefined ? ` · ${acc.balance.toFixed(2)}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {conn.status === 'linked' && (
              <button
                onClick={() => handleSync(conn)}
                disabled={syncingId === conn.id}
                className="flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#111111] border border-[#e5e7eb] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingId === conn.id ? 'animate-spin' : ''}`} />
                {syncingId === conn.id ? 'Синхр...' : 'Синхронізувати'}
              </button>
            )}
            <button
              onClick={() => handleDelete(conn)}
              className="p-1.5 text-[#9ca3af] hover:text-[#ef4444] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Add connection form */}
      {showForm ? (
        <div className="p-4 rounded-xl border border-[#6366f1] bg-[#f5f3ff] space-y-3">
          {step === 'country' ? (
            <CountryStep
              onSelect={(code) => { setCountry(code); setStep('bank') }}
            />
          ) : (
            <BankStep
              country={country}
              onSelect={handleSelectBank}
              onBack={() => setStep('country')}
            />
          )}
          {!connecting && (
            <button
              onClick={() => { setShowForm(false); setStep('country') }}
              className="text-xs text-[#6b7280] hover:text-[#111111] mt-1"
            >
              Скасувати
            </button>
          )}
          {connecting && (
            <div className="flex items-center gap-2 text-xs text-[#6b7280]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Перенаправлення до банку...
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => { setShowForm(true); setStep('country') }}
          className="flex items-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-[#e5e7eb] hover:border-[#6366f1] hover:bg-[#f5f3ff] text-[#6b7280] hover:text-[#6366f1] transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Підключити банк (GoCardless · 2500+ банків)
        </button>
      )}
    </div>
  )
}
