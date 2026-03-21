import { SectionCard } from '../../components/SectionCard';
import type { AnalyticsResult } from '../../domain/types';
import { formatNumber, formatTime } from '../../lib/format';

interface StatsSectionsProps {
  analytics: AnalyticsResult;
}

export function StatsSections({ analytics }: StatsSectionsProps) {
  const { totals, funStats, metadata } = analytics;

  return (
    <>
      <div className="stats-grid stats-grid--summary">
        <SectionCard title="Program Snapshot" subtitle="Core totals from the normalized workout dataset.">
          <div className="metric-grid">
            <Metric label="Valid Workouts" value={formatNumber(totals.totalWorkouts)} />
            <Metric label="Cycling Workouts" value={`${formatNumber(totals.cyclingWorkouts)} (${formatNumber(totals.cyclingPercentage, 1)}%)`} />
            <Metric label="Total Time" value={formatTime(totals.totalMinutes)} />
            <Metric label="Average Ride" value={formatTime(totals.averageMinutes)} />
            <Metric label="Total Distance" value={`${formatNumber(totals.totalDistanceKm, 1)} km`} />
            <Metric label="Total Calories" value={formatNumber(totals.totalCalories)} />
            <Metric label="Favorite Instructor" value={`${totals.favoriteInstructor} (${formatTime(totals.favoriteInstructorMinutes)})`} />
            <Metric label="Most Frequent Type" value={totals.mostFrequentType} />
          </div>
        </SectionCard>

        <SectionCard title="Data Quality" subtitle="What was accepted into the normalized dataset.">
          <div className="metric-grid">
            <Metric label="CSV Rows" value={formatNumber(metadata.rawRowCount)} />
            <Metric label="Accepted Workouts" value={formatNumber(metadata.validWorkoutCount)} />
            <Metric label="Rejected Rows" value={formatNumber(metadata.invalidRowCount)} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Fun Stats" subtitle="Cycling-only comparisons derived from normalized totals.">
        <div className="fun-grid">
          <FunCard
            title="Calories Burned"
            value={`${formatNumber(totals.totalCalories)} calories`}
            comparisons={[
              `Big Macs: ${formatNumber(funStats.bigMacs, 1)}`,
              `Hours of TV: ${formatNumber(funStats.tvHours, 1)}`,
            ]}
          />
          <FunCard
            title="Distance Travelled"
            value={`${formatNumber(totals.totalDistanceKm, 1)} km`}
            comparisons={[
              `Around the world: ${formatNumber(funStats.aroundWorldPercent, 2)}%`,
              `To the moon: ${formatNumber(funStats.toMoonPercent, 4)}%`,
            ]}
          />
          <FunCard
            title="Output Produced"
            value={`${formatNumber(totals.totalOutputKj)} kJ`}
            comparisons={[
              `100 kW car engine: ${formatNumber(funStats.carEngineHours, 1)} hours`,
              `60W bulb: ${formatNumber(funStats.lightBulbDays, 1)} days`,
            ]}
          />
        </div>
      </SectionCard>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FunCard({ title, value, comparisons }: { title: string; value: string; comparisons: string[] }) {
  return (
    <article className="fun-card">
      <h3>{title}</h3>
      <strong>{value}</strong>
      <ul>
        {comparisons.map((comparison) => (
          <li key={comparison}>{comparison}</li>
        ))}
      </ul>
    </article>
  );
}
