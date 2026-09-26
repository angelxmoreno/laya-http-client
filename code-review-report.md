# Code Review Report

Generated from: `git diff main...HEAD` (branch `chore/publishing-prep`, 7 commits, no upstream; working tree clean)
Verification: 5 confirmed, 5 plausible

## 1. Score/choice rejection tests pass for the wrong reason — `tests/unit/decider.test.ts:71` [test-coverage] [CONFIRMED]

**Failure scenario:** `validateAnswers` walks the questions in order, so both fixtures fail on the missing `urgent` answer before the `severity` or `category` refine runs. The score fixture also leaves out `legend` and `probabilities`, so it would fail the base shape check anyway. Break the refine (e.g. `max = q.criteria.length`, off by one) or change `labelsOf` to return `Object.values(...)` for the dict form: the range and label checks are then wrong, and both tests still pass. The dict-form choice path (`criteria: Record<string,string>`) also has no runtime rejection test at all.

### Verdict

- **Agree it's an issue:** yes — `validateAnswers` (src/schemas.ts:92) iterates `Object.entries(questions)` in insertion order (urgent, severity, category), and both rejection fixtures omit `urgent`, so the throw happens at `urgent` before the score/choice refine ever runs; the score fixture also lacks `legend`/`probabilities`.
- **Agree fix now:** yes — tests silently guard the wrong thing; fix is fixture reordering (include all answers or bind only one question per rejection test), cheap and squarely in this diff's scope.
- **Status:** fixed

---

## 2. Package metadata points to a GitHub repo that doesn't exist, while CI publishes with `--provenance` — `package.json:9` [correctness] [CONFIRMED]

**Failure scenario:** `repository.url` is `github.com/angelxmoreno/laya-http-client`, but `git remote` is still `angelxmoreno/laya-mlx-client`. npm checks `repository.url` against the repo recorded in the signed provenance and rejects the publish (E422) if they don't match, so the release job in `release-please.yml:46` fails. If the publish does go through, the npm page's repo, bugs and homepage links are 404s. Rename the GitHub repo before merging, or keep the old URLs.

### Verdict

- **Agree it's an issue:** yes — package.json now reads `"url": "git+https://github.com/angelxmoreno/laya-http-client.git"` while `git remote -v` still points at `laya-mlx-client`; npm provenance validation compares the two at publish time.
- **Agree fix now:** yes — but the fix is the user's planned GitHub-side rename (Settings → repo name), not a code change; must happen before the first release job runs or publish 422s.
- **Status:** fixed

---

## 3. Smoke tier never runs the auth test, and SIDECAR.md tells you to set a flag nothing reads — `tests/smoke/sidecar.smoke.test.ts:12` [test-coverage] [CONFIRMED]

**Failure scenario:** `docs/SIDECAR.md:47-50` says to run the smoke tier against a sidecar with `LAYA_API_KEY=secret` and to "set `requiresAuth` accordingly", but the smoke file never passes `requiresAuth` and no env var feeds it. If the sidecar's `require_auth` breaks or isn't wired up, the smoke tier stays green. Fix: `requiresAuth: !!apiKey`. The integration test that sent a wrong key also went away; only a missing key is tested now.

### Verdict

- **Agree it's an issue:** yes — `sidecar.smoke.test.ts:12` passes `{ url, apiKey, timeout }` with no `requiresAuth`, so the conformance suite's auth test (`client-conformance.ts:63`) is unreachable from the smoke tier while SIDECAR.md:50 promises "set `requiresAuth` accordingly" and nothing reads it.
- **Agree fix now:** yes — one line (`requiresAuth: !!apiKey`); without it the smoke tier can never exercise the 401 path it documents.
- **Status:** fixed

---

## 4. Sidecar returns an uncaught 500 on bad input, and the client reports it as `connection` — `sidecar/laya-mlx-http.py:31` [correctness] [PLAUSIBLE]

