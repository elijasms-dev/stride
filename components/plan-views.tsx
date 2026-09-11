'use client';
import { TrainingInsights, WorkoutGuide } from './training';
import { recordedWorkoutDate } from '@/lib/training-history';
import { desiredRuns } from '@/lib/training-structure';
import { weekSupportingSessions } from '@/lib/coaching-context';
import { PlanFit } from './plan-fit';
import { WeekRhythm } from './week-rhythm';
import { planWeekFocus } from '@/lib/plan-guidance';
import { workoutTone } from '@/lib/day-sessions';
import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Check,
  Flag,
  Minus,
  SlidersHorizontal,
  RotateCcw,
  Ellipsis,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import {
  addDays,
  dateLabel,
  kmDisplay,
  workoutDistanceLabel,
  workoutDistanceValue,
  dayDiff,
  goalLabel,
  trainingPhaseOn,
  type Plan,
  type Workout,
} from '@/lib/engine';
import {
  journalEntries,
  journalSummary,
  runDuration,
} from '@/lib/journal-view';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
export function FullPlan({
  plan,
  today,
  onWorkout,
  onDay,
  onAdjust,
  onNew,
  onVariety,
  selected,
  onSelect,
  isDemo,
}: {
  plan: Plan;
  today: string;
  onWorkout: (w: Workout) => void;
  onDay: (date: string) => void;
  onAdjust: () => void;
  onNew: () => void;
  onVariety: () => void;
  selected: number;
  onSelect: (week: number) => void;
  isDemo: boolean;
}) {
  const w = plan.weeks[selected];
  const raceBlock = plan.profile.goal !== 'base';
  const weekStart =
    w.start < plan.profile.startDate ? plan.profile.startDate : w.start;
  const phase = trainingPhaseOn(plan.profile, w.phase, weekStart);
  const daysToRace = Math.max(0, dayDiff(weekStart, plan.profile.raceDate));
  const weeksToRace = Math.ceil(daysToRace / 7);
  const countdown =
    daysToRace === 0
      ? 'Race day'
      : daysToRace < 7
        ? `${daysToRace} ${daysToRace === 1 ? 'day' : 'days'} to race`
        : `${weeksToRace} ${weeksToRace === 1 ? 'week' : 'weeks'} to race`;
  const load = (w: Plan['weeks'][number]) =>
    Math.round(w.trainingMinutes ?? w.targetKm * (plan.profile.easyPace ?? 7));
  const peak = Math.max(1, ...plan.weeks.map(load));
  const support = weekSupportingSessions(plan, selected);
  const elapsed = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (100 * dayDiff(plan.profile.startDate, today)) /
          Math.max(1, dayDiff(plan.profile.startDate, plan.profile.raceDate)),
      ),
    ),
  );
  return (
    <div className="view-wrapper plan-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {plan.weeks.length} weeks · {desiredRuns(plan.profile)} running days
            per week
          </div>
          <h1>Your plan</h1>
        </div>
        <div className="plan-heading-actions">
          <button
            className="secondary-button"
            onClick={isDemo ? onNew : onAdjust}
          >
            <SlidersHorizontal size={17} />
            {isDemo ? 'Build my plan' : 'Adjust plan'}
          </button>
          {!isDemo && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="icon-button plan-options"
                    aria-label="More plan options"
                  />
                }
              >
                <Ellipsis size={20} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="plan-options-menu">
                <DropdownMenuItem onClick={onVariety}>
                  <RefreshCw size={16} aria-hidden="true" />
                  Refresh workouts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onNew}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Restart plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <section className="plan-overview">
        <div className="plan-overview-title">
          <div>
            <div className="eyebrow">{goalLabel(plan.profile.goal)}</div>
            <h2>{plan.profile.raceName || 'Your training block'}</h2>
            <p>
              {dateLabel(plan.profile.startDate)} —{' '}
              {dateLabel(plan.profile.raceDate, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="plan-endpoint">
            <Flag size={22} />
            <span>
              {Math.max(0, dayDiff(today, plan.profile.raceDate))}
              <small>
                days to {plan.profile.goal === 'base' ? 'finish' : 'race day'}
              </small>
            </span>
          </div>
        </div>
        <div className="block-timeline">
          <div>
            <span>Training block</span>
            <strong>{elapsed}% elapsed</strong>
          </div>
          <Progress
            value={elapsed}
            aria-label="Training block time elapsed"
            aria-valuetext={`${elapsed}% of the scheduled training period has elapsed`}
          />
        </div>
        <details className="block-overview">
          <summary>
            Explore the training block{' '}
            <TrendingUp size={17} aria-hidden="true" />
          </summary>
          <div className="plan-chart">
            <div className="chart-meta">
              <span>Weekly training · minutes, excluding race</span>
              <span>{peak} min peak</span>
            </div>
            <div
              className="plan-bars"
              style={{ minWidth: `${plan.weeks.length * 30}px` }}
            >
              {plan.weeks.map((week) => (
                <button
                  key={week.index}
                  className={selected === week.index ? 'selected' : ''}
                  onClick={() => onSelect(week.index)}
                  aria-label={`Week ${week.index + 1}, ${week.phase}, ${load(week)} minutes`}
                  aria-pressed={selected === week.index}
                >
                  <i
                    className={
                      ['Recovery', 'Taper', 'Race week'].includes(week.phase)
                        ? 'recovery'
                        : ''
                    }
                    style={{ height: `${(load(week) / peak) * 100}%` }}
                  />
                  <small>{week.index + 1}</small>
                </button>
              ))}
            </div>
            <div className="chart-legend">
              <span>
                <i /> Foundation & build
              </span>
              <span>
                <i className="recovery" /> Recovery & taper
              </span>
            </div>
          </div>
        </details>
      </section>
      <div className="week-detail-heading">
        <div>
          <span className="eyebrow">
            {dateLabel(weekStart)} · {raceBlock ? countdown : phase}
          </span>
          <h2>
            {raceBlock ? phase : `Week ${selected + 1}`}
            <span className="subtle">
              {Math.round(
                w.trainingMinutes ??
                  plan.workouts
                    .filter(
                      (run) =>
                        run.week === w.index &&
                        run.kind !== 'race' &&
                        run.status !== 'skipped',
                    )
                    .reduce((n, run) => n + run.minutes, 0),
              )}{' '}
              training min
            </span>
          </h2>
        </div>
        <fieldset className="plan-week-controls" aria-label="Choose plan week">
          <button
            className="icon-button"
            aria-label="Previous plan week"
            disabled={selected === 0}
            onClick={() => onSelect(selected - 1)}
          >
            <ArrowLeft size={18} />
          </button>
          <span
            className="week-position"
            aria-live="polite"
            aria-label={`Plan week ${selected + 1} of ${plan.weeks.length}`}
          >
            {selected + 1} / {plan.weeks.length}
          </span>
          <button
            className="icon-button"
            aria-label="Next plan week"
            disabled={selected === plan.weeks.length - 1}
            onClick={() => onSelect(selected + 1)}
          >
            <ArrowRight size={18} />
          </button>
        </fieldset>
      </div>
      <div className="plan-calendar" aria-label="Seven-day training schedule">
        {Array.from({ length: 7 }, (_, index) => {
          const date = addDays(w.start, index);
          const sessions = plan.workouts.filter((s) =>
            s.status === 'completed'
              ? recordedWorkoutDate(s) === date
              : s.date === date && s.week === selected,
          );
          const extras = (plan.extraRuns ?? []).filter(
            (run) => run.date === date,
          );
          const activity = support.find((s) => s.date === date);
          const inBlock =
            date >= plan.profile.startDate && date <= plan.profile.raceDate;
          return (
            <div
              className={`calendar-day ${date === today ? 'current-day' : ''} ${sessions.length || extras.length ? 'has-run' : 'has-rest'}`}
              key={date}
            >
              <time className="calendar-date" dateTime={date}>
                <span>{dateLabel(date, { weekday: 'short' })}</span>
                <strong>{dateLabel(date, { day: 'numeric' })}</strong>
                {date === today && <small>Today</small>}
              </time>
              <div className="calendar-sessions">
                {sessions.length ? (
                  sessions.map((s) => (
                    <button
                      className="calendar-run"
                      data-tone={workoutTone(s)}
                      key={s.id}
                      onClick={() => onWorkout(s)}
                    >
                      <span className="calendar-run-kind" aria-hidden="true">
                        {s.status === 'completed' ? (
                          <Check size={17} />
                        ) : s.kind === 'race' ? (
                          <Flag size={17} />
                        ) : (
                          <i />
                        )}
                      </span>
                      <span className="calendar-run-name">
                        <strong>
                          {s.title}
                          {s.session ? ` · ${s.session}` : ''}
                        </strong>
                        <small>
                          {s.status === 'completed'
                            ? 'Completed'
                            : s.status === 'skipped'
                              ? 'Skipped'
                              : s.kind === 'race'
                                ? 'Race day'
                                : s.hard
                                  ? 'Quality session'
                                  : s.kind === 'long'
                                    ? 'Long run'
                                    : 'Easy effort'}
                          {s.changed ? ' · Adjusted' : ''}
                        </small>
                      </span>
                      <span className="calendar-run-duration">
                        <strong>
                          {s.status === 'completed' && s.feedback
                            ? s.feedback.actualKm === null
                              ? runDuration(s.feedback.actualMinutes)
                              : `${kmDisplay(s.feedback.actualKm, plan.profile.units)} ${plan.profile.units}`
                            : workoutDistanceValue(s, plan.profile) === '—'
                              ? runDuration(s.minutes)
                              : workoutDistanceLabel(s, plan.profile)}
                        </strong>
                        <small>
                          {runDuration(
                            s.status === 'completed' && s.feedback
                              ? s.feedback.actualMinutes
                              : s.minutes,
                          )}{' '}
                          {s.status === 'completed'
                            ? 'recorded'
                            : s.steps.some((step) => step.metres !== undefined)
                              ? 'estimated'
                              : 'duration'}
                        </small>
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  ))
                ) : extras.length ? null : (
                  <button
                    type="button"
                    className="calendar-day-link"
                    onClick={() => onDay(date)}
                    aria-label={`${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${!inBlock ? 'open daily guide' : (activity?.title ?? 'Rest day, open daily guide')}`}
                  >
                    <Minus size={17} aria-hidden="true" />
                    <span>
                      <strong>
                        {!inBlock
                          ? date < plan.profile.startDate
                            ? 'Before your plan'
                            : 'After your block'
                          : (activity?.title ?? 'Rest day')}
                      </strong>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
                {extras.length > 0 && (
                  <button
                    type="button"
                    className="calendar-day-link recorded-extra"
                    onClick={() => onDay(date)}
                  >
                    <Check size={17} aria-hidden="true" />
                    <span>
                      <strong>
                        {extras.length === 1
                          ? 'Extra run recorded'
                          : `${extras.length} extra runs recorded`}
                      </strong>
                      <small>
                        {runDuration(
                          extras.reduce((sum, run) => sum + run.minutes, 0),
                        )}{' '}
                        recorded
                      </small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <details className="reason-details calendar-week-notes">
        <summary>About this week</summary>
        <p className="week-focus">{planWeekFocus(plan, w)}</p>
        <WeekRhythm plan={plan} week={selected} />
      </details>
      <div className="plan-note">
        {support.length > 0 && (
          <section
            className="supporting-week"
            aria-label="Supporting activities"
          >
            <h3>Alongside your running</h3>
            <p className="subtle">
              Optional supporting work, separate from your running total.
            </p>
            {support.map((s) => (
              <details className="reason-details" key={s.date}>
                <summary>
                  {dateLabel(s.date, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  · {s.title} · {s.minutes} min
                </summary>
                <p>{s.notes}</p>
              </details>
            ))}
          </section>
        )}
        <PlanFit plan={plan} asOf={today} />
        {isDemo && (
          <button className="text-button" onClick={onNew}>
            Make it yours <ArrowUpRight size={17} />
          </button>
        )}
        {!isDemo && (
          <a className="text-button" href="/api/export?format=program" download>
            Download training program · JSON <ArrowUpRight size={17} />
          </a>
        )}
      </div>
    </div>
  );
}
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
