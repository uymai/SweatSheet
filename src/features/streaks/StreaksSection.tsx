import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionCard } from '../../components/SectionCard';
import type { AnalyticsResult } from '../../domain/types';
import { formatNumber } from '../../lib/format';

interface StreaksSectionProps {
  analytics: AnalyticsResult;
}

export function StreaksSection({ analytics }: StreaksSectionProps) {
  return (
    <div className="stats-grid stats-grid--streaks">
      <SectionCard title="Streaks" subtitle="Workout-day streaks use the normalized source day key, not timezone-stripped ISO conversions.">
        <div className="metric-grid">
          <Metric label="Strict Longest Streak" value={`${analytics.streaks.strict} days`} />
          <Metric label="Lenient Longest Streak" value={`${analytics.streaks.lenient} days`} />
          <Metric
            label="Favorite Workout Day"
            value={
              analytics.favoriteDay
                ? `${analytics.favoriteDay.day} (${formatNumber(analytics.favoriteDay.count)} workouts)`
                : 'No data'
            }
          />
        </div>

        <div className="chart-frame">
          <ResponsiveContainer>
            <BarChart data={analytics.distributions.favoriteDayDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => formatNumber(normalizeTooltipValue(value))} />
              <Bar dataKey="value" fill="#1fbf75" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Workout Calendar" subtitle="Last 12 months of valid workouts, grouped by source workout day.">
        <div className="heatmap-list">
          {analytics.heatmapMonths.map((month) => (
            <div key={month.key} className="heatmap-month">
              <h3>{month.label}</h3>
              <div className="heatmap-grid">
                {month.cells.map((cell) => (
                  <div
                    key={cell.key}
                    className={`heatmap-cell heatmap-cell--${cell.level}${cell.dayNumber === null ? ' heatmap-cell--blank' : ''}`}
                    title={cell.dayNumber === null ? '' : `${cell.key}: ${cell.count} workout${cell.count === 1 ? '' : 's'}`}
                  >
                    {cell.dayNumber}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
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

function normalizeTooltipValue(value: string | number | readonly (string | number)[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = typeof candidate === 'number' ? candidate : Number.parseFloat(candidate ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}
