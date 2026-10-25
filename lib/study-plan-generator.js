'use strict';

/**
 * Study Plan Generator Engine (Phase A1)
 * Builds deterministic, mathematically grounded study schedules
 * with spaced revision (1, 3, 7, 14 days), mock tests, and adaptive rescheduling.
 */

const DEFAULT_TOPIC_MINUTES = 15;
const REVISION_RATIO = 0.20; // Last 20% reserved for revision

function calculateUnitWeight(unit, level = 'intermediate') {
  const pages = Math.max(1, (unit.end_page || 10) - (unit.page_start || 1) + 1);
  const diffMultiplier = level === 'advanced' ? 1.3 : level === 'beginner' ? 0.8 : 1.0;
  const unitDiff = unit.difficulty || 3;
  return pages * unitDiff * diffMultiplier;
}

function generateStudyPlan({ totalDays = 30, minutesPerDay = 60, units = [], level = 'intermediate', examDate = null }) {
  if (totalDays < 7) totalDays = 7;
  const revisionDaysCount = Math.max(1, Math.floor(totalDays * REVISION_RATIO));
  const activeStudyDaysCount = totalDays - revisionDaysCount;

  // Collect all topics with unit weights
  const allTopics = [];
  units.forEach(u => {
    const uWeight = calculateUnitWeight(u, level);
    (u.topics || []).forEach(t => {
      allTopics.push({
        id: t.id,
        title: t.title,
        unit: u.unit_number || u.idx,
        unitTitle: u.unit_title || u.title,
        durationMinutes: DEFAULT_TOPIC_MINUTES,
        weight: uWeight
      });
    });
  });

  const dailySchedule = [];
  for (let d = 1; d <= totalDays; d++) {
    dailySchedule.push({
      day: d,
      type: d % 7 === 0 ? 'MOCK_TEST' : (d > activeStudyDaysCount ? 'REVISION' : 'STUDY'),
      allocatedMinutes: minutesPerDay,
      tasks: [],
      revisionTasks: []
    });
  }

  // Distribute topics across active study days
  let topicCursor = 0;
  for (let d = 0; d < activeStudyDaysCount; d++) {
    const dayPlan = dailySchedule[d];
    if (dayPlan.type === 'MOCK_TEST') {
      dayPlan.tasks.push({
        title: `Weekly Cumulative Mock Assessment (Unit 1 to Current)`,
        type: 'MOCK_TEST',
        durationMinutes: minutesPerDay
      });
      continue;
    }

    let remainingMinutes = minutesPerDay;
    while (topicCursor < allTopics.length && remainingMinutes >= DEFAULT_TOPIC_MINUTES) {
      const topic = allTopics[topicCursor];
      dayPlan.tasks.push({
        ...topic,
        type: 'NEW_TOPIC'
      });
      remainingMinutes -= DEFAULT_TOPIC_MINUTES;

      // Schedule Spaced Revisions: Day +1, Day +3, Day +7, Day +14
      const revisionIntervals = [1, 3, 7, 14];
      revisionIntervals.forEach(interval => {
        const targetDayIdx = d + interval;
        if (targetDayIdx < totalDays) {
          dailySchedule[targetDayIdx].revisionTasks.push({
            topicId: topic.id,
            title: `Spaced Review: ${topic.title}`,
            intervalDays: interval,
            durationMinutes: 5
          });
        }
      });

      topicCursor++;
    }
  }

  // Populate final 20% revision days
  for (let d = activeStudyDaysCount; d < totalDays; d++) {
    dailySchedule[d].tasks.push({
      title: `Final Rapid Revision & High-Yield CheatCode Review (Phase ${d - activeStudyDaysCount + 1})`,
      type: 'COMPREHENSIVE_REVISION',
      durationMinutes: minutesPerDay
    });
  }

  return {
    totalDays,
    minutesPerDay,
    level,
    examDate,
    activeStudyDaysCount,
    revisionDaysCount,
    topicsScheduled: topicCursor,
    totalTopics: allTopics.length,
    dailySchedule
  };
}

/**
 * Reschedules missed days across remaining schedule, strictly capping any single day
 * at 2x the daily minutes.
 */
function rescheduleMissedDays({ plan, missedDayIndexes = [] }) {
  const maxDailyMinutes = plan.minutesPerDay * 2;
  const orphanedTasks = [];

  // Evacuate missed day tasks
  missedDayIndexes.forEach(dayIdx => {
    const day = plan.dailySchedule[dayIdx];
    if (day) {
      orphanedTasks.push(...day.tasks.filter(t => t.type === 'NEW_TOPIC'));
      day.tasks = [{ title: 'Missed Day (Recorded)', type: 'MISSED', durationMinutes: 0 }];
      day.revisionTasks = [];
    }
  });

  const lastMissed = Math.max(...missedDayIndexes);
  const remainingDays = plan.dailySchedule.slice(lastMissed + 1);

  // Re-distribute orphaned tasks across remaining days without exceeding 2x cap
  let taskIdx = 0;
  for (const day of remainingDays) {
    let currentDayMinutes = day.tasks.reduce((sum, t) => sum + t.durationMinutes, 0) +
      day.revisionTasks.reduce((sum, t) => sum + t.durationMinutes, 0);

    while (taskIdx < orphanedTasks.length && currentDayMinutes + DEFAULT_TOPIC_MINUTES <= maxDailyMinutes) {
      day.tasks.push({
        ...orphanedTasks[taskIdx],
        rescheduled: true
      });
      currentDayMinutes += DEFAULT_TOPIC_MINUTES;
      taskIdx++;
    }
    if (taskIdx >= orphanedTasks.length) break;
  }

  return {
    ...plan,
    rescheduledTasksCount: taskIdx,
    unplacedTasksCount: orphanedTasks.length - taskIdx,
    dailySchedule: plan.dailySchedule
  };
}

module.exports = {
  DEFAULT_TOPIC_MINUTES,
  REVISION_RATIO,
  calculateUnitWeight,
  generateStudyPlan,
  rescheduleMissedDays
};