**Failure scenario:** `agent.predict` raises `ValueError` on bad criteria or when options overflow the token budget. The sidecar doesn't catch it, so FastAPI returns 500. `docs/SPEC.md:87` promises 422 for that case, and SIDECAR.md says the sidecar has the "same contract" as `laya-serve`. `src/client.ts:56-57` maps every status other than 401/403 to `LayaError('connection')`, so a real 422 from `laya-serve` gets the same label. Callers see their own bad input as an outage and retry. Fix: have the sidecar turn `ValueError` into 422, and have the client map 4xx (422) to `validation`.

### Verdict

- **Agree it's an issue:** yes — `systemone` (sidecar/laya-mlx-http.py:31) is `return agent.predict(req.state, req.questions)` with no try/except, and client.ts:56-57 throws `LayaError('connection')` for every `!response.ok` except 401/403, so a laya-serve 422 (SPEC.md:87 documents it) is mislabeled as an outage.
- **Agree fix now:** yes — two small changes (FastAPI exception handler mapping `ValueError` → 422; client mapping 4xx to `validation`), both in scope and both affect error classification callers rely on.
- **Status:** fixed

---

## 5. Integration conformance can't catch request-shape bugs; the mock ignores the request body — `tests/helpers/mock-server.ts:55` [test-coverage] [CONFIRMED]

**Failure scenario:** The mock always returns the fixed `VALID_BODY`. The conformance assertions (`score <= 2`, legend length 3, `['billing','technical']`) are tuned to that fixture, so they just prove the fixture matches itself. If `requestSchema` or serialization regresses to the old `question`/`range`/`choices` keys, or sends mangled `criteria`, every integration test still passes. The exact-value passthrough checks (`toBe(0.9)`, usage values) were also dropped. Only the opt-in smoke tier would notice.

### Verdict

- **Agree it's an issue:** yes — mock-server.ts:55 is `return new Response(JSON.stringify(VALID_BODY), { status: 200 })` unconditionally; the request body is read at line 41 and then only compared against sentinels, never shape-checked, so a wire-contract regression in `requestSchema`/serialization is invisible until the opt-in smoke tier.
- **Agree fix now:** yes — cheap fix: validate the parsed body against `requestSchema` in the mock (422 on failure), which turns the integration tier into an actual request-shape check; optionally restore exact-value assertions.
- **Status:** fixed

---

## 6. `.npmrc` `provenance=true` breaks any local `npm publish` — `.npmrc:2` [correctness] [PLAUSIBLE]

**Failure scenario:** Provenance needs a supported CI OIDC provider. A maintainer publishing a hotfix from a laptop gets "Automatic provenance generation not supported for provider: null" and the publish aborts. The workflow already passes `--provenance`, so the `.npmrc` line adds nothing and only breaks local publishes. Drop one of the two.

### Verdict

- **Agree it's an issue:** yes — `.npmrc` sets `provenance=true` globally while release-please.yml:46 already runs `npm publish --access public --provenance`; the local publisher gets the OIDC failure without any benefit.
- **Agree fix now:** yes — delete the `.npmrc` (or its line); one-line removal, zero downside.
- **Status:** fixed

---

## 7. First publish of the renamed package can't authenticate over OIDC — `.github/workflows/release-please.yml:46` [correctness] [PLAUSIBLE]

**Failure scenario:** npm trusted publishing is configured per package on npmjs.com, and the package has to exist first. `laya-http-client` has never been published, and the workflow has no `NPM_TOKEN`, so the first release's `npm publish` fails with ENEEDAUTH/404. It needs a manual bootstrap publish, or a one-time token.

### Verdict

- **Agree it's an issue:** yes — no `NPM_TOKEN` in the workflow and OIDC trusted publishing must be configured on npmjs.com for a package that doesn't exist yet, so the first `npm publish` in release-please.yml:46 cannot authenticate.
- **Agree fix now:** no — resolution is manual (npmjs.com trusted-publisher setup or a one-time bootstrap publish), not a code change; worth a CONTRIBUTING note but not blocking code work.
- **Status:** fixed

---

## 8. `state: z.string()` is narrower than the documented and sidecar contract — `src/schemas.ts:7` [correctness] [CONFIRMED]

