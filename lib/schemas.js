'use strict';

const { z } = require('zod');

// Allowed visual template types for high-quality pedagogical rendering without raw AI SVG
const ALLOWED_VISUAL_TYPES = [
  'process_flow',
  'topology',
  'packet_flow',
  'sliding_window',
  'hamming',
  'timeline',
  'comparison_visual',
  'chart',
  'state_machine',
  'cycle',
  'hierarchy_tree',
  'labeled_diagram'
];

const VisualTypeEnum = z.enum(ALLOWED_VISUAL_TYPES);

const VisualStepSchema = z.object({
  title: z.string().min(2),
  desc: z.string().min(5)
});

const VisualSchema = z.object({
  type: VisualTypeEnum.catch('process_flow'),
  title: z.string().optional(),
  steps: z.array(VisualStepSchema).min(3),
  parameters: z.record(z.any()).default({})
});

const CheatCodeSchema = z.object({
  why: z.string().min(5),
  like: z.string().min(5),
  wrong: z.string().min(5),
  right: z.string().min(5),
  see: z.array(z.string()).min(2),
  oneLine: z.string().min(5)
});

const QuizQuestionSchema = z.object({
  q: z.string().min(5),
  opts: z.array(z.string()).min(2).max(4),
  a: z.number().int().min(0),
  cat: z.string().default('CONCEPT'),
  diff: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  why: z.string().min(5),
  wrong: z.array(z.string()).default([]),
  quote: z.string().default(''),
  page: z.string().default(''),
  hint: z.string().default(''),
  eli: z.string().default('')
}).refine(data => data.a >= 0 && data.a < data.opts.length, {
  message: 'Quiz answer index "a" must point to a valid option in "opts"'
});

// The 8 Vaathiyar Mode Schemas
const VaathiyarCrashSceneSchema = z.object({
  tag: z.string().min(2),
  text: z.string().min(5),
  visual: z.any().optional(),
  readMs: z.number().default(5000)
});

const VaathiyarExplainItemSchema = z.object({
  h: z.string().min(2),
  t: z.string().min(5)
});

const VaathiyarExplainSchema = z.array(VaathiyarExplainItemSchema);

const VaathiyarCompareSchema = z.object({
  left: z.string().min(2),
  right: z.string().min(2),
  rows: z.array(z.array(z.string())).min(1),
  bars: z.array(z.object({
    label: z.string(),
    leftPct: z.number(),
    rightPct: z.number(),
    leftTxt: z.string(),
    rightTxt: z.string()
  })).default([])
});

const VaathiyarSolveStepSchema = z.object({
  label: z.string(),
  math: z.string(),
  note: z.string()
});

const VaathiyarSolveSchema = z.object({
  q: z.string().min(5),
  figure: z.record(z.any()).optional(),
  steps: z.array(VaathiyarSolveStepSchema).min(2)
});

const VaathiyarLifeItemSchema = z.object({
  ic: z.string(),
  h: z.string().min(2),
  t: z.string().min(5)
});

const VaathiyarHistoryItemSchema = z.object({
  yr: z.string().min(2),
  h: z.string().min(2),
  t: z.string().min(5)
});

const VaathiyarFlashcardSchema = z.object({
  q: z.string().min(4),
  a: z.string().min(2)
});

const VaathiyarExamQuestionSchema = z.object({
  q: z.string().min(5),
  a: z.string().min(5)
});

const VaathiyarEli5Schema = z.object({
  kid: z.string().min(10),
  middle: z.string().min(10),
  engg: z.string().min(10)
});

const VaathiyarSchema = z.object({
  crash: z.array(VaathiyarCrashSceneSchema).optional(),
  crashExplain: VaathiyarExplainSchema.optional(),
  compare: VaathiyarCompareSchema.optional(),
  compareExplain: VaathiyarExplainSchema.optional(),
  solve: VaathiyarSolveSchema.optional(),
  solveExplain: VaathiyarExplainSchema.optional(),
  life: z.array(VaathiyarLifeItemSchema).optional(),
  lifeExplain: VaathiyarExplainSchema.optional(),
  history: z.array(VaathiyarHistoryItemSchema).optional(),
  historyExplain: VaathiyarExplainSchema.optional(),
  flash: z.array(VaathiyarFlashcardSchema).optional(),
  flashExplain: VaathiyarExplainSchema.optional(),
  exam: z.array(VaathiyarExamQuestionSchema).optional(),
  examExplain: VaathiyarExplainSchema.optional(),
  eli5: VaathiyarEli5Schema.optional(),
  eli5Explain: VaathiyarExplainSchema.optional()
});

const TopicSchema = z.object({
  id: z.string(),
  unit: z.union([z.string(), z.number()]),
  unitTitle: z.string().optional(),
  title: z.string().min(3),
  topic: z.string().min(3),
  pdfPage: z.string().default('Page 1'),
  pdfQuote: z.string().min(5),
  explanation: z.string().min(10),
  keyPoints: z.array(z.string()).min(2),
  steps: z.array(VisualStepSchema).min(3),
  visual: VisualSchema,
  cheatcode: CheatCodeSchema,
  questions: z.array(QuizQuestionSchema).min(2),
  vaathiyar: VaathiyarSchema.optional()
});

const OutlineTopicSchema = z.object({
  id: z.string(),
  title: z.string().min(3),
  topic: z.string().min(3),
  start_page: z.number().int().min(1),
  end_page: z.number().int().min(1),
  first_lines: z.string().optional()
});

const OutlineUnitSchema = z.object({
  unit_number: z.union([z.string(), z.number()]),
  unit_title: z.string().min(3),
  overview: z.string().min(10),
  topics: z.array(OutlineTopicSchema).min(1)
});

const OutlineSchema = z.object({
  subject: z.string().min(2),
  units: z.array(OutlineUnitSchema).min(1)
});

module.exports = {
  ALLOWED_VISUAL_TYPES,
  VisualTypeEnum,
  VisualStepSchema,
  VisualSchema,
  CheatCodeSchema,
  QuizQuestionSchema,
  VaathiyarCrashSceneSchema,
  VaathiyarExplainSchema,
  VaathiyarCompareSchema,
  VaathiyarSolveSchema,
  VaathiyarLifeItemSchema,
  VaathiyarHistoryItemSchema,
  VaathiyarFlashcardSchema,
  VaathiyarExamQuestionSchema,
  VaathiyarEli5Schema,
  VaathiyarSchema,
  TopicSchema,
  OutlineSchema,
  OutlineUnitSchema,
  OutlineTopicSchema
};

