import { useState } from 'react';
import { SKILL_LABEL } from '../../shared/constants';
import { SKILLS } from '../../shared/types';
import { useApp } from '../app/AppContext';
import { BandPill, Button, EmptyState, ErrorState, Notice, SkillIcon, Spinner } from '../components/ui';
import { formatBand, formatDate } from '../lib/format';
import { Link, useRouter } from '../lib/router';
import { useAsync } from '../lib/useAsync';

export function History() {
  const { api, user, confirm, toast } = useApp();
  const { navigate } = useRouter();
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'submitted'>('all');
  const list = useAsync(() => (user ? api.listAttempts() : Promise.resolve([])), [api, user?.id]);

  const remove = async (id: string, title: string) => {
    const ok = await confirm({
      title: 'Delete this attempt?',
      body: <p>“{title}” and its recordings will be permanently deleted.</p>,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAttempt(id);
      toast('Attempt deleted.');
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  };

  const items = (list.data || []).filter((a) => filter === 'all' || a.status === filter);
  const done = (list.data || []).filter((a) => a.status === 'submitted');

  // Average band per skill across completed attempts (auto-scored or reviewed).
  const avg = SKILLS.map((s) => {
    const vals = done.map((a) => a.bands[s]).filter((v): v is number => typeof v === 'number');
    return { skill: s, n: vals.length, avg: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null };
  });

  return (
    <div className="stack-lg">
      <header className="page-head">
        <p className="eyebrow">History</p>
        <h1>Your attempts</h1>
      </header>

      {user?.isGuest && api.mode === 'server' && (
        <Notice tone="info" title="You are using a guest session">
          Your attempts are linked to this browser. <Link to="/account">Create a free account</Link> to keep them and see them on other devices.
        </Notice>
      )}

      {done.length > 0 && (
        <div className="card-grid four">
          {avg.map((a) => (
            <div key={a.skill} className="card stat">
              <span className="stat-label">
                <SkillIcon skill={a.skill} size={16} /> {SKILL_LABEL[a.skill]}
              </span>
              <span className="stat-num">{a.avg == null ? '—' : formatBand(Math.round(a.avg * 2) / 2)}</span>
              <span className="muted">{a.n ? `average of ${a.n}` : 'no scored attempts'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="filter-row" role="group" aria-label="Filter attempts">
        {(
          [
            ['all', 'All'],
            ['in_progress', 'In progress'],
            ['submitted', 'Completed'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={`chip-btn${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>

      {list.loading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title={list.data?.length ? 'Nothing matches this filter' : 'No attempts yet'}
          action={
            <Button variant="primary" icon="play" onClick={() => navigate('/practice')}>
              Start a practice test
            </Button>
          }
        >
          {list.data?.length ? 'Try another filter.' : 'Your completed tests and anything in progress will appear here.'}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
                <th scope="col">Bands</th>
                <th scope="col" className="num">
                  Overall
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.title}</strong>
                  </td>
                  <td>
                    {a.status === 'in_progress' ? (
                      <span className="chip chip-warn">In progress</span>
                    ) : a.pendingReview.length ? (
                      <span className="chip">Needs review</span>
                    ) : (
                      <span className="chip chip-ok">Complete</span>
                    )}
                  </td>
                  <td className="muted">{formatDate(a.submittedAt || a.updatedAt)}</td>
                  <td>
                    <span className="band-list">
                      {a.skills.map((s) => (
                        <span key={s} title={SKILL_LABEL[s]}>
                          <SkillIcon skill={s} size={14} /> {a.status === 'submitted' ? formatBand(a.bands[s]) : '…'}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="num">{a.overall != null ? <BandPill band={a.overall} /> : <span className="muted">—</span>}</td>
                  <td>
                    <div className="row-gap-sm end">
                      {a.status === 'in_progress' ? (
                        <Button size="sm" variant="primary" icon="play" onClick={() => navigate(`/attempt/${a.id}`)}>
                          Resume
                        </Button>
                      ) : (
                        <Button size="sm" icon="eye" onClick={() => navigate(`/results/${a.id}`)}>
                          Results
                        </Button>
                      )}
                      <button type="button" className="icon-btn" aria-label={`Delete ${a.title}`} onClick={() => remove(a.id, a.title)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
