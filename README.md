# laya-mlx-client

Typed HTTP client for the [Laya](https://github.com/NandhaKishorM/laya) "System 1" decision model over the official `POST /v1/systemone` wire protocol.

Laya answers typed questions about a piece of text (the "state") in a single forward pass (~33 ms), returning calibrated probabilities. This package binds your questions once and returns fully inferred, per-question typed answers.

## Which Laya is this?

Three things share the name, and it matters for compatibility:

| | What it is | HTTP server? |
| --- | --- | --- |
| [Convai Innovations](https://huggingface.co/convaiinnovations/laya) | The model weights (original) | — |
| [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya) | **The official runtime** (`pip install laya`) + `laya[serve]` HTTP server (`laya-serve`, Jev-compatible) | ✅ `POST /v1/systemone` |
| [mizorewww/laya-mlx](https://github.com/mizorewww/laya-mlx) (HF [`aac6fef/laya-mlx`](https://huggingface.co/aac6fef/laya-mlx)) | Independent Apple-MLX port of the checkpoint + `laya_mlx` runtime. Not affiliated with the official project. | ❌ |

This client targets the **official wire protocol** (`laya-serve`'s `/v1/systemone`). The sidecar we vendor wraps `laya_mlx` — the Apple Silicon stand-in for `laya-serve` — and speaks the same protocol, minus the `routing` metadata block (single checkpoint instead of a Router). Wire contract: [docs/SPEC.md](./docs/SPEC.md).

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
        urgent: { type: 'noul', instructions: 'Is this message urgent?' },
        severity: {
            type: 'score',
            instructions: 'How severe is this?',
            criteria: ['low', 'medium', 'high'],
        },
        category: {
            type: 'choice',
            instructions: 'What category?',
            criteria: { billing: 'invoices, refunds', bug: 'errors and crashes', feature: 'new requests' },
        },
    },
});

const result = await triage('My card was charged twice for the same order.');

result.answers.urgent.noul; // P(true) — number
result.answers.severity.score; // expected zero-based rubric level (0..2)
result.answers.category.choice; // 'billing' | 'bug' | 'feature' (literal union)
// result.answers.nonsense -> compile error: wrong key

try {
    await triage('...');
} catch (e) {
    if (isLayaError(e)) {
        e.code; // 'connection' | 'auth' | 'validation' | 'timeout'
    }
}
```

Choice criteria can also be a plain list of labels: `criteria: ['billing', 'bug', 'feature']`.

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