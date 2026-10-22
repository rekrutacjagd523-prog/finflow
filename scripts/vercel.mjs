#!/usr/bin/env node
// Vercel REST API helper for the finflow project (S00, Part E).
//
// - Reads VERCEL_TOKEN and VERCEL_TEAM_ID from .env (or from the process environment).
// - Never prints secret values: they go straight from local gitignored files to the API.
// - API paths are written without a leading slash because Git Bash rewrites "/v9/..."
//   arguments into Windows paths when it starts native programs such as node.exe.
//
// Usage (run from the repo root):
//   node scripts/vercel.mjs project-create   create or reuse project "finflow" (GitHub remit-agency/finflow, Node 24.x)
//   node scripts/vercel.mjs project-show     print framework, Node version, Git link and region
//   node scripts/vercel.mjs domains [--quiet]
//   node scripts/vercel.mjs env-sync [--dry-run] [--only=K1,K2] [--skip=K1,K2] [--app-url=https://host] [--rotate-state-secret]
//   node scripts/vercel.mjs env-list         plain values are shown, secret values are not
//   node scripts/vercel.mjs deployments [--target=production|preview] [--branch=name] [--sha=fullsha]
//   node scripts/vercel.mjs wait [--target=...] [--branch=...] [--sha=...] [--timeout=seconds]
//   node scripts/vercel.mjs redeploy-prod    new production deployment of master, created by the token owner
//   node scripts/vercel.mjs smoke-prod [--url=https://host]
import fs from 'node:fs'
import crypto from 'node:crypto'

const PROJECT = 'finflow'
const GIT_ORG = 'remit-agency'
const GIT_REPO = 'finflow'
const REGION = 'fra1'
const NODE_VERSION = '24.x'
const FIREBASE_PROJECT_ID = 'finflow-e94b5'
const ALL_TARGETS = ['production', 'preview', 'development']
const SECRET_TARGETS = ['production', 'preview']
const PUBLIC_FIREBASE_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
]
const EB_APP_ID_FILE = '.secrets/enablebanking-app-id.txt'
const EB_KEY_FILE = '.secrets/enablebanking-private.key'
const EB_CERT_FILE = '.secrets/enablebanking-public.crt'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Failures throw instead of calling process.exit(): on Windows, exiting while fetch() sockets
// are still open aborts Node with "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)".
class Fatal extends Error {}

function die(message) {
  throw new Fatal(message)
}

function readDotenv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let value = m[2]
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1)
    }
    out[m[1]] = value
  }
  return out
}

function parseFlags(argv) {
  const flags = {}
  for (const arg of argv) {
    const m = arg.match(/^--([a-z0-9-]+)(?:=(.*))?$/)
    if (!m) die(`unknown argument: ${arg}`)
    flags[m[1]] = m[2] ?? true
  }
  return flags
}

const dotenv = readDotenv('.env')
const TOKEN = process.env.VERCEL_TOKEN || dotenv.VERCEL_TOKEN
const TEAM = process.env.VERCEL_TEAM_ID || dotenv.VERCEL_TEAM_ID

async function api(method, apiPath, body) {
  if (!TOKEN || !TEAM) die('VERCEL_TOKEN / VERCEL_TEAM_ID are missing in .env')
  const p = apiPath.replace(/^\/+/, '')
  const url = `https://api.vercel.com/${p}${p.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(TEAM)}`
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 300) }
  }
  return { status: res.status, ok: res.ok, json }
}

function must(result, what) {
  if (!result.ok) {
    const e = result.json.error ?? {}
    die(`${what}: HTTP ${result.status} ${e.code ?? ''} ${e.message ?? JSON.stringify(result.json).slice(0, 300)}`)
  }
  return result.json
}

// ---------- project ----------

async function projectCreate() {
  const existing = await api('GET', `v9/projects/${PROJECT}`)
  if (existing.ok) {
    console.log(`project exists: ${existing.json.id}`)
  } else if (existing.status === 404) {
    const created = must(
      await api('POST', 'v11/projects', {
        name: PROJECT,
        framework: 'nextjs',
        gitRepository: { type: 'github', repo: `${GIT_ORG}/${GIT_REPO}` },
        serverlessFunctionRegion: REGION,
      }),
      'POST v11/projects',
    )
    console.log(`project created: ${created.id}`)
  } else {
    must(existing, `GET v9/projects/${PROJECT}`)
  }
  must(await api('PATCH', `v9/projects/${PROJECT}`, { nodeVersion: NODE_VERSION }), 'PATCH nodeVersion')
  await projectShow()
}

