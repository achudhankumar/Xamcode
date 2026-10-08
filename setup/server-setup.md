# Server Setup Guide — Free Deployment

**Date:** 08 October 2026  
**Status:** Ready to implement  
**Goal:** Deploy XamCode AI server with free/no-cost hosting

---

## 1. Server Architecture

```
┌─────────────────┐
│  Client Browser  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Load Balancer  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node.js Server  │
│  (server.js)     │
└────────┬────────┘
         │
    ┌────┼────┐
    ▼    ▼    ▼
  Gemini  Groq  OpenRouter
  (PDF)   (Text)  (Text)
```

---

## 2. Deployment Options

### Option A: Render (Recommended)

| Item | Value |
|---|---|
| Sign up | https://render.com |
| Free tier | 750 hours/month (24/7) |
| Region | Oregon, Frankfurt, or Singapore |
| Setup | Connect GitHub repo → add env vars → deploy |

**Steps:**
1. Push code to GitHub
2. Go to Render → "New +" → "Web Service"
3. Connect repository
4. Set build command: `npm install`
5. Set start command: `node server.js`
6. Add environment variables:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `GEMINI_API_KEY=...`
   - `GROQ_API_KEY=...` (optional)
   - `OPENROUTER_API_KEY=...` (optional)
7. Deploy

**Cost:** ~$0/month (free tier)

### Option B: Koyeb

| Item | Value |
|---|---|
| Sign up | https://koyeb.com |
| Free tier | 1 core, 512MB RAM |
| Region | Paris, San Francisco, Singapore |
| Setup | GitHub integration → configure |

**Steps:**
1. Connect GitHub repo
2. Add build command: `npm install --production`
3. Add start command: `node server.js`
4. Add env vars (same as Render)
5. Deploy

**Cost:** ~$0/month

### Option C: Oracle Cloud (Always Free)

| Item | Value |
|---|---|
| Sign up | https://cloud.oracle.com |
| Free tier | 2 CPUs, 1GB RAM, 48GB SSD |
| Region | Any (US East/West recommended) |
| Setup | Create VM → install Node |

**Steps:**
1. Create VM (always free)
2. SSH into VM
3. Install Node.js: `sudo yum install nodejs`
4. Clone repo: `git clone <repo>`
5. Install: `npm install`
6. Copy .env: `cp .env.example .env`
7. Set env vars
8. Start: `node server.js`

**Cost:** ~$0/month

---

## 3. Environment Configuration

```bash
# Required for all environments
NODE_ENV=production
PORT=10000
TRUST_PROXY=true

# PDF generation (free tier)
GEMINI_API_KEY=AIzaSyYourGeminiKeyHere
GEMINI_MODELS=gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash

# Optional free fallbacks
GROQ_API_KEY=gsk_YourGroqKeyHere
OPENROUTER_API_KEY=sk-or-v1_YourKeyHere

# Settings
PDF_GENERATIONS_PER_DAY=5
MAX_REQUESTS_PER_HOUR=60
MAX_PDF_MB=20
```

---

## 4. Server Performance Checklist

| Check | Status |
|---|---|
| Server binds to 0.0.0.0 | ✓ |
| HTTPS enabled | ✓ (behind load balancer) |
| Security headers configured | ✓ (X-Frame-Options, etc.) |
| Rate limiting active | ✓ |
| PDF quota enforced | ✓ (5/day per IP) |
| AI provider failover | ✓ (Gemini → Groq → OpenRouter) |
| Log rotation | ✓ (use pm2 or similar) |

---

## 5. Monitoring

```bash
# Check server health
curl http://localhost:10000/api/health

# Check provider status
curl http://localhost:10000/api/providers

# Check quota
curl http://localhost:10000/api/quota
```

**Key metrics to watch:**
- Response time (should be < 2s for chat, < 30s for PDF)
- PDF generation rate (1,500-10,000/day free)
- Error rate
- Quota consumption

---

## 6. Cost Breakdown

| Component | Cost |
|---|---|
| Server hosting | $0 (free tier) |
| Google Gemini | $0 (1,500-10K req/day) |
| Groq | $0 (~1K req/day) |
| OpenRouter | Varies (low cap) |
| **Total** | **$0/month** |

---

## 7. Deployment Checklist

- [ ] Choose hosting platform (Render/Koyeb/Oracle)
- [ ] Push code to GitHub
- [ ] Create account on hosting platform
- [ ] Connect GitHub repository
- [ ] Add environment variables
- [ ] Deploy
- [ ] Verify server health (curl /api/health)
- [ ] Test PDF generation
- [ ] Monitor for 24 hours
- [ ] Set up basic logging

---

## 8. Troubleshooting

### Server not accessible
**Cause:** Not binding to 0.0.0.0
**Fix:** Set `NODE_ENV=production`

### PDF generation fails
**Cause:** No API keys or rate limit
**Fix:** Check `GEMINI_API_KEY` and quota

### Server times out
**Cause:** Free tier limits
**Fix:** Check logs, adjust PDF_GENERATIONS_PER_DAY

---

*End of server setup guide.*
