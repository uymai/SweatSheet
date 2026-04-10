import { SectionCard } from '../../components/SectionCard';
import type { AnalyticsResult, RideType, UnitSystem } from '../../domain/types';
import { formatDateLabel, formatDistance, formatNumber, formatSpeed } from '../../lib/format';

interface PRSectionProps {
  analytics: AnalyticsResult;
  rideType: RideType;
  duration: number;
  index: number;
  unitSystem: UnitSystem;
  onSelectRideType: (rideType: RideType) => void;
  onSelectDuration: (duration: number) => void;
  onNavigate: (direction: 'older' | 'newer') => void;
}

export function PRSection({
  analytics,
  rideType,
  duration,
  index,
  unitSystem,
  onSelectRideType,
  onSelectDuration,
  onNavigate,
}: PRSectionProps) {
  const records = analytics.personalRecords[rideType][duration] ?? [];
  const current = records[index] ?? null;
  const newer = index > 0 ? records[index - 1] : null;

  return (
    <SectionCard title="Personal Records" subtitle="PR progression is derived once from the normalized cycling dataset.">
      <div className="tab-row">
        <button className={`chip${rideType === 'regular' ? ' chip--active' : ''}`} onClick={() => onSelectRideType('regular')}>
          Regular Rides
        </button>
        <button className={`chip${rideType === 'lanebreak' ? ' chip--active' : ''}`} onClick={() => onSelectRideType('lanebreak')}>
          LaneBreak
        </button>
      </div>

      <div className="tab-row tab-row--dense">
        {analytics.availableDurations.map((option) => (
          <button
            key={option}
            className={`chip${duration === option ? ' chip--active' : ''}`}
            onClick={() => onSelectDuration(option)}
          >
            {option === 120 ? '2 hr' : `${option} min`}
          </button>
        ))}
      </div>

      {!current ? (
        <div className="empty-state">No {rideType === 'regular' ? 'regular' : 'LaneBreak'} PRs were found for {duration} minutes.</div>
      ) : (
        <div className="pr-card">
          <div className="pr-card__headline">
            <div>
              <h3>{current.title}</h3>
              <p>{current.type || 'Cycling'} • {current.lengthMinutes} min</p>
            </div>
            <strong>{formatNumber(current.outputKj)} kJ</strong>
          </div>

          <div className="metric-grid">
            <Metric label="Instructor" value={current.instructor} />
            <Metric label="Class Date" value={formatDateLabel(current.classDayKey)} />
            <Metric label="Workout Date" value={formatDateLabel(current.workoutDayKey)} />
            <Metric label="Avg Watts" value={formatNullable(current.metrics.avgWatts, ' W')} />
            <Metric label="Avg Resistance" value={formatNullable(current.metrics.avgResistance)} />
            <Metric label="Avg Cadence" value={formatNullable(current.metrics.avgCadence, ' RPM')} />
            <Metric label="Avg Speed" value={formatSpeed(current.metrics.avgSpeedKph, unitSystem)} />
            <Metric label="Distance" value={current.metrics.distanceKm === null ? '-' : formatDistance(current.metrics.distanceKm, unitSystem)} />
            <Metric label="Calories" value={formatNullable(current.metrics.calories)} />
            <Metric label="Avg Heart Rate" value={formatNullable(current.metrics.avgHeartRate, ' bpm')} />
          </div>

          <div className="pr-card__footer">
            <span>{newer ? `Beaten by ${formatNumber(newer.outputKj - current.outputKj, 1)} kJ` : 'Latest PR'}</span>
            <div className="tab-row">
              <button className="button button--secondary" disabled={index >= records.length - 1} onClick={() => onNavigate('older')}>
                Older PR
              </button>
              <button className="button button--secondary" disabled={index === 0} onClick={() => onNavigate('newer')}>
                Newer PR
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
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

function formatNullable(value: number | null, suffix = ''): string {
  return value === null ? '-' : `${formatNumber(value, value % 1 === 0 ? 0 : 1)}${suffix}`;
}
