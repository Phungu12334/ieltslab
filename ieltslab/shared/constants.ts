import type { QuestionType, Skill, TestType } from './types';

export const APP_NAME = 'IELTSLab';
export const DISCLAIMER =
  'IELTSLab is an independent practice tool. It is not affiliated with, endorsed by, or connected to IELTS, the British Council, IDP: IELTS Australia or Cambridge University Press & Assessment. Practice results are estimates, not official IELTS scores.';

export const SKILL_LABEL: Record<Skill, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

export const TEST_TYPE_LABEL: Record<TestType | 'both', string> = {
  academic: 'Academic',
  general: 'General Training',
  both: 'Academic & General Training',
};

/** Order used in a full test (same order as the real paper-based and computer-delivered tests). */
export const FULL_TEST_ORDER: Skill[] = ['listening', 'reading', 'writing', 'speaking'];

export interface SectionSpec {
  parts: number[];
  timeLimitSec: number;
  partLabel: string;
  /** Whether the content differs between Academic and General Training. */
  typeSpecific: boolean;
  summary: Record<TestType, string>;
}

export const SECTION_SPEC: Record<Skill, SectionSpec> = {
  listening: {
    parts: [1, 2, 3, 4],
    timeLimitSec: 30 * 60,
    partLabel: 'Part',
    typeSpecific: false,
    summary: {
      academic: '4 parts · about 30 minutes · same for Academic and General Training',
      general: '4 parts · about 30 minutes · same for Academic and General Training',
    },
  },
  reading: {
    parts: [1, 2, 3],
    timeLimitSec: 60 * 60,
    partLabel: 'Passage',
    typeSpecific: true,
    summary: {
      academic: '3 long passages from books, journals and magazines · 60 minutes',
      general: '3 sections of everyday, workplace and general-interest texts · 60 minutes',
    },
  },
  writing: {
    parts: [1, 2],
    timeLimitSec: 60 * 60,
    partLabel: 'Task',
    typeSpecific: true,
    summary: {
      academic: 'Task 1 describes visual information (150+ words) · Task 2 essay (250+ words) · 60 minutes',
      general: 'Task 1 letter (150+ words) · Task 2 essay (250+ words) · 60 minutes',
    },
  },
  speaking: {
    parts: [1, 2, 3],
    timeLimitSec: 0,
    partLabel: 'Part',
    typeSpecific: false,
    summary: {
      academic: 'Interview, long turn with 1 minute preparation, discussion · 11–14 minutes',
      general: 'Interview, long turn with 1 minute preparation, discussion · 11–14 minutes',
    },
  },
};

export function partLabel(skill: Skill, part: number, testType?: TestType): string {
  if (skill === 'reading' && testType === 'general') return `Section ${part}`;
  return `${SECTION_SPEC[skill].partLabel} ${part}`;
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  tfng: 'True / False / Not Given',
  ynng: 'Yes / No / Not Given',
  matching: 'Matching',
  completion: 'Completion / short answer',
};

export const TFNG_OPTIONS = ['TRUE', 'FALSE', 'NOT GIVEN'];
export const YNNG_OPTIONS = ['YES', 'NO', 'NOT GIVEN'];

export const WRITING_MIN_WORDS: Record<number, number> = { 1: 150, 2: 250 };
export const SPEAKING_DEFAULTS: Record<number, { prep: number; response: number }> = {
  1: { prep: 0, response: 30 },
  2: { prep: 60, response: 120 },
  3: { prep: 0, response: 60 },
};

/**
 * Approximate raw-score → band conversion tables (out of 40).
 * These follow the conversion bands widely published for practice purposes. Official
 * tables vary slightly between test versions, so results are estimates.
 * Each row: [minimum raw score, band].
 */