async function projectShow() {
  const p = must(await api('GET', `v9/projects/${PROJECT}`), `GET v9/projects/${PROJECT}`)
  const summary = {
    id: p.id,
    name: p.name,
    framework: p.framework,
    nodeVersion: p.nodeVersion,
    gitRepo: p.link ? `${p.link.org}/${p.link.repo}` : null,
    productionBranch: p.link?.productionBranch ?? null,
    serverlessFunctionRegion: p.serverlessFunctionRegion ?? null,
  }
  console.log(JSON.stringify(summary, null, 2))
}

// ---------- domains ----------

async function prodDomains() {
  const r = must(await api('GET', `v9/projects/${PROJECT}/domains?production=true`), 'GET project domains')
  return (r.domains ?? []).filter((d) => !d.redirect)
}

function pickVercelDomain(list) {
  const names = list
    .filter((d) => d.name.endsWith('.vercel.app') && !d.gitBranch)
    .map((d) => d.name)
    .sort((a, b) => a.length - b.length)
  return names[0] ?? null
}

async function domains(flags) {
  const list = await prodDomains()
  const chosen = pickVercelDomain(list)
  if (flags.quiet) {
    if (chosen) console.log(chosen)
    return
  }
  for (const d of list) console.log(`${d.name}\tverified=${d.verified}\tgitBranch=${d.gitBranch ?? '-'}`)
  console.log(`PROD_DOMAIN=${chosen ?? ''}`)
}

// ---------- env ----------

function ebAppId() {
  const fromLocal = readDotenv('.env.local').ENABLEBANKING_APP_ID
  const fromFile = fs.existsSync(EB_APP_ID_FILE) ? fs.readFileSync(EB_APP_ID_FILE, 'utf8') : ''
  const value = (fromLocal || fromFile).trim()
  if (!UUID_RE.test(value)) {
    die(`ENABLEBANKING_APP_ID is missing or not a UUID (looked in .env.local and ${EB_APP_ID_FILE})`)
  }
  return value
}

function ebPrivateKey() {
  const pem = fs.readFileSync(EB_KEY_FILE, 'utf8').replace(/\r\n/g, '\n').trim() + '\n'
  if (!pem.startsWith('-----BEGIN PRIVATE KEY-----')) die(`${EB_KEY_FILE} must be a PKCS#8 PEM (BEGIN PRIVATE KEY)`)
  if (fs.existsSync(EB_CERT_FILE)) {
    const fromKey = crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' })
    const fromCert = new crypto.X509Certificate(fs.readFileSync(EB_CERT_FILE)).publicKey.export({
      type: 'spki',
      format: 'der',
    })
    if (!fromKey.equals(fromCert)) die(`${EB_KEY_FILE} does not match ${EB_CERT_FILE}`)
  }
  return pem
}

function serviceAccountBase64() {
  const files = fs.readdirSync('.secrets').filter((f) => /^finflow-e94b5-firebase-adminsdk-.+\.json$/.test(f))
  if (files.length !== 1) die(`expected exactly one service-account JSON in .secrets/, found ${files.length}`)
  const raw = fs.readFileSync(`.secrets/${files[0]}`, 'utf8')
  let sa
  try {
    sa = JSON.parse(raw)
  } catch {
    // Do not rethrow: Node's JSON error message quotes part of the (secret) input.
    die(`.secrets/${files[0]} is not valid JSON`)
  }
  if (sa.type !== 'service_account' || sa.project_id !== FIREBASE_PROJECT_ID || !sa.client_email) {
    die(`.secrets/${files[0]} is not a ${FIREBASE_PROJECT_ID} service account`)
  }
  if (!String(sa.private_key ?? '').includes('BEGIN PRIVATE KEY')) die(`.secrets/${files[0]} has no private_key`)
  return Buffer.from(raw, 'utf8').toString('base64')
}

async function listEnv() {
  const r = must(await api('GET', `v10/projects/${PROJECT}/env`), 'GET env')
  return r.envs ?? []
}

