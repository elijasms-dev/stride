'use client';
import { TrainingInsights, WorkoutGuide } from './training';
import { useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import {
  dateLabel,
  kmDisplay,
  dayDiff,
  type Plan,
  type Workout,
} from '@/lib/engine';
import {
  journalEntries,
  journalSummary,
  runDuration,
} from '@/lib/journal-view';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [metric, setMetric] = useState('distance');
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
  const weekly = plan.weeks.map((week) => {
    const runs = records.filter(
      (r) => r.date >= week.start && dayDiff(week.start, r.date) < 7,
    );
    return {
      week,
      runs: runs.length,
      missing: runs.filter((r) => r.km === null).length,
      km: runs.reduce((n, r) => n + (r.km ?? 0), 0),
      minutes: runs.reduce((n, r) => n + r.minutes, 0),
    };
  });
  const chartMax = Math.max(
    1,
    ...weekly.map((w) => (metric === 'distance' ? w.km : w.minutes)),
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
      <div className="progress-metrics">
        <div>
          <span>Runs logged</span>
          <strong>{totals.count}</strong>
          <small>Your recorded running</small>
        </div>
        <div>
          <span>Recorded distance</span>
          <strong>
            {totals.km === null
              ? '—'
              : kmDisplay(totals.km, plan.profile.units)}{' '}
            {totals.km !== null && <small>{plan.profile.units}</small>}
          </strong>
          <small>
            {totals.missingDistances
              ? `${totals.missingDistances} ${totals.missingDistances === 1 ? 'run without' : 'runs without'} distance`
              : totals.count
                ? 'All logged distances'
                : 'No distances recorded'}
          </small>
        </div>
        <div>
          <span>Time running</span>
          <strong className="journal-time-total">
            {runDuration(totals.minutes)}
          </strong>
          <small>From your recorded runs</small>
        </div>
      </div>
      {records.length === 0 ? (
        <div className="empty-panel progress-empty">
          <EmptyRunChart />
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
          {!isDemo && (
            <details className="progress-chart-section journal-chart-disclosure">
              <summary>View weekly totals</summary>
              <div className="section-heading">
                <h3>Training, week by week</h3>
                <Tabs value={metric} onValueChange={setMetric}>
                  <TabsList aria-label="Weekly total measure">
                    <TabsTrigger value="distance">Distance</TabsTrigger>
                    <TabsTrigger value="time">Time</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="progress-week-bars">
                {weekly.map(({ week: w, runs, missing, km, minutes }) => {
                  const actual = metric === 'distance' ? km : minutes;
                  const unknown =
                    !runs || (metric === 'distance' && missing === runs);
                  return (
                    <div key={w.index}>
                      <span>
                        {unknown
                          ? '—'
                          : metric === 'distance'
                            ? kmDisplay(actual, plan.profile.units)
                            : actual}
                      </span>
                      <i
                        style={{
                          height: `${unknown ? 0 : (actual / chartMax) * 100}%`,
                        }}
                      />
                      <small>W{w.index + 1}</small>
                    </div>
                  );
                })}
              </div>
              <p className="subtle">
                Actual {metric === 'distance' ? plan.profile.units : 'minutes'}{' '}
                · weeks of your current plan. Only recorded runs count; a dash
                means no recorded value. Missing distances are excluded from
                distance totals.
              </p>
            </details>
          )}
        </>
      )}
      <details
        className="progress-disclosure"
        onToggle={(e) => setInsightsOpen(e.currentTarget.open)}
      >
        <summary>
          Training insights <span>Your last four weeks</span>
        </summary>
        {insightsOpen && (
          <TrainingInsights
            plan={plan}
            today={today}
            isDemo={isDemo}
            onWorkout={onWorkout}
            onExtra={onExtra}
          />
        )}
      </details>
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
function EmptyRunChart() {
  return (
    <svg
      className="empty-run-chart"
      viewBox="0 0 160 112"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 20H148M16 48H148M16 76H148M16 104H148"
        stroke="currentColor"
        opacity=".2"
      />
      <rect
        x="28"
        y="65"
        width="20"
        height="39"
        rx="4"
        fill="var(--selection-surface)"
        stroke="currentColor"
        strokeDasharray="4 4"
      />
      <rect
        x="65"
        y="44"
        width="20"
        height="60"
        rx="4"
        fill="var(--selection-surface)"
        stroke="currentColor"
        strokeDasharray="4 4"
      />
      <rect
        x="102"
        y="22"
        width="20"
        height="82"
        rx="4"
        fill="var(--selection-surface)"
        stroke="currentColor"
        strokeDasharray="4 4"
      />
    </svg>
  );
}
