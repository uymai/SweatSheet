import { useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SectionCard } from '../../components/SectionCard';
import type { AnalyticsResult, NamedCount, TrendPoint } from '../../domain/types';
import { formatNumber } from '../../lib/format';

const CHART_COLORS = ['#1f6feb', '#ff6a3d', '#1fbf75', '#ffb400', '#6f42c1', '#0ea5e9', '#c026d3', '#334155'];

const CYCLING_DISCIPLINES = new Set(['Cycling', 'LaneBreak']);

interface ChartsSectionProps {
  analytics: AnalyticsResult;
}

export function ChartsSection({ analytics }: ChartsSectionProps) {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>(
    analytics.trendDisciplines.find((d) => CYCLING_DISCIPLINES.has(d)) ?? analytics.trendDisciplines[0] ?? 'Cycling',
  );
  const [selectedLength, setSelectedLength] = useState<number | null>(null);

  const isCycling = CYCLING_DISCIPLINES.has(selectedDiscipline);

  const disciplinePoints = analytics.trendPoints.filter((p) => p.discipline === selectedDiscipline);

  const availableLengths = [...new Set(disciplinePoints.map((p) => p.lengthMinutes))].sort((a, b) => a - b);

  const filteredPoints = selectedLength
    ? disciplinePoints.filter((p) => p.lengthMinutes === selectedLength)
    : disciplinePoints;

  const displayPoints = addMovingAverage(
    filteredPoints.map((p) => ({
      ...p,
      value: isCycling ? (p.outputKj ?? 0) : (p.calories ?? 0),
    })),
  );

  const valueUnit = isCycling ? 'kJ' : 'cal';

  function handleSelectDiscipline(discipline: string) {
    setSelectedDiscipline(discipline);
    setSelectedLength(null);
  }

  return (
    <>
      <div className="stats-grid stats-grid--charts">
        <ChartCard title="Workout Type Distribution" data={analytics.distributions.workoutTypes} chart={<WorkoutTypeChart data={analytics.distributions.workoutTypes} />} />
        <ChartCard title="Workout Time Distribution" data={analytics.distributions.durations} chart={<BarDistributionChart data={analytics.distributions.durations} dataKey="value" />} />
        <InstructorsCard data={analytics.distributions.instructors} />
      </div>

      <SectionCard
        title="Performance Trends"
        subtitle="Output progression from the normalized dataset."
        actions={
          <div className="chip-row">
            <button className={`chip${selectedLength === null ? ' chip--active' : ''}`} onClick={() => setSelectedLength(null)}>
              All
            </button>
            {availableLengths.map((length) => (
              <button
                key={length}
                className={`chip${selectedLength === length ? ' chip--active' : ''}`}
                onClick={() => setSelectedLength(length)}
              >
                {length} min
              </button>
            ))}
          </div>
        }
      >
        <div className="tab-row" style={{ marginBottom: 16 }}>
          {analytics.trendDisciplines.map((discipline) => (
            <button
              key={discipline}
              className={`chip${selectedDiscipline === discipline ? ' chip--active' : ''}`}
              onClick={() => handleSelectDiscipline(discipline)}
            >
              {discipline}
            </button>
          ))}
        </div>

        {displayPoints.length === 0 ? (
          <EmptyState message="No workouts with performance data were found for this filter." />
        ) : (
          <div className="chart-frame chart-frame--large">
            <ResponsiveContainer>
              <LineChart data={displayPoints}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="workoutNumber" />
                <YAxis />
                <Tooltip content={<TrendTooltip valueUnit={valueUnit} />} />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#1f6feb" strokeWidth={2} dot={{ r: 3 }} name={isCycling ? 'Output' : 'Calories'} />
                <Line type="monotone" dataKey="movingAverage" stroke="#ff6a3d" strokeWidth={2} dot={false} name="Moving average" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </>
  );
}

function TrendTooltip({ active, payload, label, valueUnit }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: number;
  valueUnit: string;
}) {
  if (!active || !payload?.length) return null;
  const point = (payload[0] as any).payload as TrendPoint & { value: number; movingAverage?: number };

  return (
    <div className="trend-tooltip">
      <p className="trend-tooltip__label">Workout #{label} ({point.dateLabel})</p>
      {payload.map((entry) => (
        <p key={entry.name} className="trend-tooltip__value" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value, 1)} {valueUnit}
        </p>
      ))}
      <p className="trend-tooltip__instructor">{point.instructor}</p>
    </div>
  );
}

function InstructorsCard({ data }: { data: NamedCount[] }) {
  const [view, setView] = useState<'top5' | 'all'>('top5');
  const top5 = data.slice(0, 5);

  return (
    <SectionCard
      title="Top Instructors"
      actions={
        <div className="chip-row">
          <button className={`chip${view === 'top5' ? ' chip--active' : ''}`} onClick={() => setView('top5')}>Top 5</button>
          <button className={`chip${view === 'all' ? ' chip--active' : ''}`} onClick={() => setView('all')}>All</button>
        </div>
      }
    >
      {data.length === 0 ? (
        <EmptyState message="No data available yet." />
      ) : view === 'top5' ? (
        <BarDistributionChart data={top5} dataKey="value" />
      ) : (
        <div className="instructor-table-frame">
          <table className="instructor-table">
            <thead>
              <tr>
                <th>Instructor</th>
                <th>Classes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={row.label}>
                  <td>{index + 1}. {row.label}</td>
                  <td>{formatNumber(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function ChartCard({ title, data, chart }: { title: string; data: NamedCount[]; chart: ReactNode }) {
  return (
    <SectionCard title={title}>
      {data.length === 0 ? <EmptyState message="No data available yet." /> : chart}
    </SectionCard>
  );
}

function WorkoutTypeChart({ data }: { data: NamedCount[] }) {
  return (
    <div className="chart-frame">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" outerRadius={100}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarDistributionChart({ data, dataKey }: { data: NamedCount[]; dataKey: 'value' }) {
  return (
    <div className="chart-frame">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(value) => formatTooltipValue(value)} />
          <Bar dataKey={dataKey} fill="#1f6feb" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function addMovingAverage(points: (TrendPoint & { value: number })[]) {
  return points.map((point, index) => {
    const start = Math.max(0, index - 2);
    const window = points.slice(start, index + 1);
    const movingAverage = window.reduce((sum, entry) => sum + entry.value, 0) / window.length;
    return { ...point, movingAverage: Number(movingAverage.toFixed(1)) };
  });
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function formatTooltipValue(value: string | number | readonly (string | number)[] | undefined, suffix = '', digits = 0): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  const numericValue = typeof candidate === 'number' ? candidate : Number.parseFloat(candidate ?? '0');
  return `${formatNumber(Number.isFinite(numericValue) ? numericValue : 0, digits)}${suffix}`;
}
