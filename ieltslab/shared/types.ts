// Core domain types shared by the browser app and the Node server.

export type Skill = 'listening' | 'reading' | 'writing' | 'speaking';
export const SKILLS: Skill[] = ['listening', 'reading', 'writing', 'speaking'];

/** Test format chosen by the candidate. */
export type TestType = 'academic' | 'general';
/** Material can target one format or be usable in both. */
export type MaterialTestType = TestType | 'both';

export type QuestionType =
  | 'mcq' // single-answer multiple choice, options A, B, C…
  | 'tfng' // TRUE / FALSE / NOT GIVEN (facts)
  | 'ynng' // YES / NO / NOT GIVEN (writer's views)
  | 'matching' // choose a letter from a shared list (headings, features, information)
  | 'completion'; // type the missing word(s) — notes, sentences, tables, short answers

export interface Question {
  id: string;
  prompt: string;
  /** Only for mcq: the option texts, labelled A, B, C… in order. */
  options?: string[];
  /** Accepted answers. Letters for mcq/matching, TRUE/FALSE/NOT GIVEN etc. for tfng/ynng, text for completion. */
  answers: string[];
  explanation?: string;
}

export interface QuestionGroup {
  id: string;
  type: QuestionType;
  instructions: string;
  /** Only for matching: the shared list, labelled A, B, C… in order. */
  options?: string[];
  /** Only for completion: word limit, e.g. 2 for "NO MORE THAN TWO WORDS". */
  maxWords?: number;
  questions: Question[];
}

export type MaterialStatus = 'active' | 'draft';

