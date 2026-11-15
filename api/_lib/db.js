'use strict';
// Production: Neon Postgres over HTTPS (no npm deps). Local: built-in node:sqlite file.
// Write SQL once with `?` placeholders; they are converted to $1.. for Postgres.

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const isPg = !!url;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS studios (
    studio_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    roll_number TEXT NOT NULL,
    product_type TEXT NOT NULL,
    warranty_years INTEGER NOT NULL,
    color_variant TEXT NOT NULL,
    studio_id TEXT,
    status TEXT NOT NULL,
    activation_date TEXT,
    vehicle_reg TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS products_vehicle_uq ON products (vehicle_reg) WHERE vehicle_reg IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS products_studio_ix ON products (studio_id)`,
];

let local;
function sqlite() {
  if (!local) {
    const { DatabaseSync } = require('node:sqlite');
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', '..', '.data');
    fs.mkdirSync(dir, { recursive: true });
    local = new DatabaseSync(path.join(dir, 'shieldora.db'));
  }
  return local;
}

async function pgQuery(sql, params) {
  let n = 0;
  const text = sql.replace(/\?/g, () => '$' + ++n);
  const host = new URL(url).host;
  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': url },
    body: JSON.stringify({ query: text, params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(body.message || 'Database error');
    e.code = body.code;
    throw e;
  }
  return body.rows || [];
}

function sqliteQuery(sql, params) {
  const st = sqlite().prepare(sql);
  const returnsRows = /^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql);
  if (returnsRows) return st.all(...params).map(r => ({ ...r }));
  st.run(...params);
  return [];
}

let ready;
async function query(sql, params = []) {
  if (!ready) {
    ready = (async () => {
      for (const s of SCHEMA) isPg ? await pgQuery(s, []) : sqliteQuery(s, []);
    })().catch(e => { ready = null; throw e; });
  }
  await ready;
  try {
    return isPg ? await pgQuery(sql, params) : sqliteQuery(sql, params);
  } catch (e) {
    if (e.code === '23505' || /UNIQUE constraint failed/i.test(e.message)) e.unique = true;
    throw e;
  }
}

const num = v => (v == null ? v : Number(v));
module.exports = { query, num, isPg };
