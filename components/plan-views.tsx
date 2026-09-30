'use client';
import { WorkoutGuide } from './training';
import { useId, useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { dateLabel, kmDisplay, type Plan, type Workout } from '@/lib/engine';
import {
  journalEntries,
  journalSummary,
  runDuration,
} from '@/lib/journal-view';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { progressChartWeeks } from '@/lib/progress-chart';
import { DrawnUnderline } from './drawn-ui';
import { ProgressionChart } from './plan/progression-chart';
export { FullPlan } from './plan/plan-explorer';
export function ProgressView({
  today,
  plan,
  onWorkout,
  isDemo,
  onExtra,
  onCorrectExtra,
}: {
  today: string;
  plan: Plan;
  onWorkout: (w: Workout) => void;
  isDemo: boolean;
  onExtra: () => void;
  onCorrectExtra: (r: import('@/lib/engine').ExtraRun) => void;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [metric, setMetric] = useState('distance');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [visible, setVisible] = useState(20);
  const entries = journalEntries(plan);
  const records = entries.map((entry) => entry.record);
  const totals = journalSummary(entries);
  const rated = entries.flatMap((entry) =>
    entry.kind === 'planned' && entry.workout.feedback?.enjoyment
      ? [entry.workout.feedback.enjoyment]
      : [],
  );
  const shown = entries.slice(0, visible);
  const weekly = progressChartWeeks(plan, today, !isDemo);
  const chartId = useId().replace(/:/g, '');
  const value = (amount: number | null) =>
    amount === null
      ? 'Not estimated'
      : metric === 'distance'
        ? `${kmDisplay(amount, plan.profile.units)} ${plan.profile.units}`
        : runDuration(amount);
  const chartMax = Math.max(
    1,
    ...weekly.map(
      (week) =>
        (metric === 'distance' ? week.recorded.km : week.recorded.minutes) ?? 0,
    ),
  );
  const selectedTotals =
    weekly.find((week) => week.index === selectedWeek) ??
    weekly.find((week) => week.start <= today && week.end >= today) ??
    (today < weekly[0]?.start ? weekly[0] : weekly.at(-1));
  const selectedRecorded = selectedTotals
    ? metric === 'distance'
      ? selectedTotals.recorded.km
      : selectedTotals.recorded.minutes
    : null;
  const weekLabel = (week: (typeof weekly)[number]) =>
    isDemo ? dateLabel(week.start) : `Week ${week.index + 1}`;
  const recordedChart = (
    <section
      className="progression-chart"
      aria-labelledby="progression-heading"
    >
      <div className="progression-chart-heading">
        <div>
          <h2 id="progression-heading" className="ink-heading">
            Your recorded running
            <DrawnUnderline />
          </h2>
          <p>
            {isDemo
              ? 'Your last 12 weeks'
              : 'Completed runs during your current plan'}
          </p>
        </div>
        <Tabs value={metric} onValueChange={setMetric}>
          <TabsList aria-label="Progression measure">
            <TabsTrigger value="distance">Distance</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="progression-legend" aria-label="Chart key">
        <span>
          <i className="progression-recorded-key" />
          Recorded
        </span>
        <span className="progression-axis-unit">
          {metric === 'distance' ? plan.profile.units : 'minutes'} per week
        </span>
      </div>
      <div className="progression-plot-wrap">
        <div className="progression-y-axis" aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <span
              key={fraction}
              style={{ top: `${((184 - fraction * 174) / 188) * 100}%` }}
            >
              {metric === 'distance'
                ? kmDisplay(chartMax * fraction, plan.profile.units)
                : Math.round(chartMax * fraction)}
            </span>
          ))}
        </div>
        <div className="progression-plot-content">
          <svg
            className="progression-plot"
            viewBox="64 12 922 188"
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Inline SVG requires image semantics for its title and description.
            role="img"
            aria-labelledby={`${chartId}-title ${chartId}-description`}
            preserveAspectRatio="none"
          >
            <title id={`${chartId}-title`}>
              {`Weekly ${metric === 'distance' ? 'distance' : 'running time'}`}
            </title>
            <desc id={`${chartId}-description`}>
              Hatched bars show recorded totals. Use the week selector below for
              exact values. Unrecorded values have no bar.
            </desc>
            <defs>
              <pattern
                id={`${chartId}-hatch`}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(35)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </pattern>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <g key={fraction} className="progression-gridline">
                <line
                  x1="64"
                  x2="986"
                  y1={196 - fraction * 174}
                  y2={196 - fraction * 174}
                />
              </g>
            ))}
            {weekly.map((week, position) => {
              const slot = 908 / Math.max(1, weekly.length);
              const center = 72 + (position + 0.5) * slot;
              const width = Math.min(30, slot * 0.62);
              const recorded =
                metric === 'distance'
                  ? week.recorded.km
                  : week.recorded.minutes;
              const selected = selectedTotals?.index === week.index;
              return (
                <g key={week.start}>
                  {selected && (
                    <rect
                      className="progression-selected-column"
                      x={center - slot / 2 + 1}
                      y="12"
                      width={slot - 2}
                      height="188"
                      rx="4"
                    />
                  )}
                  {recorded !== null && recorded > 0 && (
                    <rect
                      className="progression-recorded-bar"
                      x={center - width / 2}
                      y={196 - (recorded / chartMax) * 174}
                      width={width}
                      height={(recorded / chartMax) * 174}
                      rx="2"
                      fill={`url(#${chartId}-hatch)`}
                    />
                  )}
                  {recorded === 0 && (
                    <circle
                      className="progression-zero"
                      cx={center}
                      cy="196"
                      r="2.5"
                    />
                  )}
                </g>
              );
            })}
          </svg>
          <div className="progression-x-axis" aria-hidden="true">
            {weekly.map((week, position) => {
              const showLabel = Array.from({ length: 5 }, (_, tick) =>
                Math.round((tick * (weekly.length - 1)) / 4),
              ).includes(position);
              if (!showLabel) return null;
              const center =
                72 + ((position + 0.5) * 908) / Math.max(1, weekly.length);
              return (
                <span
                  key={week.start}
                  style={{ left: `${((center - 64) / 922) * 100}%` }}
                >
                  {isDemo
                    ? dateLabel(week.start, {
                        day: 'numeric',
                        month: 'short',
                      })
                    : `W${week.index + 1}`}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {selectedTotals && (
        <div className="progression-week-detail">
          <label className="progression-week-picker">
            <span>Explore a week</span>
            <select
              aria-label="Progression week"
              value={selectedTotals.index}
              onChange={(event) => setSelectedWeek(Number(event.target.value))}
            >
              {weekly.map((week) => (
                <option key={week.start} value={week.index}>
                  {weekLabel(week)} · {dateLabel(week.start)}
                  {week.phase ? ` · ${week.phase}` : ''}
                </option>
              ))}
            </select>
          </label>
          <dl aria-live="polite" aria-atomic="true">
            <div>
              <dt>
                {metric === 'distance' &&
                selectedTotals.recorded.missingDistances
                  ? 'Known recorded distance'
                  : 'Recorded total'}
              </dt>
              <dd>
                {selectedRecorded === null
                  ? 'Not recorded'
                  : value(selectedRecorded)}
              </dd>
            </div>
            <div>
              <dt>Runs logged</dt>
              <dd>{selectedTotals.recorded.runs}</dd>
            </div>
            <div>
              <dt>Recorded time</dt>
              <dd>
                {selectedTotals.recorded.minutes === null
                  ? 'Not recorded'
                  : runDuration(selectedTotals.recorded.minutes)}
              </dd>
            </div>
          </dl>
          {selectedTotals.recorded.missingDistances > 0 &&
            metric === 'distance' && (
              <p>
                {selectedTotals.recorded.missingDistances}{' '}
                {selectedTotals.recorded.missingDistances === 1
                  ? 'run has'
                  : 'runs have'}{' '}
                no distance recorded. This total is incomplete.
              </p>
            )}
        </div>
      )}
      <p className="progression-chart-note">
        {records.length === 0 ? 'No runs recorded yet. ' : ''}
        {isDemo
          ? 'Weeks without a recorded value are left blank.'
          : 'Recorded on the date you ran. Blank bars mean no recorded value.'}
      </p>
    </section>
  );
  return (
    <div className="view-wrapper progress-view">
      <div className="page-heading">
        <div>
          <h1>Your progress</h1>
        </div>
        {records.length > 0 && (
          <button className="secondary-button" onClick={onExtra}>
            Log an extra run <ArrowRight size={16} />
          </button>
        )}
      </div>
      {isDemo ? (
        recordedChart
      ) : (
        <ProgressionChart
          plan={plan}
          selected={selectedTotals?.index ?? 0}
          onSelect={setSelectedWeek}
        />
      )}
      <section
        className="journal-lifetime"
        aria-labelledby="journal-lifetime-heading"
      >
        <div className="journal-lifetime-heading">
          <h2 id="journal-lifetime-heading">All-time stats</h2>
          <p>All runs saved in your journal</p>
        </div>
        <dl className="journal-lifetime-stats">
          <div>
            <dt>Runs logged</dt>
            <dd>{totals.count}</dd>
          </div>
          <div>
            <dt>
              {totals.missingDistances
                ? 'Known recorded distance'
                : 'Recorded distance'}
            </dt>
            <dd>
              {totals.km === null
                ? '—'
                : kmDisplay(totals.km, plan.profile.units)}
              {totals.km !== null && <small> {plan.profile.units}</small>}
            </dd>
          </div>
          <div>
            <dt>Time running</dt>
            <dd>{runDuration(totals.minutes)}</dd>
          </div>
        </dl>
        {totals.missingDistances > 0 && (
          <p className="journal-lifetime-note">
            {totals.missingDistances}{' '}
            {totals.missingDistances === 1 ? 'run without' : 'runs without'}{' '}
            distance; time and run counts are included.
          </p>
        )}
      </section>
      {!isDemo && (
        <details className="progress-disclosure progress-recorded-disclosure">
          <summary>
            Recorded running by week <span>Only completed runs</span>
          </summary>
          {recordedChart}
        </details>
      )}
      {records.length === 0 ? (
        <div className="empty-panel progress-empty">
          <div className="progress-empty-copy">
            <h2>Your first run belongs here</h2>
            <p>
              {isDemo
                ? 'Log a run or import from Intervals.icu now. Your real journal stays with you when you create a plan.'
                : 'Log your first run to start seeing your training take shape here. We count what you actually did.'}
            </p>
            <button className="primary-button" onClick={onExtra}>
              Log a run
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="journal-timeline" aria-label="Running journal">
            <div className="section-heading">
              <h2>Your running journal</h2>
              <span className="subtle">Newest first</span>
            </div>
            <ol className="journal-entries" id="running-journal-entries">
              {shown.map((entry, index) => {
                const r = entry.record;
                const newMonth =
                  index === 0 ||
                  shown[index - 1].record.date.slice(0, 7) !==
                    r.date.slice(0, 7);
                const title =
                  entry.kind === 'planned' ? entry.workout.title : 'Extra run';
                return (
                  <li key={r.id}>
                    {newMonth && (
                      <h3 className="journal-month">
                        {dateLabel(r.date, { month: 'long', year: 'numeric' })}
                      </h3>
                    )}
                    <button
                      className="journal-entry"
                      onClick={() =>
                        entry.kind === 'planned'
                          ? onWorkout(entry.workout)
                          : onCorrectExtra(entry.run)
                      }
                    >
                      <time className="journal-entry-date" dateTime={r.date}>
                        <span>{dateLabel(r.date, { weekday: 'short' })}</span>
                        <strong>{dateLabel(r.date, { day: 'numeric' })}</strong>
                      </time>
                      <span className="journal-entry-body">
                        <strong>{title}</strong>
                        <span>
                          {entry.kind === 'planned'
                            ? 'From your plan'
                            : 'Outside your plan'}
                          {r.activityId
                            ? ' · Recording attached'
                            : ' · Manual log'}
                        </span>
                        <span>
                          Effort {r.effort}/10 · Feeling {r.feeling}
                        </span>
                      </span>
                      <span className="journal-entry-results">
                        <strong>{runDuration(r.minutes)}</strong>
                        <span>
                          {r.km === null
                            ? 'Distance not recorded'
                            : `${kmDisplay(r.km, plan.profile.units)} ${plan.profile.units}`}
                        </span>
                      </span>
                      <span className="journal-entry-action">
                        {entry.kind === 'planned' ? 'View run' : 'Correct run'}
                        <ChevronRight size={17} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {entries.length > visible && (
              <button
                className="secondary-button journal-show-more"
                aria-controls="running-journal-entries"
                onClick={() => setVisible((n) => n + 20)}
              >
                Show more runs{' '}
                <span>({entries.length - visible} remaining)</span>
              </button>
            )}
          </section>
        </>
      )}
      {rated.length > 0 && (
        <div className="week-rhythm">
          <span className="eyebrow">Your workout preferences</span>
          <p>
            {rated.filter((v) => v === 'yes').length} would repeat ·{' '}
            {rated.filter((v) => v === 'maybe').length} might change ·{' '}
            {rated.filter((v) => v === 'no').length} would avoid. From{' '}
            {rated.length} rated workouts; unanswered runs are excluded.
          </p>
        </div>
      )}
      <details
        className="progress-disclosure"
        onToggle={(e) => setGuideOpen(e.currentTarget.open)}
      >
        <summary>
          Workout guide <span>Understand each session</span>
        </summary>
        {guideOpen && <WorkoutGuide plan={plan} onWorkout={onWorkout} />}
      </details>
    </div>
  );
}
