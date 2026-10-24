export const PRODUCTION_PROJECT_FLAG: '--project=finflow-e94b5'
export const RULES_DEPLOYED_FLAG: '--rules-deployed'
export const ALLOW_SKIPPED_FLAG: '--allow-skipped'

export function assertProductionFlags(input: {
  emulator: boolean
  apply: boolean
  drop: boolean
  args: Iterable<string>
}): { ok: true } | { ok: false; exitCode: 2; message: string }

export function assertDropSkippedAllowed(input: {
  args: Iterable<string>
  skipped: Array<{ orgId: string; uid: string | null; reason: string }>
}):
  | { ok: true }
  | { ok: false; exitCode: 1; message: string; ids: Array<{ orgId: string; uid: string | null; reason: string }> }
