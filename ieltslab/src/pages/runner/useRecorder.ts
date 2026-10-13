import { useCallback, useEffect, useRef, useState } from 'react';

export type MicStatus = 'unknown' | 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error';

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  try {
    for (const t of options) if (MediaRecorder.isTypeSupported(t)) return t;
  } catch {
    /* ignore */
  }
  return '';
}

/** Microphone access, a live input level, and simple start/stop recording. */
export function useRecorder() {
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window !== 'undefined' && 'MediaRecorder' in window;
  const [status, setStatus] = useState<MicStatus>(supported ? 'unknown' : 'unsupported');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const raf = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const resolver = useRef<((v: { blob: Blob; durationSec: number }) => void) | null>(null);

  const request = useCallback(async () => {
    if (!supported) return false;
    if (stream.current) return true;
    setStatus('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      setStatus('ready');
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        audioCtx.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        /* level meter is optional */
      }
      return true;
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
        setMessage('Microphone access was blocked. Allow it in your browser’s site settings (the icon in the address bar), then press “Try again”.');
      } else if (name === 'NotFoundError') {
        setStatus('error');
        setMessage('No microphone was found. Connect one and press “Try again”.');
      } else {
        setStatus('error');
        setMessage('The microphone could not be started. Close other apps that may be using it and try again.');
      }
      return false;
    }
  }, [supported]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 200);
    return () => clearInterval(t);
  }, [recording]);

  const start = useCallback(() => {
    if (!stream.current) return false;
    const mime = pickMime();
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const durationSec = (Date.now() - startedAt.current) / 1000;
      const blob = new Blob(chunks.current, { type: r.mimeType || mime || 'audio/webm' });
      setRecording(false);
      resolver.current?.({ blob, durationSec });
      resolver.current = null;
    };
    startedAt.current = Date.now();
    setElapsed(0);
    r.start(1000);
    rec.current = r;
    setRecording(true);
    return true;
  }, []);

  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; durationSec: number }>((resolve) => {
        const r = rec.current;
        if (!r || r.state === 'inactive') return resolve({ blob: new Blob(), durationSec: 0 });
        resolver.current = resolve;
        r.stop();
      }),
    [],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      try {
        if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
      } catch {
        /* ignore */
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      audioCtx.current?.close().catch(() => undefined);
    },
    [],
  );

  return { supported, status, message, level, recording, elapsed, request, start, stop };
}
