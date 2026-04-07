#!/usr/bin/env node
/**
 * Post-build patch for Cloudflare Workers compatibility.
 *
 * Replaces `Function("return this")()` (used by webpack/lodash for global detection)
 * with `globalThis`, which is always available in Cloudflare Workers.
 *
 * The original pattern uses try/catch but still throws EvalError before the catch
 * can handle it in V8's strict sandbox mode.
 */
const fs = require('fs');
const path = require('path');

const filesToPatch = [
  '.open-next/assets/middleware/handler.mjs',
  '.open-next/assets/server-functions/default/handler.mjs',
];

// Copy all subdirs from .open-next root to .open-next/assets
const openNextDir = '.open-next';
const assetsDir = '.open-next/assets';

const entries = fs.readdirSync(openNextDir, { withFileTypes: true });
for (const entry of entries) {
  if (entry.name === 'assets' || entry.name === 'worker.js') continue;
  const src = path.join(openNextDir, entry.name);
  const dest = path.join(assetsDir, entry.name);
  fs.cpSync(src, dest, { recursive: true });
}
fs.copyFileSync(path.join(openNextDir, 'worker.js'), path.join(assetsDir, '_worker.js'));
console.log('Copied .open-next/* to .open-next/assets/');

// Patch __ASSETS_RUN_WORKER_FIRST__: false → true in cloudflare/init.js
// Without this, the cloudflare-asset-resolver skips env.ASSETS.fetch() and static
// files fall through to the Next.js server which returns 404.
// Cloudflare Pages does NOT serve static assets before _worker.js in advanced mode —
// the worker must serve them via env.ASSETS. The [assets] section in wrangler.toml
// is not supported for Pages projects, so we patch the compiled init.js directly.
const initFile = '.open-next/assets/cloudflare/init.js';
try {
  let code = fs.readFileSync(initFile, 'utf-8');
  if (code.includes('__ASSETS_RUN_WORKER_FIRST__: false')) {
    code = code.replace('__ASSETS_RUN_WORKER_FIRST__: false', '__ASSETS_RUN_WORKER_FIRST__: true');
    fs.writeFileSync(initFile, code);
    console.log(`Patched ${initFile}: __ASSETS_RUN_WORKER_FIRST__ false → true`);
  } else {
    console.log(`${initFile}: __ASSETS_RUN_WORKER_FIRST__ already true or not found`);
  }
} catch (e) {
  console.warn(`Could not patch ${initFile}: ${e.message}`);
}

// Patch Function("return this")() → globalThis
for (const file of filesToPatch) {
  try {
    let code = fs.readFileSync(file, 'utf-8');
    const before = (code.match(/Function\("return this"\)\(\)/g) || []).length;
    code = code.replace(/Function\("return this"\)\(\)/g, 'globalThis');
    fs.writeFileSync(file, code);
    console.log(`Patched ${file}: replaced ${before} occurrence(s) of Function("return this")()`);
  } catch (e) {
    console.warn(`Could not patch ${file}: ${e.message}`);
  }
}
