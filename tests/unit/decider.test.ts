import { describe, expect, test } from 'bun:test';
import type { LayaClient } from '../../src/client';
import { createDecider } from '../../src/decider';
import { isLayaValidationError } from '../../src/errors';
import type { SystemOneResponse } from '../../src/types';

const respondWith = (answers: unknown): LayaClient => ({
    request: async () =>
        ({ answers, model: 'laya-rl-agent', usage: { input_tokens: 1, output_tokens: 0 } }) as SystemOneResponse,
});

const decider = (answers: unknown) =>
    createDecider({
        client: respondWith(answers),
        questions: {
            urgent: { type: 'noul', instructions: 'urgent?' },
            severity: { type: 'score', instructions: 'severity?', criteria: ['low', 'medium', 'high'] },
            category: { type: 'choice', instructions: 'category?', criteria: ['billing', 'bug'] },
        },
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
        const decide = decider({
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
        });
        const result = await decide('some text');
        expect(result.answers.urgent.noul).toBe(0.9);
        expect(result.answers.category.choice).toBe('bug');
    });

    test('rejects a missing answer key → validation', async () => {
        const decide = decider({
            urgent: { type: 'noul', noul: 0.9, confidence: 0.9, action: { act_probability: 0.4 } },
            severity: {
                type: 'score',
                score: 1.2,
                confidence: 0.8,
                action: { act_probability: 0.4 },
                legend: { '0': 'low', '1': 'medium', '2': 'high' },
                probabilities: { '0': 0.2, '1': 0.5, '2': 0.3 },
            },
        });
        await expectValidationError(decide('some text'));
    });

    test('rejects a score outside the rubric levels → validation', async () => {
        const decide = decider({
            severity: { type: 'score', score: 5, confidence: 0.8, action: { act_probability: 0.4 } },
        });
        await expectValidationError(decide('some text'));
    });

    test('rejects a choice outside the criteria → validation', async () => {
        const decide = decider({
            category: {
                type: 'choice',
                choice: 'feature',
                confidence: 0.6,
                action: { act_probability: 0.4 },
                probabilities: { feature: 1 },
            },
        });
        await expectValidationError(decide('some text'));
    });
});