async function envSync(flags) {
  const dryRun = Boolean(flags['dry-run'])
  const keySet = (value) => (typeof value === 'string' ? new Set(value.split(',').map((k) => k.trim())) : null)
  const only = keySet(flags.only)
  const skip = keySet(flags.skip) ?? new Set()
  const wanted = (key) => (!only || only.has(key)) && !skip.has(key)
  const local = readDotenv('.env.local')
  const entries = []

  for (const key of PUBLIC_FIREBASE_KEYS) {
    if (!wanted(key)) continue
    if (!local[key]) die(`${key} is missing in .env.local (Task E4 Step 1)`)
    entries.push({ key, value: local[key], type: 'plain', target: ALL_TARGETS })
  }
  if (wanted('NEXT_PUBLIC_FIREBASE_PROJECT_ID') && local.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== FIREBASE_PROJECT_ID) {
    die(`.env.local NEXT_PUBLIC_FIREBASE_PROJECT_ID must be ${FIREBASE_PROJECT_ID}, not the emulator demo project`)
  }

  if (wanted('NEXT_PUBLIC_APP_URL')) {
    let appUrl = typeof flags['app-url'] === 'string' ? flags['app-url'] : null
    if (!appUrl && !dryRun) {
      const chosen = pickVercelDomain(await prodDomains())
      if (chosen) appUrl = `https://${chosen}`
    }
    if (appUrl) {
      const u = new URL(appUrl)
      if (u.protocol !== 'https:' || u.pathname !== '/' || u.search) die('--app-url must look like https://host')
      entries.push({ key: 'NEXT_PUBLIC_APP_URL', value: u.origin, type: 'plain', target: SECRET_TARGETS })
      console.log(`NEXT_PUBLIC_APP_URL will be ${u.origin}`)
    } else {
      console.log('NEXT_PUBLIC_APP_URL: skipped (no production domain yet; Task E6 sets it)')
    }
  }

  if (wanted('ENABLEBANKING_APP_ID')) {
    entries.push({ key: 'ENABLEBANKING_APP_ID', value: ebAppId(), type: 'sensitive', target: SECRET_TARGETS })
  }
  if (wanted('ENABLEBANKING_PRIVATE_KEY')) {
    entries.push({ key: 'ENABLEBANKING_PRIVATE_KEY', value: ebPrivateKey(), type: 'sensitive', target: SECRET_TARGETS })
  }
  if (wanted('FIREBASE_SERVICE_ACCOUNT')) {
    entries.push({ key: 'FIREBASE_SERVICE_ACCOUNT', value: serviceAccountBase64(), type: 'sensitive', target: SECRET_TARGETS })
  }
  if (wanted('EB_STATE_SECRET')) {
    const exists = dryRun ? false : (await listEnv()).some((e) => e.key === 'EB_STATE_SECRET')
    if (exists && !flags['rotate-state-secret']) {
      console.log('EB_STATE_SECRET: kept the existing value (pass --rotate-state-secret to replace it)')
    } else {
      entries.push({
        key: 'EB_STATE_SECRET',
        value: crypto.randomBytes(32).toString('base64'),
        type: 'sensitive',
        target: SECRET_TARGETS,
      })
    }
  }

  for (const e of entries) {
    console.log(`${dryRun ? 'would set' : 'set'}\t${e.key}\t${e.type}\t${e.target.join(',')}\tlen=${e.value.length}`)
  }
  if (dryRun || entries.length === 0) return

  const r = must(await api('POST', `v10/projects/${PROJECT}/env?upsert=true`, entries), 'POST env')
  const failed = r.failed ?? []
  for (const f of failed) {
    console.error(`FAILED ${f.error?.envVarKey ?? f.error?.key ?? '?'}: ${f.error?.code ?? ''} ${f.error?.message ?? ''}`)
  }
  if (failed.length > 0) die(`${failed.length} variable(s) failed`)
  console.log(`ok: ${entries.length} variable(s) upserted`)
}

async function envList() {
  for (const e of await listEnv()) {
    const shown = e.type === 'plain' ? (e.value ?? '(n/a)') : '(hidden)'
    console.log(`${e.key}\t${e.type}\t${(e.target ?? []).join(',')}\t${shown}`)
  }
}

// ---------- deployments ----------

function deploymentQuery(flags, limit) {
  const q = new URLSearchParams({ projectId: PROJECT, limit: String(limit) })
  for (const k of ['target', 'branch', 'sha']) {
    if (typeof flags[k] === 'string') q.set(k, flags[k])
  }
  return `v7/deployments?${q}`
}

// Last column: how the deployment was created. A push through the Git integration shows
// `git`; criterion 1 ("push to master deploys") needs such a deployment, not one from
// `redeploy-prod` (created through the API by the token owner).
function describeDeployment(d) {
  return [
    d.uid,
    d.target ?? 'preview',
    d.readyState ?? d.state,
    d.meta?.githubCommitRef ?? '-',
    (d.meta?.githubCommitSha ?? '').slice(0, 7) || '-',
    d.url ? `https://${d.url}` : '-',
    d.source ?? '-',
  ].join('\t')
}

async function deployments(flags) {
  const r = must(await api('GET', deploymentQuery(flags, 5)), 'GET deployments')
  for (const d of r.deployments ?? []) console.log(describeDeployment(d))
}

