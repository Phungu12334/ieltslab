import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attempt, Material, RecordingRef } from '../../../shared/types';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Button, Notice } from '../../components/ui';
import { formatClock } from '../../lib/format';
import { useRecorder } from './useRecorder';
import type { SectionState } from './useSectionState';

interface Step {
  key: string;
  material: Material;
  part: number;
  index: number;
  prompt: string;
}

type Phase = 'ready' | 'prep' | 'speaking' | 'done';

function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = synth.getVoices().find((x) => /^en[-_]GB/i.test(x.lang)) || synth.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.rate = 0.95;
    synth.speak(u);
  } catch {
    /* optional feature */
  }
}

export function SpeakingSection({ attempt, st, onSubmit, submitting }: { attempt: Attempt; st: SectionState; onSubmit: () => void; submitting: boolean }) {
  const { api, toast } = useApp();
  const mic = useRecorder();
  const steps: Step[] = useMemo(
    () =>
      st.section.materials.flatMap((m) =>
        m.part === 2
          ? [{ key: `${m.id}:0`, material: m, part: 2, index: 0, prompt: m.prompt || m.title }]
          : (m.speakingQuestions || []).map((q, i) => ({ key: `${m.id}:${i}`, material: m, part: m.part, index: i, prompt: q })),
      ),
    [st.section.materials],
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [prepLeft, setPrepLeft] = useState(0);
  const [noMic, setNoMic] = useState(false);
  const [started, setStarted] = useState(false);
  const [recordings, setRecordings] = useState<Record<string, RecordingRef>>(() => ({ ...st.section.recordings }));
  const [practised, setPractised] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, { blob: Blob; durationSec: number }>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [timerStart, setTimerStart] = useState(0);
  const [now, setNow] = useState(Date.now());
  const step = steps[stepIdx];
  const tts = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Resolve playback URLs for saved recordings.
  useEffect(() => {
    Object.entries(recordings).forEach(([k, r]) => {
      if (urls[k]) return;
      api.fileUrl(r.id).then((u) => setUrls((m) => ({ ...m, [k]: u })), () => undefined);
    });
  }, [recordings]); // eslint-disable-line react-hooks/exhaustive-deps

  const limit = step ? (step.part === 2 ? step.material.responseSeconds || 120 : (step.material.responseSeconds || 30) * 2) : 0;
  const target = step ? step.material.responseSeconds || (step.part === 2 ? 120 : 30) : 0;

  // Clock for preparation and answer timers.
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'speaking') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  const elapsed = phase === 'speaking' ? (mic.recording ? mic.elapsed : (now - timerStart) / 1000) : 0;
  const finishing = useRef(false);

  const beginSpeaking = () => {
    if (!noMic) {
      if (!mic.start()) {
        toast('The microphone is not ready.', 'error');
        return;
      }
    }
    finishing.current = false;
    setTimerStart(Date.now());
    setNow(Date.now());
    setPhase('speaking');
  };

  const finishSpeaking = async () => {
    if (finishing.current || !step) return;
    finishing.current = true;
    const key = step.key;
    if (noMic) {
      setPractised((s) => new Set(s).add(key));
      setPhase('done');
      return;
    }
    const { blob, durationSec } = await mic.stop();
    setPhase('done');
    if (!blob.size) {
      toast('Nothing was recorded. Check your microphone and try again.', 'error');
      return;
    }
    setUrls((m) => ({ ...m, [key]: URL.createObjectURL(blob) }));
    await upload(key, blob, durationSec);
  };

  const upload = async (key: string, blob: Blob, durationSec: number) => {
    setUploading(key);
    try {
      const ref = await api.uploadRecording(attempt.id, key, blob, durationSec);
      setRecordings((r) => ({ ...r, [key]: ref }));
      setFailed((f) => {
        const n = { ...f };
        delete n[key];
        return n;
      });
    } catch (e) {
      setFailed((f) => ({ ...f, [key]: { blob, durationSec } }));
      toast(e instanceof Error ? `Recording not saved: ${e.message}` : 'Recording not saved.', 'error');
    } finally {
      setUploading(null);
    }
  };

  // Automatic stops: preparation ends → start speaking; answer reaches its limit → stop.
  useEffect(() => {
    if (phase === 'prep') {
      const left = Math.max(0, Math.ceil(prepLeft - (now - timerStart) / 1000));
      if (left <= 0) beginSpeaking();
    } else if (phase === 'speaking' && elapsed >= limit) {
      toast(step?.part === 2 ? 'Two minutes are up. The examiner would stop you here.' : 'Time is up for this answer.', 'info');
      void finishSpeaking();
    }
  }, [now, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i: number) => {
    if (phase === 'speaking' || phase === 'prep') return;
    setStepIdx(i);
    const s = steps[i];
    setPhase(recordings[s.key] || practised.has(s.key) ? 'done' : 'ready');
  };

  if (!steps.length) {
    return (
      <div className="wrap runner-empty">
        <p>This section has no speaking prompts.</p>
        <Button variant="primary" onClick={onSubmit} busy={submitting}>
          Submit section
        </Button>
      </div>
    );
  }

  // ---------------- microphone check ----------------
  if (!started) {
    return (
      <div className="wrap narrow speak-check">
        <h2>Microphone check</h2>
        <p>Your answers are recorded so you can listen back and review them against the speaking criteria.</p>
        {mic.status === 'ready' ? (
          <>
            <div className="level" aria-label="Microphone input level">
              <span style={{ width: `${Math.round(mic.level * 100)}%` }} />
            </div>
            <p className="muted">Say a few words. The bar should move when you speak.</p>
            <Button variant="primary" size="lg" icon="play" onClick={() => setStarted(true)}>
              Begin Part {steps[0].part}
            </Button>
          </>
        ) : mic.status === 'unsupported' ? (
          <Notice tone="warn" title="Recording is not available in this browser">
            You can still practise: the prompts and timers work, but nothing is recorded.
          </Notice>
        ) : (
          <>
            {(mic.status === 'denied' || mic.status === 'error') && <Notice tone="error">{mic.message}</Notice>}
            <Button variant="primary" size="lg" icon="mic" onClick={() => void mic.request()} busy={mic.status === 'requesting'}>
              {mic.status === 'denied' || mic.status === 'error' ? 'Try again' : 'Allow microphone'}
            </Button>
          </>
        )}
        {mic.status !== 'ready' && (
          <p>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setNoMic(true);
                setStarted(true);
              }}
            >
              Continue without recording
            </button>{' '}
            <span className="muted">(timers only; answers cannot be reviewed later)</span>
          </p>
        )}
      </div>
    );
  }

  const key = step.key;
  const isPart2 = step.part === 2;
  const done = !!recordings[key] || practised.has(key);
  const prepRemaining = phase === 'prep' ? Math.max(0, Math.ceil(prepLeft - (now - timerStart) / 1000)) : step.material.prepSeconds ?? 60;
  const parts = [...new Set(steps.map((s) => s.part))];
  const recordedCount = steps.filter((s) => recordings[s.key]).length;

  return (
    <div className="runner-body speak-layout">
      <aside className="speak-steps" aria-label="Speaking questions">
        {parts.map((p) => (
          <div key={p} className="speak-part">
            <h3>Part {p}</h3>
            <ol>
              {steps.map((s, i) =>
                s.part !== p ? null : (
                  <li key={s.key}>
                    <button
                      type="button"
                      className={`speak-step${i === stepIdx ? ' current' : ''}${recordings[s.key] || practised.has(s.key) ? ' done' : ''}`}
                      onClick={() => goTo(i)}
                      disabled={phase === 'speaking' || phase === 'prep'}
                      aria-current={i === stepIdx ? 'step' : undefined}
                    >
                      <span className="speak-step-icon">{recordings[s.key] ? <Icon name="check" size={14} /> : practised.has(s.key) ? <Icon name="clock" size={14} /> : i + 1}</span>
                      <span className="speak-step-text">{s.part === 2 ? 'Long turn' : s.prompt}</span>
                    </button>
                  </li>
                ),
              )}
            </ol>
          </div>
        ))}
        <div className="speak-finish">
          <p className="muted">
            {noMic ? 'Recording is off.' : `${recordedCount} of ${steps.length} answers recorded.`}
          </p>
          <Button variant="primary" onClick={onSubmit} busy={submitting} disabled={phase === 'speaking' || phase === 'prep' || !!uploading}>
            Finish Speaking
          </Button>
        </div>
      </aside>

      <section className="speak-stage" aria-live="polite">
        <p className="eyebrow">
          Part {step.part}
          {!isPart2 && ` · Question ${step.index + 1} of ${(step.material.speakingQuestions || []).length}`}
        </p>
        {isPart2 ? (
          <div className="cue-card">
            <p className="cue-topic">{step.prompt}</p>
            <p className="cue-say">You should say:</p>
            <ul>
              {(step.material.bullets || []).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="speak-question">{step.prompt}</p>
        )}
        {step.material.instructions && phase === 'ready' && <p className="muted">{step.material.instructions}</p>}

        {tts && phase === 'ready' && (
          <button type="button" className="link-btn" onClick={() => speak(isPart2 ? `${step.prompt}. You should say: ${(step.material.bullets || []).join('; ')}` : step.prompt)}>
            <Icon name="volume" size={16} /> Hear the examiner read this
          </button>
        )}

        {isPart2 && (phase === 'ready' || phase === 'prep') && (
          <div className="notes">
            <label htmlFor={`notes-${step.material.id}`}>Your notes (not marked)</label>
            <textarea id={`notes-${step.material.id}`} rows={5} value={st.writing[step.material.id] || ''} onChange={(e) => st.setWriting(step.material.id, e.target.value)} />
          </div>
        )}

        <div className="speak-controls">
          {phase === 'ready' &&
            (isPart2 && (step.material.prepSeconds ?? 60) > 0 ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  icon="clock"
                  onClick={() => {
                    setPrepLeft(step.material.prepSeconds ?? 60);
                    setTimerStart(Date.now());
                    setNow(Date.now());
                    setPhase('prep');
                  }}
                >
                  Start {step.material.prepSeconds ?? 60}-second preparation
                </Button>
                <Button onClick={beginSpeaking}>Skip preparation</Button>
              </>
            ) : (
              <Button variant="primary" size="lg" icon={noMic ? 'clock' : 'mic'} onClick={beginSpeaking}>
                {noMic ? 'Start answer timer' : 'Start recording'}
              </Button>
            ))}

          {phase === 'prep' && (
            <div className="timer-block">
              <span className="big-timer" role="timer">
                {formatClock(prepRemaining)}
              </span>
              <span className="muted">Preparation. Recording starts automatically when the time is up.</span>
              <Button onClick={beginSpeaking} icon="mic">
                Start speaking now
              </Button>
            </div>
          )}

          {phase === 'speaking' && (
            <div className="timer-block">
              <span className={`rec-dot${noMic ? ' off' : ''}`} aria-hidden="true" />
              <span className="big-timer" role="timer">
                {formatClock(elapsed)}
              </span>
              <span className="muted">
                {noMic ? 'Answer timer (not recording).' : 'Recording.'} {isPart2 ? `Speak for 1–2 minutes; stops at ${formatClock(limit)}.` : `Aim for about ${target} seconds.`}
              </span>
              {!noMic && (
                <div className="level small" aria-hidden="true">
                  <span style={{ width: `${Math.round(mic.level * 100)}%` }} />
                </div>
              )}
              <Button variant="primary" icon="stop" onClick={() => void finishSpeaking()}>
                Stop
              </Button>
            </div>
          )}

          {phase === 'done' && (
            <div className="done-block">
              {uploading === key ? (
                <p className="muted">
                  <span className="spinner" aria-hidden="true" /> Saving recording…
                </p>
              ) : failed[key] ? (
                <Notice tone="error" title="This recording has not been saved">
                  <Button size="sm" icon="upload" onClick={() => void upload(key, failed[key].blob, failed[key].durationSec)}>
                    Retry saving
                  </Button>
                </Notice>
              ) : recordings[key] ? (
                <p className="saved-line">
                  <Icon name="check" size={16} /> Saved · {Math.round(recordings[key].durationSec)} seconds
                </p>
              ) : (
                <p className="muted">Answer timed (not recorded).</p>
              )}
              {urls[key] && <audio controls src={urls[key]} className="playback" aria-label="Play back your answer" />}
              <div className="row-gap">
                {!noMic && (
                  <Button icon="restart" onClick={() => setPhase('ready')} disabled={uploading === key}>
                    Re-record
                  </Button>
                )}
                {stepIdx < steps.length - 1 ? (
                  <Button variant="primary" icon="right" onClick={() => goTo(stepIdx + 1)} disabled={uploading === key}>
                    Next question
                  </Button>
                ) : (
                  <Button variant="primary" onClick={onSubmit} busy={submitting} disabled={uploading === key}>
                    Finish Speaking
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        {done && phase === 'ready' && <p className="muted">You already have an answer for this question. Recording again will replace it.</p>}
      </section>
    </div>
  );
}
