import { redirect } from 'next/navigation'
import { settingsIndexRedirect } from '@/lib/shell/settings-sections'

interface Props {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// The single settings page was split into sections (S01A). Old links, bookmarks and a bank
// return that was in flight during the deploy land here and keep their query string.
export default async function SettingsIndexPage({ params, searchParams }: Props) {
  const { orgSlug } = await params
  redirect(settingsIndexRedirect(orgSlug, await searchParams))
}
