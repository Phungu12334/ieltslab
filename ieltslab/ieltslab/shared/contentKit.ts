// Helpers for writing original practice content in code.
import type { Material, MaterialTestType, Question, QuestionGroup, QuestionType, Skill } from './types';

const CREATED = '2026-01-01T00:00:00.000Z';

type Q = Omit<Question, 'id'>;
export const q = (prompt: string, answers: string[], explanation?: string, options?: string[]): Q => ({
  prompt,
  answers,
  ...(explanation ? { explanation } : {}),
  ...(options ? { options } : {}),
});
type G = Omit<QuestionGroup, 'id' | 'questions'> & { questions: Q[] };
export const g = (type: QuestionType, instructions: string, questions: Q[], extra: Partial<G> = {}): G => ({ type, instructions, questions, ...extra });

export function mat(
  id: string,
  skill: Skill,
  testType: MaterialTestType,
  part: number,
  title: string,
  instructions: string,
  extra: Partial<Omit<Material, 'groups'>> & { groups?: G[] } = {},
): Material {
  const { groups = [], tags = [], ...rest } = extra;
  return {
    id,
    skill,
    testType,
    part,
    title,
    instructions,
    groups: groups.map((grp, gi) => ({
      ...grp,
      id: `${id}-g${gi + 1}`,
      questions: grp.questions.map((qq, qi) => ({ ...qq, id: `${id}-g${gi + 1}-q${qi + 1}` })),
    })),
    tags: ['demo', ...tags],
    status: 'active',
    demo: true,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...rest,
  };
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function svgData(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

