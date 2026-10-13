// Database access with two backends:
//  - local: Node's built-in node:sqlite file (default, needs a persistent disk)
//  - turso: a hosted libSQL/SQLite database over HTTPS (set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN),
//    for hosts whose disk is wiped on restart, such as Render's free plan.
// Both speak the same SQLite dialect, so the queries are identical.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Param = string | number | null | Uint8Array;
export type Row = Record<string, unknown>;

export interface Sql {
  kind: 'local' | 'turso';
  all<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: Param[]): Promise<T | undefined>;
  run(sql: string, params?: Param[]): Promise<void>;
  /** Several statements in one round trip (not a transaction). */
  batch(stmts: { sql: string; params?: Param[] }[]): Promise<void>;
}

export function localSql(file: string): Sql {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const norm = (p: Param[]) => p.map((v) => (v instanceof Uint8Array && !(v instanceof Buffer) ? Buffer.from(v) : v));
  return {
    kind: 'local',
    all: async <T,>(sql: string, params: Param[] = []) => db.prepare(sql).all(...(norm(params) as never[])) as T[],
    get: async <T,>(sql: string, params: Param[] = []) => db.prepare(sql).get(...(norm(params) as never[])) as T | undefined,
    run: async (sql, params = []) => void db.prepare(sql).run(...(norm(params) as never[])),
    batch: async (stmts) => {
      for (const s of stmts) db.prepare(s.sql).run(...(norm(s.params || []) as never[]));
    },
  };
}

type HranaValue =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

function encode(v: Param): HranaValue {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (typeof v === 'string') return { type: 'text', value: v };
  return { type: 'blob', base64: Buffer.from(v).toString('base64') };
}

function decode(v: HranaValue): unknown {
  switch (v.type) {
    case 'null':
      return null;
    case 'integer':
      return Number(v.value);
    case 'float':
      return Number(v.value);
    case 'text':
      return v.value;
    case 'blob':
      return Buffer.from(v.base64 || '', 'base64');
    default:
      return null;
  }
}

interface ExecuteResult {
  cols: { name: string }[];
  rows: HranaValue[][];
}

export function tursoSql(databaseUrl: string, authToken: string): Sql {
  const base = databaseUrl.replace(/^(libsql|turso|wss?):\/\//, 'https://').replace(/\/$/, '');
  const endpoint = `${base}/v2/pipeline`;

  async function pipeline(stmts: { sql: string; params?: Param[] }[]): Promise<ExecuteResult[]> {
    const requests = [
      ...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: (s.params || []).map(encode) } })),
      { type: 'close' },
    ];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ baton: null, requests }),
      });
    } catch (e) {
      throw new Error(`Cannot reach the database (${(e as Error).message}).`);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Database request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as { results: ({ type: 'ok'; response: { type: string; result?: ExecuteResult } } | { type: 'error'; error: { message: string } })[] };
    const out: ExecuteResult[] = [];
    body.results.slice(0, stmts.length).forEach((r) => {
      if (r.type === 'error') throw new Error(`Database error: ${r.error.message}`);
      out.push(r.response.result || { cols: [], rows: [] });
    });
    return out;
  }

  const toRows = <T,>(r: ExecuteResult): T[] =>
    r.rows.map((row) => Object.fromEntries(r.cols.map((c, i) => [c.name, decode(row[i])])) as T);

  return {
    kind: 'turso',
    all: async <T,>(sql: string, params: Param[] = []) => toRows<T>((await pipeline([{ sql, params }]))[0]),
    get: async <T,>(sql: string, params: Param[] = []) => toRows<T>((await pipeline([{ sql, params }]))[0])[0],
    run: async (sql, params = []) => void (await pipeline([{ sql, params }])),
    batch: async (stmts) => {
      if (stmts.length) await pipeline(stmts);
    },
  };
}
