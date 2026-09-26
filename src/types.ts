/**
 * Question types for the Laya `POST /v1/systemone` wire protocol — the official
 * contract spoken by both the upstream `laya[serve]` server (NandhaKishorM/laya)
 * and our MLX sidecar. See docs/SPEC.md.
 */
export type LayaQuestion =
    | { type: 'noul'; instructions: string }
    | { type: 'score'; instructions: string; criteria: readonly string[] }
    | { type: 'choice'; instructions: string; criteria: readonly string[] | Record<string, string> };

export type Questions = Record<string, LayaQuestion>;

/**
 * Constraint for question-set generics. Self-referential mapped form (not
 * `Record<string, LayaQuestion>`) — a `Record` constraint makes inference
 * widen the keys to `string`, which would let a misspelled answer key compile.
 */
/**
 * Literal union of a choice question's labels: array elements for the list
 * form, object keys for the dict form.
 */
type ChoiceLabel<C> = C extends readonly (infer L)[]
    ? L & string
    : C extends Record<string, string>
      ? keyof C & string
      : string;

/** Per-question answer shape, inferred from the question itself. */
export type AnswerFor<Q extends LayaQuestion> = Q extends { type: 'noul' }
    ? { type: 'noul'; noul: number; confidence: number; action: { act_probability: number } }
    : Q extends { type: 'score' }
      ? {
            type: 'score';
            /** Expected zero-based rubric level (weighted mean over level indices). */
            score: number;
            confidence: number;
            action: { act_probability: number };
            legend: Record<string, string>;
            probabilities: Record<string, number>;
        }
      : Q extends { type: 'choice'; criteria: infer C }
        ? {
              type: 'choice';
              choice: ChoiceLabel<C>;
              confidence: number;
              action: { act_probability: number };
              probabilities: Record<string, number>;
          }
        : never;

/** Mapped type: answers keyed exactly by the questions object's keys. */
export type Answers<Q extends { readonly [K in keyof Q]: LayaQuestion }> = { [K in keyof Q]: AnswerFor<Q[K]> };

export type LayaUsage = { input_tokens: number; output_tokens: number };

/** Full response for a bound question set. */
export type Result<Q extends { readonly [K in keyof Q]: LayaQuestion }> = {
    answers: Answers<Q>;
    model: string;
    usage: LayaUsage;
    /** Present only from servers that route (upstream `laya-serve` / `Router`); absent from single-checkpoint sidecars. */
    routing?: unknown;
};

/** Wire response shape before per-question validation (what `createClient` returns). */
export type SystemOneResponse = {
    model: string;
    answers: Record<string, unknown>;
    usage: LayaUsage;
    routing?: unknown;
};

export type ClientOptions = {
    url?: string;
    apiKey?: string;
    timeout?: number;
};
