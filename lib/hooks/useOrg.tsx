'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { auth } from '@/lib/firebase/firebase'
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

  // Every load (the initial one below, or an explicit switchOrg) takes a new id; a load that
  // finishes after a newer one started is stale and must not overwrite the newer result. This
  // matters right after sign-up: the initial load starts before the new organization exists.
  const loadSeq = useRef(0)

  useEffect(() => {
    const seq = ++loadSeq.current
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
          if (seq !== loadSeq.current) return
          if (organization) {
            setOrg(organization)
            setOrgId(stored)
            return
          }
        }

        // Fallback: load first org
        const orgs = await getUserOrganizations(user.uid)
        if (seq !== loadSeq.current) return
        if (orgs.length > 0) {
          setOrg(orgs[0])
          setOrgId(orgs[0].id)
          localStorage.setItem(`lastOrgId_${user.uid}`, orgs[0].id)
        }
      } finally {
        if (seq === loadSeq.current) setLoading(false)
      }
    }

    loadOrg()
  }, [user])

  // Reads auth.currentUser, not the `user` state: a caller may invoke it right after signing in,
  // from a closure rendered while `user` was still null (e.g. the register page).
  const switchOrg = async (newOrgId: string) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const seq = ++loadSeq.current
    setLoading(true)
    try {
      const organization = await getOrganization(newOrgId)
      if (seq !== loadSeq.current) return
      if (organization) {
        setOrg(organization)
        setOrgId(newOrgId)
        localStorage.setItem(`lastOrgId_${uid}`, newOrgId)
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
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
