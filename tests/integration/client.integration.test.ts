import { describe, expect, test } from 'bun:test';
import { createClient, isLayaConnectionError, isLayaTimeoutError, isLayaValidationError } from '../../src';
import { runClientConformanceSuite } from '../helpers/client-conformance';
import { startMockSidecar } from '../helpers/mock-server';

// Integration tier: createClient drives the real fetch/HTTP/parse stack
// against an in-process stand-in for the FastAPI sidecar. The conformance
// suite is shared with the smoke tier; the sentinels below are mock-only
// edge cases a live sidecar can't be driven into.

const { url } = startMockSidecar();

runClientConformanceSuite({ url, apiKey: 'good-key', requiresAuth: true, timeout: 3000 });

const client = createClient({ url, apiKey: 'good-key', timeout: 3000 });
const slowClient = createClient({ url, apiKey: 'good-key', timeout: 20 });

describe('integration edge cases (mock-only sentinels)', () => {
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
