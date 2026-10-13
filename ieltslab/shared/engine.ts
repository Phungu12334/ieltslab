// Test assembly, progress updates, submission and review — pure functions shared by server and browser.
import { FULL_TEST_ORDER, SECTION_SPEC, SKILL_LABEL, TEST_TYPE_LABEL } from './constants';
import { computeResult } from './scoring';
import type {
  Attempt,
  AttemptSection,
  AttemptSummary,
  Availability,
  CreateAttemptInput,
  CriterionReview,
  Material,
  MissingPart,
  ProgressPatch,
  ReviewSource,
  Skill,
  SkillReview,
  TestType,
} from './types';
import { SKILLS } from './types';

export function newId(prefix = ''): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  const raw = c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return prefix + raw.replace(/-/g, '').slice(0, 20);
}

/** Deterministic PRNG so an attempt can be reproduced from its seed. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function materialMatchesType(m: Material, testType: TestType): boolean {
  if (!SECTION_SPEC[m.skill].typeSpecific) return true;
  return m.testType === 'both' || m.testType === testType;
}

export function computeAvailability(materials: Material[]): Availability {
  const out = {} as Availability;
  for (const skill of SKILLS) {
    out[skill] = { academic: {}, general: {} };
    for (const t of ['academic', 'general'] as TestType[]) {
      for (const p of SECTION_SPEC[skill].parts) out[skill][t][p] = 0;
    }
  }
  for (const m of materials) {
    if (m.status !== 'active') continue;
    for (const t of ['academic', 'general'] as TestType[]) {
      if (materialMatchesType(m, t) && out[m.skill][t][m.part] !== undefined) out[m.skill][t][m.part]++;
    }
  }
  return out;
}

export interface AssembleOptions {
  skills: Skill[];
  testType: TestType;
  seed: string;
  /** Material ids the candidate has seen recently — chosen only when nothing unseen is left. */
  recentlyUsed?: string[];
}

/**
 * Pick one active material per part for each requested skill.
 * Rules: matches skill + part + test format; never repeats a material within the attempt;
 * prefers materials the candidate has not seen in recent attempts; otherwise random (seeded).
 */
export function assemble(materials: Material[], opts: AssembleOptions): { sections: { skill: Skill; materials: Material[] }[]; missing: MissingPart[] } {
  const rnd = seededRandom(opts.seed);
  const recent = new Set(opts.recentlyUsed || []);
  const used = new Set<string>();
  const missing: MissingPart[] = [];
  const sections = opts.skills.map((skill) => {
    const chosen: Material[] = [];
    for (const part of SECTION_SPEC[skill].parts) {
      const pool = materials.filter(
        (m) => m.status === 'active' && m.skill === skill && m.part === part && materialMatchesType(m, opts.testType) && !used.has(m.id),
      );
      if (pool.length === 0) {
        missing.push({ skill, part });
        continue;
      }
      // Speaking Part 3 follows the Part 2 topic when materials share a "topic:" tag.
      let topical = pool;
      if (skill === 'speaking' && part === 3) {
        const topics = chosen.filter((m) => m.part === 2).flatMap((m) => m.tags.filter((t) => t.startsWith('topic:')));
        const linked = pool.filter((m) => m.tags.some((t) => topics.includes(t)));
        if (linked.length) topical = linked;
      }
      const fresh = topical.filter((m) => !recent.has(m.id));
      const candidates = fresh.length ? fresh : topical;
      // Sort for determinism before the seeded pick.
      candidates.sort((a, b) => a.id.localeCompare(b.id));
      const pick = candidates[Math.floor(rnd() * candidates.length)];
      used.add(pick.id);
      chosen.push(JSON.parse(JSON.stringify(pick)) as Material);
    }
    return { skill, materials: chosen };
  });
  return { sections, missing };
}

export function attemptTitle(input: Pick<CreateAttemptInput, 'kind' | 'skills' | 'testType'>): string {
  const type = TEST_TYPE_LABEL[input.testType];
  if (input.kind === 'full') return `Full practice test · ${type}`;
  const skill = input.skills[0];
  const typed = SECTION_SPEC[skill].typeSpecific ? ` · ${type}` : '';
  return `${SKILL_LABEL[skill]} practice${typed}`;
}

export class EngineError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function validateCreateInput(input: unknown): CreateAttemptInput {
  const i = (input || {}) as Partial<CreateAttemptInput>;
  const kind = i.kind === 'full' ? 'full' : i.kind === 'section' ? 'section' : null;
  if (!kind) throw new EngineError('Choose a full test or a single skill.');
  const testType = i.testType === 'general' ? 'general' : i.testType === 'academic' ? 'academic' : null;
  if (!testType) throw new EngineError('Choose Academic or General Training.');
  let skills: Skill[];
  if (kind === 'full') skills = [...FULL_TEST_ORDER];
  else {
    const s = Array.isArray(i.skills) ? i.skills.filter((x): x is Skill => SKILLS.includes(x as Skill)) : [];
    if (s.length !== 1) throw new EngineError('Choose exactly one skill for a section test.');
    skills = s;
  }
  const playback = i.settings?.listeningPlayback === 'practice' ? 'practice' : 'exam';
  return { kind, skills, testType, settings: { listeningPlayback: playback } };
}

