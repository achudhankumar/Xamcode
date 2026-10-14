# AI Provider Resilience Strategy

**Decision: FREE-ONLY for launch.** No paid failover provider is wired today.
The multi-key Gemini rotation below *is* the resilience move — it is free and
already implemented. A paid document-capable fallback (OpenAI) is documented
here so it can be revisited at launch, but is deliberately **not** enabled now.

---

## 1. The constraint that governs everything: document-capable

The PDF AI reads the **actual PDF bytes**. A provider that cannot ingest a PDF
does not error — it returns a confident, entirely **fabricated** study pack.
So for the PDF feature to survive a Gemini outage you need a provider that can
*read a PDF*, not merely chat.

This is why the pool is split into two chains (`server.js`):

| Chain | Providers | Used by |
|---|---|---|
| **Document-capable** | `gemini` → `explabs` gateway | `/api/analyze` (PDF) |
| **Text-only (all)** | `gemini → groq → xai → openrouter → explabs` | AURA, `/api/ask` |

Text-only providers (`groq`, `xai`, `openrouter`) are marked `documents:false`
on purpose. Routing a PDF there would invent content instead of failing — a
test in `test-provider-failover.js` locks this in ("a PDF never reaches a
text-only provider").

---

## 2. The free resilience move: multi-key Gemini rotation

Google meters the free tier **per key, not per model**. When one key hits its
daily cap, *every* model on that key 429s at once — the "0 of N models ready"
wall. Adding more *model names* adds **zero** quota.

The only free way to multiply capacity is **more independent keys**. On a 429
the server walks every model on key 1, then moves to key 2, then key 3, before
giving up.

```ini
GEMINI_API_KEY=first-account-key
GEMINI_API_KEY_2=second-account-key     # numbered, up to _9
GEMINI_API_KEYS=keyA,keyB,keyC          # or one comma list
```

- Each key is a separate Google account → a separate ~20 req/day/model bucket.
- Get extras at https://aistudio.google.com.
- Verify with `GET /api/quota` → `keys: N`, and `GET /api/providers`.

**Launch target: 3 keys ≈ 3× capacity at $0.**

---

## 3. Layered degradation (what users see if things break)

1. **Normal:** Gemini key 1 answers.
2. **Key 1 out of quota:** auto-rotate to key 2 (invisible to the user).
3. **All Gemini keys out:** explabs gateway (document-capable) takes over PDFs.
4. **No document provider at all:** PDF build returns a clean, honest error —
   never fabricated content.
5. **Text/AURA** stays alive on Groq/xAI/OpenRouter even when every document
   provider is down → the app degrades to "chat only," never fully broken.

---

## 4. Deferred (post-launch): paid document fallback — CODE IS WRITTEN, OFF BY DEFAULT

The OpenAI GPT-4o failover is **already implemented** and ships **disabled**.
It stays completely out of the provider pool until BOTH env vars are set:

```ini
ENABLE_OPENAI_FAILOVER=1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o          # optional, defaults to gpt-4o
```

- A key alone does nothing; the switch alone does nothing. Both required.
- Once on, `openai` is appended **last** (after gemini + explabs), so it is
  reached only when every free document provider is exhausted.
- It uses the OpenAI **Responses API** and sends the PDF inline as an
  `input_file` part — no separate upload step, no new dependency.
- It **bills only on actual failover**, never in normal operation.

**Launch-day enable:** add the two env vars, restart, confirm with
`GET /api/providers` (an `openai` row appears) and `GET /api/quota`.
**Rollback:** set `ENABLE_OPENAI_FAILOVER=0` — the pool returns to free-only
instantly. Covered by `test-provider-failover.js` section 12 (8 tests).

Not recommended as free PDF fallbacks: **Claude** (different wire format, no
free tier), **Hugging Face** (free but cold-start heavy, unreliable for PDF),
**Cohere** (trial only, not PDF-native).

---

## 5. Launch checklist (free-only)

- [ ] Add 2–3 Gemini keys to `.env` (`GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`).
- [ ] `GET /api/quota` shows `keys: 3`.
- [ ] `GET /api/providers` shows gemini + any text fallbacks configured.
- [ ] Confirm the PDF-never-reaches-text-provider test still passes.
- [ ] Monitor `/api/quota` `rotations` — rising rotations = approaching a cap.

*Revisit the paid OpenAI fallback only when observed rotations show the free
keys are regularly exhausted under real load.*
