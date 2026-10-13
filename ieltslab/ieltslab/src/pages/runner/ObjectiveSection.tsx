import { useEffect, useMemo, useState } from 'react';
import { partLabel } from '../../../shared/constants';
import { numberQuestions } from '../../../shared/scoring';
import type { Attempt } from '../../../shared/types';
import { Icon } from '../../components/Icon';
import { Button, Modal } from '../../components/ui';
import { plural } from '../../lib/format';
import { AudioBank } from './AudioPlayer';
import { Passage } from './Passage';
import { QuestionGroupView } from './QuestionViews';
import type { SectionState } from './useSectionState';

export function ObjectiveSection({ attempt, st, onSubmit, submitting }: { attempt: Attempt; st: SectionState; onSubmit: () => void; submitting: boolean }) {
  const section = st.section;
  const numbered = useMemo(() => numberQuestions(section), [section]);
  const [current, setCurrent] = useState(0);
  const [focusReq, setFocusReq] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'source' | 'questions'>('questions');
  const isReading = section.skill === 'reading';

  const cur = numbered[current];
  const materialIdx = cur ? section.materials.findIndex((m) => m.id === cur.material.id) : 0;
  const material = section.materials[materialIdx] || section.materials[0];

  const answered = (qid: string) => !!(st.answers[qid] || '').trim();
  const answeredCount = numbered.filter((n) => answered(n.question.id)).length;

  // Move focus to the chosen question when navigating with the buttons.
  useEffect(() => {
    if (!focusReq || !cur) return;
    const el = document.getElementById(`q-${cur.question.id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const input = el.querySelector<HTMLElement>('input, select, textarea');
    input?.focus({ preventScroll: true });
  }, [focusReq]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => {
    if (i < 0 || i >= numbered.length) return;
    setCurrent(i);
    setFocusReq((n) => n + 1);
    setMobilePane('questions');
  };

  const firstOfMaterial = (mid: string) => numbered.findIndex((n) => n.material.id === mid);

  if (numbered.length === 0) {
    return (
      <div className="wrap runner-empty">
        <p>This section has no questions.</p>
        <Button variant="primary" onClick={onSubmit} busy={submitting}>
          Submit section
        </Button>
      </div>
    );
  }

  const groupsHere = material.groups;

  return (
    <>
      <div className="part-bar wrap-wide">
        <div className="part-tabs" role="tablist" aria-label="Parts">
          {section.materials.map((m) => (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={m.id === material.id}
              className={`part-tab${m.id === material.id ? ' active' : ''}`}
              onClick={() => go(firstOfMaterial(m.id))}
            >
              {partLabel(section.skill, m.part, attempt.testType)}
            </button>
          ))}
        </div>
        {isReading && (
          <div className="pane-switch" role="group" aria-label="Show">
            <button type="button" aria-pressed={mobilePane === 'source'} onClick={() => setMobilePane('source')}>
              Passage
            </button>
            <button type="button" aria-pressed={mobilePane === 'questions'} onClick={() => setMobilePane('questions')}>
              Questions
            </button>
          </div>
        )}
      </div>

      <div className={`runner-body ${isReading ? 'split' : 'single'} show-${mobilePane}`}>
        {isReading ? (
          <section className="pane pane-source" aria-label={`Reading passage: ${material.title}`}>
            <Passage attemptId={attempt.id} material={material} label={partLabel('reading', material.part, attempt.testType)} />
          </section>
        ) : null}
        <section className="pane pane-questions" aria-label="Questions">
          {!isReading && (
            <AudioBank attempt={attempt} st={st} currentMaterialId={material.id} />
          )}
          <div className="part-intro">
            <h2>{partLabel(section.skill, material.part, attempt.testType)}</h2>
            {material.instructions && <p>{material.instructions}</p>}
          </div>
          {groupsHere.map((g) => (
            <QuestionGroupView
              key={g.id}
              group={g}
              entries={numbered.filter((n) => n.group.id === g.id)}
              answers={st.answers}
              flags={st.flags}
              currentId={cur?.question.id}
              onAnswer={st.setAnswer}
              onFlag={st.toggleFlag}
              onFocusQuestion={(qid) => {
                const i = numbered.findIndex((n) => n.question.id === qid);
                if (i >= 0 && i !== current) setCurrent(i);
              }}
            />
          ))}
          <div className="end-of-part">
            {materialIdx < section.materials.length - 1 ? (
              <Button icon="right" onClick={() => go(firstOfMaterial(section.materials[materialIdx + 1].id))}>
                Go to {partLabel(section.skill, section.materials[materialIdx + 1].part, attempt.testType)}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setReviewOpen(true)}>
                Review answers
              </Button>
            )}
          </div>
        </section>
      </div>

      <nav className="qnav" aria-label="Question navigation">
        <div className="qnav-inner">
          <button type="button" className="icon-btn qnav-arrow" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous question">
            <Icon name="left" />
          </button>
          <div className="qnav-parts">
            {section.materials.map((m) => {
              const items = numbered.map((n, i) => ({ n, i })).filter(({ n }) => n.material.id === m.id);
              const done = items.filter(({ n }) => answered(n.question.id)).length;
              return (
                <div key={m.id} className={`qnav-part${m.id === material.id ? ' current' : ''}`}>
                  <span className="qnav-label">
                    {partLabel(section.skill, m.part, attempt.testType)} <span className="muted">{done}/{items.length}</span>
                  </span>
                  <div className="qnav-nums">
                    {items.map(({ n, i }) => {
                      const a = answered(n.question.id);
                      const f = st.flags.includes(n.question.id);
                      return (
                        <button
                          key={n.question.id}
                          type="button"
                          className={`qnum${a ? ' answered' : ''}${f ? ' flagged' : ''}${i === current ? ' current' : ''}`}
                          onClick={() => go(i)}
                          aria-label={`Question ${n.number}${a ? ', answered' : ', not answered'}${f ? ', flagged' : ''}`}
                          aria-current={i === current ? 'true' : undefined}
                        >
                          {n.number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className="icon-btn qnav-arrow" onClick={() => go(current + 1)} disabled={current === numbered.length - 1} aria-label="Next question">
            <Icon name="right" />
          </button>
          <div className="qnav-actions">
            <span className="qnav-count">
              {answeredCount}/{numbered.length} answered
            </span>
            <Button size="sm" icon="list" onClick={() => setReviewOpen(true)}>
              Review
            </Button>
            <Button size="sm" variant="primary" onClick={onSubmit} busy={submitting}>
              Submit
            </Button>
          </div>
        </div>
      </nav>

      <Modal
        open={reviewOpen}
        title="Review your answers"
        onClose={() => setReviewOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setReviewOpen(false)}>Keep working</Button>
            <Button
              variant="primary"
              onClick={() => {
                setReviewOpen(false);
                onSubmit();
              }}
            >
              Submit section
            </Button>
          </>
        }
      >
        <p>
          {answeredCount} of {numbered.length} answered · {plural(numbered.length - answeredCount, 'unanswered question')} · {plural(st.flags.filter((f) => numbered.some((n) => n.question.id === f)).length, 'flagged question')}
        </p>
        <div className="review-legend" aria-hidden="true">
          <span>
            <span className="qnum answered sample">1</span> Answered
          </span>
          <span>
            <span className="qnum sample">2</span> Not answered
          </span>
          <span>
            <span className="qnum flagged sample">3</span> Flagged
          </span>
        </div>
        {section.materials.map((m) => (
          <div key={m.id} className="review-part">
            <h3>{partLabel(section.skill, m.part, attempt.testType)}</h3>
            <div className="qnav-nums wrap-nums">
              {numbered.map((n, i) =>
                n.material.id !== m.id ? null : (
                  <button
                    key={n.question.id}
                    type="button"
                    className={`qnum${answered(n.question.id) ? ' answered' : ''}${st.flags.includes(n.question.id) ? ' flagged' : ''}`}
                    onClick={() => {
                      setReviewOpen(false);
                      go(i);
                    }}
                    aria-label={`Go to question ${n.number}${answered(n.question.id) ? ', answered' : ', not answered'}${st.flags.includes(n.question.id) ? ', flagged' : ''}`}
                  >
                    {n.number}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </Modal>
    </>
  );
}
