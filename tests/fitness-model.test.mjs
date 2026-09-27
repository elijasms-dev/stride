import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateTrainingPaces,
  calculateTrainingPaceRanges,
  deriveFitness,
  FITNESS_MODEL_VERSION,
  pacingEvidence,
  predictRaceTime,
  schedulingEasyPace,
  validateRecentRace,
} from '../lib/fitness-pacing.ts';
import {
  danielsEquivalentTime,
  danielsVdot,
  paceAtOxygenFraction,
  trainingRangesAtVdot,
} from '../lib/fitness-model.ts';

const race = {
  distanceKm: 5,
  timeMinutes: 19.95,
  date: '2026-09-01',
  source: 'race',
  course: 'road',
};
const near = (actual, expected, tolerance, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} vs ${expected}`,
  );

// Independent numerical oracles transcribed from Jack Daniels' own Table 1/2:
// https://www.coacheseducation.com/endur/jack-daniels-nov-00.php
// Linked images vdot1.jpg/vdot3.jpg/vdot4.jpg. Paces are seconds/km;
// I/R 400m table values are converted with /0.4, not our model equations.
const table = [
  {
    vdot: 30,
    fiveK: 30 + 40 / 60,
    easy: 457,
    threshold: 384,
    interval: 142 / 0.4,
    repetition: 136 / 0.4,
  },
  {
    vdot: 40,
    fiveK: 24 + 8 / 60,
    easy: 367,
    threshold: 306,
    interval: 282,
    repetition: 106 / 0.4,
  },
  {
    vdot: 50,
    fiveK: 19 + 57 / 60,
    easy: 307,
    threshold: 255,
    interval: 235,
    repetition: 87 / 0.4,
  },
  {
    vdot: 60,
    fiveK: 17 + 3 / 60,
    easy: 265,
    threshold: 220,
    interval: 203,
    repetition: 75 / 0.4,
  },
  {
    vdot: 70,
    fiveK: 14 + 55 / 60,
    easy: 234,
    threshold: 194,
    interval: 179,
    repetition: 65 / 0.4,
  },
];

test('Daniels computation agrees with independently published performance and training tables', () => {
  for (const row of table) {
    const benchmark = { distanceKm: 5, timeMinutes: row.fiveK };
    near(danielsVdot(5, row.fiveK), row.vdot, 0.08, 'published VDOT');
    const paces = calculateTrainingPaces(benchmark);
    for (const key of ['easy', 'threshold', 'interval', 'repetition'])
      near(paces[key], row[key], 3, `VDOT ${row.vdot} ${key}`);
  }
  // Independent Table 1 values for the same fitness at other distances.
  near(danielsEquivalentTime(50, 10), 41 + 21 / 60, 0.1, 'VDOT50 10K');
  near(danielsEquivalentTime(50, 1.609344), 5 + 50 / 60, 0.04, 'VDOT50 mile');
});

test('novice table reference is supported without clamping the runner faster', () => {
  // Daniels Running Formula 4th ed., Table 5.3: 5K42:24, VDOT20, T8:41/km.
  // The continuous approximation differs slightly from the printed novice table.
  const fitness = deriveFitness({ distanceKm: 5, timeMinutes: 42.4 });
  near(fitness.vdot, 20, 0.2, 'novice VDOT');
  near(fitness.paces.threshold, 521, 2, 'novice threshold');
  assert.ok(fitness.ranges.easy.low > 590);
  assert.ok(deriveFitness({ distanceKm: 5, timeMinutes: 40 }).ranges);
});

test('effort bands are published intensity ranges, distinct from a fixed execution tolerance', () => {
  const ranges = trainingRangesAtVdot(50);
  assert.deepEqual(ranges.easy, { low: 293, high: 352 });
  assert.deepEqual(ranges.threshold, { low: 255, high: 263 });
  assert.deepEqual(ranges.interval, { low: 230, high: 240 });
  assert.deepEqual(ranges.steady, ranges.tempo);
  assert.ok(ranges.easy.high - ranges.easy.low > 50);
  assert.ok(
    ranges.easy.high - ranges.easy.low >
      ranges.threshold.high - ranges.threshold.low,
  );
  assert.ok(ranges.repetition.high < ranges.interval.low);
  for (const range of Object.values(ranges))
    assert.ok(Number.isFinite(range.low) && range.low < range.high);
  // 70% oxygen demand is not 70% of running velocity or pace.
  assert.notEqual(
    paceAtOxygenFraction(50, 0.7),
    paceAtOxygenFraction(50, 1) / 0.7,
  );
});

test('current fitness is independent of goal distance, aspiration, age and course metadata', () => {
  const original = deriveFitness(race, '2026-09-25');
  assert.equal(original.modelVersion, FITNESS_MODEL_VERSION);
  assert.equal(original.confidence.level, 'estimated');
  for (const goal of ['5k', '10k', 'half', 'marathon']) {
    const result = deriveFitness(
      { ...race, goal, goalTimeMinutes: 1 },
      '2026-09-25',
    );
    assert.deepEqual(result, original);
  }
  const oldTrail = deriveFitness(
    { ...race, date: '2025-01-01', course: 'trail' },
    '2026-09-25',
  );
  assert.deepEqual(oldTrail.ranges, original.ranges);
  assert.equal(oldTrail.confidence.level, 'limited');
  assert.ok(
    oldTrail.confidence.reasons.some((reason) => reason.includes('older')),
  );
  assert.ok(
    oldTrail.confidence.reasons.some((reason) => reason.includes('Trail')),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(original)), original);
});

test('missing and out-of-domain performances preserve effort fallback without invented paces', () => {
  const empty = deriveFitness();
  assert.equal(empty.source, 'none');
  assert.equal(empty.ranges, null);
  for (const benchmark of [
    { distanceKm: 5, timeMinutes: 70 },
    { distanceKm: 5, timeMinutes: 11 },
    { distanceKm: 50, timeMinutes: 300 },
  ]) {
    assert.deepEqual(validateRecentRace(benchmark), benchmark);
    const derived = deriveFitness(benchmark);
    assert.equal(derived.ranges, null);
    assert.equal(derived.paces, null);
    assert.equal(derived.confidence.level, 'limited');
    assert.ok(
      derived.confidence.reasons.some((reason) => reason.includes('outside')),
    );
    assert.equal(calculateTrainingPaceRanges(benchmark), null);
  }
  for (const bad of [
    { distanceKm: 0, timeMinutes: 25 },
    { distanceKm: 5, timeMinutes: Infinity },
  ])
    assert.throws(() => deriveFitness(bad));
  assert.throws(() =>
    deriveFitness({ ...race, date: '2027-01-01' }, '2026-09-25'),
  );
});

test('all training intensities respond monotonically to representative benchmark performance', () => {
  for (const timeMinutes of [15, 20, 25, 30, 40]) {
    const baseline = calculateTrainingPaceRanges({
      distanceKm: 5,
      timeMinutes,
    });
    const faster = calculateTrainingPaceRanges({
      distanceKm: 5,
      timeMinutes: timeMinutes * 0.98,
    });
    for (const key of Object.keys(baseline)) {
      assert.ok(faster[key].low < baseline[key].low);
      assert.ok(faster[key].high < baseline[key].high);
    }
  }
});

test('manual easy target has scheduling precedence with a visible conflict explanation', () => {
  const profile = {
    easyPace: 9,
    recentRace: race,
    workoutTargets: { mode: 'pace', pace: { easy: { low: 350, high: 370 } } },
  };
  assert.equal(schedulingEasyPace(profile), 370 / 60);
  const evidence = pacingEvidence(profile, '2026-09-25');
  assert.ok(evidence.notices.some((notice) => notice.includes('conflicting')));
  assert.ok(
    evidence.notices.some((notice) =>
      notice.includes('benchmark estimate differ'),
    ),
  );
  assert.deepEqual(evidence.fitness.ranges, calculateTrainingPaceRanges(race));
  const auto = { recentRace: race };
  assert.equal(
    schedulingEasyPace(auto),
    calculateTrainingPaceRanges(race).easy.high / 60,
  );
  assert.equal(schedulingEasyPace({ ...auto, easyPace: 9 }), 9);
});

test('Riegel race equivalence remains separate from the Daniels effort model', () => {
  assert.equal(predictRaceTime(race, 5), race.timeMinutes);
  const paces = calculateTrainingPaces(race);
  assert.equal(paces.marathon, (predictRaceTime(race, 42.195) * 60) / 42.195);
  assert.ok(!('marathon' in deriveFitness(race).paces));
  assert.notEqual(paces.easy, paces.marathon * 1.2);
});

test('invalid benchmark previews are unavailable without weakening save-time validation', () => {
  for (const recentRace of [
    { ...race, date: '2027-01-01' },
    { ...race, date: '2026-02-30' },
    { ...race, timeMinutes: NaN },
  ]) {
    const evidence = pacingEvidence({ recentRace }, '2026-09-25');
    assert.equal(evidence.fitness.confidence.level, 'unavailable');
    assert.equal(evidence.fitness.paces, null);
    assert.equal(evidence.fitness.ranges, null);
    assert.equal(evidence.fitness.vdot, null);
    assert.equal(evidence.schedulingPaceMinutesPerKm, null);
    assert.ok(
      evidence.notices.some((notice) =>
        notice.includes('Pace preview is unavailable'),
      ),
    );
    assert.throws(() => validateRecentRace(recentRace, '2026-09-25'));
    assert.throws(() => deriveFitness(recentRace, '2026-09-25'));
  }
  assert.ok(
    pacingEvidence(
      { recentRace: { ...race, date: '2027-01-01' } },
      '2026-09-25',
    ).notices.some((notice) => notice.includes('future')),
  );
});
