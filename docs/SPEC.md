# Build prompt: `laya-mlx-client`

Build a Bun TypeScript npm package called `laya-mlx-client`. It is a typed HTTP client for the Laya "System 1" decision model, talking to a local FastAPI sidecar.

## Context

- Laya is a non-autoregressive decision model. It answers *typed* questions about a piece of text (the "state") in a single forward pass (~33 ms), returning calibrated probabilities.
- The runtime is `laya-mlx` (Apple MLX).
- We already built the backend ourselves: a FastAPI sidecar called **`laya-mlx-http.py`** (see below). This package is the *client* for that server. Do not rebuild or replace the server — it is the source of truth for the wire format.

## The backend: `laya-mlx-http.py`

This is the server this client talks to. It exists and is already running. Key facts:

- Built with FastAPI + uvicorn, run via `uv run --with laya-mlx --with fastapi --with "uvicorn[standard]" python laya-mlx-http.py`.
- Loads the model once at startup via `laya.load(...)`, then stays warm.
- Endpoints:
    - `GET /health` — liveness check.
    - `POST /v1/systemone` — the decision endpoint.
- `POST /v1/systemone` request body: `{ "state": string, "questions": { ... } }`.
- `POST /v1/systemone` response body: `{ "answers": { ... }, "usage": { ... }, "routing": { ... } }`.
- Optional bearer auth via an API key.
- Configurable via env vars: `LAYA_MODEL` (default `aac6fef/laya-mlx`), `LAYA_DEVICE` (default `gpu`), `LAYA_DTYPE` (default `float16`), `LAYA_API_KEY` (optional), `LAYA_HOST` (default `127.0.0.1`), `LAYA_PORT` (default `8000`).

Match the client to this exact contract. If the server is in the repo, use it to test against.

## Follow this repo's existing conventions

Use this repo's own TypeScript config, lint/format tooling, test runner, package layout, and publishing flow. Do not introduce new tooling; match the surrounding code. If a convention is ambiguous, choose the most common Bun/TS default and note the assumption in your commit message.

## Question types (mirror these three, nothing more)

- `noul` — yes/no. `{ type: "noul", question: string }` → answer `{ probability: number }` (P(true)).
- `score` — ordinal. `{ type: "score", question: string, range: [number, number] }` → answer `{ score: number, probability: number }`.
- `choice` — pick one. `{ type: "choice", question: string, choices: readonly string[] }` → answer `{ option: string, optionIndex: number, probability: number }`.

## Public API (three pieces)

1. `createClient({ url?, apiKey?, timeout? })` — thin transport. Does the raw `POST /v1/systemone` and returns the parsed JSON. Defaults: `url` → `http://127.0.0.1:8000`, `timeout` → `3000` ms.
2. `createDecider({ client? | url?, apiKey?, timeout?, questions })` — the factory. Accepts either a `client` or the `url`/`apiKey`/`timeout` to build one internally. Binds `questions` once. Returns a function.
3. The returned function: `(state: string) => Promise<Result>` — the state is the text; questions are never repeated.

## Types — the core requirement

- **Answer types must be inferred from the questions object**, not annotated by the caller. Use a conditional type mapping each question `type` to its answer shape (with `infer` on `choices` so `option` narrows to the literal union of the choices), then a mapped type over the questions object. Result: `triage("…")` returns an object whose keys are exactly the question keys and whose values have the precise per-question shape. A misspelled key must be a compile error.
- `Result` is a wrapper: `{ answers: Answers<typeof questions>, usage: unknown, routing: unknown }`.
- **Always typed, never `any`** on the public surface.

## Validation

- Use `zod` on both sides. Validate outgoing `state`/`questions` before sending, and validate the incoming response against the expected schema before returning. A malformed response is a `validation` error.

## Errors — throw typed errors, narrow by `code` (not `instanceof`)

- A `LayaError` (extends `Error`) with a `readonly code` field: `"connection" | "auth" | "validation" | "timeout"`.
- Type guards: `isLayaError(e)`, plus one per code (e.g. `isLayaValidationError`), narrowing on `e.code` so it survives serialization/bundling.

## Explicitly out of scope (do not add)

- Batching (the MLX runtime has no multi-state batching).
- Any Bun-only APIs unless one is genuinely the natural fit — stay standard and portable; note in the commit if you used one.
- Accuracy/fine-tuning concerns.

## Deliverables

- The three functions, the inferred types, the zod schemas, the error classes + guards, and a short README with one usage example (`createDecider` → call → typed result).
- Tests for: the type inference (a wrong key should be a type error), zod rejecting a malformed response, and each error `code` mapping to the right failure.
- Make it publishable: correct `package.json` (`type: "module"`, exports, types entry, Bun-compatible), matching this repo's release conventions.
