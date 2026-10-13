import { useEffect, useMemo, useState } from 'react';
import { partLabel, QUESTION_TYPE_LABEL, SKILL_LABEL, SPEAKING_CRITERIA, TEST_TYPE_LABEL, WRITING_CRITERIA } from '../../shared/constants';
import { computeResult, countWords } from '../../shared/scoring';
import type { Attempt, AttemptSection, QuestionResult, QuestionType, SkillResult } from '../../shared/types';
import { useApp } from '../app/AppContext';
import { Icon } from '../components/Icon';
import { BandPill, BandRuler, Button, ErrorState, Notice, SkillIcon, SOURCE_LABEL, Spinner } from '../components/ui';
import { formatBand, formatDate, formatDuration, plural } from '../lib/format';
import { Link, useRouter } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { splitParagraphs } from './runner/Passage';
import { ReviewForm } from './ReviewForm';

const TIPS: Record<QuestionType, { reading: string; listening: string }> = {
  tfng: {
    reading: 'FALSE means the passage says the opposite; NOT GIVEN means it says nothing about it. Find the matching sentence, then check qualifiers such as all/some, always/sometimes.',
    listening: 'Check each detail of the statement against what you heard.',
  },
  ynng: {
    reading: 'These ask about the writer’s opinions. Look for opinion language (I believe, in my view, it is too early to judge) rather than facts.',
    listening: 'Listen for the speaker’s attitude, not only the facts.',
  },
  mcq: {
    reading: 'Distractors often reuse words from the text. Rule out options that are only partly true or that the text does not answer.',
    listening: 'Speakers often mention every option. Wait for the final decision, and listen for words like “but”, “actually” and “instead”.',
  },
  matching: {
    reading: 'Match the main idea of a paragraph, not a single repeated word. For headings, read the first and last sentences closely.',
    listening: 'Read the option list before the audio starts and listen for paraphrases of each option.',
  },
  completion: {
    reading: 'Check the word limit and the grammar of the gap (noun, plural, number). Copy spelling exactly from the passage.',
    listening: 'Spelling and plurals count. Speakers often correct themselves, so write the final detail you hear.',
  },
};

function answerText(q: QuestionResult, value: string): string {
  if (!value) return '';
  if ((q.groupType === 'mcq' || q.groupType === 'matching') && q.options) {
    const i = value.charCodeAt(0) - 65;
    return q.options[i] ? `${value} — ${q.options[i]}` : value;
  }
  return value;
}

