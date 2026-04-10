export type RawWorkoutRow = Record<string, string>;

export type RideType = 'regular' | 'lanebreak';

export type UnitSystem = 'metric' | 'imperial';

export interface ParsedTimestamp {
  date: Date;
  dayKey: string;
}

export interface WorkoutMetrics {
  outputKj: number | null;
  avgWatts: number | null;
  avgResistance: number | null;
  avgCadence: number | null;
  avgSpeedKph: number | null;
  distanceKm: number | null;
  calories: number | null;
  avgHeartRate: number | null;
}

export interface WorkoutFlags {
  isCycling: boolean;
  isLaneBreak: boolean;
  isJustRide: boolean;
}

export interface Workout {
  id: string;
  workoutTimestampRaw: string;
  classTimestampRaw: string;
  workoutAt: Date;
  workoutDayKey: string;
  classAt: Date | null;
  classDayKey: string | null;
  liveStatus: string;
  instructor: string;
  title: string;
  discipline: string;
  type: string;
  lengthMinutes: number;
  metrics: WorkoutMetrics;
  flags: WorkoutFlags;
}

export interface ParseIssue {
  rowNumber: number;
  reason: string;
}

export interface NormalizationResult {
  workouts: Workout[];
  issues: ParseIssue[];
}

export interface NamedCount {
  label: string;
  value: number;
}

export interface PersonalRecord {
  id: string;
  title: string;
  type: string;
  instructor: string;
  lengthMinutes: number;
  outputKj: number;
  workoutDayKey: string;
  classDayKey: string | null;
  metrics: WorkoutMetrics;
}

export interface TrendPoint {
  workoutId: string;
  workoutNumber: number;
  workoutDayKey: string;
  dateLabel: string;
  lengthMinutes: number;
  outputKj: number | null;
  calories: number | null;
  discipline: string;
  instructor: string;
}

export interface HeatmapCell {
  key: string;
  dayNumber: number | null;
  count: number;
  level: number;
}

export interface HeatmapMonth {
  key: string;
  label: string;
  cells: HeatmapCell[];
}

export interface FavoriteDay {
  day: string;
  count: number;
}

export interface AnalyticsResult {
  workouts: Workout[];
  cyclingWorkouts: Workout[];
  metadata: {
    rawRowCount: number;
    validWorkoutCount: number;
    invalidRowCount: number;
  };
  totals: {
    totalWorkouts: number;
    cyclingWorkouts: number;
    cyclingPercentage: number;
    totalMinutes: number;
    averageMinutes: number;
    totalDistanceKm: number;
    totalCalories: number;
    totalOutputKj: number;
    favoriteInstructor: string;
    favoriteInstructorMinutes: number;
    mostFrequentType: string;
  };
  funStats: {
    bigMacs: number;
    tvHours: number;
    aroundWorldPercent: number;
    toMoonPercent: number;
    carEngineHours: number;
    lightBulbDays: number;
  };
  distributions: {
    workoutTypes: NamedCount[];
    durations: NamedCount[];
    instructors: NamedCount[];
    favoriteDayDistribution: NamedCount[];
  };
  personalRecords: Record<RideType, Record<number, PersonalRecord[]>>;
  availableDurations: number[];
  trendPoints: TrendPoint[];
  trendLengths: number[];
  trendDisciplines: string[];
  streaks: {
    strict: number;
    lenient: number;
  };
  favoriteDay: FavoriteDay | null;
  heatmapMonths: HeatmapMonth[];
}
