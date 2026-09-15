'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { workoutTone } from '@/lib/day-sessions';
import { relativeDayLabel } from '@/lib/form-values';
import { runDuration } from '@/lib/journal-view';
import { mainWorkoutTarget, targetLabel } from '@/lib/workout-targets';
import { ChevronRight, Moon } from 'lucide-react';
import { DateRail } from '../date-rail';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { TabsContent } from '@/components/ui/tabs';
import { dateLabel, kmDisplay, workoutDistanceValue } from '@/lib/engine';
import { prescribedDistanceKm } from '@/lib/run-distance';
import { Check } from 'lucide-react';
import { UpcomingSessions } from '../journal-panels';
import { workoutEffort } from '../stride-ui';
import { useAppContext } from './app-context';

export function TodayRoute() {
  const {
    setSelectedSession,
    motion,
    homePreferences,
    plan,
    today,
    unit,
    currentDate,
    dayWorkouts,
    workout,
    dayTitle,
    setSelectedDate,
    setView,
    openModal,
    showWorkout,
    showDay,
    dismissed,
    setDismissed,
    suggestion,
  } = useAppContext();
  return (
    <TabsContent value="today" className="main-panel today-panel">
      <div className="page-heading daily-heading">
        <div>
          <h1 aria-live="polite">{relativeDayLabel(currentDate, today)}</h1>
        </div>
        <div className="daily-controls">
          {currentDate !== today && (
            <button className="text-button" onClick={() => setSelectedDate('')}>
              Back to today
            </button>
          )}
        </div>
      </div>
      {suggestion && dismissed !== suggestion.evidence && (
        <div className="insight-panel">
          <div>
            <span className="eyebrow">Training check-in</span>
            <h3>{suggestion.title}</h3>
            <p>{suggestion.reason}</p>
          </div>
          <div className="row-actions">
            <button
              className="primary-button"
              onClick={() => openModal('adjustments')}
            >
              Review a lighter week
            </button>
            <button
              className="text-button"
              onClick={() => {
                setDismissed(suggestion.evidence);
                try {
                  localStorage.setItem(
                    'stride-dismissed-insight',
                    suggestion.evidence,
                  );
                } catch {}
              }}
            >
              Keep my plan
            </button>
          </div>
        </div>
      )}
      <div className="today-layout today-focus-layout">
        <section className="today-composition">
          <DateRail
            plan={plan}
            selectedDate={currentDate}
            today={today}
            motion={motion}
            onSelect={setSelectedDate}
            onHold={(session) => showWorkout(session, 'actions')}
          />
          {dayWorkouts.length > 1 && (
            <fieldset
              className="session-switcher"
              aria-label="Sessions for this day"
            >
              {dayWorkouts.map((w) => (
                <button
                  key={w.id}
                  className={workout?.id === w.id ? 'selected' : ''}
                  aria-pressed={workout?.id === w.id}
                  onClick={() => setSelectedSession(w.id)}
                >
                  {w.session} · {w.startTime} · {runDuration(w.minutes)}
                  <span className="session-state">
                    {w.status === 'completed'
                      ? 'Completed'
                      : w.status === 'skipped'
                        ? 'Skipped'
                        : 'To run'}
                  </span>
                </button>
              ))}
            </fieldset>
          )}
          {workout ? (
            <article
              className="workout-card"
              data-tone={workoutTone(workout)}
              key={workout.id}
            >
              <div className="card-topline">
                <span className="eyebrow">
                  {workout.kind === 'race'
                    ? 'Race day'
                    : workout.kind === 'long'
                      ? workout.hard
                        ? 'Long run · quality'
                        : 'Long run'
                      : workout.hard
                        ? 'Quality session'
                        : 'Easy effort'}
                </span>
                <div className="workout-status-actions">
                  {workout.status !== 'planned' && (
                    <span className="pill">
                      {workout.status === 'completed' ? (
                        <>
                          <Check size={12} /> Completed
                        </>
                      ) : (
                        'Skipped'
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="session-heading">
                <h2>{workout.title}</h2>
                <time className="session-date-stamp" dateTime={workout.date}>
                  <span>{dateLabel(workout.date, { month: 'short' })}</span>
                  <strong>{dateLabel(workout.date, { day: 'numeric' })}</strong>
                </time>
              </div>
              <div
                className="workout-stats"
                data-metrics={
                  homePreferences.showEstimates ||
                  prescribedDistanceKm(workout) !== null ||
                  (workout.status === 'completed' && workout.feedback)
                    ? 3
                    : 2
                }
              >
                {(homePreferences.showEstimates ||
                  prescribedDistanceKm(workout) !== null ||
                  (workout.status === 'completed' && workout.feedback)) && (
                  <div>
                    <strong>
                      {workout.status === 'completed' && workout.feedback
                        ? workout.feedback.actualKm === null
                          ? '—'
                          : kmDisplay(workout.feedback.actualKm, unit)
                        : workoutDistanceValue(workout, plan.profile)}
                    </strong>
                    <span>
                      {workout.status === 'completed' && workout.feedback
                        ? workout.feedback.actualKm === null
                          ? 'Distance not recorded'
                          : `${unit} recorded`
                        : prescribedDistanceKm(workout) !== null
                          ? `${unit} target`
                          : plan.profile.easyPace
                            ? `${unit} estimated range`
                            : 'distance not estimated'}
                    </span>
                  </div>
                )}
                <div>
                  <strong>
                    {runDuration(
                      workout.status === 'completed' && workout.feedback
                        ? workout.feedback.actualMinutes
                        : workout.minutes,
                    )}
                  </strong>
                  <span>
                    {workout.status === 'completed' && workout.feedback
                      ? 'recorded time'
                      : prescribedDistanceKm(workout) !== null
                        ? 'estimated time'
                        : 'duration'}
                  </span>
                </div>
                <div>
                  <strong>
                    {workout.status === 'completed' && workout.feedback
                      ? workout.feedback.effort
                      : mainWorkoutTarget(workout)
                        ? targetLabel(mainWorkoutTarget(workout), unit)
                        : workoutEffort(workout)}
                    {(workout.status === 'completed' ||
                      !mainWorkoutTarget(workout)) && (
                      <span className="stat-small"> / 10</span>
                    )}
                  </strong>
                  <span>
                    {workout.status !== 'completed' &&
                    mainWorkoutTarget(workout)
                      ? mainWorkoutTarget(workout)?.mode === 'pace'
                        ? 'Target pace'
                        : 'Target heart rate'
                      : 'effort'}
                  </span>
                </div>
              </div>
              <div className="card-footer">
                <div className="today-run-actions">
                  <button
                    className="primary-button"
                    onClick={() => showWorkout(workout)}
                  >
                    {workout.status === 'completed'
                      ? 'View run'
                      : 'Open workout'}
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <button
              type="button"
              className="daily-rest-card"
              key={currentDate}
              aria-label={`${dayTitle}, open daily guide`}
              onClick={() => showDay(currentDate)}
            >
              <Moon size={24} aria-hidden="true" />
              <span>{dayTitle}</span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          )}
          <UpcomingSessions
            count={homePreferences.upcomingCount}
            showEstimates={homePreferences.showEstimates}
            plan={plan}
            fromDate={currentDate}
            selectedId={workout?.id}
            onWorkout={showWorkout}
            onPlan={() => setView('plan')}
          />
        </section>
      </div>
    </TabsContent>
  );
}