export function createAttempt(materials: Material[], rawInput: CreateAttemptInput, ownerId: string, recentlyUsed: string[] = []): Attempt {
  const input = validateCreateInput(rawInput);
  const seed = newId();
  const { sections, missing } = assemble(materials, { skills: input.skills, testType: input.testType, seed, recentlyUsed });
  const usable = sections.filter((s) => s.materials.length > 0);
  if (usable.length === 0) {
    throw new EngineError('There is no active material for this test yet. Add content in the Content manager, or restore the demo set.', 409);
  }
  const now = new Date().toISOString();
  const built: AttemptSection[] = usable.map((s) => ({
    skill: s.skill,
    materials: s.materials,
    timeLimitSec: SECTION_SPEC[s.skill].timeLimitSec,
    remainingSec: SECTION_SPEC[s.skill].timeLimitSec,
    status: 'pending',
    answers: {},
    flags: [],
    writing: {},
    recordings: {},
    audioState: {},
  }));
  return {
    id: newId('att_'),
    ownerId,
    kind: input.kind,
    testType: input.testType,
    title: attemptTitle(input),
    createdAt: now,
    updatedAt: now,
    status: 'in_progress',
    currentSection: 0,
    settings: input.settings,
    seed,
    sections: built,
    missing,
    reviews: {},
  };
}

const MAX_TEXT = 20000;

/** Apply a client progress patch, accepting only fields that are valid for the section's current state. */
export function applyProgress(attempt: Attempt, patch: ProgressPatch): Attempt {
  if (attempt.status !== 'in_progress') throw new EngineError('This test has already been submitted.', 409);
  const idx = Number(patch.sectionIndex);
  const section = attempt.sections[idx];
  if (!section) throw new EngineError('Unknown section.');
  if (section.status === 'submitted') throw new EngineError('This section has already been submitted.', 409);
  if (idx !== attempt.currentSection) throw new EngineError('Finish the current section first.', 409);
  if (patch.startSection && section.status === 'pending') {
    section.status = 'active';
    section.startedAt = new Date().toISOString();
  }
  if (section.status !== 'active') throw new EngineError('Start the section before answering.', 409);

  const questionIds = new Set(section.materials.flatMap((m) => m.groups.flatMap((g) => g.questions.map((q) => q.id))));
  if (patch.answers && typeof patch.answers === 'object') {
    for (const [k, v] of Object.entries(patch.answers)) {
      if (!questionIds.has(k) || typeof v !== 'string') continue;
      section.answers[k] = v.slice(0, 200);
    }
  }
  if (Array.isArray(patch.flags)) {
    section.flags = patch.flags.filter((f): f is string => typeof f === 'string').slice(0, 300);
  }
  const materialIds = new Set(section.materials.map((m) => m.id));
  if (patch.writing && typeof patch.writing === 'object') {
    for (const [k, v] of Object.entries(patch.writing)) {
      if (materialIds.has(k) && typeof v === 'string') section.writing[k] = v.slice(0, MAX_TEXT);
    }
  }
  if (patch.audioState && typeof patch.audioState === 'object') {
    for (const [k, v] of Object.entries(patch.audioState)) {
      if (!materialIds.has(k) || !v) continue;
      const prev = section.audioState[k] || { plays: 0, finished: false };
      // Play counts and "finished" only move forward, so exam playback limits cannot be reset.
      section.audioState[k] = {
        plays: Math.max(prev.plays, Math.min(99, Number(v.plays) || 0)),
        finished: prev.finished || !!v.finished,
      };
    }
  }
  if (typeof patch.remainingSec === 'number' && section.timeLimitSec > 0) {
    // Time only counts down.
    section.remainingSec = Math.max(0, Math.min(section.remainingSec, Math.floor(patch.remainingSec)));
  }
  attempt.updatedAt = new Date().toISOString();
  return attempt;
}

export function setRecording(attempt: Attempt, key: string, rec: { id: string; durationSec: number; mime: string }): Attempt {
  const section = attempt.sections[attempt.currentSection];
  if (attempt.status !== 'in_progress' || !section || section.skill !== 'speaking' || section.status !== 'active') {
    throw new EngineError('Recordings can only be saved during an active Speaking section.', 409);
  }
  const [materialId, idxStr] = key.split(':');
  const m = section.materials.find((x) => x.id === materialId);
  const idx = Number(idxStr);
  const count = m ? (m.part === 2 ? 1 : (m.speakingQuestions || []).length) : 0;
  if (!m || !Number.isInteger(idx) || idx < 0 || idx >= count) throw new EngineError('Unknown speaking question.');
  section.recordings[key] = { ...rec, durationSec: Math.max(0, Math.min(600, rec.durationSec)), createdAt: new Date().toISOString() };
  attempt.updatedAt = new Date().toISOString();
  return attempt;
}