**Failure scenario:** `docs/SPEC.md:9` documents `state` as "string, dict, or conversation", and the sidecar accepts `state: Any`. The client rejects anything that isn't a string with `LayaError('validation', 'invalid request: expected string')` before sending, and the decider's `(state: string)` signature blocks it at compile time too. Anyone passing a conversation or dict state as the SPEC shows can't use the library. Either widen the schema and type, or narrow the SPEC. Related: SPEC:34 mentions optional noul criteria, which zod silently strips.

### Verdict

- **Agree it's an issue:** yes — schemas.ts:7 is `state: z.string()` while SPEC.md:9 says `"<string, dict, or conversation>"` and the sidecar's `PredictReq` declares `state: Any`; the client over-validates a field the servers accept.
- **Agree fix now:** yes — widen `state` to `z.unknown()` (servers own that validation) and loosen the decider's `state` param type; small, unblocks a documented use case.
- **Status:** fixed

---

## 9. Sidecar runs `predict` on a shared MLX model from threadpool workers with no lock — `sidecar/laya-mlx-http.py:30` [correctness] [PLAUSIBLE]

**Failure scenario:** `def systemone` is a sync handler, so FastAPI runs each call in a threadpool. Two concurrent requests call `agent.predict` on the same MLX model and Metal stream at the same time. MLX isn't documented as thread-safe, so under parallel load this can cause Metal command-buffer errors or wrong results. Fix: put a `threading.Lock` around `predict`. Minor: the bearer check at line 22 uses `!=` rather than `hmac.compare_digest`, which matters if the sidecar is bound to `0.0.0.0`.

### Verdict

- **Agree it's an issue:** yes — `def systemone` (line 30) is a sync def, so uvicorn's threadpool dispatches concurrent calls straight into `agent.predict` on the one shared `agent`; MLX gives no thread-safety guarantee.
- **Agree fix now:** yes — module-level `threading.Lock` around the predict call plus `hmac.compare_digest` for the bearer check are ~3 lines total in a file already in this diff.
- **Status:** fixed

---

## 10. Answer and envelope shapes are written by hand twice (TS types + zod schemas) — `src/types.ts:29` [simplification] [CONFIRMED]

**Failure scenario:** `LayaQuestion`, `AnswerFor`, `LayaUsage`, `Result` and `SystemOneResponse` restate what `schemas.ts` already defines, and `decider.ts:36-38` copies envelope fields by hand. Adding `model` in this diff took matching edits in 4 places. If a field is added to one side only, it compiles and fails only at runtime, because `client.ts` returns `parsed.data` as the declared type. Derive them with `z.infer` and keep only `ChoiceLabel` hand-written. Also, the "Constraint for question-set generics" doc comment (`types.ts:13-17`) now sits above `ChoiceLabel` instead of the constraint it describes.

### Verdict

- **Agree it's an issue:** yes — types.ts hand-writes `LayaQuestion`/`AnswerFor`/`LayaUsage`/`Result` alongside the zod schemas, and types.ts:18's misplaced "Constraint for question-set generics" comment sits above `ChoiceLabel`; the drift risk is real since `client.ts` casts `parsed.data` to the declared type.
- **Agree fix now:** no — pure simplification with no runtime defect today; the z.infer refactor touches the public type surface and deserves its own pass. (Misplaced comment is a one-line cleanup that can ride along whenever this is done.)
- **Status:** fixed

---

## Summary

Five finder agents covered the 8 angles and returned about 36 raw candidates; conventions found nothing, since the global CLAUDE.md rules only cover git and zsh. Deduplication left 22. One was refuted: the claim that the newly required `model`/`usage` envelope would break against the sidecar. The finder checked the cached `laya_mlx` 0.2.0 source, and `agent.predict` returns `{model, answers, usage}`, which matches `responseSchema`. The other 21 survived (CONFIRMED or PLAUSIBLE); the top 10 are kept above, correctness and test coverage first. Cut by the cap (lower severity): per-call re-validation of the fixed question set (validate once at bind time), answer schemas and `labelsOf` rebuilt on every call, a type test that can't catch `ChoiceLabel` collapsing to `never`, the dead `type: z.string()` in `baseAnswer`, answer fixtures copy-pasted across 4 test files, three separate model calls in the conformance suite on the real sidecar, `url ?? ''` in the smoke file, and the sidecar loading the model at import time. Verification was done inline against the code, docs and git remote rather than with a separate verifier agent per candidate.

