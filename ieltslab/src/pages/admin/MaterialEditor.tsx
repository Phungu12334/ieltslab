import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AUDIO_TYPES, IMAGE_TYPES, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, QUESTION_TYPE_LABEL, SECTION_SPEC, SKILL_LABEL, SPEAKING_DEFAULTS, TFNG_OPTIONS, WRITING_MIN_WORDS, YNNG_OPTIONS } from '../../../shared/constants';
import { newId } from '../../../shared/engine';
import { optionLetter } from '../../../shared/scoring';
import type { Material, MaterialTestType, QuestionType, Skill } from '../../../shared/types';
import { SKILLS } from '../../../shared/types';
import { validateMaterial, type FieldError } from '../../../shared/validate';
import { ApiError } from '../../api';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Button, ErrorState, Field, Notice, Spinner } from '../../components/ui';
import { useRouter } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';

interface QDraft {
  id: string;
  prompt: string;
  options: string;
  answers: string;
  explanation: string;
}
interface GDraft {
  id: string;
  type: QuestionType;
  instructions: string;
  options: string;
  maxWords: string;
  questions: QDraft[];
}
interface Draft {
  skill: Skill;
  testType: MaterialTestType;
  part: number;
  title: string;
  instructions: string;
  tags: string;
  status: 'active' | 'draft';
  passage: string;
  prompt: string;
  bullets: string;
  speakingQuestions: string;
  audioAssetId: string;
  audioUrl: string;
  audioScript: string;
  transcript: string;
  imageAssetId: string;
  imageUrl: string;
  imageAlt: string;
  minWords: string;
  prepSeconds: string;
  responseSeconds: string;
  scoringGuidance: string;
  modelAnswer: string;
  groups: GDraft[];
}

const DEFAULT_INSTRUCTIONS: Record<QuestionType, string> = {
  tfng: 'Do the following statements agree with the information given in the passage? Choose TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.',
  ynng: 'Do the following statements agree with the views of the writer? Choose YES if the statement agrees with the views of the writer, NO if the statement contradicts the views of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.',
  mcq: 'Choose the correct letter, A, B, C or D.',
  matching: 'Choose the correct letter from the list below.',
  completion: 'Complete the sentences below. Write NO MORE THAN TWO WORDS for each answer.',
};

const emptyQ = (): QDraft => ({ id: newId('q_'), prompt: '', options: '', answers: '', explanation: '' });
const emptyG = (type: QuestionType = 'completion'): GDraft => ({
  id: newId('g_'),
  type,
  instructions: DEFAULT_INSTRUCTIONS[type],
  options: '',
  maxWords: type === 'completion' ? '2' : '',
  questions: [emptyQ()],
});

