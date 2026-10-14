# Free (lifetime, no-credit-card) AI APIs for XamCode — 2026 research

Researched October 2026. Ranked for a small study-app that talks OpenAI-compatible
`/v1/chat/completions` with a Bearer token from its Node server.

## Top 5

| # | Provider | Card? | Free quota | Endpoint | Free model slugs |
|---|----------|-------|-----------|----------|------------------|
| 1 | **Groq** (already configured) | No | `openai/gpt-oss-120b`: 30 RPM, **1,000 req/day**, 200 K tokens/day | `https://api.groq.com/openai/v1/chat/completions` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` |
| 2 | **Google AI Studio / Gemini** (already configured) | No | Metered per model in AI Studio dashboard (RPM/TPD shown there; not a fixed public number, can change) | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` (native, what XamCode uses) + OpenAI-compatible layer at `/v1beta/openai/` | `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` |
| 3 | **Cloudflare Workers AI** | No (free CF account) | **10,000 Neurons/day** (compute-weighted, resets 00:00 UTC) | `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1/chat/completions` | `@cf/meta/llama-3.1-8b-instruct`, `@cf/openai/gpt-oss-120b` |
| 4 | **OpenRouter** (:free models) | No | **50 free-model req/day** on Free plan | `https://openrouter.ai/api/v1/chat/completions` | Any model whose ID ends `:free` — dynamic catalog |
| 5 | **SambaNova** | No | **Only 20 req/day**, 200 K tokens/day — backup only | `https://api.sambanova.ai/v1/chat/completions` | `gpt-oss-120b`, `DeepSeek-V3.1`, `Meta-Llama-3.3-70B-Instruct` |

## Also tested, verdict: don't rely on

- **Mistral La Plateforme** — Free mode without card confirmed, but quota numbers are not publicly documented (account-specific). Worth having on standby.
- **Cerebras** — NOT free anymore: trial requires a verified payment method and expires after 30 days.
- **Hugging Face Inference** — free accounts get **no included monthly credits** under current billing.
- **NVIDIA NIM** — trial/prototyping only; no durable published quota.

## Notes for XamCode's architecture

- Groq + Gemini are already wired in `server.js` with model failover (Groq retries in place on network errors; Gemini rotates keys/models). Adding another OpenAI-compatible provider is a one-line entry in `OPENAI_COMPATIBLE` (see `xai`, `openrouter`, `explabs` entries) — Cloudflare and SambaNova would follow the exact same pattern.
- For Cloudflare you would need `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`; for SambaNova just `SAMBANOVA_API_KEY`.
- Keys live only in `.env` on the server side — never ship them in `js/` client code.
- "Lifetime" here means *ongoing free allocation today*, not a guarantee policy never changes; check each provider's limits page periodically.

## Sources

- Groq rate limits: https://console.groq.com/docs/rate-limits and https://console.groq.com/docs/models
- Gemini limits/pricing/OpenAI-compat: https://ai.google.dev/gemini-api/docs/rate-limits, https://ai.google.dev/gemini-api/docs/billing, https://ai.google.dev/gemini-api/docs/openai
- OpenRouter: https://openrouter.ai/pricing and https://openrouter.ai/docs/api_reference/limits
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/platform/pricing/ and https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- SambaNova: https://docs.sambanova.ai/docs/en/models/rate-limits
- Mistral free mode: https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key
- Cerebras trial policy: https://inference-docs.cerebras.ai/support/rate-limits
- Hugging Face billing: https://huggingface.co/docs/inference-providers/en/pricing
