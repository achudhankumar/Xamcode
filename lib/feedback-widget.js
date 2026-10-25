/**
 * lib/feedback-widget.js
 * In-app student feedback submission system (Phase 13).
 */

const FEEDBACK_CATEGORIES = ['praise', 'bug', 'feature', 'confusion', 'general'];

class FeedbackManager {
  constructor(options = {}) {
    this.feedbacks = [];
  }

  submitFeedback({ userId, rating, category, message, context = {} }) {
    if (!message || message.trim().length === 0) {
      throw new Error('Feedback message is required.');
    }
    const cat = FEEDBACK_CATEGORIES.includes(category) ? category : 'general';
    const numRating = Number(rating) || 5;

    const entry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: userId || 'anonymous',
      rating: Math.max(1, Math.min(5, numRating)),
      category: cat,
      message: message.trim(),
      context: {
        topicId: context.topicId || null,
        mode: context.mode || null,
        theme: context.theme || null,
        userAgent: context.userAgent || 'unknown'
      },
      createdAt: new Date().toISOString()
    };

    this.feedbacks.push(entry);
    return entry;
  }

  listFeedback(filterCategory = null) {
    if (filterCategory) {
      return this.feedbacks.filter(f => f.category === filterCategory);
    }
    return [...this.feedbacks];
  }

  getAverageRating() {
    if (this.feedbacks.length === 0) return 5.0;
    const sum = this.feedbacks.reduce((acc, f) => acc + f.rating, 0);
    return Number((sum / this.feedbacks.length).toFixed(2));
  }
}

module.exports = {
  FeedbackManager,
  FEEDBACK_CATEGORIES
};

