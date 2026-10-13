import { config } from './config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { AUDIO_TYPES, IMAGE_TYPES, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, MAX_RECORDING_BYTES } from '../shared/constants';
import {
  applyProgress,
  applyReview,
  computeAvailability,
  createAttempt,
  endTest,
  EngineError,
  materialIdsOf,
  newId,
  redactAttempt,
  setRecording,
  submitSection,
  summarize,
  validateCreateInput,
} from '../shared/engine';
import type { Attempt, CriterionReview, ProgressPatch, UserSettings } from '../shared/types';
import { validateImport, validateMaterial } from '../shared/validate';
import { aiWritingReview } from './assess';
import {
  currentTokenHash,
  currentUser,
  endSession,
  googleCallback,
  googleStart,
  hashPassword,
  rateLimit,
  requireAdmin,
  requireUser,
  roleFor,
  startSession,
  validateEmail,
  validatePassword,
  verifyPassword,
} from './auth';
import { attempts, files, initDb, materials, safeJson, seedDemoContent, sessions, sql, toPublicUser, users, type UserRow } from './db';
import { HttpError, readBody, readJson, Router, sendJson, type Ctx } from './http';

const VERSION = '1.1.0';
const DIST = path.resolve('dist');
const api = new Router();

const ok = (ctx: Ctx, body: unknown, status = 200) => sendJson(ctx.res, status, body);
const ipOf = (ctx: Ctx) => String(ctx.req.headers['x-forwarded-for'] || ctx.req.socket.remoteAddress || '').split(',')[0].trim();

// ---------------------------------------------------------------- health & auth
api.get('/api/health', (ctx) => ok(ctx, { ok: true, mode: 'server', version: VERSION, google: !!config.google, ai: !!config.ai, storage: sql.kind }));

api.get('/api/auth/me', async (ctx) => {
  const u = await currentUser(ctx.req);
  ok(ctx, { user: u ? toPublicUser(u) : null });
});

api.post('/api/auth/guest', async (ctx) => {
  const existing = await currentUser(ctx.req);
  if (existing) return ok(ctx, { user: toPublicUser(existing) });
  rateLimit(`guest:${ipOf(ctx)}`, 30, 60 * 60_000);
  const u = await users.insert({ id: newId('usr_'), email: null, name: 'Guest', password_hash: null, google_sub: null, role: 'candidate', is_guest: 1 });
  await startSession(ctx.res, u.id);
  ok(ctx, { user: toPublicUser(u) });
});

api.post('/api/auth/register', async (ctx) => {
  const body = await readJson<{ name?: string; email?: string; password?: string }>(ctx.req);
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);
  const name = String(body.name || '').trim().slice(0, 80) || email.split('@')[0];
  rateLimit(`register:${ipOf(ctx)}`, 20, 60 * 60_000);
  if (await users.byEmail(email)) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
  const current = await currentUser(ctx.req);
  let user: UserRow;
  if (current?.is_guest) {
    // Upgrade the guest account in place so saved tests are kept.
    user = await users.update(current.id, { email, name, password_hash: hashPassword(password), is_guest: 0, role: await roleFor(email) });
  } else {
    user = await users.insert({ id: newId('usr_'), email, name, password_hash: hashPassword(password), google_sub: null, role: await roleFor(email), is_guest: 0 });
    if (current) await endSession(ctx.req, ctx.res);
    await startSession(ctx.res, user.id);
  }
  ok(ctx, { user: toPublicUser(user) }, 201);
});

api.post('/api/auth/login', async (ctx) => {
  const body = await readJson<{ email?: string; password?: string }>(ctx.req);
  const email = validateEmail(body.email);
  rateLimit(`login:${ipOf(ctx)}:${email}`);
  const user = await users.byEmail(email);
  if (!user || !verifyPassword(String(body.password || ''), user.password_hash)) {
    throw new HttpError(401, user && !user.password_hash ? 'This account uses Google sign-in. Use "Continue with Google".' : 'Email or password is incorrect.');
  }
  const current = await currentUser(ctx.req);
  if (current?.is_guest && current.id !== user.id) {
    // Bring the guest's tests into the signed-in account.
    await attempts.reassign(current.id, user.id);
    await endSession(ctx.req, ctx.res);
    await users.delete(current.id);
  } else if (current) await endSession(ctx.req, ctx.res);
  await startSession(ctx.res, user.id);
  ok(ctx, { user: toPublicUser(user) });
});

