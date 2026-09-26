import { describe, expect, test } from 'bun:test';
import { createDecider } from '../../src/decider';

// Type-inference contract: answers are inferred from the bound questions, per
// type, with `choice` narrowed to the literal label union. A wrong key must be
// a compile error (`@ts-expect-error` below proves it at check:types time).
const decider = createDecider({
    client: {
        request: async () => ({
            model: 'laya-rl-agent',
            answers: {
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
            },
            usage: { input_tokens: 5, output_tokens: 0 },
        }),
    },
    questions: {
        urgent: { type: 'noul', instructions: 'urgent?' },
        severity: { type: 'score', instructions: 'severity?', criteria: ['low', 'medium', 'high'] },
        category: {
            type: 'choice',
            instructions: 'category?',
            criteria: { billing: 'money', bug: 'errors', feature: 'requests' },
        },
    },
});

const checkTypes = async () => {
    const result = await decider('state text');

    // exact per-question shapes
    const p: number = result.answers.urgent.noul;
    const s: number = result.answers.severity.score;
    const choice: 'billing' | 'bug' | 'feature' = result.answers.category.choice;
    const u: { input_tokens: number; output_tokens: number } = result.usage;

    // wrong key is a compile error
    // @ts-expect-error nonexistent question key
    const bad = result.answers.nonexistent;

    // wrong shape is a compile error
    // @ts-expect-error noul is number, not string
    const notNumber: boolean = result.answers.urgent.noul === 'x';

    return { p, s, choice, u, bad, notNumber };
};

describe('type inference', () => {
    test('answers keyed exactly by questions, per-type shapes', async () => {
        const result = await decider('state text');
        expect(Object.keys(result.answers).sort()).toEqual(['category', 'severity', 'urgent']);
        expect(result.answers.urgent.noul).toBe(0.9);
        expect(result.answers.category.choice).toBe('bug');
        expect(result.model).toBe('laya-rl-agent');
        await checkTypes();
    });
});
