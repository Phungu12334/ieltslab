import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMO_MATERIALS } from '../shared/demoContent';
import {
  applyProgress,
  applyReview,
  assemble,
  computeAvailability,
  createAttempt,
  endTest,
  redactAttempt,
  setRecording,
  submitSection,
} from '../shared/engine';
import { checkAnswer, countWords, normalizeAnswer, rawToBand, roundBand } from '../shared/scoring';
import { validateImport, validateMaterial } from '../shared/validate';

test('every demo material passes validation', () => {
  for (const m of DEMO_MATERIALS) {
    const r = validateMaterial(m, m);
    assert.equal(r.ok, true, `${m.id}: ${JSON.stringify(r.errors)}`);
  }
});

test('demo content covers every part for both test types', () => {
  const av = computeAvailability(DEMO_MATERIALS);
  for (const [skill, byType] of Object.entries(av)) {
    for (const [type, parts] of Object.entries(byType)) {
      for (const [part, n] of Object.entries(parts)) assert.ok(n > 0, `${skill}/${type}/part ${part} has no material`);
    }
  }
});

test('assembly is deterministic for a seed, respects test type, and never repeats material', () => {
  const opts = { skills: ['listening', 'reading', 'writing', 'speaking'] as const, testType: 'general' as const, seed: 'abc' };
  const a = assemble(DEMO_MATERIALS, { ...opts, skills: [...opts.skills] });
  const b = assemble(DEMO_MATERIALS, { ...opts, skills: [...opts.skills] });
  assert.deepEqual(a.sections.map((s) => s.materials.map((m) => m.id)), b.sections.map((s) => s.materials.map((m) => m.id)));
  assert.equal(a.missing.length, 0);
  const ids = a.sections.flatMap((s) => s.materials.map((m) => m.id));
  assert.equal(new Set(ids).size, ids.length);
  const reading = a.sections.find((s) => s.skill === 'reading')!;
  assert.ok(reading.materials.every((m) => m.testType !== 'academic'));
  assert.deepEqual(reading.materials.map((m) => m.part), [1, 2, 3]);
});

test('assembly prefers unseen material and links Speaking Part 3 to the Part 2 topic', () => {
  for (let i = 0; i < 20; i++) {
    const r = assemble(DEMO_MATERIALS, { skills: ['listening', 'speaking'], testType: 'academic', seed: `s${i}`, recentlyUsed: ['demo-l1-sports'] });
    assert.equal(r.sections[0].materials[0].id, 'demo-l1-college');
    const sp = r.sections[1].materials;
    const topic = sp.find((m) => m.part === 2)!.tags.find((t) => t.startsWith('topic:'));
    assert.ok(sp.find((m) => m.part === 3)!.tags.includes(topic!));
  }
});

test('missing parts are reported', () => {
  const only = DEMO_MATERIALS.filter((m) => !(m.skill === 'reading' && m.part === 3));
  const r = assemble(only, { skills: ['reading'], testType: 'academic', seed: 'x' });
  assert.deepEqual(r.missing, [{ skill: 'reading', part: 3 }]);
});

test('answer normalisation and word limits', () => {
  assert.equal(normalizeAnswer('  Sturdy   Shoes. '), 'sturdy shoes');
  assert.equal(normalizeAnswer('1,000'), '1000');
  const group = { id: 'g', type: 'completion' as const, instructions: '', maxWords: 2, questions: [] };
  const question = { id: 'q', prompt: '', answers: ['rainwater collection'] };
  assert.equal(checkAnswer(group, question, 'Rainwater Collection').correct, true);
  assert.equal(checkAnswer(group, question, 'the rainwater collection').correct, false);
  assert.equal(countWords("It's a well-known fact, isn't it?"), 6);
});

test('band conversion and rounding', () => {
  assert.equal(rawToBand('listening', 'academic', 30, 40).band, 7);
  assert.equal(rawToBand('reading', 'academic', 30, 40).band, 7);
  assert.equal(rawToBand('reading', 'general', 30, 40).band, 6);
  assert.equal(rawToBand('listening', 'academic', 20, 20).band, 9);
  assert.equal(roundBand(6.125), 6);
  assert.equal(roundBand(6.25), 6.5);
  assert.equal(roundBand(6.75), 7);
});

