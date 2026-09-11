import { readAccount } from '@/lib/accounts';
import { guardAccount } from '@/lib/accounts';
import {
  ownerId,
  guardWrite,
  database,
  json,
  failure,
  body,
  HttpError,
} from '@/lib/server';
export async function GET(request: Request) {
  try {
    const owner = ownerId(request);
    const profile = await database()
      .prepare(
        'SELECT display_name,city,units,timezone,accent FROM profiles WHERE owner=?',
      )
      .bind(owner)
      .first();
    const account = await readAccount(owner);
    return json({
      accountId: account.account_id,
      accountEpoch: account.epoch,
      accountRevision: account.revision,
      profile,
      email: request.headers.get('oai-authenticated-user-email'),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const accountContext = await guardAccount(request, owner);
    const b = await body(request);
    const { displayName, city, units, timezone, accent } = b;
    if (
      typeof displayName !== 'string' ||
      displayName.length > 60 ||
      typeof city !== 'string' ||
      city.length > 80 ||
      typeof units !== 'string' ||
      !['km', 'mi'].includes(units) ||
      typeof accent !== 'string' ||
      !['evergreen', 'slate', 'clay'].includes(accent) ||
      typeof timezone !== 'string'
    )
      throw new HttpError(
        422,
        'Check your profile name, city, units and appearance.',
      );
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch {
      throw new HttpError(422, 'Choose a valid timezone.');
    }
    const token = crypto.randomUUID(),
      db = database();
    const result = await db.batch([
      db
        .prepare(
          "UPDATE accounts SET revision=revision+1,operation_id=? WHERE owner=? AND epoch=? AND status='active'",
        )
        .bind(token, owner, accountContext.epoch),
      db
        .prepare(
          'INSERT INTO profiles(owner,display_name,city,units,timezone,accent,updated_at) SELECT owner,?,?,?,?,?,? FROM accounts WHERE owner=? AND operation_id=? ON CONFLICT(owner) DO UPDATE SET display_name=excluded.display_name,city=excluded.city,units=excluded.units,timezone=excluded.timezone,accent=excluded.accent,updated_at=excluded.updated_at',
        )
        .bind(
          displayName.trim(),
          city.trim(),
          units,
          timezone,
          accent,
          new Date().toISOString(),
          owner,
          token,
        ),
      db
        .prepare(
          "UPDATE athlete_state SET version=version+1,data=json_set(data,'$.profile.units',?,'$.profile.timezone',?),updated_at=?,write_token=? WHERE owner=? AND data<>'null' AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=athlete_state.owner AND a.operation_id=?)",
        )
        .bind(units, timezone, new Date().toISOString(), token, owner, token),
      db
        .prepare(
          'INSERT OR IGNORE INTO revisions(owner,version,data,label,created_at) SELECT owner,version,data,?,updated_at FROM athlete_state WHERE owner=? AND write_token=?',
        )
        .bind(
          'Updated display units or training timezone; prescriptions unchanged',
          owner,
          token,
        ),
    ]);
    if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1)
      throw new HttpError(
        409,
        'Your account changed. Reload before saving your profile.',
      );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