export interface Material {
  id: string;
  skill: Skill;
  testType: MaterialTestType;
  /** Listening part 1–4, Reading passage/section 1–3, Writing task 1–2, Speaking part 1–3. */
  part: number;
  title: string;
  instructions: string;
  /** Reading passage. Paragraphs are separated by blank lines. A line like "A " at paragraph start is kept as a label. */
  passage?: string;
  /** Writing task prompt or Speaking Part 2 cue-card topic. */
  prompt?: string;
  /** Writing letter bullet points or Speaking Part 2 cue-card points. */
  bullets?: string[];
  /** Speaking Part 1 / Part 3 questions. */
  speakingQuestions?: string[];
  /** Listening: uploaded audio file id. */
  audioAssetId?: string;
  /** Listening: external audio URL (https). */
  audioUrl?: string;
  /** Listening: script read aloud by the browser's text-to-speech when no audio file exists. */
  audioScript?: string;
  /** Listening transcript shown after the test. */
  transcript?: string;
  /** Writing Task 1 visual: uploaded image id or https/data URL. */
  imageAssetId?: string;
  imageUrl?: string;
  imageAlt?: string;
  groups: QuestionGroup[];
  /** Writing: minimum word count (150 for Task 1, 250 for Task 2 by default). */
  minWords?: number;
  /** Writing/Speaking: notes for markers, shown after the test. */
  scoringGuidance?: string;
  /** Writing: a sample answer shown after the test. */
  modelAnswer?: string;
  /** Speaking: preparation time (Part 2) and response time per question. */
  prepSeconds?: number;
  responseSeconds?: number;
  tags: string[];
  status: MaterialStatus;
  /** True for the bundled demo set. */
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingRef {
  id: string;
  durationSec: number;
  mime: string;
  createdAt: string;
}

export interface AudioState {
  plays: number;
  finished: boolean;
}

export type SectionStatus = 'pending' | 'active' | 'submitted';

export interface AttemptSection {
  skill: Skill;
  /** Snapshot of the materials chosen for this attempt (fixed for the life of the attempt). */
  materials: Material[];
  /** 0 means no overall countdown (Speaking uses per-question timers). */
  timeLimitSec: number;
  remainingSec: number;
  status: SectionStatus;
  /** questionId -> answer */
  answers: Record<string, string>;
  /** Question ids (or speaking keys) marked for review. */
  flags: string[];
  /** materialId -> essay/letter text */
  writing: Record<string, string>;
  /** `${materialId}:${index}` -> recording */
  recordings: Record<string, RecordingRef>;
  /** materialId -> listening audio state */
  audioState: Record<string, AudioState>;
  startedAt?: string;
  submittedAt?: string;
  /** Set when time ran out and the section was submitted automatically. */
  autoSubmitted?: boolean;
}

export type AttemptKind = 'full' | 'section';
export type AttemptStatus = 'in_progress' | 'submitted';
export type ListeningPlayback = 'exam' | 'practice';

export interface AttemptSettings {
  listeningPlayback: ListeningPlayback;
}

export interface MissingPart {
  skill: Skill;
  part: number;
}

export interface Attempt {
  id: string;
  ownerId: string;
  kind: AttemptKind;
  testType: TestType;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: AttemptStatus;
  currentSection: number;
  settings: AttemptSettings;
  seed: string;
  sections: AttemptSection[];
  /** Parts that had no available material when the attempt was assembled. */
  missing: MissingPart[];
  reviews: Partial<Record<'writing' | 'speaking', SkillReview>>;
  result?: AttemptResult;
  submittedAt?: string;
  /** True when the server removed answer keys from this copy. */
  redacted?: boolean;
}

export type ReviewSource = 'teacher' | 'self' | 'ai';

export interface CriterionReview {
  /** criterion key -> band 0–9 (whole or half) */
  scores: Record<string, number>;
  comment: string;
}

export interface SkillReview {
  source: ReviewSource;
  reviewer: string;
  at: string;
  /** Writing: one entry per task material id. Speaking: a single entry under key "speaking". */
  items: Record<string, CriterionReview>;
}

export type BandSource = 'auto' | ReviewSource | 'pending';

export interface QuestionResult {
  questionId: string;
  number: number;
  materialId: string;
  part: number;
  groupType: QuestionType;
  prompt: string;
  options?: string[];
  given: string;
  correctAnswers: string[];
  correct: boolean;
  answered: boolean;
  note?: string;
  explanation?: string;
}

export interface WritingTaskStat {
  materialId: string;
  part: number;
  title: string;
  words: number;
  minWords: number;
  paragraphs: number;
}

export interface SpeakingStat {
  key: string;
  materialId: string;
  part: number;
  prompt: string;
  recorded: boolean;
  durationSec: number;
}

export interface SkillResult {
  skill: Skill;
  raw?: number;
  total?: number;
  /** Raw score scaled to the 40-question scale used by band tables. */
  scaled?: number;
  band: number | null;
  bandSource: BandSource;
  questions?: QuestionResult[];
  writing?: WritingTaskStat[];
  speaking?: SpeakingStat[];
  /** Per-task / per-review bands for Writing & Speaking. */
  detail?: Record<string, number>;
}

export interface AttemptResult {
  skills: SkillResult[];
  overall: number | null;
  overallNote: string;
  scoredAt: string;
}

export interface UserSettings {
  targetBand?: number;
  defaultTestType?: TestType;
  theme?: 'system' | 'light' | 'dark';
}

export interface PublicUser {
  id: string;
  email: string | null;
  name: string;
  role: 'admin' | 'candidate';
  isGuest: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  settings: UserSettings;
  createdAt: string;
}

export interface AttemptSummary {
  id: string;
  kind: AttemptKind;
  testType: TestType;
  title: string;
  status: AttemptStatus;
  skills: Skill[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  overall: number | null;
  bands: Partial<Record<Skill, number | null>>;
  pendingReview: Skill[];
  ownerName?: string;
}

/** Number of active materials per skill → test type → part. */
export type Availability = Record<Skill, Record<TestType, Record<number, number>>>;

/** Fields the client may change while taking a test. */
export interface ProgressPatch {
  sectionIndex: number;
  answers?: Record<string, string>;
  flags?: string[];
  writing?: Record<string, string>;
  remainingSec?: number;
  audioState?: Record<string, AudioState>;
  startSection?: boolean;
}

export interface CreateAttemptInput {
  kind: AttemptKind;
  skills: Skill[];
  testType: TestType;
  settings: AttemptSettings;
}
