# laya-mlx-client

Typed HTTP client for the [Laya](https://huggingface.co/aac6fef/laya-mlx) "System 1" decision model, talking to the `laya-mlx-http.py` FastAPI sidecar.

Laya answers typed questions about a piece of text (the "state") in a single forward pass (~33 ms), returning calibrated probabilities. This package binds your questions once and returns fully inferred, per-question typed answers.

## Install

```bash
bun add laya-mlx-client
```

## Usage

```ts
import { createDecider, isLayaError } from 'laya-mlx-client';

const triage = createDecider({
    url: 'http://127.0.0.1:8000',
    questions: {
        urgent: { type: 'noul', question: 'Is this message urgent?' },
        severity: { type: 'score', question: 'How severe is this?', range: [0, 10] },
        category: { type: 'choice', question: 'What category?', choices: ['billing', 'bug', 'feature'] },
    },
});

const result = await triage('My card was charged twice for the same order.');

result.answers.urgent.probability; // P(true) — number
result.answers.severity.score; // 0-10
result.answers.category.option; // 'billing' | 'bug' | 'feature' (literal union)
// result.answers.nonsense -> compile error: wrong key

try {
    await triage('...');
} catch (e) {
    if (isLayaError(e)) {
        e.code; // 'connection' | 'auth' | 'validation' | 'timeout'
    }
}
```

## API

- `createClient({ url?, apiKey?, timeout? })` — thin transport for the raw `POST /v1/systemone`. Defaults: `http://127.0.0.1:8000`, 3000 ms.
- `createDecider({ client? | url?, apiKey?, timeout?, questions })` — binds questions once, returns `(state: string) => Promise<Result>`.
- Errors: throws `LayaError` with a `code` field; narrow with `isLayaError` and per-code guards (`isLayaConnectionError`, `isLayaAuthError`, `isLayaValidationError`, `isLayaTimeoutError`).

## Running the sidecar

See [docs/SIDECAR.md](./docs/SIDECAR.md) — prerequisites, env config, and running the smoke tests against a real sidecar.

## Smoke tests

The smoke tier runs the shared conformance suite against a real sidecar; it is skipped unless `LAYA_SIDECAR_URL` is set:

```bash
LAYA_SIDECAR_URL=http://127.0.0.1:8000 bun test tests/smoke
```

## License

MIT — see [LICENSE](./LICENSE).