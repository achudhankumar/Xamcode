# Phase 3b: Real-World Generation & Quality Evaluation Report

> **Date:** 2026-10-23
> **Model Evaluated:** `gemini-flash-lite-latest` (Google Gemini API)
> **Configuration:** Strict OpenAPI 3.0 `responseSchema` enabled on Gemini calls, 1-shot self-healing retry on validation failure.
> **Test Harness:** Real network calls against `fixtures/real/` documents. (Executed via `npm run eval:live`).

---

## 1. Executive Summary & Quality Findings

### Overall Performance Matrix
- **Total PDFs Evaluated:** 5
- **Total Topics Generated:** 19
- **Passed on First Attempt:** 0
- **Recovered via 1-Shot Retry:** 0
- **Total Failed Topics:** 19
- **Overall Quality Pass Rate:** **0.0%** (0/19)
- **Total Tokens Consumed:** 106408 prompt tokens, 125526 candidate tokens.

---

## 2. Real-World Results Per PDF

| PDF Document | Pages | Units | Topics | Pass (1st) | Pass (Retry) | Failed | Pass Rate | Avg Time/Topic |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `01-computer-networks.pdf` | 3 | 1 | 3 | 0 | 0 | 3 | **0.0%** | 9049.39s |
| `02-operating-systems.pdf` | 3 | 1 | 5 | 0 | 0 | 5 | **0.0%** | 7823.62s |
| `03-data-structures.pdf` | 3 | 1 | 3 | 0 | 0 | 3 | **0.0%** | 9880.94s |
| `04-database-systems.pdf` | 3 | 1 | 3 | 0 | 0 | 3 | **0.0%** | 8683.06s |
| `05-software-engineering.pdf` | 3 | 1 | 5 | 0 | 0 | 5 | **0.0%** | 5921.89s |

---

## 3. Visual Template Coverage & Fallback Audit

- **Specialized Templates Used:** 0
- **Process Flow Fallbacks:** 0

---

## 4. Position-Based Topic ID Stability

Topic IDs are generated using the position-based format `u{unitNumber}-t{topicIndex}`:
- `u{unitNumber}` = 1-based index of the PDF file in the fixtures/real/ directory
- `t{topicIndex}` = 0-based index of the topic across all units in that PDF

This ensures stable, unique IDs independent of topic titles or content language.