import type { ConnectionSummary } from './connection-status';

export type Activity = {
  id: string;
  name: string;
  date: string;
  distance: number | null;
  movingTime: number;
  source: string;
  startLocal?: string;
  startUtc?: string | null;
  timezone?: string | null;
  pairedEventId?: string | null;
};
export type ImportPage = {
  activities: Activity[];
  nextCursor: string | null;
  identity: { athleteId: string; generation: string };
};
export type ImportReviewCache = Omit<ImportPage, 'identity'> & {
  scope: string;
};

/** Transient UI state only; no provider recordings are persisted in the browser. */
export function importReviewScope(
  accountScope: string,
  connection: Pick<
    ConnectionSummary,
    'provider_athlete_id' | 'generation'
  > | null,
) {
  return accountScope &&
    connection?.provider_athlete_id &&
    connection.generation
    ? JSON.stringify([
        accountScope,
        connection.provider_athlete_id,
        connection.generation,
      ])
    : '';
}

export function mergeImportPage(
  current: ImportReviewCache | null,
  expectedScope: string,
  currentScope: string,
  identity: ImportPage['identity'],
  page: Omit<ImportPage, 'identity'>,
  older: boolean,
): ImportReviewCache | null {
  if (!expectedScope || expectedScope !== currentScope) return current;
  try {
    const parts: unknown = JSON.parse(expectedScope);
    if (
      !Array.isArray(parts) ||
      parts.length !== 3 ||
      parts.some((part) => typeof part !== 'string' || !part) ||
      parts[1] !== identity?.athleteId ||
      parts[2] !== identity?.generation
    )
      return current;
  } catch {
    return current;
  }
  const rows =
    older && current?.scope === expectedScope
      ? [...current.activities, ...page.activities]
      : page.activities;
  const seen = new Set<string>();
  return {
    scope: expectedScope,
    activities: rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }),
    nextCursor: page.nextCursor,
  };
}
