import test from 'node:test';
import assert from 'node:assert/strict';
import { changeEvent, avoidRecordedOverlap } from '../lib/event-transition.ts';
import { exportCalendar } from '../lib/calendar.ts';
import { makePlan, demoProfile, addDays } from '../lib/engine.ts';
import { validateRecovery } from '../lib/recovery.ts';
const start = '2026-07-13',
  today = '2026-09-07';
function fixture() {
  return makePlan(
    { ...demoProfile(start), raceDate: addDays(start, 83) },
    start,
  );
}
const event = {
  goal: '10k',
  raceName: 'New event',
  raceDate: addDays(today, 83),
  raceTerrain: 'road',
};
void test('event change preserves unknown sessions and extra recorded facts through recovery', () => {
  const p = fixture();
  p.extraRuns = [
    {
      id: 'extra',
      date: today,
      minutes: 80,
      km: 12,
      effort: 8,
      feeling: 'tired',
      note: 'Recorded outside plan',
      recordedAt: today + 'T08:00:00Z',
    },
  ];
  const next = changeEvent(p, event, today);
  assert.ok(next.workouts.some((w) => w.week === -1 && w.status === 'planned'));
  assert.deepEqual(next.extraRuns, p.extraRuns);
  assert.ok(next.workouts.every((w) => w.week === -1 || w.date !== today));
  assert.doesNotThrow(() =>
    validateRecovery({
      format: 'stride-recovery-2',
      exportedAt: today + 'T10:00:00Z',
      profile: null,
      plan: next,
    }),
  );
});
void test('a changed race date accepts a short block without compressing preparation', () => {
  const next = changeEvent(
    fixture(),
    { ...event, raceDate: addDays(today, 10) },
    today,
  );
  assert.equal(next.profile.raceDate, addDays(today, 10));
  assert.ok(next.notes.some((note) => note.startsWith('Short block ·')));
  assert.ok(
    next.workouts
      .filter((w) => w.week >= 0)
      .every((w) => w.date >= today && w.date <= next.profile.raceDate),
  );
  assert.ok(
    next.workouts.some(
      (w) => w.kind === 'race' && w.date === next.profile.raceDate,
    ),
  );
});
void test('post-race recovery uses the archived race distance, independent of the outgoing goal', () => {
  const p = fixture(),
    race = structuredClone(p.workouts.find((w) => w.kind === 'race'));
  race.id = 'recorded-marathon';
  race.date = addDays(today, -1);
  race.week = -1;
  race.status = 'completed';
  race.estimatedKm = 42.195;
  race.steps[0].metres = 42195;
  race.feedback = {
    actualMinutes: 240,
    actualKm: 42.195,
    effort: 9,
    feeling: 'tired',
    note: '',
    recordedAt: today + 'T00:00:00Z',
  };
  p.workouts.push(race);
  const next = changeEvent(
    p,
    { ...event, goal: 'base', raceDate: addDays(today, 55) },
    today,
  );
  assert.ok(next.returnState);
  assert.ok(
    next.workouts
      .filter((w) => w.week >= 0 && w.date <= addDays(today, 12))
      .every((w) => w.status === 'skipped'),
  );
  assert.throws(() => changeEvent(next, event, today), /return review/);
});
void test('calendar is a privacy-limited all-day snapshot with valid UTF-8 folding and distinct session identities', () => {
  const p = fixture();
  const future = p.workouts.filter((w) => w.date >= today);
  future[0].title = 'Ås run, recovery; ' + '界'.repeat(70);
  future[0].feedback = { note: 'PRIVATE NOTE MUST NOT APPEAR' };
  const ics = exportCalendar(p, today, 7, new Date('2026-09-07T12:00:00Z'));
  assert.ok(!ics.includes('PRIVATE NOTE'));
  assert.match(ics, /DTSTART;VALUE=DATE:/);
  assert.match(ics, /SEQUENCE:7/);
  assert.ok(!ics.includes('TZID='));
  for (const line of ics.split('\r\n'))
    assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('界'.repeat(70)));
  assert.match(unfolded, /Ås run\\, recovery\\;/);
  const uids = unfolded.split('\r\n').filter((s) => s.startsWith('UID:'));
  assert.equal(new Set(uids).size, uids.length);
  assert.equal(
    uids.length,
    future.filter((w) => w.status === 'planned').length,
  );
});

void test('new-plan preview and activation share a recorded-day exclusion and cannot bypass return', () => {
  const p = fixture(),
    candidate = makePlan(
      { ...p.profile, startDate: today, raceDate: addDays(today, 83) },
      today,
    );
  p.extraRuns = [
    {
      id: 'outside',
      date: today,
      minutes: 40,
      km: 6,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: today + 'T08:00:00Z',
    },
  ];
  const result = avoidRecordedOverlap(candidate, p);
  assert.ok(result.workouts.every((w) => w.date !== today));
  p.returnState = { stage: 1 };
  assert.throws(() => avoidRecordedOverlap(candidate, p), /return review/);
});
