import { describe, expect, test } from 'bun:test';
import { createClient } from '../../src/client.ts';
import { isLayaAuthError, isLayaConnectionError, isLayaTimeoutError, isLayaValidationError } from '../../src/errors.ts';

const VALID_BODY = {
    answers: { a: { probability: 0.5 } },
    usage: {},
    routing: {},
};

type FetchStub = (input: unknown, init?: unknown) => Promise<unknown>;
const stubFetch = (stub: FetchStub) => {
    const original = globalThis.fetch;
    globalThis.fetch = stub as typeof fetch;
    return () => {
        globalThis.fetch = original;
    };
};

const deciderBody = { state: 'text', questions: { urgent: { type: 'noul', question: 'q?' } } };

describe('error code mapping', () => {
    test('fetch failure → connection', async () => {
        const restore = stubFetch(async () => {
            throw new TypeError('fetch failed');
        });
        try {
            await createClient().request(deciderBody);
            expect.unreachable();
        } catch (e) {
            expect(isLayaConnectionError(e)).toBe(true);
        } finally {
            restore();
        }
    });

    test('401 → auth', async () => {
        const restore = stubFetch(async () => new Response('unauthorized', { status: 401 }));
        try {
            await createClient().request(deciderBody);
            expect.unreachable();
        } catch (e) {
            expect(isLayaAuthError(e)).toBe(true);
        } finally {
            restore();
        }
    });

    test('abort → timeout', async () => {
        const restore = stubFetch(async () => new Promise(() => {}));
        try {
            await createClient({ timeout: 20 }).request(deciderBody);
            expect.unreachable();
        } catch (e) {
            expect(isLayaTimeoutError(e)).toBe(true);
        } finally {
            restore();
        }
    });

    test('malformed JSON body → validation', async () => {
        const restore = stubFetch(async () => new Response('not json {', { status: 200 }));
        try {
            await createClient().request(deciderBody);
            expect.unreachable();
        } catch (e) {
            expect(isLayaValidationError(e)).toBe(true);
        } finally {
            restore();
        }
    });

    test('zod rejects malformed response shape → validation', async () => {
        const restore = stubFetch(async () => new Response(JSON.stringify({ answers: 'nope' }), { status: 200 }));
        try {
            await createClient().request(deciderBody);
            expect.unreachable();
        } catch (e) {
            expect(isLayaValidationError(e)).toBe(true);
        } finally {
            restore();
        }
    });

    test('valid response parses', async () => {
        const restore = stubFetch(async () => new Response(JSON.stringify(VALID_BODY), { status: 200 }));
        try {
            const response = await createClient().request(deciderBody);
            expect(response.answers).toEqual(VALID_BODY.answers);
        } finally {
            restore();
        }
    });
});
