'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { relativeDayLabel } from '@/lib/form-values';
import { addDays, dateLabel } from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { DateRail } from '../date-rail';
import { TabsContent } from '@/components/ui/tabs';
import { UpcomingSessions } from '../journal-panels';
import { useAppContext } from './app-context';
import { TodayWorkoutCard } from './today-workout-card';
import { TodayDayCard } from './today-day-card';
import { TodaySessionDetails } from './today-session-details';
import { WeatherWidget } from '../weather-widget';
import { planWeekPhase } from '@/lib/plan-explorer';

export function TodayRoute() {
  const {
    setSelectedSession,
    motion,
    homePreferences,
    plan,
    today,
    currentDate,
    dayWorkouts,
    workout,
    setSelectedDate,
    setView,
    openModal,
    showWorkout,
    dismissed,
    setDismissed,
    suggestion,
  } = useAppContext();
  const weekIndex = plan.weeks.findIndex(
    (week) => currentDate >= week.start && currentDate < addDays(week.start, 7),
  );
  const selectedWeek = plan.weeks[weekIndex];
  return (
    <TabsContent value="today" className="main-panel today-panel today-stage">
      <header className="today-stage-heading">
        <div className="today-week-title">
          <h1 aria-live="polite">
            {selectedWeek
              ? `Week ${weekIndex + 1} · ${planWeekPhase(plan, selectedWeek.index) ?? selectedWeek.phase}`
              : 'Your week'}
          </h1>
          {selectedWeek && (
            <p>
              {dateLabel(selectedWeek.start)} –{' '}
              {dateLabel(addDays(selectedWeek.start, 6))}
            </p>
          )}
        </div>
        <div className="today-day-context">
          <h2>{relativeDayLabel(currentDate, today)}</h2>
          <time dateTime={currentDate}>
            {dateLabel(currentDate, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </time>
          {currentDate !== today && (
            <button className="text-button" onClick={() => setSelectedDate('')}>
              Back to today
            </button>
          )}
        </div>
      </header>
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
          className="session-switcher today-session-switcher"
          aria-label="Sessions for this day"
        >
          {dayWorkouts.map((w) => (
            <button
              key={w.id}
              type="button"
              className={workout?.id === w.id ? 'selected' : ''}
              aria-pressed={workout?.id === w.id}
              onClick={() => setSelectedSession(w.id)}
            >
              {[
                w.session,
                w.startTime,
                w.status === 'completed'
                  ? w.feedback
                    ? runDuration(w.feedback.actualMinutes) + ' recorded'
                    : 'Time not recorded'
                  : w.kind === 'race'
                    ? 'Race day'
                    : runDuration(w.minutes) +
                      (w.steps.some((step) => step.metres !== undefined)
                        ? ' estimated'
                        : ''),
              ]
                .filter(Boolean)
                .join(' · ')}
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
      <div
        id="selected-day-workout"
        className="today-main-session"
        tabIndex={-1}
      >
        {workout ? (
          <TodayWorkoutCard
            key={workout.id}
            workout={workout}
            profile={plan.profile}
            showEstimates={homePreferences.showEstimates}
            onOpen={showWorkout}
            motion={motion}
          />
        ) : (
          <TodayDayCard plan={plan} date={currentDate} motion={motion} />
        )}
      </div>
      <div className="today-below-session">
        <UpcomingSessions
          count={homePreferences.upcomingCount}
          showEstimates={homePreferences.showEstimates}
          plan={plan}
          fromDate={currentDate}
          selectedId={workout?.id}
          onWorkout={showWorkout}
          onPlan={() => setView('plan')}
        />
        {workout && <WeatherWidget selectedDate={currentDate} today={today} />}
        <div id="today-workout-details" tabIndex={-1}>
          <TodaySessionDetails
            key={`${plan.id}:${currentDate}:${workout?.id ?? 'day'}`}
            plan={plan}
            date={currentDate}
            workout={workout ?? undefined}
            onOpen={showWorkout}
          />
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
      </div>
    </TabsContent>
  );
}
