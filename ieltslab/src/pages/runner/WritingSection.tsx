import { useEffect, useState } from 'react';
import { countParagraphs, countWords } from '../../../shared/scoring';
import type { Attempt, Material } from '../../../shared/types';
import { useApp } from '../../app/AppContext';
import { Button } from '../../components/ui';
import type { SectionState } from './useSectionState';

function TaskPrompt({ material }: { material: Material }) {
  const { api } = useApp();
  const [img, setImg] = useState<string | null>(material.imageUrl || null);
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    if (material.imageAssetId) api.fileUrl(material.imageAssetId).then(setImg, () => setImgError(true));
  }, [api, material.imageAssetId]);
  return (
    <div className="task-prompt">
      <p className="eyebrow">Writing Task {material.part}</p>
      <p className="task-time">{material.instructions}</p>
      <div className="task-box">
        {(material.prompt || '').split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {material.bullets && material.bullets.length > 0 && (
          <ul>
            {material.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </div>
      {(img || material.imageAssetId) && (
        <figure className="task-figure">
          {img && !imgError ? (
            <img src={img} alt={material.imageAlt || 'Task visual'} onError={() => setImgError(true)} />
          ) : imgError ? (
            <div className="img-missing">The image for this task could not be loaded. Description: {material.imageAlt}</div>
          ) : null}
        </figure>
      )}
      <p className="muted">Write at least {material.minWords || (material.part === 1 ? 150 : 250)} words.</p>
    </div>
  );
}

export function WritingSection({ st, onSubmit, submitting }: { attempt: Attempt; st: SectionState; onSubmit: () => void; submitting: boolean }) {
  const materials = st.section.materials;
  const [active, setActive] = useState(materials[0]?.id);
  const m = materials.find((x) => x.id === active) || materials[0];
  const [pane, setPane] = useState<'task' | 'answer'>('answer');
  if (!m) return null;
  const text = st.writing[m.id] || '';
  const words = countWords(text);
  const min = m.minWords || (m.part === 1 ? 150 : 250);
  const pct = Math.min(100, (words / min) * 100);

  return (
    <>
      <div className="part-bar wrap-wide">
        <div className="part-tabs" role="tablist" aria-label="Tasks">
          {materials.map((x) => {
            const w = countWords(st.writing[x.id] || '');
            return (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === m.id} className={`part-tab${x.id === m.id ? ' active' : ''}`} onClick={() => setActive(x.id)}>
                Task {x.part} <span className="tab-count">{w} words</span>
              </button>
            );
          })}
        </div>
        <div className="pane-switch" role="group" aria-label="Show">
          <button type="button" aria-pressed={pane === 'task'} onClick={() => setPane('task')}>
            Task
          </button>
          <button type="button" aria-pressed={pane === 'answer'} onClick={() => setPane('answer')}>
            Answer
          </button>
        </div>
      </div>
      <div className={`runner-body split show-${pane === 'task' ? 'source' : 'questions'}`}>
        <section className="pane pane-source" aria-label={`Task ${m.part} instructions`}>
          <TaskPrompt material={m} />
        </section>
        <section className="pane pane-questions editor-pane" aria-label={`Task ${m.part} answer`}>
          <label htmlFor={`essay-${m.id}`} className="sr-only">
            Your answer to Task {m.part}
          </label>
          <textarea
            id={`essay-${m.id}`}
            key={m.id}
            className="essay"
            value={text}
            onChange={(e) => st.setWriting(m.id, e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            placeholder={m.part === 1 ? 'Start your Task 1 answer here…' : 'Start your Task 2 essay here…'}
            aria-describedby={`wc-${m.id}`}
          />
          <div className="editor-foot" id={`wc-${m.id}`}>
            <div className="wc">
              <strong className={words >= min ? 'ok' : ''}>{words}</strong> words
              <span className="muted"> · minimum {min} · {countParagraphs(text)} paragraphs</span>
              <span className="wc-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} className={words >= min ? 'ok' : ''} />
              </span>
            </div>
            <div className="row-gap-sm">
              <Button size="sm" onClick={() => void st.flush()}>
                Save now
              </Button>
              {m.id !== materials[materials.length - 1].id ? (
                <Button size="sm" icon="right" onClick={() => setActive(materials[materials.indexOf(m) + 1].id)}>
                  Next task
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={onSubmit} busy={submitting}>
                  Submit Writing
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