api.post('/api/auth/logout', async (ctx) => {
  await endSession(ctx.req, ctx.res);
  ok(ctx, { ok: true });
});

api.get('/api/auth/google/start', (ctx) => googleStart(ctx.res));
api.get('/api/auth/google/callback', (ctx) => googleCallback(ctx.req, ctx.res, ctx.query));

// ---------------------------------------------------------------- account
api.patch('/api/account', async (ctx) => {
  const u = await requireUser(ctx.req);
  const body = await readJson<{ name?: string; settings?: UserSettings }>(ctx.req);
  const fields: Partial<UserRow> = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 80);
    if (!name) throw new HttpError(400, 'Name cannot be empty.');
    fields.name = name;
  }
  if (body.settings && typeof body.settings === 'object') {
    const s: UserSettings = { ...safeJson<UserSettings>(u.settings, {}) };
    if (body.settings.targetBand !== undefined) {
      const t = Number(body.settings.targetBand);
      if (!(t >= 1 && t <= 9 && Math.round(t * 2) === t * 2)) throw new HttpError(400, 'Target band must be between 1 and 9 in half-band steps.');
      s.targetBand = t;
    }
    if (body.settings.defaultTestType) s.defaultTestType = body.settings.defaultTestType === 'general' ? 'general' : 'academic';
    if (body.settings.theme) s.theme = ['light', 'dark'].includes(body.settings.theme) ? body.settings.theme : 'system';
    fields.settings = JSON.stringify(s);
  }
  ok(ctx, { user: toPublicUser(await users.update(u.id, fields)) });
});

api.post('/api/account/password', async (ctx) => {
  const u = await requireUser(ctx.req);
  if (u.is_guest) throw new HttpError(400, 'Create an account first.');
  const body = await readJson<{ current?: string; next?: string }>(ctx.req);
  if (u.password_hash && !verifyPassword(String(body.current || ''), u.password_hash)) throw new HttpError(400, 'Your current password is incorrect.');
  const next = validatePassword(body.next);
  await users.update(u.id, { password_hash: hashPassword(next) });
  await sessions.deleteForUser(u.id, currentTokenHash(ctx.req)); // sign out other devices
  ok(ctx, { ok: true });
});

api.delete('/api/account', async (ctx) => {
  const u = await requireUser(ctx.req);
  const body = await readJson<{ confirm?: string }>(ctx.req);
  if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
  if (u.role === 'admin' && (await users.adminCount()) <= 1) {
    throw new HttpError(409, 'You are the only administrator. Make someone else an admin (ADMIN_EMAILS) before deleting this account.');
  }
  await endSession(ctx.req, ctx.res);
  await users.delete(u.id); // also removes their attempts, recordings and sessions
  ok(ctx, { ok: true });
});

// ---------------------------------------------------------------- content
api.get('/api/content/availability', async (ctx) => {
  const all = await materials.all();
  ok(ctx, { availability: computeAvailability(all), total: all.length, active: all.filter((m) => m.status === 'active').length });
});

api.get('/api/materials', async (ctx) => {
  await requireAdmin(ctx.req);
  ok(ctx, { materials: await materials.all() });
});

api.post('/api/materials', async (ctx) => {
  await requireAdmin(ctx.req);
  const r = validateMaterial(await readJson(ctx.req, 8 * 1024 * 1024));
  if (!r.ok || !r.material) throw new HttpError(422, 'Please fix the highlighted fields.', r.errors);
  if (await materials.get(r.material.id)) r.material.id = newId('mat_');
  await materials.upsert(r.material);
  ok(ctx, { material: r.material }, 201);
});

