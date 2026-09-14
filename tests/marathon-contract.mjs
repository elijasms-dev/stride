import assert from 'node:assert/strict';
import { addDays, taperFactor } from '../lib/engine.ts';

/** Standard marathon quality includes the long run, even when it is entirely easy. */
export function assertMarathonWeek(plan, week) {
  const sessions = plan.workouts.filter(
    (w) => w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
  );
  const quality = sessions.filter((w) => w.hard || w.kind === 'long');
  assert.ok(quality.length <= 2);
  if (
    week.start >= plan.profile.startDate &&
    addDays(week.start, 6) < plan.profile.raceDate &&
    !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
    taperFactor(plan.profile, addDays(week.start, 6)) === 1
  ) {
    assert.equal(quality.length, 2, `Week ${week.index + 1}`);
    assert.equal(quality.filter((w) => w.kind === 'long').length, 1);
    assert.equal(
      quality.filter(
        (w) => w.kind !== 'long' && w.hard && w.stimulus === 'threshold',
      ).length,
      1,
    );
  }
}
