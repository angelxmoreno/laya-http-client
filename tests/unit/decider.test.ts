import { describe, expect, test } from 'bun:test';
import type { LayaClient } from '../../src/client';
import { createDecider } from '../../src/decider';
import { isLayaValidationError } from '../../src/errors';
import type { SystemOneResponse } from '../../src/types';

const respondWith = (answers: unknown): LayaClient => ({
    request: async () =>
        ({ answers, model: 'laya-rl-agent', usage: { input_tokens: 1, output_tokens: 0 } }) as SystemOneResponse,
});

const expectValidationError = async (p: Promise<unknown>) => {
    try {
        await p;
        expect.unreachable();
    } catch (e) {
        expect(isLayaValidationError(e)).toBe(true);
    }
};

describe('createDecider', () => {
    test('returns typed answers for a valid response', async () => {
        const decide = createDecider({
            client: respondWith({
                urgent: { type: 'noul', noul: 0.9, confidence: 0.9, action: { act_probability: 0.4 } },
                severity: {
                    type: 'score',
                    score: 1.2,
                    confidence: 0.8,
                    action: { act_probability: 0.4 },
                    legend: { '0': 'low', '1': 'medium', '2': 'high' },
                    probabilities: { '0': 0.2, '1': 0.5, '2': 0.3 },
                },
                category: {
                    type: 'choice',
                    choice: 'bug',
                    confidence: 0.6,
                    action: { act_probability: 0.4 },
                    probabilities: { billing: 0.4, bug: 0.6 },
                },
            }),
            questions: {
                urgent: { type: 'noul', instructions: 'urgent?' },
                severity: { type: 'score', instructions: 'severity?', criteria: ['low', 'medium', 'high'] },
                category: { type: 'choice', instructions: 'category?', criteria: ['billing', 'bug'] },
            },
        });
        const result = await decide('some text');
        expect(result.answers.urgent.noul).toBe(0.9);
        expect(result.answers.category.choice).toBe('bug');
    });

    test('rejects a missing answer key → validation', async () => {
        const decide = createDecider({
            client: respondWith({
                urgent: { type: 'noul', noul: 0.9, confidence: 0.9, action: { act_probability: 0.4 } },
                severity: {
                    type: 'score',
                    score: 1.2,
                    confidence: 0.8,
                    action: { act_probability: 0.4 },
                    legend: { '0': 'low', '1': 'medium', '2': 'high' },
                    probabilities: { '0': 0.2, '1': 0.5, '2': 0.3 },
                },
            }),
            questions: {
                urgent: { type: 'noul', instructions: 'urgent?' },
                severity: { type: 'score', instructions: 'severity?', criteria: ['low', 'medium', 'high'] },
                category: { type: 'choice', instructions: 'category?', criteria: ['billing', 'bug'] },
            },
        });
        await expectValidationError(decide('some text'));
    });

    test('rejects a score outside the rubric levels → validation', async () => {
        // Single-question bind so the score refine is what throws, not a
        // missing earlier answer or the base shape check.
        const decide = createDecider({
            client: respondWith({
                severity: {
                    type: 'score',
                    score: 5,
                    confidence: 0.8,
                    action: { act_probability: 0.4 },
                    legend: { '0': 'low', '1': 'medium', '2': 'high' },
                    probabilities: { '0': 0.2, '1': 0.3, '2': 0.5 },
                },
            }),
            questions: { severity: { type: 'score', instructions: 'severity?', criteria: ['low', 'medium', 'high'] } },
        });
        await expectValidationError(decide('some text'));
    });

    test('rejects a choice outside the criteria (list form) → validation', async () => {
        const decide = createDecider({
            client: respondWith({
                category: {
                    type: 'choice',
                    choice: 'feature',
                    confidence: 0.6,
                    action: { act_probability: 0.4 },
                    probabilities: { feature: 1 },
                },
            }),
            questions: { category: { type: 'choice', instructions: 'category?', criteria: ['billing', 'bug'] } },
        });
        await expectValidationError(decide('some text'));
    });

    test('rejects a choice outside the criteria (dict form) → validation', async () => {
        const decide = createDecider({
            client: respondWith({
                category: {
                    type: 'choice',
                    choice: 'other',
                    confidence: 0.6,
                    action: { act_probability: 0.4 },
                    probabilities: { other: 1 },
                },
            }),
            questions: {
                category: {
                    type: 'choice',
                    instructions: 'category?',
                    criteria: { billing: 'money', bug: 'errors' },
                },
            },
        });
        await expectValidationError(decide('some text'));
    });
});
