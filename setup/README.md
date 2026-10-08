# AI Agent Setup Guide — Free PDF Generation

**Date:** 08 October 2026  
**Status:** Ready to implement  
**Goal:** Get the XamCode AI PDF generation working for free

---

## 1. Current Architecture

```
Client (browser)
  ↓ (POST /api/analyze)
Server (Node.js)
  ↓ (validate, quota check)
AI Provider Pool (failover)
  ├── Gemini (document-capable) ← REQUIRED for PDF
  ├── Explabs (document-capable) ← fallback
  ├── Groq (text-only)
  ├── xAI Grok (text-only)
  └── OpenRouter (text-only)
  ↓ (JSON response)
Study Pack Generator
  ├── Outline (JSON)
  ├── Flashcards
  ├── Quiz questions
  └── Study materials
```

**Key finding:** PDF analysis requires a document-capable provider. Currently only:
- **Gemini** (free tier available)
- **Explabs** (credit-based, not free)

---

## 2. Required API Keys

### Google Gemini (FREE — Required for PDF)

| Item | Value |
|---|---|
| Sign up | https://aistudio.google.com |
| Free tier | 1,500-10,000 requests/day |
| Model | `gemini-3.8-flash` |
| API key | Go to "API Keys" → Create API Key |

**Why Gemini:** It's the ONLY free provider that accepts PDF uploads inline. Document-capable.

### Groq (FREE — Text-only fallback)

| Item | Value |
|---|---|
| Sign up | https://console.groq.com |
| Free tier | ~1,000 requests/day |
| Model | `llama-3.3-70b-versatile` |
| API key | From console dashboard |

**Use for:** AURA chat and /api/ask (text only, not PDF)

### OpenRouter (FREE — Text-only fallback)

| Item | Value |
|---|---|
| Sign up | https://openrouter.ai |
| Free tier | Low per-day cap, varies |
| API key | From dashboard → Keys |

**Use for:** Text-only fallback when Gemini/Groq exhausted

---

## 3. Configuration Steps

### Step 1: Get Your API Keys

1. Go to https://aistudio.google.com
2. Create a free account
3. Navigate to "API Keys" → "Create API Key"
4. Copy the key (looks like `AIzaSy...`)

5. Go to https://console.groq.com
6. Create account → Dashboard → API Keys
7. Copy the key

8. Go to https://openrouter.ai
9. Create account → API Keys
10. Copy the key

### Step 2: Configure .env

```bash
# Copy the example file
copy .env.example .env

# Edit .env and add your keys:
GEMINI_API_KEY=AIzaSyYourGeminiKeyHere
GROQ_API_KEY=gsk_yourGroqKeyHere
OPENROUTER_API_KEY=sk-or-v1_yourOpenRouterKeyHere
```

### Step 3: Verify Configuration

```bash
# Start the server
node server.js

# In another terminal, check which providers picked up:
curl http://localhost:4173/api/providers
```

Expected response (all keys present):
```json
{
  "gemini": { "configured": true, "models": ["gemini-3.8-flash", ...] },
  "groq": { "configured": true, "model": "llama-3.3-70b-versatile" },
  "xai": { "configured": false },
  "openrouter": { "configured": true },
  "explabs": { "configured": false }
}
```

### Step 4: Test PDF Generation

```bash
# Create a small test PDF
echo "Test content" > test.txt

# Upload it to the server
curl -X POST http://localhost:4173/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"pdfBase64\":\"$(base64 test.txt)\",\"level\":\"standard\"}"

# Should return 202 with jobId
```

### Step 5: Poll for Result

```bash
# Wait for the job to complete (job status changes from 'running' to 'completed')
curl http://localhost:4173/api/analyze/<jobId>

# Should return the study pack JSON
```

---

## 4. Free Provider Comparison

| Provider | PDF capable | Free tier | Cost | Best for |
|---|---|---|---|---|
| **Gemini** | ✅ Yes | 1,500-10K req/day | Free | PDF processing (ONLY free option) |
| **Groq** | ❌ No | ~1K req/day | Free | Text chat, fast responses |
| **OpenRouter** | ❌ No | Varies | Free (low cap) | Text fallback |
| **xAI Grok** | ✅ Yes (file only) | None (paid) | $2-6/1M input tokens | Premium PDF (not free) |
| **Explabs** | ✅ Yes | Credit-based | Paid | Failure fallback |

---

## 5. Troubleshooting

### Issue: "AI_NOT_CONFIGURED"
**Cause:** No API keys configured
**Fix:** Add `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` to .env

### Issue: 429 Rate Limited (Gemini)
**Cause:** Free tier request cap reached
**Fix:** Wait 24 hours or add more models to `GEMINI_MODELS` in .env

### Issue: PDF generation fails on Groq/OpenRouter
**Cause:** These providers are not document-capable
**Fix:** Ensure PDF goes to Gemini. Text-only providers used only for chat.

### Issue: Connection timeout
**Cause:** Server not running or port conflict
**Fix:** `node server.js` and check port 4173

---

## 6. Deployment Options (All Free / nearly free)

| Platform | Free tier | PDF support | Notes |
|---|---|---|---|
| **Render** | 750 hrs/month | Yes (self-hosted) | Easiest |
| **Koyeb** | 1 core, 512MB | Yes (self-hosted) | Good for Node |
| **Fly.io** | 3 shared VMs | Yes (self-hosted) | Lightweight |
| **Railway** | 500 hrs/month | Yes (self-hosted) | Good alternative |
| **Oracle Cloud** | Always Free | Yes (self-hosted) | 2 CPUs, 1GB RAM |

---

## 7. Live Server Performance (Expected)

**With Gemini free tier:**
- PDF processing: 10-30 seconds (contingent on tiers)
- Response time: ~2-5 seconds per 500 pages
- Accuracy: High (95%+) for study packs
- Rate: 1,500-10,000 requests/day (free tier)

**With Groq fallback (text-only for chat):**
- Response time: ~1-3 seconds
- Rate: ~1,000 requests/day

**Total cost:** $0/month

---

## 8. Checklist

- [ ] Create Google AI Studio account
- [ ] Get Gemini API key
- [ ] Create Groq account
- [ ] Get Groq API key
- [ ] Create OpenRouter account
- [ ] Get OpenRouter API key
- [ ] Update .env with keys
- [ ] Start server (`node server.js`)
- [ ] Verify providers (`curl /api/providers`)
- [ ] Test PDF generation
- [ ] Deploy to live server

---

*End of setup guide.*
