import { describe, expect, test } from 'bun:test';
import { createDecider } from '../../src';
import { isLayaAuthError } from '../../src/errors';

export type ConformanceOptions = {
    /** Base URL of a /v1/systemone server (mock stand-in or real laya). */
    url: string;
    apiKey?: string;
    /** Set when the server enforces bearer auth — enables the 401 rejection test. */
    requiresAuth?: boolean;
    timeout?: number;
};

/**
 * Tests that hold against any conforming /v1/systemone server. Shared by the
 * integration tier (mock server) and the smoke tier (real sidecar via env).
 */
export const runClientConformanceSuite = ({
    url,
    apiKey,
    requiresAuth = false,
    timeout = 10000,
}: ConformanceOptions) => {
    describe('client conformance', () => {
        const decider = createDecider({
            url,
            apiKey,
            timeout,
            questions: {
                urgent: { type: 'noul', instructions: 'Is this urgent?' },
                severity: {
                    type: 'score',
                    instructions: 'How severe is this?',
                    criteria: ['low', 'medium', 'high'],
                },
                department: {
                    type: 'choice',
                    instructions: 'Which department?',
                    criteria: ['billing', 'technical'],
                },
            },
        });

        test('answers a noul question with P(true)', async () => {
            const result = await decider('test state');
            expect(result.answers.urgent.noul).toBeTypeOf('number');
            expect(result.answers.urgent.noul >= 0 && result.answers.urgent.noul <= 1).toBe(true);
            expect(result.usage.input_tokens).toBeTypeOf('number');
        });

        test('answers a score question with a rubric level', async () => {
            const result = await decider('test state');
            expect(result.answers.severity.score).toBeTypeOf('number');
            expect(result.answers.severity.score >= 0 && result.answers.severity.score <= 2).toBe(true);
            expect(Object.keys(result.answers.severity.legend)).toHaveLength(3);
        });

        test('answers a choice question with one of the labels', async () => {
            const result = await decider('test state');
            expect(['billing', 'technical']).toContain(result.answers.department.choice);
        });

        if (requiresAuth) {
            test('rejects a missing api key with an auth error', async () => {
                const unauthenticated = createDecider({
                    url,
                    timeout,
                    questions: { urgent: { type: 'noul', instructions: 'Is this urgent?' } },
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
