'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, Trash2, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  getTlConnections,
  createTlConnection,
  updateTlConnection,
  deleteTlConnection,
  fetchTlAccounts,
  fetchTlBalance,
  fetchTlTransactions,
  refreshTlToken,
  type TlConnection,
  type TlAccount,
} from '@/lib/firebase/truelayerConnections'
import { createTransaction } from '@/lib/firebase/transactions'
import { getAccounts, createAccount } from '@/lib/firebase/accounts'
import type { Account } from '@/types'

interface Props {
  orgId: string
}

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

async function ensureValidToken(conn: TlConnection): Promise<{
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date
  refreshed: boolean
}> {
  const buffer = 5 * 60 * 1000 // 5 min
  if (conn.tokenExpiresAt.getTime() - Date.now() > buffer) {
    return { accessToken: conn.accessToken, refreshToken: conn.refreshToken, tokenExpiresAt: conn.tokenExpiresAt, refreshed: false }
  }
  const tokens = await refreshTlToken(conn.refreshToken)
  const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000)
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenExpiresAt, refreshed: true }
}

export default function TrueLayerConnect({ orgId }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [connections, setConnections] = useState<TlConnection[]>([])
  const [localAccounts, setLocalAccounts] = useState<Account[]>([])
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [processingAuth, setProcessingAuth] = useState(false)

  useEffect(() => {
    const unsub1 = getTlConnections(orgId, setConnections)
    const unsub2 = getAccounts(orgId, setLocalAccounts)
    return () => { unsub1(); unsub2() }
  }, [orgId])

  // Handle redirect back from TrueLayer
  const handleTlAuth = useCallback(async (encoded: string) => {
    setProcessingAuth(true)
    router.replace(pathname)

    try {
      // Decode base64url without Node.js Buffer (browser-safe)
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
      const payload = JSON.parse(atob(padded)) as {
        accessToken: string
        refreshToken: string
        expiresIn: number
        orgId: string
        providerName: string
      }

      if (payload.orgId !== orgId) {
        toast.error('Невірний orgId в авторизації')
        return
      }

      const tokenExpiresAt = new Date(Date.now() + payload.expiresIn * 1000)

      // Fetch accounts from TrueLayer
      const accData = await fetchTlAccounts(payload.accessToken)
      const tlAccounts: TlAccount[] = []

      for (const acc of accData.results ?? []) {
        let balance = 0
        try {
          const balData = await fetchTlBalance(payload.accessToken, acc.account_id)
          balance = balData.results?.[0]?.current ?? 0
        } catch {
          // balance optional
        }

        tlAccounts.push({
          accountId: acc.account_id,
          displayName: acc.display_name ?? acc.account_type ?? 'Рахунок',
          currency: acc.currency ?? 'EUR',
          accountType: acc.account_type ?? 'TRANSACTION',
          iban: acc.account_number?.iban,
          balance,
        })
      }

      const providerName = accData.results?.[0]?.provider?.display_name ?? payload.providerName ?? 'Bank'

      await createTlConnection(orgId, {
        providerName,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        tokenExpiresAt,
        accounts: tlAccounts,
      })

      toast.success(`Підключено: ${providerName} (${tlAccounts.length} рахунків)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка підключення')
    } finally {
      setProcessingAuth(false)
    }
  }, [orgId, router, pathname])

  useEffect(() => {
    const tlAuth = searchParams.get('tl_auth')
    const tlError = searchParams.get('tl_error')
    if (tlAuth) handleTlAuth(tlAuth)
    if (tlError) {
      toast.error(`TrueLayer: ${decodeURIComponent(tlError)}`)
      router.replace(pathname)
    }
  }, [searchParams, handleTlAuth, router, pathname])

  const handleConnect = () => {
    window.location.href = `/api/truelayer/connect?orgId=${orgId}`
  }

  const handleSync = async (conn: TlConnection) => {
    setSyncingId(conn.id)
    let imported = 0
    let skipped = 0

    try {
      // Refresh token if needed
      const tokens = await ensureValidToken(conn)
      if (tokens.refreshed) {
        await updateTlConnection(orgId, conn.id, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.tokenExpiresAt,
        })
      }

      const fromDate = conn.lastSyncAt
        ? conn.lastSyncAt.toISOString()
        : new Date(Date.now() - INITIAL_SYNC_DAYS * 86400_000).toISOString()

      for (const tlAcc of conn.accounts) {
        // Find or create matching FinFlow account
        const label = `${conn.providerName} ${tlAcc.currency}${tlAcc.iban ? ' ···' + tlAcc.iban.slice(-4) : ''}`
        let ffAccount = localAccounts.find(
          (a) => (a as Account & { tlAccountId?: string }).tlAccountId === tlAcc.accountId
            || a.name === label
        )

        if (!ffAccount) {
          const id = await createAccount(orgId, {
            name: label,
            type: 'bank',
            balance: tlAcc.balance ?? 0,
            currency: tlAcc.currency,
            color: '#6366f1',
          })
          ffAccount = {
            id, orgId, name: label, type: 'bank',
            balance: tlAcc.balance ?? 0, currency: tlAcc.currency, color: '#6366f1',
          }
          setLocalAccounts((prev) => [...prev, ffAccount!])
        }

        // Fetch transactions
        let txData: { results: Array<{ amount: number; currency: string; description: string; timestamp: string; transaction_type: string; merchant_name?: string }> }
        try {
          txData = await fetchTlTransactions(tokens.accessToken, tlAcc.accountId, fromDate) as typeof txData
        } catch {
          continue
        }

        for (const tx of txData.results ?? []) {
          const amount = Math.abs(tx.amount)
          // TrueLayer: negative = debit (expense), positive = credit (income)
          const type = tx.transaction_type === 'CREDIT' ? 'income' : 'expense'
          const description = tx.merchant_name ?? tx.description ?? ''

          try {
            await createTransaction(orgId, {
              type,
              accountId: ffAccount.id,
              amount,
              currency: tx.currency,
              date: new Date(tx.timestamp),
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

      await updateTlConnection(orgId, conn.id, { lastSyncAt: new Date() })
      toast.success(`Синхронізовано: ${imported} транзакцій${skipped ? `, пропущено ${skipped}` : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка синхронізації')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (conn: TlConnection) => {
    if (!confirm(`Видалити підключення "${conn.providerName}"?`)) return
    await deleteTlConnection(orgId, conn.id)
    toast.success('Підключення видалено')
  }

  return (
    <div className="space-y-4">
      {processingAuth && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#f0fdf9] border border-[#00c896] text-sm text-[#111111]">
          <RefreshCw className="w-4 h-4 animate-spin text-[#00c896]" />
          Отримуємо дані з банку...
        </div>
      )}

      {/* Connected banks */}
      {connections.map((conn) => (
        <div key={conn.id} className="flex items-center gap-3 p-4 rounded-xl border border-[#e5e7eb] bg-white">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{conn.providerName[0]}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[#111111]">{conn.providerName}</p>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00c896]" />
            </div>
            <p className="text-xs text-[#9ca3af]">
              {conn.accounts.length} рахунків · Синхр: {timeAgo(conn.lastSyncAt)}
            </p>
            {conn.accounts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {conn.accounts.map((acc) => (
                  <span
                    key={acc.accountId}
                    className="text-xs px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]"
                  >
                    {acc.displayName} {acc.currency}
                    {acc.balance !== undefined ? ` · ${acc.balance.toFixed(2)}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleSync(conn)}
              disabled={syncingId === conn.id}
              className="flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#111111] border border-[#e5e7eb] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingId === conn.id ? 'animate-spin' : ''}`} />
              {syncingId === conn.id ? 'Синхр...' : 'Синхронізувати'}
            </button>
            <button
              onClick={() => handleDelete(conn)}
              className="p-1.5 text-[#9ca3af] hover:text-[#ef4444] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#f5f3ff] border border-[#e5e7eb] text-xs text-[#6b7280]">
        <AlertCircle className="w-3.5 h-3.5 text-[#6366f1] shrink-0 mt-0.5" />
        <span>
          Після натискання &quot;Підключити&quot; тебе переадресують на сторінку банку для авторизації.
          Токен зберігається у вашій Firebase — треті особи не мають доступу.
        </span>
      </div>

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={processingAuth}
        className="flex items-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-[#e5e7eb] hover:border-[#6366f1] hover:bg-[#f5f3ff] text-[#6b7280] hover:text-[#6366f1] transition-all text-sm font-medium disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        Підключити банк (Santander, PKO, mBank, ING та інші)
      </button>
    </div>
  )
}
