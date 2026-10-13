import { useState } from 'react';
import { partLabel, SECTION_SPEC, SKILL_LABEL, TEST_TYPE_LABEL } from '../../../shared/constants';
import { numberQuestions } from '../../../shared/scoring';
import type { Attempt, Skill } from '../../../shared/types';
import { useApp } from '../../app/AppContext';
import { Button, Notice, SkillIcon } from '../../components/ui';
import { formatDuration } from '../../lib/format';

const RULES: Record<Skill, (a: Attempt) => string[]> = {
  listening: (a) => [
    a.settings.listeningPlayback === 'exam'
      ? 'Each part plays once. You cannot pause, rewind or replay it, just as in the test.'
      : 'Practice mode: you can pause, rewind and replay each part.',
    'Read the questions for a part before you press Play. The answers come in the same order as the recording.',
    'Write your answers as you listen. Spelling counts, and you must keep to the word limit.',
    'Use the remaining time at the end to check your answers.',
  ],
  reading: () => [
    'Spend about 20 minutes on each passage. The questions for each passage are next to it.',
    'Select words in the passage and choose Highlight to mark them. Highlights stay on this device.',
    'For written answers, copy words from the passage exactly. Answers over the word limit are marked wrong.',
    'You can move between all passages and questions until you submit the section.',
  ],
  writing: () => [
    'There are two tasks. Task 2 counts twice as much as Task 1.',
    'Spend about 20 minutes on Task 1 and 40 minutes on Task 2.',
    'Writing under the minimum word count is penalised. Spell-check is switched off, as in the test.',
    'Your work saves automatically while you type.',
  ],
  speaking: () => [
    'Part 1: short questions about familiar topics. Part 2: one minute to prepare, then speak for up to two minutes. Part 3: a discussion of wider issues.',
    'You need a microphone. Your answers are recorded so you can listen back and review them.',
    'You can re-record an answer before you finish the section, but in the real test you only get one chance.',
    'The section has no overall clock; each answer has its own timer.',
  ],
};

function playTestTone() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.05);
    return true;
  } catch {
    return false;
  }
}

export function SectionIntro({ attempt, justSubmitted, onStarted }: { attempt: Attempt; justSubmitted: string | null; onStarted: (startedAt: string) => void }) {
  const { api, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const idx = attempt.currentSection;
  const section = attempt.sections[idx];
  const skill = section.skill;
  const qCount = numberQuestions(section).length;
  const missing = attempt.missing.filter((m) => m.skill === skill);

  const start = async () => {
    setBusy(true);
    try {
      await api.saveProgress(attempt.id, { sectionIndex: idx, startSection: true });
      onStarted(new Date().toISOString());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start the section.', 'error');
      setBusy(false);
    }
  };

  return (
    <main className="wrap narrow intro" id="main">
      {justSubmitted && (
        <Notice tone="ok" title={`${justSubmitted} submitted`}>
          Take a short break if you need one. The clock for the next section starts only when you press Start.
        </Notice>
      )}
      <p className="eyebrow">
        {attempt.kind === 'full' ? `Section ${idx + 1} of ${attempt.sections.length}` : 'Single-skill practice'} · {TEST_TYPE_LABEL[attempt.testType]}
      </p>
      <h1 className="intro-title">
        <span className="skill-badge lg">
          <SkillIcon skill={skill} size={26} />
        </span>
        {SKILL_LABEL[skill]}
      </h1>
      <dl className="facts">
        <div>
          <dt>Time</dt>
          <dd>{section.timeLimitSec ? formatDuration(section.timeLimitSec) : 'About 11–14 minutes'}</dd>
        </div>
        <div>
          <dt>{skill === 'writing' ? 'Tasks' : 'Parts'}</dt>
          <dd>{section.materials.map((m) => partLabel(skill, m.part, attempt.testType)).join(', ')}</dd>
        </div>
        {qCount > 0 && (
          <div>
            <dt>Questions</dt>
            <dd>{qCount}</dd>
          </div>
        )}
      </dl>
      <h2 className="h3">Instructions to candidates</h2>
      <ul className="rules">
        {RULES[skill](attempt).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {qCount > 0 && qCount < 40 && (
        <p className="muted">
          This practice section has {qCount} questions. The real test has 40; your raw score is scaled to 40 before it is converted to a band, so treat the
          band as a rough guide.
        </p>
      )}
      {missing.length > 0 && (
        <Notice tone="warn" title="Incomplete section">
          The content bank had no material for {missing.map((m) => partLabel(m.skill, m.part, attempt.testType)).join(', ')}, so {missing.length === 1 ? 'it is' : 'they are'} skipped.
        </Notice>
      )}
      {skill === 'listening' && (
        <div className="sound-check">
          <div>
            <strong>Check your sound</strong>
            <p className="muted">Use headphones if you can. Play the test tone and adjust your volume now.</p>
          </div>
          <Button icon="volume" onClick={() => (playTestTone() ? undefined : toast('This browser cannot play sound.', 'error'))}>
            Play test tone
          </Button>
        </div>
      )}
      <div className="row-gap intro-actions">
        <Button variant="primary" size="lg" icon="play" onClick={start} busy={busy}>
          Start {SKILL_LABEL[skill]}
        </Button>
        {section.timeLimitSec > 0 && <span className="muted">The {formatDuration(section.timeLimitSec)} timer starts now.</span>}
      </div>
      <p className="fine">{SECTION_SPEC[skill].summary[attempt.testType]}</p>
    </main>
  );
}