api.put('/api/materials/:id', async (ctx) => {
  await requireAdmin(ctx.req);
  const existing = await materials.get(ctx.params.id);
  if (!existing) throw new HttpError(404, 'This material no longer exists.');
  const r = validateMaterial(await readJson(ctx.req, 8 * 1024 * 1024), existing);
  if (!r.ok || !r.material) throw new HttpError(422, 'Please fix the highlighted fields.', r.errors);
  await materials.upsert(r.material);
  ok(ctx, { material: r.material });
});

api.delete('/api/materials/:id', async (ctx) => {
  await requireAdmin(ctx.req);
  if (!(await materials.get(ctx.params.id))) throw new HttpError(404, 'This material no longer exists.');
  await materials.delete(ctx.params.id); // attempts keep their own snapshot, so past results are unaffected
  ok(ctx, { ok: true });
});

api.post('/api/materials/import', async (ctx) => {
  await requireAdmin(ctx.req);
  const report = validateImport(await readJson(ctx.req, 20 * 1024 * 1024));
  await materials.upsertMany(report.imported);
  ok(ctx, { imported: report.imported.length, failed: report.failed });
});

api.post('/api/materials/demo', async (ctx) => {
  await requireAdmin(ctx.req);
  const body = await readJson<{ action?: string }>(ctx.req);
  if (body.action === 'restore') await seedDemoContent();
  else if (body.action === 'remove') await materials.deleteDemo();
  else throw new HttpError(400, 'Unknown action.');
  ok(ctx, { ok: true });
});

// ---------------------------------------------------------------- files
api.post('/api/assets', async (ctx) => {
  const u = await requireAdmin(ctx.req);
  const mime = String(ctx.req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const isAudio = mime in AUDIO_TYPES;
  const isImage = mime in IMAGE_TYPES;
  if (!isAudio && !isImage) {
    throw new HttpError(415, 'Unsupported file type. Audio: MP3, WAV, OGG, M4A/AAC or WEBM. Images: PNG, JPEG, WEBP or GIF.');
  }
  const data = await readBody(ctx.req, isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES);
  if (!data.length) throw new HttpError(400, 'The file is empty.');
  const id = newId('file_');
  const filename = decodeURIComponent(String(ctx.req.headers['x-filename'] || '')).slice(0, 200) || null;
  await files.insert({ id, owner_id: u.id, kind: 'asset', mime, size: data.length, filename, attempt_id: null }, data);
  ok(ctx, { id, url: `/api/files/${id}`, mime, size: data.length, filename }, 201);
});

api.get('/api/files/:id', async (ctx) => {
  const u = await requireUser(ctx.req);
  const f = await files.get(ctx.params.id);
  if (!f) throw new HttpError(404, 'File not found.');
  if (f.kind === 'recording' && f.owner_id !== u.id && u.role !== 'admin') throw new HttpError(404, 'File not found.');
  const data = await files.read(f.id);
  if (!data) throw new HttpError(404, 'File not found.');
  const size = data.length;
  const headers: Record<string, string> = {
    'Content-Type': f.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(ctx.req.headers.range || ''));
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start < 0 || end < start) {
      ctx.res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return ctx.res.end();
    }
    ctx.res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) });
    ctx.res.end(data.subarray(start, end + 1));
  } else {
    ctx.res.writeHead(200, { ...headers, 'Content-Length': String(size) });
    ctx.res.end(data);
  }
});

// ---------------------------------------------------------------- attempts
async function loadOwned(ctx: Ctx, opts: { allowAdmin?: boolean } = {}): Promise<{ attempt: Attempt; user: UserRow }> {
  const user = await requireUser(ctx.req);
  const attempt = await attempts.get(ctx.params.id);
  if (!attempt || (attempt.ownerId !== user.id && !(opts.allowAdmin && user.role === 'admin'))) {
    throw new HttpError(404, 'This test could not be found. It may have been deleted.');
  }
  return { attempt, user };
}

api.get('/api/attempts', async (ctx) => {
  const u = await requireUser(ctx.req);
  ok(ctx, { attempts: (await attempts.forOwner(u.id)).map((a) => summarize(a)) });
});

