'use strict';

/**
 * Mock Assessment & Examination Mode (Phase A7)
 * Assembles timed mock tests (10, 20, 30 questions) from cached quizzes and Exam Mode.
 * Generates weak-topic diagnostics and automatically dispatches missed items to SM-2 SRS.
 */

class MockTestSession {
  constructor({ testId = 'mock_test_1', questionCount = 20, durationMinutes = 30, questions = [] }) {
    this.testId = testId;
    this.questionCount = questionCount;
    this.durationMinutes = durationMinutes;
    this.questions = questions.slice(0, questionCount);
    this.answers = new Map(); // questionIndex -> chosenOption
    this.timePerQuestionMs = new Map(); // questionIndex -> ms
    this.isCompleted = false;
    this.noHints = true; // Strict exam condition
  }

  submitAnswer(qIndex, chosenOption, timeSpentMs = 30000) {
    if (this.isCompleted) throw new Error('Test already completed');
    this.answers.set(qIndex, chosenOption);
    this.timePerQuestionMs.set(qIndex, timeSpentMs);
  }

  evaluateResults(srsStore = null, userId = 'student') {
    this.isCompleted = true;
    let correctCount = 0;
    const weakTopicsMap = new Map(); // topicId -> { title, missedCount }
    const missedQuestions = [];

    this.questions.forEach((q, idx) => {
      const chosen = this.answers.get(idx);
      const isCorrect = chosen !== undefined && chosen === q.correctAnswerIndex;

      if (isCorrect) {
        correctCount++;
      } else {
        missedQuestions.push(q);
        const tId = q.topicId || 'general';
        const cur = weakTopicsMap.get(tId) || { topicId: tId, title: q.topicTitle || tId, missedCount: 0 };
        cur.missedCount++;
        weakTopicsMap.set(tId, cur);

        // Auto-add to Spaced Repetition (A2)
        if (srsStore) {
          srsStore.addCard({
            userId,
            topicId: tId,
            front: q.questionText,
            back: `Correct: ${q.options[q.correctAnswerIndex]} (Explanation: ${q.explanation || 'Exam mode review'})`,
            source: 'missed_quiz'
          });
        }
      }
    });

    const totalQuestions = this.questions.length;
    const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const totalTimeMs = Array.from(this.timePerQuestionMs.values()).reduce((sum, t) => sum + t, 0);
    const avgTimePerQuestionMs = totalQuestions > 0 ? Math.round(totalTimeMs / totalQuestions) : 0;

    const weakTopicsList = Array.from(weakTopicsMap.values())
      .sort((a, b) => b.missedCount - a.missedCount);

    return {
      testId: this.testId,
      totalQuestions,
      correctCount,
      scorePct,
      avgTimePerQuestionSeconds: Math.round(avgTimePerQuestionMs / 1000),
      weakTopics: weakTopicsList,
      missedQuestionsCount: missedQuestions.length,
      dispatchedToSRS: Boolean(srsStore)
    };
  }
}

/**
 * Pools cached questions across units without calling external models at test time
 */
function assembleMockTestFromCache({ questionCount = 20, topicPool = [] }) {
  const allQuestions = [];

  topicPool.forEach(topic => {
    (topic.questions || []).forEach(q => {
      allQuestions.push({
        topicId: topic.id,
        topicTitle: topic.title,
        questionText: q.q,
        options: q.opts,
        correctAnswerIndex: q.a,
        difficulty: q.diff || 'Medium',
        explanation: q.why
      });
    });
  });

  return new MockTestSession({
    questionCount,
    questions: allQuestions
  });
}

module.exports = {
  MockTestSession,
  assembleMockTestFromCache
};
