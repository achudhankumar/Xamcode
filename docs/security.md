# XamCode AI — Security Controls

**Version:** 1.0  
**Date:** 08 October 2026  
**Status:** Baseline

---

## 1. Security Headers

| Header | Value | Purpose |
|---|---|---|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer control |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Feature policy |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS enforcement (production) |

## 2. Access Control

| Control | Status |
|---|---|
| Authentication | Implemented (user accounts) |
| Authorization | Per-route (public vs protected) |
| Rate limiting | Implemented (per-IP) |
| Input validation | Server-side validation on API |

## 3. Data Protection

| Control | Status |
|---|---|
| Encryption in transit | HTTPS (HSTS) |
| Encryption at rest | Cloud provider default |
| Secrets management | Environment variables |
| Logging | Request IDs for traceability |

## 4. Incident Response

| Phase | Action |
|---|---|
| Detect | Monitoring alerts |
| Respond | Isolate, investigate |
| Recover | Restore from backup |
| Report | Notify affected users per DPDP |

## 5. Testing

| Test | Frequency |
|---|---|
| Dependency audit | Weekly |
| Security header audit | Continuous |
| Vulnerability scan | Monthly |

---

*End of security controls.*
