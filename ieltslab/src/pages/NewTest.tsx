import { useState } from 'react';
import { FULL_TEST_ORDER, partLabel, SECTION_SPEC, SKILL_LABEL } from '../../shared/constants';
import type { AttemptKind, ListeningPlayback, Skill, TestType } from '../../shared/types';
import { SKILLS } from '../../shared/types';
import { useApp } from '../app/AppContext';
import { Button, Notice, SkillIcon, Spinner } from '../components/ui';
import { formatDuration } from '../lib/format';
import { useRouter } from '../lib/router';
import { useAsync } from '../lib/useAsync';

export function NewTest() {
  const { api, user, ensureUser, toast } = useApp();
  const { route, navigate } = useRouter();
  const qSkill = route.query.get('skill') as Skill | null;
  const [kind, setKind] = useState<AttemptKind>(route.query.get('kind') === 'full' ? 'full' : qSkill ? 'section' : 'full');
  const [skill, setSkill] = useState<Skill>(qSkill && SKILLS.includes(qSkill) ? qSkill : 'reading');
  const [testType, setTestType] = useState<TestType>(user?.settings.defaultTestType || 'academic');
  const [playback, setPlayback] = useState<ListeningPlayback>('exam');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const avail = useAsync(() => api.availability(), [api]);

  const skills = kind === 'full' ? FULL_TEST_ORDER : [skill];
  const typeMatters = skills.some((s) => SECTION_SPEC[s].typeSpecific);
  const totalSec = skills.reduce((t, s) => t + (SECTION_SPEC[s].timeLimitSec || 14 * 60), 0);

  const missing = avail.data
    ? skills.flatMap((s) => SECTION_SPEC[s].parts.filter((p) => !avail.data!.availability[s][testType][p]).map((p) => `${SKILL_LABEL[s]} ${partLabel(s, p, testType)}`))
    : [];
  const nothing = avail.data ? skills.every((s) => SECTION_SPEC[s].parts.every((p) => !avail.data!.availability[s][testType][p])) : false;

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await ensureUser();
      const a = await api.createAttempt({ kind, skills, testType, settings: { listeningPlayback: playback } });
      navigate(`/attempt/${a.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create the test.';
      setError(msg);
      toast(msg, 'error');
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg narrow">
      <header className="page-head">
        <p className="eyebrow">New practice test</p>
        <h1>Set up your test</h1>
        <p className="lede">Questions are drawn at random from the content bank and fixed for this attempt, so reloading or resuming never reshuffles them.</p>
      </header>

      <fieldset className="choice-group">
        <legend>Test length</legend>
        <div className="choice-row">
          <label className={`choice${kind === 'full' ? ' selected' : ''}`}>
            <input type="radio" name="kind" checked={kind === 'full'} onChange={() => setKind('full')} />
            <span className="choice-title">Full test</span>
            <span className="choice-desc">Listening, Reading, Writing, then Speaking. About 2 h 45 min. Gives an overall band.</span>
          </label>
          <label className={`choice${kind === 'section' ? ' selected' : ''}`}>
            <input type="radio" name="kind" checked={kind === 'section'} onChange={() => setKind('section')} />
            <span className="choice-title">One skill</span>
            <span className="choice-desc">Focus on a single section with its real timing.</span>
          </label>
        </div>
      </fieldset>

      {kind === 'section' && (
        <fieldset className="choice-group">
          <legend>Skill</legend>
          <div className="choice-row four">
            {SKILLS.map((s) => (
              <label key={s} className={`choice compact${skill === s ? ' selected' : ''}`}>
                <input type="radio" name="skill" checked={skill === s} onChange={() => setSkill(s)} />
                <span className="choice-title">
                  <SkillIcon skill={s} size={16} /> {SKILL_LABEL[s]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="choice-group" disabled={!typeMatters}>
        <legend>Test format</legend>
        <div className="choice-row">
          {(['academic', 'general'] as TestType[]).map((t) => (
            <label key={t} className={`choice${testType === t ? ' selected' : ''}`}>
              <input type="radio" name="type" checked={testType === t} onChange={() => setTestType(t)} />
              <span className="choice-title">{t === 'academic' ? 'Academic' : 'General Training'}</span>
              <span className="choice-desc">
                {t === 'academic'
                  ? 'For university study and professional registration. Academic texts; Task 1 describes a chart or diagram.'
                  : 'For work, training and migration. Everyday and workplace texts; Task 1 is a letter.'}
              </span>
            </label>
          ))}
        </div>
        {!typeMatters && <p className="hint">{SKILL_LABEL[skill]} is the same for Academic and General Training.</p>}
      </fieldset>

      {skills.includes('listening') && (
        <fieldset className="choice-group">
          <legend>Listening playback</legend>
          <div className="choice-row">
            <label className={`choice${playback === 'exam' ? ' selected' : ''}`}>
              <input type="radio" name="playback" checked={playback === 'exam'} onChange={() => setPlayback('exam')} />
              <span className="choice-title">Exam conditions</span>
              <span className="choice-desc">Each part plays once. No pausing, rewinding or replays, as in the real test.</span>
            </label>
            <label className={`choice${playback === 'practice' ? ' selected' : ''}`}>
              <input type="radio" name="playback" checked={playback === 'practice'} onChange={() => setPlayback('practice')} />
              <span className="choice-title">Practice mode</span>
              <span className="choice-desc">Pause, rewind and replay as often as you like. Useful for study, not for a score you can trust.</span>
            </label>
          </div>
        </fieldset>
      )}

      <section className="card summary-card" aria-labelledby="summary-title">
        <h2 id="summary-title">Your test</h2>
        {avail.loading ? (
          <Spinner label="Checking available content…" />
        ) : (
          <ol className="section-list">
            {skills.map((s) => (
              <li key={s}>
                <span className="section-list-skill">
                  <SkillIcon skill={s} size={16} /> {SKILL_LABEL[s]}
                </span>
                <span className="muted">
                  {SECTION_SPEC[s].parts.map((p) => partLabel(s, p, testType)).join(' · ')}
                </span>
                <span className="num">{SECTION_SPEC[s].timeLimitSec ? formatDuration(SECTION_SPEC[s].timeLimitSec) : 'per-question timers'}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="muted">Total time about {formatDuration(totalSec)}. You can leave and resume later; your answers and remaining time are saved.</p>
        {missing.length > 0 && !nothing && (
          <Notice tone="warn" title="Some parts have no material yet">
            {missing.join(', ')} will be skipped. Results will be marked as incomplete.
          </Notice>
        )}
        {nothing && (
          <Notice tone="error" title="No material available">
            There is no active content for this selection. An administrator can add it in the Content manager or restore the demo set.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="row-gap">
          <Button variant="primary" size="lg" icon="play" onClick={start} busy={busy} disabled={nothing || avail.loading}>
            Create test
          </Button>
          {!user && api.mode === 'server' && <span className="muted">You’ll start as a guest. Create an account later to keep your history.</span>}
        </div>
      </section>
    </div>
  );
}
