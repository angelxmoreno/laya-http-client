# Wire contract: `POST /v1/systemone`

The protocol this client speaks. It is the official Laya HTTP wire protocol — the same one served by upstream `laya-serve` (`pip install "laya[serve]"`, Jev-compatible) and by our MLX sidecar. See "Which Laya is this?" in the README for lineage.

## Request

```json
{
    "state": "<string, dict, or conversation>",
    "questions": {
        "<key>": {
            "type": "noul",
            "instructions": "Does the customer ask for money back?"
        },
        "<key>": {
            "type": "score",
            "instructions": "How urgent is this request?",
            "criteria": ["not urgent", "soon", "critical"]
        },
        "<key>": {
            "type": "choice",
            "instructions": "Which department should handle this?",
            "criteria": { "billing": "invoices, payments, refunds", "other": "everything else" }
        }
    }
}
```

Rules (mirrors `laya`/`laya_mlx` server-side validation):

- Every question needs a nonempty `instructions` string.
- `score` criteria: nonempty list of level descriptions, lowest → highest. Every level needs a description (a `null` level is rejected with 422 by `laya-serve`).
- `choice` criteria: nonempty dict (`label → description`) or list of unique string labels.
- `noul` takes no criteria (optional true/false descriptions dict server-side; not needed).

## Response

```json
{
    "model": "laya-rl-agent",
    "answers": {
        "<key>": {
            "type": "noul",
            "confidence": 0.82,
            "action": { "act_probability": 0.41 },
            "noul": 0.86
        },
        "<key>": {
            "type": "score",
            "confidence": 0.71,
            "action": { "act_probability": 0.41 },
            "score": 1.4,
            "legend": { "0": "not urgent", "1": "soon", "2": "critical" },
            "probabilities": { "0": 0.2, "1": 0.5, "2": 0.3 }
        },
        "<key>": {
            "type": "choice",
            "confidence": 0.94,
            "action": { "act_probability": 0.41 },
            "choice": "billing",
            "probabilities": { "billing": 0.7, "other": 0.3 }
        }
    },
    "usage": { "input_tokens": 123, "output_tokens": 0 }
}
```

- Every answer carries `type`, `confidence` and `action.act_probability`.
- `noul` → `noul` = P(true).
- `score` → `score` = expected zero-based rubric level (weighted mean of level probabilities), `legend` = level index → description, `probabilities` keyed by `"0"…".
- `choice` → `choice` = winning label, `probabilities` keyed by label.
- `model` = `"laya-rl-agent"` from single-checkpoint servers; checkpoint name (`"english"` etc.) from `laya-serve`'s Router.

### `routing`

Servers built on `Router` (`laya-serve`, `laya_mlx`'s `Router`) add a `routing` block:

```json
"routing": { "model": "multilingual", "repo": "…", "reason": "non-Latin script (devanagari, 100% of letters)" }
```

Single-checkpoint servers (our sidecar) omit it entirely. The client treats `routing` as optional and passes it through untouched.

## Server behavior notes

- Optional bearer auth: when `LAYA_API_KEY` is set, requests must send `Authorization: Bearer <key>`.
- Option budget: all options share the checkpoint context window (`head_max_len`: 192 tokens on `laya`, 256 on the other checkpoints) — roughly 20 short-description options or 126–254 short labels; overflow is trimmed, and once nothing fits the request is rejected with 422.
- `confidence` on `choice`/`score` answers is 1 − normalized entropy, not Jev's `(n·p_max − 1)/(n − 1)`. Gate on the per-type probability fields instead of thresholds carried over from Jev.

## Out of scope

Batching endpoints (`/predict/batch`), the `model` request-field override, the web playground, fine-tuning, and Bun-only APIs beyond what falls out naturally.