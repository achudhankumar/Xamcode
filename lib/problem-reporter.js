'use strict';

/**
 * Problem Reporting & Quality Feedback System (Phase A4)
 * Allows students to report issues on topics, visuals, quiz items, and AURA answers.
 * Feeds directly into the Phase 11 evaluation set and prompt tuning loop.
 */

const VALID_REASONS = ['wrong_fact', 'confusing', 'visual_broken', 'wrong_language', 'other'];
const VALID_TARGETS = ['topic', 'visual', 'quiz_question', 'aura_answer'];

class ProblemReporter {
  constructor() {
    this.reports = [];
  }

  submitReport({
    targetType,
    targetId,
    reason,
    note = '',
    promptVersion = 'v1.2',
    modelUsed = 'gemini-flash-lite-latest',
    userId = 'anonymous'
  }) {
    if (!VALID_TARGETS.includes(targetType)) {
      throw new Error(`Invalid report targetType "${targetType}". Allowed: ${VALID_TARGETS.join(', ')}`);
    }
    if (!VALID_REASONS.includes(reason)) {
      throw new Error(`Invalid report reason "${reason}". Allowed: ${VALID_REASONS.join(', ')}`);
    }

    const report = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      targetType,
      targetId,
      reason,
      note,
      promptVersion,
      modelUsed,
      userId,
      createdAt: new Date().toISOString()
    };

    this.reports.push(report);
    return report;
  }

  getReportsByReason(reason) {
    if (!reason) return this.reports;
    return this.reports.filter(r => r.reason === reason);
  }

  getReportsGroupedByPromptVersion() {
    const grouped = {};
    for (const r of this.reports) {
      const pv = r.promptVersion || 'unknown';
      if (!grouped[pv]) grouped[pv] = [];
      grouped[pv].push(r);
    }
    return grouped;
  }

  exportReportedTopicsToEvalSet() {
    const topicReports = this.reports.filter(r => r.targetType === 'topic' || r.targetType === 'visual');
    const uniqueTopicIds = Array.from(new Set(topicReports.map(r => r.targetId)));
    return {
      exportedAt: new Date().toISOString(),
      count: uniqueTopicIds.length,
      evalTopicIds: uniqueTopicIds
    };
  }
}

const defaultProblemReporter = new ProblemReporter();

module.exports = {
  VALID_REASONS,
  VALID_TARGETS,
  ProblemReporter,
  defaultProblemReporter
};