export const BAND_TABLES: Record<'listening' | 'reading-academic' | 'reading-general', [number, number][]> = {
  listening: [
    [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5],
    [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
  ],
  'reading-academic': [
    [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5],
    [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
  ],
  'reading-general': [
    [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5],
    [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0],
  ],
};

export interface Criterion {
  key: string;
  label: string;
  short: string;
  /** Plain-language summary of what markers look for, written for this app. */
  focus: string;
  /** Short reminders of what typically separates the bands. */
  levels: { band: number; text: string }[];
}

export const WRITING_CRITERIA: Record<1 | 2, Criterion[]> = {
  1: [
    {
      key: 'ta', label: 'Task Achievement', short: 'TA',
      focus: 'Covers the requirements of the task. Academic: a clear overview of main trends or stages with accurate key details. General Training: all bullet points covered with a clear purpose and an appropriate tone.',
      levels: [
        { band: 9, text: 'Fully meets every requirement; overview and details are complete and precise.' },
        { band: 7, text: 'Clear overview or purpose; key features well selected, though some could be extended.' },
        { band: 5, text: 'Covers the task only partly; overview missing or unclear, or details mechanical or inaccurate.' },
        { band: 3, text: 'Barely addresses the task; key features largely missing or wrong.' },
      ],
    },
    criterionCC(),
    criterionLR(),
    criterionGRA(),
  ],
  2: [
    {
      key: 'tr', label: 'Task Response', short: 'TR',
      focus: 'Answers every part of the question with a clear position that is developed and supported throughout.',
      levels: [
        { band: 9, text: 'Fully developed response; position clear throughout; ideas extended and well supported.' },
        { band: 7, text: 'Addresses all parts; clear position; main ideas extended, though some may over-generalise.' },
        { band: 5, text: 'Addresses the task only partly; position unclear at times; ideas limited or repetitive.' },
        { band: 3, text: 'Does not adequately address the question; few relevant ideas.' },
      ],
    },
    criterionCC(),
    criterionLR(),
    criterionGRA(),
  ],
};

function criterionCC(): Criterion {
  return {
    key: 'cc', label: 'Coherence & Cohesion', short: 'CC',
    focus: 'Logical organisation, clear paragraphing, and linking words and referencing used accurately and naturally.',
    levels: [
      { band: 9, text: 'Cohesion so natural it attracts no attention; paragraphing skilful.' },
      { band: 7, text: 'Logically organised with clear progression; a range of linking devices, minor over- or under-use.' },
      { band: 5, text: 'Some organisation but progression unclear; linking repetitive, mechanical or inaccurate.' },
      { band: 3, text: 'Ideas not organised logically; very limited linking.' },
    ],
  };
}
function criterionLR(): Criterion {
  return {
    key: 'lr', label: 'Lexical Resource', short: 'LR',
    focus: 'Range and precision of vocabulary, collocation, and accurate spelling and word formation.',
    levels: [
      { band: 9, text: 'Wide, natural and sophisticated vocabulary; errors extremely rare.' },
      { band: 7, text: 'Enough range for flexibility and precision; some less common items; occasional errors.' },
      { band: 5, text: 'Limited range, minimally adequate; noticeable errors that may cause difficulty for the reader.' },
      { band: 3, text: 'Very limited range; errors severely distort the message.' },
    ],
  };
}
function criterionGRA(): Criterion {
  return {
    key: 'gra', label: 'Grammatical Range & Accuracy', short: 'GRA',
    focus: 'Variety of sentence structures and how accurately grammar and punctuation are controlled.',
    levels: [
      { band: 9, text: 'Wide range of structures with full flexibility; errors extremely rare.' },
      { band: 7, text: 'A variety of complex structures; frequent error-free sentences; good control.' },
      { band: 5, text: 'Limited range; complex sentences attempted but less accurate; frequent errors.' },
      { band: 3, text: 'Very few sentence forms; errors dominate.' },
    ],
  };
}

export const SPEAKING_CRITERIA: Criterion[] = [
  {
    key: 'fc', label: 'Fluency & Coherence', short: 'FC',
    focus: 'Speaking at length without unnatural pauses, and connecting ideas so the listener can follow.',
    levels: [
      { band: 9, text: 'Fluent with only rare, content-related hesitation; fully coherent.' },
      { band: 7, text: 'Speaks at length without noticeable effort; some hesitation or self-correction.' },
      { band: 5, text: 'Keeps going but relies on repetition, self-correction or slow speech.' },
      { band: 3, text: 'Long pauses; limited ability to link simple sentences.' },
    ],
  },
  {
    key: 'lr', label: 'Lexical Resource', short: 'LR',
    focus: 'Range of vocabulary, idiomatic language and the ability to paraphrase when stuck.',
    levels: [
      { band: 9, text: 'Full flexibility and precision on all topics; idiomatic language used naturally.' },
      { band: 7, text: 'Flexible vocabulary on a variety of topics; some less common and idiomatic items.' },
      { band: 5, text: 'Manages familiar topics; limited flexibility; paraphrase attempts with mixed success.' },
      { band: 3, text: 'Simple vocabulary for personal information only.' },
    ],
  },
  {
    key: 'gra', label: 'Grammatical Range & Accuracy', short: 'GRA',
    focus: 'Variety of structures and accuracy in spontaneous speech.',
    levels: [
      { band: 9, text: 'Full range of structures, used naturally and accurately.' },
      { band: 7, text: 'Range of complex structures with some flexibility; frequent error-free sentences.' },
      { band: 5, text: 'Basic forms with reasonable accuracy; complex structures limited and error-prone.' },
      { band: 3, text: 'Attempts basic forms with limited success.' },
    ],
  },
  {
    key: 'p', label: 'Pronunciation', short: 'P',
    focus: 'Clarity of individual sounds, word and sentence stress, rhythm and intonation.',
    levels: [
      { band: 9, text: 'Full range of features used precisely; effortless to understand.' },
      { band: 7, text: 'Many positive features; generally easy to understand; L1 accent has little effect.' },
      { band: 5, text: 'Some effective features; mispronunciations sometimes reduce clarity.' },
      { band: 3, text: 'Frequently unintelligible.' },
    ],
  },
];

export const BAND_STEPS = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/webm': 'webm',
};
export const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_RECORDING_BYTES = 12 * 1024 * 1024;
