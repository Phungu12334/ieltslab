// Browser-only implementation used when no IELTSLab server is reachable (demo / offline mode).
// Everything is stored in IndexedDB on this device. Accounts and Google sign-in need the server.
import { AUDIO_TYPES, IMAGE_TYPES, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES } from '../../shared/constants';
import { DEMO_MATERIALS } from '../../shared/demoContent';
import {
  applyProgress,
  applyReview,
  computeAvailability,
  createAttempt,
  endTest,
  EngineError,
  materialIdsOf,
  newId,
  setRecording,
  submitSection,
  summarize,
} from '../../shared/engine';
import type { Attempt, Material, PublicUser } from '../../shared/types';
import { newBuiltIns } from '../../shared/demoSync';
import { validateImport, validateMaterial } from '../../shared/validate';
import { openStore, type KvStore } from './idb';
import { ApiError, type Api, type Health } from './types';

const LOCAL_USER_ID = 'local';

function wrap<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((e) => {
    if (e instanceof EngineError) throw new ApiError(e.status, e.message);
    throw e;
  });
}

export async function createLocalApi(): Promise<Api> {
  const store: KvStore = await openStore();
  const health: Health = { mode: 'local', version: '1.0.0', google: false, ai: false, volatile: store.volatile };

  if (!(await store.get('seeded'))) {
    await store.set('materials', DEMO_MATERIALS);
    await store.set('seeded', true);
    await store.set('offeredDemoIds', DEMO_MATERIALS.map((m) => m.id));
  } else {
    // Add built-in materials released since this browser was first set up.
    const offered = ((await store.get<string[]>('offeredDemoIds')) as string[] | undefined) ?? null;
    const fresh = newBuiltIns(DEMO_MATERIALS, offered);
    if (fresh.length) {
      const current = ((await store.get<Material[]>('materials')) as Material[] | undefined) || [];
      const have = new Set(current.map((m) => m.id));
      await store.set('materials', [...current, ...fresh.filter((m) => !have.has(m.id))]);
    }
    if (fresh.length || !offered) await store.set('offeredDemoIds', DEMO_MATERIALS.map((m) => m.id));
  }

  const defaultProfile = (): PublicUser => ({
    id: LOCAL_USER_ID,
    email: null,
    name: 'Local practice',
    role: 'admin',
    isGuest: true,
    hasPassword: false,
    googleLinked: false,
    settings: {},
    createdAt: new Date().toISOString(),
  });
  const profile = async () => ((await store.get<PublicUser>('profile')) as PublicUser | undefined) || defaultProfile();
  const materials = async () => ((await store.get<Material[]>('materials')) as Material[] | undefined) || [];
  const getAttempt = async (id: string) => {
    const a = (await store.get<Attempt>(`attempt:${id}`)) as Attempt | undefined;
    if (!a) throw new ApiError(404, 'This test could not be found. It may have been deleted.');
    return a;
  };
  const saveAttempt = (a: Attempt) => store.set(`attempt:${a.id}`, a);
  const allAttempts = async () => {
    const keys = await store.keys('attempt:');
    const list = (await Promise.all(keys.map((k) => store.get<Attempt>(k)))) as Attempt[];
    return list.filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };
  const objectUrls = new Map<string, string>();

  const noAccounts = () => {
    throw new ApiError(501, 'Accounts need the IELTSLab server. This copy is running in browser-only mode, so your tests are saved on this device instead.');
  };

  return {
    mode: 'local',
    health,
    me: profile,
    guest: profile,
    register: async () => noAccounts(),
    login: async () => noAccounts(),
    logout: async () => undefined,
    googleUrl: () => null,
    updateAccount: async (input) => {
      const p = await profile();
      const next: PublicUser = { ...p, name: input.name?.trim() || p.name, settings: { ...p.settings, ...(input.settings || {}) } };
      await store.set('profile', next);
      return next;
    },
    changePassword: async () => noAccounts(),
    deleteAccount: async () => noAccounts(),

    availability: async () => {
      const all = await materials();
      return { availability: computeAvailability(all), total: all.length, active: all.filter((m) => m.status === 'active').length };
    },
    listMaterials: materials,
    saveMaterial: async (input, id) => {
      const all = await materials();
      const existing = id ? all.find((m) => m.id === id) : undefined;
      if (id && !existing) throw new ApiError(404, 'This material no longer exists.');
      const r = validateMaterial(input, existing);
      if (!r.ok || !r.material) throw new ApiError(422, 'Please fix the highlighted fields.', r.errors);
      if (!existing && all.some((m) => m.id === r.material!.id)) r.material.id = newId('mat_');
      await store.set('materials', existing ? all.map((m) => (m.id === id ? r.material! : m)) : [r.material, ...all]);
      return r.material;
    },
    deleteMaterial: async (id) => {
      await store.set('materials', (await materials()).filter((m) => m.id !== id));
    },
    importMaterials: async (data) => {
      const report = validateImport(data);
      await store.set('materials', [...report.imported, ...(await materials())]);
      return { imported: report.imported.length, failed: report.failed };
    },
    demoContent: async (action) => {
      const others = (await materials()).filter((m) => !m.demo);
      await store.set('materials', action === 'restore' ? [...others, ...DEMO_MATERIALS] : others);
    },
    uploadAsset: async (file) => {
      const isAudio = file.type in AUDIO_TYPES;
      const isImage = file.type in IMAGE_TYPES;
      if (!isAudio && !isImage) throw new ApiError(415, 'Unsupported file type. Audio: MP3, WAV, OGG, M4A/AAC or WEBM. Images: PNG, JPEG, WEBP or GIF.');
      const limit = isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > limit) throw new ApiError(413, `File is too large. The limit is ${limit / 1024 / 1024} MB.`);
      const id = newId('file_');
      await store.set(`file:${id}`, file);
      return { id, url: '' };
    },
    fileUrl: async (id) => {
      if (objectUrls.has(id)) return objectUrls.get(id)!;
      const blob = (await store.get<Blob>(`file:${id}`)) as Blob | undefined;
      if (!blob) throw new ApiError(404, 'File not found on this device.');
      const url = URL.createObjectURL(blob);
      objectUrls.set(id, url);
      return url;
    },

    listAttempts: async () => (await allAttempts()).map((a) => summarize(a)),
    createAttempt: (input) =>
      wrap(async () => {
        const recent = (await allAttempts()).slice(0, 5).flatMap(materialIdsOf);
        const a = createAttempt(await materials(), input, LOCAL_USER_ID, recent);
        await saveAttempt(a);
        return a;
      }),
    getAttempt: async (id) => ({ attempt: await getAttempt(id) }),
    saveProgress: (id, patch) =>
      wrap(async () => {
        const a = applyProgress(await getAttempt(id), patch);
        await saveAttempt(a);
        return { remainingSec: a.sections[patch.sectionIndex].remainingSec, updatedAt: a.updatedAt };
      }),
    submitSection: (id, idx, opts = {}) =>
      wrap(async () => {
        let a = await getAttempt(id);
        if (opts.final && a.sections[a.currentSection]?.status === 'active') a = applyProgress(a, opts.final);
        submitSection(a, idx, { auto: opts.auto });
        await saveAttempt(a);
        return a;
      }),
    endTest: (id, final) =>
      wrap(async () => {
        let a = await getAttempt(id);
        if (final && a.sections[a.currentSection]?.status === 'active') a = applyProgress(a, final);
        endTest(a);
        await saveAttempt(a);
        return a;
      }),
    deleteAttempt: async (id) => {
      const a = await getAttempt(id);
      for (const s of a.sections) for (const r of Object.values(s.recordings)) await store.delete(`file:${r.id}`);
      await store.delete(`attempt:${id}`);
    },
    uploadRecording: (id, key, blob, durationSec) =>
      wrap(async () => {
        const a = await getAttempt(id);
        const prev = a.sections[a.currentSection]?.recordings[key];
        const recId = newId('rec_');
        setRecording(a, key, { id: recId, durationSec, mime: blob.type || 'audio/webm' });
        await store.set(`file:${recId}`, blob);
        if (prev) await store.delete(`file:${prev.id}`);
        await saveAttempt(a);
        return a.sections[a.currentSection].recordings[key];
      }),
    saveReview: (id, skill, items) =>
      wrap(async () => {
        const a = applyReview(await getAttempt(id), skill, 'self', 'Self-review', items);
        await saveAttempt(a);
        return a;
      }),
    aiReview: async () => {
      throw new ApiError(501, 'AI feedback needs the IELTSLab server with ANTHROPIC_API_KEY configured.');
    },
    reviewQueue: async () => [],
    resetLocalData: async () => {
      await store.clear();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
      objectUrls.clear();
      await store.set('materials', DEMO_MATERIALS);
      await store.set('seeded', true);
      await store.set('offeredDemoIds', DEMO_MATERIALS.map((m) => m.id));
    },
  };
}
