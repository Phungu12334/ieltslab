import { useMemo, useState } from 'react';
import { SECTION_SPEC, SKILL_LABEL, TEST_TYPE_LABEL } from '../../../shared/constants';
import { computeAvailability } from '../../../shared/engine';
import type { Material, Skill } from '../../../shared/types';
import { SKILLS } from '../../../shared/types';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, ErrorState, Notice, SkillIcon, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useRouter } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';

export function ContentList() {
  const { api, toast, confirm } = useApp();
  const { navigate } = useRouter();
  const list = useAsync(() => api.listMaterials(), [api]);
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState<Skill | ''>('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = list.data || [];
  const avail = useMemo(() => computeAvailability(all), [all]);
  const shown = all.filter(
    (m) =>
      (!skill || m.skill === skill) &&
      (!type || m.testType === type) &&
      (!status || m.status === status) &&
      (!q || `${m.title} ${m.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  );

  const toggleStatus = async (m: Material) => {
    setBusyId(m.id);
    try {
      await api.saveMaterial({ ...m, status: m.status === 'active' ? 'draft' : 'active' }, m.id);
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (m: Material) => {
    setBusyId(m.id);
    try {
      const { id: _id, demo: _demo, ...rest } = m;
      const copy = await api.saveMaterial({ ...rest, title: `${m.title} (copy)`, status: 'draft', tags: m.tags.filter((t) => t !== 'demo') });
      toast('Copy created as a draft.');
      navigate(`/admin/edit/${copy.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not duplicate.', 'error');
      setBusyId(null);
    }
  };

  const remove = async (m: Material) => {
    const ok = await confirm({
      title: 'Delete this material?',
      body: <p>“{m.title}” will no longer be used in new tests. Past attempts keep their own copy, so existing results are not affected.</p>,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteMaterial(m.id);
      toast('Material deleted.');
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  };

  const demo = async (action: 'restore' | 'remove') => {
    const ok = await confirm({
      title: action === 'restore' ? 'Restore the demo set?' : 'Remove the demo set?',
      body:
        action === 'restore' ? (
          <p>The original demo materials are added back. Edited demo items are reset to their original text.</p>
        ) : (
          <p>All items marked “Demo” are removed from the content bank. Your own materials stay.</p>
        ),
      confirmLabel: action === 'restore' ? 'Restore' : 'Remove demo items',
      danger: action === 'remove',
    });
    if (!ok) return;
    try {
      await api.demoContent(action);
      toast(action === 'restore' ? 'Demo content restored.' : 'Demo content removed.');
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update demo content.', 'error');
    }
  };

  return (
    <div className="stack-lg">
      <header className="page-head row-between wrap-row">
        <div>
          <p className="eyebrow">Content manager</p>
          <h1>Test materials</h1>
          <p className="muted">Tests are assembled from active materials: one per part, chosen at random, preferring items the candidate has not seen recently.</p>
        </div>
        <div className="row-gap">
          <Button variant="primary" icon="plus" onClick={() => navigate('/admin/new')}>
            New material
          </Button>
          <Button icon="upload" onClick={() => navigate('/admin/import')}>
            Import JSON
          </Button>
          {api.mode === 'server' && (
            <Button icon="list" onClick={() => navigate('/admin/reviews')}>
              Review queue
            </Button>
          )}
        </div>
      </header>

      <section className="card">
        <h2 className="h3">Coverage (active materials per part)</h2>
        <div className="table-wrap">
          <table className="data compact coverage">
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Format</th>
                {[1, 2, 3, 4].map((p) => (
                  <th scope="col" key={p} className="num">
                    Part {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SKILLS.flatMap((s) =>
                (SECTION_SPEC[s].typeSpecific ? (['academic', 'general'] as const) : (['academic'] as const)).map((t) => (
                  <tr key={s + t}>
                    <th scope="row">
                      <SkillIcon skill={s} size={14} /> {SKILL_LABEL[s]}
                    </th>
                    <td className="muted">{SECTION_SPEC[s].typeSpecific ? TEST_TYPE_LABEL[t] : 'Both'}</td>
                    {[1, 2, 3, 4].map((p) => {
                      const has = SECTION_SPEC[s].parts.includes(p);
                      const n = avail[s][t][p] || 0;
                      return (
                        <td key={p} className={`num${has && n === 0 ? ' cell-bad' : ''}`}>
                          {has ? n : ''}
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="fine">A red cell means tests of that format will skip the part. Two or more per part gives candidates variety between attempts.</p>
      </section>

      <div className="filters">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Search</span>
          <input type="search" placeholder="Search titles and tags" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value as Skill | '')}>
          <option value="">All skills</option>
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {SKILL_LABEL[s]}
            </option>
          ))}
        </select>
        <select aria-label="Test format" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All formats</option>
          <option value="academic">Academic</option>
          <option value="general">General Training</option>
          <option value="both">Both</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {list.loading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : all.length === 0 ? (
        <EmptyState
          title="The content bank is empty"
          action={
            <div className="row-gap">
              <Button variant="primary" icon="plus" onClick={() => navigate('/admin/new')}>
                Add material
              </Button>
              <Button onClick={() => demo('restore')}>Restore demo set</Button>
            </div>
          }
        >
          Add your own passages, recordings, prompts and questions, or bring back the demo set to try the app.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="No materials match these filters" />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Skill · part</th>
                <th scope="col">Format</th>
                <th scope="col" className="num">
                  Qs
                </th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <td>
                    <button type="button" className="link-btn strong" onClick={() => navigate(`/admin/edit/${m.id}`)}>
                      {m.title}
                    </button>
                    {m.demo && <span className="chip chip-demo">Demo</span>}
                    {m.skill === 'listening' && !m.audioAssetId && !m.audioUrl && (
                      <span className="chip" title="No recording: the script is read by browser text-to-speech">
                        {m.audioScript ? 'TTS' : 'No audio'}
                      </span>
                    )}
                  </td>
                  <td>
                    <SkillIcon skill={m.skill} size={14} /> {SKILL_LABEL[m.skill]} · {m.part}
                  </td>
                  <td className="muted">{TEST_TYPE_LABEL[m.testType]}</td>
                  <td className="num">{m.groups.reduce((n, g) => n + g.questions.length, 0) || (m.speakingQuestions?.length ?? '—')}</td>
                  <td>
                    <button
                      type="button"
                      className={`status-toggle ${m.status}`}
                      onClick={() => toggleStatus(m)}
                      disabled={busyId === m.id}
                      aria-label={`${m.status === 'active' ? 'Active' : 'Draft'}. Switch to ${m.status === 'active' ? 'draft' : 'active'}`}
                    >
                      {m.status === 'active' ? 'Active' : 'Draft'}
                    </button>
                  </td>
                  <td className="muted">{formatDate(m.updatedAt)}</td>
                  <td>
                    <div className="row-gap-sm end">
                      <button type="button" className="icon-btn" aria-label={`Edit ${m.title}`} onClick={() => navigate(`/admin/edit/${m.id}`)}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Duplicate ${m.title}`} onClick={() => duplicate(m)} disabled={busyId === m.id}>
                        <Icon name="copy" size={16} />
                      </button>
                      <button type="button" className="icon-btn danger" aria-label={`Delete ${m.title}`} onClick={() => remove(m)}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card row-between wrap-row">
        <div>
          <h2 className="h3">Demo set</h2>
          <p className="muted">Original practice material written for IELTSLab. It is not official IELTS content.</p>
        </div>
        <div className="row-gap">
          <Button onClick={() => demo('restore')}>Restore demo set</Button>
          <Button variant="danger" onClick={() => demo('remove')}>
            Remove demo set
          </Button>
        </div>
      </section>
      {api.mode === 'local' && <Notice tone="info">In browser-only mode, content you add is stored in this browser and is not shared with other devices.</Notice>}
    </div>
  );
}
