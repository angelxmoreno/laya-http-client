import { describe, expect, test } from 'bun:test';
import { createDecider } from '../../src/decider';

// Type-inference contract: answers are inferred from the bound questions, per
// type, with `option` narrowed to the literal choice union. A wrong key must be
// a compile error (`@ts-expect-error` below proves it at check:types time).
const decider = createDecider({
    client: {
        request: async () => ({
            answers: {
                urgent: { probability: 0.9 },
                severity: { score: 7, probability: 0.8 },
                category: { option: 'bug', optionIndex: 1, probability: 0.6 },
            },
            usage: {},
            routing: {},
        }),
    },
    questions: {
        urgent: { type: 'noul', question: 'urgent?' },
        severity: { type: 'score', question: 'severity?', range: [0, 10] },
        category: { type: 'choice', question: 'category?', choices: ['billing', 'bug', 'feature'] },
    },
});

const checkTypes = async () => {
    const result = await decider('state text');

    // exact per-question shapes
    const p: number = result.answers.urgent.probability;
    const s: number = result.answers.severity.score;
    const sp: number = result.answers.severity.probability;
    const option: 'billing' | 'bug' | 'feature' = result.answers.category.option;
    const idx: number = result.answers.category.optionIndex;

    // wrong key is a compile error
    // @ts-expect-error nonexistent question key
    const bad = result.answers.nonexistent;

    // wrong shape is a compile error
    // @ts-expect-error probability is number, not string
    const notNumber: boolean = result.answers.urgent.probability === 'x';

    return { p, s, sp, option, idx, bad, notNumber };
};

describe('type inference', () => {
    test('answers keyed exactly by questions, per-type shapes', async () => {
        const result = await decider('state text');
        expect(Object.keys(result.answers).sort()).toEqual(['category', 'severity', 'urgent']);
        expect(result.answers.urgent).toEqual({ probability: 0.9 });
        expect(result.answers.category.option).toBe('bug');
        await checkTypes();
    });
});
