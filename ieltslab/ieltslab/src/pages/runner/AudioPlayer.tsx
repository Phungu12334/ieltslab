// Listening audio: uploaded/linked audio files, or the author's script read by browser text-to-speech.
import { useEffect, useRef, useState } from 'react';
import { partLabel } from '../../../shared/constants';
import type { Attempt, AudioState, Material } from '../../../shared/types';
import { useApp } from '../../app/AppContext';
import { Icon } from '../../components/Icon';
import { Notice } from '../../components/ui';
import { formatClock } from '../../lib/format';
import type { SectionState } from './useSectionState';

type Mode = 'exam' | 'practice';

export function AudioBank({ attempt, st, currentMaterialId }: { attempt: Attempt; st: SectionState; currentMaterialId: string }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mode = attempt.settings.listeningPlayback;
  return (
    <>
      {st.section.materials.map((m) => (
        // Every player stays mounted so audio keeps playing while you look at another part.
        <div key={m.id} hidden={m.id !== currentMaterialId}>
          <AudioPlayer
            material={m}
            label={partLabel('listening', m.part)}
            mode={mode}
            state={st.audioState[m.id] || { plays: 0, finished: false }}
            onState={(s) => st.setAudio(m.id, s)}
            blockedBy={playingId && playingId !== m.id ? st.section.materials.find((x) => x.id === playingId) : undefined}
            onPlayingChange={(p) => setPlayingId((cur) => (p ? m.id : cur === m.id ? null : cur))}
          />
        </div>
      ))}
    </>
  );
}

interface PlayerProps {
  material: Material;
  label: string;
  mode: Mode;
  state: AudioState;
  onState: (s: AudioState) => void;
  blockedBy?: Material;
  onPlayingChange: (playing: boolean) => void;
}

function AudioPlayer(props: PlayerProps) {
  const { material } = props;
  if (material.audioAssetId || material.audioUrl) return <FilePlayer {...props} />;
  if (material.audioScript) return <SpeechPlayer {...props} />;
  return (
    <div className="audio-card">
      <Notice tone="error" title={`Audio unavailable for ${props.label}`}>
        No recording or script has been attached to this part, so it cannot be played. You can still answer from memory or skip it; tell your
        administrator so they can add the audio.
      </Notice>
    </div>
  );
}

function ExamNote({ mode, state, playing }: { mode: Mode; state: AudioState; playing: boolean }) {
  if (mode === 'practice') return <span className="audio-note">Practice mode · replays allowed {state.plays ? `· played ${state.plays}×` : ''}</span>;
  if (state.finished) return <span className="audio-note">Played. In the test you hear each part once.</span>;
  if (state.plays > 0 && !playing) return <span className="audio-note">Playback was interrupted. Under exam conditions it cannot be restarted.</span>;
  return <span className="audio-note">Exam conditions · plays once, no pausing</span>;
}