/** Submit the current section; when it is the last one, the whole attempt is scored. */
export function submitSection(attempt: Attempt, sectionIndex: number, opts: { auto?: boolean } = {}): Attempt {
  if (attempt.status !== 'in_progress') throw new EngineError('This test has already been submitted.', 409);
  if (sectionIndex !== attempt.currentSection) throw new EngineError('Only the current section can be submitted.', 409);
  const section = attempt.sections[sectionIndex];
  if (!section) throw new EngineError('Unknown section.');
  const now = new Date().toISOString();
  section.status = 'submitted';
  section.submittedAt = now;
  if (!section.startedAt) section.startedAt = now;
  if (opts.auto) section.autoSubmitted = true;
  if (sectionIndex >= attempt.sections.length - 1) finalize(attempt);
  else attempt.currentSection = sectionIndex + 1;
  attempt.updatedAt = now;
  return attempt;
}

/** End the whole test now: every remaining section is submitted as it stands. */
export function endTest(attempt: Attempt): Attempt {
  if (attempt.status !== 'in_progress') return attempt;
  const now = new Date().toISOString();
  for (let i = attempt.currentSection; i < attempt.sections.length; i++) {
    const s = attempt.sections[i];
    if (s.status !== 'submitted') {
      s.status = 'submitted';
      s.submittedAt = now;
      if (!s.startedAt) s.startedAt = now;
    }
  }
  finalize(attempt);
  return attempt;
}

function finalize(attempt: Attempt) {
  attempt.status = 'submitted';
  attempt.submittedAt = new Date().toISOString();
  attempt.result = computeResult(attempt);
}

export function applyReview(
  attempt: Attempt,
  skill: 'writing' | 'speaking',
  source: ReviewSource,
  reviewer: string,
  items: Record<string, CriterionReview>,
): Attempt {
  if (attempt.status !== 'submitted') throw new EngineError('Reviews can be added after the test is submitted.', 409);
  const section = attempt.sections.find((s) => s.skill === skill);
  if (!section) throw new EngineError(`This attempt has no ${SKILL_LABEL[skill]} section.`);
  const existing = attempt.reviews[skill];
  if (existing && existing.source === 'teacher' && source !== 'teacher') {
    throw new EngineError('A teacher has already reviewed this section; their review takes priority.', 409);
  }
  const allowedKeys = skill === 'writing' ? section.materials.map((m) => m.id) : ['speaking'];
  const clean: Record<string, CriterionReview> = {};
  for (const key of allowedKeys) {
    const item = items?.[key];
    if (!item) continue;
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(item.scores || {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 9 && Math.round(n * 2) === n * 2) scores[k.slice(0, 8)] = n;
    }
    clean[key] = { scores, comment: String(item.comment || '').slice(0, 4000) };
  }
  if (Object.keys(clean).length === 0) throw new EngineError('Add at least one set of criterion scores.');
  const review: SkillReview = { source, reviewer: reviewer.slice(0, 80), at: new Date().toISOString(), items: clean };
  attempt.reviews[skill] = review;
  attempt.result = computeResult(attempt);
  attempt.updatedAt = new Date().toISOString();
  return attempt;
}

/** Remove answer keys, explanations, transcripts and marking notes from an in-progress attempt. */
export function redactAttempt(attempt: Attempt): Attempt {
  if (attempt.status === 'submitted') return attempt;
  const copy = JSON.parse(JSON.stringify(attempt)) as Attempt;
  for (const s of copy.sections) {
    for (const m of s.materials) {
      delete m.transcript;
      delete m.scoringGuidance;
      delete m.modelAnswer;
      if (m.audioAssetId || m.audioUrl) delete m.audioScript;
      for (const g of m.groups) for (const q of g.questions) {
        q.answers = [];
        delete q.explanation;
      }
    }
  }
  copy.redacted = true;
  return copy;
}

export function summarize(attempt: Attempt, ownerName?: string): AttemptSummary {
  const bands: AttemptSummary['bands'] = {};
  const pendingReview: Skill[] = [];
  for (const r of attempt.result?.skills || []) {
    bands[r.skill] = r.band;
    if (r.band === null && (r.skill === 'writing' || r.skill === 'speaking')) pendingReview.push(r.skill);
  }
  return {
    id: attempt.id,
    kind: attempt.kind,
    testType: attempt.testType,
    title: attempt.title,
    status: attempt.status,
    skills: attempt.sections.map((s) => s.skill),
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
    submittedAt: attempt.submittedAt,
    overall: attempt.result?.overall ?? null,
    bands,
    pendingReview,
    ownerName,
  };
}

export function materialIdsOf(attempt: Attempt): string[] {
  return attempt.sections.flatMap((s) => s.materials.map((m) => m.id));
}
