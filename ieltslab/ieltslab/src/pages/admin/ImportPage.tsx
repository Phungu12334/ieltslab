import { useState } from 'react';
import { SKILL_LABEL } from '../../../shared/constants';
import { validateImport, type ImportReport } from '../../../shared/validate';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Button, Notice } from '../../components/ui';
import { useRouter } from '../../lib/router';

const TEMPLATE = `{
  "materials": [
    {
      "skill": "reading",
      "testType": "academic",
      "part": 1,
      "title": "Your passage title",
      "instructions": "You should spend about 20 minutes on this passage.",
      "status": "active",
      "tags": ["science"],
      "passage": "A First paragraph…\\n\\nB Second paragraph…",
      "groups": [
        {
          "type": "tfng",
          "instructions": "Do the following statements agree with the information given in the passage?",
          "questions": [
            { "prompt": "Statement to judge.", "answers": ["TRUE"], "explanation": "Paragraph A says…" }
          ]
        },
        {
          "type": "completion",
          "instructions": "Complete the sentences. Write NO MORE THAN TWO WORDS.",
          "maxWords": 2,
          "questions": [
            { "prompt": "The study took place in ______.", "answers": ["Norway", "northern Norway"] }
          ]
        },
        {
          "type": "mcq",
          "instructions": "Choose the correct letter, A, B, C or D.",
          "questions": [
            { "prompt": "What is the main idea?", "options": ["…", "…", "…", "…"], "answers": ["B"] }
          ]
        }
      ]
    },
    {
      "skill": "listening",
      "part": 1,
      "title": "Booking a hotel room",
      "audioUrl": "https://example.com/part1.mp3",
      "transcript": "…",
      "groups": [
        { "type": "completion", "instructions": "Write ONE WORD AND/OR A NUMBER.", "maxWords": 2,
          "questions": [ { "prompt": "Arrival date: ______ June", "answers": ["14", "14th"] } ] }
      ]
    },
    {
      "skill": "writing",
      "testType": "both",
      "part": 2,
      "title": "Essay: technology and childhood",
      "instructions": "You should spend about 40 minutes on this task.",
      "prompt": "Some people think… To what extent do you agree or disagree?",
      "minWords": 250
    },
    {
      "skill": "speaking",
      "part": 2,
      "title": "Describe a journey",
      "prompt": "Describe a memorable journey you have made.",
      "bullets": ["where you went", "how you travelled", "who you were with", "and explain why it was memorable"],
      "tags": ["topic:travel"]
    }
  ]
}`;

export function ImportPage() {
  const { api, toast } = useApp();
  const { navigate } = useRouter();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [preview, setPreview] = useState<{ data: unknown; report: ImportReport } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ imported: number; failed: number } | null>(null);

  const check = (raw: string) => {
    setDone(null);
    setPreview(null);
    if (!raw.trim()) return setParseError('');
    try {
      const data = JSON.parse(raw);
      setParseError('');
      setPreview({ data, report: validateImport(data) });
    } catch (e) {
      setParseError(`This is not valid JSON: ${(e as Error).message}`);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.json$/i.test(f.name) && f.type !== 'application/json') {
      setParseError(`“${f.name}” is not a JSON file. Export your materials as .json (see the template below). Audio and images are uploaded separately in the material editor.`);
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setParseError('The file is larger than 20 MB.');
      return;
    }
    setFileName(f.name);
    const t = await f.text();
    setText(t);
    check(t);
  };

  const doImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await api.importMaterials(preview.data);
      setDone({ imported: r.imported, failed: r.failed.length });
      toast(`${r.imported} materials imported.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = preview
    ? Object.entries(
        preview.report.imported.reduce<Record<string, number>>((m, x) => ((m[x.skill] = (m[x.skill] || 0) + 1), m), {}),
      )
    : [];

  return (
    <div className="stack-lg narrow">
      <header className="page-head">
        <p className="eyebrow">Content manager</p>
        <h1>Import materials</h1>
        <p className="lede">Add many passages, recordings and prompts at once from a JSON file. Every item is checked before anything is saved.</p>
      </header>

      <section className="card stack">
        <label className="upload big">
          <Icon name="upload" size={20} />
          <span>{fileName ? `Selected: ${fileName}` : 'Choose a .json file'}</span>
          <input type="file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <label htmlFor="import-text" className="small-label">
          Or paste JSON
        </label>
        <textarea
          id="import-text"
          rows={8}
          className="mono-ish"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            check(e.target.value);
          }}
          placeholder='{ "materials": [ … ] }'
        />
        {parseError && <Notice tone="error">{parseError}</Notice>}
        {preview && (
          <div className="stack">
            {preview.report.imported.length > 0 && (
              <Notice tone="ok" title={`${preview.report.imported.length} ready to import`}>
                {counts.map(([s, n]) => `${SKILL_LABEL[s as keyof typeof SKILL_LABEL]}: ${n}`).join(' · ')}
              </Notice>
            )}
            {preview.report.failed.length > 0 && (
              <div className="error-summary">
                <strong>{preview.report.failed.length} will be skipped:</strong>
                <ul>
                  {preview.report.failed.map((f) => (
                    <li key={f.index}>
                      <strong>
                        #{f.index + 1} {f.title}
                      </strong>
                      : {f.errors.map((e) => e.message).join(' ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="row-gap">
              <Button variant="primary" icon="upload" onClick={doImport} busy={busy} disabled={!preview.report.imported.length || !!done}>
                Import {preview.report.imported.length} materials
              </Button>
              {done && (
                <Button icon="right" onClick={() => navigate('/admin')}>
                  Go to content
                </Button>
              )}
            </div>
            {done && <p className="muted">Imported {done.imported}. Skipped {done.failed}. New ids were generated so nothing existing was overwritten.</p>}
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="row-between">
          <h2 className="h3">File format</h2>
          <Button
            size="sm"
            icon="copy"
            onClick={() =>
              navigator.clipboard?.writeText(TEMPLATE).then(
                () => toast('Template copied.'),
                () => toast('Copy failed. Select the text and copy it manually.', 'error'),
              )
            }
          >
            Copy template
          </Button>
        </div>
        <ul className="fine-list">
          <li>
            <code>skill</code>: listening, reading, writing or speaking. <code>part</code>: Listening 1–4, Reading 1–3, Writing 1–2, Speaking 1–3.
          </li>
          <li>
            <code>testType</code>: academic, general or both (Reading and Writing only).
          </li>
          <li>
            Question <code>type</code>: mcq, tfng, ynng, matching (with a group <code>options</code> list) or completion (with <code>maxWords</code>).
          </li>
          <li>Answers are letters for mcq and matching, TRUE/FALSE/NOT GIVEN or YES/NO/NOT GIVEN, or a list of accepted texts for completion.</li>
          <li>Listening needs <code>audioUrl</code> (https) or <code>audioScript</code>; upload audio files in the editor after importing.</li>
        </ul>
        <pre className="code">{TEMPLATE}</pre>
      </section>
    </div>
  );
}