## Triage Summary

| # | Title | Summary | Verdict | Verdict Reason | Fix | Fix Reason |
|---|---|---|---|---|---|---|
| 1 | Score/choice rejection tests pass for the wrong reason | Rejection-test fixtures omit the first question, so `validateAnswers` throws on the missing answer before the score/choice refine is ever exercised. | Agree | `validateAnswers` iterates questions in insertion order and both fixtures omit `urgent`. | Now (done) | Rejection tests now bind a single question with full-shape fixtures; dict-form choice rejection added. |
| 2 | package.json repo URLs point at an unpublished repo name | package.json URLs name `laya-http-client` while the GitHub repo is still `laya-mlx-client`, so provenance-validated publish fails. | Agree | `repository.url` vs `git remote` mismatch is real at publish time. | Now (done) | User renamed the repo on GitHub; `git remote` URL updated after `ls-remote` verified. |
| 3 | Smoke tier never runs the auth test | Smoke file never passes `requiresAuth`, so the documented 401 test is unreachable and the sidecar's auth could break silently. | Agree | `sidecar.smoke.test.ts:12` omits `requiresAuth` while SIDECAR.md tells users to set it. | Now (done) | `requiresAuth: !!apiKey`; verified live — smoke tier 4/4 against an auth-enabled sidecar. |
| 4 | Sidecar 500s on bad input; client mislabels 422 as connection | `agent.predict` ValueError becomes an uncaught 500, and the client calls every non-401/403 failure a `connection` error. | Agree | No try/except in the sidecar handler; client.ts mapped all other statuses to `connection`. | Now (done) | Sidecar maps ValueError → 422 (verified live: `{"detail":"Question is missing instructions"}` / 422); client maps 422 → `validation` with a unit test. |
| 5 | Mock ignores request body, so integration can't catch wire regressions | Mock returns a fixed fixture without shape-checking the request, hiding serialization/requestSchema regressions. | Agree | Mock reads the body but only matches sentinels, never validates shape. | Now (done) | Mock now validates non-sentinel bodies against `requestSchema` and 422s on failure. |
| 6 | `.npmrc` provenance breaks local publishes | `provenance=true` in `.npmrc` aborts laptop publishes with no OIDC provider; CI already passes `--provenance` explicitly. | Agree | Duplication confirmed; CI flag makes the .npmrc line pure downside. | Now (done) | `.npmrc` deleted. |
| 7 | First publish can't authenticate over OIDC | New package needs npmjs.com trusted-publisher config that can't exist before the package exists. | Agree | Workflow has no NPM_TOKEN and the package doesn't exist yet. | Later (done) | One-time bootstrap documented in CONTRIBUTING.md; the npmjs.com setup itself stays manual. |
| 8 | Client narrows `state` to string beyond the server contract | `state: z.string()` rejects dict/conversation states the SPEC documents and both servers accept. | Agree | Schema is stricter than SPEC.md:9 and the sidecar's `state: Any`. | Now (done) | `state: z.unknown()` in the schema; decider's state param widened to `unknown` — servers own that validation. |
| 9 | Sidecar runs predict concurrently with no lock | Sync handler + threadpool means concurrent calls hit the shared MLX model with no synchronization. | Agree | Sync `def systemone` dispatches to a threadpool around a shared `agent`. | Now (done) | `threading.Lock` around predict; bearer check now uses `hmac.compare_digest`. |
| 10 | TS types duplicate zod schemas by hand | Question/answer/envelope types restate schemas.ts, risking silent drift since client casts `parsed.data`. | Agree | Duplication and the misplaced generic-constraint comment confirmed in types.ts. | Later (done) | `LayaQuestion`/`SystemOneResponse`/`LayaUsage` now derive via `z.infer`; `AnswerFor` maps the exported `Noul/Score/ChoiceAnswer` inferences; only the `ChoiceLabel`/mapped-type machinery stays hand-written; misplaced comment fixed. |
