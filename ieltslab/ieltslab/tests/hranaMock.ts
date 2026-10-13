// Minimal stand-in for Turso's HTTP API (POST /v2/pipeline), backed by an in-memory SQLite database.
// Used only by tests so the Turso code path runs end to end without network access.
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

type V = { type: string; value?: string | number; base64?: string };

function decodeArg(a: V): unknown {
  if (a.type === 'null') return null;
  if (a.type === 'integer') return Number(a.value);
  if (a.type === 'float') return Number(a.value);
  if (a.type === 'text') return String(a.value);
  if (a.type === 'blob') return Buffer.from(a.base64 || '', 'base64');
  throw new Error(`bad arg type ${a.type}`);
}

function encodeCell(v: unknown): V {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'string') return { type: 'text', value: v };
  if (v instanceof Uint8Array) return { type: 'blob', base64: Buffer.from(v).toString('base64') };
  return { type: 'text', value: String(v) };
}

export function startHranaMock(token: string): Promise<{ url: string; close: () => void; requests: () => number }> {
  const db = new DatabaseSync(':memory:');
  let count = 0;
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v2/pipeline') {
      res.writeHead(404);
      return res.end();
    }
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401);
      return res.end('unauthorized');
    }
    count++;
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { requests: { type: string; stmt?: { sql: string; args?: V[] } }[] };
    const results = body.requests.map((r) => {
      if (r.type === 'close') return { type: 'ok', response: { type: 'close' } };
      try {
        const stmt = db.prepare(r.stmt!.sql);
        const args = (r.stmt!.args || []).map(decodeArg) as never[];
        const isRead = stmt.columns().length > 0;
        if (isRead) {
          const rows = stmt.all(...args) as Record<string, unknown>[];
          const cols = stmt.columns().map((c) => ({ name: c.name, decltype: null }));
          return { type: 'ok', response: { type: 'execute', result: { cols, rows: rows.map((row) => cols.map((c) => encodeCell(row[c.name]))), affected_row_count: 0, last_insert_rowid: null } } };
        }
        const info = stmt.run(...args);
        return { type: 'ok', response: { type: 'execute', result: { cols: [], rows: [], affected_row_count: Number(info.changes), last_insert_rowid: String(info.lastInsertRowid) } } };
      } catch (e) {
        return { type: 'error', error: { message: (e as Error).message, code: 'SQLITE_ERROR' } };
      }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ baton: null, base_url: null, results }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close(), requests: () => count });
    });
  });
}