export function Results({ id }: { id: string }) {
  const { api, user, toast } = useApp();
  const { navigate } = useRouter();
  const load = useAsync(() => api.getAttempt(id), [api, id]);
  const [override, setOverride] = useState<Attempt | null>(null);
  const attempt = override || load.data?.attempt || null;
  const [tab, setTab] = useState<string>('overview');

  const result = useMemo(() => (attempt && attempt.status === 'submitted' ? attempt.result || computeResult(attempt) : null), [attempt]);

  if (load.loading && !attempt) return <Spinner label="Loading results…" />;
  if (load.error) return <ErrorState error={load.error} onRetry={load.reload} />;
  if (!attempt) return null;
  if (attempt.status !== 'submitted' || !result) {
    return (
      <div className="narrow stack">
        <h1>This test is still in progress</h1>
        <p>Results appear when every section has been submitted.</p>
        <Button variant="primary" icon="play" onClick={() => navigate(`/attempt/${attempt.id}`)}>
          Resume test
        </Button>
      </div>
    );
  }

  const isOwner = attempt.ownerId === user?.id;
  const isTeacher = user?.role === 'admin' && !isOwner;
  const ownerName = load.data?.ownerName;
  const skillTabs = result.skills.map((s) => s.skill);

  const updateAttempt = (a: Attempt) => {
    setOverride(a);
    toast('Review saved.', 'ok');
  };

  return (
    <div className="stack-lg">
      <header className="results-head">
        <div>
          <p className="eyebrow">
            Practice result · {TEST_TYPE_LABEL[attempt.testType]}
            {ownerName ? ` · Candidate: ${ownerName}` : ''}
          </p>
          <h1>{attempt.title}</h1>
          <p className="muted">Submitted {formatDate(attempt.submittedAt)}</p>
        </div>
        <div className="overall-card">
          <span className="overall-label">{attempt.kind === 'full' ? 'Overall band (estimate)' : `${SKILL_LABEL[result.skills[0].skill]} band (estimate)`}</span>
          <span className={`overall-num${(attempt.kind === 'full' ? result.overall : result.skills[0].band) == null ? ' pending' : ''}`}>
            {formatBand(attempt.kind === 'full' ? result.overall : result.skills[0].band)}
          </span>
          <BandRuler band={attempt.kind === 'full' ? result.overall : result.skills[0].band} target={user?.settings.targetBand} label="Band" />
          <span className="overall-note">{attempt.kind === 'full' ? result.overallNote : result.skills[0].bandSource === 'pending' ? 'Awaiting a review (see below).' : SOURCE_LABEL[result.skills[0].bandSource]}</span>
        </div>
      </header>

      <Notice tone="info" title="Not an official IELTS score">
        These are practice estimates. Listening and Reading bands use approximate conversion tables scaled to 40 questions. Writing and Speaking bands
        appear only after a review and say who gave them. <Link to="/scoring">How scoring works</Link>
      </Notice>

      {attempt.missing.length > 0 && (
        <Notice tone="warn" title="Incomplete test">
          No material was available for {attempt.missing.map((m) => `${SKILL_LABEL[m.skill]} ${partLabel(m.skill, m.part, attempt.testType)}`).join(', ')}.
        </Notice>
      )}

      <div className="tabs" role="tablist" aria-label="Result sections">
        {['overview', ...skillTabs].map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : SKILL_LABEL[t as keyof typeof SKILL_LABEL]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card-grid four">
          {result.skills.map((s) => (
            <article key={s.skill} className="card skill-result">
              <div className="skill-card-head">
                <span className="skill-badge">
                  <SkillIcon skill={s.skill} size={20} />
                </span>
                <h2 className="h3">{SKILL_LABEL[s.skill]}</h2>
              </div>
              <BandPill band={s.band} source={s.bandSource} size="lg" />
              <SkillSummary s={s} section={attempt.sections.find((x) => x.skill === s.skill)!} />
              <Button size="sm" onClick={() => setTab(s.skill)} icon="right">
                {s.skill === 'writing' || s.skill === 'speaking' ? (s.band == null ? 'Review now' : 'See review') : 'Review answers'}
              </Button>
            </article>
          ))}
        </div>
      )}

      {result.skills.map((s) =>
        tab !== s.skill ? null : s.skill === 'listening' || s.skill === 'reading' ? (
          <ObjectiveReview key={s.skill} attempt={attempt} s={s} />
        ) : s.skill === 'writing' ? (
          <WritingReview key={s.skill} attempt={attempt} s={s} isOwner={isOwner} isTeacher={isTeacher} onUpdated={updateAttempt} />
        ) : (
          <SpeakingReview key={s.skill} attempt={attempt} s={s} isOwner={isOwner} isTeacher={isTeacher} onUpdated={updateAttempt} />
        ),
      )}

      <div className="row-gap">
        <Button variant="primary" icon="play" onClick={() => navigate('/practice')}>
          Take another test
        </Button>
        <Button onClick={() => navigate('/history')}>All attempts</Button>
      </div>
    </div>
  );
}

function SkillSummary({ s, section }: { s: SkillResult; section: AttemptSection }) {
  if (s.total !== undefined) {
    const missed = (s.questions || []).filter((q) => !q.answered).length;
    return (
      <dl className="mini-facts">
        <div>
          <dt>Correct</dt>
          <dd>
            {s.raw} / {s.total}
          </dd>
        </div>
        <div>
          <dt>Unanswered</dt>
          <dd>{missed}</dd>
        </div>
        <div>
          <dt>Scaled</dt>
          <dd>{s.scaled} / 40</dd>
        </div>
      </dl>
    );
  }
  if (s.writing) {
    return (
      <dl className="mini-facts">
        {s.writing.map((w) => (
          <div key={w.materialId}>
            <dt>Task {w.part}</dt>
            <dd className={w.words < w.minWords ? 'bad' : ''}>{w.words} words</dd>
          </div>
        ))}
      </dl>
    );
  }
  const rec = (s.speaking || []).filter((x) => x.recorded);
  return (
    <dl className="mini-facts">
      <div>
        <dt>Recorded</dt>
        <dd>
          {rec.length} / {(s.speaking || []).length}
        </dd>
      </div>
      <div>
        <dt>Speaking time</dt>
        <dd>{formatDuration(rec.reduce((t, x) => t + x.durationSec, 0))}</dd>
      </div>
      {section.autoSubmitted && (
        <div>
          <dt>Note</dt>
          <dd>Auto-submitted</dd>
        </div>
      )}
    </dl>
  );
}

