// SQLite persistence using Node's built-in node:sqlite (Node 22.13+). No native modules needed.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DEMO_MATERIALS } from '../shared/demoContent';
import type { Attempt, Material, PublicUser, UserSettings } from '../shared/types';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, 'ieltslab.sqlite'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'candidate',
  is_guest INTEGER NOT NULL DEFAULT 0,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  skill TEXT NOT NULL,
  test_type TEXT NOT NULL,
  part INTEGER NOT NULL,
  status TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_owner ON attempts(owner_id, updated_at);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  filename TEXT,
  attempt_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

type Row = Record<string, unknown>;

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

export const users = {
  byId: (id: string) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined,
  byEmail: (email: string) => db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as UserRow | undefined,
  byGoogle: (sub: string) => db.prepare('SELECT * FROM users WHERE google_sub = ?').get(sub) as UserRow | undefined,
  insert(u: Omit<UserRow, 'settings' | 'created_at'> & { settings?: UserSettings }) {
    db.prepare('INSERT INTO users (id, email, name, password_hash, google_sub, role, is_guest, settings, created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
      u.id, u.email, u.name, u.password_hash, u.google_sub, u.role, u.is_guest, JSON.stringify(u.settings || {}), new Date().toISOString(),
    );
    return users.byId(u.id)!;
  },
  update(id: string, fields: Partial<Omit<UserRow, 'id' | 'created_at'>>) {
    const keys = Object.keys(fields);
    if (!keys.length) return users.byId(id)!;
    db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...(keys.map((k) => (fields as Row)[k]) as (string | number | null)[]), id);
    return users.byId(id)!;
  },
  delete: (id: string) => db.prepare('DELETE FROM users WHERE id = ?').run(id),
  adminCount: () => (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }).n,
};

// ---------- sessions ----------
export const sessions = {
  insert: (tokenHash: string, userId: string, expiresAt: string) =>
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)').run(tokenHash, userId, new Date().toISOString(), expiresAt),
  userFor(tokenHash: string): UserRow | undefined {
    return db
      .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
      .get(tokenHash, new Date().toISOString()) as UserRow | undefined;
  },
  delete: (tokenHash: string) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash),
  deleteForUser: (userId: string, except?: string) =>
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, except || ''),
  purgeExpired: () => db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString()),
};

// ---------- materials ----------
export const materials = {
  all(): Material[] {
    return (db.prepare('SELECT data FROM materials ORDER BY skill, part, updated_at DESC').all() as { data: string }[]).map((r) => JSON.parse(r.data));
  },
  get(id: string): Material | undefined {
    const r = db.prepare('SELECT data FROM materials WHERE id = ?').get(id) as { data: string } | undefined;
    return r ? JSON.parse(r.data) : undefined;
  },
  upsert(m: Material) {
    db.prepare(
      `INSERT INTO materials (id, skill, test_type, part, status, demo, data, updated_at) VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET skill=excluded.skill, test_type=excluded.test_type, part=excluded.part, status=excluded.status, demo=excluded.demo, data=excluded.data, updated_at=excluded.updated_at`,
    ).run(m.id, m.skill, m.testType, m.part, m.status, m.demo ? 1 : 0, JSON.stringify(m), m.updatedAt);
  },
  delete: (id: string) => db.prepare('DELETE FROM materials WHERE id = ?').run(id),
  deleteDemo: () => db.prepare('DELETE FROM materials WHERE demo = 1').run(),
  count: () => (db.prepare('SELECT COUNT(*) AS n FROM materials').get() as { n: number }).n,
};

export function seedDemoContent(force = false) {
  for (const m of DEMO_MATERIALS) {
    if (force || !materials.get(m.id)) materials.upsert(m);
  }
}

// Seed once on first start (the meta flag stops demo content reappearing after an admin deletes it).
if (process.env.SEED_DEMO !== 'false' && !db.prepare("SELECT 1 FROM meta WHERE key = 'demo_seeded'").get()) {
  seedDemoContent();
  db.prepare("INSERT INTO meta (key, value) VALUES ('demo_seeded', ?)").run(new Date().toISOString());
}

// ---------- attempts ----------
export const attempts = {
  get(id: string): Attempt | undefined {
    const r = db.prepare('SELECT data FROM attempts WHERE id = ?').get(id) as { data: string } | undefined;
    return r ? JSON.parse(r.data) : undefined;
  },
  forOwner(ownerId: string): Attempt[] {
    return (db.prepare('SELECT data FROM attempts WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 500').all(ownerId) as { data: string }[]).map((r) => JSON.parse(r.data));
  },
  submittedNeedingReview(): Attempt[] {
    return (db.prepare("SELECT data FROM attempts WHERE status = 'submitted' ORDER BY updated_at DESC LIMIT 300").all() as { data: string }[])
      .map((r) => JSON.parse(r.data) as Attempt)
      .filter((a) => a.sections.some((s) => (s.skill === 'writing' || s.skill === 'speaking') && a.reviews[s.skill]?.source !== 'teacher'));
  },
  save(a: Attempt) {
    db.prepare(
      `INSERT INTO attempts (id, owner_id, status, data, created_at, updated_at) VALUES (?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data, updated_at=excluded.updated_at`,
    ).run(a.id, a.ownerId, a.status, JSON.stringify(a), a.createdAt, a.updatedAt);
  },
  delete: (id: string) => db.prepare('DELETE FROM attempts WHERE id = ?').run(id),
  reassign: (fromOwner: string, toOwner: string) => db.prepare('UPDATE attempts SET owner_id = ? WHERE owner_id = ?').run(toOwner, fromOwner),
};

// ---------- files (uploaded assets and speaking recordings) ----------
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
export const files = {
  get: (id: string) => db.prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRow | undefined,
  insert(f: Omit<FileRow, 'created_at'>, data: Buffer) {
    fs.writeFileSync(path.join(UPLOAD_DIR, f.id), data);
    db.prepare('INSERT INTO files (id, owner_id, kind, mime, size, filename, attempt_id, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
      f.id, f.owner_id, f.kind, f.mime, f.size, f.filename, f.attempt_id, new Date().toISOString(),
    );
  },
  path: (id: string) => path.join(UPLOAD_DIR, id.replace(/[^\w-]/g, '')),
  remove(id: string) {
    db.prepare('DELETE FROM files WHERE id = ?').run(id);
    fs.rmSync(files.path(id), { force: true });
  },
  removeForAttempt(attemptId: string) {
    const rows = db.prepare('SELECT id FROM files WHERE attempt_id = ?').all(attemptId) as { id: string }[];
    rows.forEach((r) => files.remove(r.id));
  },
  removeRecordingsForOwner(ownerId: string) {
    const rows = db.prepare("SELECT id FROM files WHERE owner_id = ? AND kind = 'recording'").all(ownerId) as { id: string }[];
    rows.forEach((r) => files.remove(r.id));
  },
};

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
