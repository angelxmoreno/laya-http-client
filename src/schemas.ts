import { z } from 'zod';
import { LayaError } from './LayaError';
import type { LayaQuestion } from './types';

/** Request body for POST /v1/systemone. */
export const requestSchema = z.object({
    state: z.string(),
    questions: z.record(
        z.string(),
        z.union([
            z.object({ type: z.literal('noul'), question: z.string() }),
            z.object({ type: z.literal('score'), question: z.string(), range: z.tuple([z.number(), z.number()]) }),
            z.object({ type: z.literal('choice'), question: z.string(), choices: z.array(z.string()) }),
        ])
    ),
});

const noulAnswer = z.object({ probability: z.number() });
const scoreAnswer = z.object({ score: z.number(), probability: z.number() });
const choiceAnswer = z.object({ option: z.string(), optionIndex: z.number().int(), probability: z.number() });

/**
 * Answer schema for one bound question, with range/choices refinements so a
 * server answer outside the question's contract is a `validation` error.
 */
export const answerSchemaFor = (q: LayaQuestion) => {
    switch (q.type) {
        case 'noul':
            return noulAnswer;
        case 'score': {
            const [min, max] = q.range;
            return scoreAnswer.refine((a) => a.score >= min && a.score <= max, {
                message: `score outside range [${min}, ${max}]`,
            });
        }
        case 'choice':
            return choiceAnswer.refine((a) => q.choices.includes(a.option), {
                message: 'option not in choices',
            });
    }
};

/** Full response envelope before per-question answer validation. */
export const responseSchema = z.object({
    answers: z.record(z.string(), z.unknown()),
    usage: z.unknown(),
    routing: z.unknown(),
});

/** Validate the whole `answers` record against a bound question set. */
export const validateAnswers = (
    questions: Record<string, LayaQuestion>,
    answers: Record<string, unknown>
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, q] of Object.entries(questions)) {
        const parsed = answerSchemaFor(q).safeParse(answers[key]);
        if (!parsed.success) {
            const detail = parsed.error.issues[0]?.message ?? 'invalid';
            throw new LayaError('validation', `malformed answer for question "${key}": ${detail}`);
        }
        result[key] = parsed.data;
    }
    return result;
};
