import { BAND_TABLES, DISCLAIMER, SPEAKING_CRITERIA, WRITING_CRITERIA } from '../../shared/constants';
import { formatBand } from '../lib/format';

function Table({ title, rows }: { title: string; rows: [number, number][] }) {
  // Show bands 4–9 as raw-score ranges.
  const ranges = rows
    .map(([min, band], i) => ({ band, min, max: i === 0 ? 40 : rows[i - 1][0] - 1 }))
    .filter((r) => r.band >= 4);
  return (
    <div className="table-wrap">
      <table className="data compact">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Correct (of 40)</th>
            <th scope="col" className="num">
              Band
            </th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((r) => (
            <tr key={r.band}>
              <td className="num-left">{r.min === r.max ? r.min : `${r.min}–${r.max}`}</td>
              <td className="num">{formatBand(r.band)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Scoring() {
  return (
    <div className="stack-lg narrow prose">
      <header className="page-head">
        <p className="eyebrow">Scoring notes</p>
        <h1>How practice results are calculated</h1>
        <p className="lede">Every number on a results page is a practice estimate. This page explains where each one comes from and what it cannot tell you.</p>
      </header>

      <section>
        <h2>Listening and Reading</h2>
        <p>
          Each answer is compared with the answer key the content author entered. Comparison ignores capital letters, extra spaces, curly quotes and
          full stops, and accepts every alternative the author listed (for example “6.30” and “6:30”). Answers longer than the word limit are marked
          wrong, as in the real test. Spelling must match.
        </p>
        <p>
          The real sections have 40 questions. Practice sections usually have fewer, so the raw score is scaled to 40 and then converted with the
          approximate tables below. With fewer questions, one answer moves the band more, so expect a wider margin of error.
        </p>
        <div className="tables-3">
          <Table title="Listening" rows={BAND_TABLES.listening} />
          <Table title="Academic Reading" rows={BAND_TABLES['reading-academic']} />
          <Table title="General Training Reading" rows={BAND_TABLES['reading-general']} />
        </div>
        <p className="fine">
          These tables follow conversions that are widely published for practice. Official tables are adjusted for each test version, so the same raw
          score can give a slightly different band on test day.
        </p>
      </section>

      <section>
        <h2>Writing</h2>
        <p>IELTSLab never invents a Writing band. A band appears only after one of these reviews, and the results page always says which one:</p>
        <ul>
          <li>
            <strong>Teacher review</strong>: an administrator scores each task against the four criteria. This replaces any other review.
          </li>
          <li>
            <strong>Self-assessment</strong>: you score your own answer using the criteria descriptions and the sample answer.
          </li>
          <li>
            <strong>AI feedback</strong>: only when the server has an AI service configured. A language model scores and comments; treat it as a second
            opinion.
          </li>
        </ul>
        <p>Each task band is the average of its four criteria. Task 2 counts twice as much as Task 1.</p>
        <div className="crit-grid">
          {[...WRITING_CRITERIA[1].slice(0, 1), ...WRITING_CRITERIA[2]].map((c) => (
            <div key={c.label + c.key} className="card">
              <strong>
                {c.label} ({c.short})
              </strong>
              <p>{c.focus}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Speaking</h2>
        <p>
          Your answers are recorded in the browser. There is no automated speaking score: judging fluency and pronunciation needs a trained listener. A
          band appears after a teacher review or your own self-assessment against these criteria:
        </p>
        <div className="crit-grid">
          {SPEAKING_CRITERIA.map((c) => (
            <div key={c.key} className="card">
              <strong>
                {c.label} ({c.short})
              </strong>
              <p>{c.focus}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Overall band</h2>
        <p>
          The overall band is the average of the four skill bands, rounded to the nearest half band: an average ending in .25 rounds up to .5, and one
          ending in .75 rounds up to the next whole band. It appears only for a full test once all four skills have a band. If any part was missing
          from the content bank, the result is marked as incomplete.
        </p>
      </section>

      <section>
        <h2>Limits of a practice test</h2>
        <ul>
          <li>Content comes from your own content bank. Its difficulty may not match a real test.</li>
          <li>Synthetic voices are used when a Listening part has a script but no recording. They sound different from real speakers.</li>
          <li>Self-assessment tends to be generous. When it matters, ask a teacher to review.</li>
        </ul>
        <p className="fine">{DISCLAIMER}</p>
      </section>
    </div>
  );
}
