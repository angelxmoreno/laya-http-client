import { afterAll } from 'bun:test';

const VALID_BODY = {
    model: 'laya-rl-agent',
    answers: {
        urgent: { type: 'noul', noul: 0.9, confidence: 0.9, action: { act_probability: 0.42 } },
        severity: {
            type: 'score',
            score: 1.4,
            confidence: 0.8,
            action: { act_probability: 0.42 },
            legend: { '0': 'low', '1': 'medium', '2': 'high' },
            probabilities: { '0': 0.2, '1': 0.5, '2': 0.3 },
        },
        department: {
            type: 'choice',
            choice: 'billing',
            confidence: 0.94,
            action: { act_probability: 0.42 },
            probabilities: { billing: 0.7, technical: 0.3 },
        },
    },
    usage: { input_tokens: 12, output_tokens: 0 },
};

/** Start an in-process stand-in for the FastAPI sidecar; sentinel request bodies trigger edge cases. */
export const startMockSidecar = () => {
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

    afterAll(() => {
        server.stop(true);
    });
    return { server, url: server.url.origin };
};
