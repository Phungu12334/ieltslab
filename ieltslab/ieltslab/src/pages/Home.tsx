import { SECTION_SPEC, SKILL_LABEL } from '../../shared/constants';
import type { AttemptSummary, Skill } from '../../shared/types';
import { SKILLS } from '../../shared/types';
import { useApp } from '../app/AppContext';
import { Icon } from '../components/Icon';
import { BandPill, Button, Notice, SkillIcon, Spinner } from '../components/ui';
import { firstName, formatBand, formatDate } from '../lib/format';
import { Link, useRouter } from '../lib/router';
import { useAsync } from '../lib/useAsync';

const DURATION: Record<Skill, string> = { listening: '30 min', reading: '60 min', writing: '60 min', speaking: '11–14 min' };
const PARTS: Record<Skill, string> = { listening: '4 parts · 40 questions', reading: '3 passages · 40 questions', writing: '2 tasks', speaking: '3 parts' };

export function Home() {
  const { api, user } = useApp();
  const { navigate } = useRouter();
  const attempts = useAsync(() => (user ? api.listAttempts() : Promise.resolve([] as AttemptSummary[])), [api, user?.id]);
  const avail = useAsync(() => api.availability(), [api]);

  const inProgress = (attempts.data || []).filter((a) => a.status === 'in_progress');
  const recent = (attempts.data || []).filter((a) => a.status === 'submitted').slice(0, 4);
  const named = user && !user.isGuest;
  const target = user?.settings.targetBand;

  const gaps: string[] = [];
  if (avail.data) {
    for (const skill of SKILLS) {
      for (const t of ['academic', 'general'] as const) {
        if (!SECTION_SPEC[skill].typeSpecific && t === 'general') continue;
        const missing = SECTION_SPEC[skill].parts.filter((p) => !avail.data!.availability[skill][t][p]);
        if (missing.length) gaps.push(`${SKILL_LABEL[skill]}${SECTION_SPEC[skill].typeSpecific ? ` (${t === 'academic' ? 'Academic' : 'General Training'})` : ''}: part ${missing.join(', ')}`);
      }
    }
  }

  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">IELTS-style practice · Academic &amp; General Training</p>
          <h1>{named ? `Welcome back, ${firstName(user!.name)}.` : 'Sit a practice test the way the real one runs.'}</h1>
          <p className="lede">
            Timed sections, question navigation, flags for review and automatic saving, then a full breakdown of every answer. Tests are assembled at
            random from your content bank, so each attempt is different.
          </p>
          <div className="row-gap">
            <Button variant="primary" size="lg" icon="play" onClick={() => navigate('/practice?kind=full')}>
              Start a full practice test
            </Button>
            <Button size="lg" onClick={() => navigate('/practice')}>
              Practise one skill
            </Button>
          </div>
          {target ? <p className="muted">Your target: band {formatBand(target)}</p> : null}
        </div>
        <div className="hero-panel" aria-label="Test structure">
          <h2 className="panel-title">The test at a glance</h2>
          <table className="glance">
            <tbody>
              {SKILLS.map((s) => (
                <tr key={s}>
                  <th scope="row">
                    <SkillIcon skill={s} size={16} /> {SKILL_LABEL[s]}
                  </th>
                  <td>{PARTS[s]}</td>
                  <td className="num">{DURATION[s]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fine">Listening, Reading and Writing are taken in one sitting; Speaking is often on a different day.</p>
        </div>
      </section>

      {api.mode === 'local' && (
        <Notice tone="warn" title="Browser-only mode">
          No IELTSLab server is connected, so tests, recordings and content are saved in this browser on this device. Accounts and Google sign-in become
          available when you run the server (see the README).
          {api.health.volatile ? ' This browser is blocking storage, so data will be lost when you close the page.' : ''}
        </Notice>
      )}

      {attempts.loading && user ? <Spinner /> : null}

      {inProgress.length > 0 && (
        <section className="stack">
          <h2>Continue where you left off</h2>
          <div className="card-grid">
            {inProgress.slice(0, 3).map((a) => (
              <article key={a.id} className="card resume-card">
                <p className="eyebrow">In progress</p>
                <h3>{a.title}</h3>
                <p className="muted">Last saved {formatDate(a.updatedAt)}</p>
                <div className="skill-dots" aria-label={`Sections: ${a.skills.map((s) => SKILL_LABEL[s]).join(', ')}`}>
                  {a.skills.map((s) => (
                    <span key={s} className="skill-dot">
                      <SkillIcon skill={s} size={14} />
                    </span>
                  ))}
                </div>
                <Button variant="primary" icon="play" onClick={() => navigate(`/attempt/${a.id}`)}>
                  Resume
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="stack">
          <div className="section-head">
            <h2>Recent results</h2>
            <Link to="/history">All attempts</Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Date</th>
                  {SKILLS.map((s) => (
                    <th scope="col" key={s} className="num">
                      {SKILL_LABEL[s]}
                    </th>
                  ))}
                  <th scope="col" className="num">
                    Overall
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/results/${a.id}`}>{a.title}</Link>
                    </td>
                    <td className="muted">{formatDate(a.submittedAt)}</td>
                    {SKILLS.map((s) => (
                      <td key={s} className="num">
                        {a.skills.includes(s) ? (a.bands[s] == null ? <span className="muted">Review</span> : formatBand(a.bands[s])) : <span className="muted">·</span>}
                      </td>
                    ))}
                    <td className="num">{a.overall == null ? <span className="muted">—</span> : <BandPill band={a.overall} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="stack">
        <h2>Practise a single skill</h2>
        <div className="card-grid four">
          {SKILLS.map((s) => (
            <article key={s} className="card skill-card">
              <div className="skill-card-head">
                <span className="skill-badge">
                  <SkillIcon skill={s} size={20} />
                </span>
                <h3>{SKILL_LABEL[s]}</h3>
              </div>
              <p className="muted">{SECTION_SPEC[s].summary.academic}</p>
              <Button onClick={() => navigate(`/practice?skill=${s}`)} icon="right">
                Set up
              </Button>
            </article>
          ))}
        </div>
      </section>

      {gaps.length > 0 && (
        <Notice tone="warn" title="Some parts have no active material">
          Tests can still start, but these parts will be skipped: {gaps.join('; ')}. Add content in the Content manager.
        </Notice>
      )}

      <section className="split-note">
        <div>
          <h2>How results work here</h2>
          <p>
            Listening and Reading are marked against the answer key and converted to an estimated band. Writing and Speaking show a band only after a
            review: your own self-assessment against the four criteria, a teacher’s review, or optional AI feedback when the server has it configured.
            Nothing here is an official IELTS score.
          </p>
          <Link to="/scoring">
            Read the scoring notes <Icon name="right" size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
