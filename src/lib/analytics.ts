import type {
  AnalyticsResult,
  HeatmapCell,
  HeatmapMonth,
  NamedCount,
  PersonalRecord,
  RideType,
  TrendPoint,
  Workout,
} from '../domain/types';
import { formatDateLabel } from './format';

const PR_DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function computeAnalytics(workouts: Workout[], rawRowCount: number, invalidRowCount: number): AnalyticsResult {
  const sortedWorkouts = [...workouts].sort((left, right) => left.workoutAt.getTime() - right.workoutAt.getTime());
  const cyclingWorkouts = sortedWorkouts.filter((workout) => workout.flags.isCycling);
  const workoutTypeCounts = countByLabel(sortedWorkouts.map((workout) => workout.discipline || 'Unknown'));
  const durationCounts = countByLabel(sortedWorkouts.map((workout) => `${workout.lengthMinutes} min`));
  const instructorCounts = countByLabel(sortedWorkouts.map((workout) => workout.instructor || 'Unknown'));
  const favoriteDayCounts = countByLabel(
    sortedWorkouts.map((workout) => DAY_NAMES[new Date(`${workout.workoutDayKey}T12:00:00Z`).getUTCDay()]),
  );
  const instructorMinutes = new Map<string, number>();

  cyclingWorkouts.forEach((workout) => {
    instructorMinutes.set(workout.instructor, (instructorMinutes.get(workout.instructor) ?? 0) + workout.lengthMinutes);
  });

  const totalMinutes = cyclingWorkouts.reduce((sum, workout) => sum + workout.lengthMinutes, 0);
  const totalDistanceKm = sumNullable(cyclingWorkouts.map((workout) => workout.metrics.distanceKm));
  const totalCalories = sumNullable(cyclingWorkouts.map((workout) => workout.metrics.calories));
  const totalOutputKj = sumNullable(cyclingWorkouts.map((workout) => workout.metrics.outputKj));
  const favoriteInstructorEntry = [...instructorCounts.entries()]
    .filter(([name]) => name !== 'Unknown')
    .sort((left, right) => right[1] - left[1])[0];
  const mostFrequentTypeEntry = [...workoutTypeCounts.entries()].sort((left, right) => right[1] - left[1])[0];

  const personalRecords = buildPersonalRecords(cyclingWorkouts);
  const trendPoints = buildTrendPoints(cyclingWorkouts);
  const streaks = calculateStreaks(sortedWorkouts.map((workout) => workout.workoutDayKey));
  const favoriteDayDistribution = mapCountsToSortedList(favoriteDayCounts, DAY_NAMES);
  const favoriteDay = favoriteDayDistribution.reduce<{ day: string; count: number } | null>((best, item) => {
    if (!best || item.value > best.count) {
      return { day: item.label, count: item.value };
    }
    return best;
  }, null);

  return {
    workouts: sortedWorkouts,
    cyclingWorkouts,
    metadata: {
      rawRowCount,
      validWorkoutCount: sortedWorkouts.length,
      invalidRowCount,
    },
    totals: {
      totalWorkouts: sortedWorkouts.length,
      cyclingWorkouts: cyclingWorkouts.length,
      cyclingPercentage: sortedWorkouts.length === 0 ? 0 : (cyclingWorkouts.length / sortedWorkouts.length) * 100,
      totalMinutes,
      averageMinutes: cyclingWorkouts.length === 0 ? 0 : Math.round(totalMinutes / cyclingWorkouts.length),
      totalDistanceKm,
      totalCalories,
      totalOutputKj,
      favoriteInstructor: favoriteInstructorEntry?.[0] ?? '-',
      favoriteInstructorMinutes: instructorMinutes.get(favoriteInstructorEntry?.[0] ?? '') ?? 0,
      mostFrequentType: mostFrequentTypeEntry?.[0] ?? '-',
    },
    funStats: {
      bigMacs: totalCalories / 550,
      tvHours: totalCalories / 100,
      aroundWorldPercent: (totalDistanceKm / 40075) * 100,
      toMoonPercent: (totalDistanceKm / 384400) * 100,
      carEngineHours: totalOutputKj / (100 * 3600),
      lightBulbDays: totalOutputKj / (0.06 * 86400),
    },
    distributions: {
      workoutTypes: mapCountsToSortedList(workoutTypeCounts).slice(0, 10),
      durations: mapCountsToSortedList(durationCounts, undefined, durationLabelSort),
      instructors: mapCountsToSortedList(instructorCounts).filter((item) => item.label !== 'Unknown').slice(0, 10),
      favoriteDayDistribution,
    },
    personalRecords,
    availableDurations: [...PR_DURATIONS],
    trendPoints,
    trendLengths: [...new Set(trendPoints.map((point) => point.lengthMinutes))].sort((left, right) => left - right),
    streaks,
    favoriteDay: favoriteDay && favoriteDay.count >= 1 ? favoriteDay : null,
    heatmapMonths: buildHeatmapMonths(sortedWorkouts),
  };
}

