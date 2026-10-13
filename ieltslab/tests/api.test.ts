// End-to-end API test: starts a real server with a temporary database.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import type { Attempt } from '../shared/types';

const PORT = 8800 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let proc: ChildProcess;
let dataDir: string;

class Client {
  cookie = '';
  async req(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const isBuf = body instanceof Uint8Array;
    const res = await fetch(BASE + url, {
      method,
      headers: {
        ...(body !== undefined && !isBuf ? { 'Content-Type': 'application/json' } : {}),
        'X-IELTSLab': '1',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isBuf ? (body as BodyInit) : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const [pair] = c.split(';');
      const [name, value] = pair.split('=');
      if (name === 'bw_session') this.cookie = value ? `bw_session=${value}` : '';
    }
    const type = res.headers.get('content-type') || '';
    return { status: res.status, json: type.includes('json') ? await res.json() : null };
  }
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-api-'));
  proc = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE + '/api/health')).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});

after(() => {
  proc?.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('auth: register (first user is admin), login, CSRF header required', async () => {
  const admin = new Client();
  const reg = await admin.req('POST', '/api/auth/register', { name: 'Ms Tran', email: 'teacher@example.com', password: 'correct-horse' });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.role, 'admin');
  const dup = await new Client().req('POST', '/api/auth/register', { email: 'teacher@example.com', password: 'whatever12' });
  assert.equal(dup.status, 409);
  const bad = await new Client().req('POST', '/api/auth/login', { email: 'teacher@example.com', password: 'nope-nope' });
  assert.equal(bad.status, 401);
  const noHeader = await fetch(BASE + '/api/auth/guest', { method: 'POST' });
  assert.equal(noHeader.status, 403);
  const google = await fetch(BASE + '/api/auth/google/start', { redirect: 'manual' });
  assert.equal(google.status, 501, 'Google is reported as not configured instead of pretending');
});

test('guest takes a test; answers are hidden until submit; data isolated between users', async () => {
  const guest = new Client();
  const g = await guest.req('POST', '/api/auth/guest');
  assert.equal(g.json.user.isGuest, true);
  const created = await guest.req('POST', '/api/attempts', { kind: 'section', skills: ['reading'], testType: 'academic', settings: { listeningPlayback: 'exam' } });
  assert.equal(created.status, 201);
  const attempt = created.json.attempt as Attempt;
  assert.equal(attempt.redacted, true);
  const q = attempt.sections[0].materials[0].groups[0].questions[0];
  assert.deepEqual(q.answers, []);

  // Same content after reload (no reshuffle).
  const again = await guest.req('GET', `/api/attempts/${attempt.id}`);
  assert.deepEqual(again.json.attempt.sections[0].materials.map((m: { id: string }) => m.id), attempt.sections[0].materials.map((m) => m.id));

  // Another user cannot see it.
  const other = new Client();
  await other.req('POST', '/api/auth/guest');
  assert.equal((await other.req('GET', `/api/attempts/${attempt.id}`)).status, 404);
  assert.equal((await other.req('PATCH', `/api/attempts/${attempt.id}`, { sectionIndex: 0, startSection: true })).status, 404);

  const p = await guest.req('PATCH', `/api/attempts/${attempt.id}`, { sectionIndex: 0, startSection: true, answers: { [q.id]: 'TRUE' }, remainingSec: 3500 });
  assert.equal(p.status, 200);
  assert.equal(p.json.remainingSec, 3500);
  const sub = await guest.req('POST', `/api/attempts/${attempt.id}/submit`, { sectionIndex: 0 });
  assert.equal(sub.json.attempt.status, 'submitted');
  assert.ok(sub.json.attempt.result.skills[0].total > 0);
  assert.ok(sub.json.attempt.sections[0].materials[0].groups[0].questions[0].answers.length > 0, 'answers revealed after submit');

  // Guest upgrades to a real account and keeps history.
  const up = await guest.req('POST', '/api/auth/register', { name: 'Linh', email: 'linh@example.com', password: 'password123' });
  assert.equal(up.json.user.isGuest, false);
  assert.equal(up.json.user.role, 'candidate');
  const list = await guest.req('GET', '/api/attempts');
  assert.equal(list.json.attempts.length, 1);
});

test('content management requires admin and validates input', async () => {
  const cand = new Client();
  await cand.req('POST', '/api/auth/guest');
  assert.equal((await cand.req('GET', '/api/materials')).status, 403);

  const admin = new Client();
  await admin.req('POST', '/api/auth/login', { email: 'teacher@example.com', password: 'correct-horse' });
  const invalid = await admin.req('POST', '/api/materials', { skill: 'writing', part: 2, title: '' });
  assert.equal(invalid.status, 422);
  assert.ok(invalid.json.fields.some((f: { field: string }) => f.field === 'title'));
  const good = await admin.req('POST', '/api/materials', { skill: 'writing', testType: 'both', part: 2, title: 'My essay', instructions: 'Write 250 words', prompt: 'Discuss.' });
  assert.equal(good.status, 201);
  const upload = await admin.req('POST', '/api/assets', new Uint8Array([1, 2, 3]), { 'Content-Type': 'application/pdf' });
  assert.equal(upload.status, 415);
  const audio = await admin.req('POST', '/api/assets', new Uint8Array([73, 68, 51, 1]), { 'Content-Type': 'audio/mpeg', 'X-Filename': 'part1.mp3' });
  assert.equal(audio.status, 201);
  const del = await admin.req('DELETE', `/api/materials/${good.json.material.id}`);
  assert.equal(del.status, 200);
});

test('full test with teacher review produces an overall band', async () => {
  const cand = new Client();
  await cand.req('POST', '/api/auth/register', { email: 'cand@example.com', password: 'password123' });
  const { json } = await cand.req('POST', '/api/attempts', { kind: 'full', skills: [], testType: 'general', settings: { listeningPlayback: 'practice' } });
  const a = json.attempt as Attempt;
  for (let i = 0; i < 4; i++) {
    await cand.req('PATCH', `/api/attempts/${a.id}`, { sectionIndex: i, startSection: true });
    if (a.sections[i].skill === 'speaking') {
      const m = a.sections[i].materials[0];
      const r = await cand.req('POST', `/api/attempts/${a.id}/recordings?key=${encodeURIComponent(m.id + ':0')}&duration=12`, new Uint8Array([26, 69, 223, 163]), { 'Content-Type': 'audio/webm' });
      assert.equal(r.status, 201);
      const own = await cand.req('GET', `/api/files/${r.json.recording.id}`);
      assert.equal(own.status, 200);
      const stranger = new Client();
      await stranger.req('POST', '/api/auth/guest');
      assert.equal((await stranger.req('GET', `/api/files/${r.json.recording.id}`)).status, 404);
    }
    const s = await cand.req('POST', `/api/attempts/${a.id}/submit`, { sectionIndex: i });
    assert.equal(s.status, 200, JSON.stringify(s.json));
  }
  const admin = new Client();
  await admin.req('POST', '/api/auth/login', { email: 'teacher@example.com', password: 'correct-horse' });
  const queue = await admin.req('GET', '/api/reviews/queue');
  assert.ok(queue.json.attempts.some((x: { id: string }) => x.id === a.id));
  const full = (await admin.req('GET', `/api/attempts/${a.id}`)).json.attempt as Attempt;
  const w = full.sections.find((s) => s.skill === 'writing')!;
  const items = Object.fromEntries(w.materials.map((m) => [m.id, { scores: m.part === 1 ? { ta: 6, cc: 6, lr: 6, gra: 6 } : { tr: 6, cc: 6, lr: 6, gra: 6 }, comment: 'Good' }]));
  assert.equal((await admin.req('POST', `/api/attempts/${a.id}/reviews`, { skill: 'writing', items })).status, 200);
  const done = await admin.req('POST', `/api/attempts/${a.id}/reviews`, { skill: 'speaking', items: { speaking: { scores: { fc: 6, lr: 6, gra: 6, p: 6 }, comment: '' } } });
  assert.equal(done.json.attempt.reviews.speaking.source, 'teacher');
  assert.equal(typeof done.json.attempt.result.overall, 'number');
});