api.post('/api/attempts', async (ctx) => {
  const u = await requireUser(ctx.req);
  const input = validateCreateInput(await readJson(ctx.req));
  const recent = (await attempts.forOwner(u.id)).slice(0, 5).flatMap(materialIdsOf);
  const attempt = createAttempt(await materials.all(), input, u.id, recent);
  await attempts.save(attempt);
  ok(ctx, { attempt: redactAttempt(attempt) }, 201);
});

api.get('/api/attempts/:id', async (ctx) => {
  const { attempt, user } = await loadOwned(ctx, { allowAdmin: true });
  const owner = attempt.ownerId === user.id ? null : await users.byId(attempt.ownerId);
  ok(ctx, { attempt: redactAttempt(attempt), ownerName: owner ? owner.name : undefined });
});

api.patch('/api/attempts/:id', async (ctx) => {
  const { attempt } = await loadOwned(ctx);
  const patch = await readJson<ProgressPatch>(ctx.req, 1024 * 1024);
  applyProgress(attempt, patch);
  await attempts.save(attempt);
  const s = attempt.sections[patch.sectionIndex];
  ok(ctx, { ok: true, updatedAt: attempt.updatedAt, remainingSec: s.remainingSec, status: s.status, startedAt: s.startedAt });
});

api.post('/api/attempts/:id/submit', async (ctx) => {
  const { attempt } = await loadOwned(ctx);
  const body = await readJson<{ sectionIndex?: number; auto?: boolean; final?: ProgressPatch }>(ctx.req, 1024 * 1024);
  if (body.final && attempt.sections[attempt.currentSection]?.status === 'active') applyProgress(attempt, body.final);
  submitSection(attempt, Number(body.sectionIndex), { auto: !!body.auto });
  await attempts.save(attempt);
  ok(ctx, { attempt: redactAttempt(attempt) });
});

api.post('/api/attempts/:id/end', async (ctx) => {
  const { attempt } = await loadOwned(ctx);
  const body = await readJson<{ final?: ProgressPatch }>(ctx.req, 1024 * 1024);
  if (body.final && attempt.sections[attempt.currentSection]?.status === 'active') applyProgress(attempt, body.final);
  endTest(attempt);
  await attempts.save(attempt);
  ok(ctx, { attempt });
});

api.delete('/api/attempts/:id', async (ctx) => {
  const { attempt } = await loadOwned(ctx);
  await files.removeForAttempt(attempt.id);
  await attempts.delete(attempt.id);
  ok(ctx, { ok: true });
});

api.post('/api/attempts/:id/recordings', async (ctx) => {
  const { attempt, user } = await loadOwned(ctx);
  const key = ctx.query.get('key') || '';
  const duration = Number(ctx.query.get('duration') || 0);
  const mime = String(ctx.req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('audio/')) throw new HttpError(415, 'Recordings must be audio.');
  const data = await readBody(ctx.req, MAX_RECORDING_BYTES);
  if (!data.length) throw new HttpError(400, 'The recording is empty. Check your microphone and try again.');
  const previous = attempt.sections[attempt.currentSection]?.recordings[key];
  const id = newId('rec_');
  setRecording(attempt, key, { id, durationSec: duration, mime }); // validates before storing the file
  await files.insert({ id, owner_id: user.id, kind: 'recording', mime, size: data.length, filename: null, attempt_id: attempt.id }, data);
  if (previous) await files.remove(previous.id); // re-record replaces the old take
  await attempts.save(attempt);
  ok(ctx, { recording: attempt.sections[attempt.currentSection].recordings[key] }, 201);
});

api.post('/api/attempts/:id/reviews', async (ctx) => {
  const { attempt, user } = await loadOwned(ctx, { allowAdmin: true });
  const body = await readJson<{ skill?: string; items?: Record<string, CriterionReview>; asTeacher?: boolean }>(ctx.req);
  if (body.skill !== 'writing' && body.skill !== 'speaking') throw new HttpError(400, 'Reviews are for Writing or Speaking.');
  const isOwner = attempt.ownerId === user.id;
  const teacher = user.role === 'admin' && (!isOwner || body.asTeacher === true);
  if (!isOwner && !teacher) throw new HttpError(403, 'You cannot review this test.');
  applyReview(attempt, body.skill, teacher ? 'teacher' : 'self', teacher ? user.name : 'Self-review', body.items || {});
  await attempts.save(attempt);
  ok(ctx, { attempt });
});

