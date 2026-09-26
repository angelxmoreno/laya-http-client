import { LayaError } from './LayaError';
import { responseSchema } from './schemas';
import type { ClientOptions, SystemOneResponse } from './types';

const DEFAULT_URL = 'http://127.0.0.1:8000';
const DEFAULT_TIMEOUT_MS = 3000;
const V1_SYSTEMONE = '/v1/systemone';

/**
 * Thin transport for a Laya HTTP server (`/v1/systemone` — laya-serve or the
 * vendored MLX sidecar). Returns the parsed (envelope-validated) JSON. Throws
 * `LayaError` on any transport-level failure.
 */
export const createClient = (options: ClientOptions = {}) => {
    const baseUrl = options.url ?? DEFAULT_URL;
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

    const request = async (body: unknown): Promise<SystemOneResponse> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        // Race a reject against fetch so the timeout holds even when the
        // transport ignores the abort signal (ponytail: covers mock fetch in tests).
        const timeout = new Promise<never>((_, reject) => {
            const raceTimer = setTimeout(
                () => reject(new LayaError('timeout', `request timed out after ${timeoutMs}ms`)),
                timeoutMs + 1
            );
            raceTimer.unref?.();
        });
        let response: globalThis.Response;
        try {
            response = await Promise.race([
                fetch(new URL(V1_SYSTEMONE, baseUrl), {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: controller.signal,
                }),
                timeout,
            ]);
        } catch (e) {
            clearTimeout(timer);
            if (e instanceof LayaError && e.code === 'timeout') throw e;
            if (e instanceof DOMException && e.name === 'AbortError') {
                throw new LayaError('timeout', `request timed out after ${timeoutMs}ms`);
            }
            throw new LayaError('connection', `could not reach Laya server at ${baseUrl}`, { cause: e });
        }
        clearTimeout(timer);

        if (response.status === 401 || response.status === 403) {
            throw new LayaError('auth', `Laya server rejected credentials (HTTP ${response.status})`);
        }
        // laya-serve and the sidecar return 422 for requests the model rejects
        // (bad criteria, option-budget overflow) — that's caller input, not an outage.
        if (response.status === 422) {
            throw new LayaError('validation', 'Laya server rejected the request (HTTP 422)');
        }
        if (!response.ok) {
            throw new LayaError('connection', `Laya server returned HTTP ${response.status}`);
        }

        let raw: unknown;
        try {
            raw = await response.json();
        } catch (e) {
            throw new LayaError('validation', `Laya server response is not valid JSON`, { cause: e });
        }
        const parsed = responseSchema.safeParse(raw);
        if (!parsed.success) {
            throw new LayaError(
                'validation',
                `malformed Laya server response: ${parsed.error.issues[0]?.message ?? 'invalid'}`
            );
        }
        return parsed.data;
    };

    return { request };
};

export type LayaClient = ReturnType<typeof createClient>;
