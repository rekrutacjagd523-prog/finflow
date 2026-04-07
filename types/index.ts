export interface Organization {
  id: string
  name: string
  currency: string
  ownerId: string
  plan: 'trial' | 'pro' | 'free'
  trialEndsAt: Date
  createdAt: Date
}

export interface OrgMember {
  uid: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
}

export interface Account {
  id: string
  orgId: string
  name: string
  type: 'bank' | 'cash' | 'card' | 'crypto'
  balance: number
  currency: string
  color: string
}

export interface Category {
  id: string
  orgId: string
  name: string
  type: 'income' | 'expense'
  color: string
  parentId?: string
}

export interface Transaction {
  id: string
  orgId: string
  accountId: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  categoryId?: string
  counterpartyId?: string
  date: Date
  description?: string
  isRecurring: boolean
  projectId?: string
  tags: string[]
  fileUrls: string[]
}
