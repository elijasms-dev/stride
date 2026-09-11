'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { addDays, dateLabel, type Plan, type Workout } from '@/lib/engine';
import {
  orderedDaySessions,
  focusedSession,
  daySessionSummary,
  workoutTone,
} from '@/lib/day-sessions';
import { supportingSession } from '@/lib/coaching-context';

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
  const [dragging, setDragging] = useState(false);
  const dates = useMemo(
    () =>
      [
        ...new Set([
          ...plan.weeks.flatMap((week) =>
            Array.from({ length: 7 }, (_, day) => addDays(week.start, day)),
          ),
          today,
          selectedDate,
        ]),
      ].sort(),
    [plan.weeks, today, selectedDate],
  );
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const workout of plan.workouts) {
      const sessions = map.get(workout.date) ?? [];
      sessions.push(workout);
      map.set(workout.date, sessions);
    }
    return map;
  }, [plan.workouts]);
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
    const selected = container?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    if (!container || !selected) return;
    const left =
      container.scrollLeft +
      selected.getBoundingClientRect().left -
      container.getBoundingClientRect().left -
      (container.clientWidth - selected.offsetWidth) / 2;
    container.scrollTo({
      left,
      behavior:
        centered.current &&
        motion &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'smooth'
          : 'instant',
    });
    centered.current = true;
  }, [selectedDate, plan.id, motion]);
  return (
    <div className="date-rail-wrap">
      <div className="date-rail-heading">
        <span>
          {dateLabel(selectedDate, { month: 'long', year: 'numeric' })}
        </span>
        <span className="date-rail-hint">Scroll through days</span>
      </div>
      <fieldset
        ref={rail}
        id="weekly-sessions"
        className="day-strip date-rail"
        aria-label="Choose a day. Scroll to browse your plan."
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
                orderedDaySessions(
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
        {dates.map((date, index) => {
          const sessions = orderedDaySessions(
            sessionsByDate.get(date) ?? [],
            date,
          );
          const summary = daySessionSummary(sessions);
          const gap = index > 0 && addDays(dates[index - 1], 1) !== date;
          return (
            <button
              key={date}
              data-date={date}
              data-gap={gap || undefined}
              data-day-state={summary.state}
              className={`day-button${selectedDate === date ? ' selected' : ''}${date === today ? ' is-today' : ''}`}
              aria-pressed={selectedDate === date}
              aria-current={date === today ? 'date' : undefined}
              tabIndex={selectedDate === date ? 0 : -1}
              aria-label={`${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${sessions.length ? summary.label : (supportingSession(plan, date)?.title ?? 'rest day')}${date === today ? ', today' : ''}`}
              onClick={() => onSelect(date)}
              onKeyDown={(event) => {
                const target =
                  event.key === 'ArrowRight'
                    ? index + 1
                    : event.key === 'ArrowLeft'
                      ? index - 1
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? dates.length - 1
                          : null;
                if (target === null) return;
                event.preventDefault();
                cancelHold();
                suppressClick.current = false;
                const next = Math.max(0, Math.min(dates.length - 1, target));
                onSelect(dates[next]);
                rail.current
                  ?.querySelector<HTMLButtonElement>(
                    `[data-date="${dates[next]}"]`,
                  )
                  ?.focus({ preventScroll: true });
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
    </div>
  );
}
