import { BAND_TABLES, SPEAKING_CRITERIA, WRITING_CRITERIA } from './constants';
import { SKILL_LABEL } from './constants';
import type {
  Attempt,
  AttemptResult,
  AttemptSection,
  Material,
  Question,
  QuestionGroup,
  QuestionResult,
  SkillResult,
  SkillReview,
  SpeakingStat,
  TestType,
  WritingTaskStat,
} from './types';

/** Normalise a typed answer for comparison: case, curly quotes, spacing, trailing punctuation, thousands separators. */
export function normalizeAnswer(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'.,;:!?()]+|[\s"'.,;:!?()]+$/g, '')
    .trim();
}

export function countWords(text: string): number {
  const t = (text || '').trim();
  if (!t) return 0;
  // Hyphenated words and contractions count as one word; numbers count as words.
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function countParagraphs(text: string): number {
  return (text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

export function optionLetter(i: number): string {
  return String.fromCharCode(65 + i);
}

export interface NumberedQuestion {
  number: number;
  question: Question;
  group: QuestionGroup;
  material: Material;
}

/** Number questions 1..n across the section, in material and group order. */
export function numberQuestions(section: Pick<AttemptSection, 'materials'>): NumberedQuestion[] {
  const out: NumberedQuestion[] = [];
  let n = 1;
  for (const material of section.materials) {
    for (const group of material.groups || []) {
      for (const question of group.questions) out.push({ number: n++, question, group, material });
    }
  }
  return out;
}

export function checkAnswer(group: QuestionGroup, question: Question, given: string): { correct: boolean; note?: string } {
  const g = normalizeAnswer(given);
  if (!g) return { correct: false };
  if (group.type === 'completion' && group.maxWords && countWords(given) > group.maxWords) {
    const accepted = question.answers.some((a) => normalizeAnswer(a) === g);
    return {
      correct: false,
      note: accepted
        ? `Over the word limit (maximum ${group.maxWords}), so this would be marked wrong.`
        : `Over the word limit (maximum ${group.maxWords}).`,
    };
  }
  const correct = question.answers.some((a) => normalizeAnswer(a) === g);
  return { correct };
}

export function rawToBand(skill: 'listening' | 'reading', testType: TestType, raw: number, total: number): { band: number; scaled: number } {
  if (total <= 0) return { band: 0, scaled: 0 };
  const scaled = Math.round((raw / total) * 40);
  const table = skill === 'listening' ? BAND_TABLES.listening : BAND_TABLES[testType === 'general' ? 'reading-general' : 'reading-academic'];
  const row = table.find(([min]) => scaled >= min);
  return { band: row ? row[1] : 0, scaled };
}

/** Round to the nearest half band (x.25 → x.5, x.75 → x+1), the convention used for the overall band. */
export function roundBand(x: number): number {
  const whole = Math.floor(x);
  const frac = x - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}

export function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
}

function scoreObjective(section: AttemptSection, testType: TestType): SkillResult {
  const numbered = numberQuestions(section);
  const questions: QuestionResult[] = numbered.map(({ number, question, group, material }) => {
    const given = section.answers[question.id] ?? '';
    const { correct, note } = checkAnswer(group, question, given);
    return {
      questionId: question.id,
      number,
      materialId: material.id,
      part: material.part,
      groupType: group.type,
      prompt: question.prompt,
      options: group.type === 'mcq' ? question.options : group.type === 'matching' ? group.options : undefined,
      given,
      correctAnswers: question.answers,
      correct,
      answered: normalizeAnswer(given).length > 0,
      note,
      explanation: question.explanation,
    };
  });
  const raw = questions.filter((q) => q.correct).length;
  const total = questions.length;
  const skill = section.skill as 'listening' | 'reading';
  const { band, scaled } = rawToBand(skill, testType, raw, total);
  return { skill: section.skill, raw, total, scaled, band: total ? band : null, bandSource: total ? 'auto' : 'pending', questions };
}

export function reviewBand(review: SkillReview | undefined, key: string, criteriaKeys: string[]): number | null {
  const item = review?.items[key];
  if (!item) return null;
  const vals = criteriaKeys.map((k) => item.scores[k]).filter((v): v is number => typeof v === 'number');
  if (vals.length !== criteriaKeys.length) return null;
  return roundBand(average(vals));
}

function scoreWriting(section: AttemptSection, review: SkillReview | undefined): SkillResult {
  const writing: WritingTaskStat[] = section.materials.map((m) => {
    const text = section.writing[m.id] || '';
    return {
      materialId: m.id,
      part: m.part,
      title: m.title,
      words: countWords(text),
      minWords: m.minWords || (m.part === 1 ? 150 : 250),
      paragraphs: countParagraphs(text),
    };
  });
  const detail: Record<string, number> = {};
  let weighted = 0;
  let weights = 0;
  let complete = true;
  for (const m of section.materials) {
    const keys = WRITING_CRITERIA[m.part === 1 ? 1 : 2].map((c) => c.key);
    const b = reviewBand(review, m.id, keys);
    if (b === null) {
      complete = false;
      continue;
    }
    detail[m.id] = b;
    const w = m.part === 2 ? 2 : 1; // Task 2 carries twice the weight of Task 1.
    weighted += b * w;
    weights += w;
  }
  const band = complete && weights > 0 ? roundBand(weighted / weights) : null;
  return { skill: 'writing', band, bandSource: band === null ? 'pending' : review!.source, writing, detail };
}

function scoreSpeaking(section: AttemptSection, review: SkillReview | undefined): SkillResult {
  const speaking: SpeakingStat[] = [];
  for (const m of section.materials) {
    const prompts = m.part === 2 ? [m.prompt || m.title] : m.speakingQuestions || [];
    prompts.forEach((p, i) => {
      const key = `${m.id}:${i}`;
      const rec = section.recordings[key];
      speaking.push({ key, materialId: m.id, part: m.part, prompt: p, recorded: !!rec, durationSec: rec?.durationSec || 0 });
    });
  }
  const band = reviewBand(review, 'speaking', SPEAKING_CRITERIA.map((c) => c.key));
  return { skill: 'speaking', band, bandSource: band === null ? 'pending' : review!.source, speaking };
}

/** Compute the full practice result for an attempt (pure; safe to call on server or client). */
export function computeResult(attempt: Attempt): AttemptResult {
  const skills: SkillResult[] = attempt.sections.map((s) => {
    if (s.skill === 'listening' || s.skill === 'reading') return scoreObjective(s, attempt.testType);
    if (s.skill === 'writing') return scoreWriting(s, attempt.reviews.writing);
    return scoreSpeaking(s, attempt.reviews.speaking);
  });
  let overall: number | null = null;
  let overallNote: string;
  const fourSkills = attempt.kind === 'full' && skills.length === 4;
  if (!fourSkills) {
    overallNote = 'An overall band needs all four skills. This was a single-skill practice test.';
  } else if (skills.some((s) => s.band === null)) {
    const pending = skills.filter((s) => s.band === null).map((s) => SKILL_LABEL[s.skill]);
    overallNote = `Overall band will appear when ${pending.join(' and ')} ${pending.length > 1 ? 'have' : 'has'} a band (complete a self-review or ask a teacher to review).`;
  } else if (attempt.missing.length > 0) {
    overall = roundBand(average(skills.map((s) => s.band as number)));
    overallNote = 'Estimate only: some parts were missing from this test because the content bank had no material for them.';
  } else {
    overall = roundBand(average(skills.map((s) => s.band as number)));
    const self = skills.some((s) => s.bandSource === 'self');
    const ai = skills.some((s) => s.bandSource === 'ai');
    overallNote = self
      ? 'Practice estimate. It includes your own self-assessment for Writing or Speaking.'
      : ai
        ? 'Practice estimate. It includes automated AI feedback for Writing, which is not an examiner judgement.'
        : 'Practice estimate based on this test’s answer key and the reviews recorded here.';
  }
  return { skills, overall, overallNote, scoredAt: new Date().toISOString() };
}
