'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateRailWeekWindow, adjacentRailWeek } from '@/lib/date-rail-window';
import { addDays, dateLabel, type Plan, type Workout } from '@/lib/engine';
import { monday } from '@/lib/plan/calendar';
import {
  calendarSessions,
  orderedCalendarSessions,
  focusedSession,
  daySessionSummary,
  workoutTone,
} from '@/lib/day-sessions';
import { supportingSession } from '@/lib/coaching-context';
import { recordedWorkoutDate } from '@/lib/run-records';

export function DateRail({
  plan,
  selectedDate,
  today,
  motion,
  onSelect,
  onHold,
}: {
  plan: Plan;
  selectedDate: string;
  today: string;
  motion: boolean;
  onSelect: (date: string) => void;
  onHold: (workout: Workout) => void;
}) {
  const rail = useRef<HTMLFieldSetElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    scroll: number;
    moved: boolean;
    mouse: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const centered = useRef(false);
  const focusSelected = useRef(false);
  const [dragging, setDragging] = useState(false);
  const visibleSessions = useMemo(() => calendarSessions(plan), [plan]);
  const dates = useMemo(
    () =>
      [
        ...new Set([
          ...plan.weeks.flatMap((week) =>
            Array.from({ length: 7 }, (_, day) => addDays(week.start, day)),
          ),
          ...visibleSessions.map(recordedWorkoutDate),
          today,
          selectedDate,
        ]),
      ].sort(),
    [plan.weeks, visibleSessions, today, selectedDate],
  );
  const windowed = dateRailWeekWindow(dates, selectedDate, plan.weeks);
  const previousWeek = adjacentRailWeek(dates, selectedDate, plan.weeks, -1);
  const nextWeek = adjacentRailWeek(dates, selectedDate, plan.weeks, 1);
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const workout of visibleSessions) {
      const date = recordedWorkoutDate(workout);
      const sessions = map.get(date) ?? [];
      sessions.push(workout);
      map.set(date, sessions);
    }
    return map;
  }, [visibleSessions]);
  const cancelHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const container = rail.current;
    if (!container) return;
    const centerSelection = (animate: boolean) => {
      const selected = container.querySelector<HTMLButtonElement>(
        '[aria-pressed="true"]',
      );
      if (!selected) return;
      const left =
        container.scrollLeft +
        selected.getBoundingClientRect().left -
        container.getBoundingClientRect().left -
        (container.clientWidth - selected.offsetWidth) / 2;
      container.scrollTo({
        left,
        behavior:
          animate &&
          centered.current &&
          motion &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'smooth'
            : 'instant',
      });
      centered.current = true;
      if (focusSelected.current) {
        selected.focus({ preventScroll: true });
        focusSelected.current = false;
      }
    };
    centerSelection(true);
    const observer = new ResizeObserver(() => centerSelection(false));
    observer.observe(container);
    return () => observer.disconnect();
  }, [selectedDate, plan.id, motion]);
  return (
    <div className="date-rail-wrap">
      <a className="date-rail-workout-skip" href="#selected-day-workout">
        Skip to workout
      </a>
      <div className="date-rail-week-strip">
        <button
          type="button"
          className="date-rail-week-arrow"
          aria-label="Previous week"
          disabled={previousWeek === selectedDate}
          onClick={() => onSelect(previousWeek)}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <fieldset
          ref={rail}
          id="weekly-sessions"
          className="day-strip date-rail"
          aria-label="Choose a day. Use arrow keys to move through dates, or the previous and next week buttons."
          data-dragging={dragging || undefined}
          onScroll={cancelHold}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            cancelHold();
            suppressClick.current = false;
            gesture.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              scroll: event.currentTarget.scrollLeft,
              moved: false,
              mouse: event.pointerType === 'mouse',
            };
            const button = (event.target as Element).closest<HTMLButtonElement>(
              'button[data-date]',
            );
            const workout = button?.dataset.date
              ? focusedSession(
                  orderedCalendarSessions(
                    sessionsByDate.get(button.dataset.date) ?? [],
                    button.dataset.date,
                  ),
                )
              : null;
            if (workout)
              timer.current = setTimeout(() => {
                suppressClick.current = true;
                gesture.current = null;
                onHold(workout);
              }, 550);
          }}
          onPointerMove={(event) => {
            const active = gesture.current;
            if (!active || active.id !== event.pointerId) return;
            if (active.mouse && event.buttons !== 1) {
              cancelHold();
              gesture.current = null;
              setDragging(false);
              return;
            }
            const dx = event.clientX - active.x,
              dy = event.clientY - active.y;
            if (Math.hypot(dx, dy) > 8 && !active.moved) {
              active.moved = true;
              suppressClick.current = true;
              cancelHold();
              if (active.mouse && Math.abs(dx) > Math.abs(dy)) {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
              }
            }
            if (
              active.mouse &&
              event.currentTarget.hasPointerCapture(event.pointerId)
            ) {
              event.preventDefault();
              event.currentTarget.scrollLeft = active.scroll - dx;
            }
          }}
          onPointerUp={() => {
            cancelHold();
            gesture.current = null;
            setDragging(false);
          }}
          onPointerCancel={() => {
            cancelHold();
            gesture.current = null;
            setDragging(false);
          }}
          onPointerLeave={(event) => {
            cancelHold();
            if (!event.currentTarget.hasPointerCapture(event.pointerId))
              gesture.current = null;
          }}
          onClickCapture={(event) => {
            if (suppressClick.current && event.detail !== 0) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
        >
          {windowed.dates.map((date) => {
            const sessions = orderedCalendarSessions(
              sessionsByDate.get(date) ?? [],
              date,
            );
            const summary = daySessionSummary(sessions);
            return (
              <button
                key={date}
                data-date={date}
                data-day-state={summary.state}
                className={`day-button${selectedDate === date ? ' selected' : ''}${date === today ? ' is-today' : ''}`}
                aria-pressed={selectedDate === date}
                aria-current={date === today ? 'date' : undefined}
                tabIndex={selectedDate === date ? 0 : -1}
                aria-label={`${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${sessions.length ? summary.label : (supportingSession(plan, date)?.title ?? 'rest day')}${date === today ? ', today' : ''}${selectedDate === date ? ', selected' : ''}`}
                onClick={() => onSelect(date)}
                onKeyDown={(event) => {
                  const target =
                    event.key === 'ArrowRight'
                      ? addDays(date, 1)
                      : event.key === 'ArrowLeft'
                        ? addDays(date, -1)
                        : event.key === 'Home'
                          ? dates[0]
                          : event.key === 'End'
                            ? dates.at(-1)!
                            : null;
                  if (target === null) return;
                  event.preventDefault();
                  cancelHold();
                  suppressClick.current = false;
                  const first = monday(dates[0]);
                  const last = addDays(monday(dates.at(-1)!), 6);
                  const next =
                    target < first ? first : target > last ? last : target;
                  focusSelected.current = true;
                  onSelect(next);
                  if (next === selectedDate) {
                    event.currentTarget.focus();
                    focusSelected.current = false;
                  }
                }}
              >
                <span>{dateLabel(date, { weekday: 'short' })}</span>
                <strong>{dateLabel(date, { day: 'numeric' })}</strong>
                <span className="rail-month">
                  {dateLabel(date, { month: 'short' })}
                </span>
                <span className="day-session-markers" aria-hidden="true">
                  {sessions
                    .filter((session) => session.status !== 'skipped')
                    .map((session) =>
                      session.status === 'completed' ? (
                        <Check key={session.id} size={12} />
                      ) : (
                        <i
                          key={session.id}
                          className="run-dot"
                          data-tone={workoutTone(session)}
                        />
                      ),
                    )}
                  {summary.state === 'skipped' && (
                    <span className="skipped-day-mark">−</span>
                  )}
                </span>
              </button>
            );
          })}
        </fieldset>
        <button
          type="button"
          className="date-rail-week-arrow"
          aria-label="Next week"
          disabled={nextWeek === selectedDate}
          onClick={() => onSelect(nextWeek)}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
