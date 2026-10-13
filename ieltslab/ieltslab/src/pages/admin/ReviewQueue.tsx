import { SKILL_LABEL } from '../../../shared/constants';
import { useApp } from '../../app/AppContext';
import { Button, EmptyState, ErrorState, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useRouter } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';

export function ReviewQueue() {
  const { api } = useApp();
  const { navigate } = useRouter();
  const q = useAsync(() => api.reviewQueue(), [api]);
  return (
    <div className="stack-lg">
      <header className="page-head">
        <p className="eyebrow">Content manager</p>
        <h1>Review queue</h1>
        <p className="lede">Submitted Writing and Speaking that no teacher has reviewed yet. A teacher review replaces self-assessment and AI feedback.</p>
      </header>
      {q.loading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : !q.data?.length ? (
        <EmptyState title="Nothing waiting for review">New Writing and Speaking submissions will appear here.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col">Test</th>
                <th scope="col">Submitted</th>
                <th scope="col">Needs</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((a) => (
                <tr key={a.id}>
                  <td>{a.ownerName || 'Guest'}</td>
                  <td>{a.title}</td>
                  <td className="muted">{formatDate(a.submittedAt)}</td>
                  <td>
                    {a.skills
                      .filter((s) => s === 'writing' || s === 'speaking')
                      .map((s) => (
                        <span key={s} className="chip">
                          {SKILL_LABEL[s]}
                          {a.pendingReview.includes(s) ? '' : ' (self/AI)'}
                        </span>
                      ))}
                  </td>
                  <td>
                    <Button size="sm" variant="primary" onClick={() => navigate(`/results/${a.id}`)}>
                      Review
                    </Button>
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
