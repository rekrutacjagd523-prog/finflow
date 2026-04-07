'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { deleteAccount } from '@/lib/firebase/accounts'
import { formatCurrency } from '@/lib/utils/currency'
import { AccountForm } from '@/components/forms/AccountForm'
import type { Account } from '@/types'

const TYPE_LABELS: Record<Account['type'], string> = {
  bank: 'Банківський',
  cash: 'Готівка',
  card: 'Карта',
  crypto: 'Крипто',
}

interface AccountCardProps {
  account: Account
  orgId: string
  selected?: boolean
  onClick?: () => void
}

export function AccountCard({ account, orgId, selected, onClick }: AccountCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Видалити рахунок «${account.name}»?`)) return
    setDeleting(true)
    try {
      await deleteAccount(orgId, account.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        onClick={onClick}
        className="relative rounded-xl border bg-white cursor-pointer transition-all hover:shadow-md"
        style={{
          borderRadius: 12,
          borderColor: selected ? account.color : '#e5e7eb',
          boxShadow: selected ? `0 0 0 2px ${account.color}33` : undefined,
          minWidth: 180,
        }}
      >
        {/* Color strip */}
        <div
          className="h-1 rounded-t-xl"
          style={{ backgroundColor: account.color }}
        />

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{account.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[account.type]}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Редагувати
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Видалити
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p
            className="mt-3 text-xl font-semibold tabular-nums"
            style={{ color: account.balance >= 0 ? '#111111' : '#ef4444' }}
          >
            {formatCurrency(account.balance, account.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{account.currency}</p>
        </div>
      </div>

      <AccountForm
        orgId={orgId}
        account={account}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}
