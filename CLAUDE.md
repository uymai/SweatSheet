# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (localhost)
npm run build     # Type-check then build for production
npm run preview   # Preview the production build locally
npm run test      # Run tests with Vitest (single run)
npm run lint      # Run ESLint
```

To run a single test file:
```bash
npx vitest run src/lib/analytics.test.ts
```

## Architecture

SweatSheet is a fully client-side React/TypeScript app (no backend) that parses a Peloton workout CSV export and renders analytics in the browser. All data stays local.

### Data pipeline (the core of the app)

1. **`src/lib/peloton.ts`** — CSV parsing and normalization  
   - `parseCsvFile` wraps PapaParse to produce `RawWorkoutRow[]`  
   - `normalizeWorkouts` maps raw rows → typed `Workout[]`, rejecting rows with missing timestamps or zero-length durations and collecting them as `ParseIssue[]`  
   - Handles Peloton's quirky timestamp format (`2023-01-01 09:00 (EST)`) via `parsePelotonTimestamp`

2. **`src/lib/analytics.ts`** — Pure computation over normalized workouts  
   - `computeAnalytics` takes `Workout[]` and produces the full `AnalyticsResult` in one pass  
   - Computes: totals, fun-stats, distributions, personal records (PRs), trend points, streaks, heatmap months

3. **`src/domain/types.ts`** — Single source of truth for all domain types (`Workout`, `AnalyticsResult`, `PersonalRecord`, etc.)

### Component structure

`App.tsx` owns all state and orchestrates the pipeline. It passes `AnalyticsResult` down to four feature sections, each living under `src/features/`:

| Feature | Component | What it renders |
|---|---|---|
| `upload/` | `UploadPanel` | File picker, status, reprocess button |
| `stats/` | `StatsSections` | Totals cards and fun stats |
| `charts/` | `ChartsSection` | Recharts visualizations (type distribution, trend, heatmap, day distribution) |
| `prs/` | `PRSection` | PR browser with ride type / duration / index navigation |
| `streaks/` | `StreaksSection` | Strict and lenient streak display |

`SectionCard` (`src/components/SectionCard.tsx`) is a shared wrapper used by all feature sections.

### Key design decisions

- **PR tracking**: PRs are indexed by `RideType` (`regular` | `lanebreak`) and duration in minutes. The `personalRecords` field on `AnalyticsResult` is `Record<RideType, Record<number, PersonalRecord[]>>` where the array is the PR progression (newest first, index 0 = current PR).
- **Cycling flag**: A workout is "cycling" if `Fitness Discipline` contains "cycl" or it is LaneBreak. LaneBreak rides are always cycling but are tracked separately for PRs.
- **"Just Ride" exclusion**: Workouts with "just ride" in their descriptor are excluded from PR tracking because they lack structured output data.
- **Heatmap**: Always renders the trailing 12 calendar months relative to today (computed at render time in `analytics.ts`).
- **Production base path**: Vite sets `base: '/SweatSheet/'` in production mode for GitHub Pages hosting.

### Testing

Tests use Vitest + jsdom. The setup file is `src/test/setup.ts`. There are currently tests for `analytics.ts` and `peloton.ts` in `src/lib/`.
