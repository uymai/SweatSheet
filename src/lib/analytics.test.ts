import { describe, expect, it } from 'vitest';
import type { RawWorkoutRow } from '../domain/types';
import { computeAnalytics } from './analytics';
import { normalizeWorkouts } from './peloton';

const rows: RawWorkoutRow[] = [
  {
    'Workout Timestamp': '2023-01-01 09:00 (EST)',
    'Class Timestamp': '2022-12-15 10:00 (EST)',
    'Instructor Name': 'Instructor A',
    'Length (minutes)': '30',
    'Fitness Discipline': 'Cycling',
    Type: 'Power Zone',
    Title: '30 min Power Zone Ride',
    'Total Output': '250',
    'Distance (km)': '12.5',
    'Calories Burned': '350',
  },
  {
    'Workout Timestamp': '2023-01-03 09:00 (EST)',
    'Class Timestamp': '2022-12-17 10:00 (EST)',
    'Instructor Name': 'Instructor A',
    'Length (minutes)': '30',
    'Fitness Discipline': 'Cycling',
    Type: 'Power Zone',
    Title: '30 min Power Zone Ride',
    'Total Output': '280',
    'Distance (km)': '13',
    'Calories Burned': '360',
  },
  {
    'Workout Timestamp': '2023-01-05 09:00 (EST)',
    'Class Timestamp': '2022-12-18 10:00 (EST)',
    'Instructor Name': 'Instructor B',
    'Length (minutes)': '20',
    'Fitness Discipline': 'Strength',
    Type: 'Core',
    Title: '20 min Core Strength',
    'Calories Burned': '180',
  },
  {
    'Workout Timestamp': '2023-01-06 09:00 (EST)',
    'Class Timestamp': '2022-12-19 10:00 (EST)',
    'Instructor Name': 'Instructor C',
    'Length (minutes)': '30',
    'Fitness Discipline': 'Cycling',
    Type: 'Lanebreak',
    Title: 'Lanebreak challenge',
    'Total Output': '290',
    'Distance (km)': '14',
    'Calories Burned': '380',
  },
];

describe('computeAnalytics', () => {
  it('produces consistent aggregates, PRs, and trends from normalized workouts', () => {
    const normalization = normalizeWorkouts(rows);
    const analytics = computeAnalytics(normalization.workouts, rows.length, normalization.issues.length);

    expect(analytics.totals.totalWorkouts).toBe(4);
    expect(analytics.totals.cyclingWorkouts).toBe(3);
    expect(analytics.totals.totalOutputKj).toBe(820);
    expect(analytics.personalRecords.regular[30]).toHaveLength(2);
    expect(analytics.personalRecords.lanebreak[30]).toHaveLength(1);
    expect(analytics.trendPoints).toHaveLength(3);
    expect(analytics.distributions.favoriteDayDistribution[0]?.label ?? analytics.favoriteDay?.day).toBeTruthy();
  });
});
