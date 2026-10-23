'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { toast } from 'sonner'
import { MailWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/useAuth'

const RESEND_COOLDOWN_MS = 60_000

// Soft verification: the app stays usable, sensitive actions (connecting a bank) are blocked on the
// server until the address is verified. Shows nothing for verified users (including Google sign-ins).
export default function VerifyEmailBanner() {
  const { user } = useAuth()
  const [, rerender] = useState(0)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  // focus and visibilitychange often fire together; only one reload may be in flight.
  const reloading = useRef<boolean>(false)

  // user.reload() updates the same User object in place, so force a render afterwards.
  const refresh = useCallback(async () => {
    if (!user || user.emailVerified || reloading.current) return
    reloading.current = true
    try {
      await user.reload()
      rerender((n) => n + 1)
    } catch {
      // Offline or token problem: try again on the next focus.
    } finally {
      reloading.current = false
    }
  }, [user])

  useEffect(() => {
    // refresh() only sets state after the awaited reload, never synchronously inside the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  if (!user || user.emailVerified) return null

  const handleResend = async () => {
    if (sentAt !== null && Date.now() - sentAt < RESEND_COOLDOWN_MS) {
      toast.message('Лист уже надіслано. Зачекайте хвилину.')
      return
    }
    setSending(true)
    try {
      await sendEmailVerification(user)
      setSentAt(Date.now())
      toast.success('Лист надіслано')
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/too-many-requests') {
        toast.error('Забагато спроб. Спробуйте за кілька хвилин.')
      } else {
        toast.error('Не вдалося надіслати лист. Спробуйте пізніше.')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    // An inset card under the tabs; on a phone a single line with a small button.
    <div
      role="status"
      data-testid="verify-email-banner"
      className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:px-4 sm:py-3 lg:mx-8"
    >
      <MailWarning className="size-4 shrink-0 text-amber-700" aria-hidden />
      <p className="min-w-0 flex-1 truncate sm:whitespace-normal">
        <span className="sm:hidden">Підтвердіть email, щоб підключати банки</span>
        <span className="hidden sm:inline">
          Підтвердіть email <strong>{user.email}</strong>, щоб підключати банки. Не отримали лист?
          Надішліть його ще раз.
        </span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={sending}
        className="shrink-0 border-amber-200 bg-surface text-amber-900 hover:bg-amber-100"
      >
        {sending ? (
          'Надсилаємо…'
        ) : (
          <>
            <span className="sm:hidden">Надіслати</span>
            <span className="hidden sm:inline">Надіслати лист ще раз</span>
          </>
        )}
      </Button>
    </div>
  )
}
