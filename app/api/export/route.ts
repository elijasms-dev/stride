import { exportCalendar } from '@/lib/calendar';
import { todayInZone } from '@/lib/engine';
import {
  ownerId,
  readState,
  failure,
  HttpError,
  database,
  requestLimit,
} from '@/lib/server';
import { encodeWorkout } from '@/lib/fit';
import { exportProgram } from '@/lib/program-export';
export async function GET(request: Request) {
  try {
    const owner = ownerId(request),
      state = await readState(owner),
      url = new URL(request.url);
    await requestLimit(owner, 'export', 12);
    if (url.searchParams.get('format') === 'program') {
      if (!state.plan)
        throw new HttpError(
          404,
          'Build a plan before exporting its training program.',
        );
      return new Response(JSON.stringify(exportProgram(state.plan), null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="stride-training-program.json"',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (url.searchParams.get('format') === 'calendar') {
      if (!state.plan)
        throw new HttpError(404, 'Build a plan before exporting its calendar.');
      return new Response(
        exportCalendar(
          state.plan,
          todayInZone(state.plan.profile.timezone),
          state.version,
        ),
        {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="stride-training.ics"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    }
    if (url.searchParams.get('format') === 'fit') {
      if (!state.plan)
        throw new HttpError(
          404,
          'Create your own plan before exporting a workout.',
        );
      const workout = state.plan.workouts.find(
        (w) => w.id === url.searchParams.get('id'),
      );
      if (!workout) throw new HttpError(404, 'Workout not found.');
      const bytes = encodeWorkout(workout);
      return new Response(bytes as BodyInit, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="stride-${workout.date}${workout.session ? `-${workout.session.toLowerCase()}` : ''}.fit"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const accountProfile = await database()
      .prepare(
        'SELECT display_name,city,units,timezone,accent FROM profiles WHERE owner=?',
      )
      .bind(owner)
      .first();
    if (url.searchParams.get('format') === 'recovery')
      return new Response(
        JSON.stringify({
          format: 'stride-recovery-2',
          exportedAt: new Date().toISOString(),
          profile: accountProfile,
          plan: state.plan,
          standaloneRuns: state.standaloneRuns ?? [],
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition':
              'attachment; filename="stride-recovery.json"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    const before = Number(
      url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER,
    );
    if (!Number.isSafeInteger(before) || before < 1)
      throw new HttpError(422, 'Choose a valid revision page.');
    // Select metadata first: loading 20 large JSON snapshots can exhaust a Worker.
    const metadata = await database()
      .prepare(
        'SELECT version,length(CAST(data AS BLOB)) AS bytes FROM revisions WHERE owner=? AND version<? ORDER BY version DESC LIMIT 21',
      )
      .bind(owner, before)
      .all<{ version: number; bytes: number }>();
    const chosen: number[] = [];
    let bytes = 0;
    for (const row of metadata.results) {
      if (
        chosen.length === 20 ||
        (chosen.length > 0 && bytes + row.bytes > 2000000)
      )
        break;
      chosen.push(row.version);
      bytes += row.bytes;
    }
    const history = chosen.length
      ? await database()
          .prepare(
            `SELECT version,data,label,created_at FROM revisions WHERE owner=? AND version IN (${chosen.map(() => '?').join(',')}) ORDER BY version DESC`,
          )
          .bind(owner, ...chosen)
          .all()
      : { results: [] };
    const nextBefore =
      metadata.results.length > chosen.length ? chosen.at(-1) : null;
    return new Response(
      JSON.stringify(
        {
          format: 'stride-journal-1',
          exportedAt: new Date().toISOString(),
          ...state,
          profile: accountProfile,
          historyPage: { limit: 20, byteBudget: 2000000, nextBefore },
          history: history.results.map((r: Record<string, unknown>) => ({
            ...r,
            data: JSON.parse(String(r.data)),
          })),
        },
        null,
        0,
      ),
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="stride-journal.json"',
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
