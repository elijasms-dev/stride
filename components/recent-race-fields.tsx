'use client';
import type { Profile } from '@/lib/engine';
import { BENCHMARK_DISTANCES } from '@/lib/benchmark-input';
import {
  pacingEvidence,
  calculateTrainingPaceRanges,
  validateRecentRace,
  type RecentRace,
} from '@/lib/fitness-pacing';
import { MILE_KM, trainingDayIfValid } from '@/lib/form-values';
import { paceText } from '@/lib/workout-targets';
import { Choice, Field } from './stride-ui';
import { NumericInput } from './numeric-input';
import { ElapsedTimeInput } from './elapsed-time-input';

export function RecentRaceFields({
  profile,
  onChange,
  asOf,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  asOf?: string;
}) {
  const race = profile.recentRace;
  const today = asOf ?? trainingDayIfValid(profile.timezone) ?? undefined;
  const factor = profile.units === 'mi' ? MILE_KM : 1;
  let paces: ReturnType<typeof calculateTrainingPaceRanges> | null = null;
  let evidence: ReturnType<typeof pacingEvidence> | null = null;
  let benchmarkError = '';
  if (race && race.distanceKm > 0 && race.timeMinutes > 0) {
    try {
      evidence = pacingEvidence(
        { ...profile, recentRace: validateRecentRace(race, today) },
        today,
      );
      paces = evidence.fitness.ranges;
    } catch (error) {
      benchmarkError =
        error instanceof Error
          ? error.message
          : 'Check the race distance and finish time.';
    }
  }
  const update = (patch: Partial<RecentRace>) =>
    race && onChange({ ...profile, recentRace: { ...race, ...patch } });
  return (
    <fieldset className="form-section">
      <legend>Recent race benchmark (optional)</legend>
      <p className="subtle">
        Use a recent race result to estimate easy, tempo, threshold, interval
        and repetition paces. Any workout targets you set manually take
        priority.
      </p>
      {race ? (
        <>
          <fieldset
            className="ultra-distance-choices"
            aria-label="Common benchmark distances"
          >
            {BENCHMARK_DISTANCES.map(({ distanceKm, label }) => (
              <button
                key={distanceKm}
                type="button"
                className="secondary-button small-button"
                aria-pressed={race.distanceKm === distanceKm}
                onClick={() => update({ distanceKm })}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <div className="form-grid">
            <Field
              label={`Race distance (${profile.units})`}
              hint="Presets retain the exact official distance. You can also enter a custom distance."
            >
              <NumericInput
                name="recentRaceDistanceKm"
                label={`Race distance in ${profile.units === 'mi' ? 'miles' : 'kilometres'}`}
                value={race.distanceKm === 0 ? null : race.distanceKm}
                factor={factor}
                min={1}
                max={100}
                required
                placeholder={profile.units === 'mi' ? 'e.g. 6.2' : 'e.g. 10'}
                onValueChange={(value) =>
                  onChange({
                    ...profile,
                    recentRace: { ...race, distanceKm: value ?? 0 },
                  })
                }
              />
            </Field>
            <ElapsedTimeInput
              value={race.timeMinutes}
              onValueChange={(timeMinutes) => update({ timeMinutes })}
            />
            <Field label="Result date (optional)">
              <input
                type="date"
                name="recentRaceDate"
                value={race.date ?? ''}
                max={today}
                onChange={(event) =>
                  update({ date: event.currentTarget.value || undefined })
                }
              />
            </Field>
            <Field label="Result type (optional)">
              <Choice
                value={race.source ?? ''}
                label="Benchmark result type"
                onChange={(source) =>
                  update({
                    source: source
                      ? (source as RecentRace['source'])
                      : undefined,
                  })
                }
                options={[
                  { value: '', label: 'Not specified' },
                  { value: 'race', label: 'Race result' },
                  { value: 'time-trial', label: 'Time trial' },
                ]}
              />
            </Field>
            <Field label="Course (optional)">
              <Choice
                value={race.course ?? ''}
                label="Benchmark course"
                onChange={(course) =>
                  update({
                    course: course
                      ? (course as RecentRace['course'])
                      : undefined,
                  })
                }
                options={[
                  { value: '', label: 'Not specified' },
                  { value: 'road', label: 'Road' },
                  { value: 'track', label: 'Track' },
                  { value: 'trail', label: 'Trail' },
                  { value: 'treadmill', label: 'Treadmill' },
                ]}
              />
            </Field>
          </div>
          {benchmarkError && (
            <output className="field-error">{benchmarkError}</output>
          )}
          {evidence && !paces && (
            <section aria-label="Benchmark pace estimates">
              <p>
                This benchmark is outside the supported training-pace model.
                Runs keep their effort cues.
              </p>
              <ul className="subtle">
                {evidence.notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            </section>
          )}
          {paces && (
            <section aria-label="Benchmark pace estimates">
              <h3>Estimated training paces</h3>
              <dl className="benchmark-pace-preview">
                {(
                  [
                    ['easy', 'Easy'],
                    ['tempo', 'Tempo'],
                    ['threshold', 'Threshold'],
                    ['interval', 'Intervals'],
                    ['repetition', 'Repetitions'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>
                      {paceText(paces[key].low, profile.units)}–
                      {paceText(paces[key].high, profile.units)}{' '}
                      <small>/{profile.units}</small>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="subtle">
                These effort ranges estimate your current fitness. Keep easy
                running conversational. Conditions and endurance affect how well
                the estimates transfer; the ranges are not measured
                physiological thresholds.
              </p>
              {profile.workoutTargets && (
                <p className="subtle">
                  Your manual workout targets take priority. These estimates do
                  not replace them.
                </p>
              )}
              <ul className="subtle">
                {evidence?.notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
              <p className="subtle">
                The selected plan changes race-specific targets and workout
                structure. A new benchmark updates your fitness zones. Review
                the plan preview before applying changes. Date, result type and
                course describe the result; they do not change the pace
                calculation.
              </p>
            </section>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => onChange({ ...profile, recentRace: undefined })}
          >
            Remove benchmark
          </button>
        </>
      ) : (
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            onChange({
              ...profile,
              recentRace: { distanceKm: 0, timeMinutes: 0 },
            })
          }
        >
          Add race benchmark
        </button>
      )}
    </fieldset>
  );
}
