'use strict';

/**
 * SuperMemo 2 (SM-2) Spaced Repetition Engine (Phase A2)
 * Manages flashcard scheduling, ease factors, intervals, and Daily Review queues.
 */

const RATINGS = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4
};

/**
 * Calculates next SM-2 interval and ease factor based on student rating.
 */
function calculateSM2({ repetitions = 0, intervalDays = 0, easeFactor = 2.5, rating = RATINGS.GOOD }) {
  let newRepetitions = repetitions;
  let newIntervalDays = intervalDays;
  let newEaseFactor = easeFactor;

  switch (rating) {
    case RATINGS.AGAIN:
      newRepetitions = 0;
      newIntervalDays = 1;
      newEaseFactor = Math.max(1.3, easeFactor - 0.2);
      break;

    case RATINGS.HARD:
      newRepetitions = repetitions + 1;
      newIntervalDays = Math.max(1, Math.round(intervalDays > 0 ? intervalDays * 1.2 : 1));
      newEaseFactor = Math.max(1.3, easeFactor - 0.15);
      break;

    case RATINGS.GOOD:
      newRepetitions = repetitions + 1;
      if (newRepetitions === 1) {
        newIntervalDays = 1;
      } else if (newRepetitions === 2) {
        newIntervalDays = 6;
      } else {
        newIntervalDays = Math.round(intervalDays * easeFactor);
      }
      break;

    case RATINGS.EASY:
      newRepetitions = repetitions + 1;
      if (newRepetitions === 1) {
        newIntervalDays = 4;
      } else if (newRepetitions === 2) {
        newIntervalDays = 10;
      } else {
        newIntervalDays = Math.round(intervalDays * easeFactor * 1.3);
      }
      newEaseFactor = easeFactor + 0.15;
      break;

    default:
      throw new Error(`Invalid SM-2 rating: ${rating}. Allowed: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy).`);
  }

  const nextDue = new Date(Date.now() + newIntervalDays * 24 * 60 * 60 * 1000);

  return {
    repetitions: newRepetitions,
    intervalDays: newIntervalDays,
    easeFactor: Number(newEaseFactor.toFixed(2)),
    dueAt: nextDue
  };
}

class SRSCardStore {
  constructor() {
    this.cards = [];
  }

  addCard({ userId = 'default_user', topicId, front, back, source = 'flashcard' }) {
    const card = {
      id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      topicId,
      front,
      back,
      source, // 'flashcard' or 'missed_quiz'
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      dueAt: new Date(), // due immediately upon creation
      createdAt: new Date()
    };
    this.cards.push(card);
    return card;
  }

  recordReview(cardId, rating) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);

    const update = calculateSM2({
      repetitions: card.repetitions,
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      rating
    });

    Object.assign(card, update);
    return card;
  }

  getDueCards(userId, maxCards = 20) {
    const now = new Date();
    const userDue = this.cards.filter(c => c.userId === userId && c.dueAt <= now);
    const sessionCards = userDue.slice(0, maxCards);

    return {
      cards: sessionCards,
      totalDue: userDue.length,
      hasMore: userDue.length > maxCards,
      sessionCap: maxCards
    };
  }
}

module.exports = {
  RATINGS,
  calculateSM2,
  SRSCardStore
};

