# XamCode AI — Deployment Guide

**Version:** 1.0  
**Date:** 08 October 2026  
**Status:** Baseline

---

## 1. Overview

XamCode AI is deployed as a Node.js application with static frontend assets.

## 2. Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| Operating system | Windows / Linux / macOS |

## 3. Installation

```bash
# Clone repository
git clone https://github.com/xamcode/xamcode-ai.git
cd xamcode

# Install dependencies
npm install

# Start development server
npm start

# Run test suite
npm test
```

## 4. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV=production` enables HSTS and security hardening |

## 5. Build Process

1. Frontend assets are committed to the repository
2. Node.js server starts on the configured port
3. Static files served from the working directory
4. API routes handled by Express/Fastify router

## 6. Deployment Checklist

| Step | Done |
|---|---|
| Run test suite | ☐ |
| Verify environment variables | ☐ |
| Set `NODE_ENV=production` | ☐ |
| Enable HTTPS | ☐ |
| Configure HSTS | ☐ |
| Set up monitoring | ☐ |
| Deploy to cloud | ☐ |

## 7. Rollback Procedure

1. Revert to previous commit: `git revert HEAD`
2. Restart server
3. Verify health endpoint `/api/health`

---

*End of deployment guide.*
