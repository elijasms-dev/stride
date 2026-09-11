'use client';
import type { Profile } from '@/lib/engine';
import {
  isLongUltra,
  FIFTY_MILES_KM,
  HUNDRED_MILES_KM,
} from '@/lib/ultra-policy';
import { Field } from './stride-ui';
import { NumericInput } from './numeric-input';

export function UltraDistanceChoices({
  profile: p,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  return (
    <fieldset
      className="ultra-distance-choices"
      aria-label="Common ultra distances"
    >
      {[
        [50, '50 km'],
        [FIFTY_MILES_KM, '50 miles'],
        [100, '100 km'],
        [HUNDRED_MILES_KM, '100 miles'],
      ].map(([distance, label]) => (
        <button
          key={distance}
          type="button"
          className="secondary-button small-button"
          aria-pressed={p.raceDistanceKm === distance}
          onClick={() => onChange({ ...p, raceDistanceKm: Number(distance) })}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}

export function UltraRoutineFields({
  profile: p,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  if (!isLongUltra(p)) return null;
  return (
    <div className="form-section">
      <p className="subtle">
        Beyond 50 miles, your recent time on feet matters as well as distance.
        Use a typical recent week and a long run you recovered from normally.
      </p>
      <Field
        label="Weeks at a consistent running routine"
        hint="This plan needs at least 12 recent consistent weeks."
      >
        <NumericInput
          name="stableWeeks"
          label="Weeks at a consistent running routine"
          value={p.stableWeeks}
          required
          integer
          min={12}
          max={520}
          onValueChange={(v) => onChange({ ...p, stableWeeks: v ?? NaN })}
        />
      </Field>
      <div className="form-grid">
        <Field
          label="Recent running minutes per week"
          hint="Running and planned walk breaks; exclude cycling and strength."
        >
          <NumericInput
            name="ultraWeeklyMinutes"
            label="Recent running minutes per week"
            value={p.ultraWeeklyMinutes}
            required
            min={60}
            max={1260}
            onValueChange={(v) =>
              onChange({ ...p, ultraWeeklyMinutes: v ?? NaN })
            }
          />
        </Field>
        <Field label="Recent longest run in minutes">
          <NumericInput
            name="ultraLongestMinutes"
            label="Recent longest run in minutes"
            value={p.ultraLongestMinutes}
            required
            min={30}
            max={600}
            onValueChange={(v) =>
              onChange({ ...p, ultraLongestMinutes: v ?? NaN })
            }
          />
        </Field>
      </div>
    </div>
  );
}