const aiUsage = new Map<string, { day: string; n: number }>();
api.post('/api/attempts/:id/ai-review', async (ctx) => {
  const { attempt, user } = await loadOwned(ctx);
  if (!config.ai) throw new HttpError(501, 'AI feedback is not configured on this server.');
  if (attempt.status !== 'submitted') throw new HttpError(409, 'Submit the test first.');
  if (attempt.reviews.writing?.source === 'teacher') throw new HttpError(409, 'A teacher has already reviewed this Writing.');
  const day = new Date().toISOString().slice(0, 10);
  const use = aiUsage.get(user.id);
  const n = use && use.day === day ? use.n : 0;
  if (n >= 10) throw new HttpError(429, 'You have reached today’s limit of 10 AI feedback requests.');
  aiUsage.set(user.id, { day, n: n + 1 });
  const items = await aiWritingReview(attempt);
  applyReview(attempt, 'writing', 'ai', `AI feedback (${config.ai.model})`, items);
  await attempts.save(attempt);
  ok(ctx, { attempt });
});

api.get('/api/reviews/queue', async (ctx) => {
  await requireAdmin(ctx.req);
  const list = await attempts.submittedNeedingReview();
  const names = new Map<string, string>();
  for (const a of list) if (!names.has(a.ownerId)) names.set(a.ownerId, (await users.byId(a.ownerId))?.name || 'Deleted user');
  ok(ctx, { attempts: list.map((a) => summarize(a, names.get(a.ownerId))) });
});

// ---------------------------------------------------------------- server
const STATIC_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.map': 'application/json',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function serveStatic(pathname: string, res: http.ServerResponse) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  let file = path.resolve(DIST, rel);
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    rel = 'index.html';
    file = path.join(DIST, rel);
  }
  if (!fs.existsSync(file)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('The web app has not been built yet. Run "npm run build" (or "npm run dev").');
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': rel === 'index.html' ? 'no-cache' : 'public, max-age=3600',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const method = req.method || 'GET';
  if (!url.pathname.startsWith('/api/')) {
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    return serveStatic(url.pathname, res);
  }
  try {
    // CSRF protection: state-changing API calls must come from our own pages (custom header + same origin).
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = req.headers.origin;
      if (req.headers['x-ieltslab'] !== '1') throw new HttpError(403, 'Request blocked (missing app header).');
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Request blocked (cross-site).');
    }
    const match = api.match(method, url.pathname);
    if (match === null) throw new HttpError(404, 'Not found.');
    if (match === 'method') throw new HttpError(405, 'Method not allowed.');
    await match.handler({ req, res, params: match.params, query: url.searchParams });
  } catch (e) {
    if (res.headersSent) return res.end();
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message, fields: e.details });
    if (e instanceof EngineError) return sendJson(res, e.status, { error: e.message });
    console.error(e);
    sendJson(res, 500, { error: 'Something went wrong on the server. Please try again.' });
  }
});

async function main() {
  try {
    await initDb();
  } catch (e) {
    console.error('Could not open the database:', (e as Error).message);
    if (sql.kind === 'turso') console.error('Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
    process.exit(1);
  }
  setInterval(() => void sessions.purgeExpired().catch(() => undefined), 6 * 3600_000).unref();
  server.listen(config.port, config.host, () => {
    console.log(`IELTSLab running at ${config.publicUrl}`);
    console.log(`  Database: ${sql.kind === 'turso' ? 'Turso (hosted)' : 'local SQLite file'}`);
    console.log(`  Google sign-in: ${config.google ? 'enabled' : 'not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'}`);
    console.log(`  AI writing feedback: ${config.ai ? `enabled (${config.ai.model})` : 'not configured (set ANTHROPIC_API_KEY)'}`);
  });
}
void main();
