'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Flag } from 'lucide-react';
import {
  addDays,
  dateLabel,
  dayDiff,
  kmDisplay,
  trainingPhaseOn,
} from '@/lib/engine';
import { planCalendarDays, planWeekSummary } from '@/lib/plan-explorer';
import { weekSupportingSessions } from '@/lib/coaching-context';
import { planWeekFocus } from '@/lib/plan-guidance';
import { workoutTone } from '@/lib/day-sessions';
import { specificWorkoutName } from '@/lib/workout-names';
import { runDuration } from '@/lib/journal-view';
import { WeekRhythm } from '../week-rhythm';
import { InlineWorkout, WorkoutPrescription } from './inline-workout';
import type { Props } from './explorer-types';

export function PlanWeekSchedule({
  plan,
  weekIndex,
  today,
  onWorkout,
  onDay,
}: Pick<Props, 'plan' | 'today' | 'onWorkout' | 'onDay'> & {
  weekIndex: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const week = plan.weeks.find((item) => item.index === weekIndex);
  if (!week) return null;
  const expandedWorkout = planCalendarDays(plan, weekIndex)
    .flatMap((day) => day.sessions)
    .find((run) => run.id === expandedId);
  const summary = planWeekSummary(plan, weekIndex);
  const support = weekSupportingSessions(plan, weekIndex);
  const weekStart =
    week.start < plan.profile.startDate ? plan.profile.startDate : week.start;
  const phase = trainingPhaseOn(plan.profile, week.phase, weekStart);
  const daysToRace = dayDiff(weekStart, plan.profile.raceDate);
  const reduced = ['Recovery', 'Taper', 'Race week'].includes(phase);
  return (
    <>
      <header className="pe-week-heading">
        <div>
          <h2 id={`plan-week-heading-${weekIndex + 1}`}>
            Week {weekIndex + 1}
            <span className={`pe-phase ${reduced ? 'is-reduced' : ''}`}>
              {phase}
            </span>
          </h2>
          <p>
            {dateLabel(week.start)} – {dateLabel(addDays(week.start, 6))}
            {plan.profile.goal !== 'base' && daysToRace >= 0 && (
              <span>
                {daysToRace < 7
                  ? 'Race this week'
                  : `${Math.ceil(daysToRace / 7)} weeks to race`}
              </span>
            )}
          </p>
        </div>
        <dl className="pe-week-metrics">
          <div>
            <dt>Estimated training</dt>
            <dd>
              {kmDisplay(summary.trainingKm, plan.profile.units)}{' '}
              <small>{plan.profile.units}</small>
            </dd>
          </div>
          <div>
            <dt>Long run</dt>
            <dd>
              {summary.longKm ? (
                <>
                  {kmDisplay(summary.longKm, plan.profile.units)}{' '}
                  <small>{plan.profile.units}</small>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Running days</dt>
            <dd>
              {summary.runningDays}
              <small> / 7</small>
            </dd>
          </div>
        </dl>
      </header>
      <div className="pe-key-workouts">
        <strong>
          {summary.keySessions.length
            ? 'Key runs'
            : summary.raceKm
              ? 'Race week'
              : 'This week'}
        </strong>
        {summary.keySessions.length ? (
          summary.keySessions.map((run) => (
            <span data-tone={workoutTone(run)} key={run.id}>
              <i aria-hidden="true" />
              {dateLabel(run.date, { weekday: 'short' })}:{' '}
              {specificWorkoutName(run)}
            </span>
          ))
        ) : (
          <span>
            {summary.raceKm
              ? 'Keep the lead-in comfortable.'
              : 'Comfortable running and recovery.'}
          </span>
        )}
        {summary.raceKm > 0 && (
          <span className="pe-race-distance">
            <Flag size={14} aria-hidden="true" />
            Plus {kmDisplay(summary.raceKm, plan.profile.units)}{' '}
            {plan.profile.units} race
          </span>
        )}
      </div>
      <div
        className="pe-calendar"
        aria-label={`Week ${weekIndex + 1} daily schedule`}
      >
        {planCalendarDays(plan, weekIndex).map((day) => {
          const activity = support.find((item) => item.date === day.date);
          return (
            <div
              key={day.date}
              className={`pe-day ${day.date === today ? 'is-today' : ''} ${!day.inBlock ? 'outside-block' : ''} ${!day.sessions.length && !day.extras.length ? 'is-rest' : ''}`}
            >
              <time className="pe-date" dateTime={day.date}>
                <span>{dateLabel(day.date, { weekday: 'short' })}</span>
                <strong>{dateLabel(day.date, { day: 'numeric' })}</strong>
                {day.date === today && <small>Today</small>}
              </time>
              <div className="pe-day-sessions">
                {day.sessions.map((workout) => (
                  <InlineWorkout
                    key={workout.id}
                    workout={workout}
                    plan={plan}
                    onWorkout={onWorkout}
                    expanded={expandedId === workout.id}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === workout.id ? null : workout.id,
                      )
                    }
                    detailId={`pe-workout-${weekIndex}-${workout.id}`}
                  />
                ))}
                {!day.sessions.length && !day.extras.length && (
                  <button
                    type="button"
                    className="pe-rest-link"
                    onClick={() => onDay(day.date)}
                    aria-label={`${dateLabel(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${day.inBlock ? (activity?.title ?? 'Rest day') : 'Outside the plan'}, open daily guide`}
                  >
                    <strong>
                      {!day.inBlock
                        ? day.date < plan.profile.startDate
                          ? 'Before your plan'
                          : 'After your block'
                        : 'Rest day'}
                    </strong>
                    <span>
                      {day.inBlock && activity
                        ? `Optional: ${activity.title}`
                        : day.inBlock
                          ? 'Take time to recover'
                          : 'Open daily guide'}
                      <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </button>
                )}
                {day.extras.length > 0 && (
                  <button
                    type="button"
                    className="pe-extra"
                    onClick={() => onDay(day.date)}
                  >
                    <Check size={15} aria-hidden="true" />
                    <span>
                      <strong>
                        {day.extras.length === 1
                          ? 'Extra run recorded'
                          : `${day.extras.length} extra runs recorded`}
                      </strong>
                      <small>
                        {runDuration(
                          day.extras.reduce((sum, run) => sum + run.minutes, 0),
                        )}{' '}
                        recorded
                      </small>
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {expandedWorkout && (
        <div
          className="pe-desktop-prescription"
          id={`pe-workout-${weekIndex}-${expandedWorkout.id}-desktop`}
        >
          <WorkoutPrescription
            workout={expandedWorkout}
            plan={plan}
            onWorkout={onWorkout}
          />
        </div>
      )}
      <div className="pe-week-footnote">
        <span>
          {runDuration(summary.trainingMinutes)} planned training
          {summary.sessions > summary.runningDays
            ? `, ${summary.sessions} sessions`
            : ''}
          . Weekly totals exclude race distance, skipped sessions and extra
          runs.
          {summary.raceKm > 0 ? ' Running days include race day.' : ''}
        </span>
        {summary.skipped > 0 && (
          <span>
            {summary.skipped} skipped{' '}
            {summary.skipped === 1 ? 'session' : 'sessions'} shown in the
            schedule.
          </span>
        )}
      </div>
      <details className="pe-week-context">
        <summary>
          About this week <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <p className="week-focus">{planWeekFocus(plan, week)}</p>
        <WeekRhythm plan={plan} week={weekIndex} />
        {support.length > 0 && (
          <div className="pe-support">
            <h3>Alongside your running</h3>
            <p>Optional supporting work, separate from your running total.</p>
            {support.map((activity) => (
              <details key={activity.date}>
                <summary>
                  {dateLabel(activity.date, { weekday: 'short' })}:{' '}
                  {activity.title}, {activity.minutes} min
                </summary>
                <p>{activity.notes}</p>
              </details>
            ))}
          </div>
        )}
      </details>
    </>
  );
}
