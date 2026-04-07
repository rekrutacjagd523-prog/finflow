'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getOrganization, getUserOrganizations } from '@/lib/firebase/firestore'
import { useAuth } from './useAuth'
import type { Organization } from '@/types'

interface OrgContextValue {
  org: Organization | null
  orgId: string | null
  loading: boolean
  switchOrg: (orgId: string) => Promise<void>
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setOrg(null)
      setOrgId(null)
      setLoading(false)
      return
    }

    const stored = localStorage.getItem(`lastOrgId_${user.uid}`)

    const loadOrg = async () => {
      setLoading(true)
      try {
        if (stored) {
          const organization = await getOrganization(stored)
          if (organization) {
            setOrg(organization)
            setOrgId(stored)
            setLoading(false)
            return
          }
        }

        // Fallback: load first org
        const orgs = await getUserOrganizations(user.uid)
        if (orgs.length > 0) {
          setOrg(orgs[0])
          setOrgId(orgs[0].id)
          localStorage.setItem(`lastOrgId_${user.uid}`, orgs[0].id)
        }
      } finally {
        setLoading(false)
      }
    }

    loadOrg()
  }, [user])

  const switchOrg = async (newOrgId: string) => {
    setLoading(true)
    const organization = await getOrganization(newOrgId)
    if (organization && user) {
      setOrg(organization)
      setOrgId(newOrgId)
      localStorage.setItem(`lastOrgId_${user.uid}`, newOrgId)
    }
    setLoading(false)
  }

  return (
    <OrgContext.Provider value={{ org, orgId, loading, switchOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) {
    throw new Error('useOrg must be used within OrgProvider')
  }
  return ctx
}
