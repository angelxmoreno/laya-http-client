import { describe } from 'bun:test';
import { runClientConformanceSuite } from '../helpers/client-conformance';

// Smoke tier: real sidecar. Opt-in — runs only when LAYA_SIDECAR_URL is set:
//   LAYA_SIDECAR_URL=http://127.0.0.1:8000 [LAYA_API_KEY=...] bun test tests/smoke
// Sidecars are MLX-backed; a model call can take a while, hence the long timeout.

const url = Bun.env.LAYA_SIDECAR_URL;
const apiKey = Bun.env.LAYA_API_KEY;

describe.skipIf(!url)('smoke: real sidecar', () => {
    // Auth is on iff the env provided a key — exercises the sidecar's 401 path.
    runClientConformanceSuite({ url: url ?? '', apiKey, requiresAuth: !!apiKey, timeout: 30000 });
});