async function wait(flags) {
  const deadline = Date.now() + Number(flags.timeout ?? 900) * 1000
  let last = ''
  for (;;) {
    const r = must(await api('GET', deploymentQuery(flags, 1)), 'GET deployments')
    const d = (r.deployments ?? [])[0]
    const state = d ? (d.readyState ?? d.state) : 'NOT_FOUND'
    const line = d ? describeDeployment(d) : 'no matching deployment yet'
    if (line !== last) {
      console.log(`${new Date().toISOString()}  ${line}`)
      last = line
    }
    if (state === 'READY') return
    if (['ERROR', 'CANCELED', 'BLOCKED'].includes(state)) {
      if (d?.seatBlock) console.error(`seatBlock: ${JSON.stringify(d.seatBlock)}`)
      if (d?.errorMessage) console.error(`errorMessage: ${d.errorMessage}`)
      die(`deployment ended in state ${state}`)
    }
    if (Date.now() > deadline) die('timed out waiting for the deployment')
    await new Promise((resolve) => setTimeout(resolve, 15000))
  }
}

async function redeployProd() {
  const d = must(
    await api('POST', 'v13/deployments', {
      name: PROJECT,
      project: PROJECT,
      target: 'production',
      gitSource: { type: 'github', org: GIT_ORG, repo: GIT_REPO, ref: 'master' },
    }),
    'POST v13/deployments',
  )
  console.log(`created ${d.id}\t${d.readyState ?? ''}\thttps://${d.url}`)
}

// ---------- production acceptance checks (S00 spec, criteria 2 and 4) ----------

async function smokeProd(flags) {
  let base = typeof flags.url === 'string' ? flags.url : null
  if (!base) {
    const chosen = pickVercelDomain(await prodDomains())
    if (!chosen) die('no production domain yet; pass --url=https://host')
    base = `https://${chosen}`
  }
  base = new URL(base).origin
  console.log(`checking ${base}`)
  const results = []
  const check = async (name, fn) => {
    try {
      const detail = await fn()
      results.push(true)
      console.log(`PASS  ${name}${detail ? `  ${detail}` : ''}`)
    } catch (e) {
      results.push(false)
      console.log(`FAIL  ${name}  ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const call = (p, init = {}) => fetch(`${base}${p}`, { redirect: 'manual', ...init })
  const expectStatus = (res, status) => {
    if (res.status !== status) throw new Error(`expected HTTP ${status}, got ${res.status}`)
  }
  const forgedState = Buffer.from(JSON.stringify({ orgId: 'victim-org' })).toString('base64url')

  await check('GET /api/health -> ok, fra1, firestore ok', async () => {
    const res = await call('/api/health')
    expectStatus(res, 200)
    const body = await res.json()
    if (body.ok !== true || body.region !== REGION || body.firestore !== 'ok') {
      throw new Error(`unexpected body ${JSON.stringify(body)}`)
    }
    return JSON.stringify(body)
  })
  await check('GET /api/test/auth -> 404', async () => expectStatus(await call('/api/test/auth'), 404))
  await check('GET /test-login -> 404', async () => expectStatus(await call('/test-login'), 404))
  await check('POST /api/enablebanking/session without token -> 401', async () =>
    expectStatus(
      await call('/api/enablebanking/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspspName: 'Bank Millennium', aspspCountry: 'PL', orgId: 'victim-org' }),
      }),
      401,
    ),
  )
  await check('GET /api/enablebanking/institutions without token -> 401', async () =>
    expectStatus(await call('/api/enablebanking/institutions?country=PL'), 401),
  )
  await check('GET /api/enablebanking/callback with forged state -> 400', async () =>
    expectStatus(await call(`/api/enablebanking/callback?code=fake-code&state=${forgedState}`), 400),
  )

  const failedCount = results.filter((ok) => !ok).length
  console.log(failedCount === 0 ? 'all checks passed' : `${failedCount} check(s) failed`)
  if (failedCount > 0) die(`${failedCount} production check(s) failed`)
}

// ---------- main ----------

const commands = {
  'project-create': projectCreate,
  'project-show': projectShow,
  domains,
  'env-sync': envSync,
  'env-list': envList,
  deployments,
  wait,
  'redeploy-prod': redeployProd,
  'smoke-prod': smokeProd,
}

try {
  const [command, ...rest] = process.argv.slice(2)
  if (!command || !Object.hasOwn(commands, command)) {
    die(`usage: node scripts/vercel.mjs <${Object.keys(commands).join('|')}> [--flags]`)
  }
  await commands[command](parseFlags(rest))
} catch (e) {
  console.error(e instanceof Fatal ? `ERROR: ${e.message}` : e)
  process.exitCode = 1
}
