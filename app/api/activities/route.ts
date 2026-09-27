import { beginRequestObservation } from '@/lib/request-observation';
import {
  ownerId,
  json,
  failure,
  readState,
  database,
  HttpError,
  requestLimit,
} from '@/lib/server';
import { addDays, todayInZone, validDate, dayDiff } from '@/lib/engine';
import { providerActivities } from '@/lib/provider-activities';
export async function GET(request: Request) {
  const observation = beginRequestObservation(request);
  try {
    const owner = ownerId(request);
    // Covers a complete two-year history (18 pages) plus normal retries, while
    // bounding provider traffic before journal reads or credential decryption.
    await requestLimit(owner, 'activity-import', 30);
    const cursor = new URL(request.url).searchParams.get('before');
    if (cursor !== null && !validDate(cursor))
      throw new HttpError(
        422,
        'Choose an import window within the last two years.',
      );
    const state = await readState(owner),
      profile = await database()
        .prepare('SELECT timezone FROM profiles WHERE owner=?')
        .bind(owner)
        .first<{ timezone: string }>(),
      today = todayInZone(
        state.plan?.profile.timezone || profile?.timezone || 'UTC',
      );
    const to = cursor ?? today;
    if (to > today || dayDiff(to, today) > 730)
      throw new HttpError(
        422,
        'Choose an import window within the last two years.',
      );
    const from = addDays(to, -41);
    const result = await providerActivities(owner, from, to, true);
    return json({
      ...result,
      hasMore: dayDiff(from, today) < 730,
      nextCursor: dayDiff(from, today) < 730 ? addDays(from, -1) : null,
    });
  } catch (e) {
    return failure(e, observation);
  }
}
