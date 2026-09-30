import { dayAfter } from './road-overhaul-helpers.mjs';

export const ROAD_START = '2026-09-21';
export const ROAD_DISTANCES = { '5k': 5, '10k': 10, half: 21.0975 };
export const ROAD_LEVELS = {
  developing: { runs: 3, '5k': [12, 4], '10k': [18, 6], half: [24, 10] },
  established: { runs: 4, '5k': [30, 8], '10k': [40, 11], half: [45, 14] },
  advanced: { runs: 5, '5k': [55, 13], '10k': [60, 15], half: [65, 18] },
};

export function roadProfile(goal, level, count, weeks = 12, patch = {}) {
  const group = ROAD_LEVELS[level];
  const [weeklyKm, longestKm] = group[goal];
  return {
    name: 'Synthetic road overhaul check',
    goal,
    raceName: `Synthetic ${goal} check`,
    startDate: ROAD_START,
    raceDate: dayAfter(ROAD_START, weeks * 7 - 1),
    weeklyKm,
    longestKm,
    currentRuns: group.runs,
    runsPerWeek: group.runs,
    days: { 3: [1, 3, 6], 4: [0, 2, 4, 6], 5: [0, 1, 2, 4, 6] }[group.runs],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    experience: 'established',
    difficulty: 'balanced',
    intent: 'improve',
    volume: 'gradual',
    timezone: 'Europe/Dublin',
    units: 'km',
    easyPace: 6,
    qualityMode: 'custom',
    qualitySessions: count,
    recentQualitySessions: count,
    recentQualityMinutes: count * 20,
    runMeasure: 'distance',
    workoutFormat: 'time',
    workoutVariety: 'varied',
    ...patch,
  };
}

