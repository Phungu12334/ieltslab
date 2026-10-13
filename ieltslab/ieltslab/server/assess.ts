// Optional automated Writing feedback through the Anthropic Messages API.
// Enabled only when ANTHROPIC_API_KEY is set. Results are labelled as AI feedback, never as official scores.
import { WRITING_CRITERIA } from '../shared/constants';
import type { Attempt, CriterionReview } from '../shared/types';
import { config } from './config';
import { HttpError } from './http';

const SYSTEM = `You are an experienced IELTS Writing teacher giving practice feedback.
Assess the candidate's response against the four public IELTS Writing criteria named in the request.
Be strict and realistic: an under-length or off-topic answer must be marked down.
Return ONLY a JSON object: {"scores": {"<criterion key>": <band 0-9 in steps of 0.5>, ...}, "comment": "<120-220 words of specific, actionable feedback with 2-3 short quotations from the response>"}`;

export async function aiWritingReview(attempt: Attempt): Promise<Record<string, CriterionReview>> {
  if (!config.ai) throw new HttpError(501, 'AI feedback is not configured on this server.');
  const section = attempt.sections.find((s) => s.skill === 'writing');
  if (!section) throw new HttpError(400, 'This attempt has no Writing section.');
  const out: Record<string, CriterionReview> = {};
  for (const m of section.materials) {
    const text = (section.writing[m.id] || '').trim();
    if (!text) throw new HttpError(400, `Task ${m.part} has no response to assess.`);
    const criteria = WRITING_CRITERIA[m.part === 1 ? 1 : 2];
    const user = [
      `Test format: ${attempt.testType === 'general' ? 'General Training' : 'Academic'}, Writing Task ${m.part}.`,
      `Minimum length: ${m.minWords || (m.part === 1 ? 150 : 250)} words.`,
      `Task prompt:\n${m.prompt}${m.bullets?.length ? '\n- ' + m.bullets.join('\n- ') : ''}`,
      m.imageAlt ? `Visual description: ${m.imageAlt}` : '',
      `Criteria keys: ${criteria.map((c) => `${c.key} = ${c.label}`).join('; ')}`,
      `Candidate response:\n"""\n${text.slice(0, 12000)}\n"""`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': config.ai.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: config.ai.model, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
      });
      if (!r.ok) {
        const body = await r.text();
        console.error('AI assessment failed', r.status, body.slice(0, 500));
        throw new HttpError(502, 'The AI feedback service returned an error. Check ANTHROPIC_API_KEY and ASSESSMENT_MODEL.');
      }
      const data = (await r.json()) as { content?: { type: string; text?: string }[] };
      const raw = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { scores?: Record<string, number>; comment?: string };
      const scores: Record<string, number> = {};
      for (const c of criteria) {
        const v = Number(json.scores?.[c.key]);
        if (!Number.isFinite(v)) throw new HttpError(502, 'The AI feedback was incomplete. Try again.');
        scores[c.key] = Math.max(0, Math.min(9, Math.round(v * 2) / 2));
      }
      out[m.id] = { scores, comment: String(json.comment || '').slice(0, 4000) };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(502, 'Could not get AI feedback right now. Try again later.');
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}
