# XamCode AI — System Architecture

**Version:** 1.0  
**Date:** 08 October 2026  
**Status:** Baseline documentation

---

## 1. Overview

XamCode AI is a web application that converts uploaded PDFs into interactive study materials (flashcards, quizzes, Q&A) using AI.

## 2. Architecture Diagram (Textual)

```
                         ┌──────────────┐
                         │  User Browser │
                         └──────┬───────┘
                                │ HTTPS
                                ▼
                      ┌──────────────────┐
                      │   Load Balancer   │
                      └────────┬─────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │   Frontend   │  │  Backend API │  │  Static Files│
      │  (React/Vanil│  │ (Node.js/Exp│  │  (CSS/JS/HTML)│
      │   Ique)      │  │   res)       │  │              │
      └──────────────┘  └──────────────┘  └──────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  AI Service      │
                      │ (Google Gemini)  │
                      └──────────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Database        │
                      │ (User/progress)  │
                      └──────────────────┘
```

## 3. Components

| Component | Technology | Purpose |
|---|---|---|
| Frontend | HTML/CSS/JS (vanilla) | Presentation layer |
| Styling | CSS (theme system) | UI theming |
| Backend | Node.js | HTTP server, API routes |
| Router | Native `http` module | Request routing |
| AI Service | Google Gemini | Study content generation |
| Storage | Local / cloud | PDF uploads, transcripts |
| Analytics | Google Analytics | Usage tracking |

## 4. Data Flow

1. User uploads PDF via browser
2. Browser POSTs to `/api/analyze`
3. Backend validates and queues job
4. AI service processes PDFs
5. Results returned to frontend
6. User interacts with generated content

## 5. Key Routes

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Home page |
| `/privacy-policy` | GET | Privacy Policy |
| `/terms-of-service` | GET | Terms of Service |
| `/accessibility-statement` | GET | Accessibility Statement |
| `/robots.txt` | GET | Crawler instructions |
| `/sitemap.xml` | GET | XML sitemap |
| `/api/health` | GET | Liveness probe |
| `/api/analyze` | POST | PDF analysis |
| `/api/ask` | POST | AI chat |
| `/api/quota` | GET | Usage quota |

## 6. Security Controls

| Control | Implementation |
|---|---|
| CSP | Header via `X-Content-Type-Options` |
| Frame protection | X-Frame-Options: DENY |
| MIME sniffing | X-Content-Type-Options: nosniff |
| XSS protection | X-XSS-Protection |
| Rate limiting | Per-IP rate limiter |
| HTTPS | HSTS (production) |
| Sensitive headers | Permissions-Policy |

## 7. Deployment

| Environment | Branch | Validation |
|---|---|---|
| Development | main | Test suite |
| Staging | main | Full test matrix |
| Production | main | CI/CD pipeline |

---

*End of architecture document.*
