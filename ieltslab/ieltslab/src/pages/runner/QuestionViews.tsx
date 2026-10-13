import { Fragment } from 'react';
import { TFNG_OPTIONS, YNNG_OPTIONS } from '../../../shared/constants';
import { countWords, optionLetter, type NumberedQuestion } from '../../../shared/scoring';
import type { QuestionGroup } from '../../../shared/types';
import { Icon } from '../../components/Icon';

interface Props {
  group: QuestionGroup;
  entries: NumberedQuestion[];
  answers: Record<string, string>;
  flags: string[];
  currentId?: string;
  onAnswer: (qid: string, value: string) => void;
  onFlag: (qid: string) => void;
  onFocusQuestion: (qid: string) => void;
}

export function QuestionGroupView({ group, entries, answers, flags, currentId, onAnswer, onFlag, onFocusQuestion }: Props) {
  if (!entries.length) return null;
  const first = entries[0].number;
  const last = entries[entries.length - 1].number;
  return (
    <section className="qgroup" aria-labelledby={`${group.id}-h`}>
      <h3 id={`${group.id}-h`} className="qgroup-title">
        {first === last ? `Question ${first}` : `Questions ${first}–${last}`}
      </h3>
      <p className="qgroup-instr">{group.instructions}</p>
      {group.type === 'matching' && group.options && (
        <div className="match-list" aria-label="Options">
          {group.options.map((o, i) => (
            <div key={i} className="match-opt">
              <span className="letter">{optionLetter(i)}</span>
              <span>{o}</span>
            </div>
          ))}
        </div>
      )}
      <div className="qlist">
        {entries.map((e) => (
          <QuestionItem
            key={e.question.id}
            entry={e}
            group={group}
            value={answers[e.question.id] || ''}
            flagged={flags.includes(e.question.id)}
            current={currentId === e.question.id}
            onAnswer={onAnswer}
            onFlag={onFlag}
            onFocus={() => onFocusQuestion(e.question.id)}
          />
        ))}
      </div>
    </section>
  );
}

function FlagButton({ flagged, number, onClick }: { flagged: boolean; number: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`flag-btn${flagged ? ' on' : ''}`}
      aria-pressed={flagged}
      aria-label={`Flag question ${number} for review`}
      title={flagged ? 'Remove flag' : 'Flag for review'}
      onClick={onClick}
    >
      <Icon name="flag" size={16} />
    </button>
  );
}

function QuestionItem({
  entry,
  group,
  value,
  flagged,
  current,
  onAnswer,
  onFlag,
  onFocus,
}: {
  entry: NumberedQuestion;
  group: QuestionGroup;
  value: string;
  flagged: boolean;
  current: boolean;
  onAnswer: (qid: string, v: string) => void;
  onFlag: (qid: string) => void;
  onFocus: () => void;
}) {
  const { question: q, number } = entry;
  const name = `ans-${q.id}`;
  const cls = `q${current ? ' is-current' : ''}${value.trim() ? ' is-answered' : ''}`;

  if (group.type === 'completion') {
    const parts = q.prompt.split(/_{3,}/);
    const words = countWords(value);
    const over = !!group.maxWords && words > group.maxWords;
    const input = (
      <input
        id={`in-${q.id}`}
        className={`gap-input${over ? ' over' : ''}`}
        type="text"
        value={value}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={80}
        aria-label={`Answer to question ${number}`}
        aria-describedby={over ? `over-${q.id}` : undefined}
        onChange={(e) => onAnswer(q.id, e.target.value)}
      />
    );
    return (
      <div className={cls} id={`q-${q.id}`} onFocusCapture={onFocus}>
        <span className="q-num" aria-hidden="true">
          {number}
        </span>
        <div className="q-main">
          <p className="q-prompt">
            {parts.length > 1
              ? parts.map((p, i) => (
                  <Fragment key={i}>
                    {p}
                    {i < parts.length - 1 && input}
                  </Fragment>
                ))
              : (
                  <>
                    {q.prompt} {input}
                  </>
                )}
          </p>
          {over && (
            <p className="q-warn" id={`over-${q.id}`}>
              {words} words: the limit is {group.maxWords}.
            </p>
          )}
        </div>
        <FlagButton flagged={flagged} number={number} onClick={() => onFlag(q.id)} />
      </div>
    );
  }

  if (group.type === 'matching') {
    return (
      <div className={cls} id={`q-${q.id}`} onFocusCapture={onFocus}>
        <span className="q-num" aria-hidden="true">
          {number}
        </span>
        <div className="q-main q-inline">
          <label htmlFor={`in-${q.id}`} className="q-prompt">
            {q.prompt}
          </label>
          <select id={`in-${q.id}`} className="match-select" value={value} onChange={(e) => onAnswer(q.id, e.target.value)} aria-label={`Answer to question ${number}`}>
            <option value="">Choose…</option>
            {(group.options || []).map((o, i) => (
              <option key={i} value={optionLetter(i)}>
                {optionLetter(i)} — {o.length > 60 ? o.slice(0, 57) + '…' : o}
              </option>
            ))}
          </select>
        </div>
        <FlagButton flagged={flagged} number={number} onClick={() => onFlag(q.id)} />
      </div>
    );
  }

  const opts: { value: string; label: string }[] =
    group.type === 'mcq'
      ? (q.options || []).map((o, i) => ({ value: optionLetter(i), label: o }))
      : (group.type === 'tfng' ? TFNG_OPTIONS : YNNG_OPTIONS).map((o) => ({ value: o, label: o }));
  const pills = group.type !== 'mcq';
  return (
    <div className={cls} id={`q-${q.id}`} onFocusCapture={onFocus}>
      <span className="q-num" aria-hidden="true">
        {number}
      </span>
      <fieldset className="q-main">
        <legend className="q-prompt">
          <span className="sr-only">Question {number}. </span>
          {q.prompt}
        </legend>
        <div className={pills ? 'pill-options' : 'mcq-options'}>
          {opts.map((o) => (
            <label key={o.value} className={`opt${value === o.value ? ' selected' : ''}`}>
              <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onAnswer(q.id, o.value)} />
              {!pills && <span className="letter">{o.value}</span>}
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        {value && (
          <button type="button" className="link-btn clear-btn" onClick={() => onAnswer(q.id, '')}>
            Clear answer
          </button>
        )}
      </fieldset>
      <FlagButton flagged={flagged} number={number} onClick={() => onFlag(q.id)} />
    </div>
  );
}