function fromMaterial(m?: Material): Draft {
  return {
    skill: m?.skill || 'reading',
    testType: m?.testType || 'academic',
    part: m?.part || 1,
    title: m?.title || '',
    instructions: m?.instructions || '',
    tags: (m?.tags || []).filter((t) => t !== 'demo').join(', '),
    status: m?.status || 'active',
    passage: m?.passage || '',
    prompt: m?.prompt || '',
    bullets: (m?.bullets || []).join('\n'),
    speakingQuestions: (m?.speakingQuestions || []).join('\n'),
    audioAssetId: m?.audioAssetId || '',
    audioUrl: m?.audioUrl || '',
    audioScript: m?.audioScript || '',
    transcript: m?.transcript || '',
    imageAssetId: m?.imageAssetId || '',
    imageUrl: m?.imageUrl || '',
    imageAlt: m?.imageAlt || '',
    minWords: m?.minWords ? String(m.minWords) : '',
    prepSeconds: m?.prepSeconds !== undefined ? String(m.prepSeconds) : '',
    responseSeconds: m?.responseSeconds !== undefined ? String(m.responseSeconds) : '',
    scoringGuidance: m?.scoringGuidance || '',
    modelAnswer: m?.modelAnswer || '',
    groups: (m?.groups || []).map((g) => ({
      id: g.id,
      type: g.type,
      instructions: g.instructions,
      options: (g.options || []).join('\n'),
      maxWords: g.maxWords ? String(g.maxWords) : '',
      questions: g.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: (q.options || []).join('\n'), answers: q.answers.join('\n'), explanation: q.explanation || '' })),
    })),
  };
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function toInput(d: Draft, demo: boolean) {
  const typeSpecific = SECTION_SPEC[d.skill].typeSpecific;
  return {
    skill: d.skill,
    testType: typeSpecific ? d.testType : 'both',
    part: d.part,
    title: d.title,
    instructions: d.instructions,
    tags: [...(demo ? ['demo'] : []), ...d.tags.split(',').map((t) => t.trim()).filter(Boolean)],
    status: d.status,
    passage: d.skill === 'reading' ? d.passage : undefined,
    prompt: d.prompt || undefined,
    bullets: lines(d.bullets),
    speakingQuestions: lines(d.speakingQuestions),
    audioAssetId: d.audioAssetId || undefined,
    audioUrl: d.audioUrl || undefined,
    audioScript: d.audioScript || undefined,
    transcript: d.transcript || undefined,
    imageAssetId: d.imageAssetId || undefined,
    imageUrl: d.imageUrl || undefined,
    imageAlt: d.imageAlt || undefined,
    minWords: d.minWords || undefined,
    prepSeconds: d.prepSeconds === '' ? undefined : Number(d.prepSeconds),
    responseSeconds: d.responseSeconds === '' ? undefined : Number(d.responseSeconds),
    scoringGuidance: d.scoringGuidance || undefined,
    modelAnswer: d.modelAnswer || undefined,
    groups:
      d.skill === 'reading' || d.skill === 'listening'
        ? d.groups.map((g) => ({
            id: g.id,
            type: g.type,
            instructions: g.instructions,
            options: lines(g.options),
            maxWords: g.type === 'completion' && g.maxWords ? Number(g.maxWords) : undefined,
            questions: g.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: lines(q.options), answers: lines(q.answers), explanation: q.explanation })),
          }))
        : [],
  };
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="card stack editor-section">
      <div>
        <h2 className="h3">{title}</h2>
        {hint && <p className="muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function MaterialEditor({ id }: { id?: string }) {
  const { api, toast, confirm } = useApp();
  const { navigate } = useRouter();
  const existing = useAsync(async () => (id ? (await api.listMaterials()).find((m) => m.id === id) || null : null), [api, id]);
  const [d, setD] = useState<Draft | null>(id ? null : fromMaterial());
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'audio' | 'image' | null>(null);
  const [dirty, setDirty] = useState(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const [assetPreview, setAssetPreview] = useState<{ audio?: string; image?: string }>({});

  useEffect(() => {
    if (existing.data) setD(fromMaterial(existing.data));
  }, [existing.data]);

  useEffect(() => {
    if (!d) return;
    if (d.audioAssetId) api.fileUrl(d.audioAssetId).then((u) => setAssetPreview((p) => ({ ...p, audio: u })), () => setAssetPreview((p) => ({ ...p, audio: undefined })));
    if (d.imageAssetId) api.fileUrl(d.imageAssetId).then((u) => setAssetPreview((p) => ({ ...p, image: u })), () => setAssetPreview((p) => ({ ...p, image: undefined })));
  }, [api, d?.audioAssetId, d?.imageAssetId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (id && existing.loading) return <Spinner />;
  if (id && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;
  if (id && existing.data === null)
    return (
      <div className="narrow stack">
        <Notice tone="error" title="Material not found">
          It may have been deleted.
        </Notice>
        <Button onClick={() => navigate('/admin')}>Back to content</Button>
      </div>
    );
  if (!d) return <Spinner />;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => (x ? { ...x, [k]: v } : x));
    setDirty(true);
  };
  const setGroup = (gi: number, patch: Partial<GDraft>) => set('groups', d.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setQ = (gi: number, qi: number, patch: Partial<QDraft>) =>
    setGroup(gi, { questions: d.groups[gi].questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });
  const err = (field: string) => errors.find((e) => e.field === field)?.message;
  const groupErrors = (gi: number) => errors.filter((e) => e.field.startsWith(`groups[${gi}]`));
  const demo = !!existing.data?.demo;

  const save = async () => {
    const input = toInput(d, demo);
    const local = validateMaterial(input, existing.data || undefined);
    if (!local.ok) {
      setErrors(local.errors);
      setTimeout(() => errorBox.current?.focus(), 0);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const saved = await api.saveMaterial(input, id);
      setDirty(false);
      toast(id ? 'Changes saved.' : 'Material created.');
      if (!id) navigate(`/admin/edit/${saved.id}`, { replace: true });
      else existing.setData(saved);
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
      setTimeout(() => errorBox.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (kind: 'audio' | 'image', file: File | undefined) => {
    if (!file) return;
    const allowed = kind === 'audio' ? AUDIO_TYPES : IMAGE_TYPES;
    const limit = kind === 'audio' ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
    if (!(file.type in allowed)) {
      toast(
        kind === 'audio'
          ? `“${file.name}” is not a supported audio file. Use MP3, WAV, OGG, M4A/AAC or WEBM.`
          : `“${file.name}” is not a supported image. Use PNG, JPEG, WEBP or GIF.`,
        'error',
      );
      return;
    }
    if (file.size > limit) {
      toast(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${limit / 1024 / 1024} MB.`, 'error');
      return;
    }
    setUploading(kind);
    try {
      const r = await api.uploadAsset(file);
      if (kind === 'audio') set('audioAssetId', r.id);
      else set('imageAssetId', r.id);
      toast(`${file.name} uploaded. Save the material to keep it.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed.', 'error');
    } finally {
      setUploading(null);
    }
  };

  const leave = async () => {
    if (dirty && !(await confirm({ title: 'Discard unsaved changes?', body: <p>Your edits to this material will be lost.</p>, confirmLabel: 'Discard', danger: true }))) return;
    navigate('/admin');
  };

  const objective = d.skill === 'reading' || d.skill === 'listening';
  let qNumber = 0;

  return (
    <div className="stack-lg editor">
      <header className="page-head row-between wrap-row">
        <div>
          <p className="eyebrow">
            Content manager · {id ? 'Edit' : 'New'} {demo && <span className="chip chip-demo">Demo</span>}
          </p>
          <h1>{d.title || (id ? 'Untitled material' : 'New material')}</h1>
        </div>
        <div className="row-gap">
          <Button icon="left" onClick={leave}>
            Back
          </Button>
          <Button variant="primary" icon="check" onClick={save} busy={busy}>
            Save
          </Button>
        </div>
      </header>

      {errors.length > 0 && (
        <div tabIndex={-1} ref={errorBox} className="error-summary" role="alert">
          <strong>Please fix {errors.length === 1 ? 'this problem' : `these ${errors.length} problems`}:</strong>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Basics">
        <div className="form-grid">
          <Field label="Skill" required>
            {(p) => (
              <select
                {...p}
                value={d.skill}
                disabled={!!id}
                onChange={(e) => {
                  const skill = e.target.value as Skill;
                  setD({ ...d, skill, part: 1, groups: skill === 'reading' || skill === 'listening' ? (d.groups.length ? d.groups : [emptyG()]) : [] });
                  setDirty(true);
                }}
              >
                {SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {SKILL_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={d.skill === 'writing' ? 'Task' : d.skill === 'reading' ? 'Passage / section' : 'Part'} required error={err('part')}>
            {(p) => (
              <select {...p} value={d.part} onChange={(e) => set('part', Number(e.target.value))}>
                {SECTION_SPEC[d.skill].parts.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {SECTION_SPEC[d.skill].typeSpecific ? (
            <Field label="Test format" error={err('testType')}>
              {(p) => (
                <select {...p} value={d.testType} onChange={(e) => set('testType', e.target.value as MaterialTestType)}>
                  <option value="academic">Academic only</option>
                  <option value="general">General Training only</option>
                  <option value="both">Both formats</option>
                </select>
              )}
            </Field>
          ) : (
            <div className="field">
              <span className="label-like">Test format</span>
              <p className="muted">Same for Academic and General Training.</p>
            </div>
          )}
          <Field label="Status" hint="Only active materials are used in new tests.">
            {(p) => (
              <select {...p} value={d.status} onChange={(e) => set('status', e.target.value as 'active' | 'draft')}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            )}
          </Field>
        </div>
        <Field label="Title" required error={err('title')}>
          {(p) => <input {...p} value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />}
        </Field>
        <Field label="Instructions shown to candidates" hint="For example the time to spend, or who the speakers are.">
          {(p) => <textarea {...p} rows={2} value={d.instructions} onChange={(e) => set('instructions', e.target.value)} />}
        </Field>
        <Field
          label="Tags"
          hint={
            d.skill === 'speaking'
              ? 'Comma-separated. Give a Part 2 card and its Part 3 questions the same "topic:" tag (e.g. topic:travel) so they are used together.'
              : 'Comma-separated, e.g. environment, education.'
          }
        >
          {(p) => <input {...p} value={d.tags} onChange={(e) => set('tags', e.target.value)} />}
        </Field>
      </Section>

      {d.skill === 'reading' && (
        <Section title="Passage" hint="Separate paragraphs with a blank line. To label paragraphs for matching questions, start each with a capital letter and a space, e.g. “A The first…”.">
          <Field label="Passage text" required error={err('passage')}>
            {(p) => <textarea {...p} rows={16} className="mono-ish" value={d.passage} onChange={(e) => set('passage', e.target.value)} />}
          </Field>
          <p className="fine">{d.passage.trim() ? `${d.passage.trim().split(/\s+/).length} words` : ''}</p>
        </Section>
      )}

      {d.skill === 'listening' && (
        <Section title="Audio" hint="Upload a recording, link to one, or provide a script. Tests use the recording first; a script is read aloud by the browser and labelled as a synthetic voice.">
          {err('audio') && <Notice tone="error">{err('audio')}</Notice>}
          <div className="form-grid">
            <div className="field">
              <span className="label-like">Audio file</span>
              {d.audioAssetId ? (
                <div className="asset-row">
                  {assetPreview.audio ? <audio controls src={assetPreview.audio} /> : <span className="muted">Uploaded file {d.audioAssetId}</span>}
                  <Button size="sm" icon="trash" onClick={() => set('audioAssetId', '')}>
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="upload">
                  <Icon name="upload" size={16} />
                  <span>{uploading === 'audio' ? 'Uploading…' : 'Choose audio file'}</span>
                  <input type="file" accept=".mp3,.wav,.ogg,.m4a,.aac,.webm,audio/*" onChange={(e) => upload('audio', e.target.files?.[0])} disabled={!!uploading} />
                </label>
              )}
              <div className="hint">MP3, WAV, OGG, M4A/AAC or WEBM, up to {MAX_AUDIO_BYTES / 1024 / 1024} MB.</div>
            </div>
            <Field label="Or audio link (https)" error={err('audioUrl')}>
              {(p) => <input {...p} type="url" placeholder="https://…" value={d.audioUrl} onChange={(e) => set('audioUrl', e.target.value)} />}
            </Field>
          </div>
          <Field label="Script for text-to-speech" hint='Used only when there is no recording. Start lines with the speaker in capitals, e.g. "RECEPTIONIST: Good morning."'>
            {(p) => <textarea {...p} rows={8} value={d.audioScript} onChange={(e) => set('audioScript', e.target.value)} />}
          </Field>
          <Field label="Transcript shown after the test" hint="Leave empty to reuse the script.">
            {(p) => <textarea {...p} rows={4} value={d.transcript} onChange={(e) => set('transcript', e.target.value)} />}
          </Field>
        </Section>
      )}

      {d.skill === 'writing' && (
        <Section title="Task">
          <Field label="Task prompt" required error={err('prompt')} hint="Separate paragraphs with a blank line.">
            {(p) => <textarea {...p} rows={6} value={d.prompt} onChange={(e) => set('prompt', e.target.value)} />}
          </Field>
          <Field label="Bullet points (one per line)" hint="Used for General Training letters: “In your letter: …”.">
            {(p) => <textarea {...p} rows={3} value={d.bullets} onChange={(e) => set('bullets', e.target.value)} />}
          </Field>
          <div className="form-grid">
            <Field label="Minimum words" error={err('minWords')} hint={`Default ${WRITING_MIN_WORDS[d.part] || 150}.`}>
              {(p) => <input {...p} type="number" min={20} max={1000} value={d.minWords} onChange={(e) => set('minWords', e.target.value)} />}
            </Field>
            <div className="field">
              <span className="label-like">Visual (Academic Task 1)</span>
              {d.imageAssetId ? (
                <div className="asset-row">
                  {assetPreview.image && <img src={assetPreview.image} alt="" className="thumb" />}
                  <Button size="sm" icon="trash" onClick={() => set('imageAssetId', '')}>
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="upload">
                  <Icon name="upload" size={16} />
                  <span>{uploading === 'image' ? 'Uploading…' : 'Choose image'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => upload('image', e.target.files?.[0])} disabled={!!uploading} />
                </label>
              )}
              <div className="hint">PNG, JPEG, WEBP or GIF, up to {MAX_IMAGE_BYTES / 1024 / 1024} MB.</div>
            </div>
          </div>
          {!d.imageAssetId && d.imageUrl && (
            <div className="asset-row">
              <img src={d.imageUrl} alt="" className="thumb" />
              <Button size="sm" icon="trash" onClick={() => set('imageUrl', '')}>
                Remove image
              </Button>
            </div>
          )}
          <Field label="Image description" error={err('imageAlt')} hint="Required with an image: describe the data so screen-reader users can do the task.">
            {(p) => <textarea {...p} rows={2} value={d.imageAlt} onChange={(e) => set('imageAlt', e.target.value)} />}
          </Field>
          <Field label="Marking guidance (shown after the test)">
            {(p) => <textarea {...p} rows={3} value={d.scoringGuidance} onChange={(e) => set('scoringGuidance', e.target.value)} />}
          </Field>
          <Field label="Sample answer (shown after the test)">
            {(p) => <textarea {...p} rows={8} value={d.modelAnswer} onChange={(e) => set('modelAnswer', e.target.value)} />}
          </Field>
        </Section>
      )}

      {d.skill === 'speaking' && (
        <Section title={d.part === 2 ? 'Cue card' : 'Questions'}>
          {d.part === 2 ? (
            <>
              <Field label="Topic" required error={err('prompt')} hint="e.g. Describe a place you would like to visit.">
                {(p) => <input {...p} value={d.prompt} onChange={(e) => set('prompt', e.target.value)} />}
              </Field>
              <Field label="You should say… (one point per line)" required error={err('bullets')}>
                {(p) => <textarea {...p} rows={4} value={d.bullets} onChange={(e) => set('bullets', e.target.value)} />}
              </Field>
            </>
          ) : (
            <Field label="Questions (one per line)" required error={err('speakingQuestions')}>
              {(p) => <textarea {...p} rows={6} value={d.speakingQuestions} onChange={(e) => set('speakingQuestions', e.target.value)} />}
            </Field>
          )}
          <div className="form-grid">
            <Field label="Preparation time (seconds)" error={err('prepSeconds')} hint={`Default ${SPEAKING_DEFAULTS[d.part]?.prep ?? 0}.`}>
              {(p) => <input {...p} type="number" min={0} max={300} value={d.prepSeconds} onChange={(e) => set('prepSeconds', e.target.value)} />}
            </Field>
            <Field label={d.part === 2 ? 'Speaking time (seconds)' : 'Target answer length (seconds)'} error={err('responseSeconds')} hint={`Default ${SPEAKING_DEFAULTS[d.part]?.response ?? 30}.`}>
              {(p) => <input {...p} type="number" min={10} max={300} value={d.responseSeconds} onChange={(e) => set('responseSeconds', e.target.value)} />}
            </Field>
          </div>
          <Field label="Marking guidance (shown after the test)">
            {(p) => <textarea {...p} rows={3} value={d.scoringGuidance} onChange={(e) => set('scoringGuidance', e.target.value)} />}
          </Field>
        </Section>
      )}

      {objective && (
        <Section title="Questions" hint="Questions are numbered automatically across the section in the order shown here.">
          {err('groups') && <Notice tone="error">{err('groups')}</Notice>}
          {d.groups.map((g, gi) => {
            const gErr = groupErrors(gi);
            return (
              <fieldset key={g.id} className="group-editor">
                <legend>
                  Group {gi + 1}: {QUESTION_TYPE_LABEL[g.type]}
                </legend>
                {gErr.length > 0 && (
                  <ul className="inline-errors">
                    {gErr.map((e, i) => (
                      <li key={i}>{e.message}</li>
                    ))}
                  </ul>
                )}
                <div className="form-grid">
                  <Field label="Question type">
                    {(p) => (
                      <select
                        {...p}
                        value={g.type}
                        onChange={(e) => {
                          const type = e.target.value as QuestionType;
                          setGroup(gi, {
                            type,
                            instructions: Object.values(DEFAULT_INSTRUCTIONS).includes(g.instructions) || !g.instructions ? DEFAULT_INSTRUCTIONS[type] : g.instructions,
                            maxWords: type === 'completion' ? g.maxWords || '2' : '',
                            questions: g.questions.map((q) => ({ ...q, answers: '' })),
                          });
                        }}
                      >
                        {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
                          <option key={t} value={t}>
                            {QUESTION_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  {g.type === 'completion' && (
                    <Field label="Word limit" hint="Answers longer than this are marked wrong.">
                      {(p) => <input {...p} type="number" min={1} max={10} value={g.maxWords} onChange={(e) => setGroup(gi, { maxWords: e.target.value })} />}
                    </Field>
                  )}
                </div>
                <Field label="Instructions">{(p) => <textarea {...p} rows={2} value={g.instructions} onChange={(e) => setGroup(gi, { instructions: e.target.value })} />}</Field>
                {g.type === 'matching' && (
                  <Field label="Options list (one per line, lettered A, B, C… in order)">
                    {(p) => <textarea {...p} rows={5} value={g.options} onChange={(e) => setGroup(gi, { options: e.target.value })} />}
                  </Field>
                )}
                <ol className="q-editor-list">
                  {g.questions.map((q, qi) => {
                    qNumber++;
                    const mcqLetters = lines(q.options).map((_, i) => optionLetter(i));
                    const matchLetters = lines(g.options).map((_, i) => optionLetter(i));
                    return (
                      <li key={q.id} className="q-editor">
                        <div className="q-editor-head">
                          <span className="q-num">{qNumber}</span>
                          <div className="row-gap-sm">
                            <button type="button" className="icon-btn" aria-label="Move up" disabled={qi === 0} onClick={() => setGroup(gi, { questions: swap(g.questions, qi, qi - 1) })}>
                              <Icon name="left" size={14} className="rot90" />
                            </button>
                            <button type="button" className="icon-btn" aria-label="Move down" disabled={qi === g.questions.length - 1} onClick={() => setGroup(gi, { questions: swap(g.questions, qi, qi + 1) })}>
                              <Icon name="right" size={14} className="rot90" />
                            </button>
                            <button type="button" className="icon-btn danger" aria-label={`Remove question ${qNumber}`} onClick={() => setGroup(gi, { questions: g.questions.filter((_, i) => i !== qi) })}>
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </div>
                        <Field label="Question" hint={g.type === 'completion' ? 'Use ______ (three or more underscores) where the gap goes.' : undefined}>
                          {(p) => <input {...p} value={q.prompt} onChange={(e) => setQ(gi, qi, { prompt: e.target.value })} />}
                        </Field>
                        {g.type === 'mcq' && (
                          <Field label="Options (one per line: A, B, C…)">{(p) => <textarea {...p} rows={4} value={q.options} onChange={(e) => setQ(gi, qi, { options: e.target.value })} />}</Field>
                        )}
                        {g.type === 'completion' ? (
                          <Field label="Accepted answers (one per line)" hint="Add every acceptable form, e.g. 6.30 and 6:30. Case and full stops are ignored.">
                            {(p) => <textarea {...p} rows={2} value={q.answers} onChange={(e) => setQ(gi, qi, { answers: e.target.value })} />}
                          </Field>
                        ) : (
                          <Field label="Correct answer">
                            {(p) => (
                              <select {...p} value={lines(q.answers)[0] || ''} onChange={(e) => setQ(gi, qi, { answers: e.target.value })}>
                                <option value="">Choose…</option>
                                {(g.type === 'tfng' ? TFNG_OPTIONS : g.type === 'ynng' ? YNNG_OPTIONS : g.type === 'mcq' ? mcqLetters : matchLetters).map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            )}
                          </Field>
                        )}
                        <Field label="Explanation (shown after the test)">
                          {(p) => <input {...p} value={q.explanation} onChange={(e) => setQ(gi, qi, { explanation: e.target.value })} placeholder="e.g. Paragraph B: “…”" />}
                        </Field>
                      </li>
                    );
                  })}
                </ol>
                <div className="row-gap">
                  <Button size="sm" icon="plus" onClick={() => setGroup(gi, { questions: [...g.questions, emptyQ()] })}>
                    Add question
                  </Button>
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => set('groups', d.groups.filter((_, i) => i !== gi))}>
                    Remove group
                  </Button>
                </div>
              </fieldset>
            );
          })}
          <div className="row-gap">
            {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
              <Button key={t} size="sm" icon="plus" onClick={() => set('groups', [...d.groups, emptyG(t)])}>
                {QUESTION_TYPE_LABEL[t]}
              </Button>
            ))}
          </div>
        </Section>
      )}

      <div className="row-gap sticky-actions">
        <Button variant="primary" icon="check" onClick={save} busy={busy}>
          Save material
        </Button>
        <Button onClick={leave}>Cancel</Button>
      </div>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const c = [...arr];
  [c[a], c[b]] = [c[b], c[a]];
  return c;
}
