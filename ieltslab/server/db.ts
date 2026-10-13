// Persistence: users, sessions, materials, attempts and uploaded files.
// Uses the local SQLite file by default, or Turso when TURSO_DATABASE_URL is set (see server/sql.ts).
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_MATERIALS } from '../shared/demoContent';
import { newBuiltIns } from '../shared/demoSync';
import type { Attempt, Material, PublicUser, UserSettings } from '../shared/types';
import { localSql, tursoSql, type Param, type Sql } from './sql';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
/** Folder used by older versions that kept uploads on disk; still read as a fallback. */
const LEGACY_UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const tursoUrl = (process.env.TURSO_DATABASE_URL || '').trim();
export const sql: Sql = tursoUrl
  ? tursoSql(tursoUrl, (process.env.TURSO_AUTH_TOKEN || '').trim())
  : localSql(process.env.DB_FILE || path.join(DATA_DIR, 'ieltslab.sqlite'));

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'candidate',
    is_guest INTEGER NOT NULL DEFAULT 0,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    skill TEXT NOT NULL,
    test_type TEXT NOT NULL,
    part INTEGER NOT NULL,
    status TEXT NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    status TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS attempts_owner ON attempts(owner_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    kind TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    filename TEXT,
    attempt_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS file_chunks (
    file_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    data BLOB NOT NULL,
    PRIMARY KEY (file_id, seq)
  )`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

// ---------- users ----------
export interface UserRow {
  id: string;
  email: string | null;
  name: string;
  password_hash: string | null;
  google_sub: string | null;
  role: 'admin' | 'candidate';
  is_guest: number;
  settings: string;
  created_at: string;
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isGuest: !!u.is_guest,
    hasPassword: !!u.password_hash,
    googleLinked: !!u.google_sub,
    settings: safeJson<UserSettings>(u.settings, {}),
    createdAt: u.created_at,
  };
}

const USER_COLUMNS = new Set(['email', 'name', 'password_hash', 'google_sub', 'role', 'is_guest', 'settings']);

export const users = {
  byId: (id: string) => sql.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]),
  byEmail: (email: string) => sql.get<UserRow>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]),
  byGoogle: (sub: string) => sql.get<UserRow>('SELECT * FROM users WHERE google_sub = ?', [sub]),
  async insert(u: Omit<UserRow, 'settings' | 'created_at'> & { settings?: UserSettings }): Promise<UserRow> {
    await sql.run('INSERT INTO users (id, email, name, password_hash, google_sub, role, is_guest, settings, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [
      u.id, u.email, u.name, u.password_hash, u.google_sub, u.role, u.is_guest, JSON.stringify(u.settings || {}), new Date().toISOString(),
    ]);
    return (await users.byId(u.id))!;
  },
  async update(id: string, fields: Partial<Omit<UserRow, 'id' | 'created_at'>>): Promise<UserRow> {
    const keys = Object.keys(fields).filter((k) => USER_COLUMNS.has(k));
    if (keys.length) {
      await sql.run(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [
        ...(keys.map((k) => (fields as Record<string, Param>)[k] ?? null)),
        id,
      ]);
    }
    return (await users.byId(id))!;
  },
  /** Deletes the user and everything they own. */
  async delete(id: string) {
    const fileIds = await sql.all<{ id: string }>('SELECT id FROM files WHERE owner_id = ? AND kind = ?', [id, 'recording']);
    await sql.batch([
      ...fileIds.map((f) => ({ sql: 'DELETE FROM file_chunks WHERE file_id = ?', params: [f.id] })),
      { sql: "DELETE FROM files WHERE owner_id = ? AND kind = 'recording'", params: [id] },
      { sql: 'UPDATE files SET owner_id = NULL WHERE owner_id = ?', params: [id] },
      { sql: 'DELETE FROM attempts WHERE owner_id = ?', params: [id] },
      { sql: 'DELETE FROM sessions WHERE user_id = ?', params: [id] },
      { sql: 'DELETE FROM users WHERE id = ?', params: [id] },
    ]);
  },
  adminCount: async () => (await sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"))!.n,
};

// ---------- sessions ----------
export const sessions = {
  insert: (tokenHash: string, userId: string, expiresAt: string) =>
    sql.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)', [tokenHash, userId, new Date().toISOString(), expiresAt]),
  userFor: (tokenHash: string) =>
    sql.get<UserRow>('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?', [tokenHash, new Date().toISOString()]),
  delete: (tokenHash: string) => sql.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]),
  deleteForUser: (userId: string, except?: string) => sql.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', [userId, except || '']),
  purgeExpired: () => sql.run('DELETE FROM sessions WHERE expires_at <= ?', [new Date().toISOString()]),
};

// ---------- materials ----------
export const materials = {
  async all(): Promise<Material[]> {
    return (await sql.all<{ data: string }>('SELECT data FROM materials ORDER BY skill, part, updated_at DESC')).map((r) => JSON.parse(r.data));
  },
  async get(id: string): Promise<Material | undefined> {
    const r = await sql.get<{ data: string }>('SELECT data FROM materials WHERE id = ?', [id]);
    return r ? JSON.parse(r.data) : undefined;
  },
  upsertStmt(m: Material) {
    return {
      sql: `INSERT INTO materials (id, skill, test_type, part, status, demo, data, updated_at) VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET skill=excluded.skill, test_type=excluded.test_type, part=excluded.part, status=excluded.status, demo=excluded.demo, data=excluded.data, updated_at=excluded.updated_at`,
      params: [m.id, m.skill, m.testType, m.part, m.status, m.demo ? 1 : 0, JSON.stringify(m), m.updatedAt] as Param[],
    };
  },
  upsert: (m: Material) => {
    const s = materials.upsertStmt(m);
    return sql.run(s.sql, s.params);
  },
  /** Insert or update many materials in a few round trips. */
  async upsertMany(list: Material[]) {
    for (let i = 0; i < list.length; i += 20) await sql.batch(list.slice(i, i + 20).map(materials.upsertStmt));
  },
  delete: (id: string) => sql.run('DELETE FROM materials WHERE id = ?', [id]),
  deleteDemo: () => sql.run('DELETE FROM materials WHERE demo = 1'),
};

export async function seedDemoContent() {
  await materials.upsertMany(DEMO_MATERIALS);
}

// ---------- attempts ----------
export const attempts = {
  async get(id: string): Promise<Attempt | undefined> {
    const r = await sql.get<{ data: string }>('SELECT data FROM attempts WHERE id = ?', [id]);
    return r ? JSON.parse(r.data) : undefined;
  },
  async forOwner(ownerId: string): Promise<Attempt[]> {
    return (await sql.all<{ data: string }>('SELECT data FROM attempts WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 500', [ownerId])).map((r) => JSON.parse(r.data));
  },
  async submittedNeedingReview(): Promise<Attempt[]> {
    return (await sql.all<{ data: string }>("SELECT data FROM attempts WHERE status = 'submitted' ORDER BY updated_at DESC LIMIT 300"))
      .map((r) => JSON.parse(r.data) as Attempt)
      .filter((a) => a.sections.some((s) => (s.skill === 'writing' || s.skill === 'speaking') && a.reviews[s.skill]?.source !== 'teacher'));
  },
  save: (a: Attempt) =>
    sql.run(
      `INSERT INTO attempts (id, owner_id, status, data, created_at, updated_at) VALUES (?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data, updated_at=excluded.updated_at`,
      [a.id, a.ownerId, a.status, JSON.stringify(a), a.createdAt, a.updatedAt],
    ),
  delete: (id: string) => sql.run('DELETE FROM attempts WHERE id = ?', [id]),
  reassign: (fromOwner: string, toOwner: string) =>
    sql.batch([
      { sql: 'UPDATE attempts SET owner_id = ? WHERE owner_id = ?', params: [toOwner, fromOwner] },
      { sql: 'UPDATE files SET owner_id = ? WHERE owner_id = ?', params: [toOwner, fromOwner] },
    ]),
};

// ---------- files (uploaded assets and speaking recordings), stored in the database in chunks ----------
export interface FileRow {
  id: string;
  owner_id: string | null;
  kind: 'asset' | 'recording';
  mime: string;
  size: number;
  filename: string | null;
  attempt_id: string | null;
  created_at: string;
}

const CHUNK = 256 * 1024;
const cache = new Map<string, Buffer>();
let cacheBytes = 0;
const CACHE_LIMIT = 96 * 1024 * 1024;
function remember(id: string, data: Buffer) {
  if (data.length > CACHE_LIMIT / 4) return;
  cache.set(id, data);
  cacheBytes += data.length;
  while (cacheBytes > CACHE_LIMIT) {
    const [oldest, buf] = cache.entries().next().value as [string, Buffer];
    cache.delete(oldest);
    cacheBytes -= buf.length;
  }
}
function forget(id: string) {
  const b = cache.get(id);
  if (b) {
    cacheBytes -= b.length;
    cache.delete(id);
  }
}

export const files = {
  get: (id: string) => sql.get<FileRow>('SELECT * FROM files WHERE id = ?', [id]),
  async insert(f: Omit<FileRow, 'created_at'>, data: Buffer) {
    const chunks: { sql: string; params: Param[] }[] = [];
    for (let seq = 0, off = 0; off < data.length; seq++, off += CHUNK) {
      chunks.push({ sql: 'INSERT INTO file_chunks (file_id, seq, data) VALUES (?,?,?)', params: [f.id, seq, data.subarray(off, off + CHUNK)] });
    }
    // A few chunks per request keeps each HTTPS request around a megabyte.
    for (let i = 0; i < chunks.length; i += 4) await sql.batch(chunks.slice(i, i + 4));
    await sql.run('INSERT INTO files (id, owner_id, kind, mime, size, filename, attempt_id, created_at) VALUES (?,?,?,?,?,?,?,?)', [
      f.id, f.owner_id, f.kind, f.mime, f.size, f.filename, f.attempt_id, new Date().toISOString(),
    ]);
    remember(f.id, data);
  },
  /** The file's bytes, or null if they are missing. */
  async read(id: string): Promise<Buffer | null> {
    const hit = cache.get(id);
    if (hit) {
      cache.delete(id);
      cache.set(id, hit); // keep recently used files cached
      return hit;
    }
    const rows = await sql.all<{ data: Uint8Array }>('SELECT data FROM file_chunks WHERE file_id = ? ORDER BY seq', [id]);
    let data: Buffer | null = rows.length ? Buffer.concat(rows.map((r) => Buffer.from(r.data))) : null;
    if (!data) {
      const legacy = path.join(LEGACY_UPLOAD_DIR, id.replace(/[^\w-]/g, ''));
      if (fs.existsSync(legacy)) data = fs.readFileSync(legacy);
    }
    if (data) remember(id, data);
    return data;
  },
  async remove(id: string) {
    forget(id);
    await sql.batch([
      { sql: 'DELETE FROM file_chunks WHERE file_id = ?', params: [id] },
      { sql: 'DELETE FROM files WHERE id = ?', params: [id] },
    ]);
  },
  async removeForAttempt(attemptId: string) {
    const rows = await sql.all<{ id: string }>('SELECT id FROM files WHERE attempt_id = ?', [attemptId]);
    for (const r of rows) await files.remove(r.id);
  },
};

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Create tables and add built-in materials. Call once before serving requests. */
export async function initDb() {
  await sql.batch(SCHEMA.map((s) => ({ sql: s })));
  // Seed on first start, then add only built-in materials released later (deleted ones are not brought back).
  if (process.env.SEED_DEMO !== 'false') {
    const seeded = await sql.get("SELECT 1 AS x FROM meta WHERE key = 'demo_seeded'");
    const offeredRow = await sql.get<{ value: string }>("SELECT value FROM meta WHERE key = 'demo_ids'");
    const fresh = seeded ? newBuiltIns(DEMO_MATERIALS, offeredRow ? safeJson<string[] | null>(offeredRow.value, null) : null) : DEMO_MATERIALS;
    const existing = new Set((await sql.all<{ id: string }>('SELECT id FROM materials')).map((r) => r.id));
    await materials.upsertMany(fresh.filter((m) => !existing.has(m.id)));
    await sql.batch([
      { sql: "INSERT INTO meta (key, value) VALUES ('demo_seeded', ?) ON CONFLICT(key) DO NOTHING", params: [new Date().toISOString()] },
      { sql: "INSERT INTO meta (key, value) VALUES ('demo_ids', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params: [JSON.stringify(DEMO_MATERIALS.map((m) => m.id))] },
    ]);
  }
}
