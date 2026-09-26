import { afterAll } from 'bun:test';

const VALID_BODY = {
    answers: { urgent: { probability: 0.9 } },
    usage: { tokens: 3 },
    routing: { model: 'aac6fef/laya-mlx' },
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
