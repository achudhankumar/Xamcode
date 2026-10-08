# XamCode AI — Requirements Document (SRS)

**Version:** 1.0  
**Date:** 08 October 2026  
**Author:** XamCode AI Development Team  
**Status:** Baseline

---

## 1. Purpose

This document defines the functional and non-functional requirements for the XamCode AI website — a study learning application that generates study materials (PDFs, flashcards, cheat sheets, and quizzes) from user-uploaded PDFs.

## 2. Scope

The XamCode AI service delivers:

- Upload and parse of PDF study materials
- AI-generated study content (flashcards, formulas, Q&A)
- Quiz/flashcard review mode ("Vaathiyar")
- User accounts and study progress tracking
- Privacy-compliant data handling (DPDP Act 2023)

## 3. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Allow users to upload PDF files | Must |
| FR-02 | Parse and extract text from PDFs | Must |
| FR-03 | Generate flashcards from uploaded PDFs | Must |
| FR-04 | Generate "vaathiyar" quiz mode | Must |
| FR-05 | Provide text-based AI tutoring on study content | Must |
| FR-06 | Enable users to create accounts and log in | Must |
| FR-07 | Allow users to manage their study materials | Must |
| FR-08 | Display study progress and history | Should |
| FR-09 | Show pricing and subscription plan | Must |
| FR-10 | Serve legal pages (Privacy Policy, Terms, Accessibility) | Must |
| FR-11 | Serve tools page (generate pages, formula cards) | Should |
| FR-12 | Serve about page with contact information | Should |
| FR-13 | Send transactional emails (signup, reminders) | Should |

## 4. Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-01 | Response time < 2 seconds for page loads | Must |
| NFR-02 | Support mobile responsive layout | Must |
| NFR-03 | WCAG 2.2 Level AA accessibility | Must |
| NFR-04 | SEO-friendly (meta tags, sitemap, robots) | Must |
| NFR-05 | Data encryption in transit and at rest | Must |
| NFR-06 | Serve security headers (CSP, X-Frame-Options, etc.) | Must |
| NFR-07 | Rate limiting on API endpoints | Must |
| NFR-08 | Lighthouse performance score > 90 | Should |
| NFR-09 | Cross-browser compatibility (Chrome, Firefox, Safari, Edge) | Should |
| NFR-10 | Accessibility statements and contact for complaints | Must |

## 5. Constraints

| Constraint | Description |
|---|---|
| Legal | DPDP Act 2023 compliance required |
| Technical | Node.js + Express backend; static frontend |
| Hosting | Cloud (hosting provider TBD) |
| Browser | Modern browsers, evergreen |

## 6. Assumptions

| Assumption | Impact |
|---|---|
| User base is Indian | DPDP Act applies |
| PDFs are text-based | OCR not required initially |
| AI responses are for educational purposes | No inference-based profiling |
| No payment processing initially | Payments handled via third-party provider |

## 7. Verification Criteria

| Requirement | How verified |
|---|---|
| FR-01 to FR-13 | End-to-end manual tests + automated |
| NFR-01 | Performance benchmark |
| NFR-02 | Responsive design tests |
| NFR-03 | Automated + manual accessibility audit |
| NFR-04 | Crawl test + sitemap validation |
| NFR-05 | Security scan |
| NFR-06 | HTTP header audit |
| NFR-07 | Load test |
| NFR-08 | Lighthouse CI |
| NFR-09 | Cross-browser test |
| NFR-10 | Complaint log reviewed |

---

*End of Requirements Document.*
