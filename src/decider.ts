import type { LayaClient } from './client';
import { createClient } from './client';
import { LayaError } from './LayaError';
import { requestSchema, validateAnswers } from './schemas';
import type { Answers, LayaQuestion, Result } from './types';

/**
 * Binds a question set once; the returned function takes only the state text.
 * Answers are inferred from `questions` — each key maps to its per-type answer
 * shape, so a wrong key is a compile error.
 *
 * Pass either `client` or `url`/`apiKey`/`timeout` (which build one internally).
 */
const createDecider = <const Q extends { readonly [K in keyof Q]: LayaQuestion }>(options: {
    client?: LayaClient;
    url?: string;
    apiKey?: string;
    timeout?: number;
    questions: Q;
}) => {
    const client: LayaClient = options.client ?? createClient(options);
    const { questions } = options;

    return async (state: string): Promise<Result<Q>> => {
        const parsedRequest = requestSchema.safeParse({ state, questions });
        if (!parsedRequest.success) {
            throw new LayaError(
                'validation',
                `invalid request: ${parsedRequest.error.issues[0]?.message ?? 'invalid'}`
            );
        }
        const response = await client.request(parsedRequest.data);
        const answers = validateAnswers(questions, response.answers);
        return {
            answers: answers as Answers<Q>,
            model: response.model,
            usage: response.usage,
            routing: response.routing,
        };
    };
};

export { createDecider };
