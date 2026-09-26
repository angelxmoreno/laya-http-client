import { z } from 'zod';
import { LayaError } from './LayaError';
import type { LayaQuestion } from './types';

/** Request body for POST /v1/systemone — mirrors what laya-serve / laya_mlx validate server-side. */
export const requestSchema = z.object({
    // Servers accept string/dict/conversation state (sidecar: `state: Any`) and own its validation.
    state: z.unknown(),
    questions: z.record(
        z.string(),
        z.union([
            z.object({ type: z.literal('noul'), instructions: z.string().min(1) }),
            z.object({
                type: z.literal('score'),
                instructions: z.string().min(1),
                criteria: z.array(z.string()).min(1).readonly(),
            }),
            z.object({
                type: z.literal('choice'),
                instructions: z.string().min(1),
                criteria: z
                    .union([
                        z.array(z.string()).min(1).readonly(),
                        z.record(z.string(), z.string()).refine((d) => Object.keys(d).length > 0, {
                            message: 'choice criteria must be a nonempty dictionary',
                        }),
                    ])
                    .refine((c) => !(Array.isArray(c) && new Set(c).size !== c.length), {
                        message: 'choice labels must be unique',
                    }),
            }),
        ])
    ),
});

const baseAnswer = z.object({
    type: z.string(),
    confidence: z.number(),
    action: z.object({ act_probability: z.number() }),
});

export const noulAnswer = baseAnswer.extend({ type: z.literal('noul'), noul: z.number().min(0).max(1) });
export const scoreAnswer = baseAnswer.extend({
    type: z.literal('score'),
    score: z.number(),
    legend: z.record(z.string(), z.string()),
    probabilities: z.record(z.string(), z.number()),
});
export const choiceAnswer = baseAnswer.extend({
    type: z.literal('choice'),
    choice: z.string(),
    probabilities: z.record(z.string(), z.number()),
});

const labelsOf = (q: LayaQuestion & { type: 'choice' }): string[] =>
    Array.isArray(q.criteria) ? [...q.criteria] : Object.keys(q.criteria);

/**
 * Answer schema for one bound question, with per-question refinements so a
 * server answer outside the question's contract is a `validation` error.
 */
export const answerSchemaFor = (q: LayaQuestion) => {
    switch (q.type) {
        case 'noul':
            return noulAnswer;
        case 'score': {
            const max = q.criteria.length - 1;
            return scoreAnswer.refine((a) => a.score >= 0 && a.score <= max, {
                message: `score outside rubric levels 0..${max}`,
            });
        }
        case 'choice':
            return choiceAnswer.refine((a) => labelsOf(q).includes(a.choice), {
                message: 'choice not among the question criteria',
            });
    }
};

/** Full response envelope before per-question answer validation. */
export const responseSchema = z.object({
    model: z.string(),
    answers: z.record(z.string(), z.unknown()),
    usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
    routing: z.unknown().optional(),
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

/** Derived wire types — the schemas are the single source of truth. */
export type WireQuestion = z.infer<typeof requestSchema>['questions'][string];
export type NoulAnswer = z.infer<typeof noulAnswer>;
export type ScoreAnswer = z.infer<typeof scoreAnswer>;
export type ChoiceAnswer = z.infer<typeof choiceAnswer>;
