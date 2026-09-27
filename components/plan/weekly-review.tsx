import { dateLabel, kmDisplay, type Plan, type Workout } from '@/lib/engine';
import { weeklyTrainingReview } from '@/lib/weekly-review';
import { runDuration } from '@/lib/journal-view';
import type { QualityEvidenceStatus } from '@/lib/training-evidence';

const evidenceLabels: Record<QualityEvidenceStatus, string> = {
  'reported-complete': 'Main set reported complete',
  'recovery-hold': 'Main set reported complete; recovery needs review',
  'execution-unknown': 'How the main set went is not recorded',
  'dose-unknown': 'Completed main-set duration is not recorded',
  'feedback-unknown': 'Effort or recovery feedback is missing',
  partial: 'Part of the main set completed',
  'easy-substitute': 'Replaced with easy running',
  'not-attempted': 'Main set not attempted',
  'below-dose': 'Less than the planned main set recorded',
};

export function WeeklyReview({
  plan,
  weekIndex,
  today,
  onWorkout,
}: {
  plan: Plan;
  weekIndex: number;
  today: string;
  onWorkout: (w: Workout) => void;
}) {
  const review = weeklyTrainingReview(plan, weekIndex, today);
  if (!review) return null;
  return (
    <details className="weekly-review">
      <summary>
        <strong>{review.finished ? 'Week in review' : 'Week so far'}</strong>
        <span>
          {review.records.length} runs recorded
          {review.unresolved.length
            ? ` · ${review.unresolved.length} not logged`
            : ''}
        </span>
      </summary>
      <div className="weekly-review-body">
        <p>
          Recorded through {dateLabel(review.through)}. Race results are
          separate from these training totals.
        </p>
        <dl className="weekly-review-totals">
          <div>
            <dt>Scheduled for the week</dt>
            <dd>
              {runDuration(review.prescribedMinutes)}
              <small>
                About {kmDisplay(review.prescribedKm, plan.profile.units)}{' '}
                {plan.profile.units}; skipped runs excluded
              </small>
            </dd>
          </div>
          <div>
            <dt>Recorded running</dt>
            <dd>
              {runDuration(review.recordedMinutes)}
              <small>
                {review.unknownDistances ? 'At least ' : ''}
                {kmDisplay(review.knownKm, plan.profile.units)}{' '}
                {plan.profile.units}
                {review.unknownDistances
                  ? `; ${review.unknownDistances} runs without distance`
                  : ''}
              </small>
            </dd>
          </div>
          <div>
            <dt>Main sets reported complete</dt>
            <dd>
              {review.qualityComplete}
              <small>Requires recorded execution and main-set duration</small>
            </dd>
          </div>
          <div>
            <dt>Skipped sessions</dt>
            <dd>
              {review.skipped}
              <small>Unlogged sessions remain unknown</small>
            </dd>
          </div>
        </dl>
        <p className="notice">{review.nextStep}</p>
        {(review.unresolved.length > 0 ||
          review.missingFeedback.length > 0) && (
          <div className="weekly-review-evidence">
            <h3>Records to review</h3>
            {[...review.unresolved, ...review.missingFeedback].map((w) => (
              <button
                className="settings-link"
                type="button"
                key={w.id}
                onClick={() => onWorkout(w)}
              >
                <span>
                  <strong>
                    {dateLabel(w.date)} · {w.title}
                  </strong>
                  <small>
                    {w.status === 'completed'
                      ? 'Completed, with missing recording details'
                      : 'Not logged'}
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
        {review.quality.length > 0 && (
          <div className="weekly-review-evidence">
            <h3>Workout evidence</h3>
            {review.quality.map((item) => (
              <button
                className="settings-link"
                type="button"
                key={item.workout.id}
                onClick={() => onWorkout(item.workout)}
              >
                <span>
                  <strong>
                    {dateLabel(item.date)} · {item.workout.title}
                  </strong>
                  <small>{evidenceLabels[item.status]}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
        <p className="subtle">
          Recorded totals include extra runs and runs from previous blocks on
          their actual dates. Duplicate imported records count once. Scheduled
          totals describe the saved plan, not completed preparation.
        </p>
      </div>
    </details>
  );
}