export function roadOverhaulCases() {
  const cases = [],
    seen = new Set();
  const add = (id, profile, expectation = 'accept') => {
    const key = JSON.stringify(profile);
    if (seen.has(key)) return;
    seen.add(key);
    cases.push({ id, profile, expectation });
  };
  for (const goal of Object.keys(ROAD_DISTANCES)) {
    for (const level of Object.keys(ROAD_LEVELS)) {
      for (const count of [0, 1, 2]) {
        for (const weeks of [8, 12, 18]) {
          add(
            `${goal}-${level}-q${count}-${weeks}weeks`,
            roadProfile(goal, level, count, weeks),
            count === 2 && level !== 'advanced' ? 'reject' : 'accept',
          );
        }
      }
    }
    for (const count of [0, 1, 2]) {
      // Independently vary both calendar edges: a partial first week must not
      // cause catch-up mileage or displace the actual race-relative taper.
      for (let offset = 0; offset < 7; offset++) {
        for (let raceDay = 0; raceDay < 7; raceDay++) {
          add(
            `${goal}-calendar-q${count}-start${offset}-race${raceDay}`,
            roadProfile(goal, 'advanced', count, 12, {
              startDate: dayAfter(ROAD_START, offset),
              raceDate: dayAfter(ROAD_START, 77 + raceDay),
            }),
          );
        }
      }
      for (const easyPace of [4.5, 6, 8]) {
        for (const runMeasure of ['distance', 'time']) {
          for (const volume of ['gradual', 'maintain']) {
            // At 8:00/km, these five-day q2 baselines cannot fit while keeping
            // the long run exact, easy days <=120 min and intro workout padding
            // <=20 min: 10K capacity ~57.69 km <60; half ~62 km <65. Preserve
            // their declared baseline by rejecting the conflict, not stretching
            // a small main set or silently reducing mileage/frequency.
            const capacityConflict = easyPace === 8 && count === 2;
            add(
              `${goal}-pace${easyPace}-${runMeasure}-${volume}-q${count}`,
              roadProfile(goal, 'advanced', count, 12, {
                easyPace,
                runMeasure,
                volume,
              }),
              capacityConflict ? 'reject' : 'accept',
            );
            if (capacityConflict)
              add(
                `${goal}-pace8-${runMeasure}-${volume}-q2-six-day-counterpart`,
                roadProfile(goal, 'advanced', count, 12, {
                  easyPace,
                  runMeasure,
                  volume,
                  currentRuns: 6,
                  runsPerWeek: 6,
                  days: [0, 1, 2, 3, 4, 6],
                }),
              );
          }
        }
      }
      for (const [name, patch] of [
        ['fractional', { weeklyKm: 60.5, longestKm: 14.7 }],
        ['finish', { intent: 'finish' }],
        ['gentle', { difficulty: 'gentle' }],
        [
          'benchmark',
          {
            recentRace: {
              distanceKm: 10,
              timeMinutes: 50,
              date: '2026-09-01',
              source: 'race',
              course: 'road',
            },
          },
        ],
        ['mile-display', { units: 'mi' }],
        ['distance-repetitions', { workoutFormat: 'distance' }],
        ['automatic-repetitions', { workoutFormat: 'automatic' }],
      ]) {
        if (typeof name !== 'string')
          throw new TypeError('Expected scenario label');
        add(
          `${goal}-${name}-q${count}`,
          roadProfile(goal, 'advanced', count, 12, patch),
          (goal === 'half' && name === 'fractional' && count === 2) ||
            // The old 55 km 5K fixture relied on inferred fast-work targets to
            // fit two quality days. An unconfirmed 10K result no longer supplies
            // those paces; keep its explicit capacity refusal as a regression.
            (goal === '5k' && name === 'benchmark' && count === 2)
            ? 'reject'
            : 'accept',
        );
      }
      // Short timelines are valid previews, not a promise of race readiness.
      for (const span of [0, 1, 6, 7, 13, 14, 20, 27]) {
        add(
          `${goal}-short${span + 1}days-q${count}`,
          roadProfile(goal, 'advanced', count, 12, {
            raceDate: dayAfter(ROAD_START, span),
          }),
        );
      }
    }
    for (const [name, patch] of [
      ['negative-weekly', { weeklyKm: -1 }],
      ['infinite-weekly', { weeklyKm: Infinity }],
      ['nonfinite-pace', { easyPace: NaN }],
      ['longer-than-week', { weeklyKm: 30, longestKm: 31 }],
      ['unfunded-long', { longestKm: 20, longMinutes: 30 }],
      ['unfunded-week', { weeklyMinutesLimit: 90 }],
      ['unavailable-long-day', { availableDays: [0, 1, 2, 3, 4], longDay: 6 }],
      ['not-enough-days', { availableDays: [2, 6] }],
      [
        'missing-quality-history',
        { qualitySessions: 2, recentQualitySessions: 0 },
      ],
    ]) {
      if (typeof name !== 'string')
        throw new TypeError('Expected scenario label');
      add(
        `${goal}-reject-${name}`,
        roadProfile(goal, 'advanced', 1, 12, patch),
        'reject',
      );
    }
    for (const count of [0, 1, 2]) {
      add(
        `${goal}-two-day-q${count}`,
        roadProfile(goal, 'developing', count, 12, {
          currentRuns: 2,
          runsPerWeek: 2,
          days: [2, 6],
        }),
        goal === 'half' || count > 0 ? 'reject' : 'accept',
      );
    }
  }
  // Former accepted fixtures concealed impossible or unfundable daily loads.
  // Retain the exact inputs as rejection regressions, alongside viable examples.
  add(
    '5k-benchmark-q2-feasible-45km',
    roadProfile('5k', 'advanced', 2, 12, {
      weeklyKm: 45,
      recentRace: {
        distanceKm: 10,
        timeMinutes: 50,
        date: '2026-09-01',
        source: 'race',
        course: 'road',
      },
    }),
  );
  for (const [goal, level, weeklyKm, longestKm, quality] of [
    ['5k', 'developing', 15, 4, 0],
    ['10k', 'developing', 24, 6, 0],
    ['5k', 'advanced', 55, 12, 2],
    ['half', 'developing', 30, 10, 1],
  ])
    add(
      `${goal}-reject-hidden-long-${weeklyKm}-${longestKm}-q${quality}`,
      roadProfile(goal, level, quality, 12, { weeklyKm, longestKm }),
      'reject',
    );
  // The reported disproportionate half baseline must stay exact, even though
  // its current long run is larger than the usual percentage of weekly volume.
  for (const count of [0, 1]) {
    add(
      `half-familiar-30weekly-20long-q${count}`,
      roadProfile('half', 'established', count, 12, {
        weeklyKm: 30,
        longestKm: 20,
      }),
    );
  }
  return cases;
}
