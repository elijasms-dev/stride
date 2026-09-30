'use client';
import type { Profile } from '@/lib/engine';
import { BENCHMARK_DISTANCES } from '@/lib/benchmark-input';
import {
  benchmarkEvidence,
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
  let evidence: ReturnType<typeof benchmarkEvidence> | null = null;
  let benchmarkError = '';
  if (race && race.distanceKm > 0 && race.timeMinutes > 0) {
    try {
      evidence = benchmarkEvidence(validateRecentRace(race, today), today);
    } catch (error) {
      benchmarkError =
        error instanceof Error
          ? error.message
          : 'Check the race distance and finish time.';
    }
  }
  const update = (patch: Partial<RecentRace>) =>
    race &&
    onChange({
      ...profile,
      recentRace: { ...race, representative: false, ...patch },
    });
  return (
    <fieldset className="form-section">
      <legend>Your reference result (optional)</legend>
      <p className="subtle">
        Choose a race or time trial that reflects your current running. Your
        programme determines which targets this result can support. You can
        train by effort without adding a result.
      </p>
      {race ? (
        <>
          {evidence && !benchmarkError && (
            <section
              className="pace-reference-summary"
              aria-label="Reference result pace"
            >
              <strong>
                {paceText(
                  (race.timeMinutes * 60) / race.distanceKm,
                  profile.units,
                )}{' '}
                /{profile.units}
              </strong>
              <p>
                Your average pace for this result. It is not an easy-run target
                or a prediction for another distance.
              </p>
              <label className="pace-confirmation">
                <input
                  type="checkbox"
                  checked={race.representative === true}
                  onChange={(event) =>
                    update({ representative: event.currentTarget.checked })
                  }
                />
                <span>
                  This result reflects my current fitness and the conditions I
                  am training for.
                </span>
              </label>
              <details>
                <summary>About this result</summary>
                <ul className="subtle">
                  {evidence.notices.map((notice) => (
                    <li key={notice}>{notice}</li>
                  ))}
                </ul>
                <p>
                  Course and date help you judge the result. Stride does not
                  invent a pace correction for hills, weather or an older
                  result.
                </p>
              </details>
            </section>
          )}
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
                    recentRace: {
                      ...race,
                      representative: false,
                      distanceKm: value ?? 0,
                    },
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