function ObjectiveReview({ attempt, s }: { attempt: Attempt; s: SkillResult }) {
  const [filter, setFilter] = useState<'all' | 'wrong' | 'unanswered'>('all');
  const section = attempt.sections.find((x) => x.skill === s.skill)!;
  const qs = s.questions || [];
  const shown = qs.filter((q) => (filter === 'all' ? true : filter === 'wrong' ? !q.correct : !q.answered));
  const byType = new Map<QuestionType, { right: number; total: number }>();
  for (const q of qs) {
    const t = byType.get(q.groupType) || { right: 0, total: 0 };
    t.total++;
    if (q.correct) t.right++;
    byType.set(q.groupType, t);
  }
  const weakest = [...byType.entries()].filter(([, v]) => v.total >= 2).sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0];
  const skillKey = s.skill as 'reading' | 'listening';

  return (
    <section className="stack" aria-label={`${SKILL_LABEL[s.skill]} review`}>
      <div className="review-summary">
        <div className="card">
          <h2 className="h3">By part</h2>
          <ul className="bars">
            {section.materials.map((m) => {
              const mine = qs.filter((q) => q.materialId === m.id);
              const right = mine.filter((q) => q.correct).length;
              return (
                <li key={m.id}>
                  <span>{partLabel(s.skill, m.part, attempt.testType)}</span>
                  <span className="bar">
                    <span style={{ width: `${mine.length ? (right / mine.length) * 100 : 0}%` }} />
                  </span>
                  <span className="num">
                    {right}/{mine.length}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card">
          <h2 className="h3">By question type</h2>
          <ul className="bars">
            {[...byType.entries()].map(([t, v]) => (
              <li key={t}>
                <span>{QUESTION_TYPE_LABEL[t]}</span>
                <span className="bar">
                  <span style={{ width: `${(v.right / v.total) * 100}%` }} />
                </span>
                <span className="num">
                  {v.right}/{v.total}
                </span>
              </li>
            ))}
          </ul>
          {weakest && weakest[1].right < weakest[1].total && (
            <p className="tip">
              <strong>Focus next on {QUESTION_TYPE_LABEL[weakest[0]]}.</strong> {TIPS[weakest[0]][skillKey]}
            </p>
          )}
        </div>
      </div>

      <div className="filter-row" role="group" aria-label="Filter questions">
        {(
          [
            ['all', `All (${qs.length})`],
            ['wrong', `Incorrect (${qs.filter((q) => !q.correct).length})`],
            ['unanswered', `Unanswered (${qs.filter((q) => !q.answered).length})`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={`chip-btn${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      {section.materials.map((m) => {
        const list = shown.filter((q) => q.materialId === m.id);
        return (
          <div key={m.id} className="card review-block">
            <div className="section-head">
              <h3>
                {partLabel(s.skill, m.part, attempt.testType)}: {m.title}
              </h3>
            </div>
            {s.skill === 'reading' && m.passage && (
              <details className="source-details">
                <summary>Show passage</summary>
                <div className="passage compact">
                  {splitParagraphs(m.passage).map((p, i) => (
                    <p key={i} className={p.label ? 'labelled' : undefined}>
                      {p.label && <span className="para-label">{p.label}</span>}
                      <span>{p.text}</span>
                    </p>
                  ))}
                </div>
              </details>
            )}
            {s.skill === 'listening' && (m.transcript || m.audioScript) && (
              <details className="source-details">
                <summary>Show transcript</summary>
                <pre className="transcript">{m.transcript || m.audioScript}</pre>
              </details>
            )}
            {list.length === 0 ? (
              <p className="muted">No questions match this filter.</p>
            ) : (
              <ol className="answer-list">
                {list.map((q) => (
                  <li key={q.questionId} className={`answer ${q.correct ? 'right' : q.answered ? 'wrong' : 'missed'}`}>
                    <span className="answer-num">{q.number}</span>
                    <div className="answer-body">
                      <p className="answer-prompt">{q.prompt.replace(/_{3,}/g, '_____')}</p>
                      <div className="answer-grid">
                        <span className="k">Your answer</span>
                        <span className="v">{q.answered ? answerText(q, q.given) : <em>Not answered</em>}</span>
                        <span className="k">Correct</span>
                        <span className="v">
                          {q.correctAnswers.map((a) => answerText(q, a)).join(' / ')}
                        </span>
                      </div>
                      {q.note && <p className="answer-note">{q.note}</p>}
                      {q.explanation && (
                        <p className="answer-expl">
                          <Icon name="info" size={14} /> {q.explanation}
                        </p>
                      )}
                    </div>
                    <span className="answer-status">
                      <Icon name={q.correct ? 'check' : 'x'} size={16} />
                      <span className="sr-only">{q.correct ? 'Correct' : q.answered ? 'Incorrect' : 'Not answered'}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </section>
  );
}

function ReviewSummary({ attempt, skill }: { attempt: Attempt; skill: 'writing' | 'speaking' }) {
  const r = attempt.reviews[skill];
  if (!r) return null;
  const section = attempt.sections.find((s) => s.skill === skill)!;
  const keys = skill === 'writing' ? section.materials.map((m) => m.id) : ['speaking'];
  return (
    <div className="card review-result">
      <p className="eyebrow">
        {SOURCE_LABEL[r.source]} · {r.reviewer} · {formatDate(r.at)}
      </p>
      {r.source === 'ai' && <p className="muted">Automated feedback from a language model. It can be wrong; treat it as a second opinion, not a mark.</p>}
      {keys.map((k) => {
        const it = r.items[k];
        if (!it) return null;
        const m = section.materials.find((x) => x.id === k);
        const crit = skill === 'speaking' ? SPEAKING_CRITERIA : WRITING_CRITERIA[m?.part === 1 ? 1 : 2];
        return (
          <div key={k} className="review-item">
            {m && skill === 'writing' && <h4>Task {m.part}</h4>}
            <dl className="crit-scores">
              {crit.map((c) => (
                <div key={c.key}>
                  <dt title={c.label}>{c.short}</dt>
                  <dd>{formatBand(it.scores[c.key])}</dd>
                </div>
              ))}
            </dl>
            {it.comment && <p className="review-comment">{it.comment}</p>}
          </div>
        );
      })}
    </div>
  );
}

function WritingReview({ attempt, s, isOwner, isTeacher, onUpdated }: { attempt: Attempt; s: SkillResult; isOwner: boolean; isTeacher: boolean; onUpdated: (a: Attempt) => void }) {
  const { api, toast } = useApp();
  const [aiBusy, setAiBusy] = useState(false);
  const section = attempt.sections.find((x) => x.skill === 'writing')!;
  const review = attempt.reviews.writing;
  const teacherLocked = review?.source === 'teacher';
  const targets = section.materials.map((m) => ({ key: m.id, title: `Task ${m.part}: ${m.title}`, criteria: WRITING_CRITERIA[m.part === 1 ? 1 : 2] }));

  return (
    <section className="stack" aria-label="Writing review">
      {section.materials.map((m) => {
        const text = section.writing[m.id] || '';
        const stat = s.writing?.find((w) => w.materialId === m.id);
        const words = countWords(text);
        return (
          <article key={m.id} className="card stack">
            <div className="section-head">
              <h3>
                Task {m.part}: {m.title}
              </h3>
              {s.detail?.[m.id] !== undefined && <BandPill band={s.detail[m.id]} source={review?.source} />}
            </div>
            <details className="source-details">
              <summary>Show the task</summary>
              <div className="task-box">
                {(m.prompt || '').split(/\n\s*\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {m.bullets?.length ? (
                  <ul>
                    {m.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {m.imageAlt && <p className="muted">Visual: {m.imageAlt}</p>}
            </details>
            <dl className="mini-facts">
              <div>
                <dt>Words</dt>
                <dd className={words < (stat?.minWords || 0) ? 'bad' : ''}>
                  {words} / {stat?.minWords}
                </dd>
              </div>
              <div>
                <dt>Paragraphs</dt>
                <dd>{stat?.paragraphs ?? 0}</dd>
              </div>
            </dl>
            {stat && words < stat.minWords && (
              <Notice tone="warn">
                This answer is {plural(stat.minWords - words, 'word')} under the minimum. Short answers lose marks for {m.part === 1 ? 'Task Achievement' : 'Task Response'}.
              </Notice>
            )}
            <div className="essay-view">{text.trim() ? text : <em className="muted">No answer written.</em>}</div>
            {m.modelAnswer && (
              <details className="source-details">
                <summary>Sample answer (one possible approach)</summary>
                <div className="essay-view sample">{m.modelAnswer}</div>
              </details>
            )}
            {m.scoringGuidance && (
              <details className="source-details">
                <summary>What markers look for in this task</summary>
                <p>{m.scoringGuidance}</p>
              </details>
            )}
          </article>
        );
      })}

      <ReviewSummary attempt={attempt} skill="writing" />

      {api.health.ai && isOwner && !teacherLocked && (
        <div className="card ai-card">
          <div>
            <strong>AI feedback (unofficial)</strong>
            <p className="muted">A language model scores each task against the four criteria and explains why. It can be wrong; a teacher review always replaces it.</p>
          </div>
          <Button
            icon="chat"
            busy={aiBusy}
            onClick={async () => {
              setAiBusy(true);
              try {
                onUpdated(await api.aiReview(attempt.id));
              } catch (e) {
                toast(e instanceof Error ? e.message : 'AI feedback failed.', 'error');
              } finally {
                setAiBusy(false);
              }
            }}
          >
            {review?.source === 'ai' ? 'Ask again' : 'Get AI feedback'}
          </Button>
        </div>
      )}

      {isTeacher && (
        <div className="card">
          <h3>Teacher review</h3>
          <ReviewForm
            targets={targets}
            initial={review?.items}
            submitLabel="Save teacher review"
            intro="Your review replaces any self-assessment or AI feedback and is shown to the candidate as a teacher review."
            onSubmit={async (items) => onUpdated(await api.saveReview(attempt.id, 'writing', items, true))}
          />
        </div>
      )}
      {isOwner && !teacherLocked && !isTeacher && (
        <div className="card">
          <h3>{review?.source === 'self' ? 'Update your self-assessment' : 'Assess your own writing'}</h3>
          <ReviewForm
            targets={targets}
            initial={review?.source === 'self' ? review.items : undefined}
            submitLabel="Save self-assessment"
            intro="No examiner has marked this. Compare your answer with the criteria and the sample answer, and be strict: most candidates over-estimate by half a band or more. Your bands will be labelled as self-assessed."
            onSubmit={async (items) => onUpdated(await api.saveReview(attempt.id, 'writing', items))}
          />
        </div>
      )}
    </section>
  );
}

function SpeakingReview({ attempt, s, isOwner, isTeacher, onUpdated }: { attempt: Attempt; s: SkillResult; isOwner: boolean; isTeacher: boolean; onUpdated: (a: Attempt) => void }) {
  const { api } = useApp();
  const section = attempt.sections.find((x) => x.skill === 'speaking')!;
  const review = attempt.reviews.speaking;
  const teacherLocked = review?.source === 'teacher';
  const targets = [{ key: 'speaking', title: 'Speaking performance', criteria: SPEAKING_CRITERIA }];
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    for (const [key, rec] of Object.entries(section.recordings)) {
      api.fileUrl(rec.id).then((u) => setUrls((m) => ({ ...m, [key]: u })), () => undefined);
    }
  }, [api, section.recordings]);

  return (
    <section className="stack" aria-label="Speaking review">
      <div className="card">
        <h3>Your answers</h3>
        <ol className="speak-list">
          {(s.speaking || []).map((sp) => {
            const rec = section.recordings[sp.key];
            return (
              <li key={sp.key}>
                <p>
                  <span className="chip">Part {sp.part}</span> {sp.prompt}
                </p>
                {rec ? (
                  urls[sp.key] ? (
                    <audio controls preload="none" src={urls[sp.key]} aria-label={`Recording: ${sp.prompt}`} />
                  ) : (
                    <span className="muted">Loading recording…</span>
                  )
                ) : (
                  <span className="muted">Not recorded</span>
                )}
                {rec && <span className="muted"> {formatDuration(rec.durationSec)}</span>}
              </li>
            );
          })}
        </ol>
        <p className="fine">
          Recordings are private to your account{api.mode === 'local' ? ' and stored only in this browser' : ' (administrators can listen when reviewing)'}.
          No automated speaking score is given: speech assessment needs a human listener.
        </p>
      </div>

      <ReviewSummary attempt={attempt} skill="speaking" />

      {isTeacher && (
        <div className="card">
          <h3>Teacher review</h3>
          <ReviewForm
            targets={targets}
            initial={review?.items}
            submitLabel="Save teacher review"
            onSubmit={async (items) => onUpdated(await api.saveReview(attempt.id, 'speaking', items, true))}
          />
        </div>
      )}
      {isOwner && !teacherLocked && !isTeacher && (
        <div className="card">
          <h3>{review?.source === 'self' ? 'Update your self-assessment' : 'Assess your own speaking'}</h3>
          <ReviewForm
            targets={targets}
            initial={review?.source === 'self' ? review.items : undefined}
            submitLabel="Save self-assessment"
            intro="Listen to each recording before you choose bands. Pay attention to long pauses, repeated words and whether you answered the question fully."
            onSubmit={async (items) => onUpdated(await api.saveReview(attempt.id, 'speaking', items))}
          />
        </div>
      )}
    </section>
  );
}