function FilePlayer({ material, label, mode, state, onState, blockedBy, onPlayingChange }: PlayerProps) {
  const { api } = useApp();
  const audio = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(material.audioUrl || null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!material.audioAssetId) return;
    api.fileUrl(material.audioAssetId).then(setSrc, () => setError('The audio file for this part could not be found.'));
  }, [api, material.audioAssetId]);

  useEffect(() => () => audio.current?.pause(), []);

  const locked = mode === 'exam' && (state.finished || (state.plays > 0 && !playing));
  const play = async () => {
    const el = audio.current;
    if (!el) return;
    setError('');
    try {
      if (el.ended) el.currentTime = 0;
      await el.play();
      if (el.currentTime < 0.5) onState({ plays: stateRef.current.plays + 1, finished: stateRef.current.finished });
    } catch {
      setError('The browser blocked playback or could not load the audio. Check your connection and press Play again.');
    }
  };

  return (
    <div className="audio-card" aria-label={`${label} audio`}>
      <audio
        ref={audio}
        src={src || undefined}
        preload="auto"
        onPlay={() => (setPlaying(true), onPlayingChange(true))}
        onPause={() => (setPlaying(false), onPlayingChange(false))}
        onEnded={() => {
          setPlaying(false);
          onPlayingChange(false);
          onState({ plays: stateRef.current.plays, finished: true });
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onError={() => setError('This audio could not be loaded. The file may be missing or in a format your browser cannot play.')}
      />
      <div className="audio-row">
        {mode === 'practice' ? (
          <>
            <button type="button" className="play-btn" onClick={() => (playing ? audio.current?.pause() : play())} disabled={!!blockedBy || !src} aria-label={playing ? 'Pause' : 'Play'}>
              <Icon name={playing ? 'pause' : 'play'} size={22} />
            </button>
            <button type="button" className="icon-btn" onClick={() => audio.current && (audio.current.currentTime = Math.max(0, audio.current.currentTime - 10))} aria-label="Back 10 seconds" disabled={!src}>
              <Icon name="back10" />
            </button>
          </>
        ) : (
          <button type="button" className="play-btn" onClick={play} disabled={locked || playing || !!blockedBy || !src} aria-label={state.finished ? 'Already played' : 'Play'}>
            <Icon name={playing ? 'volume' : state.finished ? 'check' : 'play'} size={22} />
          </button>
        )}
        <div className="audio-main">
          <div className="audio-title">
            <strong>{label}</strong>
            <ExamNote mode={mode} state={state} playing={playing} />
          </div>
          {mode === 'practice' ? (
            <input
              type="range"
              className="seek"
              min={0}
              max={duration || 0}
              step={0.5}
              value={time}
              onChange={(e) => audio.current && (audio.current.currentTime = Number(e.target.value))}
              aria-label="Position"
              disabled={!duration}
            />
          ) : (
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${duration ? (time / duration) * 100 : state.finished ? 100 : 0}%` }} />
            </div>
          )}
        </div>
        <span className="audio-time">
          {formatClock(time)} / {duration ? formatClock(duration) : '--:--'}
        </span>
        <label className="vol">
          <Icon name="volume" size={16} />
          <span className="sr-only">Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => (setVolume(Number(e.target.value)), audio.current && (audio.current.volume = Number(e.target.value)))} />
        </label>
      </div>
      {blockedBy && <p className="audio-note">Another part is playing. Wait for it to finish.</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

// ---------------- text-to-speech ----------------
interface Chunk {
  speaker: string;
  text: string;
}

function toChunks(script: string): Chunk[] {
  const out: Chunk[] = [];
  let speaker = '';
  for (const raw of script.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([A-Z][A-Z .'-]{1,30}):\s*(.*)$/.exec(line);
    const text = m ? m[2] : line;
    if (m) speaker = m[1];
    // Short utterances avoid browsers cutting off long speech.
    for (const sentence of text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text]) {
      if (sentence.trim()) out.push({ speaker, text: sentence.trim() });
    }
  }
  return out;
}

function pickVoices(): SpeechSynthesisVoice[] {
  try {
    const all = window.speechSynthesis.getVoices();
    const en = all.filter((v) => /^en[-_]/i.test(v.lang));
    const pref = ['en-GB', 'en-AU', 'en-NZ', 'en-IE', 'en-US', 'en-CA'];
    return (en.length ? en : all).sort((a, b) => {
      const ia = pref.indexOf(a.lang.replace('_', '-'));
      const ib = pref.indexOf(b.lang.replace('_', '-'));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  } catch {
    return [];
  }
}

function SpeechPlayer({ material, label, mode, state, onState, blockedBy, onPlayingChange }: PlayerProps) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const chunks = useRef<Chunk[]>(toChunks(material.audioScript || ''));
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused' | 'ended'>(state.finished ? 'ended' : 'idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (supported ? pickVoices() : []));
  const [error, setError] = useState('');
  const run = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!supported) return;
    const on = () => setVoices(pickVoices());
    window.speechSynthesis.addEventListener?.('voiceschanged', on);
    const t = setTimeout(on, 800);
    return () => {
      clearTimeout(t);
      window.speechSynthesis.removeEventListener?.('voiceschanged', on);
    };
  }, [supported]);

  useEffect(
    () => () => {
      run.current++;
      if (supported) window.speechSynthesis.cancel();
    },
    [supported],
  );

  const speakers = [...new Set(chunks.current.map((c) => c.speaker))];
  const speakFrom = (start: number) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const myRun = ++run.current;
    setStatus('playing');
    onPlayingChange(true);
    const say = (i: number) => {
      if (run.current !== myRun) return;
      if (i >= chunks.current.length) {
        setStatus('ended');
        onPlayingChange(false);
        onState({ plays: stateRef.current.plays, finished: true });
        return;
      }
      setIndex(i);
      const c = chunks.current[i];
      const u = new SpeechSynthesisUtterance(c.text);
      const si = Math.max(0, speakers.indexOf(c.speaker));
      const v = voices.length ? voices[si % voices.length] : undefined;
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = 'en-GB';
      // With a single voice, vary pitch so speakers can be told apart.
      u.pitch = voices.length > 1 ? 1 : [1, 0.75, 1.25, 0.9][si % 4];
      u.rate = 0.95;
      u.onend = () => say(i + 1);
      u.onerror = (ev) => {
        if (run.current !== myRun || ev.error === 'interrupted' || ev.error === 'canceled') return;
        setError('Speech playback failed in this browser. Try another browser such as Chrome, Edge or Safari.');
        setStatus('idle');
        onPlayingChange(false);
      };
      synth.speak(u);
    };
    say(start);
  };

  if (!supported) {
    return (
      <div className="audio-card">
        <Notice tone="error" title={`Audio unavailable for ${label}`}>
          This part uses your browser’s text-to-speech, which this browser does not support. Open the test in a current version of Chrome, Edge,
          Safari or Firefox.
        </Notice>
      </div>
    );
  }

  const total = chunks.current.length;
  const examLocked = mode === 'exam' && (state.finished || (state.plays > 0 && status !== 'playing'));
  const play = () => {
    setError('');
    onState({ plays: stateRef.current.plays + 1, finished: stateRef.current.finished });
    speakFrom(0);
  };

  return (
    <div className="audio-card" aria-label={`${label} audio`}>
      <div className="audio-row">
        {mode === 'practice' ? (
          <>
            <button
              type="button"
              className="play-btn"
              disabled={!!blockedBy}
              onClick={() => {
                if (status === 'playing') {
                  run.current++;
                  window.speechSynthesis.cancel();
                  setStatus('paused');
                  onPlayingChange(false);
                } else if (status === 'paused') speakFrom(index);
                else play();
              }}
              aria-label={status === 'playing' ? 'Pause' : status === 'paused' ? 'Resume' : 'Play'}
            >
              <Icon name={status === 'playing' ? 'pause' : 'play'} size={22} />
            </button>
            <button type="button" className="icon-btn" onClick={() => speakFrom(Math.max(0, index - 2))} disabled={status === 'idle' || !!blockedBy} aria-label="Back two sentences">
              <Icon name="back10" />
            </button>
            <button type="button" className="icon-btn" onClick={play} disabled={!!blockedBy} aria-label="Restart from the beginning">
              <Icon name="restart" />
            </button>
          </>
        ) : (
          <button type="button" className="play-btn" onClick={play} disabled={examLocked || status === 'playing' || !!blockedBy} aria-label={state.finished ? 'Already played' : 'Play'}>
            <Icon name={status === 'playing' ? 'volume' : state.finished ? 'check' : 'play'} size={22} />
          </button>
        )}
        <div className="audio-main">
          <div className="audio-title">
            <strong>{label}</strong>
            <ExamNote mode={mode} state={state} playing={status === 'playing'} />
          </div>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${status === 'ended' || state.finished ? 100 : total ? (index / total) * 100 : 0}%` }} />
          </div>
        </div>
        <span className="audio-time">
          {status === 'idle' && !state.finished ? 'Ready' : status === 'ended' || state.finished ? 'Finished' : `${index + 1} / ${total}`}
        </span>
      </div>
      <p className="audio-note synthetic">
        <Icon name="info" size={14} /> Synthetic voice: this part has no recording, so your browser reads the author’s script aloud. Accents and timing
        will differ from a real recording.
      </p>
      {blockedBy && <p className="audio-note">Another part is playing. Wait for it to finish.</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