function buildPersonalRecords(workouts: Workout[]): Record<RideType, Record<number, PersonalRecord[]>> {
  const eligible = workouts.filter((workout) => !workout.flags.isJustRide && typeof workout.metrics.outputKj === 'number');
  const grouped: Record<RideType, Record<number, PersonalRecord[]>> = {
    regular: Object.fromEntries(PR_DURATIONS.map((duration) => [duration, []])) as Record<number, PersonalRecord[]>,
    lanebreak: Object.fromEntries(PR_DURATIONS.map((duration) => [duration, []])) as Record<number, PersonalRecord[]>,
  };

  (['regular', 'lanebreak'] as const).forEach((rideType) => {
    const scoped = eligible
      .filter((workout) => (rideType === 'lanebreak' ? workout.flags.isLaneBreak : !workout.flags.isLaneBreak))
      .sort((left, right) => left.workoutAt.getTime() - right.workoutAt.getTime());

    PR_DURATIONS.forEach((duration) => {
      let currentBest = -1;
      const progression: PersonalRecord[] = [];

      scoped
        .filter((workout) => workout.lengthMinutes === duration && typeof workout.metrics.outputKj === 'number')
        .forEach((workout) => {
          if ((workout.metrics.outputKj ?? 0) > currentBest) {
            currentBest = workout.metrics.outputKj ?? 0;
            progression.push({
              id: workout.id,
              title: workout.title,
              type: workout.type,
              instructor: workout.instructor,
              lengthMinutes: workout.lengthMinutes,
              outputKj: workout.metrics.outputKj ?? 0,
              workoutDayKey: workout.workoutDayKey,
              classDayKey: workout.classDayKey,
              metrics: workout.metrics,
            });
          }
        });

      grouped[rideType][duration] = progression.reverse();
    });
  });

  return grouped;
}

function buildTrendPoints(workouts: Workout[]): TrendPoint[] {
  return workouts
    .filter((workout) => typeof workout.metrics.outputKj === 'number')
    .sort((left, right) => left.workoutAt.getTime() - right.workoutAt.getTime())
    .map((workout, index) => ({
      workoutId: workout.id,
      workoutNumber: index + 1,
      workoutDayKey: workout.workoutDayKey,
      dateLabel: formatDateLabel(workout.workoutDayKey),
      lengthMinutes: workout.lengthMinutes,
      outputKj: workout.metrics.outputKj ?? 0,
    }));
}

function calculateStreaks(dayKeys: string[]): { strict: number; lenient: number } {
  const uniqueDays = [...new Set(dayKeys)].sort();
  if (uniqueDays.length === 0) {
    return { strict: 0, lenient: 0 };
  }

  return {
    strict: calculateStrictStreak(uniqueDays),
    lenient: calculateLenientStreak(uniqueDays),
  };
}

function calculateStrictStreak(dayKeys: string[]): number {
  let current = 1;
  let best = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    if (differenceInDays(dayKeys[index - 1], dayKeys[index]) === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function calculateLenientStreak(dayKeys: string[]): number {
  let current = 1;
  let best = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    const diff = differenceInDays(dayKeys[index - 1], dayKeys[index]);
    if (diff <= 2) {
      current += diff;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function buildHeatmapMonths(workouts: Workout[]): HeatmapMonth[] {
  const dayCounts = new Map<string, number>();
  workouts.forEach((workout) => {
    dayCounts.set(workout.workoutDayKey, (dayCounts.get(workout.workoutDayKey) ?? 0) + 1);
  });

  const months: HeatmapMonth[] = [];
  const anchor = new Date();
  anchor.setUTCHours(12, 0, 0, 0);

  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthDate = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - offset, 1, 12));
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1, 12)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
    const cells: HeatmapCell[] = [];

    for (let index = 0; index < firstDayOfMonth; index += 1) {
      cells.push({ key: `blank-${year}-${month}-${index}`, dayNumber: null, count: 0, level: 0 });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayKey = createDayKey(year, month + 1, day);
      const count = dayCounts.get(dayKey) ?? 0;
      cells.push({
        key: dayKey,
        dayNumber: day,
        count,
        level: count === 0 ? 0 : Math.min(4, Math.ceil(count / 2)),
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ key: `tail-${year}-${month}-${cells.length}`, dayNumber: null, count: 0, level: 0 });
    }

    months.push({
      key: `${year}-${month + 1}`,
      label: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(monthDate),
      cells,
    });
  }

  return months;
}

function countByLabel(values: string[]): Map<string, number> {
  return values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function mapCountsToSortedList(
  counts: Map<string, number>,
  preferredOrder?: readonly string[],
  customSort?: (left: NamedCount, right: NamedCount) => number,
): NamedCount[] {
  const values = [...counts.entries()].map(([label, value]) => ({ label, value }));

  if (preferredOrder) {
    return preferredOrder
      .map((label) => ({ label, value: counts.get(label) ?? 0 }))
      .filter((entry) => entry.value > 0);
  }

  return values.sort(customSort ?? ((left, right) => right.value - left.value));
}

function durationLabelSort(left: NamedCount, right: NamedCount): number {
  return Number.parseInt(left.label, 10) - Number.parseInt(right.label, 10);
}

function sumNullable(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function differenceInDays(previousDayKey: string, currentDayKey: string): number {
  const previous = Date.parse(`${previousDayKey}T12:00:00Z`);
  const current = Date.parse(`${currentDayKey}T12:00:00Z`);
  return Math.round((current - previous) / 86400000);
}

function createDayKey(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}
