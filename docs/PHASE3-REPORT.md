# Phase 3b: Real-World Generation & Quality Evaluation Report

> **Date:** 2026-10-24
> **Model Evaluated:** `gemini-flash-lite-latest` (Google Gemini API)
> **Configuration:** Strict OpenAPI 3.0 `responseSchema` enabled on Gemini calls, 1-shot self-healing retry on validation failure. System instruction requires `unitTitle`, `title`, `topic`, `pdfQuote`, `explanation`, `keyPoints`, `steps`, `visual.type`, `cheatcode`, and `questions` with 4-choice options.
> **Test Harness:** Real network calls against `fixtures/real/` documents. (Executed via `npm run eval:live`).

---

## 1. Executive Summary & Quality Findings

### Overall Performance Matrix
- **Total PDFs Evaluated:** 5
- **Total Topics Generated:** 17
- **Passed on First Attempt:** 17
- **Recovered via 1-Shot Retry:** 0
- **Total Failed Topics:** 0
- **Overall Quality Pass Rate:** **100.0%** (17/17)
- **Total Tokens Consumed:** 47636 prompt tokens, 56162 candidate tokens.

---

## 2. Real-World Results Per PDF

| PDF Document | Pages | Units | Topics | Pass (1st) | Pass (Retry) | Failed | Pass Rate | Avg Time/Topic |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `01-computer-networks.pdf` | 3 | 1 | 3 | 3 | 0 | 0 | **100.0%** | 11234.72s |
| `02-operating-systems.pdf` | 3 | 1 | 3 | 3 | 0 | 0 | **100.0%** | 20422.56s |
| `03-data-structures.pdf` | 3 | 1 | 3 | 3 | 0 | 0 | **100.0%** | 6620.61s |
| `04-database-systems.pdf` | 3 | 1 | 3 | 3 | 0 | 0 | **100.0%** | 5615.61s |
| `05-software-engineering.pdf` | 3 | 1 | 5 | 5 | 0 | 0 | **100.0%** | 5452.80s |

---

## 3. Visual Template Coverage & Fallback Audit

- **Specialized Templates Used:** 1
- **Process Flow Fallbacks:** 16

---

## 4. Position-Based Topic ID Stability

Topic IDs are generated using the position-based format `u{unitNumber}-t{topicIndex}`:
- `u{unitNumber}` = 1-based index of the PDF file in the fixtures/real/ directory
- `t{topicIndex}` = 0-based index of the topic across all units in that PDF

This ensures stable, unique IDs independent of topic titles or content language.