// Local state for the active section, with debounced autosave and a wall-clock countdown.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attempt, AudioState, ProgressPatch } from '../../../shared/types';
import type { Api } from '../../api';

export type SaveStatus = 'saved' | 'saving' | 'pending' | 'error';

export function useSectionState(api: Api, attempt: Attempt, sectionIndex: number, onTimeUp: () => void) {
  const section = attempt.sections[sectionIndex];
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...section.answers }));
  const [flags, setFlags] = useState<string[]>(() => [...section.flags]);
  const [writing, setWritingState] = useState<Record<string, string>>(() => ({ ...section.writing }));
  const [audioState, setAudioStateMap] = useState<Record<string, AudioState>>(() => ({ ...section.audioState }));
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState('');

  // ----- countdown -----
  const timed = section.timeLimitSec > 0;
  const endAt = useRef(Date.now() + section.remainingSec * 1000);
  const [remaining, setRemaining] = useState(section.remainingSec);
  const remainingRef = useRef(section.remainingSec);
  const timeUpFired = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!timed) return;
    const tick = () => {
      const r = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      remainingRef.current = r;
      setRemaining(r);
      if (r <= 0 && !timeUpFired.current) {
        timeUpFired.current = true;
        onTimeUpRef.current();
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [timed]);

  // ----- autosave -----
  const dirty = useRef<{ answers: Record<string, string>; writing: Record<string, string>; audio: Record<string, AudioState>; flags: boolean }>({
    answers: {},
    writing: {},
    audio: {},
    flags: false,
  });
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const stopped = useRef(false);

  const buildPatch = useCallback((): ProgressPatch | null => {
    const d = dirty.current;
    const has = Object.keys(d.answers).length || Object.keys(d.writing).length || Object.keys(d.audio).length || d.flags;
    dirty.current = { answers: {}, writing: {}, audio: {}, flags: false };
    const patch: ProgressPatch = { sectionIndex, remainingSec: timed ? remainingRef.current : undefined };
    if (Object.keys(d.answers).length) patch.answers = d.answers;
    if (Object.keys(d.writing).length) patch.writing = d.writing;
    if (Object.keys(d.audio).length) patch.audioState = d.audio;
    if (d.flags) patch.flags = flagsRef.current;
    return has || timed ? patch : null;
  }, [sectionIndex, timed]);

  const restoreDirty = (patch: ProgressPatch) => {
    const d = dirty.current;
    d.answers = { ...(patch.answers || {}), ...d.answers };
    d.writing = { ...(patch.writing || {}), ...d.writing };
    d.audio = { ...(patch.audioState || {}), ...d.audio };
    d.flags = d.flags || !!patch.flags;
  };

  const flush = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      if (stopped.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (inflight.current) await inflight.current.catch(() => undefined);
      const patch = buildPatch();
      if (!patch) return;
      setStatus('saving');
      const p = api
        .saveProgress(attempt.id, patch, opts)
        .then(() => {
          setStatus(Object.keys(dirty.current.answers).length || Object.keys(dirty.current.writing).length ? 'pending' : 'saved');
          setLastSaved(new Date());
          setSaveError('');
        })
        .catch((e: Error & { status?: number }) => {
          restoreDirty(patch);
          setStatus('error');
          setSaveError(e.message || 'Could not save.');
          // Retry after a pause unless the section is closed on the server.
          if (e.status !== 409 && e.status !== 404 && !stopped.current) {
            timer.current = setTimeout(() => void flush(), 5000);
          }
        });
      inflight.current = p;
      await p;
    },
    [api, attempt.id, buildPatch],
  );

  const schedule = useCallback(
    (delay = 700) => {
      setStatus('pending');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  // Save the clock every 15 seconds, and whenever the page is hidden or closed.
  useEffect(() => {
    const iv = timed ? setInterval(() => void flush(), 15000) : null;
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush({ keepalive: true });
    };
    const onPageHide = () => void flush({ keepalive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      if (iv) clearInterval(iv);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flush, timed]);

  // Warn before closing the tab while changes are unsaved.
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (status === 'pending' || status === 'saving' || status === 'error') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [status]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void flush({ keepalive: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setAnswer = (qid: string, value: string) => {
    setAnswers((a) => ({ ...a, [qid]: value }));
    dirty.current.answers[qid] = value;
    schedule();
  };
  const toggleFlag = (id: string) => {
    setFlags((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      flagsRef.current = next;
      return next;
    });
    dirty.current.flags = true;
    schedule(300);
  };
  const setWriting = (mid: string, text: string) => {
    setWritingState((w) => ({ ...w, [mid]: text }));
    dirty.current.writing[mid] = text;
    schedule(1500);
  };
  const setAudio = (mid: string, st: AudioState) => {
    setAudioStateMap((m) => ({ ...m, [mid]: st }));
    dirty.current.audio[mid] = st;
    schedule(200);
  };

  /** Everything current, for the final submit request. */
  const finalPatch = (): ProgressPatch => ({
    sectionIndex,
    answers,
    flags,
    writing,
    audioState,
    remainingSec: timed ? remainingRef.current : undefined,
  });

  /** Stop autosaving (after submit). */
  const stop = () => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
  };
  /** Re-enable autosaving (e.g. a submit request failed). */
  const resume = () => {
    stopped.current = false;
  };

  return {
    section,
    answers,
    flags,
    writing,
    audioState,
    remaining,
    timed,
    status,
    lastSaved,
    saveError,
    setAnswer,
    toggleFlag,
    setWriting,
    setAudio,
    flush,
    finalPatch,
    stop,
    resume,
  };
}

export type SectionState = ReturnType<typeof useSectionState>;
