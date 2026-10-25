'use strict';

/**
 * Streak and Daily Goal Engine (Phase A6)
 * Supports timezone-aware study day completion, monthly streak freeze,
 * gentle reminder settings, and ethical UX (no guilt messages or dark patterns).
 */

class StreakManager {
  constructor() {
    this.streaks = new Map(); // userId -> state
  }

  getStudentState(userId) {
    if (!this.streaks.has(userId)) {
      this.streaks.set(userId, {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedLocalDate: null,
        streakFreezesUsedThisMonth: 0,
        lastFreezeMonth: null,
        remindersEnabled: true,
        dailyGoalMinutes: 15
      });
    }
    return this.streaks.get(userId);
  }

  getLocalDateString(date = new Date(), timeZone = 'Asia/Kolkata') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  recordActivity({ userId, minutes = 15, date = new Date(), timeZone = 'Asia/Kolkata' }) {
    const student = this.getStudentState(userId);
    const localDate = this.getLocalDateString(date, timeZone);

    if (student.lastCompletedLocalDate === localDate) {
      return { streak: student.currentStreak, date: localDate, alreadyRecordedToday: true };
    }

    if (!student.lastCompletedLocalDate) {
      student.currentStreak = 1;
      student.longestStreak = 1;
      student.lastCompletedLocalDate = localDate;
      return { streak: 1, date: localDate };
    }

    // Check difference in days
    const prevDate = new Date(student.lastCompletedLocalDate + 'T00:00:00Z');
    const curDate = new Date(localDate + 'T00:00:00Z');
    const diffDays = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day!
      student.currentStreak += 1;
      if (student.currentStreak > student.longestStreak) {
        student.longestStreak = student.currentStreak;
      }
    } else if (diffDays === 2 && this.canUseFreeze(student, localDate)) {
      // Missed 1 day, use 1 freeze!
      student.streakFreezesUsedThisMonth += 1;
      student.lastFreezeMonth = localDate.slice(0, 7); // YYYY-MM
      student.currentStreak += 1; // Preserved!
    } else if (diffDays > 1) {
      // Missed day without freeze -> Reset
      student.currentStreak = 1;
    }

    student.lastCompletedLocalDate = localDate;
    return {
      streak: student.currentStreak,
      longestStreak: student.longestStreak,
      date: localDate,
      freezeUsed: diffDays === 2
    };
  }

  canUseFreeze(student, currentLocalDate) {
    const currentMonth = currentLocalDate.slice(0, 7);
    if (student.lastFreezeMonth !== currentMonth) {
      student.streakFreezesUsedThisMonth = 0; // Reset monthly allowance
    }
    return student.streakFreezesUsedThisMonth < 1;
  }

  toggleReminders(userId, enabled) {
    const student = this.getStudentState(userId);
    student.remindersEnabled = Boolean(enabled);
    return student.remindersEnabled;
  }
}

module.exports = {
  StreakManager
};
