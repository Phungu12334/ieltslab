import { useState } from 'react';
import { BAND_STEPS, type Criterion } from '../../shared/constants';
import { average, roundBand } from '../../shared/scoring';
import type { CriterionReview } from '../../shared/types';
import { Button, Notice } from '../components/ui';
import { formatBand } from '../lib/format';

export interface ReviewTarget {
  key: string;
  title: string;
  criteria: Criterion[];
}

/** Criterion-by-criterion review form used for self, teacher and AI-adjusted reviews. */
export function ReviewForm({
  targets,
  initial,
  submitLabel,
  intro,
  onSubmit,
}: {
  targets: ReviewTarget[];
  initial?: Record<string, CriterionReview>;
  submitLabel: string;
  intro?: string;
  onSubmit: (items: Record<string, CriterionReview>) => Promise<void>;
}) {
  const [items, setItems] = useState<Record<string, CriterionReview>>(() =>
    Object.fromEntries(targets.map((t) => [t.key, { scores: { ...(initial?.[t.key]?.scores || {}) }, comment: initial?.[t.key]?.comment || '' }])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const complete = targets.every((t) => t.criteria.every((c) => typeof items[t.key]?.scores[c.key] === 'number'));

  const submit = async () => {
    if (!complete) {
      setError('Choose a band for every criterion.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="review-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {intro && <p className="muted">{intro}</p>}
      {targets.map((t) => {
        const it = items[t.key];
        const vals = t.criteria.map((c) => it.scores[c.key]).filter((v): v is number => typeof v === 'number');
        const est = vals.length === t.criteria.length ? roundBand(average(vals)) : null;
        return (
          <fieldset key={t.key} className="review-target">
            <legend>
              {t.title}
              {est !== null && <span className="review-est">≈ band {formatBand(est)}</span>}
            </legend>
            <div className="criteria">
              {t.criteria.map((c) => {
                const id = `rv-${t.key}-${c.key}`;
                return (
                  <div key={c.key} className="criterion">
                    <div className="criterion-head">
                      <label htmlFor={id}>
                        <strong>{c.label}</strong>
                      </label>
                      <select
                        id={id}
                        value={it.scores[c.key] ?? ''}
                        onChange={(e) =>
                          setItems((s) => ({
                            ...s,
                            [t.key]: { ...s[t.key], scores: { ...s[t.key].scores, [c.key]: e.target.value === '' ? (undefined as unknown as number) : Number(e.target.value) } },
                          }))
                        }
                      >
                        <option value="">Band…</option>
                        {BAND_STEPS.filter((b) => b >= 1)
                          .reverse()
                          .map((b) => (
                            <option key={b} value={b}>
                              {formatBand(b)}
                            </option>
                          ))}
                      </select>
                    </div>
                    <p className="criterion-focus">{c.focus}</p>
                    <details>
                      <summary>What separates the bands</summary>
                      <ul className="levels">
                        {c.levels.map((l) => (
                          <li key={l.band}>
                            <span className="lvl">{l.band}</span> {l.text}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
            <label htmlFor={`rv-${t.key}-comment`} className="small-label">
              Comments
            </label>
            <textarea
              id={`rv-${t.key}-comment`}
              rows={3}
              value={it.comment}
              onChange={(e) => setItems((s) => ({ ...s, [t.key]: { ...s[t.key], comment: e.target.value } }))}
              placeholder="Strengths, the main thing to fix, examples from the response…"
            />
          </fieldset>
        );
      })}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="primary" busy={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
