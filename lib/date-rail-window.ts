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
