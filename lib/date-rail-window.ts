import { addDays, dayDiff, monday } from './plan/calendar.ts';

/** Keep calendar navigation bounded without losing access to historical dates. */
export function dateRailWindow(
  dates: readonly string[],
  selected: string,
  size = 7,
) {
  if (!dates.length)
    return { dates: [] as string[], start: 0, selectedIndex: 0 };
  const selectedIndex = Math.max(0, dates.indexOf(selected));
  const count = Math.max(1, Math.min(14, Math.floor(size) || 7));
  const start = Math.max(
    0,
    Math.min(dates.length - count, selectedIndex - Math.floor(count / 2)),
  );
  return { dates: dates.slice(start, start + count), start, selectedIndex };
}

export function dateRailTarget(
  dates: readonly string[],
  selected: string,
  offset: number,
) {
  if (!dates.length) return selected;
  const index = Math.max(0, dates.indexOf(selected));
  return dates[Math.max(0, Math.min(dates.length - 1, index + offset))];
}

/** Use the programme's actual week boundaries; out-of-block journal dates remain reachable. */
export function dateRailWeekWindow(
  dates: readonly string[],
  selected: string,
  weeks: readonly { start: string }[],
) {
  const weekIndex = weeks.findIndex(
    (week) => selected >= week.start && selected < addDays(week.start, 7),
  );
  if (weekIndex < 0) {
    const start = monday(selected);
    return {
      dates: Array.from({ length: 7 }, (_, day) => addDays(start, day)),
      start: dates.indexOf(start),
      selectedIndex: dates.indexOf(selected),
      weekIndex,
    };
  }
  const start = dates.indexOf(weeks[weekIndex].start);
  return {
    dates: Array.from({ length: 7 }, (_, day) =>
      addDays(weeks[weekIndex].start, day),
    ),
    start,
    selectedIndex: dates.indexOf(selected),
    weekIndex,
  };
}

/** Keep the selected weekday when moving between programme weeks. */
export function dateInPlanWeek(
  weeks: readonly { start: string }[],
  selected: string,
  targetIndex: number,
) {
  const target = weeks[targetIndex];
  if (!target) return selected;
  const current = weeks.find(
    (week) => selected >= week.start && selected < addDays(week.start, 7),
  );
  return addDays(target.start, current ? dayDiff(current.start, selected) : 0);
}

/** At the edge of a programme, navigate only if another week or journal date exists. */
export function adjacentRailWeek(
  dates: readonly string[],
  selected: string,
  weeks: readonly { start: string }[],
  direction: -1 | 1,
) {
  const { weekIndex } = dateRailWeekWindow(dates, selected, weeks);
  if (weekIndex >= 0 && weeks[weekIndex + direction])
    return dateInPlanWeek(weeks, selected, weekIndex + direction);
  if (!dates.length) return selected;
  const target = addDays(selected, direction * 7);
  const targetWeek = monday(target);
  return targetWeek < monday(dates[0]) || targetWeek > monday(dates.at(-1)!)
    ? selected
    : target;
}
