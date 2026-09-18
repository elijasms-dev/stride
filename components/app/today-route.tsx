'use client';
/* oxlint-disable next/no-html-link-for-pages -- Authentication transitions require a new document to discard the pinned account session. */
import { relativeDayLabel } from '@/lib/form-values';
import { runDuration } from '@/lib/journal-view';
import { ChevronRight, Moon } from 'lucide-react';
import { DateRail } from '../date-rail';
/* oxlint-disable react/react-compiler -- This app hydrates device preferences after SSR; it does not use the React Compiler. */
import { TabsContent } from '@/components/ui/tabs';
import { UpcomingSessions } from '../journal-panels';
import { useAppContext } from './app-context';
import { TodayWorkoutCard } from './today-workout-card';

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
          {workout ? (
            <TodayWorkoutCard
              key={workout.id}
              workout={workout}
              profile={plan.profile}
              showEstimates={homePreferences.showEstimates}
              onOpen={showWorkout}
            />
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
