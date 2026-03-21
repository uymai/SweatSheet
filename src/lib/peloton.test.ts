import { describe, expect, it } from 'vitest';
import { normalizeWorkouts, parsePelotonTimestamp } from './peloton';

describe('parsePelotonTimestamp', () => {
  it('parses named timezones and preserves source day keys', () => {
    const parsed = parsePelotonTimestamp('2023-01-01 09:00 (EST)');
    expect(parsed?.dayKey).toBe('2023-01-01');
    expect(parsed?.date.toISOString()).toBe('2023-01-01T14:00:00.000Z');
  });

  it('parses explicit numeric offsets', () => {
    const parsed = parsePelotonTimestamp('2023-01-01 09:00 (+02)');
    expect(parsed?.date.toISOString()).toBe('2023-01-01T07:00:00.000Z');
  });

  it('returns null for malformed timestamps', () => {
    expect(parsePelotonTimestamp('not a timestamp')).toBeNull();
  });
});

describe('normalizeWorkouts', () => {
  it('rejects rows with invalid timestamps and just keeps valid workouts', () => {
    const result = normalizeWorkouts([
      {
        'Workout Timestamp': '2023-01-01 09:00 (EST)',
        'Class Timestamp': '2022-12-15 10:00 (EST)',
        'Instructor Name': 'Instructor A',
        'Length (minutes)': '30',
        'Fitness Discipline': 'Cycling',
        Type: 'Power Zone',
        Title: '30 min Power Zone Ride',
        'Total Output': '250',
      },
      {
        'Workout Timestamp': 'bad date',
        'Length (minutes)': '20',
      },
    ]);

    expect(result.workouts).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.workouts[0]?.flags.isCycling).toBe(true);
  });
});
