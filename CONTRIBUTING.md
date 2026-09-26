# Contributing

## Setup

```sh
bun install
```

## Development

```sh
bun run lint        # biome check
bun run check:types # tsc
bun run test        # bun test (unit + integration)
```

Hooks run lint + typecheck on commit (lefthook); commit messages must satisfy commitlint (conventional).

## Layout

- `src/` — package source (shipped as-is; no build step)
- `tests/unit/` — fetch-stubbed tests
- `tests/integration/` — real HTTP against an in-process mock sidecar
- `tests/smoke/` — real sidecar; opt-in via `LAYA_SIDECAR_URL` env, skipped when unset
- `tests/helpers/` — shared test fixtures (mock sidecar, conformance suite)

## Commits

Conventional commits; release-please derives the changelog and version from them.