import Papa from 'papaparse';
import type {
  NormalizationResult,
  ParsedTimestamp,
  RawWorkoutRow,
  Workout,
  WorkoutMetrics,
} from '../domain/types';

const TIMEZONE_OFFSETS: Record<string, string> = {
  EST: '-05:00',
  EDT: '-04:00',
  UTC: '+00:00',
};

const TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?(?: \(([^)]+)\))?$/;

export async function parseCsvFile(file: File): Promise<RawWorkoutRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawWorkoutRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve(result.data),
      error: reject,
    });
  });
}

export function parsePelotonTimestamp(input: string): ParsedTimestamp | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const match = value.match(TIMESTAMP_PATTERN);
  if (!match) {
    return null;
  }

  const [, dayKey, hour, minute, second = '00', timezoneToken] = match;
  const [year, month, day] = dayKey.split('-').map(Number);

  let date: Date;

  if (!timezoneToken) {
    date = new Date(year, month - 1, day, Number(hour), Number(minute), Number(second));
  } else {
    const offset = TIMEZONE_OFFSETS[timezoneToken] ?? normalizeOffsetToken(timezoneToken);
    if (!offset) {
      return null;
    }
    date = new Date(`${dayKey}T${hour}:${minute}:${second}${offset}`);
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return { date, dayKey };
}

export function normalizeWorkouts(rows: RawWorkoutRow[]): NormalizationResult {
  const workouts: Workout[] = [];
  const issues: NormalizationResult['issues'] = [];

  rows.forEach((row, index) => {
    if (!hasAnyValues(row)) {
      return;
    }

    const workoutTimestampRaw = valueOf(row, 'Workout Timestamp');
    const parsedWorkoutAt = parsePelotonTimestamp(workoutTimestampRaw);

    if (!parsedWorkoutAt) {
      issues.push({
        rowNumber: index + 2,
        reason: 'Missing or invalid workout timestamp',
      });
      return;
    }

    const classTimestampRaw = valueOf(row, 'Class Timestamp');
    const parsedClassAt = classTimestampRaw ? parsePelotonTimestamp(classTimestampRaw) : null;
    const title = valueOf(row, 'Title') || 'Untitled Workout';
    const type = valueOf(row, 'Type') || 'Unknown';
    const discipline = valueOf(row, 'Fitness Discipline') || 'Unknown';
    const descriptor = `${discipline} ${type} ${title}`.toLowerCase();
    const isLaneBreak = descriptor.includes('lanebreak');
    const isJustRide = descriptor.includes('just ride');
    const isCycling = discipline.toLowerCase().includes('cycl') || isLaneBreak;
    const lengthMinutes = parseInteger(row['Length (minutes)']);

    if (lengthMinutes <= 0) {
      issues.push({
        rowNumber: index + 2,
        reason: 'Missing or invalid workout length',
      });
      return;
    }

    const metrics: WorkoutMetrics = {
      outputKj: parseNullableNumber(row['Total Output']),
      avgWatts: parseNullableNumber(row['Avg. Watts']),
      avgResistance: parseNullableNumber(row['Avg. Resistance']),
      avgCadence: parseNullableNumber(row['Avg. Cadence (RPM)']),
      avgSpeedKph: parseNullableNumber(row['Avg. Speed (kph)']),
      distanceKm: parseNullableNumber(row['Distance (km)']),
      calories: parseNullableNumber(row['Calories Burned']),
      avgHeartRate: parseNullableNumber(row['Avg. Heartrate']),
    };

    workouts.push({
      id: `workout-${index}`,
      workoutTimestampRaw,
      classTimestampRaw,
      workoutAt: parsedWorkoutAt.date,
      workoutDayKey: parsedWorkoutAt.dayKey,
      classAt: parsedClassAt?.date ?? null,
      classDayKey: parsedClassAt?.dayKey ?? null,
      liveStatus: valueOf(row, 'Live/On-Demand') || 'Unknown',
      instructor: valueOf(row, 'Instructor Name') || 'Unknown',
      title,
      discipline,
      type,
      lengthMinutes,
      metrics,
      flags: {
        isCycling,
        isLaneBreak,
        isJustRide,
      },
    });
  });

  return { workouts, issues };
}

function normalizeOffsetToken(token: string): string | null {
  if (/^[+-]\d{2}$/.test(token)) {
    return `${token}:00`;
  }

  if (/^[+-]\d{2}:\d{2}$/.test(token)) {
    return token;
  }

  return null;
}

function parseNullableNumber(value: string | undefined): number | null {
  if (!value || !value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | undefined): number {
  if (!value || !value.trim()) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valueOf(row: RawWorkoutRow, field: string): string {
  return (row[field] ?? '').trim();
}

function hasAnyValues(row: RawWorkoutRow): boolean {
  return Object.values(row).some((value) => value?.trim());
}
