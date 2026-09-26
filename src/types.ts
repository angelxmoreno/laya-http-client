/** The three question types the Laya /v1/systemone endpoint accepts. */
export type LayaQuestion =
    | { type: 'noul'; question: string }
    | { type: 'score'; question: string; range: readonly [number, number] }
    | { type: 'choice'; question: string; choices: readonly string[] };

export type Questions = Record<string, LayaQuestion>;

/**
 * Constraint for question-set generics. Self-referential mapped form (not
 * `Record<string, LayaQuestion>`) — a `Record` constraint makes inference
 * widen the keys to `string`, which would let a misspelled answer key compile.
 */
/** Per-question answer shape, inferred from the question itself. */
export type AnswerFor<Q extends LayaQuestion> = Q extends { type: 'noul' }
    ? { probability: number }
    : Q extends { type: 'score' }
      ? { score: number; probability: number }
      : Q extends { type: 'choice'; choices: infer C }
        ? C extends readonly string[]
            ? { option: C[number]; optionIndex: number; probability: number }
            : never
        : never;

/** Mapped type: answers keyed exactly by the questions object's keys. */
export type Answers<Q extends { readonly [K in keyof Q]: LayaQuestion }> = { [K in keyof Q]: AnswerFor<Q[K]> };

/** Full response for a bound question set. */
export type Result<Q extends { readonly [K in keyof Q]: LayaQuestion }> = {
    answers: Answers<Q>;
    usage: unknown;
    routing: unknown;
};

/** Wire response shape before per-question validation (what `createClient` returns). */
export type SystemOneResponse = {
    answers: Record<string, unknown>;
    usage: unknown;
    routing: unknown;
};

export type ClientOptions = {
    url?: string;
    apiKey?: string;
    timeout?: number;
};
