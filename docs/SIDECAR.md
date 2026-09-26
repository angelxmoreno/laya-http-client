# Sidecar setup: `laya-mlx-http.py`

The FastAPI sidecar (MLX→HTTP bridge) kept in-tree at [`sidecar/laya-mlx-http.py`](../sidecar/laya-mlx-http.py) so client and wire contract evolve together. It turns the Apple-MLX port into a `/v1/systemone` server this client can talk to. This page covers getting it running and testing this package against it.

**What it is:** a thin wrapper around `laya_mlx` (the [independent MLX port](https://github.com/mizorewww/laya-mlx) of Laya) exposing `agent.predict()` over HTTP at the official `POST /v1/systemone` path. It is the Apple Silicon stand-in for upstream's official `laya-serve` server (`pip install "laya[serve]"` — PyTorch, doesn't run on macOS MLX). Same endpoint, same request/response contract; the one difference is `routing`: `laya-serve` routes across three checkpoints and includes a `routing` block, this sidecar runs one checkpoint and omits it. Wire contract: [SPEC.md](./SPEC.md).

## Prerequisites

- **macOS on Apple Silicon** — the runtime is `laya-mlx` (Apple MLX); it does not run on Linux/x86.
- **[uv](https://docs.astral.sh/uv/)** — installs and runs Python deps without touching a venv:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Run

```bash
uv run --with laya-mlx --with fastapi --with "uvicorn[standard]" python sidecar/laya-mlx-http.py
```

Loads the model once at startup (`laya.load(...)`, first run downloads it from Hugging Face) and stays warm. Each forward pass is ~33 ms once loaded.

## Configuration (env vars)

| Var | Default | Notes |
| --- | --- | --- |
| `LAYA_MODEL` | `aac6fef/laya-mlx` | Hugging Face model id |
| `LAYA_DEVICE` | `gpu` | |
| `LAYA_DTYPE` | `float16` | |
| `LAYA_API_KEY` | _(unset)_ | Set to require bearer auth: `Authorization: Bearer <key>` on every request |
| `LAYA_HOST` | `127.0.0.1` | |
| `LAYA_PORT` | `8000` | |

## Endpoints

- `GET /health` — liveness check
- `POST /v1/systemone` — the decision endpoint (wire contract in [SPEC.md](./SPEC.md))

## Smoke test this client against it

```bash
# sidecar running with no auth
LAYA_SIDECAR_URL=http://127.0.0.1:8000 bun test tests/smoke

# sidecar running with LAYA_API_KEY=secret
LAYA_SIDECAR_URL=http://127.0.0.1:8000 LAYA_API_KEY=secret bun test tests/smoke
```

With no `LAYA_API_KEY` on the sidecar, set `requiresAuth` accordingly — the smoke tier skips entirely when `LAYA_SIDECAR_URL` is unset.