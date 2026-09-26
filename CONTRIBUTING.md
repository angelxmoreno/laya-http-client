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

## First release (one-time bootstrap)

The release workflow publishes via OIDC trusted publishing (no `NPM_TOKEN`), but npm can only configure a trusted publisher for a package that already exists. So `laya-http-client`'s very first release needs a manual bootstrap — pick one:

- Publish once locally (`npm publish --access public --provenance` won't work from a laptop; plain `npm publish --access public` with a login is fine for the bootstrap), then enable Trusted Publishing for the package on npmjs.com (Settings → Publishing access → add this GitHub repo + workflow `release.yml`).
- Or create a granular `NPM_TOKEN` and add it as the repo secret just for the first run, then delete it.

Every release after that works automatically.