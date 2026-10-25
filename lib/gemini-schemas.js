'use strict';

const { ALLOWED_VISUAL_TYPES } = require('./schemas');

/**
 * Gemini-compatible OpenAPI 3.0 Structured Output Schemas.
 * Google Gemini's generationConfig.responseSchema strictly requires:
 * - Types: OBJECT, ARRAY, STRING, INTEGER, NUMBER, BOOLEAN
 * - No circular references ($ref)
 * - Explicit properties & items definitions
 */

const GEMINI_OUTLINE_SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING", description: "Academic subject name" },
    units: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          unit_number: { type: "INTEGER", description: "Unit number (1, 2, 3...)" },
          unit_title: { type: "STRING", description: "Full descriptive title of the unit" },
          overview: { type: "STRING", description: "Unit overview and learning scope" },
          topics: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING", description: "URL-safe slug identifier" },
                title: { type: "STRING", description: "Topic title" },
                topic: { type: "STRING", description: "Subheading or focus area" },
                start_page: { type: "INTEGER", description: "First PDF page number covering this topic" },
                end_page: { type: "INTEGER", description: "Last PDF page number covering this topic" },
                first_lines: { type: "STRING", description: "Preview quote or excerpt from the page" }
              },
              required: ["id", "title", "topic", "start_page", "end_page"]
            }
          }
        },
        required: ["unit_number", "unit_title", "overview", "topics"]
      }
    }
  },
  required: ["subject", "units"]
};

const GEMINI_TOPIC_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    topic: { type: "STRING" },
    pdfQuote: { type: "STRING", description: "Exact verbatim sentence copied from the source PDF page text" },
    explanation: { type: "STRING" },
    keyPoints: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: 3,
      maxItems: 8
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          desc: { type: "STRING" }
        },
        required: ["title", "desc"]
      },
      minItems: 3,
      maxItems: 6
    },
    visual: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING", enum: ALLOWED_VISUAL_TYPES },
        title: { type: "STRING" },
        steps: {
          type: "ARRAY",
          description: "At least 3 sequential animation steps",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              desc: { type: "STRING" }
            },
            required: ["title", "desc"]
          }
        },
        parameters: { type: "OBJECT" }
      },
      required: ["type", "steps"]
    },
    cheatcode: {
      type: "OBJECT",
      properties: {
        why: { type: "STRING" },
        like: { type: "STRING" },
        wrong: { type: "STRING" },
        right: { type: "STRING" },
        see: { type: "ARRAY", items: { type: "STRING" } },
        oneLine: { type: "STRING" }
      },
      required: ["why", "like", "wrong", "right", "see", "oneLine"]
    },
    questions: {
      type: "ARRAY",
      description: "At least 2 multiple-choice questions",
      items: {
        type: "OBJECT",
        properties: {
          q: { type: "STRING" },
          opts: { type: "ARRAY", items: { type: "STRING" } },
          a: { type: "INTEGER", description: "0-based index pointing to correct option in opts" },
          cat: { type: "STRING" },
          diff: { type: "STRING", enum: ["Easy", "Medium", "Hard"] },
          why: { type: "STRING" },
          wrong: { type: "ARRAY", items: { type: "STRING" } },
          quote: { type: "STRING" },
          page: { type: "STRING" },
          hint: { type: "STRING" },
          eli: { type: "STRING" }
        },
        required: ["q", "opts", "a", "why"]
      }
    },
    vaathiyar: {
      type: "OBJECT",
      properties: {
        crash: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              tag: { type: "STRING" },
              text: { type: "STRING" },
              readMs: { type: "INTEGER" }
            },
            required: ["tag", "text"]
          }
        },
        crashExplain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              h: { type: "STRING" },
              t: { type: "STRING" }
            },
            required: ["h", "t"]
          }
        },
        compare: {
          type: "OBJECT",
          properties: {
            left: { type: "STRING" },
            right: { type: "STRING" },
            rows: {
              type: "ARRAY",
              items: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            bars: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  leftPct: { type: "INTEGER" },
                  rightPct: { type: "INTEGER" },
                  leftTxt: { type: "STRING" },
                  rightTxt: { type: "STRING" }
                },
                required: ["label", "leftPct", "rightPct", "leftTxt", "rightTxt"]
              }
            }
          },
          required: ["left", "right", "rows"]
        },
        compareExplain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { h: { type: "STRING" }, t: { type: "STRING" } },
            required: ["h", "t"]
          }
        },
        solve: {
          type: "OBJECT",
          properties: {
            q: { type: "STRING" },
            steps: {
              type: "ARRAY",
              description: "At least 2 sequential derivation steps",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  math: { type: "STRING" },
                  note: { type: "STRING" }
                },
                required: ["label", "math", "note"]
              }
            }
          },
          required: ["q", "steps"]
        },
        solveExplain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { h: { type: "STRING" }, t: { type: "STRING" } },
            required: ["h", "t"]
          }
        },
        life: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              ic: { type: "STRING" },
              h: { type: "STRING" },
              t: { type: "STRING" }
            },
            required: ["ic", "h", "t"]
          }
        },
        lifeExplain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { h: { type: "STRING" }, t: { type: "STRING" } },
            required: ["h", "t"]
          }
        },
        history: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              yr: { type: "STRING" },
              h: { type: "STRING" },
              t: { type: "STRING" }
            },
            required: ["yr", "h", "t"]
          }
        },
        historyExplain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { h: { type: "STRING" }, t: { type: "STRING" } },
            required: ["h", "t"]
          }
        },
        flash: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              q: { type: "STRING" },
              a: { type: "STRING" }
            },
            required: ["q", "a"]
          }
        },
        flashExplain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { h: { type: "STRING" }, t: { type: "STRING" } },
            required: ["h", "t"]
          }
        },
        exam: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              q: { type: "STRING" },
              a: { type: "STRING" }
            },
            required: ["q", "a"]
          }
        },
        examExplain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { h: { type: "STRING" }, t: { type: "STRING" } },
            required: ["h", "t"]
          }
        },
        eli5: {
          type: "OBJECT",
          properties: {
            kid: { type: "STRING" },
            middle: { type: "STRING" },
            engg: { type: "STRING" }
          },
          required: ["kid", "middle", "engg"]
        },
        eli5Explain: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { h: { type: "STRING" }, t: { type: "STRING" } },
            required: ["h", "t"]
          }
        }
      }
    }
  },
  required: ["title", "topic", "pdfQuote", "explanation", "keyPoints", "steps", "visual", "cheatcode", "questions"]
};

module.exports = {
  GEMINI_OUTLINE_SCHEMA,
  GEMINI_TOPIC_SCHEMA
};

