// Runtime configuration from environment variables. See .env.example.
import fs from 'node:fs';
import path from 'node:path';

// Load a local .env file if present (simple KEY=VALUE lines; real environment variables win).
const envFile = path.resolve('.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const port = Number(process.env.PORT || 8787);
// Render sets RENDER_EXTERNAL_URL automatically, so PUBLIC_URL is optional there.
const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, '');
const env = (k: string) => (process.env[k] || '').trim();

export const config = {
  port,
  host: env('HOST') || '0.0.0.0',
  publicUrl,
  production: process.env.NODE_ENV === 'production',
  secureCookies: env('COOKIE_SECURE') ? env('COOKIE_SECURE') === 'true' : publicUrl.startsWith('https://'),
  adminEmails: env('ADMIN_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  firstUserAdmin: env('FIRST_USER_ADMIN') !== 'false',
  google:
    env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')
      ? { clientId: env('GOOGLE_CLIENT_ID'), clientSecret: env('GOOGLE_CLIENT_SECRET'), redirectUri: `${publicUrl}/api/auth/google/callback` }
      : null,
  ai: env('ANTHROPIC_API_KEY') ? { apiKey: env('ANTHROPIC_API_KEY'), model: env('ASSESSMENT_MODEL') || 'claude-sonnet-5-5' } : null,
};
