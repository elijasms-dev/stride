import type { Profile } from '@/lib/engine';
import { planPreferenceRows } from '@/lib/plan-preferences-summary';

export function PlanPreferencesSummary({
  profile,
  onEdit,
}: {
  profile: Profile;
  onEdit?: () => void;
}) {
  return (
    <section
      className="plan-preferences-summary"
      aria-label="Your saved plan preferences"
    >
      <div className="section-heading">
        <h2>Your routine</h2>
        {onEdit && (
          <button type="button" className="text-button" onClick={onEdit}>
            Edit preferences
          </button>
        )}
      </div>
      <dl>
        {planPreferenceRows(profile).map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Weekday workouts are separate from the long run. Recovery, taper and
        reviewed return weeks can be lighter; your saved choices stay visible
        here.
      </p>
    </section>
  );
}
