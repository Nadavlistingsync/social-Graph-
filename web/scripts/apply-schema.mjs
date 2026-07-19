#!/usr/bin/env node
/**
 * Apply supabase/migrations/001_user_graphs.sql using the project's secret key.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SECRET_KEY=sb_secret_… \
 *   node web/scripts/apply-schema.mjs
 *
 * Also accepts SUPABASE_SERVICE_ROLE_KEY (legacy JWT).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const sqlPath = join(root, 'supabase/migrations/001_user_graphs.sql')
const sql = readFileSync(sqlPath, 'utf8')

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const secret =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SECRET_KEY ||
  ''

if (!url || !secret) {
  console.error(
    'Missing SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).\n' +
      'Find the secret key in Supabase → Project Settings → API Keys.',
  )
  process.exit(1)
}

const endpoint = `${url}/postgres/v1/query`
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
if (!res.ok) {
  // Fallback: Management-style pg-meta path used by some projects
  const alt = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const altText = await alt.text()
  if (!alt.ok) {
    console.error('Could not apply schema via API.')
    console.error('Primary:', res.status, text)
    console.error('Fallback:', alt.status, altText)
    console.error('\nPaste supabase/migrations/001_user_graphs.sql into the Supabase SQL Editor instead.')
    process.exit(1)
  }
  console.log('Schema applied via /pg/query')
  console.log(altText.slice(0, 500))
  process.exit(0)
}

console.log('Schema applied.')
console.log(text.slice(0, 500))
