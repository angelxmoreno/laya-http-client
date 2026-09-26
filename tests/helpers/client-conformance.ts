import { describe, expect, test } from 'bun:test';
import { createDecider } from '../../src';
import { isLayaAuthError } from '../../src/errors';

export type ConformanceOptions = {
    /** Base URL of a sidecar (mock stand-in or the real one). */
    url: string;
    apiKey?: string;
    /** Set when the sidecar enforces bearer auth — enables the 401 rejection test. */
    requiresAuth?: boolean;
    timeout?: number;
};

/**
 * Tests that hold against any conforming /v1/systemone sidecar. Shared by the
 * integration tier (mock server) and the smoke tier (real sidecar via env).
 */
export const runClientConformanceSuite = ({
    url,
    apiKey,
    requiresAuth = false,
    timeout = 10000,
}: ConformanceOptions) => {
    describe('client conformance', () => {
        test('answers a noul question with a probability', async () => {
            const decider = createDecider({
                url,
                apiKey,
                timeout,
                questions: { urgent: { type: 'noul', question: 'Is this urgent?' } },
            });
            const result = await decider('test state');
            expect(result.answers.urgent.probability).toBeTypeOf('number');
            expect(result.answers.urgent.probability >= 0 && result.answers.urgent.probability <= 1).toBe(true);
        });

        if (requiresAuth) {
            test('rejects a missing api key with an auth error', async () => {
                const unauthenticated = createDecider({
                    url,
                    timeout,
                    questions: { urgent: { type: 'noul', question: 'Is this urgent?' } },
                });
                try {
                    await unauthenticated('test state');
                    expect.unreachable();
                } catch (e) {
                    expect(isLayaAuthError(e)).toBe(true);
                }
            });
        }
    });
};
