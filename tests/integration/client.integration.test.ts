import { describe, expect, test } from 'bun:test';
import { createClient } from '../../src';
import { isLayaAuthError, isLayaConnectionError, isLayaTimeoutError, isLayaValidationError } from '../../src/errors';
import { startMockSidecar } from '../helpers/mock-server';

// Integration tier: createClient drives the real fetch/HTTP/parse stack
// against an in-process stand-in for the FastAPI sidecar.

const { url } = startMockSidecar();

const client = createClient({ url, apiKey: 'good-key', timeout: 3000 });
const slowClient = createClient({ url, apiKey: 'good-key', timeout: 20 });
const body = { state: 'text', questions: { urgent: { type: 'noul', question: 'q?' } } };

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
            await createClient({ url, apiKey: 'wrong', timeout: 3000 }).request(body);
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
