// Validation for content-manager input and JSON imports.
import { SECTION_SPEC, SPEAKING_DEFAULTS, TFNG_OPTIONS, WRITING_MIN_WORDS, YNNG_OPTIONS } from './constants';
import { newId } from './engine';
import { normalizeAnswer, optionLetter } from './scoring';
import type { Material, Question, QuestionGroup, QuestionType } from './types';
import { SKILLS } from './types';

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: FieldError[];
  material?: Material;
}

const QUESTION_TYPES: QuestionType[] = ['mcq', 'tfng', 'ynng', 'matching', 'completion'];

const str = (v: unknown, max = 100000) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const strList = (v: unknown, maxItems = 50, max = 2000) =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [])
    .map((x) => str(x, max))
    .filter(Boolean)
    .slice(0, maxItems);

function safeUrl(v: unknown, allowData: boolean): string | undefined {
  const s = str(v, 3_000_000);
  if (!s) return undefined;
  if (/^https:\/\//i.test(s)) return s;
  if (allowData && /^data:image\/(png|jpeg|webp|gif|svg\+xml);/i.test(s)) return s;
  return '__invalid__';
}

/**
 * Validate and normalise raw material input.
 * `existing` keeps id/createdAt/demo when editing.
 */
export function validateMaterial(input: unknown, existing?: Material): ValidationResult {
  const raw = (input || {}) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });

  const skill = SKILLS.includes(raw.skill as never) ? (raw.skill as Material['skill']) : null;
  if (!skill) add('skill', 'Choose a skill: listening, reading, writing or speaking.');
  const testType = ['academic', 'general', 'both'].includes(raw.testType as string) ? (raw.testType as Material['testType']) : 'both';
  if (raw.testType !== undefined && !['academic', 'general', 'both'].includes(raw.testType as string)) {
    add('testType', 'Test type must be academic, general or both.');
  }
  const part = Number(raw.part);
  if (skill && !SECTION_SPEC[skill].parts.includes(part)) {
    add('part', `${skill[0].toUpperCase() + skill.slice(1)} uses parts ${SECTION_SPEC[skill].parts.join(', ')}.`);
  }
  const title = str(raw.title, 200);
  if (!title) add('title', 'Give the material a title so you can find it later.');
  const instructions = str(raw.instructions, 4000);
  const status = raw.status === 'draft' ? 'draft' : 'active';
  const tags = strList(raw.tags, 20, 40).map((t) => t.toLowerCase());

  const m: Material = {
    id: existing?.id || (typeof raw.id === 'string' && /^[\w-]{3,60}$/.test(raw.id) ? raw.id : newId('mat_')),
    skill: skill || 'reading',
    testType,
    part: Number.isFinite(part) ? part : 1,
    title,
    instructions,
    groups: [],
    tags,
    status,
    demo: existing?.demo ?? raw.demo === true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Question groups (Reading and Listening).
  if (skill === 'reading' || skill === 'listening') {
    const groupsRaw = Array.isArray(raw.groups) ? raw.groups : [];
    if (groupsRaw.length === 0) add('groups', 'Add at least one question group.');
    const seenIds = new Set<string>();
    groupsRaw.slice(0, 20).forEach((g0, gi) => {
      const g = (g0 || {}) as Record<string, unknown>;
      const gf = `groups[${gi}]`;
      const type = QUESTION_TYPES.includes(g.type as QuestionType) ? (g.type as QuestionType) : null;
      if (!type) add(`${gf}.type`, `Group ${gi + 1}: choose a question type.`);
      const group: QuestionGroup = {
        id: typeof g.id === 'string' && g.id ? g.id.slice(0, 60) : newId('g_'),
        type: type || 'completion',
        instructions: str(g.instructions, 2000),
        questions: [],
      };
      if (!group.instructions) add(`${gf}.instructions`, `Group ${gi + 1}: add instructions for the candidate.`);
      if (type === 'matching') {
        group.options = strList(g.options, 26, 300);
        if (group.options.length < 2) add(`${gf}.options`, `Group ${gi + 1}: a matching list needs at least two options.`);
      }
      if (type === 'completion') {
        const mw = Number(g.maxWords);
        if (g.maxWords !== undefined && g.maxWords !== '' && g.maxWords !== null) {
          if (!Number.isInteger(mw) || mw < 1 || mw > 10) add(`${gf}.maxWords`, `Group ${gi + 1}: word limit must be a whole number from 1 to 10.`);
          else group.maxWords = mw;
        }
      }
      const qsRaw = Array.isArray(g.questions) ? g.questions : [];
      if (qsRaw.length === 0) add(`${gf}.questions`, `Group ${gi + 1}: add at least one question.`);
      qsRaw.slice(0, 40).forEach((q0, qi) => {
        const q = (q0 || {}) as Record<string, unknown>;
        const qf = `${gf}.questions[${qi}]`;
        const label = `Group ${gi + 1}, question ${qi + 1}`;
        let id = typeof q.id === 'string' && q.id ? q.id.slice(0, 60) : newId('q_');
        if (seenIds.has(id)) id = newId('q_');
        seenIds.add(id);
        const question: Question = { id, prompt: str(q.prompt, 2000), answers: [] };
        if (!question.prompt) add(`${qf}.prompt`, `${label}: add the question text.`);
        const answers = strList(q.answers, 12, 200);
        const explanation = str(q.explanation, 2000);
        if (explanation) question.explanation = explanation;
        if (type === 'mcq') {
          question.options = strList(q.options, 8, 500);
          if (question.options.length < 2) add(`${qf}.options`, `${label}: add at least two options.`);
          const letters = question.options.map((_, i) => optionLetter(i));
          question.answers = answers.map((a) => a.toUpperCase()).filter((a) => letters.includes(a));
          if (question.answers.length !== 1) add(`${qf}.answers`, `${label}: choose the correct option letter (${letters.join(', ') || 'A, B…'}).`);
        } else if (type === 'tfng' || type === 'ynng') {
          const allowed = type === 'tfng' ? TFNG_OPTIONS : YNNG_OPTIONS;
          question.answers = answers.map((a) => a.toUpperCase()).filter((a) => allowed.includes(a));
          if (question.answers.length !== 1) add(`${qf}.answers`, `${label}: answer must be one of ${allowed.join(' / ')}.`);
        } else if (type === 'matching') {
          const letters = (group.options || []).map((_, i) => optionLetter(i));
          question.answers = answers.map((a) => a.toUpperCase()).filter((a) => letters.includes(a));
          if (question.answers.length < 1) add(`${qf}.answers`, `${label}: choose a letter from the matching list.`);
        } else if (type === 'completion') {
          // Accept "a | b" or one per line for alternatives.
          question.answers = answers.flatMap((a) => a.split('|')).map((a) => a.trim()).filter(Boolean);
          if (question.answers.length < 1) add(`${qf}.answers`, `${label}: add at least one accepted answer.`);
          if (group.maxWords) {
            const tooLong = question.answers.find((a) => normalizeAnswer(a).split(' ').length > group.maxWords!);
            if (tooLong) add(`${qf}.answers`, `${label}: "${tooLong}" is longer than the ${group.maxWords}-word limit.`);
          }
        }
        group.questions.push(question);
      });
      m.groups.push(group);
    });
  }

  if (skill === 'reading') {
    m.passage = str(raw.passage, 30000);
    if (m.passage.length < 50) add('passage', 'Paste the reading passage (at least 50 characters).');
  }

  if (skill === 'listening') {
    const audioUrl = safeUrl(raw.audioUrl, false);
    if (audioUrl === '__invalid__') add('audioUrl', 'Audio links must start with https://.');
    else if (audioUrl) m.audioUrl = audioUrl;
    const assetId = str(raw.audioAssetId, 80);
    if (assetId) m.audioAssetId = assetId;
    const script = str(raw.audioScript, 20000);
    if (script) m.audioScript = script;
    const transcript = str(raw.transcript, 20000);
    if (transcript) m.transcript = transcript;
    if (status === 'active' && !m.audioAssetId && !m.audioUrl && !m.audioScript) {
      add('audio', 'Active listening material needs an audio file, an audio link, or a script for browser text-to-speech. Save it as a draft until the audio is ready.');
    }
  }

  if (skill === 'writing') {
    m.prompt = str(raw.prompt, 6000);
    if (!m.prompt) add('prompt', 'Add the task prompt.');
    m.bullets = strList(raw.bullets, 6, 400);
    const mw = raw.minWords === undefined || raw.minWords === '' ? WRITING_MIN_WORDS[part] || 150 : Number(raw.minWords);
    if (!Number.isInteger(mw) || mw < 20 || mw > 1000) add('minWords', 'Minimum words must be a whole number from 20 to 1000.');
    m.minWords = Number.isInteger(mw) ? mw : WRITING_MIN_WORDS[part] || 150;
    const img = safeUrl(raw.imageUrl, true);
    if (img === '__invalid__') add('imageUrl', 'Image links must start with https:// (or be an uploaded image).');
    else if (img) m.imageUrl = img;
    const imgId = str(raw.imageAssetId, 80);
    if (imgId) m.imageAssetId = imgId;
    const alt = str(raw.imageAlt, 1000);
    if (alt) m.imageAlt = alt;
    if ((m.imageUrl || m.imageAssetId) && !m.imageAlt) add('imageAlt', 'Describe the image in words so screen-reader users can do the task.');
    const sg = str(raw.scoringGuidance, 6000);
    if (sg) m.scoringGuidance = sg;
    const ma = str(raw.modelAnswer, 10000);
    if (ma) m.modelAnswer = ma;
  }

  if (skill === 'speaking') {
    const d = SPEAKING_DEFAULTS[part] || SPEAKING_DEFAULTS[1];
    if (part === 2) {
      m.prompt = str(raw.prompt, 1000);
      if (!m.prompt) add('prompt', 'Add the cue-card topic, e.g. "Describe a place you would like to visit."');
      m.bullets = strList(raw.bullets, 6, 300);
      if (m.bullets.length === 0) add('bullets', 'Add the cue-card points ("You should say: …").');
    } else {
      m.speakingQuestions = strList(raw.speakingQuestions, 15, 500);
      if (m.speakingQuestions.length === 0) add('speakingQuestions', 'Add at least one question, one per line.');
    }
    const prep = raw.prepSeconds === undefined || raw.prepSeconds === '' ? d.prep : Number(raw.prepSeconds);
    const resp = raw.responseSeconds === undefined || raw.responseSeconds === '' ? d.response : Number(raw.responseSeconds);
    if (!Number.isInteger(prep) || prep < 0 || prep > 300) add('prepSeconds', 'Preparation time must be 0–300 seconds.');
    if (!Number.isInteger(resp) || resp < 10 || resp > 300) add('responseSeconds', 'Response time must be 10–300 seconds.');
    m.prepSeconds = Number.isInteger(prep) ? prep : d.prep;
    m.responseSeconds = Number.isInteger(resp) ? resp : d.response;
    const sg = str(raw.scoringGuidance, 6000);
    if (sg) m.scoringGuidance = sg;
  }

  return { ok: errors.length === 0, errors, material: errors.length === 0 ? m : undefined };
}

export interface ImportReport {
  imported: Material[];
  failed: { index: number; title: string; errors: FieldError[] }[];
}

/** Validate a JSON import: either an array of materials or { materials: [...] }. */
export function validateImport(data: unknown): ImportReport {
  const list = Array.isArray(data) ? data : Array.isArray((data as { materials?: unknown[] })?.materials) ? (data as { materials: unknown[] }).materials : null;
  if (!list) {
    return { imported: [], failed: [{ index: 0, title: '(file)', errors: [{ field: 'file', message: 'Expected a JSON array of materials, or an object with a "materials" array.' }] }] };
  }
  const report: ImportReport = { imported: [], failed: [] };
  list.slice(0, 500).forEach((item, index) => {
    // Imported ids are regenerated to avoid overwriting existing material.
    const { id: _ignored, demo: _demo, ...rest } = (item || {}) as Record<string, unknown>;
    const r = validateMaterial(rest);
    if (r.ok && r.material) report.imported.push(r.material);
    else report.failed.push({ index, title: String((item as { title?: string })?.title || `Item ${index + 1}`), errors: r.errors });
  });
  return report;
}
