import type { z } from 'zod';
import type { ChoiceAnswer, NoulAnswer, requestSchema, responseSchema, ScoreAnswer } from './schemas';

/**
 * Question types for the Laya `POST /v1/systemone` wire protocol — the official
 * contract spoken by both the upstream `laya[serve]` server (NandhaKishorM/laya)
 * and the vendored MLX sidecar. Derived from `requestSchema` in schemas.ts.
 */
export type LayaQuestion = z.infer<typeof requestSchema>['questions'][string];

export type Questions = Record<string, LayaQuestion>;

/** Literal union of a choice question's labels: array elements for the list form, object keys for the dict form. */
type ChoiceLabel<C> = C extends readonly (infer L)[]
    ? L & string
    : C extends Record<string, string>
      ? keyof C & string
      : string;

/** Per-question answer shape, inferred from the question itself. */
export type AnswerFor<Q extends LayaQuestion> = Q extends { type: 'noul' }
    ? NoulAnswer
    : Q extends { type: 'score' }
      ? ScoreAnswer
      : Q extends { type: 'choice'; criteria: infer C }
        ? Omit<ChoiceAnswer, 'choice'> & { choice: ChoiceLabel<C> }
        : never;

/**
 * Constraint for question-set generics. Self-referential mapped form (not
 * `Record<string, LayaQuestion>`) — a `Record` constraint makes inference
 * widen the keys to `string`, which would let a misspelled answer key compile.
 */
/** Mapped type: answers keyed exactly by the questions object's keys. */
export type Answers<Q extends { readonly [K in keyof Q]: LayaQuestion }> = { [K in keyof Q]: AnswerFor<Q[K]> };

export type LayaUsage = z.infer<typeof responseSchema>['usage'];

/** Full response for a bound question set. */
export type Result<Q extends { readonly [K in keyof Q]: LayaQuestion }> = {
    answers: Answers<Q>;
    model: string;
    usage: LayaUsage;
    /** Present only from servers that route (upstream `laya-serve` / `Router`); absent from single-checkpoint sidecars. */
    routing?: unknown;
};

/** Wire response shape before per-question validation (what `createClient` returns). */
export type SystemOneResponse = z.infer<typeof responseSchema>;

export type ClientOptions = {
    url?: string;
    apiKey?: string;
    timeout?: number;
};
