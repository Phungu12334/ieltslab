// Password hashing, sessions, and Google OAuth 2.0 (authorization code flow).
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { newId } from '../shared/engine';
import { attempts, sessions, users, type UserRow } from './db';
import { config } from './config';
import { cookie, HttpError, parseCookies } from './http';

const SESSION_COOKIE = 'bw_session';
const STATE_COOKIE = 'bw_oauth_state';
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export function validatePassword(pw: unknown): string {
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpError(400, 'Use a password of at least 8 characters.');
  if (pw.length > 200) throw new HttpError(400, 'That password is too long (200 characters maximum).');
  return pw;
}

export function validateEmail(email: unknown): string {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 200) throw new HttpError(400, 'Enter a valid email address.');
  return e;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Add a Set-Cookie header without overwriting cookies set earlier in the same response. */
export function appendCookie(res: ServerResponse, value: string) {
  const prev = res.getHeader('Set-Cookie');
  const list = prev === undefined ? [] : Array.isArray(prev) ? prev.map(String) : [String(prev)];
  const name = value.split('=')[0];
  res.setHeader('Set-Cookie', [...list.filter((c) => c.split('=')[0] !== name), value]);
}

export async function startSession(res: ServerResponse, userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sessions.insert(sha256(token), userId, expires.toISOString());
  appendCookie(res, cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure: config.secureCookies }));
}

export async function endSession(req: IncomingMessage, res: ServerResponse) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await sessions.delete(sha256(token));
  appendCookie(res, cookie(SESSION_COOKIE, '', { maxAge: 0, secure: config.secureCookies }));
}

export async function currentUser(req: IncomingMessage): Promise<UserRow | undefined> {
  const token = parseCookies(req)[SESSION_COOKIE];
  return token ? sessions.userFor(sha256(token)) : undefined;
}

export function currentTokenHash(req: IncomingMessage): string | undefined {
  const token = parseCookies(req)[SESSION_COOKIE];
  return token ? sha256(token) : undefined;
}

export async function requireUser(req: IncomingMessage): Promise<UserRow> {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, 'Your session has ended. Sign in again, or continue as a guest.');
  return u;
}

export async function requireAdmin(req: IncomingMessage): Promise<UserRow> {
  const u = await requireUser(req);
  if (u.role !== 'admin') throw new HttpError(403, 'Only administrators can manage test content.');
  return u;
}

/** Role for a newly registered account: listed admin emails, or the first real account when no admin exists. */
export async function roleFor(email: string | null): Promise<'admin' | 'candidate'> {
  if (email && config.adminEmails.includes(email)) return 'admin';
  if (config.firstUserAdmin && (await users.adminCount()) === 0) return 'admin';
  return 'candidate';
}

// ---------- simple in-memory rate limiting for sign-in ----------
const attemptsByKey = new Map<string, { count: number; first: number }>();
export function rateLimit(key: string, max = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  const rec = attemptsByKey.get(key);
  if (!rec || now - rec.first > windowMs) {
    attemptsByKey.set(key, { count: 1, first: now });
    return;
  }
  rec.count++;
  if (rec.count > max) throw new HttpError(429, 'Too many attempts. Wait 15 minutes and try again.');
}

// ---------- Google OAuth ----------
export function googleStart(res: ServerResponse) {
  if (!config.google) throw new HttpError(501, 'Google sign-in is not configured on this server.');
  const state = crypto.randomBytes(24).toString('base64url');
  appendCookie(res, cookie(STATE_COOKIE, state, { maxAge: 600, secure: config.secureCookies, path: '/api/auth/google' }));
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
}

export async function googleCallback(req: IncomingMessage, res: ServerResponse, query: URLSearchParams) {
  const fail = (msg: string) => {
    res.writeHead(302, { Location: `/#/account?error=${encodeURIComponent(msg)}` });
    res.end();
  };
  if (!config.google) return fail('Google sign-in is not configured on this server.');
  const expected = parseCookies(req)[STATE_COOKIE];
  appendCookie(res, cookie(STATE_COOKIE, '', { maxAge: 0, secure: config.secureCookies, path: '/api/auth/google' }));
  if (query.get('error')) return fail('Google sign-in was cancelled.');
  const code = query.get('code');
  const state = query.get('state');
  if (!code || !state || !expected || state.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return fail('The Google sign-in request expired or was invalid. Please try again.');
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('Google did not accept the sign-in. Check the OAuth client settings.');
    const token = (await tokenRes.json()) as { access_token?: string };
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!infoRes.ok) return fail('Could not read your Google profile.');
    const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
    if (!info.sub || !info.email || !info.email_verified) return fail('Your Google account needs a verified email address.');
    const email = info.email.toLowerCase();

    const current = await currentUser(req);
    let user = (await users.byGoogle(info.sub)) || (await users.byEmail(email));
    if (user && !user.google_sub) user = await users.update(user.id, { google_sub: info.sub });
    if (!user) {
      if (current?.is_guest) {
        // Upgrade the guest account so its saved tests are kept.
        user = await users.update(current.id, { email, name: info.name || email.split('@')[0], google_sub: info.sub, is_guest: 0, role: await roleFor(email) });
      } else {
        user = await users.insert({ id: newId('usr_'), email, name: info.name || email.split('@')[0], password_hash: null, google_sub: info.sub, role: await roleFor(email), is_guest: 0 });
      }
    } else if (current?.is_guest && current.id !== user.id) {
      await attempts.reassign(current.id, user.id);
      await users.delete(current.id);
    }
    const old = currentTokenHash(req);
    if (old) await sessions.delete(old);
    await startSession(res, user.id);
    res.writeHead(302, { Location: '/#/' });
    res.end();
  } catch (e) {
    console.error('Google sign-in failed', e);
    return fail('Google sign-in failed. Please try again.');
  }
}
