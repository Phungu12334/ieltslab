import type {
  Attempt,
  AttemptSummary,
  Availability,
  CreateAttemptInput,
  CriterionReview,
  Material,
  ProgressPatch,
  PublicUser,
  RecordingRef,
  UserSettings,
} from '../../shared/types';
import type { FieldError } from '../../shared/validate';

export interface Health {
  mode: 'server' | 'local';
  version: string;
  google: boolean;
  ai: boolean;
  /** Local mode only: true when browser storage is unavailable and data lives in memory. */
  volatile?: boolean;
}

export class ApiError extends Error {
  status: number;
  fields?: FieldError[];
  constructor(status: number, message: string, fields?: FieldError[]) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export interface AvailabilityInfo {
  availability: Availability;
  total: number;
  active: number;
}

export interface ImportResult {
  imported: number;
  failed: { index: number; title: string; errors: FieldError[] }[];
}

/** One interface, two implementations: the Node server (accounts, SQLite) or browser-only storage. */
export interface Api {
  mode: 'server' | 'local';
  health: Health;

  me(): Promise<PublicUser | null>;
  guest(): Promise<PublicUser>;
  register(input: { name: string; email: string; password: string }): Promise<PublicUser>;
  login(input: { email: string; password: string }): Promise<PublicUser>;
  logout(): Promise<void>;
  googleUrl(): string | null;
  updateAccount(input: { name?: string; settings?: UserSettings }): Promise<PublicUser>;
  changePassword(current: string, next: string): Promise<void>;
  deleteAccount(): Promise<void>;

  availability(): Promise<AvailabilityInfo>;
  listMaterials(): Promise<Material[]>;
  saveMaterial(input: unknown, id?: string): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;
  importMaterials(data: unknown): Promise<ImportResult>;
  demoContent(action: 'restore' | 'remove'): Promise<void>;
  uploadAsset(file: File): Promise<{ id: string; url: string }>;
  /** A URL the browser can load for an uploaded file or recording. */
  fileUrl(id: string): Promise<string>;

  listAttempts(): Promise<AttemptSummary[]>;
  createAttempt(input: CreateAttemptInput): Promise<Attempt>;
  getAttempt(id: string): Promise<{ attempt: Attempt; ownerName?: string }>;
  saveProgress(id: string, patch: ProgressPatch, opts?: { keepalive?: boolean }): Promise<{ remainingSec: number; updatedAt: string }>;
  submitSection(id: string, sectionIndex: number, opts?: { auto?: boolean; final?: ProgressPatch }): Promise<Attempt>;
  endTest(id: string, final?: ProgressPatch): Promise<Attempt>;
  deleteAttempt(id: string): Promise<void>;
  uploadRecording(id: string, key: string, blob: Blob, durationSec: number): Promise<RecordingRef>;
  saveReview(id: string, skill: 'writing' | 'speaking', items: Record<string, CriterionReview>, asTeacher?: boolean): Promise<Attempt>;
  aiReview(id: string): Promise<Attempt>;
  reviewQueue(): Promise<AttemptSummary[]>;

  /** Local mode only. */
  resetLocalData?(): Promise<void>;
}