test('full attempt lifecycle: progress, time only decreases, redaction, scoring and reviews', () => {
  const attempt = createAttempt(DEMO_MATERIALS, { kind: 'full', skills: [], testType: 'academic', settings: { listeningPlayback: 'exam' } }, 'u1');
  assert.deepEqual(attempt.sections.map((s) => s.skill), ['listening', 'reading', 'writing', 'speaking']);

  const listening = attempt.sections[0];
  const firstQ = listening.materials[0].groups[0].questions[0];
  assert.throws(() => applyProgress(attempt, { sectionIndex: 0, answers: { [firstQ.id]: 'x' } }), /Start the section/);
  applyProgress(attempt, { sectionIndex: 0, startSection: true, answers: { [firstQ.id]: firstQ.answers[0], bogus: 'x' }, remainingSec: 1000 });
  assert.equal(listening.answers[firstQ.id], firstQ.answers[0]);
  assert.equal(listening.answers.bogus, undefined);
  applyProgress(attempt, { sectionIndex: 0, remainingSec: 5000 });
  assert.equal(listening.remainingSec, 1000, 'time must not go back up');

  const red = redactAttempt(attempt);
  assert.ok(red.sections.every((s) => s.materials.every((m) => m.groups.every((g) => g.questions.every((q) => q.answers.length === 0)))));
  assert.ok(attempt.sections[0].materials[0].groups[0].questions[0].answers.length > 0, 'original keeps answers');

  submitSection(attempt, 0);
  assert.equal(attempt.currentSection, 1);
  assert.throws(() => submitSection(attempt, 0), /current section/);
  submitSection(attempt, 1);
  applyProgress(attempt, { sectionIndex: 2, startSection: true, writing: { [attempt.sections[2].materials[1].id]: 'word '.repeat(260) } });
  submitSection(attempt, 2);
  applyProgress(attempt, { sectionIndex: 3, startSection: true });
  const sp = attempt.sections[3].materials[0];
  setRecording(attempt, `${sp.id}:0`, { id: 'r1', durationSec: 20, mime: 'audio/webm' });
  assert.throws(() => setRecording(attempt, `${sp.id}:99`, { id: 'r2', durationSec: 5, mime: 'audio/webm' }));
  endTest(attempt);

  assert.equal(attempt.status, 'submitted');
  const res = attempt.result!;
  const l = res.skills.find((s) => s.skill === 'listening')!;
  assert.equal(l.raw, 1);
  assert.equal(res.overall, null);
  assert.equal(res.skills.find((s) => s.skill === 'writing')!.writing![1].words, 260);

  const writingItems = Object.fromEntries(attempt.sections[2].materials.map((m) => [m.id, { scores: (m.part === 1 ? { ta: 6, cc: 6, lr: 6, gra: 6 } : { tr: 7, cc: 7, lr: 7, gra: 7 }) as Record<string, number>, comment: "" }]));
  applyReview(attempt, 'writing', 'self', 'me', writingItems);
  assert.equal(attempt.result!.skills.find((s) => s.skill === 'writing')!.band, 6.5); // (6 + 2*7)/3 = 6.67 → 6.5
  applyReview(attempt, 'speaking', 'teacher', 'T', { speaking: { scores: { fc: 6, lr: 6, gra: 5.5, p: 6 }, comment: 'ok' } });
  assert.equal(attempt.result!.skills.find((s) => s.skill === 'speaking')!.band, 6);
  assert.notEqual(attempt.result!.overall, null);
  assert.throws(() => applyReview(attempt, 'speaking', 'self', 'me', { speaking: { scores: { fc: 9, lr: 9, gra: 9, p: 9 }, comment: '' } }), /teacher/);
});

test('validation reports clear errors and import skips invalid items', () => {
  const r = validateMaterial({ skill: 'reading', part: 4, title: '', groups: [] });
  assert.equal(r.ok, false);
  const fields = r.errors.map((e) => e.field);
  assert.ok(fields.includes('part') && fields.includes('title') && fields.includes('groups') && fields.includes('passage'));
  const rep = validateImport({ materials: [DEMO_MATERIALS[0], { skill: 'writing', part: 2 }] });
  assert.equal(rep.imported.length, 1);
  assert.equal(rep.failed.length, 1);
  assert.notEqual(rep.imported[0].id, DEMO_MATERIALS[0].id, 'imported ids are regenerated');
  assert.equal(validateImport({ nope: 1 }).failed[0].errors[0].field, 'file');
  const l = validateMaterial({ skill: 'listening', part: 1, title: 'x', status: 'active', groups: DEMO_MATERIALS[0].groups });
  assert.ok(l.errors.some((e) => e.field === 'audio'));
});
