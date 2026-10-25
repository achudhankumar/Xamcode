'use strict';

const { validateOutline, validateTopic } = require('./validator');
const { ALLOWED_VISUAL_TYPES } = require('./schemas');

/**
 * Builds the outline prompt using ONLY headings and first lines per page.
 * Keeps token payload tiny and avoids distracting body text.
 */
function buildOutlinePrompt(extractedPages) {
  const pageBriefs = (extractedPages.pages || []).map(p => {
    const h = p.headings.length ? p.headings.join(' | ') : '(No prominent headings)';
    const fl = p.firstLines || '(No text preview)';
    return `Page ${p.pageNumber}:\n  Headings: ${h}\n  Preview: ${fl}`;
  }).join('\n\n');

  return `Document Structure Scan (${extractedPages.numPages} pages):\n\n${pageBriefs}\n\nTask: Group these pages into a coherent syllabus of Units (1 to 5) and Topics. Each topic must have an id slug, title, topic sub-heading, and exact start_page and end_page matching the page numbers above.`;
}

const OUTLINE_SYSTEM_INSTRUCTION = `You are the XamCode AI Syllabus Architect.
You must output a single valid JSON object matching this schema:
{
  "subject": "Name of the Subject",
  "units": [
    {
      "unit_number": 1,
      "unit_title": "Unit Title",
      "overview": "Overview of this unit's scope and learning objectives",
      "topics": [
        {
          "id": "slug-id",
          "title": "Topic Title",
          "topic": "Concise Topic Subheading",
          "start_page": 1,
          "end_page": 2,
          "first_lines": "Short preview quote"
        }
      ]
    }
  ]
}
Do not output Markdown or extra commentary. Output pure JSON only.`;

/**
 * Builds the focused topic prompt using ONLY that topic's assigned pages.
 */
function buildTopicPrompt(topicMeta, pageTexts) {
  const combinedText = Object.entries(pageTexts)
    .sort(([pA], [pB]) => Number(pA) - Number(pB))
    .map(([pageNum, txt]) => `--- PAGE ${pageNum} ---\n${txt}`)
    .join('\n\n');

  return `TOPIC TO GENERATE: "${topicMeta.title}" (${topicMeta.topic || ''})
ASSIGNED SOURCE PAGES (${topicMeta.start_page} to ${topicMeta.end_page}):

${combinedText}

RULES:
1. "pdfQuote" MUST be a direct verbatim excerpt from the source text above.
2. "visual.type" MUST be one of: ${ALLOWED_VISUAL_TYPES.join(', ')}. DO NOT OUTPUT RAW SVG OR HTML CODE.
3. "questions": Provide at least 2 multiple-choice questions (each with 4 choices in "opts", and "a" pointing to 0-based index of correct option).
4. "cheatcode": Must include "why", "like" (real-world analogy), "wrong" (common myth), "right" (exam rule), "see" (4 examples), and "oneLine".
5. "vaathiyar": Provide rich pedagogical breakdowns for all 8 modes: crash, compare, solve (must contain at least 2 derivation steps in "steps"), life, history, flash, exam, eli5.`;
}

