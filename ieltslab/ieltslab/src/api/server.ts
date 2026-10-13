import type { Attempt, AttemptSummary, Material, PublicUser, RecordingRef } from '../../shared/types';
import { ApiError, type Api, type AvailabilityInfo, type Health, type ImportResult } from './types';

async function call<T>(method: string, url: string, body?: unknown, opts: { raw?: Blob; headers?: Record<string, string>; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      keepalive: opts.keepalive,
      headers: {
        'X-IELTSLab': '1',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      },
      body: opts.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection; your answers are kept on this page and will be saved when the connection returns.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: ApiError['fields'] } & T;
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`, data.fields);
  return data;
}

export function createServerApi(health: Health): Api {
  return {
    mode: 'server',
    health,
    me: async () => (await call<{ user: PublicUser | null }>('GET', '/api/auth/me')).user,
    guest: async () => (await call<{ user: PublicUser }>('POST', '/api/auth/guest')).user,
    register: async (input) => (await call<{ user: PublicUser }>('POST', '/api/auth/register', input)).user,
    login: async (input) => (await call<{ user: PublicUser }>('POST', '/api/auth/login', input)).user,
    logout: async () => void (await call('POST', '/api/auth/logout')),
    googleUrl: () => (health.google ? '/api/auth/google/start' : null),
    updateAccount: async (input) => (await call<{ user: PublicUser }>('PATCH', '/api/account', input)).user,
    changePassword: async (current, next) => void (await call('POST', '/api/account/password', { current, next })),
    deleteAccount: async () => void (await call('DELETE', '/api/account', { confirm: 'DELETE' })),

    availability: () => call<AvailabilityInfo>('GET', '/api/content/availability'),
    listMaterials: async () => (await call<{ materials: Material[] }>('GET', '/api/materials')).materials,
    saveMaterial: async (input, id) =>
      (await call<{ material: Material }>(id ? 'PUT' : 'POST', id ? `/api/materials/${encodeURIComponent(id)}` : '/api/materials', input)).material,
    deleteMaterial: async (id) => void (await call('DELETE', `/api/materials/${encodeURIComponent(id)}`)),
    importMaterials: (data) => call<ImportResult>('POST', '/api/materials/import', data),
    demoContent: async (action) => void (await call('POST', '/api/materials/demo', { action })),
    uploadAsset: async (file) =>
      call<{ id: string; url: string }>('POST', '/api/assets', undefined, {
        raw: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) },
      }),
    fileUrl: async (id) => `/api/files/${encodeURIComponent(id)}`,

    listAttempts: async () => (await call<{ attempts: AttemptSummary[] }>('GET', '/api/attempts')).attempts,
    createAttempt: async (input) => (await call<{ attempt: Attempt }>('POST', '/api/attempts', input)).attempt,
    getAttempt: (id) => call<{ attempt: Attempt; ownerName?: string }>('GET', `/api/attempts/${encodeURIComponent(id)}`),
    saveProgress: (id, patch, opts) => call('PATCH', `/api/attempts/${encodeURIComponent(id)}`, patch, { keepalive: opts?.keepalive }),
    submitSection: async (id, sectionIndex, opts = {}) =>
      (await call<{ attempt: Attempt }>('POST', `/api/attempts/${encodeURIComponent(id)}/submit`, { sectionIndex, ...opts })).attempt,
    endTest: async (id, final) => (await call<{ attempt: Attempt }>('POST', `/api/attempts/${encodeURIComponent(id)}/end`, { final })).attempt,
    deleteAttempt: async (id) => void (await call('DELETE', `/api/attempts/${encodeURIComponent(id)}`)),
    uploadRecording: async (id, key, blob, durationSec) =>
      (
        await call<{ recording: RecordingRef }>(
          'POST',
          `/api/attempts/${encodeURIComponent(id)}/recordings?key=${encodeURIComponent(key)}&duration=${Math.round(durationSec)}`,
          undefined,
          { raw: blob, headers: { 'Content-Type': blob.type || 'audio/webm' } },
        )
      ).recording,
    saveReview: async (id, skill, items, asTeacher) =>
      (await call<{ attempt: Attempt }>('POST', `/api/attempts/${encodeURIComponent(id)}/reviews`, { skill, items, asTeacher })).attempt,
    aiReview: async (id) => (await call<{ attempt: Attempt }>('POST', `/api/attempts/${encodeURIComponent(id)}/ai-review`)).attempt,
    reviewQueue: async () => (await call<{ attempts: AttemptSummary[] }>('GET', '/api/reviews/queue')).attempts,
  };
}
