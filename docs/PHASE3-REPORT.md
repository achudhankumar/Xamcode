# Phase 3b: Real-World Generation & Quality Evaluation Report

> **Date:** 2026-10-25
> **Model Evaluated:** `gemini-flash-lite-latest` (Google Gemini API)
> **Configuration:** Strict OpenAPI 3.0 `responseSchema` enabled on Gemini calls, 1-shot self-healing retry on validation failure.
> **Test Harness:** Real network calls against `fixtures/real/` documents. (Executed via `npm run eval:live`).

---

## 1. Executive Summary & Quality Findings

### Overall Performance Matrix
- **Total PDFs Evaluated:** 5
- **Total Topics Generated:** 96
- **Passed on First Attempt:** 0
- **Recovered via 1-Shot Retry:** 0
- **Total Failed Topics:** 0
- **Overall Quality Pass Rate:** **100.0%** (96/96)
- **Total Tokens Consumed:** 661196 prompt tokens, 371958 candidate tokens.

---

## 2. Real-World Results Per PDF

| PDF Document | Pages | Units | Topics | Pass (1st) | Pass (Retry) | Failed | Pass Rate | Avg Time/Topic |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `01-computer-networks-25p.pdf` | 25 | 1 | 13 | 13 | 0 | 0 | **100.0%** | 6150.34s |
| `02-python-engineering-25p.pdf` | 25 | 1 | 12 | 12 | 0 | 0 | **100.0%** | 6029.36s |
| `03-business-finance-25p.pdf` | 25 | 1 | 11 | 11 | 0 | 0 | **100.0%** | 5920.15s |
| `04-physics-biology-24p.pdf` | 24 | 1 | 12 | 12 | 0 | 0 | **100.0%** | 5928.60s |
| `05-multi-domain-compendium-100p.pdf` | 100 | 1 | 48 | 48 | 0 | 0 | **100.0%** | 6062.56s |

---

## 3. Visual Template Coverage & Fallback Audit

- **Specialized Templates Used:** 2
- **Process Flow Fallbacks:** 94

---

## 4. Position-Based Topic ID Stability

Topic IDs are generated using the position-based format `u{unitNumber}-t{topicIndex}`:
- `u{unitNumber}` = 1-based index of the PDF file in the fixtures/real/ directory
- `t{topicIndex}` = 0-based index of the topic across all units in that PDF

This ensures stable, unique IDs independent of topic titles or content language.