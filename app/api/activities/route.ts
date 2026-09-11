import {
  ownerId,
  json,
  failure,
  readState,
  database,
  HttpError,
} from '@/lib/server';
import { addDays, todayInZone, validDate, dayDiff } from '@/lib/engine';
import { providerActivities } from '@/lib/provider-activities';
export async function GET(request: Request) {
  try {
    const owner = ownerId(request),
      state = await readState(owner),
      profile = await database()
        .prepare('SELECT timezone FROM profiles WHERE owner=?')
        .bind(owner)
        .first<{ timezone: string }>(),
      today = todayInZone(
        state.plan?.profile.timezone || profile?.timezone || 'UTC',
      ),
      url = new URL(request.url);
    const to = url.searchParams.get('before') ?? today,
      from = addDays(to, -41);
    if (!validDate(to) || to > today || dayDiff(to, today) > 730)
      throw new HttpError(
        422,
        'Choose an import window within the last two years.',
      );
    const result = await providerActivities(owner, from, to, true);
    return json({
      ...result,
      hasMore: dayDiff(from, today) < 730,
      nextCursor: dayDiff(from, today) < 730 ? addDays(from, -1) : null,
    });
  } catch (e) {
    return failure(e);
  }
}
