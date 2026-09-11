'use client';

import { Slider } from '@base-ui/react/slider';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { dateLabel } from '@/lib/engine';

export type MoveDay = {
  date: string;
  title: string;
  reason: string;
  action: string;
  occupied: boolean;
};

export function WeekMoveSlider({
  days,
  originalDate,
  value,
  title,
  duration,
  paired,
  disabled,
  onChange,
}: {
  days: MoveDay[];
  originalDate: string;
  value: string;
  title: string;
  duration: string;
  paired: boolean;
  disabled: boolean;
  onChange: (date: string) => void;
}) {
  const descriptionId = useId();
  const rail = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const held = useRef(false);
  const savedIndex = days.findIndex((day) => day.date === value);
  const sourceIndex = days.findIndex((day) => day.date === originalDate);
  const [cursor, setCursor] = useState(savedIndex);
  const [dragging, setDragging] = useState(false);
  const [revision, setRevision] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const selected = days[cursor];
  const blocked = !!selected.reason && cursor !== sourceIndex;
  const moved = cursor !== sourceIndex && !blocked;

  useEffect(() => {
    if (!held.current) setCursor(savedIndex);
  }, [savedIndex]);

  function cancel(restoreFocus = false) {
    if (!held.current) return;
    held.current = false;
    setDragging(false);
    setCursor(savedIndex);
    setAnnouncement('Move cancelled. Your selected day is unchanged.');
    // Remounting also releases the primitive's document-level drag listeners.
    setRevision((current) => current + 1);
    if (restoreFocus) requestAnimationFrame(() => input.current?.focus());
  }

  useEffect(() => {
    if (!dragging) return;
    const abort = () => cancel();
    window.addEventListener('blur', abort);
    return () => window.removeEventListener('blur', abort);
  });

  function choose(index: number) {
    const day = days[index];
    if (disabled || !day) return;
    if (day.reason && index !== sourceIndex) {
      setCursor(savedIndex);
      setAnnouncement(
        `${dateLabel(day.date, { weekday: 'long' })}: ${day.reason}. Your selected day is unchanged.`,
      );
      return;
    }
    setCursor(index);
    onChange(day.date);
    setAnnouncement(
      `${dateLabel(day.date, { weekday: 'long', day: 'numeric', month: 'short' })}. ${index === sourceIndex ? 'Original day.' : day.occupied ? 'Both runs will swap dates when you save.' : paired ? 'Both sessions will move together when you save.' : 'Review the move before saving.'}`,
    );
  }

  function adjacent(direction: number) {
    for (
      let index = cursor + direction;
      index >= 0 && index < days.length;
      index += direction
    ) {
      if (!days[index].reason || index === sourceIndex) return index;
    }
    return cursor;
  }

  return (
    <section className="week-move" aria-label="Slide your run through the week">
      <input type="hidden" name="new-date" value={value} />
      <p id={descriptionId} className="week-move-instruction">
        Hold the run and slide it to another day. You can also tap a day.
        <span className="sr-only">
          Use the up and down arrow keys to change days, Home or End for the
          first or last available day, and Escape to cancel a drag. Review
          changes before saving.
        </span>
      </p>
      <Slider.Root
        key={revision}
        ref={rail}
        className={`week-move-rail ${dragging ? 'is-dragging' : ''}`}
        min={0}
        max={days.length - 1}
        step={1}
        orientation="vertical"
        thumbAlignment="center"
        value={days.length - 1 - cursor}
        disabled={disabled}
        onValueChange={(next) => setCursor(days.length - 1 - Number(next))}
        onValueCommitted={(next, details) => {
          held.current = false;
          setDragging(false);
          const event = details.event;
          const point =
            'changedTouches' in event
              ? (event as TouchEvent).changedTouches[0]
              : 'clientY' in event
                ? (event as PointerEvent)
                : null;
          const bounds = rail.current?.getBoundingClientRect();
          if (
            point &&
            bounds &&
            (point.clientY < bounds.top ||
              point.clientY > bounds.bottom ||
              point.clientX < bounds.left ||
              point.clientX > bounds.right)
          ) {
            setCursor(savedIndex);
            setAnnouncement(
              'Move cancelled. Drop inside the week to choose a day.',
            );
            return;
          }
          choose(days.length - 1 - Number(next));
        }}
      >
        <ol className="week-move-days">
          {days.map((day, index) => {
            const sourceMoved = index === sourceIndex && moved;
            const unavailable = !!day.reason && index !== sourceIndex;
            return (
              <li
                key={day.date}
                className={`${index === cursor ? 'is-target' : ''} ${unavailable ? 'is-unavailable' : ''}`}
              >
                <button
                  type="button"
                  disabled={disabled || unavailable || dragging}
                  aria-label={`${dateLabel(day.date, { weekday: 'long', day: 'numeric', month: 'short' })}, ${day.title}, ${day.action}`}
                  aria-pressed={index === savedIndex}
                  onClick={() => choose(index)}
                >
                  <time dateTime={day.date} className="week-move-date">
                    <span>{dateLabel(day.date, { weekday: 'short' })}</span>
                    <strong>{dateLabel(day.date, { day: 'numeric' })}</strong>
                  </time>
                  <span className="week-move-slot">
                    <strong>
                      {sourceMoved
                        ? selected.occupied
                          ? selected.title
                          : 'Rest day'
                        : day.title}
                    </strong>
                    <small>
                      {sourceMoved
                        ? selected.occupied
                          ? 'Swaps here'
                          : 'After your move'
                        : unavailable
                          ? day.reason
                          : index === sourceIndex
                            ? 'Original day'
                            : day.occupied
                              ? 'Runs will swap'
                              : 'Space to run'}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <Slider.Control
          className="week-move-control"
          onPointerDownCapture={(event) => {
            if (disabled || event.button !== 0) return;
            held.current = true;
            setDragging(true);
            setAnnouncement('');
          }}
          onPointerCancel={() => cancel()}
          onTouchCancel={() => cancel()}
          onPointerUp={() => {
            held.current = false;
            setDragging(false);
          }}
          onTouchEnd={() => {
            held.current = false;
            setDragging(false);
          }}
          onLostPointerCapture={() => cancel()}
        >
          <Slider.Thumb
            className={`week-move-card ${blocked ? 'is-blocked' : ''}`}
            inputRef={input}
            aria-label={`Move ${title}`}
            aria-describedby={descriptionId}
            getAriaValueText={() =>
              `${dateLabel(selected.date, { weekday: 'long', day: 'numeric', month: 'short' })}. ${blocked ? selected.reason : selected.occupied && moved ? 'Swap with ' + selected.title : 'Selected day'}`
            }
            onBlur={() => cancel()}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && held.current) {
                event.preventDefault();
                event.stopPropagation();
                cancel(true);
              } else if (
                ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)
              ) {
                event.preventDefault();
                const available = days.flatMap((day, index) =>
                  !day.reason || index === sourceIndex ? [index] : [],
                );
                choose(
                  event.key === 'Home'
                    ? available[0]
                    : event.key === 'End'
                      ? available.at(-1)!
                      : adjacent(event.key === 'ArrowUp' ? -1 : 1),
                );
              }
            }}
          >
            <span className="week-move-card-copy" aria-hidden="true">
              <strong>{title}</strong>
              <small>
                {blocked
                  ? selected.reason
                  : paired
                    ? 'Both sessions move together'
                    : `${duration} · ${dragging ? 'Release on this day' : 'Hold to slide'}`}
              </small>
            </span>
            <GripVertical size={21} aria-hidden="true" />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
      <div className="week-move-feedback">
        <output aria-live="polite" aria-atomic="true">
          {dragging
            ? `${dateLabel(selected.date, { weekday: 'long' })} · ${blocked ? selected.reason : moved && selected.occupied ? 'Swap with ' + selected.title : 'Release to choose this day'}`
            : announcement || 'Your plan stays unchanged until you save.'}
        </output>
        <div className="week-move-arrows">
          <button
            type="button"
            className="icon-button"
            aria-label="Move to previous available day"
            disabled={disabled || dragging || adjacent(-1) === cursor}
            onClick={() => choose(adjacent(-1))}
          >
            <ArrowUp size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Move to next available day"
            disabled={disabled || dragging || adjacent(1) === cursor}
            onClick={() => choose(adjacent(1))}
          >
            <ArrowDown size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
