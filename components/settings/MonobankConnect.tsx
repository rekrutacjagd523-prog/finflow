'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Trash2, Plus, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchMonobankClient,
  fetchMonobankStatement,
  createBankConnection,
  deleteBankConnection,
  updateBankConnection,
  getBankConnections,
  currencyCodeToString,
  accountTypeLabel,
  type BankConnection,
  type MonobankTx,
} from '@/lib/firebase/bankConnections'
import { createTransaction } from '@/lib/firebase/transactions'
import { getAccounts, createAccount } from '@/lib/firebase/accounts'
import type { Account } from '@/types'

interface Props {
  orgId: string
}

// How far back to sync on first connect (30 days)
const INITIAL_SYNC_DAYS = 30

function formatBalance(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

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

export default function MonobankConnect({ orgId }: Props) {
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = getBankConnections(orgId, setConnections)
    const unsub2 = getAccounts(orgId, setAccounts)
    return () => { unsub(); unsub2() }
  }, [orgId])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setConnecting(true)
    try {
      const client = await fetchMonobankClient(token.trim())

      await createBankConnection(orgId, {
        bank: 'monobank',
        token: token.trim(),
        clientName: client.name,
        accounts: client.accounts,
      })

      toast.success(`Підключено: ${client.name}`)
      setToken('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка підключення')
    } finally {
      setConnecting(false)
    }
  }

  const handleSync = async (conn: BankConnection) => {
    setSyncingId(conn.id)
    let imported = 0
    let skipped = 0

    try {
      const fromTs = conn.lastSyncAt
        ? Math.floor(conn.lastSyncAt.getTime() / 1000)
        : Math.floor((Date.now() - INITIAL_SYNC_DAYS * 86400 * 1000) / 1000)

      const toTs = Math.floor(Date.now() / 1000)

      for (const monoAcc of conn.accounts) {
        const currency = currencyCodeToString(monoAcc.currencyCode)
        const label = `Monobank ${accountTypeLabel(monoAcc.type)} ${currency}`

        // Find or create matching FinFlow account
        let ffAccount = accounts.find(
          (a) => a.name === label || (a as Account & { monobankId?: string }).monobankId === monoAcc.id
        )

        if (!ffAccount) {
          const id = await createAccount(orgId, {
            name: label,
            type: 'bank',
            balance: monoAcc.balance / 100,
            currency,
            color: '#00c896',
          })
          ffAccount = { id, orgId, name: label, type: 'bank', balance: monoAcc.balance / 100, currency, color: '#00c896' }
          setAccounts((prev) => [...prev, ffAccount!])
        }

        // Fetch transactions
        let txs: MonobankTx[] = []
        try {
          txs = await fetchMonobankStatement(conn.token, monoAcc.id, fromTs, toTs)
        } catch {
          // Rate limited or empty — skip
          continue
        }

        for (const tx of txs) {
          if (tx.hold) { skipped++; continue }

          const type = tx.amount >= 0 ? 'income' : 'expense'
          const amount = Math.abs(tx.amount) / 100

          try {
            await createTransaction(orgId, {
              type,
              accountId: ffAccount.id,
              amount,
              currency,
              date: new Date(tx.time * 1000),
              description: tx.description + (tx.comment ? ` · ${tx.comment}` : ''),
              isRecurring: false,
              tags: [],
              fileUrls: [],
            })
            imported++
          } catch {
            skipped++
          }
        }

        // Small delay to respect Monobank rate limit between accounts
        await new Promise((r) => setTimeout(r, 1100))
      }

      await updateBankConnection(orgId, conn.id, {
        lastSyncAt: new Date(),
        accounts: conn.accounts,
      })

      toast.success(`Синхронізовано: ${imported} транзакцій${skipped ? `, пропущено ${skipped}` : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка синхронізації')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (conn: BankConnection) => {
    if (!confirm(`Видалити підключення "${conn.clientName}"?`)) return
    await deleteBankConnection(orgId, conn.id)
    toast.success('Підключення видалено')
  }

  return (
    <div className="space-y-4">
      {/* Connected banks */}
      {connections.map((conn) => (
        <div key={conn.id} className="flex items-center gap-3 p-4 rounded-xl border border-[#e5e7eb] bg-white">
          {/* Monobank logo placeholder */}
          <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">M</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[#111111]">{conn.clientName}</p>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00c896]" />
            </div>
            <p className="text-xs text-[#9ca3af]">
              Monobank · {conn.accounts.length} рахунків · Синхр: {timeAgo(conn.lastSyncAt)}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {conn.accounts.map((acc) => (
                <span
                  key={acc.id}
                  className="text-xs px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]"
                >
                  {accountTypeLabel(acc.type)} {currencyCodeToString(acc.currencyCode)} · {formatBalance(acc.balance, currencyCodeToString(acc.currencyCode))}
                </span>
              ))}
            </div>
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

      {/* Add connection form */}
      {showForm ? (
        <form onSubmit={handleConnect} className="p-4 rounded-xl border border-[#00c896] bg-[#f0fdf9] space-y-3">
          <div>
            <Label className="text-sm font-semibold text-[#111111]">Monobank токен</Label>
            <p className="text-xs text-[#6b7280] mt-0.5 mb-2">
              Відкрий Monobank → Налаштування → Розробникам → скопіюй токен.{' '}
              <a
                href="https://api.monobank.ua"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00c896] hover:underline inline-flex items-center gap-0.5"
              >
                Документація <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="uXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="font-mono text-sm rounded-[6px] border-[#e5e7eb]"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b7280] bg-white rounded-lg px-3 py-2 border border-[#e5e7eb]">
            <AlertCircle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            Токен зберігається у вашій базі даних Firebase. Не передається третім особам.
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!token.trim() || connecting}
              className="bg-[#00c896] hover:bg-[#00b584] text-white rounded-[8px] text-sm"
            >
              {connecting ? 'Підключення...' : 'Підключити'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowForm(false); setToken('') }}
              className="rounded-[8px] text-sm"
            >
              Скасувати
            </Button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-[#e5e7eb] hover:border-[#00c896] hover:bg-[#f0fdf9] text-[#6b7280] hover:text-[#00c896] transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Підключити Monobank
        </button>
      )}
    </div>
  )
}