const TOPIC_SYSTEM_INSTRUCTION = `You are XamCode AI, a premier engineering professor and learning architect.
Your output MUST be a single valid JSON object conforming to the target schema:
{
  "id": "topic-slug",
  "unit": 1,
  "unitTitle": "Unit Title",
  "title": "Topic Title",
  "topic": "Topic Subheading",
  "pdfPage": "Page 1",
  "pdfQuote": "Verbatim quote copied directly from the text",
  "explanation": "Clear, deep pedagogical explanation",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "steps": [
    { "title": "Step 1 Title", "desc": "Step 1 description" },
    { "title": "Step 2 Title", "desc": "Step 2 description" },
    { "title": "Step 3 Title", "desc": "Step 3 description" }
  ],
  "visual": {
    "type": "process_flow",
    "title": "Visual Title",
    "steps": [
      { "title": "Stage 1", "desc": "Action in stage 1" },
      { "title": "Stage 2", "desc": "Action in stage 2" },
      { "title": "Stage 3", "desc": "Action in stage 3" }
    ],
    "parameters": {}
  },
  "cheatcode": {
    "why": "Why this mechanism exists",
    "like": "Real world analogy",
    "wrong": "Common student misconception",
    "right": "Exam truth",
    "see": ["Example 1", "Example 2", "Example 3", "Example 4"],
    "oneLine": "One line summary"
  },
  "questions": [
    {
      "q": "First conceptual question text",
      "opts": ["Option A", "Option B", "Option C", "Option D"],
      "a": 0,
      "cat": "CONCEPT",
      "diff": "Easy",
      "why": "Why option A is correct",
      "wrong": ["Explanation for A", "Explanation for B", "Explanation for C", "Explanation for D"],
      "quote": "Quote from text",
      "page": "Page 1",
      "hint": "Helpful hint",
      "eli": "ELI5 hint"
    },
    {
      "q": "Second conceptual question text",
      "opts": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "a": 1,
      "cat": "ANALYSIS",
      "diff": "Medium",
      "why": "Why choice B is correct",
      "wrong": ["Explanation for A", "Explanation for B", "Explanation for C", "Explanation for D"],
      "quote": "Quote from text",
      "page": "Page 1",
      "hint": "Helpful hint",
      "eli": "ELI5 hint"
    }
  ],
  "vaathiyar": {
    "crash": [
      { "tag": "INTRO", "text": "Vanakkam, students...", "readMs": 5000 }
    ],
    "crashExplain": [{ "h": "Why it matters", "t": "Explanation" }],
    "compare": {
      "left": "Concept A",
      "right": "Concept B",
      "rows": [["Criteria", "Val A", "Val B"]],
      "bars": [{ "label": "Complexity", "leftPct": 40, "rightPct": 80, "leftTxt": "Low", "rightTxt": "High" }]
    },
    "compareExplain": [{ "h": "Core Difference", "t": "Explanation" }],
    "solve": {
      "q": "Numerical or algorithmic challenge",
      "steps": [{ "label": "STEP 1", "math": "Equation 1", "note": "Initial setup" }, { "label": "STEP 2", "math": "Equation 2", "note": "Final computation" }]
    },
    "solveExplain": [{ "h": "Formula Basis", "t": "Explanation" }],
    "life": [{ "ic": "🏢", "h": "Application", "t": "Daily life use" }],
    "lifeExplain": [{ "h": "Real impact", "t": "Explanation" }],
    "history": [{ "yr": "1970", "h": "Milestone", "t": "Origin story" }],
    "historyExplain": [{ "h": "Historical context", "t": "Explanation" }],
    "flash": [{ "q": "Recall question", "a": "Quick answer" }],
    "flashExplain": [{ "h": "Spaced repetition", "t": "Explanation" }],
    "exam": [{ "q": "University past paper question", "a": "Model 5-mark answer" }],
    "examExplain": [{ "h": "Mark distribution", "t": "Explanation" }],
    "eli5": {
      "kid": "Explanation for a 5-year-old",
      "middle": "Explanation for high school",
      "engg": "Deep engineering specification"
    },
    "eli5Explain": [{ "h": "Three depths", "t": "Explanation" }]
  }
}
Never output raw HTML, SVG tags, or markdown ticks. Pure JSON only.`;

/**
 * Executes outline generation with 1-shot validation retry.
 */
async function generateOutlineWithRetry({ extractedPages, providerRouter, mockFallbackFn = null }) {
  const prompt = buildOutlinePrompt(extractedPages);
  return await providerRouter.generateStructuredJson({
    systemInstruction: OUTLINE_SYSTEM_INSTRUCTION,
    prompt,
    validationFn: validateOutline,
    mockFallbackFn
  });
}

/**
 * Executes topic generation using only that topic's pages with 1-shot validation retry.
 */
async function generateTopicWithRetry({ topicMeta, pageTexts, providerRouter, mockFallbackFn = null }) {
  const prompt = buildTopicPrompt(topicMeta, pageTexts);
  const combinedPageText = Object.values(pageTexts).join('\n ');

  return await providerRouter.generateStructuredJson({
    systemInstruction: TOPIC_SYSTEM_INSTRUCTION,
    prompt,
    validationFn: (parsed) => validateTopic(parsed, combinedPageText),
    mockFallbackFn
  });
}

module.exports = {
  buildOutlinePrompt,
  buildTopicPrompt,
  generateOutlineWithRetry,
  generateTopicWithRetry,
  OUTLINE_SYSTEM_INSTRUCTION,
  TOPIC_SYSTEM_INSTRUCTION
};

