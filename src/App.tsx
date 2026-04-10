import { useLayoutEffect, useMemo, useState, useTransition } from 'react';
import type { RideType, RawWorkoutRow, AnalyticsResult, UnitSystem } from './domain/types';
import { normalizeWorkouts, parseCsvFile } from './lib/peloton';
import { computeAnalytics } from './lib/analytics';
import { UploadPanel } from './features/upload/UploadPanel';
import { StatsSections } from './features/stats/StatsSections';
import { ChartsSection } from './features/charts/ChartsSection';
import { PRSection } from './features/prs/PRSection';
import { StreaksSection } from './features/streaks/StreaksSection';

type ProcessingState = 'idle' | 'ready' | 'error';

export default function App() {
  const [sourceRows, setSourceRows] = useState<RawWorkoutRow[]>([]);
  const [analysis, setAnalysis] = useState<AnalyticsResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingState>('idle');
  const [statusMessage, setStatusMessage] = useState('Select a Peloton workout CSV to begin.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRideType, setSelectedRideType] = useState<RideType>('regular');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [selectedPRIndex, setSelectedPRIndex] = useState(0);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [darkMode, setDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const canReprocess = sourceRows.length > 0 && status !== 'error';

  const headline = useMemo(() => {
    if (!analysis) {
      return 'Client-side Peloton workout analytics with a deterministic data pipeline.';
    }

    return `${analysis.metadata.validWorkoutCount} workouts normalized from ${analysis.metadata.rawRowCount} CSV row${analysis.metadata.rawRowCount === 1 ? '' : 's'}.`;
  }, [analysis]);

  async function handleSelectFile(file: File | null) {
    if (!file) {
      return;
    }

    setErrorMessage(null);
    setFileName(file.name);
    setStatusMessage(`Parsing ${file.name}…`);

    try {
      const rows = await parseCsvFile(file);
      setSourceRows(rows);
      processRows(rows, file.name);
    } catch (error) {
      setAnalysis(null);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to parse the CSV file.');
      setStatusMessage('CSV parsing failed.');
    }
  }

  function processRows(rows: RawWorkoutRow[], currentFileName: string | null) {
    setStatusMessage(`Normalizing ${rows.length} rows…`);
    startTransition(() => {
      const normalization = normalizeWorkouts(rows);
      const nextAnalysis = computeAnalytics(rows.length ? normalization.workouts : [], rows.length, normalization.issues.length);

      setAnalysis(nextAnalysis);
      setStatus('ready');
      setSelectedRideType('regular');
      setSelectedDuration(resolveDefaultDuration(nextAnalysis));
      setSelectedPRIndex(0);
      setFileName(currentFileName);
      setStatusMessage(
        normalization.issues.length === 0
          ? 'Data processed successfully.'
          : `Processed with ${normalization.issues.length} rejected row${normalization.issues.length === 1 ? '' : 's'}.`,
      );
    });
  }

  function handleReprocess() {
    if (sourceRows.length === 0) {
      return;
    }

    setErrorMessage(null);
    processRows(sourceRows, fileName);
  }

  function handleSelectRideType(nextRideType: RideType) {
    setSelectedRideType(nextRideType);
    setSelectedPRIndex(0);
  }

  function handleSelectDuration(nextDuration: number) {
    setSelectedDuration(nextDuration);
    setSelectedPRIndex(0);
  }

  function handleNavigatePR(direction: 'older' | 'newer') {
    if (!analysis) {
      return;
    }

    const records = analysis.personalRecords[selectedRideType][selectedDuration] ?? [];

    setSelectedPRIndex((current) => {
      if (direction === 'older') {
        return Math.min(current + 1, Math.max(0, records.length - 1));
      }
      return Math.max(current - 1, 0);
    });
  }

  return (
    <div className="app-shell">
      <header className="app-shell__hero">
        <div>
          <p className="eyebrow">SweatSheet Rebuilt</p>
          <h1>Peloton analytics that stay local and behave predictably.</h1>
        </div>
        <p>{headline}</p>
      </header>

      <UploadPanel
        fileName={fileName}
        isBusy={isPending}
        canReprocess={canReprocess}
        statusMessage={statusMessage}
        onSelectFile={handleSelectFile}
        onReprocess={handleReprocess}
      />

      <div className="settings-fab">
        <button
          className={`settings-fab__trigger${settingsOpen ? ' settings-fab__trigger--open' : ''}`}
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen}
          aria-label="Settings"
        >
          ⚙ Settings
        </button>
        <div className={`settings-fab__panel${settingsOpen ? ' settings-fab__panel--open' : ''}`}>
          <div className="fab-pill" role="group" aria-label="Theme">
            <button
              className={`fab-pill__btn${!darkMode ? ' fab-pill__btn--active' : ''}`}
              onClick={() => darkMode && setDarkMode(false)}
            >
              ☀
            </button>
            <button
              className={`fab-pill__btn${darkMode ? ' fab-pill__btn--active' : ''}`}
              onClick={() => !darkMode && setDarkMode(true)}
            >
              ☾
            </button>
          </div>
          <div className="fab-pill" role="group" aria-label="Unit system">
            <button
              className={`fab-pill__btn${unitSystem === 'metric' ? ' fab-pill__btn--active' : ''}`}
              onClick={() => unitSystem !== 'metric' && setUnitSystem('metric')}
            >
              km
            </button>
            <button
              className={`fab-pill__btn${unitSystem === 'imperial' ? ' fab-pill__btn--active' : ''}`}
              onClick={() => unitSystem !== 'imperial' && setUnitSystem('imperial')}
            >
              mi
            </button>
          </div>
        </div>
      </div>

      {status === 'error' ? <div className="banner banner--error">{errorMessage ?? 'The CSV could not be processed.'}</div> : null}

      {!analysis ? (
        <div className="empty-panel">
          <h2>Ready for your CSV</h2>
          <p>Upload your Peloton workout export to render charts, PRs, trends, streaks, and heatmaps from a normalized dataset.</p>
        </div>
      ) : (
        <main className="dashboard">
          <StatsSections analytics={analysis} unitSystem={unitSystem} />
          <ChartsSection analytics={analysis} />
          <PRSection
            analytics={analysis}
            rideType={selectedRideType}
            duration={selectedDuration}
            index={selectedPRIndex}
            unitSystem={unitSystem}
            onSelectRideType={handleSelectRideType}
            onSelectDuration={handleSelectDuration}
            onNavigate={handleNavigatePR}
          />
          <StreaksSection analytics={analysis} />
        </main>
      )}
    </div>
  );
}

function resolveDefaultDuration(analysis: AnalyticsResult): number {
  const preferred = 30;
  const durations = analysis.availableDurations;
  if (durations.includes(preferred)) {
    return preferred;
  }

  return durations[0] ?? 30;
}
