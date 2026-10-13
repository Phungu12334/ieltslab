import { useEffect, useRef, useState } from 'react';
import { SKILL_LABEL } from '../../../shared/constants';
import { countWords, numberQuestions } from '../../../shared/scoring';
import type { Attempt } from '../../../shared/types';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Layout';
import { Button, Modal } from '../../components/ui';
import { formatClock, plural, prefs } from '../../lib/format';
import { useRouter } from '../../lib/router';
import { ObjectiveSection } from './ObjectiveSection';
import { SpeakingSection } from './SpeakingSection';
import { useSectionState, type SectionState } from './useSectionState';
import { WritingSection } from './WritingSection';

function SaveIndicator({ st }: { st: SectionState }) {
  const label =
    st.status === 'saving' ? 'Saving…' : st.status === 'pending' ? 'Unsaved changes' : st.status === 'error' ? 'Not saved, retrying' : st.lastSaved ? 'All changes saved' : 'Saved';
  return (
    <span className={`save-ind save-${st.status}`} role="status" title={st.saveError || undefined}>
      <span className="save-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function Countdown({ remaining, total }: { remaining: number; total: number }) {
  const [announce, setAnnounce] = useState('');
  const announced = useRef<Set<number>>(new Set());
  useEffect(() => {
    for (const mark of [600, 300, 60]) {
      if (remaining <= mark && remaining > mark - 5 && !announced.current.has(mark)) {
        announced.current.add(mark);
        setAnnounce(`${mark / 60} minute${mark === 60 ? '' : 's'} remaining`);
      }
    }
  }, [remaining]);
  const level = remaining <= 60 ? 'critical' : remaining <= 300 ? 'warn' : '';
  return (
    <div className={`countdown ${level}`}>
      <Icon name="clock" />
      <span className="countdown-time" role="timer" aria-label={`Time remaining ${formatClock(remaining)}`}>
        {formatClock(remaining)}
      </span>
      <span className="countdown-bar" aria-hidden="true">
        <span style={{ width: `${(remaining / total) * 100}%` }} />
      </span>
      <span className="sr-only" aria-live="assertive">
        {announce}
      </span>
    </div>
  );
}

export function ActiveSection({ attempt, sectionIndex, onSectionDone }: { attempt: Attempt; sectionIndex: number; onSectionDone: (a: Attempt) => void }) {
  const { api, toast, confirm } = useApp();
  const { navigate } = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scale, setScale] = useState(() => Number(prefs.get('bw-text-scale')) || 1);
  const submitRef = useRef<(auto: boolean) => Promise<void>>(async () => undefined);
  const st = useSectionState(api, attempt, sectionIndex, () => void submitRef.current(true));
  const section = st.section;
  const skill = section.skill;

  const doSubmit = async (auto: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    st.stop();
    try {
      const next = await api.submitSection(attempt.id, sectionIndex, { auto, final: st.finalPatch() });
      if (auto) toast(`Time is up. ${SKILL_LABEL[skill]} was submitted automatically.`, 'info');
      if (next.status === 'submitted') navigate(`/results/${attempt.id}`, { replace: true });
      else onSectionDone(next);
    } catch (e) {
      st.resume();
      setSubmitting(false);
      toast(e instanceof Error ? `Could not submit: ${e.message}` : 'Could not submit.', 'error');
    }
  };
  submitRef.current = doSubmit;

  const requestSubmit = async () => {
    let body: string;
    if (skill === 'reading' || skill === 'listening') {
      const total = numberQuestions(section).length;
      const answered = numberQuestions(section).filter((n) => (st.answers[n.question.id] || '').trim()).length;
      const flagged = st.flags.length;
      body = `You have answered ${answered} of ${total} questions${total - answered ? ` (${plural(total - answered, 'unanswered question')})` : ''}${
        flagged ? ` and flagged ${plural(flagged, 'question')} for review` : ''
      }.`;
    } else if (skill === 'writing') {
      body = section.materials
        .map((m) => {
          const w = countWords(st.writing[m.id] || '');
          const min = m.minWords || (m.part === 1 ? 150 : 250);
          return `Task ${m.part}: ${plural(w, 'word')}${w < min ? ` (below the ${min}-word minimum)` : ''}.`;
        })
        .join(' ');
    } else {
      body = 'Make sure you have recorded every answer you want reviewed.';
    }
    const last = sectionIndex === attempt.sections.length - 1;
    const ok = await confirm({
      title: `Submit ${SKILL_LABEL[skill]}?`,
      body: (
        <>
          <p>{body}</p>
          <p>{last ? 'This is the last section, so your results will be ready straight away.' : 'You will not be able to return to this section.'}</p>
        </>
      ),
      confirmLabel: last ? 'Submit and see results' : 'Submit section',
    });
    if (ok) await doSubmit(false);
  };

  const endTestNow = async () => {
    setExitOpen(false);
    const ok = await confirm({
      title: 'End the whole test now?',
      body: <p>Everything you have answered so far is submitted, including any sections you have not started. Unanswered questions are marked wrong.</p>,
      confirmLabel: 'End test',
      danger: true,
    });
    if (!ok) return;
    setSubmitting(true);
    st.stop();
    try {
      await api.endTest(attempt.id, st.finalPatch());
      navigate(`/results/${attempt.id}`, { replace: true });
    } catch (e) {
      st.resume();
      setSubmitting(false);
      toast(e instanceof Error ? e.message : 'Could not end the test.', 'error');
    }
  };

  const saveAndExit = async () => {
    setExitOpen(false);
    await st.flush();
    toast('Progress saved. Resume from the dashboard any time.', 'ok');
    navigate('/');
  };

  const changeScale = (d: number) => {
    const next = Math.min(1.4, Math.max(0.85, Math.round((scale + d) * 100) / 100));
    setScale(next);
    prefs.set('bw-text-scale', String(next));
  };

  return (
    <div className="runner" style={{ ['--text-scale' as string]: String(scale) }}>
      <header className="runner-top">
        <div className="runner-top-left">
          <Logo />
          <div>
            <div className="runner-skill">{SKILL_LABEL[skill]}</div>
            <div className="runner-meta">
              {attempt.kind === 'full' ? `Section ${sectionIndex + 1} of ${attempt.sections.length}` : attempt.title}
            </div>
          </div>
        </div>
        <div className="runner-top-center">{st.timed ? <Countdown remaining={st.remaining} total={section.timeLimitSec} /> : <span className="muted">Timed per answer</span>}</div>
        <div className="runner-top-right">
          <SaveIndicator st={st} />
          <div className="text-size" role="group" aria-label="Text size">
            <button type="button" className="icon-btn" onClick={() => changeScale(-0.1)} aria-label="Smaller text" disabled={scale <= 0.85}>
              A−
            </button>
            <button type="button" className="icon-btn" onClick={() => changeScale(0.1)} aria-label="Larger text" disabled={scale >= 1.4}>
              A+
            </button>
          </div>
          <button type="button" className="icon-btn" onClick={() => setHelpOpen(true)} aria-label="Help and instructions">
            <Icon name="info" />
          </button>
          <Button variant="ghost" size="sm" onClick={() => setExitOpen(true)}>
            Exit
          </Button>
        </div>
      </header>

      {skill === 'reading' || skill === 'listening' ? (
        <ObjectiveSection attempt={attempt} st={st} onSubmit={requestSubmit} submitting={submitting} />
      ) : skill === 'writing' ? (
        <WritingSection attempt={attempt} st={st} onSubmit={requestSubmit} submitting={submitting} />
      ) : (
        <SpeakingSection attempt={attempt} st={st} onSubmit={requestSubmit} submitting={submitting} />
      )}

      <Modal open={exitOpen} title="Leave the test?" onClose={() => setExitOpen(false)}>
        <div className="exit-options">
          <button type="button" className="exit-option" onClick={saveAndExit}>
            <strong>Save and exit</strong>
            <span>Your answers and remaining time are kept. Resume from the dashboard whenever you like.</span>
          </button>
          <button type="button" className="exit-option danger" onClick={endTestNow}>
            <strong>End test now</strong>
            <span>Submit everything as it is and go to your results.</span>
          </button>
        </div>
      </Modal>

      <Modal open={helpOpen} title="Help" onClose={() => setHelpOpen(false)} wide>
        <div className="prose">
          <h3>Moving around</h3>
          <ul>
            <li>Use the numbered buttons along the bottom to jump to any question. Filled buttons are answered; a corner marker means flagged.</li>
            <li>Previous and Next move one question at a time. Tab and Shift+Tab move between answer fields.</li>
            <li>Flag a question to come back to it. Review shows everything unanswered or flagged.</li>
          </ul>
          <h3>Saving and time</h3>
          <ul>
            <li>Answers save automatically. The indicator at the top shows when everything is saved.</li>
            <li>The timer keeps running while this page is open. If you leave with “Save and exit”, it continues from the same time when you return.</li>
            <li>When time runs out, the section is submitted automatically with the answers you have given.</li>
          </ul>
          <h3>Reading tools</h3>
          <ul>
            <li>Select words in a passage and choose Highlight. Use A− and A+ to change the text size.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
