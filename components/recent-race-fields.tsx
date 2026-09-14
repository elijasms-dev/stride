'use client';
import type { Profile } from '@/lib/engine';
import { Field } from './stride-ui';
import { NumericInput } from './numeric-input';

export function RecentRaceFields({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  const race = profile.recentRace;
  return (
    <fieldset className="form-section">
      <legend>Recent race benchmark (optional)</legend>
      <p className="subtle">
        Use a recent race result to estimate easy, tempo, threshold and interval
        paces. Any workout targets you set manually take priority.
      </p>
      {race ? (
        <>
          <div className="form-grid">
            <Field label="Race distance (km)">
              <NumericInput
                name="recentRaceDistanceKm"
                label="Race distance in kilometres"
                value={race.distanceKm || null}
                min={1}
                max={100}
                required
                placeholder="e.g. 10"
                onValueChange={(value) =>
                  onChange({
                    ...profile,
                    recentRace: { ...race, distanceKm: value ?? 0 },
                  })
                }
              />
            </Field>
            <Field label="Finish time (total minutes)">
              <NumericInput
                name="recentRaceTimeMinutes"
                label="Race finish time in total minutes"
                value={race.timeMinutes || null}
                min={1}
                max={1500}
                required
                placeholder="e.g. 50"
                onValueChange={(value) =>
                  onChange({
                    ...profile,
                    recentRace: { ...race, timeMinutes: value ?? 0 },
                  })
                }
              />
            </Field>
          </div>
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
