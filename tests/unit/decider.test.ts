import { describe, expect, test } from 'bun:test';
import type { LayaClient } from '../../src/client';
import { createDecider } from '../../src/decider';
import { isLayaValidationError } from '../../src/errors';
import type { SystemOneResponse } from '../../src/types';

const respondWith = (answers: unknown): LayaClient => ({
    request: async () => ({ answers, usage: {}, routing: {} }) as SystemOneResponse,
});

const decider = (answers: unknown) =>
    createDecider({
        client: respondWith(answers),
        questions: {
            urgent: { type: 'noul', question: 'urgent?' },
            severity: { type: 'score', question: 'severity?', range: [0, 10] },
            category: { type: 'choice', question: 'category?', choices: ['billing', 'bug'] },
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
            urgent: { probability: 0.9 },
            severity: { score: 7, probability: 0.8 },
            category: { option: 'bug', optionIndex: 1, probability: 0.6 },
        });
        const result = await decide('some text');
        expect(result.answers.urgent.probability).toBe(0.9);
        expect(result.answers.category.option).toBe('bug');
    });

    test('rejects a missing answer key → validation', async () => {
        const decide = decider({ urgent: { probability: 0.9 }, severity: { score: 1, probability: 0.5 } });
        await expectValidationError(decide('some text'));
    });

    test('rejects an out-of-range score → validation', async () => {
        const decide = decider({ severity: { score: 11, probability: 0.5 } });
        await expectValidationError(decide('some text'));
    });

    test('rejects an option outside choices → validation', async () => {
        const decide = decider({ category: { option: 'feature', optionIndex: 2, probability: 0.5 } });
        await expectValidationError(decide('some text'));
    });
});
