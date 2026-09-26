import { afterAll, describe, expect, test } from 'bun:test';
import { createClient } from '../../src';
import { isLayaAuthError, isLayaConnectionError, isLayaTimeoutError, isLayaValidationError } from '../../src/errors.ts';

// Integration tier: createClient drives the real fetch/HTTP/parse stack
// against an in-process stand-in for the FastAPI sidecar.

const VALID_BODY = {
    answers: { urgent: { probability: 0.9 } },
    usage: { tokens: 3 },
    routing: { model: 'aac6fef/laya-mlx' },
};

const server = Bun.serve({
    port: 0,
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname !== '/v1/systemone') {
            return new Response('not found', { status: 404 });
        }
        if (request.headers.get('authorization') !== 'Bearer good-key') {
            return new Response('unauthorized', { status: 401 });
        }
        if (request.method !== 'POST') {
            return new Response('method not allowed', { status: 405 });
        }
        const body = await request.text();
        if (body === '"notfound"') {
            return new Response('not found', { status: 404 });
        }
        if (body === '"corrupt"') {
            return new Response('not json {', { status: 200 });
        }
        if (body === '"wrong-shape"') {
            return new Response(JSON.stringify({ answers: 'nope' }), { status: 200 });
        }
        if (body === '"slow"') {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return new Response(JSON.stringify(VALID_BODY), { status: 200 });
        }
        return new Response(JSON.stringify(VALID_BODY), { status: 200 });
    },
});

const client = createClient({ url: server.url.origin, apiKey: 'good-key', timeout: 3000 });
const slowClient = createClient({ url: server.url.origin, apiKey: 'good-key', timeout: 20 });
const body = { state: 'text', questions: { urgent: { type: 'noul', question: 'q?' } } };

afterAll(() => {
    server.stop(true);
});

describe('integration: real HTTP against in-process sidecar', () => {
    test('happy path over real fetch', async () => {
        const response = await client.request(body);
        const answers = response.answers as { urgent: { probability: number } };
        expect(answers.urgent.probability).toBe(0.9);
        expect((response.usage as { tokens: number }).tokens).toBe(3);
    });

    test('sends bearer auth header', async () => {
        await client.request(body); // server rejects non-matching bearer above
        expect(true).toBe(true);
    });

    test('401 → auth error over real HTTP', async () => {
        try {
            await createClient({ url: server.url.origin, apiKey: 'wrong', timeout: 3000 }).request(body);
            expect.unreachable();
        } catch (e) {
            expect(isLayaAuthError(e)).toBe(true);
        }
    });

    test('malformed JSON body → validation error over real HTTP', async () => {
        try {
            await client.request('corrupt');
            expect.unreachable();
        } catch (e) {
            expect(isLayaValidationError(e)).toBe(true);
        }
    });

    test('schema-mismatching envelope → validation error', async () => {
        try {
            await client.request('wrong-shape');
            expect.unreachable();
        } catch (e) {
            expect(isLayaValidationError(e)).toBe(true);
        }
    });

    test('delayed response with short timeout → timeout error', async () => {
        try {
            await slowClient.request('slow');
            expect.unreachable();
        } catch (e) {
            expect(isLayaTimeoutError(e)).toBe(true);
        }
    });

    test('server-side 404 → connection error', async () => {
        try {
            await client.request('notfound');
            expect.unreachable();
        } catch (e) {
            expect(isLayaConnectionError(e)).toBe(true);
        }
    });
});
