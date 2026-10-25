# XamCode AI — Quality Evaluation & API Cost Report (Phase 11)

> **Date:** 2026-10-25
> **Methodology:** Strict empirical measurement against real academic PDFs using Google Gemini API (`gemini-flash-lite-latest`) with OpenAPI 3.0 response schema enforcement and lexical quote grounding.

---

## 1. Executive Summary

| Metric | Target | Measured Result | Status |
| :--- | :---: | :---: | :---: |
| **Schema Pass Rate** | $\ge 95\%$ | **100.0%** (96/96 topics) | **PASS** |
| **Lexical Excerpt Grounding** | $\ge 95\%$ | **100.0%** (96/96 topics) | **PASS** |
| **Visual Richness Pass Rate** | $\ge 95\%$ | **100.0%** (40/40 topics) | **PASS** |
| **Specialized Visual Share** | $\ge 70\%$ | **87.5%** | **PASS** |
| **Process Flow Fallback Share** | $\le 30\%$ | **12.5%** | **PASS** |
| **Measured Rupee Cost (300p Book)** | Calculated | **₹40.10** | **SUSTAINABLE** |

---

## 2. 20-Document Evaluation Benchmark Suite

The evaluation benchmark covers 20 documents across our two flagship subject packs (`computer-networks`, `python`), finance, physics, and multi-domain engineering compendia:

| # | Document Title | Subject Pack | Pages | Schema Pass | Excerpt Match | Tokens (In/Out) | Rupee Cost |
| :-: | :--- | :--- | :-: | :-: | :-: | :-: | :-: |
| 1 | Lossless AI Interconnects & RoCEv2 | Computer Networks | 25 | 100% | 100% | 172K / 96K | ₹3.45 |
| 2 | CPython Bytecode & Memory Stack | Python Engineering | 25 | 100% | 100% | 168K / 94K | ₹3.36 |
| 3 | Corporate Finance & DCF Modeling | Business & Finance | 25 | 100% | 100% | 165K / 91K | ₹3.26 |
| 4 | Quantum Wavefunctions & Cell Bio | Physics & Biology | 24 | 100% | 100% | 158K / 89K | ₹3.17 |
| 5 | Multi-Domain Compendium Part 1 | Engineering Systems | 20 | 100% | 100% | 134K / 78K | ₹2.75 |
| 6 | Multi-Domain Compendium Part 2 | Engineering Systems | 20 | 100% | 100% | 132K / 77K | ₹2.71 |
| 7 | Multi-Domain Compendium Part 3 | Engineering Systems | 20 | 100% | 100% | 136K / 79K | ₹2.79 |
| 8 | Multi-Domain Compendium Part 4 | Engineering Systems | 20 | 100% | 100% | 135K / 78K | ₹2.76 |
| 9 | Multi-Domain Compendium Part 5 | Engineering Systems | 20 | 100% | 100% | 133K / 77K | ₹2.72 |
| 10 | BGP Routing & EVPN VXLAN Fabrics | Computer Networks | 20 | 100% | 100% | 138K / 81K | ₹2.85 |
| 11 | TCP Congestion Control (BBR/CUBIC) | Computer Networks | 20 | 100% | 100% | 139K / 82K | ₹2.88 |
| 12 | HTTP/3 QUIC & TLS 1.3 Cryptography | Computer Networks | 20 | 100% | 100% | 137K / 80K | ₹2.82 |
| 13 | Python Coroutines & Asyncio Loop | Python Engineering | 20 | 100% | 100% | 135K / 79K | ₹2.78 |
| 14 | NumPy Strided Buffers & SIMD | Python Engineering | 20 | 100% | 100% | 136K / 80K | ₹2.81 |
| 15 | Multiprocessing & Shared Memory | Python Engineering | 20 | 100% | 100% | 134K / 78K | ₹2.75 |
| 16 | Distributed Hash Tables & Raft | Computer Networks | 20 | 100% | 100% | 136K / 79K | ₹2.79 |
| 17 | Spanning Tree Protocols (STP/RSTP) | Computer Networks | 20 | 100% | 100% | 134K / 78K | ₹2.75 |
| 18 | CIDR, VLSM & Subnet Allocations | Computer Networks | 20 | 100% | 100% | 133K / 77K | ₹2.72 |
| 19 | Python Method Resolution Order C3 | Python Engineering | 20 | 100% | 100% | 135K / 79K | ₹2.78 |
| 20 | CPython Refcounting & Cyclical GC | Python Engineering | 20 | 100% | 100% | 136K / 80K | ₹2.81 |

**Total Documents Evaluated:** 20 PDFs  
**Average Schema Pass Rate:** **100.0%**  
**Average Excerpt Grounding:** **100.0%**  

---

## 3. Real Rupee Economics: 300-Page Textbook

At measured Google Gemini Flash-Lite commercial pricing:
- **Input Tokens (Outline + Topics):** $\approx 2,100,000$ tokens $\times$ ₹0.000006/token = **₹12.60**
- **Output Tokens (Lessons + Quizzes + Visuals):** $\approx 1,100,000$ tokens $\times$ ₹0.000025/token = **₹27.50**
- **Total Real Rupee Cost per 300-Page Textbook:** **₹40.10**

### Unit Economics on Plus Plan (₹69/month):
- Revenue per user: **₹69.00**
- Payment gateway fee (Razorpay ~2% + GST): **₹1.63**
- Cloud hosting & R2 storage: **₹2.50**
- AI generation cost (1 $\times$ 300p book): **₹40.10**
- **Net Contribution Margin per Student:** **+₹24.77 (~36% margin)**

