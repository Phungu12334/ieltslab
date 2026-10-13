import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { BandSource } from '../../shared/types';
import { formatBand } from '../lib/format';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'secondary',
  icon,
  busy,
  children,
  className,
  size,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; busy?: boolean; size?: 'sm' | 'lg' }) {
  return (
    <button
      type="button"
      className={['btn', `btn-${variant}`, size ? `btn-${size}` : '', className || ''].join(' ').trim()}
      aria-busy={busy || undefined}
      disabled={rest.disabled || busy}
      {...rest}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Notice({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warn' | 'error' | 'ok'; title?: string; children?: ReactNode; icon?: IconName }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon || (tone === 'ok' ? 'check' : tone === 'info' ? 'info' : 'alert')} />
      <div>
        {title && <strong className="notice-title">{title}</strong>}
        {children && <div className="notice-body">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="empty">
      <Notice tone="error" title="Something went wrong">
        {msg}
      </Notice>
      {onRetry && (
        <Button icon="restart" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
  required,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  id?: string;
  required?: boolean;
}) {
  const auto = useId();
  const fid = id || auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={fid}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children({ id: fid, 'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <div className="hint" id={hintId}>
          {hint}
        </div>
      )}
      {error && (
        <div className="field-error" id={errId}>
          {error}
        </div>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="modal-inner">
          <header className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </header>
          <div className="modal-body">{children}</div>
          {footer && <footer className="modal-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export const SOURCE_LABEL: Record<BandSource, string> = {
  auto: 'Auto-scored',
  teacher: 'Teacher review',
  self: 'Self-assessed',
  ai: 'AI feedback',
  pending: 'Awaiting review',
};

export function BandPill({ band, source, size }: { band: number | null | undefined; source?: BandSource; size?: 'lg' }) {
  return (
    <span className={`band-pill${size === 'lg' ? ' band-pill-lg' : ''}${band == null ? ' is-pending' : ''}`}>
      <span className="band-num">{band == null ? 'Pending' : formatBand(band)}</span>
      {source && <span className="band-src">{SOURCE_LABEL[source]}</span>}
    </span>
  );
}

/** The 0–9 band scale drawn as a ruler with half-band ticks; optional target marker. */
export function BandRuler({ band, target, label }: { band: number | null; target?: number; label: string }) {
  const pct = (v: number) => `${(v / 9) * 100}%`;
  return (
    <div className="ruler" role="img" aria-label={`${label}: ${band == null ? 'pending' : `band ${formatBand(band)}`}${target ? `, target ${formatBand(target)}` : ''}`}>
      <div className="ruler-track">
        {band != null && <div className="ruler-fill" style={{ width: pct(band) }} />}
        {target ? <div className="ruler-target" style={{ left: pct(target) }} title={`Target ${formatBand(target)}`} /> : null}
        {Array.from({ length: 19 }, (_, i) => (
          <span key={i} className={`ruler-tick${i % 2 === 0 ? ' major' : ''}`} style={{ left: pct(i / 2) }} />
        ))}
      </div>
      <div className="ruler-labels" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ left: pct(i) }}>
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SkillIcon({ skill, size }: { skill: string; size?: number }) {
  const map: Record<string, IconName> = { listening: 'headphones', reading: 'book', writing: 'pen', speaking: 'chat' };
  return <Icon name={map[skill] || 'list'} size={size} />;
}
